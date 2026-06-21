// ── Core foundation ────────────────────────────────────────────────────────
// Config, shared state, DOM/formatting helpers and the row readers. Loaded
// first; every other module builds on the helpers defined here.

// ── Config ───────────────────────────────────────────────────────────────
// Every storage key, id prefix and timing lives here instead of being
// sprinkled through the file as magic literals.
const STORAGE_KEY='lifeEventsData';   // localStorage key for the event payload
const TOKEN_KEY='ghPAT';              // localStorage key for the GitHub token
const FOOD_ID_PREFIX='food';          // food rows use id="food<n>" + "ftotal<n>"
const PARTY_MIN=1, PARTY_MAX=10;      // clamp for the per-guest party spinner
const SAVE_DEBOUNCE_MS=300;           // debounce before writing to localStorage
const GH_PUSH_DEBOUNCE_MS=1500;       // debounce before pushing to GitHub
const GH_SUPPRESS_MS=2500;            // ignore pushes briefly after a remote pull

// ── State ──
let foodId=0,guestId=0,currentEvent='Birthday',syncPlates=false;

// ── DOM / formatting helpers (defined once, reused everywhere) ─────────────
const $=id=>document.getElementById(id);
const $$=sel=>document.querySelectorAll(sel);
const val=id=>$(id)?.value||'';
const num=id=>parseFloat($(id)?.value)||0;
const setVal=(id,v)=>{const el=$(id);if(el&&v!==undefined)el.value=v;};
const setText=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
const fmt=n=>n.toLocaleString('en-IN',{maximumFractionDigits:0});
const inr=n=>'₹ '+fmt(n);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const mapsEmbed=(q,z=15)=>`https://maps.google.com/maps?q=${q}&output=embed&z=${z}`;

// ── Row readers ────────────────────────────────────────────────────────────
// Turn one food/guest DOM node into a plain record. recalc(), collectData()
// and buildPrintReport() all read through these, so the brittle "where is this
// field in the markup" knowledge lives in exactly one place.
function readFoodItem(fi){
  const nums=fi.querySelectorAll('input[type=number]');
  const qty=parseFloat(nums[0].value)||0, price=parseFloat(nums[1].value)||0;
  return{
    el:fi,
    name:fi.querySelector('input[type=text]')?.value||'',
    category:fi.querySelector('select')?.value||'',
    qtyEl:nums[0], priceEl:nums[1],
    qtyRaw:nums[0].value, priceRaw:nums[1].value,
    qty, price, total:qty*price,
    totalEl:$('ftotal'+fi.id.replace(FOOD_ID_PREFIX,''))
  };
}
function readGuest(gi){
  const sv=gi.querySelector('.spin-val');
  return{
    el:gi,
    honorific:gi.querySelector('.honorific')?.value||'',
    name:gi.querySelector('.guest-name-wrap input')?.value||'',
    phone:gi.querySelector('.guest-phone')?.value||'',
    relationship:gi.querySelector('.relationship')?.value||'',
    reference:gi.querySelector('.reference')?.value||'',
    invited:!!gi.querySelector('.invite-toggle:not(.rsvp-toggle).on'),
    rsvp:!!gi.querySelector('.rsvp-toggle.on'),
    party:(sv?.textContent)||'1',
    heads:sv?(parseInt(sv.textContent)||1):1,
    hasSpin:!!sv
  };
}
const foodEntries=()=>[...$$('.food-item')].map(readFoodItem);
const guestEntries=()=>[...$$('.guest-item')].map(readGuest);
