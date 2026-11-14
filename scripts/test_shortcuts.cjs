const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const listeners = {};
class Element {
  closest() { return this.editing ? this : null; }
  dispatchEvent(event) { this.lastDispatched = event; }
}
class KeyboardEvent { constructor(type, values) { Object.assign(this, values, {type}); } }
const win = {Element, KeyboardEvent, addEventListener: (type, fn) => { listeners[type] = fn; }};
const frame = { contentWindow: win, addEventListener: (_, fn) => fn() };
vm.runInNewContext(fs.readFileSync('host/shortcuts.js', 'utf8'), {
  document: {getElementById: () => frame}, window: {location: {search: '?webgl', hash: ''}},
});
function key(key, extra = {}) {
  return {type: 'keydown', key, ctrlKey: true, target: new Element(),
    getModifierState: () => false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; }, ...extra};
}
let event = key('d'); listeners.keydown(event);
assert.equal(event.prevented, true);
assert.equal(event.stopped, undefined, 'Deselect must still reach the app');
event = key('t', {altKey: true}); listeners.keydown(event);
assert.equal(event.prevented, true); assert.equal(event.stopped, true);
assert.equal(event.target.lastDispatched.ctrlKey, true);
assert.equal(event.target.lastDispatched.altKey, false);
assert.equal(event.target.lastDispatched.code, 'KeyT');
event = key('t', {altKey: true, type: 'keyup'}); listeners.keyup(event);
assert.equal(event.target.lastDispatched.type, 'keyup');
event = key('d'); event.target.editing = true; listeners.keydown(event);
assert.equal(event.prevented, undefined, 'Native text editing must be preserved');
for (const combo of [key('c'), key('v'), key('x'), key('w'), key('t'),
  key('d', {isComposing: true}), key('t', {altKey: true, getModifierState: () => true})]) {
  listeners.keydown(combo); assert.equal(combo.prevented, undefined);
}
assert.equal(frame.src, './photocraft/?webgl');
console.log('Shortcut routing, text/clipboard exclusions, keyup and renderer query checks passed.');
