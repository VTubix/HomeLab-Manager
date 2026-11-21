import './style.css';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { save as chooseSavePath, open as chooseFolder } from '@tauri-apps/plugin-dialog';
const app = document.querySelector('#app');
const releaseBuild = Boolean(window.__TAURI_INTERNALS__) && !import.meta.env.DEV;
const updaterState = { version: '0.3.0', status: '', available: null, busy: false, progress: null, checked: false };
async function checkForAppUpdates({silent=false}={}) {
  if (!releaseBuild) { updaterState.status='Updates funktionieren in der installierten Windows-Version. Im Entwicklungsmodus sind sie deaktiviert.'; render(); return; }
  if (updaterState.busy) return;
  updaterState.busy=true;
  updaterState.status='Suche nach Updates auf GitHub …';
  if (!silent && s.connected) render();
  try {
    if (updaterState.available) { try {await updaterState.available.close()} catch {} }
    updaterState.available=await check();
    updaterState.checked=true;
    updaterState.status=updaterState.available?`Version ${updaterState.available.version} ist verfügbar.`:'Du hast bereits die neueste Version.';
  } catch(e) {
    updaterState.status='Updateprüfung fehlgeschlagen: '+String(e?.message||e);
  } finally { updaterState.busy=false; if(s.connected) render(); }
}
async function installAppUpdate() {
  if (!releaseBuild || !updaterState.available || updaterState.busy) return;
  updaterState.busy=true;
  updaterState.progress=null;
  updaterState.status='Update wird heruntergeladen und geprüft …'; render();
  try {
    await nativeSaveQueue;
    await invoke('backup_preferences');
    let received=0,total=0;
    await updaterState.available.downloadAndInstall(event=>{
      if(event.event==='Started') {total=event.data.contentLength||0;received=0;}
      if(event.event==='Progress') received+=event.data.chunkLength||0;
      if(event.event==='Finished') updaterState.status='Download abgeschlossen. Installation läuft …';
      updaterState.progress=total>0?Math.min(100,Math.round(received/total*100)):null;
      const status=document.querySelector('#update-status');
      if(status)status.textContent=updaterState.status+(updaterState.progress===null?'':` (${updaterState.progress} %)`) ;
    });
    updaterState.status='Update installiert. Anwendung wird neu gestartet …';
    render();
    await relaunch();
  } catch(e) {
    updaterState.status='Installation fehlgeschlagen: '+String(e?.message||e);
    updaterState.busy=false;
    render();
  }
}
function updateSettingsCard() {
  const available=updaterState.available;
  return `<div class="card settings-card" id="app-updates"><h2>App-Updates · GitHub Releases</h2>
    <p class="muted-text">Installierte Version: <b>${safe(updaterState.version)}</b><br>
    Signierte Updates werden beim App-Start gesucht. Installiert wird nur nach deiner Bestätigung.</p>
    <p class="muted-text" id="update-status" role="status">${safe(updaterState.status||'Noch nicht geprüft.')}${updaterState.progress===null?'':` (${updaterState.progress} %)`}</p>
    ${available?`<p class="muted-text"><b>Neu: ${safe(available.version)}</b>${available.body?`<br>${safe(available.body)}`:''}</p><button id="install-update" class="primary" ${updaterState.busy?'disabled':''}>⬇ Version ${safe(available.version)} installieren</button>`:''}
    <div class="settings-actions"><button id="check-updates" class="secondary" ${updaterState.busy||!releaseBuild?'disabled':''}>↻ Nach Updates suchen</button></div>
    ${!releaseBuild?'<small>Vorschau/Entwicklungsmodus: Updateprüfung ist erst im installierten Release aktiv.</small>':''}
  </div>`;
}

const native = Boolean(window.__TAURI_INTERNALS__);
const DEFAULT = {refreshSeconds:10,background:'',customLogo:'',dim:72,serverOrder:[],diskGroups:[],diskOrder:{},collapsed:[],dockerCollapsed:[],dockerGroupOrder:[],showBackground:true,serverNames:{},serverIcons:{},customGroups:[],containerGroups:{},extraServices:[],dockerSystemId:"",serviceUrls:{},beszelAddress:'',dockerUrls:{}};
const loadPrefs=()=>{try{return {...DEFAULT,...JSON.parse(localStorage.getItem('homelab.v02.preferences')||'{}')}}catch{return {...DEFAULT}}};
// Desktop startup must not silently import WebView data. Old v0.2.x data can be
// transferred deliberately, while the native JSON remains authoritative.
let prefs=native ? {...DEFAULT} : loadPrefs();
let legacyPrefsCandidate=null;
let nativePreferencesPresent=false;
prefs.serverNames ||= {}; prefs.serverIcons ||= {}; prefs.customGroups ||= []; prefs.containerGroups ||= {}; prefs.extraServices ||= [];
const serverImages = {};
const serverTitle=sys=>prefs.serverNames[sys.id] || sys.name;
const customGroup=(id)=>prefs.customGroups.find(g=>g.id===id);

prefs.serviceUrls={...DEFAULT.serviceUrls,...(prefs.serviceUrls||{})};
// No private network addresses are shipped with the public source.
const SERVICE_DEFAULTS={};
prefs.dockerUrls={...SERVICE_DEFAULTS,...(prefs.dockerUrls||{})};

// Legacy v0.2 base64 assets are migrated to app data on start.
const tryHttpUrl=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}};
async function openService(id){const sys=s.systems.find(v=>v.id===id||v.name===id);const url=tryHttpUrl(prefs.serviceUrls[sys?.id]||prefs.serviceUrls[sys?.name]||'');if(!url){s.error='Bitte zuerst eine gültige Dienst-Adresse in den Einstellungen hinterlegen.';render();return}try{if(native)await openUrl(url);else window.open(url,'_blank','noopener,noreferrer')}catch(e){s.error='Dienst konnte nicht geöffnet werden: '+String(e);render()}}
async function openDockerService(id){const url=tryHttpUrl(prefs.dockerUrls[id]||'');if(!url){s.error='Für diesen Dienst ist noch keine Webadresse hinterlegt. Unter Einstellungen → Docker-Webadressen kannst du sie eintragen.';render();return}try{if(native)await openUrl(url);else window.open(url,'_blank','noopener,noreferrer')}catch(e){s.error='Webseite konnte nicht geöffnet werden: '+String(e);render()}}
// Native app data survives application binary updates. Keep a legacy WebView mirror only
// for migration; it is not the authoritative settings store in the desktop app.
let nativeSaveQueue=Promise.resolve();
let preferencesReady=false;
function storedPreferences(){
 const stored={...prefs,serverIcons:{...(prefs.serverIcons||{})}};
 if(native){stored.background='';stored.customLogo='';for(const key of Object.keys(stored.serverIcons||{})){if(typeof stored.serverIcons[key]==='string'&&stored.serverIcons[key].startsWith('data:'))stored.serverIcons[key]='saved';}}
 return stored;
}
const save=()=>{
 const stored=storedPreferences();
 if(!native){try{localStorage.setItem('homelab.v02.preferences',JSON.stringify(stored))}catch{return false;}}
 if(native&&preferencesReady){nativeSaveQueue=nativeSaveQueue.then(()=>invoke('write_preferences',{preferences:stored})).catch(err=>{console.error('Einstellungen konnten nicht gespeichert werden:',err);s.error='Einstellungen konnten nicht dauerhaft gespeichert werden: '+String(err);render()});}
 return true;
};
function normalizePreferences(value){
 const normalized={...DEFAULT,...value};
 normalized.serverNames ||= {};normalized.serverIcons ||= {};normalized.customGroups ||= [];
 normalized.containerGroups ||= {};normalized.extraServices ||= [];
 normalized.serviceUrls={...DEFAULT.serviceUrls,...(normalized.serviceUrls||{})};
 normalized.dockerUrls={...SERVICE_DEFAULTS,...(normalized.dockerUrls||{})};
 return normalized;
}
async function migrateLegacyPreferences(){
 if(!native||!legacyPrefsCandidate)return;
 prefs=normalizePreferences(legacyPrefsCandidate);
 legacyPrefsCandidate=null;
 preferencesReady=true;
 migrateLegacyGroups();
 save();await nativeSaveQueue;
 nativePreferencesPresent=true;
 // Remove the old WebView copy only AFTER native persistence succeeds.
 try{localStorage.removeItem('homelab.v02.preferences')}catch{}
 await initAssets();await loadServiceIcons();await loadGroupIcons();
 s.url=prefs.beszelAddress||'';
 render();
 await resumeSavedSession();
}
async function startWithBlankPreferences(){
 legacyPrefsCandidate=null;
 prefs=normalizePreferences(DEFAULT);
 s.url='';s.connected=false;s.token='';
 preferencesReady=true;
 save();await nativeSaveQueue;
 nativePreferencesPresent=true;
 // A stale session in the OS vault will not be resumed without a matching URL.
 render();
}
async function initializePreferences(){
 if(!native){preferencesReady=true;return;}
 try{
  const stored=await invoke('read_preferences');
  if(stored){
   prefs=normalizePreferences(stored);
   nativePreferencesPresent=true;
   preferencesReady=true;
   migrateLegacyGroups();
  }else{
   prefs=normalizePreferences(DEFAULT);
   // An upgrade from 0.2.x may still have preferences only in WebView storage.
   // Never silently merge them into an intentionally fresh installation.
   const legacy=loadPrefs();
   const hasLegacy=Object.keys(legacy).some(key=>JSON.stringify(legacy[key])!==JSON.stringify(DEFAULT[key]));
   if(hasLegacy){legacyPrefsCandidate=legacy;preferencesReady=false;}
   else{preferencesReady=true;save();await nativeSaveQueue;nativePreferencesPresent=true;}
  }
 }catch(err){
  console.error('Konfiguration konnte nicht gelesen werden:',err);
  s.error='Lokale Konfiguration konnte nicht geladen werden. Änderungen nicht speichern, bevor das Problem behoben wurde: '+String(err);
  preferencesReady=false;
 }
 await initAssets();await loadServiceIcons();await loadGroupIcons();
 if(!s.url&&prefs.beszelAddress)s.url=prefs.beszelAddress;
 render();
}

