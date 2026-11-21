use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{State, Manager};
use std::path::PathBuf;

#[derive(Default)]
struct Session(Mutex<Option<Credentials>>);
struct Credentials { url: String, token: String }
const KEYRING_SERVICE: &str = "de.homelab.manager.beszel";
const KEYRING_USER: &str = "session";
fn vault() -> Result<keyring::Entry,String> {keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e|format!("System-Schlüsselspeicher: {e}"))}
fn persist_session(url:&str,token:&str)->Result<(),String>{
 let data=json!({"url":url,"token":token}).to_string();
 vault()?.set_password(&data).map_err(|e|format!("Sitzung konnte nicht geschützt gespeichert werden: {e}"))
}
fn get_saved_session()->Result<Option<Credentials>,String>{
 let value=match vault()?.get_password(){Ok(x)=>x,Err(keyring::Error::NoEntry)=>return Ok(None),Err(e)=>return Err(format!("Schlüsselspeicher nicht verfügbar: {e}"))};
 let parsed:Value=serde_json::from_str(&value).map_err(|_|"Ungültige gespeicherte Sitzung")?;
 let url=checked_url(parsed["url"].as_str().ok_or("Sitzungsadresse fehlt")?)?;
 let token=parsed["token"].as_str().filter(|x|!x.is_empty()).ok_or("Sitzungstoken fehlt")?.to_owned();
 Ok(Some(Credentials{url,token}))
}

fn checked_url(raw: &str) -> Result<String, String> {
    let url = url::Url::parse(raw.trim()).map_err(|_| "Ungültige Adresse".to_string())?;
    if !["http", "https"].contains(&url.scheme()) || url.host_str().is_none() || url.username() != "" || url.password().is_some() || url.query().is_some() || url.fragment().is_some() {
        return Err("Bitte eine einfache HTTP(S)-Adresse ohne Zugangsdaten eingeben".to_string());
    }
    if url.path() != "/" { return Err("Keine zusätzlichen URL-Pfade erlaubt".to_string()); }
    // Plain HTTP only to loopback and RFC1918 private IPv4 LAN addresses.
    if url.scheme() == "http" {
        let allowed = match url.host_str().unwrap_or_default().parse::<std::net::IpAddr>() {
            Ok(std::net::IpAddr::V4(ip)) => ip.is_private() || ip.is_loopback(),
            Ok(std::net::IpAddr::V6(ip)) => ip.is_loopback(),
            _ => url.host_str() == Some("localhost"),
        };
        if !allowed { return Err("HTTP ist nur für private IP-Adressen erlaubt; sonst HTTPS nutzen".into()); }
    }
    Ok(raw.trim().trim_end_matches('/').to_string())
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().timeout(std::time::Duration::from_secs(12)).redirect(reqwest::redirect::Policy::none()).build().map_err(|e|e.to_string())
}

async fn fetch_json(client:&reqwest::Client,url:&str,token:&str)->Result<Value,String>{
    let r=client.get(url).header("Authorization",token).send().await.map_err(|e|e.to_string())?;
    let status=r.status();
    if !status.is_success() {let detail=r.text().await.unwrap_or_default();return Err(format!("Beszel API: HTTP {} – {}",status,detail.chars().take(400).collect::<String>()));}
    r.json::<Value>().await.map_err(|e|e.to_string())
}

#[tauri::command]
async fn beszel_login(url:String,email:String,password:String,session:State<'_,Session>)->Result<bool,String>{
    let base=checked_url(&url)?;
    if email.trim().is_empty() || password.is_empty() { return Err("E-Mail und Passwort fehlen".into()); }
    let r=client()?.post(format!("{base}/api/collections/users/auth-with-password"))
       .json(&json!({"identity":email,"password":password})).send().await.map_err(|e|e.to_string())?;
    if !r.status().is_success() {return Err(format!("Anmeldung fehlgeschlagen (HTTP {})",r.status()));}
    let body:Value=r.json().await.map_err(|e|e.to_string())?;
    let token=body.get("token").and_then(Value::as_str).filter(|s| !s.is_empty()).ok_or("Kein Token erhalten")?;
    persist_session(&base,token)?;
    *session.0.lock().map_err(|_|"Sperrfehler")?=Some(Credentials {url:base,token:token.to_string()});
    Ok(true)
}

#[tauri::command]
fn beszel_logout(session:State<'_,Session>)->Result<(),String>{
    *session.0.lock().map_err(|_|"Sperrfehler")?=None;
    match vault()?.delete_credential(){Ok(())|Err(keyring::Error::NoEntry)=>Ok(()),Err(e)=>Err(format!("Gespeicherte Anmeldung konnte nicht gelöscht werden: {e}"))}
}

