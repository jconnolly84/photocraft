const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const callbacks = {}, workers = [];
const frame = {contentWindow: {Uint8Array}, addEventListener: (_, fn) => {callbacks.load = fn;}};
const panel = {hidden: true}, status = {}, cancel = {addEventListener: (_, fn) => {callbacks.cancel = fn;}};
const dismiss = {addEventListener: (_, fn) => {callbacks.dismiss = fn;}};
class Worker {
  constructor(url, options) {this.url = url; this.options = options; this.sent = []; workers.push(this);}
  postMessage(data, transfer) {this.sent.push({data, transfer});}
  terminate() {this.terminated = true;}
}
const host = {};
vm.runInNewContext(fs.readFileSync('host/background-removal.js', 'utf8'), {
  document: {getElementById: id => ({editor: frame, 'background-tools': panel, 'background-status': status,
    'background-cancel': cancel, 'background-dismiss': dismiss})[id]},
  window: host, Worker, Uint8Array, ArrayBuffer, URL, location: {href: 'https://school.github.io/photocraft/'},
});
(async () => {
  const original = new Uint8Array([137, 80, 78, 71]);
  let result = host.photocraftRemoveBackground({png: original});
  assert.equal(panel.hidden, false); assert.equal(cancel.hidden, false);
  assert.equal(workers.length, 1);
  assert.equal(workers[0].url.origin, 'https://school.github.io');
  assert.equal(workers[0].options.type, 'module');
  assert.deepEqual([...new Uint8Array(workers[0].sent[0].data.png)], [...original]);
  assert.notEqual(workers[0].sent[0].data.png, original.buffer, 'Do not detach native image bytes');
  await assert.rejects(host.photocraftRemoveBackground({png: original}), reason => /already running/.test(reason));
  workers[0].onmessage({data: {type: 'progress', message: 'Processing locally'}});
  assert.equal(status.textContent, 'Processing locally');
  workers[0].onmessage({data: {type: 'result', alpha: new Uint8Array([0, 64, 128, 255]).buffer}});
  assert.deepEqual([...(await result)], [0, 64, 128, 255]);
  assert.equal(cancel.hidden, true);
  host.photocraftBackgroundComplete('Mask applied'); assert.equal(status.textContent, 'Mask applied');
  callbacks.dismiss(); assert.equal(panel.hidden, true);
  result = host.photocraftRemoveBackground({png: original});
  assert.equal(workers.length, 1, 'Reuse the loaded model');
  callbacks.cancel();
  await assert.rejects(result, reason => /cancelled/.test(reason));
  assert.equal(workers[0].terminated, true);
  result = host.photocraftRemoveBackground({png: original}); callbacks.load();
  await assert.rejects(result, reason => /restarted/.test(reason));
  result = host.photocraftRemoveBackground({png: original});
  workers.at(-1).onmessage({data: {type: 'error', message: 'out of memory'}});
  await assert.rejects(result, reason => /out of memory/.test(reason));
  assert.match(status.textContent, /Quick/);
  await assert.rejects(host.photocraftRemoveBackground({png: 'invalid'}), reason => /too large/.test(reason));
  console.log('Local AI handoff, original-byte preservation, model reuse, cancellation, iframe restarts and failures passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
