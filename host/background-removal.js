/* Only static model files are downloaded. Image and mask bytes stay in this tab. */
(() => {
  const frame = document.getElementById('editor');
  const panel = document.getElementById('background-tools');
  const status = document.getElementById('background-status');
  const cancel = document.getElementById('background-cancel');
  let worker, pending;
  const show = message => {
    status.textContent = message;
    // Keep progress and Cancel visible even when the main toolbar was hidden.
    panel.hidden = false;
  };
  const reset = () => {pending = null; cancel.hidden = true;};
  const stop = reason => {
    worker?.terminate(); worker = null;
    pending?.reject(reason); reset(); show(reason);
  };
  window.photocraftRemoveBackground = ({png}) => {
    if (pending) return Promise.reject('Background removal is already running.');
    if (!ArrayBuffer.isView(png) || png.byteLength > 80 * 1024 * 1024) return Promise.reject('Image is too large for local background removal.');
    show('Starting AI background removal on this PC...'); cancel.hidden = false;
    if (!worker) {
      const script = new URL('./background-worker.js?v=__BACKGROUND_WORKER_VERSION__', location.href);
      worker = new Worker(script, {type: 'module'});
      worker.onmessage = ({data}) => {
        if (data.type === 'progress') {show(data.message); return;}
        if (!pending) return;
        if (data.type === 'result') {
          // The Rust module lives in the iframe's realm.
          const bytes = new frame.contentWindow.Uint8Array(data.alpha);
          pending.resolve(bytes); reset(); show('Mask calculated. Applying it to the source layer...');
        } else if (data.type === 'error') {
          pending.reject(data.message); reset(); show('AI removal failed: ' + data.message + '. Try Remove Background (Quick).');
          worker.terminate(); worker = null;
        }
      };
      worker.onerror = () => stop('The AI worker stopped. Try Remove Background (Quick), or close other tabs and retry.');
    }
    return new Promise((resolve, reject) => {
      pending = {resolve, reject};
      const bytes = new Uint8Array(png).buffer;
      worker.postMessage({png: bytes}, [bytes]);
    });
  };
  window.photocraftBackgroundComplete = show;
  cancel.addEventListener('click', () => stop('Background removal cancelled. The original was kept.'));
  document.getElementById('background-dismiss').addEventListener('click', () => {if (!pending) panel.hidden = true;});
  frame.addEventListener('load', () => {
    if (pending) stop('The editor restarted. The background-removal result was discarded.');
  });
})();