#[tauri::command]
async fn beszel_resume(session:State<'_,Session>)->Result<Option<Value>,String>{
 let Some(saved)=get_saved_session()? else{return Ok(None)};
 // Validate saved session before accepting it.
 let endpoint=format!("{}/api/collections/systems/records?perPage=1",saved.url);
 fetch_json(&client()?,&endpoint,&saved.token).await?;
 let address=saved.url.clone();
 *session.0.lock().map_err(|_|"Sperrfehler")?=Some(saved);
 Ok(Some(json!({"url":address})))
}
#[tauri::command]
fn beszel_export_session(session:State<'_,Session>)->Result<Value,String>{
 let lock=session.0.lock().map_err(|_|"Sperrfehler")?;
 let entry=lock.as_ref().ok_or("Nicht angemeldet. Bitte vor der Sicherung verbinden")?;
 Ok(json!({"url":entry.url,"token":entry.token}))
}
#[tauri::command]
async fn beszel_restore_session(url:String,token:String,session:State<'_,Session>)->Result<bool,String>{
 let base=checked_url(&url)?;
 if token.len()<20||token.len()>8192{return Err("Ungültiger Token".into())}
 fetch_json(&client()?,&format!("{base}/api/collections/systems/records?perPage=1"),&token).await?;
 persist_session(&base,&token)?;
 *session.0.lock().map_err(|_|"Sperrfehler")?=Some(Credentials{url:base,token});
 Ok(true)
}
#[tauri::command]
async fn beszel_snapshot(session:State<'_,Session>)->Result<Value,String>{
    // Avoid holding the mutex across await.
    let (base,token)={let lock=session.0.lock().map_err(|_|"Sperrfehler")?;
      let creds=lock.as_ref().ok_or("Nicht angemeldet")?;(creds.url.clone(),creds.token.clone())};
    let client=client()?;
    let systems_json=fetch_json(&client,&format!("{base}/api/collections/systems/records?perPage=100"),&token).await?;
    let systems=systems_json.get("items").and_then(Value::as_array).cloned().unwrap_or_default();
    let mut metrics=HashMap::<String,Value>::new();
    for sys in &systems {
        if let Some(id)=sys.get("id").and_then(Value::as_str) {
            let query=url::form_urlencoded::Serializer::new(String::new())
                .append_pair("filter",&format!("system = \"{}\"",id))
                .append_pair("sort","-created").append_pair("perPage","1").finish();
            let endpoint=format!("{base}/api/collections/system_stats/records?{query}");
            let entry=fetch_json(&client,&endpoint,&token).await.ok().and_then(|v|v.get("items")?.as_array()?.first().cloned()).unwrap_or(Value::Null);
            metrics.insert(id.to_owned(),entry);
        }
    }
    Ok(json!({"systems":systems,"metrics":metrics}))
}

// Beszel collections are read-only here; the app never issues writes to the Hub.
#[tauri::command]
async fn beszel_records(collection:String,system_id:String,limit:u32,session:State<'_,Session>)->Result<Value,String>{
    if !["system_stats","containers","container_stats"].contains(&collection.as_str()) {return Err("Collection nicht erlaubt".into());}
    if system_id.len()>80 || !system_id.chars().all(|c|c.is_ascii_alphanumeric() || c=='_' || c=='-') {return Err("Ungültige System-ID".into());}
    let (base,token)={let lock=session.0.lock().map_err(|_|"Sperrfehler")?;
      let creds=lock.as_ref().ok_or("Nicht angemeldet")?;(creds.url.clone(),creds.token.clone())};
    let query=url::form_urlencoded::Serializer::new(String::new())
        .append_pair("filter",&format!("system = \"{}\"",system_id))
        .append_pair("sort","-created").append_pair("perPage",&limit.min(200).max(1).to_string()).finish();
    fetch_json(&client()?,&format!("{base}/api/collections/{collection}/records?{query}"),&token).await
}

