// ── Output ─────────────────────────────────────────────────────────────────
// The print/PDF report builder (also wired to the browser's print event) and
// the "clear all" reset.

// ── Comprehensive Print / PDF report ──
function buildPrintReport(){
  const forVal=val('organizedFor').trim()||'—';
  const eventType=$('eventLabel').textContent;
  const dtRaw=val('eventDate');
  const dtStr=dtRaw?new Date(dtRaw).toLocaleString('en-IN',{dateStyle:'full',timeStyle:'short'}):'Date not set';

  const vName=val('venueName')||'—';
  const vAddr=val('venueAddr')||'—';
  const vContact=val('venueContact');
  const vPhone=val('venuePhone');
  const vCost=num('venueCost'), vAdv=num('venueAdv');
  const vBal=Math.max(0,vCost-vAdv);

  let foodRows='',fTotal=0;
  foodEntries().forEach(f=>{
    fTotal+=f.total;
    if(f.name||f.qty||f.price)
      foodRows+=`<tr><td>${esc(f.name||'—')}</td><td>${esc(f.category||'—')}</td><td>${f.qty}</td><td>₹ ${fmt(f.price)}</td><td>₹ ${fmt(f.total)}</td></tr>`;
  });
  const caterer=val('catererName');
  const catererPhone=val('catererPhone');

  let guestRows='',people=0,families=0,invitedHeads=0;
  guestEntries().forEach(g=>{
    people+=g.heads;families++;
    if(g.invited)invitedHeads+=g.heads;
    guestRows+=`<tr><td>${esc(g.honorific?g.honorific+' ':'')}${esc(g.name||'—')}</td><td>${g.heads}</td><td>${g.invited?'Yes':'No'}</td></tr>`;
  });
  const rsvp=val('rsvpNotes');
  const grand=vCost+fTotal;

  document.getElementById('printReport').innerHTML=`
    <div class="pr-section">
      <div class="pr-title">${esc(forVal)}</div>
      <div class="pr-sub">${esc(eventType)} · ${dtStr} · Prepared ${new Date().toLocaleDateString('en-IN',{dateStyle:'medium'})}</div>
    </div>
    <div class="pr-section">
      <div class="pr-h">Venue &amp; Booking</div>
      <div class="pr-row"><span>Venue</span><strong>${esc(vName)}</strong></div>
      <div class="pr-row"><span>Address</span><strong>${esc(vAddr)}</strong></div>
      <div class="pr-row"><span>Contact</span><strong>${esc(vContact||'—')}${vPhone?' · '+esc(vPhone):''}</strong></div>
      <div class="pr-row"><span>Booking Cost</span><strong>₹ ${fmt(vCost)}</strong></div>
      <div class="pr-row"><span>Advance Paid</span><strong>₹ ${fmt(vAdv)}</strong></div>
      <div class="pr-row"><span>Balance Due</span><strong>₹ ${fmt(vBal)}</strong></div>
    </div>
    <div class="pr-section">
      <div class="pr-h">Food &amp; Catering</div>
      <table class="pr-table"><thead><tr><th>Item</th><th>Category</th><th>Plates</th><th>Per Plate</th><th>Total</th></tr></thead>
      <tbody>${foodRows||'<tr><td colspan="5">No items added</td></tr>'}</tbody></table>
      ${caterer?`<div class="pr-row" style="margin-top:8px"><span>Caterer</span><strong>${esc(caterer)}${catererPhone?' · '+esc(catererPhone):''}</strong></div>`:''}
      <div class="pr-row"><span>Food Total</span><strong>₹ ${fmt(fTotal)}</strong></div>
    </div>
    <div class="pr-section">
      <div class="pr-h">Guest List</div>
      <table class="pr-table"><thead><tr><th>Name</th><th>Party Size</th><th>Invited</th></tr></thead>
      <tbody>${guestRows||'<tr><td colspan="3">No guests added</td></tr>'}</tbody></table>
      ${rsvp?`<div class="pr-row" style="margin-top:8px"><span>RSVP Notes</span><strong>${esc(rsvp)}</strong></div>`:''}
    </div>
    <div class="pr-section">
      <div class="pr-h">Summary</div>
      <div class="pr-row"><span>Families</span><strong>${families}</strong></div>
      <div class="pr-row"><span>Total People</span><strong>${people}</strong></div>
      <div class="pr-row"><span>Invitation Sent For</span><strong>${invitedHeads} heads</strong></div>
      <div class="pr-row"><span>Est. Plates</span><strong>${people}</strong></div>
      <div class="pr-row"><span>Venue Cost</span><strong>₹ ${fmt(vCost)}</strong></div>
      <div class="pr-row"><span>Food Cost</span><strong>₹ ${fmt(fTotal)}</strong></div>
      <div class="pr-total">Grand Total — ₹ ${fmt(grand)}</div>
    </div>`;
}
window.addEventListener('beforeprint',buildPrintReport);

// ── Clear All ──
function clearAll(){
  if(!confirm('Clear all event data?'))return;
  document.querySelectorAll('input,textarea,select').forEach(el=>{
    if(!el.readOnly&&el.type!=='button')el.value='';
  });
  $('foodList').innerHTML='';
  $('guestList').innerHTML='';
  $('mapPreview').classList.remove('show');
  localStorage.removeItem(STORAGE_KEY);
  foodId=0;guestId=0;recalc();
}
