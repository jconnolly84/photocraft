/* On-device document recovery only. No fetch, upload or remote storage. */
(() => {
  const DB = 'photocraft.document-recovery.v1';
  const STORE = 'snapshots';
  const MAX_FILE = 64 * 1024 * 1024;
  const MAX_TOTAL = 128 * 1024 * 1024;
  const MAX_RECORDS = 16;
  const session = crypto.randomUUID();
  const lockPrefix = 'photocraft-recovery/';
  const aliases = new Map();
  const status = document.getElementById('recovery-status');
  const enabledBox = document.getElementById('recovery-enabled');
  const clipboardStatus = document.getElementById('paste-image-status');
  const frame = document.getElementById('editor');
  if (window.PHOTOCRAFT_RECOVERY_SUPPORTED === false) {
    enabledBox.disabled = true;
    status.textContent = 'Recovery is not available in this app build yet.';
    return;
  }
  let enabled = true;
  try {enabled = localStorage.getItem('photocraft.recovery.enabled') !== 'false';} catch { /* IndexedDB may still work. */ }
  enabledBox.checked = enabled;
  const notice = message => {status.textContent = message;};
  let queue = Promise.resolve();
  const enqueue = operation => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  function timeout(promise, milliseconds = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Browser recovery storage timed out. Download your work.')), milliseconds);
      promise.then(value => {clearTimeout(timer); resolve(value);}, error => {clearTimeout(timer); reject(error);});
    });
  }
  function open() {
    return timeout(new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, {keyPath: 'key'});
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Recovery storage is blocked by another browser window.'));
      request.onsuccess = () => {request.result.onversionchange = () => request.result.close(); resolve(request.result);};
    }));
  }
  async function setup() {
    if (!enabled) {notice('Recovery off. Enable and reload to use local snapshots.'); return null;}
    if (!navigator.locks || !globalThis.indexedDB) throw new Error('Local recovery needs browser storage and Web Locks support.');
    // A live tab holds its lease. A crashed/closed tab releases it automatically.
    await new Promise((resolve, reject) => {
      navigator.locks.request(lockPrefix + session, () => {
        resolve(); return new Promise(() => {});
      }).catch(reject);
    });
    const db = await open();
    notice('Recovery ready — saves changed documents about every minute. No snapshot saved in this session yet.');
    return db;
  }
  const ready = setup().catch(error => {notice('Recovery unavailable: ' + error.message); return null;});
  async function database() {
    const db = await ready;
    if (!db) throw new Error('Recovery is unavailable. Save a downloaded .pcraft file.');
    return db;
  }
  async function records() {
    const db = await database();
    return timeout(new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).getAll();
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not read recovery copies.'));
    }));
  }
  async function mutate(operation) {
    const db = await database();
    return timeout(new Promise((resolve, reject) => {
      let tx;
      try {tx = db.transaction(STORE, 'readwrite', {durability: 'strict'});}
      catch {tx = db.transaction(STORE, 'readwrite');}
      let failure;
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(failure || tx.error || new Error('Could not save recovery copy.'));
      try {operation(tx.objectStore(STORE), error => {failure = error; tx.abort();});}
      catch (error) {failure = error; tx.abort();}
    }));
  }
  const safeKey = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(value);
  const keyFor = id => aliases.get(String(id)) || session + '_' + String(id);
  async function recoverable() {
    const rows = await records();
    const locks = await navigator.locks.query();
    const live = new Set(locks.held.map(lock => lock.name));
    let bytes = 0;
    const selected = [];
    for (const row of rows.sort((a, b) => b.updated - a.updated)) {
      if (row.session !== session && live.has(lockPrefix + row.session)) continue;
      if (!safeKey(row.key) || !(row.blob instanceof Blob) || row.blob.size > MAX_FILE) continue;
      if (selected.length >= MAX_RECORDS || bytes + row.blob.size > MAX_TOTAL) break;
      bytes += row.blob.size; selected.push(row);
    }
    return selected;
  }
  window.photocraftRecoverySummary = async () => {
    if (!enabled) throw new Error('Recovery is disabled. Enable it and reload after saving your work.');
    await queue;
    return (await recoverable()).map(row => ({name: String(row.name || 'Recovered document').slice(0,256), updated: row.updated}));
  };
  window.photocraftRecoveryLoad = async () => {
    if (!enabled) throw new Error('Recovery disabled');
    // A font-setting change may restart only the editor iframe. Finish its old
    // writes before assigning the restarted editor's fresh document ids.
    await queue;
    aliases.clear();
    const selected = await recoverable();
    if (selected.length) notice(`Reopening ${selected.length} local recovery document(s)…`);
    const TypedArray = frame.contentWindow.Uint8Array;
    return Promise.all(selected.map(async row => ({key: row.key,
      name: String(row.name || 'Recovered document').slice(0, 256),
      path: typeof row.path === 'string' ? row.path.slice(0, 1024) : null,
      // The Wasm loader lives in the iframe's JS realm.
      bytes: new TypedArray(await row.blob.arrayBuffer()),
    })));
  };
  window.photocraftRecoverySave = data => enqueue(async () => {
    try {
      if (!/^\d{1,24}$/.test(String(data.docId)) || !ArrayBuffer.isView(data.bytes) || data.bytes.byteLength > MAX_FILE) {
        throw new Error('Recovery copy is too large or invalid. Download a .pcraft copy.');
      }
      const key = keyFor(data.docId);
      const blob = new Blob([data.bytes], {type: 'application/octet-stream'});
      const record = {key, session, name: String(data.name).slice(0, 256),
        path: typeof data.path === 'string' ? data.path.slice(0, 1024) : null,
        revision: String(data.revision), updated: Date.now(), blob};
      await mutate((store, abort) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const remaining = request.result.filter(row => row.key !== key);
          if (remaining.length >= MAX_RECORDS || remaining.reduce((sum, row) => sum + (row.blob?.size || 0), blob.size) > MAX_TOTAL) {
            abort(new Error('Recovery storage limit reached. Download your work and clear old recovery copies.'));
          } else store.put(record);
        };
      });
      notice('Recovery saved locally at ' + new Date(record.updated).toLocaleTimeString() + '.');
    } catch (error) {notice('Recovery save failed: ' + error.message); throw error;}
  });
  window.photocraftRecoveryAdopt = data => {
    if (!safeKey(data.key) || !/^\d{1,24}$/.test(String(data.docId))) return Promise.reject(new Error('Invalid recovery entry'));
    aliases.set(String(data.docId), data.key);
    return enqueue(async () => {
      await mutate(store => {
        const request = store.get(data.key);
        request.onsuccess = () => {if (request.result) store.put({...request.result, session});};
      });
      notice('Recovered document opened. Local recovery remains enabled.');
    });
  };
  window.photocraftRecoveryDiscard = id => {
    const key = keyFor(id);
    return enqueue(() => mutate(store => store.delete(key)));
  };
  enabledBox.addEventListener('change', () => {
    try {localStorage.setItem('photocraft.recovery.enabled', String(enabledBox.checked));}
    catch {notice('Browser settings could not be saved.'); return;}
    notice('Save your work, then reload to apply the recovery setting. Existing recovery copies are kept.');
  });
  document.getElementById('recovery-clear').addEventListener('click', async () => {
    if (!window.confirm('Permanently delete recovery copies from closed or crashed tabs? Open documents and active tabs are kept. Download anything you need first.')) return;
    try {
      const selected = (await recoverable()).filter(row => row.session !== session);
      await enqueue(() => mutate(store => {for (const row of selected) store.delete(row.key);}));
      notice('Old recovery copies cleared. Active documents were kept.');
    } catch (error) {notice(error.message);}
  });
  document.getElementById('recovery-keep').addEventListener('click', async () => {
    const granted = await navigator.storage?.persist?.().catch(() => false);
    notice(granted ? 'Browser storage protection is enabled. Keep downloaded copies too.' : 'Storage protection was not granted. Keep downloaded copies of your work.');
  });
  window.photocraftClipboardWrite = async bytes => {
    window.photocraftBrowserCopied?.();
    try {
      if (!navigator.clipboard?.write || !window.ClipboardItem) throw new Error('This browser cannot export clipboard images.');
      await navigator.clipboard.write([new ClipboardItem({'image/png': new Blob([bytes], {type: 'image/png'})})]);
      clipboardStatus.textContent = 'Image copied to the browser clipboard.';
    } catch (error) {clipboardStatus.textContent = 'Copy to browser clipboard failed. Allow clipboard access or export a PNG.'; throw error;}
  };
})();
