// ── Dashboard ───────────────────────────────────────────────────────────────
// A read-only analytics view built on the same venue/food/guest model. Pure,
// dependency-free SVG/CSS charts (no libraries, runs from file://) that slice
// the data from several angles: cost split, food categories, payment progress,
// and guest classifications. Re-rendered from recalc(); never writes back.
// Borrows the helpers ($, num, esc, inr, foodEntries, guestEntries) from core.js.

// A calm, green-forward categorical palette — emerald/teal/cool tones lead,
// warm hues used sparingly; no loud chartreuse. Reads cohesive in both themes.
const DASH_COLORS=['#0a9d52','#15b8a6','#3b82f6','#6366f1','#0e7a6b','#ed7d3a','#ef2d56','#8e8e93','#a78bfa','#f5a623'];

// One pass over the form state, returning every figure the charts need.
function dashData(){
  let fTotal=0,plates=0;const cat={};
  foodEntries().forEach(f=>{
    const qty=parseFloat(f.qtyEl.value)||0,t=qty*f.price;
    fTotal+=t;plates+=qty;
    if(t)cat[f.category||'Other']=(cat[f.category||'Other']||0)+t;
  });
  let people=0,families=0,invited=0,rsvp=0;
  const rel={},ref={},party={};
  guestEntries().forEach(g=>{
    people+=g.heads;families++;
    if(g.invited)invited+=g.heads;
    if(g.rsvp)rsvp+=g.heads;
    rel[g.relationship||'Other']=(rel[g.relationship||'Other']||0)+g.heads;
    const r=(g.reference||'').trim()||'Unassigned';ref[r]=(ref[r]||0)+g.heads;
    party[g.party]=(party[g.party]||0)+1;
  });
  const vCost=num('venueCost');
  return{vCost,fTotal,vAdv:num('venueAdv'),fAdv:num('foodAdv'),grand:vCost+fTotal,
    plates,cat,people,families,invited,rsvp,rel,ref,party};
}

// ── Chart primitives (return HTML strings) ──
const dashSorted=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
const dashCard=(title,body)=>`<div class="dash-card"><div class="dash-card-h">${esc(title)}</div>${body}</div>`;
const dashKpi=(label,value,sub)=>`<div class="dash-kpi"><div class="dk-val">${esc(String(value))}</div><div class="dk-lab">${esc(label)}</div>${sub?`<div class="dk-sub">${esc(sub)}</div>`:''}</div>`;

// Horizontal bars; pass a formatter (e.g. inr) for the value column.
function dashBars(entries,fmtFn){
  if(!entries.length)return'<div class="dash-empty">No data yet.</div>';
  const f=fmtFn||String,max=Math.max(...entries.map(e=>e[1]),1);
  return'<div class="dash-bars">'+entries.map(([lab,v],i)=>{
    const pct=Math.max(2,Math.round(v/max*100)),c=DASH_COLORS[i%DASH_COLORS.length];
    return`<div class="db-row"><div class="db-lab" title="${esc(lab)}">${esc(lab)}</div>`+
      `<div class="db-track"><div class="db-fill" style="width:${pct}%;background:${c}"></div></div>`+
      `<div class="db-val">${esc(f(v))}</div></div>`;
  }).join('')+'</div>';
}

// SVG donut with a centred total and a colour legend.
function dashDonut(segments){
  const live=segments.filter(s=>s.value>0),total=live.reduce((s,x)=>s+x.value,0);
  if(!total)return'<div class="dash-empty">Add a cost to see the split.</div>';
  const r=54,circ=2*Math.PI*r;let off=0;
  const ring=live.map(s=>{
    const len=s.value/total*circ;
    const seg=`<circle r="${r}" cx="80" cy="80" fill="none" stroke="${s.color}" stroke-width="22" stroke-dasharray="${len.toFixed(2)} ${(circ-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 80 80)"/>`;
    off+=len;return seg;
  }).join('');
  const legend=live.map(s=>`<div class="dl-item"><span class="dl-dot" style="background:${s.color}"></span>${esc(s.label)} <b>${inr(s.value)}</b> · ${Math.round(s.value/total*100)}%</div>`).join('');
  return`<div class="dash-donut"><svg viewBox="0 0 160 160" width="150" height="150" aria-hidden="true">${ring}`+
    `<text x="80" y="78" text-anchor="middle" class="dn-top">${inr(total)}</text>`+
    `<text x="80" y="95" text-anchor="middle" class="dn-bot">TOTAL</text></svg>`+
    `<div class="dash-legend">${legend}</div></div>`;
}

// A single paid-vs-due progress bar.
function dashProgress(paid,total){
  const pct=total?Math.min(100,Math.round(paid/total*100)):0;
  return`<div class="dash-progress"><div class="dp-track"><div class="dp-fill" style="width:${pct}%"></div></div>`+
    `<div class="dp-meta"><span>Paid ${inr(paid)}</span><span>${pct}%</span><span>Due ${inr(Math.max(0,total-paid))}</span></div></div>`;
}

// ── Render ──
function renderDashboard(){
  const host=$('dashGrid');if(!host)return;
  const d=dashData();
  const perHead=d.people?Math.round(d.grand/d.people):0;
  const perFamily=d.families?Math.round(d.grand/d.families):0;
  const paid=d.vAdv+d.fAdv;
  const partyRows=Object.keys(d.party).sort((a,b)=>(+a)-(+b))
    .map(k=>[k+(k==='1'?' guest':' guests'),d.party[k]]);

  host.innerHTML=
   '<div class="dash-kpis">'+
     dashKpi('Grand Total',inr(d.grand))+
     dashKpi('Cost / Head',inr(perHead),d.people+' people')+
     dashKpi('Cost / Family',inr(perFamily),d.families+' families')+
     dashKpi('Invited',d.invited+' heads',d.people?Math.round(d.invited/d.people*100)+'% of guests':'')+
     dashKpi('RSVP Confirmed',d.rsvp+' heads',d.invited?Math.round(d.rsvp/Math.max(1,d.invited)*100)+'% of invited':'')+
     dashKpi('Food Plates',d.plates,inr(d.fTotal)+' total')+
   '</div>'+
   '<div class="dash-grid">'+
     dashCard('Cost Split — Venue vs Food',dashDonut([
       {label:'Venue',value:d.vCost,color:DASH_COLORS[0]},
       {label:'Food',value:d.fTotal,color:DASH_COLORS[1]}]))+
     dashCard('Food Cost by Category',dashBars(dashSorted(d.cat),inr))+
     dashCard('Payment Progress',dashProgress(paid,d.grand)+dashBars([
       ['Venue paid',d.vAdv],['Venue due',Math.max(0,d.vCost-d.vAdv)],
       ['Food paid',d.fAdv],['Food due',Math.max(0,d.fTotal-d.fAdv)]],inr))+
     dashCard('Guests by Relationship',dashBars(dashSorted(d.rel)))+
     dashCard('Guests by Reference',dashBars(dashSorted(d.ref)))+
     dashCard('Invitation & RSVP (heads)',dashBars([
       ['Total guests',d.people],['Invited',d.invited],['RSVP confirmed',d.rsvp]]))+
     dashCard('Families by Party Size',dashBars(partyRows))+
   '</div>';
}
