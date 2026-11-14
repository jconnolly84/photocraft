# Browser image paste

For an image copied from another browser tab, choose **Copy image**, then return
to PhotoCraft and use **Paste image** in the top toolbar. Allow clipboard access
if the browser asks. The image opens as a new document if none is open; otherwise
it is placed as an image layer (confirm placement with Enter).

Ctrl+V also has an image-paste-event adapter when the browser supplies image data
to the focused editor. Plain text paste and the editor's own copy/paste continue
through PhotoCraft's existing handlers. The native Edit → Paste menu still uses
PhotoCraft's internal clipboard: use the host's **Paste image** for external images.

The adapter reads supported image bytes from the clipboard and passes a File
directly to the unchanged browser file-drop decoder. No image bytes are uploaded.
Copying an image address/link alone supplies text and does not provide an image.

Live verification (2026-11-14): a 128×96 PNG clipboard fixture opened as a new
document with the correct dimensions, then pasted into it as a separate image
layer. Ctrl+V routing has automated unit coverage; the browser automation did not
produce a native keyboard paste event, so that keyboard route remains a manual
browser check. Permission denial and text/internal clipboard exclusions are tested.


The current custom build exports raster Copy / Copy Merged image results as PNG
to the browser clipboard as well as retaining PhotoCraft's internal clipboard.
The toolbar reports success or permission errors. Live testing confirmed Edit
Copy exported image/png bytes, and the toolbar imported image bytes. Browser
clipboard permissions may still be required on managed school machines.

The shortcut hint, credits and controls now share one toolbar. Hide tools leaves
a small Show tools button at the top-right; this choice persists across reloads.
