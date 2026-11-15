const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const clipboardEvents = {};
const buttonEvents = {};
const deliveries = [];
let editorLoaded;
class DataTransfer { constructor() { this.files = []; this.items = {add: file => this.files.push(file)}; } }
class DragEvent { constructor(type, options) { Object.assign(this, options, {type}); } }
class File { constructor(parts, name, options) { Object.assign(this, {parts, name, ...options}); } }
const canvas = {focus() {}, getBoundingClientRect: () => ({left: 0, top: 0, width: 1000, height: 700}),
  dispatchEvent: event => deliveries.push(event)};
const frame = {contentDocument: {getElementById: () => canvas},
  contentWindow: {DataTransfer, DragEvent, addEventListener: (name, fn) => {clipboardEvents[name] = fn;}},
  addEventListener: (_, fn) => {editorLoaded = fn; fn();}};
const button = {addEventListener: (name, fn) => {buttonEvents[name] = fn;}};
const status = {};
const image = {type: 'image/png', name: 'image.png'};
const hostWindow = {};
const clipboard = {read: async () => [{types: ['text/html', 'image/png'], getType: async () => image}]};
vm.runInNewContext(fs.readFileSync(process.argv[2] || 'host/image-paste.js', 'utf8'), {
  document: {getElementById: id => id === 'editor' ? frame : id === 'paste-image' ? button : status},
  navigator: {clipboard}, File, window: hostWindow,
});
function paste(items) {
  const event = {clipboardData: {items}, preventDefault() {this.prevented = true;},
    stopImmediatePropagation() {this.stopped = true;}};
  clipboardEvents.paste(event); return event;
}
const imageItems = () => [{kind: 'file', type: 'image/png', getAsFile: () => image}];
function ctrlV() {
  const event = {ctrlKey: true, key: 'v', stopImmediatePropagation() {this.stopped = true;},
    preventDefault() {this.prevented = true;}};
  clipboardEvents.keydown(event);
  return event;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const browserImage = () => [{types: ['image/png'], getType: async () => image}];
(async () => {
  const event = paste([{kind: 'file', type: 'image/png', getAsFile: () => image}]);
  assert.equal(event.prevented, true); assert.equal(event.stopped, true);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].dataTransfer.files[0], image, 'Use original clipboard image bytes');
  assert.equal(deliveries[0].type, 'drop');
  assert.equal(deliveries[0].clientX, 500);
  assert.equal(paste([{kind: 'string', type: 'text/plain'}]).prevented, undefined);
  assert.equal(paste([]).prevented, undefined);
  clipboardEvents.keydown({ctrlKey: true, key: 'c'});
  assert.equal(paste([{kind: 'file', type: 'image/png', getAsFile: () => image}]).prevented, undefined,
    'Preserve PhotoCraft internal copy/paste without substituting an old system image');
  clipboardEvents.blur();
  assert.equal(paste([{kind: 'file', type: 'image/png', getAsFile: () => image}]).prevented, true);
  await buttonEvents.click();
  assert.equal(deliveries.length, 3);
  assert.equal(deliveries[2].dataTransfer.files[0].type, 'image/png');
  hostWindow.photocraftBrowserCopied();
  assert.equal(hostWindow.photocraftBrowserPaste(), false, 'Native menu keeps editable internal copies');
  clipboardEvents.blur();
  assert.equal(hostWindow.photocraftBrowserPaste(), true, 'Menu starts browser read after external focus');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(deliveries.length, 4, 'Native menu and toolbar deliver the same image path');
  clipboard.read = async () => {const error = new Error(); error.name = 'NotAllowedError'; throw error;};
  await buttonEvents.click();
  assert.match(status.textContent, /blocked/);
  assert.equal(button.disabled, false);

  // Reproduce both pipelines for one gesture, with the browser read completing
  // only after the DOM image was placed and background removal could start.
  let finishRead;
  clipboard.read = () => new Promise(resolve => {finishRead = resolve;});
  const externalGesture = ctrlV();
  hostWindow.photocraftBrowserPaste();
  const beforeRace = deliveries.length;
  paste(imageItems());
  assert.equal(deliveries.length, beforeRace + 1);
  clipboardEvents.pointerdown?.(); // Opening Select → Remove Background.
  finishRead(browserImage()); await tick();
  assert.equal(deliveries.length, beforeRace + 1, 'A delayed read must not add another layer or invalidate an in-flight mask');
  assert.equal(button.disabled, false, 'A winning DOM paste must release the UI immediately');
  assert.equal(externalGesture.stopped, true, 'Do not also enqueue the native Ctrl+V command');
  assert.equal(externalGesture.prevented, undefined, 'Chrome must still generate its actual paste event');

  // The reverse ordering must also place once; DOM events remain consumed.
  clipboard.read = async () => browserImage();
  ctrlV();
  const beforeReadFirst = deliveries.length;
  hostWindow.photocraftBrowserPaste(); await tick();
  assert.equal(paste(imageItems()).stopped, true);
  assert.equal(deliveries.length, beforeReadFirst + 1);

  // Native callback after a completed DOM event must not even request access.
  let reads = 0;
  clipboard.read = async () => {reads++; return browserImage();};
  ctrlV(); paste(imageItems());
  hostWindow.photocraftBrowserPaste(); await tick();
  assert.equal(reads, 0);

  // A read can finish before its getType conversion: guard that await too.
  let finishBlob;
  clipboard.read = async () => [{types:['image/png'],getType:()=>new Promise(resolve=>{finishBlob=resolve;})}];
  ctrlV(); hostWindow.photocraftBrowserPaste(); await tick();
  const beforeBlob = deliveries.length;
  paste(imageItems()); finishBlob(image); await tick();
  assert.equal(deliveries.length,beforeBlob+1);

  // A losing permission error must not replace a successful paste status.
  let failRead;
  clipboard.read = () => new Promise((_,reject)=>{failRead=reject;});
  ctrlV(); hostWindow.photocraftBrowserPaste(); paste(imageItems());
  const successStatus = status.textContent;
  const denied = new Error('Denied'); denied.name = 'NotAllowedError';
  failRead(denied); await tick();
  assert.equal(status.textContent,successStatus);

  // Identical bytes on separate gestures are intentional separate pastes.
  const beforeSeparate = deliveries.length;
  ctrlV(); paste(imageItems()); ctrlV(); paste(imageItems());
  assert.equal(deliveries.length,beforeSeparate+2);
  clipboard.read = async()=>browserImage();
  await buttonEvents.click();
  assert.equal(deliveries.length,beforeSeparate+3,'The toolbar starts an independent paste');
  clipboardEvents.pointerdown(); hostWindow.photocraftBrowserPaste(); await tick();
  assert.equal(deliveries.length,beforeSeparate+4,'An explicit Edit → Paste remains independent');

  // Old reads must never target a newer gesture or a restarted editor.
  clipboard.read = () => new Promise(resolve=>{finishRead=resolve;});
  ctrlV(); hostWindow.photocraftBrowserPaste();
  ctrlV(); paste(imageItems());
  const newerCount = deliveries.length;
  finishRead(browserImage()); await tick();
  assert.equal(deliveries.length,newerCount);
  ctrlV(); hostWindow.photocraftBrowserPaste();
  editorLoaded(); finishRead(browserImage()); await tick();
  assert.equal(deliveries.length,newerCount);
  ctrlV(); hostWindow.photocraftBrowserPaste();
  hostWindow.photocraftBrowserCopied(); finishRead(browserImage()); await tick();
  assert.equal(deliveries.length,newerCount,'Internal Copy cancels an older external read');
  assert.equal(hostWindow.photocraftBrowserPaste(),false);
  assert.equal(ctrlV().stopped,undefined,'Internal Ctrl+V must retain the native command');
  clipboardEvents.blur();
  ctrlV();
  const textEvent=paste([{kind:'string',type:'text/plain'}]);
  assert.equal(textEvent.prevented,undefined,'The ordinary DOM text paste remains untouched');
  assert.equal(textEvent.stopped,undefined);
  console.log('Paste race orderings, delayed reads, independent gestures, internal copies, text, errors and editor restarts passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
