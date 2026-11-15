const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(entries) {
  let reloads = 0;
  const elements = new Map();
  const make = () => ({hidden:true, children:[], handlers:{}, textContent:'',
    append(node){this.children.push(node);}, replaceChildren(){this.children=[];},
    addEventListener(event,handler){this.handlers[event]=handler;}, focus(){this.focused=true;},
    click(){this.handlers.click?.();}, querySelector(){return this;}, getAttribute(name){return this[name]||null;},
    showModal(){this.open=true;},close(){this.open=false;this.handlers.close?.();},
    contentWindow:{postMessage(message,origin){this.lastMessage={message,origin};}}});
  const get = id => {if(!elements.has(id))elements.set(id,make()); return elements.get(id);};
  get('show-toolbar').handlers.click = () => {get('host-toolbar').hidden=false;};
  const win = {location:{origin:'https://example.test'},photocraftRecoverySummary: async()=>{if(entries instanceof Error)throw entries;return entries;}};
  vm.runInNewContext(fs.readFileSync('host/start-screen.js','utf8'),{
    window:win,document:{getElementById:get,createElement:make},Date,
    location:{reload(){reloads++;}}, fetch(){throw Error('No network allowed');}
  });
  return {win,get,reloads:()=>reloads};
}
(async()=>{
  const empty=setup([]);
  await empty.win.photocraftStartAction('recovery');
  assert.equal(empty.get('host-toolbar').hidden,false);
  assert.equal(empty.get('recovery-tools').open,true);
  assert.equal(empty.get('recovery-reload').hidden,true);
  assert.match(empty.get('recovery-available').children[0].textContent,/No recovery/);
  const found=setup([{name:'<img onerror=alert(1)>',updated:Date.now()}]);
  await found.win.photocraftStartAction('recovery');
  assert.equal(found.get('recovery-reload').hidden,false);
  assert.match(found.get('recovery-available').children[1].textContent,/<img/);
  assert.match(found.get('recovery-available').children[2].textContent,/Save any open work first/);
  assert.equal(found.reloads(),0);
  found.get('recovery-reload').click();
  assert.equal(found.reloads(),1);
  const failed=setup(new Error('Storage blocked'));
  await failed.win.photocraftStartAction('recovery');
  assert.equal(failed.get('recovery-reload').hidden,true);
  assert.match(failed.get('recovery-available').children[0].textContent,/Storage blocked/);
  await assert.rejects(found.win.photocraftStartAction('unexpected'));
  await found.win.photocraftStartAction('tutorial');
  assert.equal(found.get('tutorial-dialog').open,true);
  assert.equal(found.get('tutorial-frame').src,'./tutorial/');
  assert.equal(found.reloads(),1,'Tutorial must not restart the existing editor');
  found.get('close-tutorial').click();
  assert.equal(found.get('tutorial-dialog').open,false);
  assert.equal(found.get('tutorial-frame').contentWindow.lastMessage.message.type,'photocraft-tutorial-pause');
  assert.equal(found.get('tutorial-frame').contentWindow.lastMessage.origin,'https://example.test');
  found.get('open-tutorial').click();
  assert.equal(found.get('tutorial-dialog').open,true);
  console.log('Start-screen recovery availability, safe names, errors and explicit reload passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
