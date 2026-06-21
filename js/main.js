// ── Bootstrap ──────────────────────────────────────────────────────────────
// Runs last, after every other module has defined its functions. Wires up page
// navigation, restores saved data/token, and installs the autosave safety net.

// ── Section navigation : the header menu switches single-page views ──
// Every view shares one data model (IDs + recalc), so switching never loses
// state; recalc() runs on each switch to keep badges/totals/dashboard live.
const VIEWS=['venue','food','guests','dashboard','summary'];
function showView(name){
  VIEWS.forEach(v=>{
    const sec=document.getElementById('view-'+v);
    if(sec)sec.classList.toggle('active',v===name);
  });
  document.querySelectorAll('.ah-link').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  const sc=document.getElementById('pages');if(sc)sc.scrollTo({top:0});
  if(typeof recalc==='function')recalc();
}

// ── Lock : freeze the Venue & Food sections (a single header toggle) ──
let appLocked=false;
function setLock(on){
  appLocked=on;
  ['view-venue','view-food'].forEach(id=>{
    const v=document.getElementById(id);if(!v)return;
    v.classList.toggle('locked',on);
    v.querySelectorAll('.lock-fields input,.lock-fields select,.lock-fields textarea,.lock-fields button')
      .forEach(el=>{el.disabled=on;});
  });
  const btn=document.getElementById('lockToggle');
  if(btn){
    btn.classList.toggle('on',on);
    btn.querySelector('.msi').textContent=on?'lock':'lock_open';
    btn.title=on?'Unlock Venue & Food sections':'Lock Venue & Food sections';
  }
  if(typeof saveLocal==='function')saveLocal();
}
function toggleLock(){setLock(!appLocked);}

// fadeOut keyframe (guest removal)
const s=document.createElement('style');
s.textContent='@keyframes fadeOut{to{opacity:0;transform:translateY(-6px)}}';
document.head.appendChild(s);

// ── Theme (dark / light) : persisted, defaults to system preference ──
(function(){
  const stored=localStorage.getItem('theme');
  const dark=stored?stored==='dark':window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark',dark);
  const btn=document.getElementById('themeToggle');
  if(btn)btn.addEventListener('click',()=>{
    const on=document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme',on?'dark':'light');
  });
})();

// ── Init ──
if(typeof buildGuestFilterBar==='function')buildGuestFilterBar();
const saved=loadLocal();
if(saved){applyData(saved);}
else{addFood();addFood();addGuest();addGuest();addGuest();recalc();}

// Restore a previously saved token, reconnect, and pull the latest data from
// the repo so this device (e.g. mobile) shows what was saved elsewhere.
const savedToken=localStorage.getItem(TOKEN_KEY);
if(savedToken){const inp=$('ghTokenInput');if(inp)inp.value=savedToken;connectGitHub();}

// ── Global autosave safety net ──
// Several fields (event date, contact/phone, full address, map URL, caterer
// name/phone, RSVP notes) were never wired to recalc(), so per-field handlers
// silently dropped their values from autosave. One delegated listener on the
// scroll container guarantees every input/select/textarea change — present or
// dynamically added — is persisted, fulfilling the README's "every change is
// saved" promise. saveLocal() is debounced, so this adds no extra writes.
const pagesEl=document.getElementById('pages');
pagesEl.addEventListener('input',()=>saveLocal());
pagesEl.addEventListener('change',()=>saveLocal());

// ── Keyboard-aware fields (tablets / laptops / phones) ──
// When the on-screen keyboard appears it can cover the focused field. Keep the
// active field scrolled into the still-visible area (measured via the
// VisualViewport so it works even when the layout viewport doesn't resize),
// free the snap-scroll while typing, and make the keyboard easy to dismiss —
// a tap on empty space or Enter on a single-line field blurs it.
const FIELD=/^(INPUT|SELECT|TEXTAREA)$/;
function scrollActiveIntoView(){
  const el=document.activeElement;
  if(!el||!FIELD.test(el.tagName))return;
  const vv=window.visualViewport;
  if(vv){
    const r=el.getBoundingClientRect();
    const top=vv.offsetTop+24, bottom=vv.offsetTop+vv.height-24;
    if(r.bottom>bottom)pagesEl.scrollBy({top:r.bottom-bottom,behavior:'smooth'});
    else if(r.top<top)pagesEl.scrollBy({top:r.top-top,behavior:'smooth'});
  }else{
    el.scrollIntoView({block:'center',behavior:'smooth'});
  }
}
document.addEventListener('focusin',e=>{
  if(FIELD.test(e.target.tagName))setTimeout(scrollActiveIntoView,300);
});
if(window.visualViewport){
  const vv=window.visualViewport;
  const onVV=()=>{
    const kb=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);
    document.documentElement.style.setProperty('--kb',kb+'px');
    const open=kb>120;
    pagesEl.classList.toggle('kb-open',open);
    if(open)scrollActiveIntoView();
  };
  vv.addEventListener('resize',onVV);
  vv.addEventListener('scroll',onVV);
}
// Tap on empty space dismisses the keyboard (capture so we read the field
// that was focused before the tap moves focus).
document.addEventListener('pointerdown',e=>{
  const a=document.activeElement;
  if(a&&FIELD.test(a.tagName)&&!e.target.closest('input,textarea,select,label,button,.spinner,.invite-toggle,.event-btn,.tab'))a.blur();
},true);
// Enter dismisses a single-line field (textareas keep their newline).
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT')e.target.blur();});

// ── Periodic autosave (every 3 minutes) ──
// A timed safety net on top of the per-change autosave: every 3 minutes any
// pending edits are flushed to localStorage (and to GitHub when connected).
// Change-aware — the payload is compared ignoring its timestamp — so an idle
// session never triggers a redundant save or GitHub commit.
const AUTOSAVE_INTERVAL_MS=180000; // 3 minutes
function autosaveSnapshot(){
  try{const d=collectData();delete d.updatedAt;return JSON.stringify(d);}catch(e){return '';}
}
let lastAutosaveSnapshot=autosaveSnapshot();
setInterval(()=>{
  const snap=autosaveSnapshot();
  if(snap===lastAutosaveSnapshot)return;   // nothing changed since last autosave
  lastAutosaveSnapshot=snap;
  saveLocal(true);
},AUTOSAVE_INTERVAL_MS);
