// ── Guest list filtering & sorting ─────────────────────────────────────────
// Works on the live .guest-item nodes: filters by name/phone/reference,
// relationship and invite/RSVP status, and sorts by any column. Filtering
// hides non-matching rows; sorting reorders the DOM nodes in #guestList.
function guestSortKey(g,by){
  switch(by){
    case 'name':return (g.name||'').toLowerCase();
    case 'relationship':return (g.relationship||'').toLowerCase();
    case 'reference':return (g.reference||'').toLowerCase();
    case 'party':return g.heads;
    case 'invited':return g.invited?1:0;
    case 'rsvp':return g.rsvp?1:0;
    default:return 0;
  }
}
// Per-column filter state. Sort is toggled by clicking column labels.
let gSortBy='', gSortDir=1;
function sortGuests(col){
  if(gSortBy===col){gSortDir*=-1;}else{gSortBy=col;gSortDir=1;}
  document.querySelectorAll('#guestHeader .gh-lab[data-sort]').forEach(h=>{
    const on=h.dataset.sort===col;
    h.classList.toggle('sorted',on);
    h.classList.toggle('desc',on&&gSortDir<0);
  });
  applyGuestFilters();
}
function applyGuestFilters(){
  const list=$('guestList');if(!list)return;
  const q=val('gfSearch').trim().toLowerCase();
  const rel=val('gfRel'), ref=val('gfRef').trim().toLowerCase();
  const inv=val('gfInvite'), rs=val('gfRsvp');
  const rows=guestEntries();

  // Filter — toggle visibility on each row's DOM node.
  let shown=0;
  rows.forEach(g=>{
    let ok=true;
    // Search matches any string across all guest fields.
    if(q)ok=[g.name,g.relationship,g.reference,g.party,
      g.invited?'invited sent':'not invited',g.rsvp?'rsvp yes':'not rsvp']
      .some(v=>String(v||'').toLowerCase().includes(q));
    if(ok&&rel&&rel!=='all')ok=g.relationship===rel;
    if(ok&&ref)ok=(g.reference||'').toLowerCase().includes(ref);
    if(ok&&inv&&inv!=='all')ok=inv==='invited'?g.invited:!g.invited;
    if(ok&&rs&&rs!=='all')ok=rs==='rsvp'?g.rsvp:!g.rsvp;
    g.el.style.display=ok?'':'none';
    if(ok)shown++;
  });

  // Sort — reorder nodes when a sort column is active.
  if(gSortBy){
    rows.slice().sort((a,b)=>{
      const ka=guestSortKey(a,gSortBy),kb=guestSortKey(b,gSortBy);
      return (ka<kb?-1:ka>kb?1:0)*gSortDir;
    }).forEach(g=>list.appendChild(g.el));
    renumberGuests();
  }
  setText('gfCount',shown+' shown');
}
// Keep the relationship filter options in sync with the known relationships.
function buildGuestFilterBar(){
  const sel=$('gfRel');
  if(sel&&sel.children.length<=1)
    sel.innerHTML='<option value="all">Relationship</option>'+
      RELATIONSHIPS.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
}
