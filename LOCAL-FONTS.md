# Fonts installed on this PC

Open https://jconnolly84.github.io/photocraft/, expand **PC fonts** in the
bottom-right corner, and choose **Use fonts from this PC**. Save/export first:
enabling, refreshing or disabling the local font list restarts the editor.
Confirm the restart, then allow the browser's local font permission prompt.
The installed families and styles join the type tool's font menu. Matching
family/style faces take precedence over hosted alternatives.

Desktop Chrome and Edge support this feature. Unsupported browsers retain the
hosted font library; denied permissions and managed-school restrictions show a
message. Local fonts must be re-enabled after reopening/reloading the wrapper.
Permission may be remembered by the browser; revoke it through site settings.
Font availability depends on the PC: documents opened elsewhere may need those
fonts installed there, or manually chosen alternatives.

## Local data flow

- The top-level wrapper calls `queryLocalFonts()` only after a button click and
  restart confirmation. No font listing occurs automatically on page load.
- A scope-limited service worker adds local entries to PhotoCraft's font manifest
  for that editor session. Virtual font URLs are handled inside the browser.
- When selected, `FontData.blob()` returns font bytes to the service worker over
  a MessageChannel and then to PhotoCraft's unchanged font loader.
- No font files or names are uploaded. No font bytes or names are stored in
  Cache Storage, IndexedDB, localStorage, the repository, or the server.
  Only the adapter's JavaScript is installed as a browser service worker.
- Each editor is tied to its own wrapper client; a separate tab gets no access
  to another tab's local font session. Ordinary app files pass through unchanged.
- Local font responses use `Cache-Control: no-store`. Missing/denied local fonts
  return 404 rather than falling back to any network request for those fonts.
- The installed-font permission remains governed by the browser. Using fonts
  already installed locally does not publish them as public web fonts.

`node scripts/test_local_fonts.cjs` checks manifest merging, byte preservation,
tab isolation, lack of network font requests, and normal request passthrough.

API reference: https://developer.chrome.com/docs/capabilities/web-apis/local-fonts