// Separate native image storage prevents localStorage quotas from blocking wallpapers.
fn asset_path(app:&tauri::AppHandle,kind:&str)->Result<PathBuf,String>{
 if !(["background","customLogo"].contains(&kind) || ((kind.starts_with("server_") || kind.starts_with("service_") || kind.starts_with("group_")) && kind.len() <= 90 && kind.split_once('_').map(|(_,suffix)|suffix).unwrap_or("").chars().all(|c|c.is_ascii_alphanumeric() || c == '_' || c == '-'))) {return Err("Unbekannter Bildtyp".into())}
 let dir=app.path().app_data_dir().map_err(|e|e.to_string())?;
 std::fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
 Ok(dir.join(format!("homelab-{}.image",kind)))
}
#[tauri::command]
fn save_asset(app:tauri::AppHandle,kind:String,data_url:String)->Result<bool,String>{
 let (mime,encoded)=data_url.split_once(',').ok_or("Ungültige Bilddatei")?;
 if !["data:image/png;base64","data:image/jpeg;base64","data:image/webp;base64"].contains(&mime){return Err("Bildformat nicht erlaubt".into())}
 if encoded.len()>40_000_000{return Err("Datei ist zu groß".into())}
 use base64::Engine;
 let bytes=base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|e|e.to_string())?;
 if bytes.len()>30_000_000 {return Err("Bild ist zu groß".into())}
 let valid=match mime {"data:image/png;base64"=>bytes.starts_with(&[137,80,78,71,13,10,26,10]),"data:image/jpeg;base64"=>bytes.starts_with(&[255,216,255]),"data:image/webp;base64"=>bytes.starts_with(b"RIFF")&&bytes.get(8..12)==Some(b"WEBP"),_=>false};
 if !valid{return Err("Bildsignatur passt nicht zum Format".into())}
 let path=asset_path(&app,&kind)?;
 std::fs::write(path,format!("{},{}",mime,encoded)).map_err(|e|e.to_string())?;
 Ok(true)
}
#[tauri::command]
fn load_asset(app:tauri::AppHandle,kind:String)->Result<Option<String>,String>{
 let path=asset_path(&app,&kind)?;
 if !path.exists(){return Ok(None)}
 let text=std::fs::read_to_string(path).map_err(|e|e.to_string())?;
 if !text.starts_with("data:image/"){return Err("Ungültige Bilddaten".into())}
 Ok(Some(text))
}
#[tauri::command]
fn delete_asset(app:tauri::AppHandle,kind:String)->Result<bool,String>{
 let path=asset_path(&app,&kind)?;
 if path.exists(){std::fs::remove_file(path).map_err(|e|e.to_string())?}
 Ok(true)
}
// Personal settings are stored outside the installation, in Tauri's per-user app data.
// Atomic replacement prevents a partial JSON file after a crash or shutdown.
fn config_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let folder = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    Ok(folder.join("preferences-v1.json"))
}

#[tauri::command]
fn read_preferences(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    let path = config_file(&app)?;
    if !path.exists() { return Ok(None); }
    let contents = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&contents).map_err(|e| format!("Konfiguration ist beschädigt: {e}"))?;
    if !value.is_object() { return Err("Konfiguration hat ein ungültiges Format".into()); }
    Ok(Some(value))
}

#[tauri::command]
fn write_preferences(app: tauri::AppHandle, preferences: Value) -> Result<bool, String> {
    if !preferences.is_object() {return Err("Konfiguration muss ein JSON-Objekt sein".into());}
    let bytes=serde_json::to_vec_pretty(&preferences).map_err(|e| e.to_string())?;
    if bytes.len()>2_000_000 {return Err("Konfiguration ist zu groß".into());}
    let path=config_file(&app)?;
    let temporary=path.with_extension("json.tmp");
    std::fs::write(&temporary,bytes).map_err(|e| e.to_string())?;
    // On Windows rename cannot replace an existing file; keep a recovery copy while replacing.
    let previous=path.with_extension("json.previous");
    if path.exists() {
        std::fs::copy(&path,&previous).map_err(|e| e.to_string())?;
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    std::fs::rename(&temporary,&path).map_err(|e| e.to_string())?;
    Ok(true)
}

// Snapshot settings AND local images before an update. Never includes credentials:
// login tokens are held only in memory and aren't stored in these files.
#[tauri::command]
fn backup_preferences(app: tauri::AppHandle) -> Result<String, String> {
    let path=config_file(&app)?;
    let folder=path.parent().ok_or("Ungültiger Datenpfad")?;
    let backups=folder.join("backups");
    std::fs::create_dir_all(&backups).map_err(|e| e.to_string())?;
    let timestamp=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e|e.to_string())?.as_secs();
    let target=backups.join(format!("backup-{timestamp}"));
    std::fs::create_dir_all(&target).map_err(|e|e.to_string())?;
    if path.exists(){std::fs::copy(&path,target.join("preferences-v1.json")).map_err(|e|e.to_string())?;}
    for item in std::fs::read_dir(folder).map_err(|e|e.to_string())? {
        let item=item.map_err(|e|e.to_string())?;
        if !item.file_type().map_err(|e|e.to_string())?.is_file(){continue;}
        let name=item.file_name();let name=name.to_string_lossy();
        if name.starts_with("homelab-") && name.ends_with(".image") {
            std::fs::copy(item.path(),target.join(name.as_ref())).map_err(|e|e.to_string())?;
        }
    }
    Ok(target.to_string_lossy().to_string())
}

