(() => {
  const banner = document.getElementById('shortcut-banner');
  const key = 'photocraft.shortcut-banner-dismissed';
  try {
    banner.hidden = localStorage.getItem(key) === 'true';
  } catch { /* Dismissal still works when browser storage is unavailable. */ }
  document.getElementById('dismiss-banner').addEventListener('click', () => {
    banner.hidden = true;
    try { localStorage.setItem(key, 'true'); } catch { /* Session-only dismissal. */ }
    document.getElementById('editor').focus();
  });
})();
