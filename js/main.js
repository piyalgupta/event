// ── Bootstrap ──────────────────────────────────────────────────────────────
// Runs last, after every other module has defined its functions. Wires up page
// navigation, restores saved data/token, and installs the autosave safety net.

// ── Page navigation : nav dots + counter + reveal-on-view ──
const pages=[...document.querySelectorAll('.page')];
const dots=[...document.querySelectorAll('.page-nav button')];
const counter=document.getElementById('pageCounter');
const pageCountLabel=String(pages.length).padStart(2,'0');
dots.forEach(d=>d.addEventListener('click',()=>{
  pages[+d.dataset.i].scrollIntoView({behavior:'smooth'});
}));
const io=new IntersectionObserver((entries)=>{
  entries.forEach(en=>{
    if(en.isIntersecting){
      const i=pages.indexOf(en.target);
      dots.forEach(d=>d.classList.toggle('active',+d.dataset.i===i));
      counter.textContent=String(i+1).padStart(2,'0')+' — '+pageCountLabel;
      en.target.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'));
    }
  });
},{threshold:.5});
pages.forEach(p=>io.observe(p));

// fadeOut keyframe (guest removal)
const s=document.createElement('style');
s.textContent='@keyframes fadeOut{to{opacity:0;transform:translateY(-6px)}}';
document.head.appendChild(s);

// ── Init ──
const saved=loadLocal();
if(saved){applyData(saved);}
else{addFood();addFood();addGuest();addGuest();addGuest();recalc();}
document.querySelectorAll('#p0 .reveal').forEach(el=>el.classList.add('in'));

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
