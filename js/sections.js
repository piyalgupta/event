// ── Form sections ──────────────────────────────────────────────────────────
// Builders and handlers for the interactive pages: event-type chips, the venue
// map, and the dynamic food and guest rows. These read/write the DOM and lean
// on the helpers in core.js; recalc()/saveLocal() are resolved at call time.

// ── Event Type ──
// The event type is chosen from a dropdown; keep the select, the shared state
// and the summary label in sync. Safe to call with just a label (e.g. when
// restoring saved data) — it reflects the value back onto the <select>.
function setEvent(label){
  currentEvent=label;
  // Keep every event-type picker in sync (the Venue page select and the
  // Invitation Card theme select both carry class "event-select").
  document.querySelectorAll('.event-select').forEach(sel=>{if(sel.value!==label)sel.value=label;});
  setText('eventLabel',label);
  if(typeof renderInvite==='function')renderInvite();   // re-theme the card
  saveLocal();
}

// ── Map ──
function previewMap(){
  const url=val('mapUrl').trim();
  const frame=$('mapFrame'),preview=$('mapPreview');
  if(!url){preview.classList.remove('show');return}
  let src;
  if(url.includes('google.com/maps')){
    if(url.includes('/embed')){src=url}
    else{
      const q=url.includes('@')?url.split('@')[1].split(',').slice(0,2).join(','):encodeURIComponent(url);
      src=mapsEmbed(q);
    }
  } else {
    src=mapsEmbed(encodeURIComponent(url));
  }
  frame.src=src;
  preview.classList.add('show');
}
function updateMap(){
  const addr=val('venueAddr').trim();
  if(addr&&!val('mapUrl')){
    $('mapFrame').src=mapsEmbed(encodeURIComponent(addr),14);
    $('mapPreview').classList.add('show');
  }
}
function openMap(){
  const url=val('mapUrl').trim()||val('venueAddr').trim();
  if(url)window.open(url.startsWith('http')?url:`https://maps.google.com/maps?q=${encodeURIComponent(url)}`,'_blank');
}

// ── Food ──
function addFood(){
  const id=++foodId;
  const div=document.createElement('div');
  div.className='food-item';
  div.id='food'+id;
  div.innerHTML=`
    <div class="row row-3" style="align-items:end">
      <div style="grid-column:1/3">
        <label>Food Item</label>
        <input type="text" placeholder="e.g. Paneer Butter Masala" oninput="recalc()">
      </div>
      <div>
        <label>Category</label>
        <select onchange="recalc()">
          <option>Veg Starter</option><option>Non-Veg Starter</option>
          <option>Veg Main</option><option>Non-Veg Main</option>
          <option>Dessert</option><option>Drinks</option><option>Snacks</option><option>Other</option>
        </select>
      </div>
    </div>
    <div class="row row-3">
      <div>
        <label>Plates / Units</label>
        <input type="number" placeholder="0" min="0" oninput="recalc()">
        <label class="food-sync-lab"><input type="checkbox" class="food-sync" onchange="toggleFoodSync(this)"> Auto-set to guest count</label>
      </div>
      <div><label>Cost per Plate (₹)</label><input type="number" placeholder="0" min="0" oninput="recalc()"></div>
      <div><label>Item Total (₹)</label><input type="number" placeholder="0" readonly style="opacity:.55" id="ftotal${id}"></div>
    </div>
    <div style="display:flex;justify-content:flex-end">
      <button class="remove-btn" onclick="removeItem('food${id}')" aria-label="Remove item"><span class="msi">close</span></button>
    </div>`;
  const [qtyEl,priceEl]=div.querySelectorAll('input[type=number]');
  function calcItem(){
    const t=(parseFloat(qtyEl.value)||0)*(parseFloat(priceEl.value)||0);
    document.getElementById('ftotal'+id).value=t||'';
    recalc();
  }
  qtyEl.oninput=calcItem;priceEl.oninput=calcItem;
  document.getElementById('foodList').appendChild(div);
  recalc();
}
// Per-row "auto-set plates to guest count": lock the quantity field so recalc()
// can drive it from the live head-count.
function toggleFoodSync(chk){
  const q=chk.closest('.food-item').querySelector('input[type=number]');
  q.readOnly=chk.checked;q.style.opacity=chk.checked?'.55':'';
  recalc();
}

