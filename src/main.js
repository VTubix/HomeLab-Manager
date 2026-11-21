import './style.css';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
const app = document.querySelector('#app');
const releaseBuild = Boolean(window.__TAURI_INTERNALS__) && !import.meta.env.DEV;
const updaterState = { version: '0.2.3', status: '', available: null, busy: false, progress: null, checked: false };
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
const DEFAULT = {refreshSeconds:10,background:'',customLogo:'',dim:72,serverOrder:[],diskGroups:[],diskOrder:{},collapsed:[],dockerCollapsed:[],dockerGroupOrder:[],showBackground:true,serviceUrls:{'OctoPi':'','HAOS Dell':'','Docker-Pi':'','Plex-Pi':'https://app.plex.tv/desktop/'}};
const loadPrefs=()=>{try{return {...DEFAULT,...JSON.parse(localStorage.getItem('homelab.v02.preferences')||'{}')}}catch{return {...DEFAULT}}};
let prefs=loadPrefs();
prefs.serviceUrls={...DEFAULT.serviceUrls,...(prefs.serviceUrls||{})};
// No private network addresses are shipped with the public source.
const SERVICE_DEFAULTS={};
prefs.dockerUrls={...SERVICE_DEFAULTS,...(prefs.dockerUrls||{})};

// Legacy v0.2 base64 assets are migrated to app data on start.
const tryHttpUrl=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}};
async function openService(name){const url=tryHttpUrl(prefs.serviceUrls[name]);if(!url){s.error='Bitte zuerst eine gültige Dienst-Adresse in den Einstellungen hinterlegen.';render();return}try{if(native)await openUrl(url);else window.open(url,'_blank','noopener,noreferrer')}catch(e){s.error='Dienst konnte nicht geöffnet werden: '+String(e);render()}}
async function openDockerService(id){const url=tryHttpUrl(prefs.dockerUrls[id]||'');if(!url){s.error='Für diesen Dienst ist noch keine Webadresse hinterlegt. Unter Einstellungen → Docker-Webadressen kannst du sie eintragen.';render();return}try{if(native)await openUrl(url);else window.open(url,'_blank','noopener,noreferrer')}catch(e){s.error='Webseite konnte nicht geöffnet werden: '+String(e);render()}}
const save=()=>{try{const stored={...prefs};if(native){stored.background='';stored.customLogo=''}localStorage.setItem('homelab.v02.preferences',JSON.stringify(stored));return true}catch{return false}};
let s={url:'',token:'',connected:false,busy:false,systems:[],metrics:{},updated:null,error:'',page:'overview',detail:null,history:{},containers:[],containerError:'',lastFetch:null};
const desc={'OctoPi':'3D-Drucker','HAOS Dell':'Home Assistant','Docker-Pi':'Docker / Nextcloud','Plex-Pi':'Plex Media'};
// These URL images are the original GitHub organisation avatars (not recreated artwork).
const brands={'OctoPi':'https://github.com/OctoPrint.png','HAOS Dell':'https://github.com/home-assistant.png','Docker-Pi':'https://github.com/portainer.png','Plex-Pi':'https://github.com/plexinc.png'};
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,dec=1)=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?'–':Number(v).toLocaleString('de-DE',{minimumFractionDigits:dec,maximumFractionDigits:dec});
const clamp=x=>Math.max(0,Math.min(100,Number(x)||0));
const pct=(u,t)=>t>0?u/t*100:0;
const diskFmt=(v,total)=>Number(total)>=1000?`${n(v/1000,2)} TB`:`${n(v,1)} GB`;
const displayTime=v=>v?new Date(v).toLocaleTimeString('de-DE'):'–';
const metric=sid=>s.metrics[sid]?.stats||{};
const measureTime=sid=>s.metrics[sid]?.created||null;
const sorted=(items,keys,getKey)=>items.slice().sort((a,b)=>{let aa=keys.indexOf(getKey(a)),bb=keys.indexOf(getKey(b));return (aa<0?10000:aa)-(bb<0?10000:bb)});
const servers=()=>sorted(s.systems,prefs.serverOrder,o=>o.name);
const temperature=st=>{const o=st.t||{};return o.cpu_thermal??o.coretemp_package_id_0??Object.values(o).find(v=>typeof v==='number');};
const drivesFor=sys=>{const stat=metric(sys.id),disks=[];
  if(Number(stat.d)>0)disks.push({id:'Systemlaufwerk',host:sys.name,total:Number(stat.d),used:Number(stat.du)||0});
  Object.entries(stat.efs||{}).forEach(([name,v])=>{if(Number(v.d)>0)disks.push({id:name,host:sys.name,total:Number(v.d),used:Number(v.du)||0})});
  return sorted(disks,prefs.diskOrder[sys.name]||[],d=>d.id);
};
const groupServers=()=>sorted(s.systems,prefs.diskGroups,o=>o.name);
const allDrives=()=>s.systems.flatMap(drivesFor);
const logo=sys=>`<img class="brand-img" src="${brands[sys.name]||''}" alt="${safe(sys.name)} Logo" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="logo-fallback" style="display:none">${safe(sys.name.slice(0,1))}</span>`;

