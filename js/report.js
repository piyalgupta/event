// ── Output ─────────────────────────────────────────────────────────────────
// The print/PDF report builder (also wired to the browser's print event) and
// the "clear all" reset.

// ── Two-page Print / PDF report ──
// Page 1 is the full analytics dashboard; page 2 is a plain, alphabetical roll
// of guest names with their party size (no cards).
function buildPrintReport(){
  const forVal=val('organizedFor').trim()||'—';
  const eventType=$('eventLabel').textContent;
  const dtRaw=val('eventDate');
  const dtStr=dtRaw?new Date(dtRaw).toLocaleString('en-IN',{dateStyle:'full',timeStyle:'short'}):'Date not set';
  const prepared=new Date().toLocaleDateString('en-IN',{dateStyle:'long'});

  // Page 1 — re-render the dashboard so the print copy is current, then lift
  // the generated markup straight out of the live dashboard host.
  if(typeof renderDashboard==='function')renderDashboard();
  const dashHTML=($('dashGrid')||{}).innerHTML||'<div class="pr-row">No dashboard data</div>';

  // Page 2 — tally heads, then sort alphabetically for the plain name list.
  let people=0;
  const guests=guestEntries();
  guests.forEach(g=>{people+=g.heads;});
  const sorted=guests.slice().sort((a,b)=>
    (a.name||'￿').toLowerCase().localeCompare((b.name||'￿').toLowerCase()));
  const nameRows=sorted.map((g,i)=>`
    <li class="pr-nl-row"><span class="nl-idx">${String(i+1).padStart(2,'0')}</span><span class="nl-name">${esc(g.name||'—')}</span><span class="nl-party">${g.heads}</span></li>`).join('');

  document.getElementById('printReport').innerHTML=`
    <header class="pr-cover">
      <div class="pr-kicker">Life Events Planner — Event Report</div>
      <h1 class="pr-name">${esc(forVal)}</h1>
      <div class="pr-meta">${esc(eventType)}</div>
      <div class="pr-meta2">${dtStr}</div>
      <div class="pr-prepared">Prepared ${prepared}</div>
    </header>

    <section class="pr-section pr-dashpage">
      <div class="pr-h">Analytics Dashboard <span class="pr-h-sub">Cost &amp; guest insights</span></div>
      <div class="pr-dash">${dashHTML}</div>
    </section>

    <section class="pr-section pr-guestpage">
      <div class="pr-h">Guest List <span class="pr-h-sub">${guests.length} guest${guests.length===1?'':'s'} · ${people} people · alphabetical</span></div>
      <ol class="pr-namelist">
        <li class="pr-nl-head"><span class="nl-idx">#</span><span class="nl-name">Name</span><span class="nl-party">Party</span></li>
        ${nameRows||'<li class="pr-nl-row"><span class="nl-name">No guests added</span></li>'}
      </ol>
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
