// ── Persistence ────────────────────────────────────────────────────────────
// The full data lifecycle: serialise the form to/from a plain object, autosave
// to localStorage, import/export a JSON file, and — when a token is supplied —
// two-way sync that same payload with data/event-data.json in the repo.

// ── JSON data: collect / apply / autosave / export / import ──
function collectData(){
  const food=foodEntries().map(f=>({name:f.name,category:f.category,qty:f.qtyRaw,price:f.priceRaw}));
  const guests=guestEntries().map(g=>({honorific:g.honorific,name:g.name,relationship:g.relationship,reference:g.reference,invited:g.invited,rsvp:g.rsvp,party:g.party}));
  return{organizedFor:val('organizedFor'),eventType:currentEvent,eventDate:val('eventDate'),
    venueName:val('venueName'),venueAddr:val('venueAddr'),venueContact:val('venueContact'),
    venuePhone:val('venuePhone'),venueCost:val('venueCost'),venueAdv:val('venueAdv'),mapUrl:val('mapUrl'),
    catererName:val('catererName'),catererPhone:val('catererPhone'),syncPlates,
    rsvpNotes:val('rsvpNotes'),food,guests,updatedAt:Date.now()};
}
function applyData(d){
  if(!d)return;
  ['organizedFor','eventDate','venueName','venueAddr','venueContact','venuePhone','venueCost','venueAdv','mapUrl','catererName','catererPhone'].forEach(k=>setVal(k,d[k]));
  setVal('rsvpNotes',d.rsvpNotes||'');
  if(d.eventType){
    const btn=[...document.querySelectorAll('.event-btn')].find(b=>b.textContent.trim()===d.eventType);
    if(btn)setEvent(btn,d.eventType);
  }
  document.getElementById('foodList').innerHTML='';foodId=0;
  syncPlates=!!d.syncPlates;
  const chk=document.getElementById('syncPlatesChk');if(chk)chk.checked=syncPlates;
  (d.food||[]).forEach(f=>{
    addFood();
    const fi=document.getElementById('foodList').lastElementChild;
    fi.querySelector('input[type=text]').value=f.name||'';
    if(fi.querySelector('select'))fi.querySelector('select').value=f.category||'';
    const nums=fi.querySelectorAll('input[type=number]');
    nums[0].value=f.qty||'';nums[1].value=f.price||'';
    nums[0].dispatchEvent(new Event('input'));
  });
  document.getElementById('guestList').innerHTML='';guestId=0;
  (d.guests||[]).forEach(g=>{
    addGuest();
    const gi=document.getElementById('guestList').lastElementChild;
    if(gi.querySelector('.honorific'))gi.querySelector('.honorific').value=g.honorific||'Mr.';
    gi.querySelector('.guest-name-wrap input').value=g.name||'';
    if(gi.querySelector('.relationship')&&g.relationship)gi.querySelector('.relationship').value=g.relationship;
    if(gi.querySelector('.reference'))gi.querySelector('.reference').value=g.reference||'';
    if(g.invited)toggleInvite(gi.id.replace('guest',''));
    if(g.rsvp)toggleRsvp(gi.id.replace('guest',''));
    const sv=gi.querySelector('.spin-val');
    if(sv&&g.party)sv.textContent=g.party;
  });
  if(d.mapUrl)previewMap();
  recalc();
}
let saveTimer;
function saveLocal(immediate){
  clearTimeout(saveTimer);
  const run=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(collectData()));}catch(e){}scheduleGitHubPush();};
  if(immediate)run();else saveTimer=setTimeout(run,SAVE_DEBOUNCE_MS);
}
function loadLocal(){
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)return JSON.parse(raw);}catch(e){}
  return null;
}
function exportJSON(){
  const data=collectData();
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=(data.organizedFor||'event').replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-event-data.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
function importJSON(e){
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{applyData(JSON.parse(reader.result));}
    catch(err){alert('Could not read that JSON file.');}
  };
  reader.readAsText(file);
  e.target.value='';
}

