// ── Recalculation engine ───────────────────────────────────────────────────
// Single pass over the venue/food/guest state that refreshes every derived
// figure (badges, totals, summary) and then autosaves. Called by every input
// handler in the form sections.
function recalc(){
  setText('forLabel', val('organizedFor').trim()||'—');

  const vCost=num('venueCost'), vAdv=num('venueAdv');
  setVal('venueBal', Math.max(0,vCost-vAdv)||'');
  setText('venueCostBadge', inr(vCost));

  // Guests — families, total heads and invited heads in a single pass, plus
  // live head-count breakdowns by relationship and by reference.
  let families=0,people=0,invited=0;
  const relCount={},refCount={};
  guestEntries().forEach(g=>{
    if(g.hasSpin){people+=g.heads;families++;}
    if(g.invited)invited+=g.heads;
    const rel=g.relationship||'Other';
    relCount[rel]=(relCount[rel]||0)+g.heads;
    const ref=(g.reference||'').trim()||'Unassigned';
    refCount[ref]=(refCount[ref]||0)+g.heads;
  });
  setText('gTotalFamilies',families);
  setText('gTotalPeople',people);
  setText('gInvited',invited);
  setText('gTotalPlates',people);
  setText('guestBadge',people+' people');
  renderBreakdown('relBreakdown',relCount,RELATIONSHIPS);
  renderBreakdown('refBreakdown',refCount);
  rebuildReferenceList();
  if(typeof waBuildList==='function')waBuildList();

  // Food — when "sync plates" is on each row tracks the guest head-count;
  // the per-row line total is written back so the live cost stays in sync.
  let fTotal=0,plates=0,items=0;
  foodEntries().forEach(f=>{
    if(syncPlates)f.qtyEl.value=people||'';
    const qty=parseFloat(f.qtyEl.value)||0, total=qty*f.price;
    if(f.totalEl)f.totalEl.value=total||'';
    fTotal+=total;plates+=qty;
    if(f.qtyEl.value||f.priceRaw)items++;
  });
  setText('foodTotal',inr(fTotal));
  setText('foodCostBadge',inr(fTotal));
  setText('foodBreakdown',`${items} items · ${plates} plates`);
  const fAdv=num('foodAdv');
  setVal('foodBal', Math.max(0,fTotal-fAdv)||'');

  const grand=vCost+fTotal;
  setText('sumVenue',inr(vCost));
  setText('sumFood',inr(fTotal));
  setText('sumGuests',people+' people ('+families+' families)');
  setText('grandTotal',inr(grand));
  saveLocal();
}