let s={url:'',token:'',connected:false,busy:false,systems:[],metrics:{},updated:null,error:'',page:'overview',detail:null,history:{},containers:[],containerError:'',dockerDetected:false,dockerSystems:[],dockerLastScan:0,lastFetch:null};
const desc={};
// These URL images are the original GitHub organisation avatars (not recreated artwork).
const brands={'OctoPi':'https://github.com/OctoPrint.png','HAOS Dell':'https://github.com/home-assistant.png','Docker-Pi':'https://github.com/portainer.png','Plex-Pi':'https://github.com/plexinc.png'}; // Optional logos only; server list comes exclusively from Beszel.
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,dec=1)=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?'–':Number(v).toLocaleString('de-DE',{minimumFractionDigits:dec,maximumFractionDigits:dec});
const clamp=x=>Math.max(0,Math.min(100,Number(x)||0));
const pct=(u,t)=>t>0?u/t*100:0;
const diskFmt=(v,total)=>Number(total)>=1000?`${n(v/1000,2)} TB`:`${n(v,1)} GB`;
const displayTime=v=>v?new Date(v).toLocaleTimeString('de-DE'):'–';
const metric=sid=>s.metrics[sid]?.stats||{};
const measureTime=sid=>s.metrics[sid]?.created||null;
const sorted=(items,keys,getKey)=>items.slice().sort((a,b)=>{let aa=keys.indexOf(getKey(a)),bb=keys.indexOf(getKey(b));return (aa<0?10000:aa)-(bb<0?10000:bb)});
const servers=()=>sorted(s.systems,prefs.serverOrder,o=>prefs.serverOrder.includes(o.id)?o.id:o.name);
const temperature=st=>{const o=st.t||{};return o.cpu_thermal??o.coretemp_package_id_0??Object.values(o).find(v=>typeof v==='number');};
const drivesFor=sys=>{const stat=metric(sys.id),disks=[];
  if(Number(stat.d)>0)disks.push({id:'Systemlaufwerk',host:sys.name,total:Number(stat.d),used:Number(stat.du)||0});
  Object.entries(stat.efs||{}).forEach(([name,v])=>{if(Number(v.d)>0)disks.push({id:name,host:sys.name,total:Number(v.d),used:Number(v.du)||0})});
  return sorted(disks,prefs.diskOrder[sys.name]||[],d=>d.id);
};
const groupServers=()=>sorted(s.systems,prefs.diskGroups,o=>prefs.diskGroups.includes(o.id)?o.id:o.name);
const allDrives=()=>s.systems.flatMap(drivesFor);
const logo=sys=>`<img class="brand-img" src="${safe(serverImages[sys.id] || brands[sys.name] || '')}" alt="${safe(serverTitle(sys))} Logo" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="logo-fallback" style="display:none">${safe(serverTitle(sys).slice(0,1))}</span>`;

async function api(path,method='GET',body=null){const headers={'Content-Type':'application/json'};if(s.token)headers.Authorization=s.token;const res=await fetch(s.url+path,{method,headers,body:body?JSON.stringify(body):undefined});const value=await res.json().catch(()=>({}));if(!res.ok)throw Error(value.message||`HTTP ${res.status}`);return value;}
async function login(url,email,password){if(native)return invoke('beszel_login',{url,email,password});s.url=url;const result=await api('/api/collections/users/auth-with-password','POST',{identity:email,password});s.token=result.token;}

