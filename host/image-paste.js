/* Bridge browser clipboard images to PhotoCraft's existing file-drop decoder. */
(() => {
  const frame = document.getElementById('editor');
  const button = document.getElementById('paste-image');
  const status = document.getElementById('paste-image-status');
  let preferInternalClipboard = false;
  let generation = 0;
  let latestIntent;
  let keyboardIntent;
  const beginIntent = () => (latestIntent = {generation, started: Date.now(), delivered: false, reading: false});
  const currentKeyboardIntent = () => keyboardIntent === latestIntent &&
    keyboardIntent?.generation === generation && Date.now() - keyboardIntent.started < 1500 ? keyboardIntent : null;
  const live = intent => intent === latestIntent && intent.generation === generation;
  const updateButton = () => {button.disabled = Boolean(latestIntent?.reading && !latestIntent.delivered);};
  const copiedInternally = () => {
    preferInternalClipboard = true;
    latestIntent = keyboardIntent = null;
    updateButton();
  };
  window.photocraftBrowserCopied = copiedInternally;
  const supported = type => /^image\/(png|jpeg|webp|gif|bmp|svg\+xml)$/i.test(type);

  function deliver(files, intent) {
    if (!live(intent) || intent.delivered) return;
    const win = frame.contentWindow;
    const canvas = frame.contentDocument?.getElementById('photocraft_canvas');
    if (!canvas || !win.DataTransfer || !win.DragEvent) {
      throw new Error('The editor is not ready. Try again once it has loaded.');
    }
    const data = new win.DataTransfer();
    for (const file of files) data.items.add(file);
    const rect = canvas.getBoundingClientRect();
    canvas.focus();
    const event = new win.DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: data,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
    });
    // The key command and DOM paste event can both run for one Ctrl+V.
    // Claim delivery before dispatch, including re-entrant native callbacks.
    intent.delivered = true;
    canvas.dispatchEvent(event);
    updateButton();
    status.textContent = 'Image sent to the editor.';
  }
  frame.addEventListener('load', () => {
    generation++;
    latestIntent = keyboardIntent = null;
    updateButton();
    const win = frame.contentWindow;
    preferInternalClipboard = false;
    // PhotoCraft's editable layer clipboard may not be exported to the browser.
    // Keep a copy/paste made wholly inside the editor on its native path.
    win.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if (key !== 'v') keyboardIntent = null;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && key === 'v' && !preferInternalClipboard) {
        if (!event.repeat) keyboardIntent = beginIntent();
        // Keep Chrome's default action, which supplies the actual paste event,
        // but do not also queue the app's Ctrl+V command and browser read.
        // Text paste still reaches eframe through its normal paste event.
        event.stopImmediatePropagation();
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && ['c', 'x'].includes(key)) {
        copiedInternally();
      }
    }, {capture: true});
    // An actual menu click is a new paste request, even just after Ctrl+V.
    // Pending reads retain their own intent and cannot redeliver its image.
    win.addEventListener('pointerdown', () => {keyboardIntent = null;}, {capture: true});
    win.addEventListener('blur', () => {preferInternalClipboard = false;});
    win.addEventListener('paste', event => {
      if (preferInternalClipboard) return;
      const files = Array.from(event.clipboardData?.items || [])
        .filter(item => item.kind === 'file' && supported(item.type))
        .map(item => item.getAsFile()).filter(Boolean);
      if (!files.length) return; // Preserve normal text and PhotoCraft's internal clipboard.
      const intent = currentKeyboardIntent() || beginIntent();
      event.preventDefault();
      event.stopImmediatePropagation(); // Never also let eframe import this DOM image.
      try {
        deliver(files, intent);
      } catch (error) { status.textContent = error.message; }
    }, {capture: true});
  });
  async function pasteFromBrowser(intent = beginIntent()) {
    if (!live(intent) || intent.delivered || intent.reading) return;
    if (!navigator.clipboard?.read) {
      status.textContent = 'Click the editor and press Ctrl+V, or use Open to choose an image.';
      return;
    }
    intent.reading = true;
    updateButton();
    try {
      const items = await navigator.clipboard.read();
      if (!live(intent) || intent.delivered) return;
      const files = [];
      for (const item of items) {
        const type = item.types.find(supported);
        if (!type) continue;
        const blob = await item.getType(type);
        if (!live(intent) || intent.delivered) return;
        const extension = type === 'image/jpeg' ? 'jpg' : type === 'image/svg+xml' ? 'svg' : type.split('/')[1];
        files.push(new File([blob], `Clipboard image.${extension}`, {type}));
      }
      if (!files.length) throw new Error('No image was provided. Use Copy image in the other tab, then try again.');
      deliver(files, intent);
    } catch (error) {
      if (!live(intent) || intent.delivered) return;
      status.textContent = error.name === 'NotAllowedError'
        ? 'Clipboard access was blocked. Allow it in Chrome, or click the editor and press Ctrl+V.'
        : error.message;
    } finally { intent.reading = false; updateButton(); }
  }
  button.addEventListener('click', () => pasteFromBrowser());
  window.photocraftBrowserPaste = () => {
    // Native editable copies keep their layers/text; external images use the
    // same asynchronous decoder as Ctrl+V and the toolbar button.
    if (preferInternalClipboard) return false;
    void pasteFromBrowser(currentKeyboardIntent() || beginIntent());
    return true;
  };
})();
