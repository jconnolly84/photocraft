const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const {indexedDB} = require(process.argv[2] || 'fake-indexeddb');
const leases = new Map();
async function storedSnapshots() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('photocraft.document-recovery.v1', 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('snapshots', 'readonly');
      const rows = tx.objectStore('snapshots').getAll();
      tx.oncomplete = () => {db.close(); resolve(rows.result);};
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}
function host(options = {}) {
  const controls = new Map();
  const elements = new Map();
  const writes = [];
  let lockName;
  const get = id => {
    if (!elements.has(id)) elements.set(id, {addEventListener: (event, fn) => controls.set(id + ':' + event, fn)});
    return elements.get(id);
  };
  get('editor').contentWindow = {Uint8Array};
  const win = {confirm: () => true, ClipboardItem: class {constructor(data) {this.data = data;}}};
  const navigator = {
    locks: {request: (name, fn) => {lockName = name; leases.set(name, true); return fn();},
      query: async () => ({held: [...leases.keys()].map(name => ({name}))})},
    clipboard: {write: async data => {writes.push(data);}},
  };
  vm.runInNewContext(fs.readFileSync('host/recovery.js', 'utf8'), {
    window: win, navigator, document: {getElementById: get}, indexedDB,
    crypto: webcrypto, localStorage: {getItem: () => options.disabled ? 'false' : null, setItem() {}},
    Blob, Uint8Array, ArrayBuffer, Promise, Map, Set, Date, setTimeout, clearTimeout,
    ClipboardItem: win.ClipboardItem,
    fetch: () => {throw new Error('Recovery must never use network storage');},
  });
  return {win, get, controls, writes, navigator, crash: () => leases.delete(lockName)};
}
(async () => {
  const first = host();
  assert.equal((await first.win.photocraftRecoveryLoad()).length, 0);
  const bytes = new Uint8Array([80, 67, 82, 65, 70, 84]);
  await first.win.photocraftRecoverySave({docId: '1', revision: '2', name: 'Layered document', bytes});
  const second = host();
  assert.equal((await second.win.photocraftRecoveryLoad()).length, 0, 'Do not recover a live tab');
  assert.equal((await second.win.photocraftRecoverySummary()).length, 0, 'Home recovery must exclude live tabs');
  await second.win.photocraftRecoverySave({docId: '1', revision: '1', name: 'Other live tab', bytes});
  first.crash();
  const restored = host();
  const summary = await restored.win.photocraftRecoverySummary();
  assert.equal(summary.length, 1);
  assert.equal(summary[0].name, 'Layered document');
  assert.equal('bytes' in summary[0], false, 'Home summary must not read or expose document bytes');
  const snapshots = await restored.win.photocraftRecoveryLoad();
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].name, 'Layered document');
  assert.deepEqual([...snapshots[0].bytes], [...bytes]);
  await restored.win.photocraftRecoveryAdopt({docId: '8', key: snapshots[0].key});
  const changed = new Uint8Array([1, 2, 3, 4]);
  await restored.win.photocraftRecoverySave({docId: '8', revision: '3', name: 'Edited recovery', bytes: changed});
  await assert.rejects(restored.win.photocraftRecoverySave({docId: '8', revision: '4', name: 'Too large', bytes: new Uint8Array(64 * 1024 * 1024 + 1)}));
  const stillGood = (await storedSnapshots()).filter(row => row.key === snapshots[0].key);
  assert.equal(stillGood.length, 1);
  assert.deepEqual([...new Uint8Array(await stillGood[0].blob.arrayBuffer())], [...changed], 'Failed save must preserve the previous successful snapshot');
  await restored.win.photocraftRecoveryDiscard('8');
  assert.equal((await storedSnapshots()).filter(row => row.key === snapshots[0].key).length, 0);
  const disabled = host({disabled: true});
  await assert.rejects(disabled.win.photocraftRecoveryLoad(), /disabled/);
  await assert.rejects(disabled.win.photocraftRecoverySummary(), /disabled/);
  await restored.win.photocraftClipboardWrite(bytes);
  assert.equal(restored.writes.length, 1);
  const copied = restored.writes[0][0].data['image/png'];
  assert.deepEqual([...new Uint8Array(await copied.arrayBuffer())], [...bytes]);
  restored.navigator.clipboard.write = async () => {throw new Error('Denied');};
  await assert.rejects(restored.win.photocraftClipboardWrite(bytes));
  assert.match(restored.get('paste-image-status').textContent, /failed/);
  console.log('Recovery persistence, tab isolation, adoption, atomic failure retention, discard, opt-out and clipboard export tests passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
