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
      <button class="remove-btn" onclick="removeItem('food${id}')" aria-label="Remove item"><span class="msi">close</span></button>
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
  const opts=HONORIFICS.map(h=>`<option>${h}</option>`).join('');
  const relOpts=RELATIONSHIPS.map(r=>`<option>${r}</option>`).join('');
  div.innerHTML=`
    <div class="guest-num">${String(seq).padStart(2,'0')}</div>
    <select class="honorific" onchange="recalc()">${opts}</select>
    <div class="guest-name-wrap"><input type="text" id="gname${id}" placeholder="Full name" oninput="recalc()"></div>
    <input class="guest-phone" type="tel" id="gphone${id}" placeholder="Phone / WhatsApp" oninput="recalc()" aria-label="Phone number">
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
  document.getElementById('rsvp'+id).classList.toggle('on');
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

// ── WhatsApp invites ────────────────────────────────────────────────────────
// No-backend "click to chat": one wa.me link per guest, prefilled with the
// message (and the image URL, which WhatsApp renders as a link preview). True
// file attachments to many numbers need the WhatsApp Business API (see README).
function waNormalize(raw){
  let d=String(raw||'').replace(/[^\d+]/g,'').replace(/^\+/,'').replace(/^0+/,'');
  if(!d)return '';
  const cc=(val('waCC')||'91').replace(/\D/g,'')||'91';
  if(d.length<=10)d=cc+d;                 // bare local number → prefix country code
  return d;
}
function waCompose(name){
  let m=(val('waMsg')||'').replace(/\{name\}/gi,(name||'').trim());
  const img=val('waImage').trim();
  if(img)m=(m?m+'\n\n':'')+img;
  return encodeURIComponent(m);
}
function waLink(g){return`https://wa.me/${waNormalize(g.phone)}?text=${waCompose(g.name)}`;}
function waBuildList(){
  const wrap=$('waList');if(!wrap)return;
  const gs=guestEntries().filter(g=>waNormalize(g.phone));
  setText('waCount',gs.length+' with phone');
  wrap.innerHTML=gs.length
    ?gs.map(g=>`<a class="wa-link" target="_blank" rel="noopener" href="${waLink(g)}"><span class="msi">chat</span>${esc((g.name||'').trim()||g.phone)}</a>`).join('')
    :'<span class="rel-empty">Add a phone number to a guest to message them here.</span>';
}
function waSendAll(){
  const gs=guestEntries().filter(g=>waNormalize(g.phone));
  if(!gs.length){alert('No guest has a phone number yet. Add phone numbers first.');return;}
  if(!val('waMsg').trim()&&!val('waImage').trim()){alert('Type a message (and an optional image link) first.');return;}
  if(!confirm('Open WhatsApp for '+gs.length+' guest(s)? Your browser may ask to allow pop-ups — then send each chat. Or tap names below one by one.'))return;
  gs.forEach((g,i)=>setTimeout(()=>window.open(waLink(g),'_blank'),i*700));
  setText('waCount',gs.length+' opening…');
}
// Export every guest-with-phone as a phone-contacts file (.vcf). Import it into
// your phone, then a WhatsApp Broadcast List sends a real image to all — free.
function exportContacts(){
  const gs=guestEntries().filter(g=>waNormalize(g.phone));
  if(!gs.length){alert('No guest has a phone number yet. Add phone numbers first.');return;}
  const org=(val('organizedFor')||'Event').trim();
  const v=s=>String(s).replace(/[\\,;]/g,m=>'\\'+m);
  const vcf=gs.map(g=>{
    const name=((g.honorific?g.honorific+' ':'')+(g.name||'').trim()).trim()||('+'+waNormalize(g.phone));
    return ['BEGIN:VCARD','VERSION:3.0','N:'+v(name)+';;;;','FN:'+v(name),'ORG:'+v(org),
      'TEL;TYPE=CELL:+'+waNormalize(g.phone),'END:VCARD'].join('\r\n');
  }).join('\r\n')+'\r\n';
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([vcf],{type:'text/vcard'}));
  a.download=(org.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'event')+'-contacts.vcf';
  a.click();URL.revokeObjectURL(a.href);
  setText('waCount',gs.length+' contacts saved');
}
// Message a single, manually-typed number (not necessarily a saved guest).
function waSendOne(){
  const n=waNormalize(val('waOne'));
  if(!n){alert('Enter a valid phone number first.');return;}
  if(!val('waMsg').trim()&&!val('waImage').trim()){alert('Type a message (and an optional image link) first.');return;}
  window.open(`https://wa.me/${n}?text=${waCompose('')}`,'_blank');
}
