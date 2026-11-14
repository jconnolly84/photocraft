/* Hosting integration only: the official PhotoCraft release is unmodified. */
(() => {
  const frame = document.getElementById('editor');
  frame.addEventListener('load', () => {
    const win = frame.contentWindow;
    const handle = (event) => {
      if (event.isComposing || event.getModifierState('AltGraph')) return;
      // Preserve normal typing, clipboard operations and native text-field actions.
      const target = event.target;
      if (!(target instanceof win.Element)) return;
      const editing = target.closest('input, textarea, [contenteditable="true"]');
      if (editing) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey && event.altKey && !event.metaKey && key === 't') {
        event.preventDefault();
        event.stopImmediatePropagation();
        // Send the existing upstream Transform shortcut to the same focused target.
        target.dispatchEvent(new win.KeyboardEvent(event.type, {
          key: event.shiftKey ? 'T' : 't', code: 'KeyT',
          ctrlKey: true, shiftKey: event.shiftKey, altKey: false,
          bubbles: true, cancelable: true, repeat: event.repeat,
          location: event.location,
        }));
        return;
      }
      // Let PhotoCraft receive the original event; cancel only the browser action.
      // Ctrl+T/W/N/L remain browser-reserved in ordinary tabs.
      if ((event.ctrlKey || event.metaKey) && !event.altKey &&
          ['d', 'o', 's', 'p', 'r', 'u', 'f', 'g', 'h', 'j', 'k', 'b', '=', '+', '-', '0'].includes(key)) {
        event.preventDefault();
      }
    };
    win.addEventListener('keydown', handle, { capture: true, passive: false });
    win.addEventListener('keyup', handle, { capture: true, passive: false });
  });
  // Keep renderer flags (?webgl, ?cpu) and any upstream fragment usable.
  frame.src = (window.PHOTOCRAFT_EDITOR_PATH || './photocraft/') + window.location.search + window.location.hash;
})();