// Desktop credentials are stored in the OS credential vault, not in preferences.
async function resumeSavedSession(){
 if(!native||!nativePreferencesPresent||!prefs.beszelAddress||legacyPrefsCandidate)return;
 try {
  const result=await invoke('beszel_resume');
  if(!result?.url||result.url.replace(/\/+$/,'')!==prefs.beszelAddress.replace(/\/+$/,''))return;
  s.url=result.url;
  s.connected=true;
  await refresh(false);
  if(s.error){s.connected=false;s.error='Gespeicherte Sitzung muss erneuert werden: '+s.error;render()}
 }catch(e){console.info('Keine gespeicherte Sitzung:',String(e))}
}
// AES-256-GCM, PBKDF2-SHA256 with random 16-byte salt and 12-byte IV.
const enc=new TextEncoder(),dec=new TextDecoder();
const toB64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64=t=>Uint8Array.from(atob(t),c=>c.charCodeAt(0));
async function cryptoKey(password,salt){
 const raw=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function exportEncrypted(){
 if(!native){s.error='Verschlüsselte Komplettsicherung ist nur in der Desktop-App möglich.';render();return}
 const pw=prompt('Backup-Passwort festlegen (mindestens 12 Zeichen):');
 if(pw===null)return;
 if(pw.length<12){s.error='Bitte mindestens 12 Zeichen verwenden.';render();return}
 const again=prompt('Backup-Passwort wiederholen:');if(pw!==again){s.error='Passwörter stimmen nicht überein.';render();return}
 try{
  await nativeSaveQueue;
  const assets=await collectAssets();
  const session=await invoke('beszel_export_session');
  const payload={format:'homelab-manager-full',schemaVersion:1,preferences:storedPreferences(),assets,beszelAddress:s.url||prefs.beszelAddress||'',serverIdentities:s.systems.map(x=>({id:x.id,name:x.name})),session};
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await cryptoKey(pw,salt);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(payload)));
  const exported=await saveJsonAs({format:'homelab-manager-encrypted',version:1,kdf:'PBKDF2-SHA256',iterations:600000,cipher:'AES-256-GCM',salt:toB64(salt),iv:toB64(iv),ciphertext:toB64(encrypted)},'homelab-manager-full-encrypted.json');
  s.error=exported?'Verschlüsseltes Backup gespeichert: '+exported:'Speichern abgebrochen.';render();
 }catch(e){s.error='Verschlüsselter Export fehlgeschlagen: '+String(e);render()}
}
async function importEncrypted(file){
 if(!file)return;
 if(file.size>60_000_000){s.error='Backup ist zu groß';render();return}
 const pw=prompt('Backup-Passwort zum Entschlüsseln:');if(pw===null)return;
 try{
  const blob=JSON.parse(await file.text());
  if(blob.format!=='homelab-manager-encrypted'||blob.version!==1||blob.iterations!==600000||blob.cipher!=='AES-256-GCM')throw Error('Unbekanntes Backupformat');
  const salt=fromB64(blob.salt),iv=fromB64(blob.iv);
  if(salt.length!==16||iv.length!==12)throw Error('Backup-Metadaten beschädigt');
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv},await cryptoKey(pw,salt),fromB64(blob.ciphertext));
  const data=JSON.parse(dec.decode(plaintext));
  if(data.format!=='homelab-manager-full'||data.schemaVersion!==1||!data.preferences||!data.assets)throw Error('Ungültige Backup-Inhalte');
  if(!confirm('Vorhandene Einstellungen und Anmeldung werden ersetzt. Vorher wird eine lokale Sicherung erstellt. Fortfahren?'))return;
  await applyConfig(data);
  prefs.pendingServerBindings=data.serverIdentities||[];await restoreAddress(data);
  save();if(native)await nativeSaveQueue;
  // Restore a matching valid session only; changed hubs require a new login.
  if(data.session?.url&&data.session?.token&&data.session.url===(prefs.beszelAddress||data.session.url)){
   try{await invoke('beszel_restore_session',{url:data.session.url,token:data.session.token});s.url=data.session.url;s.connected=true;await refresh(false)}
   catch(e){s.connected=false;s.error='Konfiguration wiederhergestellt; Beszel-Anmeldung erneuern: '+String(e)}
  }
  render();
 }catch(e){s.error='Entschlüsseln/Import fehlgeschlagen: '+String(e);render()}
}
async function saveJsonAs(data, filename) {
 const contents=JSON.stringify(data,null,2);
 if(!native){ downloadJson(data,filename); return 'Browser-Downloads'; }
 const path=await chooseSavePath({defaultPath:filename,filters:[{name:'JSON-Sicherung',extensions:['json']}]});
 if(!path)return null;
 return invoke('write_export_file',{path,contents});
}
async function restoreAddress(data){
 const fromBackup=data?.beszelAddress||data?.session?.url||data?.preferences?.beszelAddress||'';
 if(!fromBackup)return;
 const current=s.url||prefs.beszelAddress||'';
 let selected=fromBackup;
 if(current&&current!==fromBackup){
  const response=prompt('Beszel-Adresse aus dem Backup (bei Serverumzug eine neue Adresse eingeben):',fromBackup);
  if(response===null)return;
  selected=response.trim();
 }
 if(!tryHttpUrl(selected))throw Error('Die Beszel-Adresse aus dem Backup ist ungültig');
 if(s.connected&&s.url&&s.url!==selected){
  if(native)await invoke('beszel_logout').catch(()=>{});
  s.connected=false;s.systems=[];s.metrics={};s.containers=[];s.dockerDetected=false;
 }
 prefs.beszelAddress=selected;
 s.url=selected;
}
function downloadJson(obj,name){const u=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}
async function collectAssets(){const values=storedPreferences(),assets={};if(native){for(const kind of ['background','customLogo',...Object.keys(values.serverIcons||{}).map(id=>'server_'+id),...(prefs.extraServices||[]).map(item=>'service_'+item.id),...(prefs.customGroups||[]).map(g=>'group_'+g.id)]){const val=await invoke('load_asset',{kind}).catch(()=>null);if(val)assets[kind]=val}}else{for(const kind of ['background','customLogo'])if(prefs[kind])assets[kind]=prefs[kind];for(const [id,val]of Object.entries(prefs.serverIcons||{}))if(val.startsWith('data:image/'))assets['server_'+id]=val}return assets}
async function applyConfig(data){
 const assets=data.assets||{};
 if(!data.preferences||typeof data.preferences!=='object'||Array.isArray(data.preferences))throw Error('Ungültige Konfiguration');
 for(const [kind,value]of Object.entries(assets))if(!/^(background|customLogo|(?:server|service|group)_[a-zA-Z0-9_-]{1,80})$/.test(kind)||typeof value!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(value))throw Error('Ungültiges Bild: '+kind);
 if(native){await nativeSaveQueue;await invoke('backup_preferences');for(const [kind,val]of Object.entries(assets))await invoke('save_asset',{kind,dataUrl:val})}
 prefs={...DEFAULT,...data.preferences};prefs.serverNames||={};prefs.serverIcons||={};prefs.customGroups||=[];prefs.containerGroups||={};prefs.extraServices||=[];prefs.serviceUrls={...(prefs.serviceUrls||{})};prefs.dockerUrls={...(prefs.dockerUrls||{})};
 if(!native)for(const [kind,value]of Object.entries(assets)){if(kind==='background'||kind==='customLogo')prefs[kind]=value;else prefs.serverIcons[kind.slice(7)]=value}
 save();if(native)await nativeSaveQueue;for(const key of Object.keys(serverImages))delete serverImages[key];await initAssets();await loadServerIcons();await loadServiceIcons();await loadGroupIcons();
}
async function records(collection,id,limit=60){if(native)return invoke('beszel_records',{collection,systemId:id,limit});const q=new URLSearchParams({filter:`system = "${id}"`,sort:'-created',perPage:String(limit)});return api(`/api/collections/${collection}/records?${q}`)}
async function snapshot(){if(native)return invoke('beszel_snapshot');const result=await api('/api/collections/systems/records?perPage=100');const systems=result.items||[],metrics={};await Promise.all(systems.map(async sys=>{try{const r=await records('system_stats',sys.id,1);metrics[sys.id]=r.items?.[0]||null}catch{metrics[sys.id]=null}}));return {systems,metrics};}
const bar=(val,blue=false)=>`<div class="track ${blue?'blue':''}"><i style="width:${clamp(val)}%"></i></div>`;
function diskCard(d){return `<article class="disk card"><div class="disk-title"><div><h3>${safe(d.id)}</h3><small>${safe(d.host)}</small></div><span class="drive-icon">▤</span></div><div class="disk-values"><b>${diskFmt(d.used,d.total)}</b><span>von ${diskFmt(d.total,d.total)} belegt</span></div>${bar(pct(d.used,d.total),true)}<div class="disk-bottom"><span>${n(pct(d.used,d.total))}% verwendet</span><span>${diskFmt(Math.max(0,d.total-d.used),d.total)} frei</span></div></article>`}
function diskGroups(view){return `<div class="disk-groups">${groupServers().map((sys,idx)=>{const disks=drivesFor(sys),closed=prefs.collapsed.includes(sys.name);return `<section class="storage-group card" data-group="${safe(sys.name)}"><div class="group-header"><button class="collapse" data-collapse="${safe(sys.name)}" aria-expanded="${!closed}"><span class="tiny-logo">${logo(sys)}</span><strong>${safe(serverTitle(sys))}</strong><small>${disks.length} Laufwerke</small><span>${closed?'▸':'▾'}</span></button><span class="order-controls"><span class="drag-handle" data-drag-handle="group" data-drag-id="${safe(sys.name)}" title="Speichergruppe ziehen">⠿ Ziehen</span><button data-move="group" data-id="${safe(sys.id)}" data-direction="-1" title="Nach oben" ${idx===0?'disabled':''}>↑</button><button data-move="group" data-id="${safe(sys.id)}" data-direction="1" title="Nach unten" ${idx===s.systems.length-1?'disabled':''}>↓</button></span></div>${closed?'':`<div class="disk-grid">${disks.map(d=>diskCard(d)).join('')}</div>${view==='storage'?`<div class="suborder"><span>Laufwerke anordnen:</span>${disks.map((d,i)=>`<span class="disk-move" data-disk-row="${safe(d.id)}" data-disk-host="${safe(sys.name)}"><span class="drag-handle" data-drag-handle="disk" data-drag-id="${safe(d.id)}" data-host="${safe(sys.name)}" title="Laufwerk ziehen">⠿</span> ${safe(d.id)} <button data-move="disk" data-host="${safe(sys.name)}" data-id="${safe(d.id)}" data-direction="-1" ${i===0?'disabled':''}>↑</button><button data-move="disk" data-host="${safe(sys.name)}" data-id="${safe(d.id)}" data-direction="1" ${i===disks.length-1?'disabled':''}>↓</button></span>`).join('')}</div>`:''}`}</section>`}).join('')}</div>`}
function serverCard(sys,i){const st=metric(sys.id),temp=temperature(st);return `<article class="server card" data-server-drag="${safe(sys.id)}"><div class="serverhead"><div class="servericon">${logo(sys)}</div><span class="state ${sys.status==='up'?'up':'down'}">● ${sys.status==='up'?'Online':safe(sys.status||'Unbekannt')}</span></div><button class="server-open" data-open="${safe(sys.id)}" title="Serverdetails öffnen"><h3>${safe(serverTitle(sys))} <span>↗</span></h3><p class="nickname">${safe(desc[sys.name]||'System')}</p></button><div class="metric"><div><span>CPU</span><b>${n(st.cpu)}%</b></div>${bar(st.cpu)}</div><div class="metric"><div><span>RAM</span><b>${n(st.mp)}%</b></div>${bar(st.mp,true)}</div><div class="serverfooter"><span>♨ ${temp===undefined?'–':n(temp)} °C</span><span>${st.d?diskFmt(st.d,st.d):'Keine Daten'}</span></div><div class="card-actions"><button data-move="server" data-id="${safe(sys.id)}" data-direction="-1" ${i===0?'disabled':''}>↑</button><button data-move="server" data-id="${safe(sys.id)}" data-direction="1" ${i===s.systems.length-1?'disabled':''}>↓</button><button class="service-link" data-service="${safe(sys.id)}" title="Zugehörigen Dienst im Browser öffnen">↗ Dienst öffnen</button><span class="drag-handle" data-drag-handle="server" title="Zum Verschieben ziehen">⠿ Ziehen</span></div></article>`}
function overview(){const systems=servers(),online=systems.filter(x=>x.status==='up').length,extra=allDrives().filter(d=>d.id!=='Systemlaufwerk').length;return `<div class="stats"><div class="summary card"><span>Server gesamt</span><strong>${systems.length}</strong><small>${online} online</small></div><div class="summary card"><span>Zusätzliche Laufwerke</span><strong>${extra}</strong><small>Über Beszel erkannt</small></div><div class="summary card"><span>Status</span><strong>${online===systems.length?'Bereit':'Prüfen'}</strong><small>${systems.length-online} offline</small></div></div><section><div class="section-title"><h2>Deine Server</h2><span>Per Maus ziehen oder Pfeile verwenden</span></div><div class="server-grid">${systems.map(serverCard).join('')}</div></section><section><div class="section-title"><h2>Festplatten nach Server</h2><span>${allDrives().length} Laufwerke</span></div>${diskGroups('overview')}</section>${prefs.extraServices.length?`<section><div class="section-title"><h2>Eigene Webdienste</h2><span>${prefs.extraServices.length} Dienste</span></div><div class="card settings-card"><div class="docker-items">${prefs.extraServices.map(item=>`<div class="docker-item"><div class="docker-item-description">${serviceImages[item.id]?`<img src="${safe(serviceImages[item.id])}" alt="" class="brand-img" style="width:30px;height:30px;float:left;margin-right:8px">`:``}<b>${safe(item.name)}</b><small>${safe(item.url)}</small></div><button class="secondary" data-extra-open="${safe(item.id)}">↗ Öffnen</button></div>`).join('')}</div></div></section>`:``}`}
function chart(data,fn,title,unit='%'){const values=data.map(x=>Number(fn(x))).filter(x=>Number.isFinite(x)),max=unit==='%'?100:Math.max(1,...values)*1.1; if(values.length<2)return `<div class="emptychart">Noch nicht genügend Verlaufsmesswerte.</div>`;const points=values.slice().reverse().map((v,i)=>`${(i/(values.length-1)*100).toFixed(2)},${(100-clamp(v/max*100)).toFixed(2)}`).join(' ');return `<div class="chart card"><div class="chart-title">${safe(title)} <span>${n(values[0])} ${safe(unit)}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${safe(title)} Verlauf"><line x1="0" y1="50" x2="100" y2="50"/><line x1="0" y1="99" x2="100" y2="99"/><polyline points="${points}"/></svg><div class="chart-foot">Letzte ${values.length} Messpunkte · neuester rechts</div></div>`}
function detail(){const sys=s.systems.find(x=>x.id===s.detail);if(!sys)return '<p>Server nicht gefunden.</p>';const st=metric(sys.id),history=s.history[sys.id]||[],temp=temperature(st),interfaces=Object.entries(st.ni||{});return `<section><button class="secondary" id="back">← Zur Übersicht</button><div class="detail-heading"><div class="servericon large">${logo(sys)}</div><div><h2>${safe(serverTitle(sys))}</h2><p>${safe(desc[sys.name]||'System')} · ${sys.status==='up'?'Online':'Status: '+safe(sys.status)}</p><small>Messzeitpunkt: ${displayTime(measureTime(sys.id))}</small><div class="service-actions"><button class="secondary" data-service="${safe(sys.id)}">↗ ${safe({"OctoPi":"OctoPrint öffnen","HAOS Dell":"Home Assistant öffnen","Docker-Pi":"Portainer öffnen","Plex-Pi":"Plex öffnen"}[sys.name]||"Dienst öffnen")}</button></div></div></div><div class="stats detail-stats"><div class="summary card"><span>CPU</span><strong>${n(st.cpu)}%</strong>${bar(st.cpu)}</div><div class="summary card"><span>RAM</span><strong>${n(st.mp)}%</strong>${bar(st.mp,true)}</div><div class="summary card"><span>Temperatur</span><strong>${temp===undefined?'–':n(temp)+' °C'}</strong><small>Aus Beszel</small></div></div><div class="charts">${chart(history,x=>x.stats?.cpu,'CPU-Verlauf')}${chart(history,x=>x.stats?.mp,'RAM-Verlauf')}${chart(history,x=>temperature(x.stats||{}),'Temperatur','°C')}${chart(history,x=>Number(x.stats?.b?.[0]||0)/1024,'Netzwerk gesendet','KB/s')}${chart(history,x=>Number(x.stats?.b?.[1]||0)/1024,'Netzwerk empfangen','KB/s')}</div><h2 class="detail-section">Netzwerkschnittstellen</h2><div class="list-card card">${interfaces.map(([name,values])=>`<div class="list-row"><b>${safe(name)}</b><span>Aktuell: ↑ ${n((values[0]||0)/1024)} KB/s · ↓ ${n((values[1]||0)/1024)} KB/s</span></div>`).join('')||'Keine Netzwerkdaten'}</div><h2 class="detail-section">Laufwerke</h2><div class="disk-grid">${drivesFor(sys).map(diskCard).join('')}</div></section>`}
// Static classifications, but live container names and states always come from Beszel.
const allDockerGroupDefs=()=>[
 ...prefs.customGroups.map(g=>({id:g.id,name:g.name,icon:g.icon||'▣',members:[]})),
 {id:'unassigned',name:'Nicht zugeordnet',icon:'▥',members:[]}
];
const LEGACY_DOCKER_GROUPS={
 nextcloud:{name:'Nextcloud',icon:'☁'},homelab:{name:'HomeLab & Monitoring',icon:'▣'},
 printer:{name:'3D-Druck & Filament',icon:'▤'},cables:{name:'Kabelmanager',icon:'⌁'},
 adguard:{name:'AdGuard Home & Backup',icon:'◇'}
};
function migrateLegacyGroups(){
 if(prefs.dockerGroupsMigrated)return;
 // Only migrate explicitly saved group assignments/order, never seed groups on a clean install.
 const used=new Set([...(prefs.dockerGroupOrder||[]),...Object.values(prefs.containerGroups||{})]);
 let changed=false;
 for(const id of used){
  if(LEGACY_DOCKER_GROUPS[id]&&!prefs.customGroups.some(g=>g.id===id)){
   prefs.customGroups.push({id,...LEGACY_DOCKER_GROUPS[id]});changed=true;
  }
 }
 prefs.dockerGroupsMigrated=true;
 if(changed)save();
}
const HIDDEN_CONTAINERS=new Set(['homelab-dashboard']);
const containerName=c=>String(c.name||c.container_name||c.info?.name||c.id||'Unbekannt');
const containerKey=c=>containerName(c).toLowerCase();
const groupForContainer=c=>{const assigned=prefs.containerGroups[containerKey(c)];return prefs.customGroups.some(g=>g.id===assigned)?assigned:'unassigned'};
const dockerGroups=()=>sorted(allDockerGroupDefs(),prefs.dockerGroupOrder||[],g=>g.id).map(g=>({...g,items:s.containers.filter(c=>!HIDDEN_CONTAINERS.has(containerKey(c))&&groupForContainer(c)===g.id)})).filter(g=>g.items.length);
const hasDockerUrl=id=>Boolean(tryHttpUrl(prefs.dockerUrls[id]||''));
const dockerOpenButton=(id,label='↗ Webseite öffnen')=>hasDockerUrl(id)?`<button class="secondary docker-open" data-docker-url="${safe(id)}">${safe(label)}</button>`:'';
function dockerView(){
 const dk=s.systems.find(x=>x.id===prefs.dockerSystemId) || s.systems.find(x=>s.dockerSystems.includes(x.id));
 const visible=s.containers.filter(c=>!HIDDEN_CONTAINERS.has(containerKey(c)));
 const grouped=dockerGroups();
 return `<section><div class="section-title"><h2>Docker-Dienste</h2><span>${visible.length} Container · ${grouped.length} Gruppen</span></div>
 <p class="muted-text">Live-Status aus Beszel · Zugehörige Container aufklappen und ihre Weboberflächen öffnen. Nur Lesezugriff; Backend-Dienste haben nicht zwingend eine eigene Webseite.</p>
 ${s.containerError?`<div class="alert">${safe(s.containerError)}</div>`:''}${prefs.extraServices.length?`<div class="card settings-card"><h2>Eigene Webdienste</h2><div class="docker-items">${prefs.extraServices.map(item=>`<div class="docker-item"><span class="docker-item-description">${serviceImages[item.id]?`<img class="brand-img" src="${safe(serviceImages[item.id])}" alt="" style="width:28px;height:28px;float:left;margin-right:8px">`:``}<b>${safe(item.name)}</b><small>Manueller Webdienst</small></span><button class="secondary" data-extra-open="${safe(item.id)}">↗ Webseite öffnen</button></div>`).join('')}</div></div>`:''}
 ${!dk?'<p>Docker-Pi wurde nicht gefunden.</p>':`<button id="refresh-docker" class="secondary">↻ Container laden</button>
 <div class="docker-groups">${grouped.map((g,idx)=>{
 const closed=prefs.dockerCollapsed.includes(g.id);
 const order=grouped.map(x=>x.id);
 return `<section class="docker-group card" data-docker-group="${safe(g.id)}"><div class="docker-group-header"><button class="collapse" data-docker-collapse="${safe(g.id)}" aria-expanded="${!closed}"><span class="docker-symbol">${groupImages[g.id]?`<img src="${safe(groupImages[g.id])}" alt="" class="brand-img" style="width:30px;height:30px">`:safe(g.icon)}</span><strong>${safe(g.name)}</strong><small>${g.items.length} Container</small><span>${closed?'▸':'▾'}</span></button>
 <span class="order-controls"><button data-move-docker="${safe(g.id)}" data-direction="-1" title="Gruppe nach oben" ${idx===0?'disabled':''}>↑</button><button data-move-docker="${safe(g.id)}" data-direction="1" title="Gruppe nach unten" ${idx===grouped.length-1?'disabled':''}>↓</button></span></div>
 ${closed?'':`<div class="docker-items">${g.items.map(c=>{
 const name=containerName(c),state=String(c.status||c.state||c.stats?.status||c.info?.status||'Status unbekannt');
 const live=/(up|running|online)/i.test(state);
 return `<div class="docker-item"><div class="docker-item-description"><b>${safe(name)}</b><small>${safe(c.image||c.stats?.image||'')}</small></div><span class="state ${live?'up':''}">● ${safe(state)}</span>${dockerOpenButton(name.toLowerCase())}</div>`
 }).join('')}</div>`}</section>`
 }).join('')||'<div class="card empty">Keine Container vorhanden.</div>'}</div>`}</section>`;
}
function backupSettingsCard(){return `<div class="card settings-card"><h2>Konfiguration & Sicherung</h2><p class="muted-text">Deine persönlichen Einstellungen und Bilder bleiben bei Updates erhalten. Beszel-Adresse und persönliche Einstellungen werden exportiert. Ein normaler Export enthält keine Zugangsdaten; im optionalen verschlüsselten Komplettbackup kann eine Sitzung enthalten sein.</p><div class="settings-actions"><button id="create-backup" class="secondary" ${!native?'disabled':''}>Lokale Sicherung erstellen</button><button id="export-config" class="secondary">Konfiguration exportieren</button><button id="export-encrypted" class="secondary">🔒 Komplettbackup verschlüsselt exportieren</button><label class="secondary" style="cursor:pointer;padding:10px;border-radius:9px">🔓 Komplettbackup importieren<input id="import-encrypted" type="file" accept="application/json,.json" style="display:none"></label><label class="secondary" style="cursor:pointer;padding:10px;border-radius:9px">Konfiguration importieren<input id="import-config" type="file" accept="application/json,.json" style="display:none"></label></div><small>JSON-Export enthält bei Bedarf auch eigene Bilder. Die Datei kann persönliche Webadressen enthalten – niemals öffentlich auf GitHub hochladen!</small></div>`}
async function exportConfig(){
 try{
  const values=storedPreferences(),assets={};
  if(native){for(const kind of ['background','customLogo',...Object.keys(values.serverIcons||{}).map(id=>'server_'+id),...(prefs.extraServices||[]).map(item=>'service_'+item.id),...(prefs.customGroups||[]).map(g=>'group_'+g.id)]){const val=await invoke('load_asset',{kind}).catch(()=>null);if(val)assets[kind]=val;}}
  else {for(const kind of ['background','customLogo'])if(prefs[kind])assets[kind]=prefs[kind];for(const [id,val] of Object.entries(prefs.serverIcons||{}))if(val.startsWith('data:image/'))assets['server_'+id]=val;}
  const payload={format:'homelab-manager-config',schemaVersion:1,exportedAt:new Date().toISOString(),beszelAddress:s.url||prefs.beszelAddress||'',serverIdentities:s.systems.map(x=>({id:x.id,name:x.name})),preferences:values,assets};
  const exported=await saveJsonAs(payload,'homelab-manager-konfiguration.json');
  s.error=exported?'Konfiguration gespeichert: '+exported:'Speichern abgebrochen.';render();
 }catch(err){s.error='Export fehlgeschlagen: '+String(err);render()}
}
async function importConfig(file){
 if(!file)return;
 if(file.size>45_000_000){s.error='Importdatei größer als 45 MB';render();return;}
 if(!confirm('Deine aktuellen Einstellungen werden durch den Import ersetzt. Fortfahren?'))return;
 try{
  const data=JSON.parse(await file.text());
  if(data?.format!=='homelab-manager-config'||data?.schemaVersion!==1||!data.preferences||typeof data.preferences!=='object'||Array.isArray(data.preferences))throw Error('Unbekanntes Sicherungsformat');
  const assets=data.assets||{};
  for(const [kind,value] of Object.entries(assets)){
   if(!(/^(background|customLogo|(?:server|service|group)_[a-zA-Z0-9_-]{1,80})$/.test(kind))||typeof value!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(value))throw Error('Ungültiges Bild in Sicherung');
  }
  if(native){await nativeSaveQueue;await invoke('backup_preferences');for(const [kind,value] of Object.entries(assets))await invoke('save_asset',{kind,dataUrl:value});}
  prefs={...DEFAULT,...data.preferences};prefs.serverNames ||= {};prefs.serverIcons ||= {};prefs.customGroups ||= [];prefs.containerGroups ||= [];prefs.extraServices ||= [];
  prefs.serviceUrls={...DEFAULT.serviceUrls,...(prefs.serviceUrls||{})};prefs.dockerUrls={...SERVICE_DEFAULTS,...(prefs.dockerUrls||{})};
  if(!native){for(const [kind,value] of Object.entries(assets)){if(kind==='background'||kind==='customLogo')prefs[kind]=value;else prefs.serverIcons[kind.slice(7)]=value;}}
  save();if(native)await nativeSaveQueue;
  for(const key of Object.keys(serverImages))delete serverImages[key];
  migrateLegacyGroups();prefs.pendingServerBindings=data.serverIdentities||[];await restoreAddress(data);save();if(native)await nativeSaveQueue;await initAssets();await loadServerIcons();await loadServiceIcons();await loadGroupIcons();s.error='Konfiguration importiert.';render();
 }catch(err){s.error='Import fehlgeschlagen: '+String(err);render()}
}
function settingsView(){return `<section class="settings-layout">${updateSettingsCard()}${backupSettingsCard()}<div class="card settings-card"><h2>Verbindung & Aktualisierung</h2><label>Beszel-Hub<input value="${safe(s.url)}" readonly title="Zum Wechseln abmelden und neu verbinden"></label><p class="muted-text">Die Sitzung wird im System-Anmeldedatenspeicher gesichert. Beim nächsten Start wird sie automatisch wiederhergestellt, solange der Token gültig ist. Abmelden löscht die gespeicherte Sitzung.</p><label>Aktualisierung <select id="interval">${[5,10,15,30,60].map(v=>`<option value="${v}" ${prefs.refreshSeconds===v?'selected':''}>Alle ${v} Sekunden</option>`).join('')}</select></label><small>Die Messwerte werden aktualisiert, sobald Beszel neue Daten bereitstellt. Der Zeitstempel des letzten Messwerts bleibt sichtbar.</small></div><div class="card settings-card"><h2>Darstellung & Design</h2><p class="muted-text">Dunkelblau bleibt Standard. Deine Anpassungen werden lokal auf diesem Gerät gespeichert.</p><label>Logo in der Seitenleiste (PNG, JPG oder WEBP)<input id="logo-upload" type="file" accept="image/png,image/jpeg,image/webp"></label><label>Eigenes Hintergrundbild<input id="background-upload" type="file" accept="image/png,image/jpeg,image/webp"></label><label>Hintergrund abdunkeln: <output id="dim-value">${prefs.dim}%</output><input id="dim" type="range" min="0" max="95" step="5" value="${prefs.dim}"></label><label class="check"><input type="checkbox" id="show-background" ${prefs.showBackground?'checked':''}> Hintergrundbild anzeigen</label><div class="settings-actions"><button id="clear-logo" class="secondary">Standard-Logo</button><button id="clear-background" class="secondary">Hintergrund entfernen</button></div><small>Fotos bis 25 MB (PNG, JPG, WEBP); große Bilder werden für eine flüssige Oberfläche verkleinert. In der Desktop-App werden die Bilder separat im App-Datenordner gespeichert.</small></div><div class="card settings-card"><h2>Server anpassen</h2><p class="muted-text">Jeder erkannte Beszel-Server bekommt einen eigenen Namen, ein Icon und einen Webseitenlink. Änderungen sind nur auf diesem Gerät gespeichert.</p>${s.systems.map(sys=>`<div class="config-item"><b>${safe(sys.name)}</b><label>Anzeigename<input type="text" maxlength="65" data-server-title="${safe(sys.id)}" value="${safe(prefs.serverNames[sys.id]||'')}" placeholder="${safe(sys.name)}"></label><label>Webadresse<input type="url" data-server-url="${safe(sys.id)}" value="${safe(prefs.serviceUrls[sys.id]||prefs.serviceUrls[sys.name]||'')}" placeholder="https://..."></label><label>Eigenes Icon (PNG/JPG/WebP)<input type="file" accept="image/png,image/jpeg,image/webp" data-server-icon="${safe(sys.id)}"></label><button class="secondary" data-remove-icon="${safe(sys.id)}">Icon zurücksetzen</button></div>`).join('')}<button id="save-server-config" class="secondary">Server-Einstellungen speichern</button></div>${s.dockerDetected?`<div class="card settings-card"><h2>Docker individuell organisieren</h2><label>Welcher Server liefert Docker-Daten?<select id="docker-system">${s.systems.filter(sys=>s.dockerSystems.includes(sys.id)).map(sys=>`<option value="${safe(sys.id)}" ${((prefs.dockerSystemId||s.systems[0]?.id)===sys.id)?'selected':''}>${safe(serverTitle(sys))}</option>`).join('')}</select></label><h3>Eigene Gruppen</h3>${prefs.customGroups.map(g=>`<div class="config-item"><input data-rename-group="${safe(g.id)}" value="${safe(g.name)}" maxlength="60" aria-label="Gruppenname ändern"><label>Eigenes Gruppen-Icon<input data-group-icon="${safe(g.id)}" type="file" accept="image/png,image/jpeg,image/webp"></label> <button class="secondary" data-delete-group="${safe(g.id)}">Entfernen</button></div>`).join('')}<form id="create-docker-group"><label>Gruppenname<input id="new-group-name" required maxlength="60" placeholder="Zum Beispiel: Medien"></label><label>Gruppensymbol (Emoji)<input id="new-group-symbol" maxlength="5" placeholder="📦"></label><label>Eigenes Icon (optional)<input id="new-group-icon" type="file" accept="image/png,image/jpeg,image/webp"></label><button class="secondary" type="submit">Gruppe hinzufügen</button></form><button id="save-group-names" class="secondary">Gruppennamen speichern</button><h3>Container zuordnen</h3>${s.containers.map(c=>`<label>${safe(containerName(c))}<select data-container-group="${safe(containerKey(c))}">${allDockerGroupDefs().map(g=>`<option value="${safe(g.id)}" ${groupForContainer(c)===g.id?'selected':''}>${safe(g.name)}</option>`).join('')}</select></label>`).join('')||'<p class="muted-text">Öffne zuerst die Docker-Ansicht, um Container zu laden.</p>'}<button id="save-container-groups" class="secondary">Zuordnung speichern</button></div><div class="card settings-card"><h2>Docker-Webadressen</h2><p class="muted-text">Für jeden erkannten Container kannst du einen Link hinterlegen.</p>${s.containers.filter(c=>!HIDDEN_CONTAINERS.has(containerKey(c))).map(c=>`<label>${safe(containerName(c))}<input type="url" data-docker-url-input="${safe(containerName(c))}" value="${safe(prefs.dockerUrls[containerName(c)]||'')}" placeholder="https://..."></label>`).join('')}<button id="save-docker-urls" class="secondary">Adressen speichern</button></div>`:``}<div class="card settings-card"><h2>Eigene Webdienste</h2><p class="muted-text">Für Webtools, die Beszel nicht als Container erkennt. Ohne Backend oder zusätzliche Rechte.</p>${prefs.extraServices.map(item=>`<div class="config-item"><b>${safe(item.name)}</b><p>${safe(item.url)}</p><label>Eigenes Icon<input type="file" accept="image/png,image/jpeg,image/webp" data-extra-icon="${safe(item.id)}"></label><button class="secondary" data-remove-extra="${safe(item.id)}">Entfernen</button></div>`).join('')}<form id="add-extra-service"><label>Name<input id="extra-service-name" maxlength="70" required placeholder="Zum Beispiel Jellyfin"></label><label>Adresse<input id="extra-service-url" type="url" required placeholder="https://..."></label><label>Eigenes Icon (optional)<input id="extra-service-icon" type="file" accept="image/png,image/jpeg,image/webp"></label><button class="secondary" type="submit">Dienst hinzufügen</button></form></div><div class="card settings-card"><h2>Reihenfolgen</h2><p class="muted-text">Server und Speichergruppen lassen sich mit den Pfeilen oder per Ziehen sortieren; innerhalb der Speicheransicht kannst du außerdem jedes Laufwerk sortieren.</p><button id="reset-order" class="secondary">Sortierungen zurücksetzen</button></div></section>`}
function loginView(){return `<section class="login card"><h2>Mit Beszel verbinden</h2>${legacyPrefsCandidate?`<div class="alert"><b>Ältere HomeLab-Einstellungen gefunden.</b><p>Die neue Einrichtung startet ohne Beszel-Adresse. Du kannst deine bisherige Konfiguration einmalig übernehmen oder bewusst neu beginnen.</p><div class="settings-actions"><button id="migrate-legacy" class="primary">Bisherige Einstellungen übernehmen</button><button id="ignore-legacy" class="secondary">Neu einrichten</button></div></div>`:''}<p>Auf Desktop-Geräten wird nur der Sitzungstoken geschützt im Betriebssystem gespeichert. Passwörter werden nicht gespeichert.</p><form id="login-form"><label>Beszel-Adresse<input id="url" type="url" value="${safe(s.url||prefs.beszelAddress||'')}" required></label><label>E-Mail<input id="email" type="email" autocomplete="username" required></label><label>Passwort<input id="password" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">Verbinden</button></form><div class="security">HTTP nur im vertrauenswürdigen Heimnetz; extern ausschließlich mit VPN oder HTTPS.</div></section>`}
// Preserve unsaved edits across all automatic refreshes of the settings page.
// Values stay in memory until the user explicitly saves or leaves settings.
const settingsDraft = new Map();
let settingsRendered = false;
let settingsFocusedDraft = null;
const settingDraftSelector = '.settings-layout input:not([type="file"]), .settings-layout select, .settings-layout textarea';
function draftKey(el){
  // Dynamic controls need a stable key rather than their DOM index.
  const names=['serverTitle','serverUrl','renameGroup','containerGroup','dockerUrlInput','serviceUrl'];
  for(const name of names)if(el.dataset[name]!==undefined)return name+':'+el.dataset[name];
  return el.id ? 'id:'+el.id : null;
}
function captureSettingsDraft(){
  if(!settingsRendered)return;
  const focused=document.activeElement;
  const focusKey=focused?.matches?.(settingDraftSelector)?draftKey(focused):null;
  const canSelect=focused&&(focused.tagName==='TEXTAREA'||focused.tagName==='INPUT'&&['text','url','email','search','tel','password'].includes(focused.type));
  settingsFocusedDraft=focusKey?{key:focusKey,start:canSelect?focused.selectionStart:null,end:canSelect?focused.selectionEnd:null}:null;
  document.querySelectorAll(settingDraftSelector).forEach(el=>{
    const key=draftKey(el);if(!key)return;
    settingsDraft.set(key,el.type==='checkbox'||el.type==='radio'?el.checked:el.value);
  });
}
function restoreSettingsDraft(){
  document.querySelectorAll(settingDraftSelector).forEach(el=>{
    const key=draftKey(el);
    if(!key)return;
    if(settingsDraft.has(key)){
      const value=settingsDraft.get(key);
      if(el.type==='checkbox'||el.type==='radio')el.checked=!!value;
      else if(el.tagName!=='SELECT'||Array.from(el.options).some(o=>o.value===value))el.value=value;
    }
    if(settingsFocusedDraft?.key===key){
      el.focus({preventScroll:true});
      if(settingsFocusedDraft.start!==null&&typeof el.setSelectionRange==='function'){
        try{el.setSelectionRange(settingsFocusedDraft.start,settingsFocusedDraft.end)}catch{}
      }
    }
  });
  settingsFocusedDraft=null;
}
function clearSettingsDraft(prefix){for(const key of settingsDraft.keys())if(key.startsWith(prefix))settingsDraft.delete(key)}
function render(){captureSettingsDraft();if(s.page!=='settings'||!s.connected)settingsDraft.clear();settingsRendered=s.page==='settings'&&s.connected;const pageTitle={overview:'Serverübersicht',storage:'Speicherübersicht',docker:'Docker-Übersicht',settings:'Einstellungen',detail:'Serverdetails'}[s.page]||'HomeLab';const background=prefs.background&&prefs.showBackground?`<div class="wallpaper" style="background-image:linear-gradient(rgba(6,12,25,${prefs.dim/100}),rgba(6,12,25,${prefs.dim/100})),url('${prefs.background}')"></div>`:'';app.innerHTML=`${background}<div class="shell"><aside class="sidebar"><div class="brand"><div class="brandmark">${prefs.customLogo?`<img src="${prefs.customLogo}" alt="Eigenes HomeLab-Logo">`:'H'}</div><div><b>HomeLab</b><small>MANAGER <span>0.3.0</span></small></div></div><nav aria-label="Navigation">${[['overview','▦','Übersicht'],['storage','▤','Speicher'],...(s.dockerDetected?[['docker','▣','Docker']]:[]),['settings','⚙','Einstellungen']].map(([id,ico,name])=>`<button class="navitem ${s.page===id||(s.page==='detail'&&id==='overview')?'selected':''}" data-nav="${id}">${ico} <span>${name}</span></button>`).join('')}</nav><div class="sidebarfoot"><span class="signal ${s.connected?'ok':''}"></span>${s.connected?'Beszel verbunden':'Nicht verbunden'}<small>${safe(s.url)}</small></div></aside><main><header><div><div class="eyebrow">DEIN PRIVATES HOMELAB</div><h1>${pageTitle}</h1><p>${s.page==='overview'?'Alle deine Systeme an einem Ort – direkt aus Beszel.':s.page==='storage'?'Jedes Laufwerk sauber nach Server kategorisiert.':s.page==='docker'?'Containerdaten direkt aus Beszel.':s.page==='settings'?'Personalisiere deinen HomeLab Manager.':'Detaillierte Messwerte und Diagramme.'}</p></div><div class="header-actions"><span class="updated">${s.updated?'Abfrage '+displayTime(s.updated):'Noch keine Abfrage'}</span><button id="refresh" class="secondary" ${!s.connected||s.busy?'disabled':''}>↻ Aktualisieren</button><button id="logout" class="secondary" ${!s.connected?'disabled':''}>Abmelden</button></div></header>${s.error?`<div class="alert" role="alert">${safe(s.error)}</div>`:''}${!s.connected?loginView():s.page==='overview'?overview():s.page==='storage'?`<div class="section-title"><h2>Deine Festplatten</h2><span>${allDrives().length} Laufwerke</span></div>${diskGroups('storage')}`:s.page==='docker'?dockerView():s.page==='settings'?settingsView():detail()}<footer>HomeLab Manager 0.3.0 · Automatische Abfrage alle ${prefs.refreshSeconds}s · Beszel bleibt Datenquelle · Nur Lesezugriff</footer></main></div>`;if(settingsRendered)restoreSettingsDraft();wire()}
function reorder(list,key,direction){let a=list.slice();let i=a.indexOf(key);if(i<0||i+direction<0||i+direction>=a.length)return a;[a[i],a[i+direction]]=[a[i+direction],a[i]];return a}
async function showDetail(id){s.detail=id;s.page='detail';render();try{const res=await records('system_stats',id,90);s.history[id]=res.items||[]}catch(err){s.error='Verlauf nicht geladen: '+String(err.message||err)}render()}
async function detectDocker(){
 if(!s.connected||!s.systems.length)return;
 if(Date.now()-s.dockerLastScan<60000)return;
 s.dockerLastScan=Date.now();
 const result=await Promise.allSettled(s.systems.map(async sys=>({id:sys.id,data:native?await invoke('beszel_containers',{systemId:sys.id}):await browserContainers(sys.id)})));
 const detected=[];
 for(const outcome of result){
  if(outcome.status==='fulfilled' && (outcome.value.data.items||[]).length)detected.push(outcome.value.id);
 }
 if(detected.length){
  s.dockerSystems=detected;
  s.dockerDetected=true;
  if(!detected.includes(prefs.dockerSystemId))prefs.dockerSystemId=detected[0];
  await loadContainers(false);
 }else if(result.every(v=>v.status==='fulfilled')){
  s.dockerSystems=[];s.dockerDetected=false;s.containers=[];
  if(s.page==='docker')s.page='overview';
 }
 // On connection/API errors, retain the last known Docker state.
 render();
}
async function loadContainers(shouldRender=true){
 const sys=s.systems.find(x=>x.id===prefs.dockerSystemId) || s.systems.find(x=>s.dockerSystems.includes(x.id));if(!sys)return;
 s.containerError='';
 try{
  const result=native?await invoke('beszel_containers',{systemId:sys.id}):await browserContainers(sys.id);
  s.containers=(result.items||[]).map(x=>x);
  if(!s.containers.length)s.containerError='Beszel liefert aktuell keine Container für diesen Server.';
 }catch(err){s.containerError='Containerabfrage fehlgeschlagen: '+String(err.message||err)}
 if(shouldRender)render();
}
async function browserContainers(id){
 const get=async(path)=>api(path);
 try{const a=await get('/api/collections/containers/records?perPage=200');return {items:(a.items||[]).filter(c=>c.system===id||c.system?.id===id)} }
 catch(first){
  const q=new URLSearchParams({filter:`system = "${id}"`,sort:'-created',perPage:'1'});
  try{const b=await get('/api/collections/container_stats/records?'+q);return {items:flattenContainerStats(b.items||[])} }
  catch(second){throw Error('Container-Collection: '+first.message+'; Statistik-Fallback: '+second.message)}
 }
}
function flattenContainerStats(items){const last=items[0];return Array.isArray(last?.stats)?last.stats:[]}
async function loadServerIcons(){for(const sys of s.systems){if(!prefs.serverIcons[sys.id])continue;try{const data=native?await invoke('load_asset',{kind:'server_'+sys.id}):prefs.serverIcons[sys.id];if(data)serverImages[sys.id]=data}catch(e){console.warn('Server-Icon konnte nicht geladen werden:',e)}}}
async function uploadGroupIcon(input,id){
 const file=input.files?.[0];if(!file)return;
 if(file.size>25_000_000||!['image/png','image/jpeg','image/webp'].includes(file.type)){s.error='Bitte PNG/JPG/WebP bis 25 MB wählen';render();return}
 try{const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const f=Math.min(1,256/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*f));canvas.height=Math.max(1,Math.round(bitmap.height*f));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();const data=canvas.toDataURL('image/png');if(native)await invoke('save_asset',{kind:'group_'+id,dataUrl:data});groupImages[id]=data;const group=prefs.customGroups.find(g=>g.id===id);if(group&&!native)group.iconImage=data;save();render()}catch(err){s.error='Gruppen-Icon: '+String(err);render()}
}
async function uploadExtraIcon(input,id){
 const file=input.files?.[0];if(!file)return;
 if(file.size>25_000_000||!['image/png','image/jpeg','image/webp'].includes(file.type)){s.error='Bitte PNG/JPG/WebP bis 25 MB wählen';render();return}
 try{const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const f=Math.min(1,256/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*f));canvas.height=Math.max(1,Math.round(bitmap.height*f));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();const data=canvas.toDataURL('image/png');if(native)await invoke('save_asset',{kind:'service_'+id,dataUrl:data});serviceImages[id]=data;save();render()}catch(err){s.error='Dienst-Icon: '+String(err);render()}
}
const groupImages={};
const serviceImages={};
async function loadGroupIcons(){for(const item of prefs.customGroups){const data=native?await invoke('load_asset',{kind:'group_'+item.id}).catch(()=>null):item.iconImage;if(data)groupImages[item.id]=data}}
async function loadServiceIcons(){for(const item of prefs.extraServices){const data=native?await invoke('load_asset',{kind:'service_'+item.id}).catch(()=>null):item.icon;if(data)serviceImages[item.id]=data}}
async function uploadServerIcon(input){const file=input.files?.[0],id=input.dataset.serverIcon;if(!file||!id)return;if(file.size>25_000_000){s.error='Icon über 25 MB';render();return}if(!['image/png','image/jpeg','image/webp'].includes(file.type)){s.error='Bitte PNG, JPG oder WebP wählen';render();return}try{const img=await createImageBitmap(file),canvas=document.createElement('canvas');const scale=Math.min(1,256/Math.max(img.width,img.height));canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);img.close?.();const data=canvas.toDataURL('image/png');if(native)await invoke('save_asset',{kind:'server_'+id,dataUrl:data});serverImages[id]=data;prefs.serverIcons[id]=native?'saved':data;if(!save())throw Error('Speicher voll');render()}catch(e){s.error='Icon-Upload fehlgeschlagen: '+String(e);render()}}
const assetKeys=['customLogo','background'];
async function initAssets(){
 if(!native)return;
 for(const key of assetKeys){
  try{
   if(typeof prefs[key]==='string'&&prefs[key].startsWith('data:image/')){
    await invoke('save_asset',{kind:key,dataUrl:prefs[key]});prefs[key]='';save();
   }
   const asset=await invoke('load_asset',{kind:key});if(asset)prefs[key]=asset;
  }catch(e){console.warn('Asset konnte nicht geladen werden',key,e)}
 }
 render();
}
async function fileUpload(input,key){
 const file=input.files?.[0];if(!file)return;
 if(file.size>25_000_000){s.error='Maximal 25 MB pro Bild. Größere Fotos bitte vorher verkleinern.';render();return}
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)){s.error='Nur PNG, JPG oder WEBP erlaubt.';render();return}
 try{
  // Decode and resize photos for reasonable GPU memory consumption.
  const bitmap=await createImageBitmap(file);
  const max=key==='background'?3200:700;
  const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  const data=canvas.toDataURL(key==='background'?'image/jpeg':'image/png',0.9);
  if(native){await invoke('save_asset',{kind:key,dataUrl:data});prefs[key]=data;save()}
  else {const old=prefs[key];prefs[key]=data;if(!save()){prefs[key]=old;throw Error('Browserspeicher voll. Bitte die Desktop-App verwenden.')}}
  s.error='';render();
 }catch(err){s.error='Bild konnte nicht übernommen werden: '+String(err.message||err);render()}
}
async function clearAsset(key){
 if(native){try{await invoke('delete_asset',{kind:key})}catch(err){s.error=String(err);render();return}}
 prefs[key]='';save();render();
}
function wire(){document.querySelector('#migrate-legacy')?.addEventListener('click',()=>migrateLegacyPreferences().catch(err=>{s.error='Übernahme fehlgeschlagen: '+String(err);render()}));document.querySelector('#ignore-legacy')?.addEventListener('click',()=>startWithBlankPreferences().catch(err=>{s.error='Neue Einrichtung fehlgeschlagen: '+String(err);render()}));document.querySelector('#login-form')?.addEventListener('submit',async e=>{e.preventDefault();if(legacyPrefsCandidate){s.error='Bitte zuerst entscheiden: bisherige Einstellungen übernehmen oder neu einrichten.';render();return;}const u=document.querySelector('#url').value.trim().replace(/\/+$/,'');const email=document.querySelector('#email').value,password=document.querySelector('#password').value;s.busy=true;s.error='';render();try{await login(u,email,password);s.url=u;prefs.beszelAddress=u;save();s.connected=true;s.busy=false;await refresh(false)}catch(err){s.connected=false;s.error='Anmeldung fehlgeschlagen: '+String(err.message||err)}finally{s.busy=false;render()}});
 document.querySelector('#refresh')?.addEventListener('click',()=>refresh());document.querySelector('#logout')?.addEventListener('click',async()=>{if(native)await invoke('beszel_logout').catch(()=>{});s.token='';s.connected=false;s.systems=[];s.metrics={};s.history={};s.containers=[];s.detail=null;s.page='overview';s.error='';render()});
 document.querySelectorAll('[data-nav]').forEach(e=>e.addEventListener('click',()=>{s.page=e.dataset.nav;s.error='';render();if(s.page==='docker')loadContainers()}));document.querySelectorAll('[data-open]').forEach(e=>e.addEventListener('click',()=>showDetail(e.dataset.open)));document.querySelector('#back')?.addEventListener('click',()=>{s.page='overview';render()});document.querySelector('#refresh-docker')?.addEventListener('click',loadContainers);
 document.querySelectorAll('[data-collapse]').forEach(e=>e.addEventListener('click',()=>{const k=e.dataset.collapse;prefs.collapsed=prefs.collapsed.includes(k)?prefs.collapsed.filter(x=>x!==k):[...prefs.collapsed,k];save();render()}));
 document.querySelectorAll('[data-move]').forEach(e=>e.addEventListener('click',()=>{const key=e.dataset.id,dir=Number(e.dataset.direction),type=e.dataset.move;if(type==='server'){prefs.serverOrder=reorder(servers().map(x=>x.id),key,dir)}else if(type==='group'){prefs.diskGroups=reorder(groupServers().map(x=>x.name),key,dir)}else {const host=e.dataset.host,sys=s.systems.find(x=>x.name===host);prefs.diskOrder[host]=reorder(drivesFor(sys).map(x=>x.id),key,dir)}save();render()}));
 // Pointer based sorting works in Windows WebView2 and on touch displays.
 document.querySelectorAll('[data-drag-handle]').forEach(handle=>{
  handle.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;
   e.preventDefault();e.stopPropagation();
   const type=handle.dataset.dragHandle,from=type==='server'?handle.closest('[data-server-drag]')?.dataset.serverDrag:handle.dataset.dragId;
   const host=handle.dataset.host;
   if(!from)return;
   handle.setPointerCapture(e.pointerId);handle.classList.add('dragging');
   const onRelease=event=>{
    handle.classList.remove('dragging');handle.removeEventListener('pointerup',onRelease);
    handle.removeEventListener('pointercancel',onCancel);
    const target=document.elementFromPoint(event.clientX,event.clientY);
    const dest=type==='server'?target?.closest('[data-server-drag]')?.dataset.serverDrag:type==='group'?target?.closest('[data-group]')?.dataset.group:target?.closest('[data-disk-row]')?.dataset.diskRow;
    const sameHost=type!=='disk'||target?.closest('[data-disk-host]')?.dataset.diskHost===host;
    if(!dest||dest===from||!sameHost)return;
    const keys=type==='server'?servers().map(x=>x.id):type==='group'?groupServers().map(x=>x.name):drivesFor(s.systems.find(x=>x.name===host)).map(x=>x.id);
    const i=keys.indexOf(from),j=keys.indexOf(dest);if(i<0||j<0)return;
    keys.splice(i,1);keys.splice(j,0,from);
    if(type==='server')prefs.serverOrder=keys;else if(type==='group')prefs.diskGroups=keys;else prefs.diskOrder[host]=keys;
    save();render();
   };
   const onCancel=()=>{handle.classList.remove('dragging');handle.removeEventListener('pointerup',onRelease);handle.removeEventListener('pointercancel',onCancel)};
   handle.addEventListener('pointerup',onRelease);handle.addEventListener('pointercancel',onCancel);
  });
 });
 document.querySelectorAll('[data-docker-collapse]').forEach(el=>el.addEventListener('click',()=>{const id=el.dataset.dockerCollapse;prefs.dockerCollapsed=prefs.dockerCollapsed.includes(id)?prefs.dockerCollapsed.filter(x=>x!==id):[...prefs.dockerCollapsed,id];save();render()}));
 document.querySelectorAll('[data-move-docker]').forEach(el=>el.addEventListener('click',()=>{const keys=dockerGroups().map(g=>g.id),changed=reorder(keys,el.dataset.moveDocker,Number(el.dataset.direction));prefs.dockerGroupOrder=[...changed,...allDockerGroupDefs().map(g=>g.id).filter(id=>!changed.includes(id))];save();render()}));
 document.querySelectorAll('[data-docker-url]').forEach(el=>el.addEventListener('click',()=>openDockerService(el.dataset.dockerUrl)));
 document.querySelector('#save-docker-urls')?.addEventListener('click',()=>{const next={...prefs.dockerUrls};for(const el of document.querySelectorAll('[data-docker-url-input]')){const value=el.value.trim();if(value&&!tryHttpUrl(value)){s.error='Ungültige Docker-Webadresse bei '+el.dataset.dockerUrlInput;render();return}next[el.dataset.dockerUrlInput]=value}prefs.dockerUrls=next;save();clearSettingsDraft('dockerUrlInput:');s.error='';render()});
 document.querySelector('#save-server-config')?.addEventListener('click',()=>{const names={...prefs.serverNames},urls={...prefs.serviceUrls};for(const el of document.querySelectorAll('[data-server-title]'))names[el.dataset.serverTitle]=el.value.trim();for(const el of document.querySelectorAll('[data-server-url]')){const v=el.value.trim();if(v&&!tryHttpUrl(v)){s.error='Ungültige Adresse: '+el.dataset.serverUrl;render();return}urls[el.dataset.serverUrl]=v}prefs.serverNames=names;prefs.serviceUrls=urls;save();clearSettingsDraft('serverTitle:');clearSettingsDraft('serverUrl:');s.error='';render()});
 document.querySelectorAll('[data-server-icon]').forEach(el=>el.addEventListener('change',()=>uploadServerIcon(el)));
 document.querySelectorAll('[data-remove-icon]').forEach(el=>el.addEventListener('click',async()=>{const id=el.dataset.removeIcon;delete serverImages[id];delete prefs.serverIcons[id];if(native)await invoke('delete_asset',{kind:'server_'+id}).catch(()=>{});save();render()}));
 document.querySelector('#docker-system')?.addEventListener('change',el=>{prefs.dockerSystemId=el.target.value;save();s.containers=[];render();loadContainers()});
 document.querySelector('#create-docker-group')?.addEventListener('submit',e=>{e.preventDefault();const name=document.querySelector('#new-group-name').value.trim(),icon=document.querySelector('#new-group-symbol').value.trim()||'▣';if(!name)return;const id='custom_'+Date.now().toString(36);prefs.customGroups.push({id,name,icon});save();document.querySelector('#new-group-name').value='';document.querySelector('#new-group-symbol').value='';clearSettingsDraft('id:new-group-');const img=document.querySelector('#new-group-icon');if(img?.files?.[0])uploadGroupIcon(img,id);else render()});
 document.querySelectorAll('[data-group-icon]').forEach(el=>el.addEventListener('change',()=>uploadGroupIcon(el,el.dataset.groupIcon)));
 document.querySelector('#save-group-names')?.addEventListener('click',()=>{for(const el of document.querySelectorAll('[data-rename-group]')){const group=prefs.customGroups.find(g=>g.id===el.dataset.renameGroup);if(group&&el.value.trim())group.name=el.value.trim()}save();clearSettingsDraft('renameGroup:');render()});
 document.querySelectorAll('[data-delete-group]').forEach(el=>el.addEventListener('click',()=>{const id=el.dataset.deleteGroup;if(native)invoke('delete_asset',{kind:'group_'+id}).catch(()=>{});delete groupImages[id];prefs.customGroups=prefs.customGroups.filter(g=>g.id!==id);Object.keys(prefs.containerGroups).forEach(k=>{if(prefs.containerGroups[k]===id)delete prefs.containerGroups[k]});save();render()}));
 document.querySelector('#save-container-groups')?.addEventListener('click',()=>{document.querySelectorAll('[data-container-group]').forEach(el=>prefs.containerGroups[el.dataset.containerGroup]=el.value);save();clearSettingsDraft('containerGroup:');render()});
 document.querySelector('#add-extra-service')?.addEventListener('submit',e=>{e.preventDefault();const name=document.querySelector('#extra-service-name').value.trim(),url=document.querySelector('#extra-service-url').value.trim();if(!tryHttpUrl(url)){s.error='Ungültige Webadresse';render();return}const id='service_'+Date.now().toString(36);prefs.extraServices.push({id,name,url});save();const icon=document.querySelector('#extra-service-icon');if(icon?.files?.[0])uploadExtraIcon(icon,id);else render()});
 document.querySelectorAll('[data-extra-icon]').forEach(el=>el.addEventListener('change',()=>uploadExtraIcon(el,el.dataset.extraIcon)));
 document.querySelectorAll('[data-remove-extra]').forEach(el=>el.addEventListener('click',()=>{prefs.extraServices=prefs.extraServices.filter(x=>x.id!==el.dataset.removeExtra);if(native)invoke('delete_asset',{kind:'service_'+el.dataset.removeExtra}).catch(()=>{});save();render()}));
 document.querySelectorAll('[data-extra-open]').forEach(el=>el.addEventListener('click',async()=>{const item=prefs.extraServices.find(x=>x.id===el.dataset.extraOpen);if(item){if(native)await openUrl(item.url);else window.open(item.url,'_blank','noopener,noreferrer')}}));
 document.querySelectorAll('[data-service]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openService(b.dataset.service)}));
 document.querySelector('#interval')?.addEventListener('change',e=>{prefs.refreshSeconds=Number(e.target.value);save();render()});document.querySelector('#logo-upload')?.addEventListener('change',e=>fileUpload(e.target,'customLogo'));document.querySelector('#background-upload')?.addEventListener('change',e=>fileUpload(e.target,'background'));document.querySelector('#dim')?.addEventListener('input',e=>{prefs.dim=Number(e.target.value);save();document.querySelector('#dim-value').textContent=`${prefs.dim}%`;const bg=document.querySelector('.wallpaper');if(bg)bg.style.backgroundImage=`linear-gradient(rgba(6,12,25,${prefs.dim/100}),rgba(6,12,25,${prefs.dim/100})),url('${prefs.background}')`});document.querySelector('#show-background')?.addEventListener('change',e=>{prefs.showBackground=e.target.checked;save();render()});document.querySelector('#clear-logo')?.addEventListener('click',()=>clearAsset('customLogo'));document.querySelector('#clear-background')?.addEventListener('click',()=>clearAsset('background'));document.querySelector('#save-service-urls')?.addEventListener('click',()=>{document.querySelectorAll('[data-service-url]').forEach(el=>{const v=el.value.trim();if(v)prefs.serviceUrls[el.dataset.serviceUrl]=v});save();s.error='';render()});document.querySelector('#reset-order')?.addEventListener('click',()=>{prefs.serverOrder=[];prefs.diskGroups=[];prefs.diskOrder={};save();render()});document.querySelector('#create-backup')?.addEventListener('click',async()=>{try{await nativeSaveQueue;const folder=await chooseFolder({directory:true,multiple:false,title:'Speicherort für lokale Sicherung auswählen'});if(!folder)return;const path=await invoke('backup_preferences_to',{destination:folder});s.error='Sicherung erstellt: '+path;render()}catch(err){s.error='Sicherung fehlgeschlagen: '+String(err);render()}});document.querySelector('#export-config')?.addEventListener('click',exportConfig);document.querySelector('#import-config')?.addEventListener('change',e=>importConfig(e.target.files?.[0]));document.querySelector('#export-encrypted')?.addEventListener('click',exportEncrypted);document.querySelector('#import-encrypted')?.addEventListener('change',e=>importEncrypted(e.target.files?.[0]));document.querySelector('#check-updates')?.addEventListener('click',()=>checkForAppUpdates());document.querySelector('#install-update')?.addEventListener('click',installAppUpdate)}