// ── GitHub sync: connect once, then every change auto-saves to data/event-data.json ──
const GH_REPO='piyalgupta/event',GH_PATH='data/event-data.json';
let ghConnected=false,ghBusy=false,ghDirty=false,ghPushTimer,ghSuppressPush=false;
function ghHeaders(t){return{Authorization:`token ${t}`,Accept:'application/vnd.github+json'}}
function setStatus(m){setText('saveStatus',m);}
// Once connected, hide the token field (auto-sync is disabled from view); it
// only reappears if the connection breaks (bad/expired token, disconnect).
function updateGhUI(){const b=$('ghConnect');if(b)b.style.display=ghConnected?'none':'';}
// True only when the data holds real user content (not the blank starter form),
// so a fresh device's defaults never overwrite real data saved elsewhere.
function isMeaningful(d){
  if(!d)return false;
  if((d.organizedFor||'').trim()||(d.venueName||'').trim()||(d.venueAddr||'').trim()||String(d.venueCost||'').trim())return true;
  if((d.food||[]).some(f=>(f.name||'').trim()||String(f.price||'').trim()))return true;
  if((d.guests||[]).some(g=>(g.name||'').trim()))return true;
  return false;
}
async function connectGitHub(){
  const inp=$('ghTokenInput');
  const token=(inp&&inp.value||'').trim();
  if(!token){setStatus('Enter a GitHub token (repo scope) above to enable auto-save.');return false;}
  setStatus('Connecting to GitHub…');
  try{
    const res=await fetch(`https://api.github.com/repos/${GH_REPO}`,{headers:ghHeaders(token)});
    if(res.ok){
      ghConnected=true;localStorage.setItem(TOKEN_KEY,token);updateGhUI();startGhPoll();
      setStatus('Connected ✓ — syncing with the repo…');
      await syncWithGitHub();
      return true;
    }
    if(res.status===401)localStorage.removeItem(TOKEN_KEY);
    setStatus('Connection failed ('+res.status+'). Check the token has repo scope.');
  }catch(e){setStatus('GitHub unreachable. Check your network and try Connect again.');}
  ghConnected=false;updateGhUI();return false;
}
// On connect/load: pull the repo copy. If it's newer than (or local is empty),
// load it so every device shows the same data; otherwise push the local copy up.
async function syncWithGitHub(){
  const token=localStorage.getItem(TOKEN_KEY);
  if(!ghConnected||!token)return;
  const api=`https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH}`;
  try{
    const res=await fetch(api+'?ts='+Date.now(),{headers:ghHeaders(token),cache:'no-store'});
    if(res.status===404){setStatus('Connected ✓ — saving this device’s data to the repo…');pushToGitHub();return;}
    if(!res.ok){setStatus('Connected ✓ (couldn’t read remote: '+res.status+').');return;}
    const j=await res.json();
    let remote=null;try{remote=JSON.parse(decodeURIComponent(escape(atob(j.content))));}catch(e){}
    const local=loadLocal();
    const lt=(local&&+local.updatedAt)||0,rt=(remote&&+remote.updatedAt)||0;
    if(remote&&(!isMeaningful(local)||(isMeaningful(remote)&&rt>=lt))){
      ghSuppressPush=true;
      applyData(remote);
      try{localStorage.setItem(STORAGE_KEY,JSON.stringify(remote));}catch(e){}
      setStatus('Loaded latest from GitHub ✓ '+new Date().toLocaleTimeString('en-IN'));
      setTimeout(()=>{ghSuppressPush=false;},GH_SUPPRESS_MS);
    }else{
      setStatus('Connected ✓ — this device is newer, saving up…');
      pushToGitHub();
    }
  }catch(e){setStatus('Connected ✓ — couldn’t reach GitHub to sync.');}
}
function scheduleGitHubPush(){
  if(!ghConnected||ghSuppressPush)return;
  clearTimeout(ghPushTimer);ghPushTimer=setTimeout(pushToGitHub,GH_PUSH_DEBOUNCE_MS);
}
// Read the file's current blob SHA, bypassing any HTTP cache. Using a cached
// response here is what caused "does not match …" 409s: the PUT would be sent
// against a stale SHA. Returns undefined when the file doesn't exist yet (→create).
async function ghCurrentSha(api,token){
  try{
    const r=await fetch(api+'?ts='+Date.now(),{headers:ghHeaders(token),cache:'no-store'});
    if(r.ok)return (await r.json()).sha;
  }catch(e){}
  return undefined;
}
async function pushToGitHub(){
  if(!ghConnected)return;
  const token=localStorage.getItem(TOKEN_KEY);if(!token){ghConnected=false;updateGhUI();return;}
  if(ghBusy){ghDirty=true;return;}
  ghBusy=true;ghDirty=false;
  const api=`https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH}`;
  const content=btoa(unescape(encodeURIComponent(JSON.stringify(collectData(),null,2))));
  try{
    let sha=await ghCurrentSha(api,token);
    // PUT, and if the SHA is rejected as out of date (409, or 422 "does not
    // match"), re-read the latest SHA and retry once so a concurrent update
    // self-heals instead of permanently failing the save.
    for(let attempt=0;attempt<2;attempt++){
      const putRes=await fetch(api,{method:'PUT',headers:{...ghHeaders(token),'Content-Type':'application/json'},
        body:JSON.stringify({message:'Update event data',content,sha})});
      if(putRes.ok){setStatus('Auto-saved to GitHub ✓ '+new Date().toLocaleTimeString('en-IN'));break;}
      const e=await putRes.json().catch(()=>({}));
      const stale=putRes.status===409||(putRes.status===422&&/does not match/i.test(e.message||''));
      if(stale&&attempt===0){sha=await ghCurrentSha(api,token);continue;}
      if(putRes.status===401){ghConnected=false;localStorage.removeItem(TOKEN_KEY);updateGhUI();}
      setStatus('GitHub save failed ('+(e.message||putRes.status)+'). Saved locally.');
      break;
    }
  }catch(err){setStatus('GitHub unreachable. Saved locally — will retry on next change.');}
  ghBusy=false;
  if(ghDirty)scheduleGitHubPush();
}
async function saveAll(){
  saveLocal(true);
  if(ghConnected){pushToGitHub();return;}
  if((($('ghTokenInput')?.value)||'').trim()){if(await connectGitHub())return;}
  exportJSON();setStatus('Saved in this browser + downloaded JSON (connect a GitHub token above to auto-sync).');
}
// ── Cross-device / cross-tab live sync ────────────────────────────────────
// (1) Poll GitHub every 30 s while connected to catch changes from other devices.
// (2) Pull on tab-focus (visibilitychange) so returning from mobile → desktop
//     always shows the freshest data without a manual refresh.
// (3) Listen for localStorage 'storage' events so two tabs in the same browser
//     stay in sync without a GitHub round-trip.

const GH_POLL_MS = 30_000; // poll interval when connected
let ghPollTimer;

function startGhPoll() {
  clearInterval(ghPollTimer);
  ghPollTimer = setInterval(async () => {
    if (!ghConnected) { clearInterval(ghPollTimer); return; }
    await syncWithGitHub();
  }, GH_POLL_MS);
}

// Pull on visibility restore (user switches back to this tab / app)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ghConnected) {
    syncWithGitHub();
  }
});

// Same-browser cross-tab sync via the native storage event
window.addEventListener('storage', e => {
  if (e.key !== STORAGE_KEY) return;
  try {
    const fresh = JSON.parse(e.newValue);
    if (fresh) applyData(fresh);
  } catch (_) {}
});