async function api(path,method='GET',body=null){const headers={'Content-Type':'application/json'};if(s.token)headers.Authorization=s.token;const res=await fetch(s.url+path,{method,headers,body:body?JSON.stringify(body):undefined});const value=await res.json().catch(()=>({}));if(!res.ok)throw Error(value.message||`HTTP ${res.status}`);return value;}
async function login(url,email,password){if(native)return invoke('beszel_login',{url,email,password});s.url=url;const result=await api('/api/collections/users/auth-with-password','POST',{identity:email,password});s.token=result.token;}
async function records(collection,id,limit=60){if(native)return invoke('beszel_records',{collection,systemId:id,limit});const q=new URLSearchParams({filter:`system = "${id}"`,sort:'-created',perPage:String(limit)});return api(`/api/collections/${collection}/records?${q}`)}
async function snapshot(){if(native)return invoke('beszel_snapshot');const result=await api('/api/collections/systems/records?perPage=100');const systems=result.items||[],metrics={};await Promise.all(systems.map(async sys=>{try{const r=await records('system_stats',sys.id,1);metrics[sys.id]=r.items?.[0]||null}catch{metrics[sys.id]=null}}));return {systems,metrics};}
const bar=(val,blue=false)=>`<div class="track ${blue?'blue':''}"><i style="width:${clamp(val)}%"></i></div>`;
function diskCard(d){return `<article class="disk card"><div class="disk-title"><div><h3>${safe(d.id)}</h3><small>${safe(d.host)}</small></div><span class="drive-icon">▤</span></div><div class="disk-values"><b>${diskFmt(d.used,d.total)}</b><span>von ${diskFmt(d.total,d.total)} belegt</span></div>${bar(pct(d.used,d.total),true)}<div class="disk-bottom"><span>${n(pct(d.used,d.total))}% verwendet</span><span>${diskFmt(Math.max(0,d.total-d.used),d.total)} frei</span></div></article>`}
function diskGroups(view){return `<div class="disk-groups">${groupServers().map((sys,idx)=>{const disks=drivesFor(sys),closed=prefs.collapsed.includes(sys.name);return `<section class="storage-group card" data-group="${safe(sys.name)}"><div class="group-header"><button class="collapse" data-collapse="${safe(sys.name)}" aria-expanded="${!closed}"><span class="tiny-logo">${logo(sys)}</span><strong>${safe(sys.name)}</strong><small>${disks.length} Laufwerke</small><span>${closed?'▸':'▾'}</span></button><span class="order-controls"><span class="drag-handle" data-drag-handle="group" data-drag-id="${safe(sys.name)}" title="Speichergruppe ziehen">⠿ Ziehen</span><button data-move="group" data-id="${safe(sys.name)}" data-direction="-1" title="Nach oben" ${idx===0?'disabled':''}>↑</button><button data-move="group" data-id="${safe(sys.name)}" data-direction="1" title="Nach unten" ${idx===s.systems.length-1?'disabled':''}>↓</button></span></div>${closed?'':`<div class="disk-grid">${disks.map(d=>diskCard(d)).join('')}</div>${view==='storage'?`<div class="suborder"><span>Laufwerke anordnen:</span>${disks.map((d,i)=>`<span class="disk-move" data-disk-row="${safe(d.id)}" data-disk-host="${safe(sys.name)}"><span class="drag-handle" data-drag-handle="disk" data-drag-id="${safe(d.id)}" data-host="${safe(sys.name)}" title="Laufwerk ziehen">⠿</span> ${safe(d.id)} <button data-move="disk" data-host="${safe(sys.name)}" data-id="${safe(d.id)}" data-direction="-1" ${i===0?'disabled':''}>↑</button><button data-move="disk" data-host="${safe(sys.name)}" data-id="${safe(d.id)}" data-direction="1" ${i===disks.length-1?'disabled':''}>↓</button></span>`).join('')}</div>`:''}`}</section>`}).join('')}</div>`}
function serverCard(sys,i){const st=metric(sys.id),temp=temperature(st);return `<article class="server card" data-server-drag="${safe(sys.name)}"><div class="serverhead"><div class="servericon">${logo(sys)}</div><span class="state ${sys.status==='up'?'up':'down'}">● ${sys.status==='up'?'Online':safe(sys.status||'Unbekannt')}</span></div><button class="server-open" data-open="${safe(sys.id)}" title="Serverdetails öffnen"><h3>${safe(sys.name)} <span>↗</span></h3><p class="nickname">${safe(desc[sys.name]||'System')}</p></button><div class="metric"><div><span>CPU</span><b>${n(st.cpu)}%</b></div>${bar(st.cpu)}</div><div class="metric"><div><span>RAM</span><b>${n(st.mp)}%</b></div>${bar(st.mp,true)}</div><div class="serverfooter"><span>♨ ${temp===undefined?'–':n(temp)} °C</span><span>${st.d?diskFmt(st.d,st.d):'Keine Daten'}</span></div><div class="card-actions"><button data-move="server" data-id="${safe(sys.name)}" data-direction="-1" ${i===0?'disabled':''}>↑</button><button data-move="server" data-id="${safe(sys.name)}" data-direction="1" ${i===s.systems.length-1?'disabled':''}>↓</button><button class="service-link" data-service="${safe(sys.name)}" title="Zugehörigen Dienst im Browser öffnen">↗ Dienst öffnen</button><span class="drag-handle" data-drag-handle="server" title="Zum Verschieben ziehen">⠿ Ziehen</span></div></article>`}
function overview(){const systems=servers(),online=systems.filter(x=>x.status==='up').length,extra=allDrives().filter(d=>d.id!=='Systemlaufwerk').length;return `<div class="stats"><div class="summary card"><span>Server gesamt</span><strong>${systems.length}</strong><small>${online} online</small></div><div class="summary card"><span>Zusätzliche Laufwerke</span><strong>${extra}</strong><small>Über Beszel erkannt</small></div><div class="summary card"><span>Status</span><strong>${online===systems.length?'Bereit':'Prüfen'}</strong><small>${systems.length-online} offline</small></div></div><section><div class="section-title"><h2>Deine Server</h2><span>Per Maus ziehen oder Pfeile verwenden</span></div><div class="server-grid">${systems.map(serverCard).join('')}</div></section><section><div class="section-title"><h2>Festplatten nach Server</h2><span>${allDrives().length} Laufwerke</span></div>${diskGroups('overview')}</section>`}
function chart(data,fn,title,unit='%'){const values=data.map(x=>Number(fn(x))).filter(x=>Number.isFinite(x)),max=unit==='%'?100:Math.max(1,...values)*1.1; if(values.length<2)return `<div class="emptychart">Noch nicht genügend Verlaufsmesswerte.</div>`;const points=values.slice().reverse().map((v,i)=>`${(i/(values.length-1)*100).toFixed(2)},${(100-clamp(v/max*100)).toFixed(2)}`).join(' ');return `<div class="chart card"><div class="chart-title">${safe(title)} <span>${n(values[0])} ${safe(unit)}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${safe(title)} Verlauf"><line x1="0" y1="50" x2="100" y2="50"/><line x1="0" y1="99" x2="100" y2="99"/><polyline points="${points}"/></svg><div class="chart-foot">Letzte ${values.length} Messpunkte · neuester rechts</div></div>`}
function detail(){const sys=s.systems.find(x=>x.id===s.detail);if(!sys)return '<p>Server nicht gefunden.</p>';const st=metric(sys.id),history=s.history[sys.id]||[],temp=temperature(st),interfaces=Object.entries(st.ni||{});return `<section><button class="secondary" id="back">← Zur Übersicht</button><div class="detail-heading"><div class="servericon large">${logo(sys)}</div><div><h2>${safe(sys.name)}</h2><p>${safe(desc[sys.name]||'System')} · ${sys.status==='up'?'Online':'Status: '+safe(sys.status)}</p><small>Messzeitpunkt: ${displayTime(measureTime(sys.id))}</small><div class="service-actions"><button class="secondary" data-service="${safe(sys.name)}">↗ ${safe({"OctoPi":"OctoPrint öffnen","HAOS Dell":"Home Assistant öffnen","Docker-Pi":"Portainer öffnen","Plex-Pi":"Plex öffnen"}[sys.name]||"Dienst öffnen")}</button></div></div></div><div class="stats detail-stats"><div class="summary card"><span>CPU</span><strong>${n(st.cpu)}%</strong>${bar(st.cpu)}</div><div class="summary card"><span>RAM</span><strong>${n(st.mp)}%</strong>${bar(st.mp,true)}</div><div class="summary card"><span>Temperatur</span><strong>${temp===undefined?'–':n(temp)+' °C'}</strong><small>Aus Beszel</small></div></div><div class="charts">${chart(history,x=>x.stats?.cpu,'CPU-Verlauf')}${chart(history,x=>x.stats?.mp,'RAM-Verlauf')}${chart(history,x=>temperature(x.stats||{}),'Temperatur','°C')}${chart(history,x=>Number(x.stats?.b?.[0]||0)/1024,'Netzwerk gesendet','KB/s')}${chart(history,x=>Number(x.stats?.b?.[1]||0)/1024,'Netzwerk empfangen','KB/s')}</div><h2 class="detail-section">Netzwerkschnittstellen</h2><div class="list-card card">${interfaces.map(([name,values])=>`<div class="list-row"><b>${safe(name)}</b><span>Aktuell: ↑ ${n((values[0]||0)/1024)} KB/s · ↓ ${n((values[1]||0)/1024)} KB/s</span></div>`).join('')||'Keine Netzwerkdaten'}</div><h2 class="detail-section">Laufwerke</h2><div class="disk-grid">${drivesFor(sys).map(diskCard).join('')}</div></section>`}
// Static classifications, but live container names and states always come from Beszel.
const DOCKER_GROUPS=[
 {id:'nextcloud',name:'Nextcloud',icon:'☁',members:['nextcloud','nextcloud-db','nextcloud-redis']},
 {id:'homelab',name:'HomeLab & Monitoring',icon:'▣',members:['homelab-command-center','rack-dashboard','beszel','beszel-agent']},
 {id:'printer',name:'3D-Druck & Filament',icon:'▤',members:['printer-maintenance','spoolman']},
 {id:'cables',name:'Kabelmanager',icon:'⌁',members:['kabelmanager','kabelmanager-proxy']},
 {id:'adguard',name:'AdGuard Home & Backup',icon:'◇',members:['AdGuardHome','adguard-cron-backup']},
 {id:'other',name:'Weitere Dienste',icon:'▥',members:[]}
];
const HIDDEN_CONTAINERS=new Set(['homelab-dashboard']);
const containerName=c=>String(c.name||c.container_name||c.info?.name||c.id||'Unbekannt');
const containerKey=c=>containerName(c).toLowerCase();
const groupForContainer=c=>DOCKER_GROUPS.find(g=>g.id!=='other'&&g.members.some(n=>n.toLowerCase()===containerKey(c)))?.id||'other';
const dockerGroups=()=>sorted(DOCKER_GROUPS,prefs.dockerGroupOrder||[],g=>g.id).map(g=>({...g,items:s.containers.filter(c=>!HIDDEN_CONTAINERS.has(containerKey(c))&&groupForContainer(c)===g.id)})).filter(g=>g.items.length);
const hasDockerUrl=id=>Boolean(tryHttpUrl(prefs.dockerUrls[id]||''));
const dockerOpenButton=(id,label='↗ Webseite öffnen')=>hasDockerUrl(id)?`<button class="secondary docker-open" data-docker-url="${safe(id)}">${safe(label)}</button>`:'';
function dockerView(){
 const dk=s.systems.find(x=>x.name==='Docker-Pi');
 const visible=s.containers.filter(c=>!HIDDEN_CONTAINERS.has(containerKey(c)));
 const grouped=dockerGroups();
 return `<section><div class="section-title"><h2>Docker-Dienste</h2><span>${visible.length} Container · ${grouped.length} Gruppen</span></div>
 <p class="muted-text">Live-Status aus Beszel · Zugehörige Container aufklappen und ihre Weboberflächen öffnen. Nur Lesezugriff; Backend-Dienste haben nicht zwingend eine eigene Webseite.</p>
 ${s.containerError?`<div class="alert">${safe(s.containerError)}</div>`:''}
 ${!dk?'<p>Docker-Pi wurde nicht gefunden.</p>':`<button id="refresh-docker" class="secondary">↻ Container laden</button>
 <div class="docker-groups">${grouped.map((g,idx)=>{
 const closed=prefs.dockerCollapsed.includes(g.id);
 const order=grouped.map(x=>x.id);
 return `<section class="docker-group card" data-docker-group="${safe(g.id)}"><div class="docker-group-header"><button class="collapse" data-docker-collapse="${safe(g.id)}" aria-expanded="${!closed}"><span class="docker-symbol">${safe(g.icon)}</span><strong>${safe(g.name)}</strong><small>${g.items.length} Container</small><span>${closed?'▸':'▾'}</span></button>
 <span class="order-controls"><button data-move-docker="${safe(g.id)}" data-direction="-1" title="Gruppe nach oben" ${idx===0?'disabled':''}>↑</button><button data-move-docker="${safe(g.id)}" data-direction="1" title="Gruppe nach unten" ${idx===grouped.length-1?'disabled':''}>↓</button></span></div>
 ${closed?'':`<div class="docker-items">${g.items.map(c=>{
 const name=containerName(c),state=String(c.status||c.state||c.stats?.status||c.info?.status||'Status unbekannt');
 const live=/(up|running|online)/i.test(state);
 return `<div class="docker-item"><div class="docker-item-description"><b>${safe(name)}</b><small>${safe(c.image||c.stats?.image||'')}</small></div><span class="state ${live?'up':''}">● ${safe(state)}</span>${dockerOpenButton(name.toLowerCase())}</div>`
 }).join('')}${g.id==='printer'?`<div class="docker-item docker-shortcut"><div class="docker-item-description"><b>Wartungslog – Drucker 1</b><small>Direktlink · kein zusätzlicher Container</small></div>${dockerOpenButton('printer-1','↗ Drucker 1 öffnen')}</div>`:''}</div>`}</section>`
 }).join('')||'<div class="card empty">Keine Container vorhanden.</div>'}</div>`}</section>`;
}
function settingsView(){return `<section class="settings-layout">${updateSettingsCard()}<div class="card settings-card"><h2>Verbindung & Aktualisierung</h2><label>Beszel-Hub<input value="${safe(s.url)}" readonly title="Zum Wechseln abmelden und neu verbinden"></label><p class="muted-text">Zum Wechseln der Beszel-Adresse bitte abmelden. Zugangsdaten und Tokens werden nicht dauerhaft gespeichert.</p><label>Aktualisierung <select id="interval">${[5,10,15,30,60].map(v=>`<option value="${v}" ${prefs.refreshSeconds===v?'selected':''}>Alle ${v} Sekunden</option>`).join('')}</select></label><small>Die Messwerte werden aktualisiert, sobald Beszel neue Daten bereitstellt. Der Zeitstempel des letzten Messwerts bleibt sichtbar.</small></div><div class="card settings-card"><h2>Darstellung & Design</h2><p class="muted-text">Dunkelblau bleibt Standard. Deine Anpassungen werden lokal auf diesem Gerät gespeichert.</p><label>Logo in der Seitenleiste (PNG, JPG oder WEBP)<input id="logo-upload" type="file" accept="image/png,image/jpeg,image/webp"></label><label>Eigenes Hintergrundbild<input id="background-upload" type="file" accept="image/png,image/jpeg,image/webp"></label><label>Hintergrund abdunkeln: <output id="dim-value">${prefs.dim}%</output><input id="dim" type="range" min="0" max="95" step="5" value="${prefs.dim}"></label><label class="check"><input type="checkbox" id="show-background" ${prefs.showBackground?'checked':''}> Hintergrundbild anzeigen</label><div class="settings-actions"><button id="clear-logo" class="secondary">Standard-Logo</button><button id="clear-background" class="secondary">Hintergrund entfernen</button></div><small>Fotos bis 25 MB (PNG, JPG, WEBP); große Bilder werden für eine flüssige Oberfläche verkleinert. In der Desktop-App werden die Bilder separat im App-Datenordner gespeichert.</small></div><div class="card settings-card"><h2>Webseiten deiner Server</h2><p class="muted-text">Die Schaltfläche „Dienst öffnen“ öffnet deinen Browser. Passe die Adressen an dein Netzwerk an.</p>${['OctoPi','HAOS Dell','Docker-Pi','Plex-Pi'].map(name=>`<label>${safe(name)}<input data-service-url="${safe(name)}" type="url" value="${safe(prefs.serviceUrls[name]||'')}" placeholder="http://..."></label>`).join('')}<button id="save-service-urls" class="secondary">Dienst-Adressen speichern</button></div><div class="card settings-card"><h2>Docker-Webadressen</h2><p class="muted-text">Hier kannst du die Ziele der „Webseite öffnen“-Buttons ändern. Trage hier deine eigenen lokalen oder öffentlich erreichbaren Webadressen ein.</p>${[
 ['nextcloud','Nextcloud'],['homelab-command-center','HomeLab Commands'],['rack-dashboard','Rack Dashboard'],['beszel','Beszel Hub'],['printer-maintenance','3D-Drucker Wartungslog'],['printer-1','Wartungslog – Drucker 1'],['spoolman','Spoolman'],['kabelmanager','Kabelmanager'],['AdGuardHome','AdGuard Home'],['portainer','Portainer'],['uptime-kuma','Uptime Kuma']
 ].map(([id,label])=>`<label>${safe(label)}<input type="url" data-docker-url-input="${safe(id)}" value="${safe(prefs.dockerUrls[id]||'')}" placeholder="https://... (optional)"></label>`).join('')}<button id="save-docker-urls" class="secondary">Docker-Webadressen speichern</button><small>Leeres Feld = kein Öffnen-Button. MariaDB, Redis, Agent, Backup und Proxy bleiben ohne Weblink.</small></div><div class="card settings-card"><h2>Reihenfolgen</h2><p class="muted-text">Server und Speichergruppen lassen sich mit den Pfeilen oder per Ziehen sortieren; innerhalb der Speicheransicht kannst du außerdem jedes Laufwerk sortieren.</p><button id="reset-order" class="secondary">Sortierungen zurücksetzen</button></div></section>`}