// ── Guests ──
const RELATIONSHIPS=['Family','Relatives','Friends','Colleagues','Neighbours','Acquaintances','Other'];
// References start prefilled and grow as new names are typed into any guest's
// Reference field (see rebuildReferenceList, called from recalc()).
const DEFAULT_REFERENCES=['Piyal Gupta','Anulekha Gupta','Rudraksha Gupta','Titas Bandopadhyay'];
function referenceNames(){
  const set=new Set(DEFAULT_REFERENCES);
  document.querySelectorAll('.guest-item .reference').forEach(i=>{const v=i.value.trim();if(v)set.add(v);});
  return [...set];
}
function rebuildReferenceList(){
  const dl=document.getElementById('referenceList');
  if(dl)dl.innerHTML=referenceNames().map(r=>`<option value="${esc(r)}"></option>`).join('');
}
// Render a live count breakdown (chips of label → head-count) into a container.
function renderBreakdown(id,counts,order){
  const el=$(id);if(!el)return;
  let keys=Object.keys(counts);
  if(order)keys=order.filter(k=>counts[k]).concat(keys.filter(k=>!order.includes(k)));
  el.innerHTML=keys.length
    ?keys.map(k=>`<span class="rel-chip"><span class="rc-lab">${esc(k)}</span><span class="rc-num">${counts[k]}</span></span>`).join('')
    :'<span class="rel-empty">No guests yet</span>';
}
function addGuest(){
  const id=++guestId;
  const seq=document.getElementById('guestList').children.length+1;
  const div=document.createElement('div');
  div.className='guest-item';
  div.id='guest'+id;
  const relOpts=RELATIONSHIPS.map(r=>`<option>${r}</option>`).join('');
  div.innerHTML=`
    <div class="guest-num">${String(seq).padStart(2,'0')}</div>
    <div class="guest-name-wrap"><input type="text" id="gname${id}" placeholder="Full name" oninput="recalc()"></div>
    <select class="relationship" onchange="recalc()" aria-label="Relationship">${relOpts}</select>
    <input class="reference" list="referenceList" placeholder="Reference" oninput="recalc()" aria-label="Reference">
    <button type="button" class="invite-toggle" id="inv${id}" onclick="toggleInvite(${id})" aria-label="Invitation sent">
      <span class="track"></span><span class="msi it-icon">mail</span><span class="it-label">Invite</span>
    </button>
    <button type="button" class="invite-toggle rsvp-toggle" id="rsvp${id}" onclick="toggleRsvp(${id})" aria-label="RSVP confirmed">
      <span class="track"></span><span class="msi it-icon">event_available</span><span class="it-label">RSVP</span>
    </button>
    <div class="spinner-wrap">
      <span class="spin-label">Party</span>
      <div class="spinner">
        <button class="spin-btn" onclick="spin('sv${id}',-1)" aria-label="Decrease party size">−</button>
        <div class="spin-val" id="sv${id}">1</div>
        <button class="spin-btn" onclick="spin('sv${id}',1)" aria-label="Increase party size">+</button>
      </div>
    </div>
    <button class="remove-btn" onclick="removeGuest('guest${id}')" aria-label="Remove guest"><span class="msi">close</span></button>`;
  document.getElementById('guestList').appendChild(div);
  recalc();
}
function toggleInvite(id){
  const btn=document.getElementById('inv'+id);
  const name=document.getElementById('gname'+id);
  const on=btn.classList.toggle('on');
  if(name)name.classList.toggle('invited',on);
  recalc();
}
function toggleRsvp(id){
  const on=document.getElementById('rsvp'+id).classList.toggle('on');
  lockGuestRow(id,on);
  recalc();
}
// Once a guest has RSVP'd their details are settled — lock the whole row
// (except the RSVP toggle itself, so it can be switched back off).
function lockGuestRow(id,locked){
  const gi=document.getElementById('guest'+id);if(!gi)return;
  gi.classList.toggle('rsvp-locked',locked);
  gi.querySelectorAll('input,select,button').forEach(el=>{
    if(el.id==='rsvp'+id||el.closest('#rsvp'+id))return;   // keep the RSVP toggle live
    el.disabled=locked;
  });
}
function spin(id,d){
  const el=$(id);
  let v=parseInt(el.textContent)+d;
  if(v<PARTY_MIN)v=PARTY_MIN;if(v>PARTY_MAX)v=PARTY_MAX;
  el.textContent=v;
  el.style.transform='scale(1.35)';el.style.color='var(--accent)';
  setTimeout(()=>{el.style.transform='';el.style.color='';},200);
  recalc();
}
function removeGuest(id){
  document.getElementById(id).style.animation='fadeOut .2s ease forwards';
  setTimeout(()=>{
    const el=document.getElementById(id);if(el)el.remove();
    renumberGuests();recalc();
  },200);
}
function renumberGuests(){
  document.querySelectorAll('.guest-item .guest-num').forEach((el,i)=>{
    el.textContent=String(i+1).padStart(2,'0');
  });
}
function removeItem(id){
  const el=document.getElementById(id);
  if(el){el.style.opacity='0';el.style.transform='scale(.97)';el.style.transition='all .2s';
    setTimeout(()=>{el.remove();recalc();},200);}
}
// WhatsApp invites now live in their own module — see js/whatsapp.js.
