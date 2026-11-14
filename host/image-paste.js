/* Bridge browser clipboard images to PhotoCraft's existing file-drop decoder. */
(() => {
  const frame = document.getElementById('editor');
  const button = document.getElementById('paste-image');
  const status = document.getElementById('paste-image-status');
  const supported = type => /^image\/(png|jpeg|webp|gif|bmp|svg\+xml)$/i.test(type);

  function deliver(files) {
    const win = frame.contentWindow;
    const canvas = frame.contentDocument?.getElementById('photocraft_canvas');
    if (!canvas || !win.DataTransfer || !win.DragEvent) {
      throw new Error('The editor is not ready. Try again once it has loaded.');
    }
    const data = new win.DataTransfer();
    for (const file of files) data.items.add(file);
    const rect = canvas.getBoundingClientRect();
    canvas.focus();
    canvas.dispatchEvent(new win.DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: data,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
    }));
    status.textContent = 'Image sent to the editor.';
  }
  frame.addEventListener('load', () => {
    frame.contentWindow.addEventListener('paste', event => {
      const files = Array.from(event.clipboardData?.items || [])
        .filter(item => item.kind === 'file' && supported(item.type))
        .map(item => item.getAsFile()).filter(Boolean);
      if (!files.length) return; // Preserve normal text and PhotoCraft's internal clipboard.
      try {
        deliver(files);
        event.preventDefault();
        event.stopImmediatePropagation(); // Avoid a second import by eframe's paste handler.
      } catch (error) { status.textContent = error.message; }
    }, {capture: true});
  });
  button.addEventListener('click', async () => {
    if (!navigator.clipboard?.read) {
      status.textContent = 'Click the editor and press Ctrl+V, or use Open to choose an image.';
      return;
    }
    button.disabled = true;
    try {
      const items = await navigator.clipboard.read();
      const files = [];
      for (const item of items) {
        const type = item.types.find(supported);
        if (!type) continue;
        const blob = await item.getType(type);
        const extension = type === 'image/jpeg' ? 'jpg' : type === 'image/svg+xml' ? 'svg' : type.split('/')[1];
        files.push(new File([blob], `Clipboard image.${extension}`, {type}));
      }
      if (!files.length) throw new Error('No image was provided. Use Copy image in the other tab, then try again.');
      deliver(files);
    } catch (error) {
      status.textContent = error.name === 'NotAllowedError'
        ? 'Clipboard access was blocked. Allow it in Chrome, or click the editor and press Ctrl+V.'
        : error.message;
    } finally { button.disabled = false; }
  });
})();