// The user chooses an explicit destination through the operating system's save dialog.
#[tauri::command]
fn write_export_file(path:String,contents:String)->Result<String,String>{
 let target=PathBuf::from(path);
 if target.extension().and_then(|e|e.to_str()).map(|e|e.to_ascii_lowercase())!=Some("json".into()) {return Err("Nur .json-Dateien erlaubt".into());}
 if contents.len()>90_000_000 {return Err("Export zu groß".into());}
 std::fs::write(&target,contents.as_bytes()).map_err(|e|e.to_string())?;
 Ok(target.to_string_lossy().into_owned())
}
#[tauri::command]
fn backup_preferences_to(app:tauri::AppHandle,destination:String)->Result<String,String>{
 let folder=PathBuf::from(destination);
 if !folder.is_dir(){return Err("Bitte einen existierenden Ordner auswählen".into())}
 let source=PathBuf::from(backup_preferences(app)?);
 let dest=folder.join(source.file_name().ok_or("Fehlerhafter Backup-Name")?);
 if dest.exists(){return Err("Backup-Ziel existiert bereits; bitte anderen Ordner wählen".into());}
 std::fs::create_dir(&dest).map_err(|e|e.to_string())?;
 for entry in std::fs::read_dir(source).map_err(|e|e.to_string())? {
  let entry=entry.map_err(|e|e.to_string())?;
  if entry.file_type().map_err(|e|e.to_string())?.is_file(){std::fs::copy(entry.path(),dest.join(entry.file_name())).map_err(|e|e.to_string())?;}
 }
 Ok(dest.to_string_lossy().into_owned())
}
// List containers without a guessed sort field, then filter on the client.
// Some Beszel versions reject a filter/sort combination on this collection.
#[tauri::command]
async fn beszel_containers(system_id:String,session:State<'_,Session>)->Result<Value,String>{
 if system_id.len()>80||!system_id.chars().all(|c|c.is_ascii_alphanumeric()||c=='_'||c=='-'){return Err("Ungültige System-ID".into())}
 let (base,token)={let lock=session.0.lock().map_err(|_|"Sperrfehler")?;let c=lock.as_ref().ok_or("Nicht angemeldet")?;(c.url.clone(),c.token.clone())};
 let http=client()?;
 let first=fetch_json(&http,&format!("{base}/api/collections/containers/records?perPage=200"),&token).await;
 if let Ok(mut body)=first {
  if let Some(items)=body.get_mut("items").and_then(Value::as_array_mut){items.retain(|x|x.get("system").and_then(Value::as_str)==Some(system_id.as_str()));}
  return Ok(body)
 }
 // Older Beszel releases can expose container_stats snapshots instead.
 let query=url::form_urlencoded::Serializer::new(String::new()).append_pair("filter",&format!("system = \"{}\"",system_id)).append_pair("sort","-created").append_pair("perPage","1").finish();
 match fetch_json(&http,&format!("{base}/api/collections/container_stats/records?{query}"),&token).await {
  Ok(snapshot)=>{let items=snapshot.get("items").and_then(Value::as_array).and_then(|x|x.first()).and_then(|r|r.get("stats")).and_then(Value::as_array).cloned().unwrap_or_default();Ok(json!({"items":items}))}
  Err(fallback)=>Err(format!("Container-Abfrage: {}; Statistik-Fallback: {}",first.err().unwrap_or_default(),fallback))
 }
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init()).plugin(tauri_plugin_dialog::init()).manage(Session::default());
    // Only installed release builds get the configured, signed updater.
    // Debug builds do not require a repository or a signing key.
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build()).plugin(tauri_plugin_process::init());
    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_process::init());
    builder
      .invoke_handler(tauri::generate_handler![beszel_login,beszel_logout,beszel_resume,beszel_export_session,beszel_restore_session,beszel_snapshot,beszel_records,beszel_containers,save_asset,load_asset,delete_asset,read_preferences,write_preferences,backup_preferences,backup_preferences_to,write_export_file])
      .run(tauri::generate_context!()).expect("error while running HomeLab Manager");
}
