/* Local-only adapter for PhotoCraft's supported served-font manifest. */
(() => {
  const enable = document.getElementById('enable-local-fonts');
  const disable = document.getElementById('disable-local-fonts');
  const status = document.getElementById('local-font-status');
  const frame = document.getElementById('editor');
  let fonts = new Map();
  let ownerId;
  const clean = value => typeof value === 'string' && value.length > 0 && !/[|\r\n\x00-\x1f]/.test(value);
  if (!('queryLocalFonts' in window) || !('serviceWorker' in navigator)) {
    enable.disabled = true;
    status.textContent = 'Local fonts need desktop Chrome or Edge with local font access allowed. The hosted font library is still available.';
    return;
  }
  status.textContent = 'Off. Your browser will ask permission when you enable this.';

  // Respond only to our own service worker. No font bytes go to network fetch().
  navigator.serviceWorker.addEventListener('message', async event => {
    const port = event.ports[0];
    if (!port || event.data?.type !== 'photocraft-local-font') return;
    try {
      if (event.data.action === 'manifest') {
        port.postMessage({rows: [...fonts.values()].map(font => ({
          family: font.family, style: font.style, postscriptName: font.postscriptName,
        }))});
      } else if (event.data.action === 'bytes') {
        const font = fonts.get(event.data.name);
        if (!font) throw new Error('Font unavailable');
        const bytes = await (await font.blob()).arrayBuffer();
        port.postMessage({bytes}, [bytes]);
      }
    } catch {
      port.postMessage({error: 'Local font access failed. Re-enable PC fonts or use a hosted font.'});
    } finally { port.close(); }
  });

  function restart(id) {
    const url = new URL(window.PHOTOCRAFT_EDITOR_PATH || './photocraft/', window.location.href);
    url.search = window.location.search;
    url.searchParams.delete('local_fonts');
    if (id) url.searchParams.set('local_fonts', id);
    url.hash = window.location.hash;
    frame.src = url.href;
  }
  async function connect() {
    const registration = await navigator.serviceWorker.register('./local-font-worker.js', {scope: './', updateViaCache: 'none'});
    const worker = registration.installing || registration.waiting || registration.active;
    if (worker.state !== 'activated') {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Font adapter did not start. Please try again.')), 20000);
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') { clearTimeout(timer); resolve(); }
          else if (worker.state === 'redundant') { clearTimeout(timer); reject(new Error('Font adapter could not start.')); }
        });
      });
    }
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => reject(new Error('Font adapter did not respond.')), 10000);
      channel.port1.onmessage = event => {
        clearTimeout(timer); channel.port1.close();
        event.data.ownerId ? resolve(event.data.ownerId) : reject(new Error('Font adapter connection failed.'));
      };
      registration.active.postMessage({type: 'photocraft-font-owner'}, [channel.port2]);
    });
  }
  enable.addEventListener('click', async () => {
    if (!window.confirm('Save or export any open work first. Enabling PC fonts restarts the editor and discards unsaved work. Continue?')) return;
    enable.disabled = true;
    status.textContent = 'Waiting for font permission…';
    try {
      // Request directly from the user's click, before awaiting service worker setup.
      const available = await window.queryLocalFonts();
      const selected = new Map(available.filter(font =>
        clean(font.family) && clean(font.style) && clean(font.postscriptName))
        .map(font => [font.postscriptName, font]));
      if (!selected.size) throw new Error('The browser returned no usable local fonts.');
      ownerId = await connect();
      fonts = selected;
      restart(ownerId);
      status.textContent = `${fonts.size} local font faces available. They load on demand and remain on this PC. Re-enable after reopening this page.`;
      disable.hidden = false;
      enable.textContent = 'Refresh PC font list';
    } catch (error) {
      status.textContent = error.name === 'NotAllowedError'
        ? 'Font access was not allowed. Allow local fonts in browser site settings, or ask school IT if managed policy blocks it. Hosted fonts still work.'
        : (error.message || 'Local fonts could not be enabled. Hosted fonts still work.');
    } finally { enable.disabled = false; }
  });
  disable.addEventListener('click', () => {
    if (!window.confirm('Save or export any open work first. Disabling PC fonts restarts the editor and discards unsaved work. Continue?')) return;
    fonts.clear();
    restart();
    disable.hidden = true;
    enable.textContent = 'Use fonts from this PC';
    status.textContent = 'PC fonts off. The hosted font library is still available. You can revoke local font permission in browser site settings.';
  });
})();