function promptServerRebindings(){
 const candidates=prefs.pendingServerBindings;
 if(!Array.isArray(candidates)||!candidates.length||!s.systems.length)return;
 const known=new Set(s.systems.map(x=>x.id));
 const missing=candidates.filter(o=>o?.id&&o?.name&&!known.has(o.id));
 if(!missing.length){prefs.pendingServerBindings=[];save();return}
 if(!confirm('Die Sicherung enthält Server-IDs, die dieser Beszel-Hub nicht kennt. Möchtest du jetzt Server manuell zuordnen?'))return;
 for(const old of missing){
  const choices=s.systems.map(x=>`${x.name} [${x.id}]`).join('\n');
  const id=prompt(`Alten Server „${old.name}“ zuordnen? Neue Server-IDs:\n${choices}\n\nID eingeben (leer = überspringen):`,'')?.trim();
  if(!id||!known.has(id)||id===old.id)continue;
  const fields=['serverNames','serverIcons','serviceUrls'];
  for(const field of fields){if(Object.hasOwn(prefs[field]||{},old.id)){prefs[field][id]=prefs[field][old.id];delete prefs[field][old.id]}}
  prefs.serverOrder=(prefs.serverOrder||[]).map(v=>v===old.id?id:v);
  prefs.diskGroups=(prefs.diskGroups||[]).map(v=>v===old.id?id:v);
  const oldSys=candidates.find(x=>x.id===old.id)?.name;
  const newSys=s.systems.find(x=>x.id===id)?.name;
  if(oldSys&&newSys){
   if(prefs.diskOrder?.[oldSys])prefs.diskOrder[newSys]=prefs.diskOrder[oldSys];
  }
  if(native&&prefs.serverIcons?.[id]){
   // Assets are stored under previous ID; copy via allowed commands.
   invoke('load_asset',{kind:'server_'+old.id}).then(data=>data&&invoke('save_asset',{kind:'server_'+id,dataUrl:data})).catch(()=>{});
  }
 }
 prefs.pendingServerBindings=[];save();
}
async function refresh(showLoading=true){if(!s.connected||s.busy)return;s.busy=true;if(showLoading)document.querySelector('#refresh')?.setAttribute('disabled','');try{const res=await snapshot();s.systems=res.systems;s.metrics=res.metrics;promptServerRebindings();await loadServerIcons();s.updated=new Date();detectDocker().catch(err=>console.warn('Docker-Erkennung:',err));s.error='';if(s.page==='detail'&&s.detail){try{const h=await records('system_stats',s.detail,90);s.history[s.detail]=h.items||[]}catch{}}}catch(err){s.error='Daten konnten nicht geladen werden: '+String(err.message||err)}finally{s.busy=false;render()}}
render();initializePreferences().then(()=>resumeSavedSession());setInterval(()=>{if(s.connected&&!s.busy&&(!s.lastFetch||Date.now()-s.lastFetch>=prefs.refreshSeconds*1000)){s.lastFetch=Date.now();refresh(false)}},1000);

// Check once on startup in an installed release; never install without a click.
if (releaseBuild) {
  getVersion().then(v=>{updaterState.version=v;render()}).catch(()=>{});
  setTimeout(()=>checkForAppUpdates({silent:true}), 3500);
}