function loginView(){return `<section class="login card"><h2>Mit Beszel verbinden</h2><p>Deine Zugangsdaten bleiben in der laufenden Sitzung und werden nicht als Passwortdatei gespeichert.</p><form id="login-form"><label>Beszel-Adresse<input id="url" type="url" value="${safe(s.url)}" required></label><label>E-Mail<input id="email" type="email" autocomplete="username" required></label><label>Passwort<input id="password" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">Verbinden</button></form><div class="security">HTTP nur im vertrauenswürdigen Heimnetz; extern ausschließlich mit VPN oder HTTPS.</div></section>`}
function render(){const pageTitle={overview:'Serverübersicht',storage:'Speicherübersicht',docker:'Docker-Übersicht',settings:'Einstellungen',detail:'Serverdetails'}[s.page]||'HomeLab';const background=prefs.background&&prefs.showBackground?`<div class="wallpaper" style="background-image:linear-gradient(rgba(6,12,25,${prefs.dim/100}),rgba(6,12,25,${prefs.dim/100})),url('${prefs.background}')"></div>`:'';app.innerHTML=`${background}<div class="shell"><aside class="sidebar"><div class="brand"><div class="brandmark">${prefs.customLogo?`<img src="${prefs.customLogo}" alt="Eigenes HomeLab-Logo">`:'H'}</div><div><b>HomeLab</b><small>MANAGER <span>0.2.3</span></small></div></div><nav aria-label="Navigation">${[['overview','▦','Übersicht'],['storage','▤','Speicher'],['docker','▣','Docker'],['settings','⚙','Einstellungen']].map(([id,ico,name])=>`<button class="navitem ${s.page===id||(s.page==='detail'&&id==='overview')?'selected':''}" data-nav="${id}">${ico} <span>${name}</span></button>`).join('')}</nav><div class="sidebarfoot"><span class="signal ${s.connected?'ok':''}"></span>${s.connected?'Beszel verbunden':'Nicht verbunden'}<small>${safe(s.url)}</small></div></aside><main><header><div><div class="eyebrow">DEIN PRIVATES HOMELAB</div><h1>${pageTitle}</h1><p>${s.page==='overview'?'Alle deine Systeme an einem Ort – direkt aus Beszel.':s.page==='storage'?'Jedes Laufwerk sauber nach Server kategorisiert.':s.page==='docker'?'Containerdaten direkt aus Beszel.':s.page==='settings'?'Personalisiere deinen HomeLab Manager.':'Detaillierte Messwerte und Diagramme.'}</p></div><div class="header-actions"><span class="updated">${s.updated?'Abfrage '+displayTime(s.updated):'Noch keine Abfrage'}</span><button id="refresh" class="secondary" ${!s.connected||s.busy?'disabled':''}>↻ Aktualisieren</button><button id="logout" class="secondary" ${!s.connected?'disabled':''}>Abmelden</button></div></header>${s.error?`<div class="alert" role="alert">${safe(s.error)}</div>`:''}${!s.connected?loginView():s.page==='overview'?overview():s.page==='storage'?`<div class="section-title"><h2>Deine Festplatten</h2><span>${allDrives().length} Laufwerke</span></div>${diskGroups('storage')}`:s.page==='docker'?dockerView():s.page==='settings'?settingsView():detail()}<footer>HomeLab Manager 0.2.3 · Automatische Abfrage alle ${prefs.refreshSeconds}s · Beszel bleibt Datenquelle · Nur Lesezugriff</footer></main></div>`;wire()}
function reorder(list,key,direction){let a=list.slice();let i=a.indexOf(key);if(i<0||i+direction<0||i+direction>=a.length)return a;[a[i],a[i+direction]]=[a[i+direction],a[i]];return a}
async function showDetail(id){s.detail=id;s.page='detail';render();try{const res=await records('system_stats',id,90);s.history[id]=res.items||[]}catch(err){s.error='Verlauf nicht geladen: '+String(err.message||err)}render()}
async function loadContainers(){
 const sys=s.systems.find(x=>x.name==='Docker-Pi');if(!sys)return;
 s.containerError='';
 try{
  const result=native?await invoke('beszel_containers',{systemId:sys.id}):await browserContainers(sys.id);
  s.containers=(result.items||[]).map(x=>x);
  if(!s.containers.length)s.containerError='Beszel liefert zurzeit keine Container-Einträge. Prüfe im Beszel-Hub, ob Docker-Container für den Docker-Pi angezeigt werden.';
 }catch(err){s.containers=[];s.containerError='Containerabfrage fehlgeschlagen: '+String(err.message||err)}
 render();
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
function wire(){document.querySelector('#login-form')?.addEventListener('submit',async e=>{e.preventDefault();const u=document.querySelector('#url').value.trim().replace(/\/+$/,'');const email=document.querySelector('#email').value,password=document.querySelector('#password').value;s.busy=true;s.error='';render();try{await login(u,email,password);s.url=u;s.connected=true;s.busy=false;await refresh(false)}catch(err){s.connected=false;s.error='Anmeldung fehlgeschlagen: '+String(err.message||err)}finally{s.busy=false;render()}});
 document.querySelector('#refresh')?.addEventListener('click',()=>refresh());document.querySelector('#logout')?.addEventListener('click',async()=>{if(native)await invoke('beszel_logout').catch(()=>{});s.token='';s.connected=false;s.systems=[];s.metrics={};s.history={};s.containers=[];s.detail=null;s.page='overview';s.error='';render()});
 document.querySelectorAll('[data-nav]').forEach(e=>e.addEventListener('click',()=>{s.page=e.dataset.nav;s.error='';render();if(s.page==='docker')loadContainers()}));document.querySelectorAll('[data-open]').forEach(e=>e.addEventListener('click',()=>showDetail(e.dataset.open)));document.querySelector('#back')?.addEventListener('click',()=>{s.page='overview';render()});document.querySelector('#refresh-docker')?.addEventListener('click',loadContainers);
 document.querySelectorAll('[data-collapse]').forEach(e=>e.addEventListener('click',()=>{const k=e.dataset.collapse;prefs.collapsed=prefs.collapsed.includes(k)?prefs.collapsed.filter(x=>x!==k):[...prefs.collapsed,k];save();render()}));
 document.querySelectorAll('[data-move]').forEach(e=>e.addEventListener('click',()=>{const key=e.dataset.id,dir=Number(e.dataset.direction),type=e.dataset.move;if(type==='server'){prefs.serverOrder=reorder(servers().map(x=>x.name),key,dir)}else if(type==='group'){prefs.diskGroups=reorder(groupServers().map(x=>x.name),key,dir)}else {const host=e.dataset.host,sys=s.systems.find(x=>x.name===host);prefs.diskOrder[host]=reorder(drivesFor(sys).map(x=>x.id),key,dir)}save();render()}));
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
    const keys=type==='server'?servers().map(x=>x.name):type==='group'?groupServers().map(x=>x.name):drivesFor(s.systems.find(x=>x.name===host)).map(x=>x.id);
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
 document.querySelectorAll('[data-move-docker]').forEach(el=>el.addEventListener('click',()=>{const keys=dockerGroups().map(g=>g.id),changed=reorder(keys,el.dataset.moveDocker,Number(el.dataset.direction));prefs.dockerGroupOrder=[...changed,...DOCKER_GROUPS.map(g=>g.id).filter(id=>!changed.includes(id))];save();render()}));
 document.querySelectorAll('[data-docker-url]').forEach(el=>el.addEventListener('click',()=>openDockerService(el.dataset.dockerUrl)));
 document.querySelector('#save-docker-urls')?.addEventListener('click',()=>{const next={...prefs.dockerUrls};for(const el of document.querySelectorAll('[data-docker-url-input]')){const value=el.value.trim();if(value&&!tryHttpUrl(value)){s.error='Ungültige Docker-Webadresse bei '+el.dataset.dockerUrlInput;render();return}next[el.dataset.dockerUrlInput]=value}prefs.dockerUrls=next;save();s.error='';render()});
 document.querySelectorAll('[data-service]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openService(b.dataset.service)}));
 document.querySelector('#interval')?.addEventListener('change',e=>{prefs.refreshSeconds=Number(e.target.value);save();render()});document.querySelector('#logo-upload')?.addEventListener('change',e=>fileUpload(e.target,'customLogo'));document.querySelector('#background-upload')?.addEventListener('change',e=>fileUpload(e.target,'background'));document.querySelector('#dim')?.addEventListener('input',e=>{prefs.dim=Number(e.target.value);save();document.querySelector('#dim-value').textContent=`${prefs.dim}%`;const bg=document.querySelector('.wallpaper');if(bg)bg.style.backgroundImage=`linear-gradient(rgba(6,12,25,${prefs.dim/100}),rgba(6,12,25,${prefs.dim/100})),url('${prefs.background}')`});document.querySelector('#show-background')?.addEventListener('change',e=>{prefs.showBackground=e.target.checked;save();render()});document.querySelector('#clear-logo')?.addEventListener('click',()=>clearAsset('customLogo'));document.querySelector('#clear-background')?.addEventListener('click',()=>clearAsset('background'));document.querySelector('#save-service-urls')?.addEventListener('click',()=>{document.querySelectorAll('[data-service-url]').forEach(el=>{const v=el.value.trim();if(v)prefs.serviceUrls[el.dataset.serviceUrl]=v});save();s.error='';render()});document.querySelector('#reset-order')?.addEventListener('click',()=>{prefs.serverOrder=[];prefs.diskGroups=[];prefs.diskOrder={};save();render()});document.querySelector('#check-updates')?.addEventListener('click',()=>checkForAppUpdates());document.querySelector('#install-update')?.addEventListener('click',installAppUpdate)}
async function refresh(showLoading=true){if(!s.connected||s.busy)return;s.busy=true;if(showLoading)document.querySelector('#refresh')?.setAttribute('disabled','');try{const res=await snapshot();s.systems=res.systems;s.metrics=res.metrics;s.updated=new Date();s.error='';if(s.page==='detail'&&s.detail){try{const h=await records('system_stats',s.detail,90);s.history[s.detail]=h.items||[]}catch{}}}catch(err){s.error='Daten konnten nicht geladen werden: '+String(err.message||err)}finally{s.busy=false;render()}}
render();initAssets();setInterval(()=>{if(s.connected&&!s.busy&&(!s.lastFetch||Date.now()-s.lastFetch>=prefs.refreshSeconds*1000)){s.lastFetch=Date.now();refresh(false)}},1000);

// Check once on startup in an installed release; never install without a click.
if (releaseBuild) {
  getVersion().then(v=>{updaterState.version=v;render()}).catch(()=>{});
  setTimeout(()=>checkForAppUpdates({silent:true}), 3500);
}
