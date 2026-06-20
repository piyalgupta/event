// ── Form sections ──────────────────────────────────────────────────────────
// Builders and handlers for the interactive pages: event-type chips, the venue
// map, and the dynamic food and guest rows. These read/write the DOM and lean
// on the helpers in core.js; recalc()/saveLocal() are resolved at call time.

// ── Event Type ──
function toggleSyncPlates(checked){
  syncPlates=checked;
  document.querySelectorAll('.food-item').forEach(fi=>{
    const q=fi.querySelectorAll('input[type=number]')[0];
    q.readOnly=checked;q.style.opacity=checked?'.55':'';
  });
  recalc();
}
function setEvent(btn,label){
  document.querySelectorAll('.event-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  currentEvent=label;
  document.getElementById('eventLabel').textContent=label;
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
      <div><label>Plates / Units</label><input type="number" placeholder="0" min="0" oninput="recalc()"></div>
      <div><label>Cost per Plate (₹)</label><input type="number" placeholder="0" min="0" oninput="recalc()"></div>
      <div><label>Item Total (₹)</label><input type="number" placeholder="0" readonly style="opacity:.55" id="ftotal${id}"></div>
    </div>
    <div style="display:flex;justify-content:flex-end">
      <button class="remove-btn" onclick="removeItem('food${id}')">Remove</button>
    </div>`;
  const [qtyEl,priceEl]=div.querySelectorAll('input[type=number]');
  function calcItem(){
    const t=(parseFloat(qtyEl.value)||0)*(parseFloat(priceEl.value)||0);
    document.getElementById('ftotal'+id).value=t||'';
    recalc();
  }
  qtyEl.oninput=calcItem;priceEl.oninput=calcItem;
  if(syncPlates){qtyEl.readOnly=true;qtyEl.style.opacity='.55';}
  document.getElementById('foodList').appendChild(div);
  recalc();
}

// ── Guests ──
const HONORIFICS=['Mr.','Mrs.','Ms.','Dr.','Prof.','Shri','Smt.','Master','Miss','Rev.'];
function addGuest(){
  const id=++guestId;
  const num=document.getElementById('guestList').children.length+1;
  const div=document.createElement('div');
  div.className='guest-item';
  div.id='guest'+id;
  const opts=HONORIFICS.map(h=>`<option>${h}</option>`).join('');
  div.innerHTML=`
    <div class="guest-num">${String(num).padStart(2,'0')}</div>
    <select class="honorific" onchange="recalc()">${opts}</select>
    <div class="guest-name-wrap"><input type="text" id="gname${id}" placeholder="Full name" oninput="recalc()"></div>
    <button type="button" class="invite-toggle" id="inv${id}" onclick="toggleInvite(${id})">
      <span class="track"></span><span class="it-label">Invited</span>
    </button>
    <div class="spinner-wrap">
      <span class="spin-label">Party</span>
      <div class="spinner">
        <button class="spin-btn" onclick="spin('sv${id}',-1)" aria-label="Decrease party size">−</button>
        <div class="spin-val" id="sv${id}">1</div>
        <button class="spin-btn" onclick="spin('sv${id}',1)" aria-label="Increase party size">+</button>
      </div>
    </div>
    <button class="remove-btn" onclick="removeGuest('guest${id}')" aria-label="Remove guest">Remove</button>`;
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
