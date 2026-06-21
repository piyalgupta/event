// Dependency-free tests for the WhatsApp invite module (run: node test/whatsapp.test.js).
// They prove the message/link to & from +91 9874174100 is built correctly.
const assert=require('assert');

// Stub the browser helpers the module borrows from core.js.
const fields={waCC:'91',waMsg:'Namaste {name}, you are warmly invited!',waImage:''};
global.val=id=>fields[id]||'';

const {waDigits,waText,waUrl,WA_DEFAULT_SENDER}=require('../js/whatsapp.js');

let pass=0;
const ok=(name,cond)=>{assert.ok(cond,name);console.log('  ✓ '+name);pass++;};

console.log('WhatsApp module');
ok('default sender is +91 9874174100',WA_DEFAULT_SENDER==='919874174100');
ok('full international number kept as-is',waDigits('+91 9874174100')==='919874174100');
ok('bare 10-digit number gets +91',waDigits('9874174100')==='919874174100');
ok('spaces/dashes/zeros stripped',waDigits('0 98741-74100')==='919874174100');
ok('empty input stays empty',waDigits('')==='');
ok('{name} is personalised',decodeURIComponent(waText('Asha')).includes('Asha'));
ok('sender chat link is well-formed',
   waUrl('+91 9874174100','Asha')==='https://wa.me/919874174100?text='+waText('Asha'));

console.log('\n'+pass+' checks passed — message to/from +91 9874174100 builds correctly.');
