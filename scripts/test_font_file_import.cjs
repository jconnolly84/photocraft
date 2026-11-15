const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {MessageChannel} = require('node:worker_threads');
const {webcrypto} = require('node:crypto');
const readInfo = require('../host/font-file-info.js');
const manifest = fs.readFileSync('font-library/fonts/manifest.txt', 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#'));
for (const row of manifest) {
  const [family, , path] = row.split('|').map(s => s.trim());
  const bytes = fs.readFileSync('font-library/' + path);
  assert.equal(readInfo(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)).family, family);
}
for (const bytes of [new Uint8Array(4), new Uint8Array(12), new Uint8Array([116, 116, 99, 102, ...Array(8).fill(0)])]) {
  assert.throws(() => readInfo(bytes.buffer));
}
const hostile = new ArrayBuffer(28), hostileView = new DataView(hostile);
hostileView.setUint32(0, 0x00010000); hostileView.setUint16(4, 1);
hostileView.setUint32(12, 0x6e616d65); hostileView.setUint32(20, 0xfffffffe); hostileView.setUint32(24, 20);
assert.throws(() => readInfo(hostile), /name table/);

const data = fs.readFileSync('font-library/fonts/lobster/Lobster-Regular.ttf');
const buffer = () => data.buffer.slice(data.byteOffset, data.byteOffset + data.length);
const file = {name: 'Lobster-Regular.ttf', size: data.length, arrayBuffer: async () => buffer()};
const events = {}, elements = {};
for (const id of ['enable-local-fonts', 'disable-local-fonts', 'choose-font-files', 'font-files', 'apply-font-files', 'cancel-font-files', 'font-file-status', 'local-font-status', 'editor']) {
  elements[id] = {hidden: true, addEventListener: (name, handler) => {events[id + ':' + name] = handler;}, click() {this.clicked = true;}};
}
const worker = {state: 'activated', postMessage: (_, ports) => {ports[0].postMessage({ownerId: 'owner'}); ports[0].close();}};
const window = {photocraftReadFontInfo: readInfo,
  PHOTOCRAFT_EDITOR_PATH: './build-123/', location: {href: 'https://example.test/school/', search: '?cpu', hash: '#test'}};
const serviceWorker = {addEventListener: (_, handler) => {events.worker = handler;}, register: async () => ({active: worker})};
vm.runInNewContext(fs.readFileSync('host/local-fonts.js', 'utf8'), {
  document: {getElementById: id => elements[id]}, window, navigator: {serviceWorker},
  FontFace: class {load() {return Promise.resolve(this);}}, crypto: webcrypto,
  URL, MessageChannel, Map, ArrayBuffer, Uint8Array, setTimeout, clearTimeout,
});
async function request(action, name) {
  let answer;
  await events.worker({data: {type: 'photocraft-local-font', action, name}, ports: [{postMessage: data => {answer = data;}, close() {}}]});
  return answer;
}
(async () => {
  assert.equal(elements['enable-local-fonts'].disabled, true, 'File importing works without queryLocalFonts');
  assert.notEqual(elements['choose-font-files'].disabled, true);
  elements['font-files'].files = [file, {name: 'broken.ttf', size: 4, arrayBuffer: async () => new ArrayBuffer(4)}];
  await events['font-files:change']();
  assert.equal(elements['apply-font-files'].hidden, false);
  assert.match(elements['font-file-status'].textContent, /Lobster/);
  assert.match(elements['font-file-status'].textContent, /broken.ttf/);
  assert.equal(elements.editor.src, undefined, 'Staging fonts never reloads unsaved work');
  events['cancel-font-files:click']();
  assert.equal(elements.editor.src, undefined, 'Cancelling the staged selection keeps the editor untouched');
  elements['font-files'].files = [file]; await events['font-files:change']();
  await events['apply-font-files:click']();
  assert.equal(new URL(elements.editor.src).pathname, '/school/build-123/');
  assert.equal(new URL(elements.editor.src).searchParams.get('local_fonts'), 'owner');
  assert.equal(new URL(elements.editor.src).searchParams.has('cpu'), true);
  const {rows} = await request('manifest');
  assert.equal(rows.length, 1); assert.equal(rows[0].family, 'Lobster');
  assert.equal(rows[0].format, 'ttf');
  assert.deepEqual(new Uint8Array((await request('bytes', rows[0].postscriptName)).bytes), new Uint8Array(buffer()));
  console.log('All 117 font names, malformed bounds, file staging, selection cancellation, API-independent importing and exact private bytes passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
