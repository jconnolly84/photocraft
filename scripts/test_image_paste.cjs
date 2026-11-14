const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const clipboardEvents = {};
const buttonEvents = {};
const deliveries = [];
class DataTransfer { constructor() { this.files = []; this.items = {add: file => this.files.push(file)}; } }
class DragEvent { constructor(type, options) { Object.assign(this, options, {type}); } }
class File { constructor(parts, name, options) { Object.assign(this, {parts, name, ...options}); } }
const canvas = {focus() {}, getBoundingClientRect: () => ({left: 0, top: 0, width: 1000, height: 700}),
  dispatchEvent: event => deliveries.push(event)};
const frame = {contentDocument: {getElementById: () => canvas},
  contentWindow: {DataTransfer, DragEvent, addEventListener: (name, fn) => {clipboardEvents[name] = fn;}},
  addEventListener: (_, fn) => fn()};
const button = {addEventListener: (name, fn) => {buttonEvents[name] = fn;}};
const status = {};
const image = {type: 'image/png', name: 'image.png'};
const clipboard = {read: async () => [{types: ['text/html', 'image/png'], getType: async () => image}]};
vm.runInNewContext(fs.readFileSync('host/image-paste.js', 'utf8'), {
  document: {getElementById: id => id === 'editor' ? frame : id === 'paste-image' ? button : status},
  navigator: {clipboard}, File,
});
function paste(items) {
  const event = {clipboardData: {items}, preventDefault() {this.prevented = true;},
    stopImmediatePropagation() {this.stopped = true;}};
  clipboardEvents.paste(event); return event;
}
(async () => {
  const event = paste([{kind: 'file', type: 'image/png', getAsFile: () => image}]);
  assert.equal(event.prevented, true); assert.equal(event.stopped, true);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].dataTransfer.files[0], image, 'Use original clipboard image bytes');
  assert.equal(deliveries[0].type, 'drop');
  assert.equal(deliveries[0].clientX, 500);
  assert.equal(paste([{kind: 'string', type: 'text/plain'}]).prevented, undefined);
  assert.equal(paste([]).prevented, undefined);
  await buttonEvents.click();
  assert.equal(deliveries.length, 2);
  assert.equal(deliveries[1].dataTransfer.files[0].type, 'image/png');
  clipboard.read = async () => {const error = new Error(); error.name = 'NotAllowedError'; throw error;};
  await buttonEvents.click();
  assert.match(status.textContent, /blocked/);
  assert.equal(button.disabled, false);
  console.log('Image paste routing, duplicate suppression, text passthrough and permission failures passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
