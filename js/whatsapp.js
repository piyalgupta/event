// ── WhatsApp invites ────────────────────────────────────────────────────────
// Self-contained, no-backend module: build wa.me "click to chat" links — one
// per guest — pre-filled with your message and an optional image link (WhatsApp
// renders it as a preview). Real file-attachments to many numbers need the paid
// WhatsApp Business / Meta Cloud API; see README.
// Borrows the DOM/format helpers ($, val, setText, esc, guestEntries) defined
// in core.js, so it must load after it.

const WA_DEFAULT_SENDER='919874174100';   // default "from" number (+91 98741 74100)

// A phone number reduced to digits, with the country code prefixed when it is a
// bare local number. Returns '' for anything without digits.
function waDigits(raw){
  let d=String(raw||'').replace(/\D/g,'').replace(/^0+/,'');
  if(!d)return'';
  const cc=(val('waCC')||'91').replace(/\D/g,'')||'91';
  return d.length<=10?cc+d:d;
}
// The shared message, personalised per guest, with the image link appended.
function waText(name){
  let m=(val('waMsg')||'').replace(/\{name\}/gi,(name||'').trim());
  const img=(val('waImage')||'').trim();
  if(img)m=(m?m+'\n\n':'')+img;
  return encodeURIComponent(m);
}
// One click-to-chat URL for a number (+ optional guest name for {name}).
const waUrl=(phone,name)=>`https://wa.me/${waDigits(phone)}?text=${waText(name)}`;
const waOpen=(phone,name)=>window.open(waUrl(phone,name),'_blank');
// Every guest that has a usable phone number.
const waGuests=()=>guestEntries().filter(g=>waDigits(g.phone));
// Guard: a message (or image) is required before anything is sent.
function waHasMessage(){
  if(val('waMsg').trim()||val('waImage').trim())return true;
  alert('Type a message (and an optional image link) first.');
  return false;
}

// Render the tappable per-guest chip list and the "with phone" count.
function waBuildList(){
  const wrap=$('waList');if(!wrap)return;
  const gs=waGuests();
  setText('waCount',gs.length+' with phone');
  wrap.innerHTML=gs.length
    ?gs.map(g=>`<a class="wa-link" target="_blank" rel="noopener" href="${waUrl(g.phone,g.name)}"><span class="msi">chat</span>${esc((g.name||'').trim()||g.phone)}</a>`).join('')
    :'<span class="rel-empty">Add a phone number to a guest to message them here.</span>';
}
// Open a pre-filled chat for every guest, staggered so pop-up blockers cope.
function waSendAll(){
  const gs=waGuests();
  if(!gs.length)return alert('No guest has a phone number yet. Add phone numbers first.');
  if(!waHasMessage())return;
  if(!confirm('Open WhatsApp for '+gs.length+' guest(s)? Allow pop-ups, then send each chat.'))return;
  gs.forEach((g,i)=>setTimeout(()=>waOpen(g.phone,g.name),i*700));
  setText('waCount',gs.length+' opening…');
}
// Message a single, manually-typed number.
function waSendOne(){
  if(!waDigits(val('waOne')))return alert('Enter a valid phone number first.');
  if(!waHasMessage())return;
  waOpen(val('waOne'),'');
}
// Verify WhatsApp works by opening a test chat to your own (sender) number.
function waSendTest(){
  const n=waDigits(val('waSender')||WA_DEFAULT_SENDER);
  if(!n)return alert('Set your WhatsApp (sender) number first.');
  window.open(`https://wa.me/${n}?text=${encodeURIComponent('✅ WhatsApp test from the Life Events Planner — your number works!')}`,'_blank');
}
// Export every guest-with-phone as a .vcf so a WhatsApp Broadcast list can send
// a real image to all of them for free (import the file on your phone first).
function exportContacts(){
  const gs=waGuests();
  if(!gs.length)return alert('No guest has a phone number yet. Add phone numbers first.');
  const org=(val('organizedFor')||'Event').trim();
  const v=s=>String(s).replace(/[\\,;]/g,m=>'\\'+m);
  const vcf=gs.map(g=>{
    const name=((g.honorific?g.honorific+' ':'')+(g.name||'').trim()).trim()||('+'+waDigits(g.phone));
    return['BEGIN:VCARD','VERSION:3.0','N:'+v(name)+';;;;','FN:'+v(name),'ORG:'+v(org),
      'TEL;TYPE=CELL:+'+waDigits(g.phone),'END:VCARD'].join('\r\n');
  }).join('\r\n')+'\r\n';
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([vcf],{type:'text/vcard'}));
  a.download=(org.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'event')+'-contacts.vcf';
  a.click();URL.revokeObjectURL(a.href);
  setText('waCount',gs.length+' contacts saved');
}

// Expose the pure builders for the Node test runner (ignored in the browser).
if(typeof module!=='undefined')module.exports={waDigits,waText,waUrl,WA_DEFAULT_SENDER};
