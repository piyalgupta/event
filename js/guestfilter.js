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
function applyGuestFilters(){
  const list=$('guestList');if(!list)return;
  const q=(val('gfSearch')).trim().toLowerCase();
  const rel=val('gfRel'), status=val('gfStatus');
  const by=val('gfSort'), dir=val('gfDir')==='desc'?-1:1;
  const rows=guestEntries();

  // Filter — toggle visibility on each row's DOM node.
  let shown=0;
  rows.forEach(g=>{
    let ok=true;
    if(q)ok=[g.name,g.reference].some(v=>(v||'').toLowerCase().includes(q));
    if(ok&&rel&&rel!=='all')ok=g.relationship===rel;
    if(ok&&status&&status!=='all'){
      ok=status==='invited'?g.invited:status==='notinvited'?!g.invited
        :status==='rsvp'?g.rsvp:status==='notrsvp'?!g.rsvp:true;
    }
    g.el.style.display=ok?'':'none';
    if(ok)shown++;
  });

  // Sort — reorder nodes when a sort column is chosen.
  if(by&&by!=='none'){
    rows.slice().sort((a,b)=>{
      const ka=guestSortKey(a,by),kb=guestSortKey(b,by);
      return (ka<kb?-1:ka>kb?1:0)*dir;
    }).forEach(g=>list.appendChild(g.el));
    renumberGuests();
  }
  setText('gfCount',shown+' shown');
}
// Keep the relationship filter options in sync with the known relationships.
function buildGuestFilterBar(){
  const sel=$('gfRel');
  if(sel&&sel.children.length<=1)
    sel.innerHTML='<option value="all">All relationships</option>'+
      RELATIONSHIPS.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
}
