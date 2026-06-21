// ── Output ─────────────────────────────────────────────────────────────────
// The print/PDF report builder (also wired to the browser's print event) and
// the "clear all" reset.

// ── Comprehensive Print / PDF report ──
function buildPrintReport(){
  const forVal=val('organizedFor').trim()||'—';
  const eventType=$('eventLabel').textContent;
  const dtRaw=val('eventDate');
  const dtStr=dtRaw?new Date(dtRaw).toLocaleString('en-IN',{dateStyle:'full',timeStyle:'short'}):'Date not set';
  const prepared=new Date().toLocaleDateString('en-IN',{dateStyle:'long'});

  // Venue
  const vName=val('venueName')||'—';
  const vAddr=val('venueAddr')||'—';
  const vContact=val('venueContact');
  const vPhone=val('venuePhone');
  const vCost=num('venueCost'), vAdv=num('venueAdv');
  const vBal=Math.max(0,vCost-vAdv);

  // Food
  let foodRows='',fTotal=0,fItems=0,fPlates=0;
  foodEntries().forEach(f=>{
    fTotal+=f.total;
    if(f.name||f.qty||f.price){
      fItems++;fPlates+=f.qty;
      foodRows+=`<tr><td>${esc(f.name||'—')}</td><td>${esc(f.category||'—')}</td><td class="num">${f.qty}</td><td class="num">₹ ${fmt(f.price)}</td><td class="num">₹ ${fmt(f.total)}</td></tr>`;
    }
  });
  const caterer=val('catererName');
  const catererPhone=val('catererPhone');
  const fAdv=num('foodAdv'), fBal=Math.max(0,fTotal-fAdv);

  // Guests — tally, then sort alphabetically for the dedicated guest page.
  let people=0,families=0,invitedHeads=0,rsvpHeads=0,invitedFam=0,rsvpFam=0;
  const guests=guestEntries();
  guests.forEach(g=>{
    people+=g.heads;families++;
    if(g.invited){invitedHeads+=g.heads;invitedFam++;}
    if(g.rsvp){rsvpHeads+=g.heads;rsvpFam++;}
  });
  const sorted=guests.slice().sort((a,b)=>
    (a.name||'￿').toLowerCase().localeCompare((b.name||'￿').toLowerCase()));
  const guestCards=sorted.map((g,i)=>`
    <div class="pr-guest${g.rsvp?' is-rsvp':''}">
      <div class="pg-line"><span class="pg-idx">${String(i+1).padStart(2,'0')}</span><span class="pg-name">${esc(g.name||'—')}</span><span class="pg-party">${g.heads}</span></div>
      <div class="pg-meta">${esc(g.relationship||'—')}${g.reference?' · '+esc(g.reference):''}</div>
      <div class="pg-tags">${g.invited?'<span class="pg-tag inv">Invited</span>':''}${g.rsvp?'<span class="pg-tag rsvp">RSVP ✓</span>':''}</div>
    </div>`).join('');

  const rsvpNotes=val('rsvpNotes');
  const grand=vCost+fTotal;
  const paid=vAdv+fAdv, due=Math.max(0,grand-paid);
  const perHead=people?Math.round(grand/people):0;
  const fin=(label,value,cls='')=>`<div class="pr-row ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
  const stat=(num,lab)=>`<div class="pr-stat"><div class="ps-num">${num}</div><div class="ps-lab">${lab}</div></div>`;

  document.getElementById('printReport').innerHTML=`
    <header class="pr-cover">
      <div class="pr-kicker">Life Events Planner — Event Report</div>
      <h1 class="pr-name">${esc(forVal)}</h1>
      <div class="pr-meta">${esc(eventType)}</div>
      <div class="pr-meta2">${dtStr}</div>
      <div class="pr-prepared">Prepared ${prepared}</div>
    </header>

    <div class="pr-grand">
      <div><div class="pg-label">Grand Total</div><div class="pg-amt">₹ ${fmt(grand)}</div></div>
      <div class="pr-grand-side">
        <div><span>Paid</span><b>₹ ${fmt(paid)}</b></div>
        <div><span>Balance Due</span><b>₹ ${fmt(due)}</b></div>
        <div><span>Cost / Head</span><b>₹ ${fmt(perHead)}</b></div>
      </div>
    </div>

    <div class="pr-cols">
      <section class="pr-card">
        <div class="pr-h">Venue &amp; Booking</div>
        ${fin('Venue',esc(vName))}
        ${fin('Address',esc(vAddr))}
        ${fin('Contact',(esc(vContact||'—'))+(vPhone?' · '+esc(vPhone):''))}
        ${fin('Booking Cost','₹ '+fmt(vCost))}
        ${fin('Advance Paid','₹ '+fmt(vAdv))}
        ${fin('Balance Due','₹ '+fmt(vBal),'strong')}
      </section>
      <section class="pr-card">
        <div class="pr-h">Financial Summary</div>
        ${fin('Venue Cost','₹ '+fmt(vCost))}
        ${fin('Food Cost','₹ '+fmt(fTotal))}
        ${fin('Total Advance Paid','₹ '+fmt(paid))}
        ${fin('Total Balance Due','₹ '+fmt(due))}
        ${fin('Cost per Head','₹ '+fmt(perHead))}
        ${fin('Grand Total','₹ '+fmt(grand),'strong')}
      </section>
    </div>

    <section class="pr-section">
      <div class="pr-h">Food &amp; Catering</div>
      <table class="pr-table"><thead><tr><th>Item</th><th>Category</th><th class="num">Plates</th><th class="num">Per Plate</th><th class="num">Total</th></tr></thead>
      <tbody>${foodRows||'<tr><td colspan="5">No items added</td></tr>'}</tbody>
      <tfoot><tr><td colspan="2">${fItems} item${fItems===1?'':'s'}</td><td class="num">${fPlates}</td><td class="num">Food Total</td><td class="num">₹ ${fmt(fTotal)}</td></tr></tfoot></table>
      ${caterer?`<div class="pr-row" style="margin-top:8px"><span>Caterer</span><strong>${esc(caterer)}${catererPhone?' · '+esc(catererPhone):''}</strong></div>`:''}
    </section>

    <section class="pr-section">
      <div class="pr-h">Guest Overview</div>
      <div class="pr-stats">
        ${stat(families,'Families')}
        ${stat(people,'Total People')}
        ${stat(invitedHeads,'Invited (heads)')}
        ${stat(rsvpHeads,'RSVP Confirmed')}
        ${stat(Math.max(0,people-rsvpHeads),'Est. Plates')}
      </div>
      ${rsvpNotes?`<div class="pr-note"><span>RSVP Notes</span> ${esc(rsvpNotes)}</div>`:''}
    </section>

    <section class="pr-section pr-guestpage">
      <div class="pr-h">Guest List <span class="pr-h-sub">${guests.length} guest${guests.length===1?'':'s'} · ${people} people · alphabetical</span></div>
      ${guestCards?`<div class="pr-guests">${guestCards}</div>`:'<div class="pr-row">No guests added</div>'}
    </section>`;
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
