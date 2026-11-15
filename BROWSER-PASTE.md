# Browser image paste

For an image copied from another browser tab, choose **Copy image**, then return
to PhotoCraft and use **Paste image** in the top toolbar. Allow clipboard access
if the browser asks. The image opens as a new document if none is open; otherwise
it is placed as an image layer (confirm placement with Enter).

Ctrl+V also has an image-paste-event adapter when the browser supplies image data
to the focused editor. Plain text paste and the editor's own copy/paste continue
through PhotoCraft's existing handlers. Edit → Paste uses the browser image adapter too, while keeping native editable
copies on PhotoCraft's internal clipboard route.

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

Menu integration regression coverage checks that Paste is enabled without a
clipboard read (which could prompt), and starts exactly one read on a click.
The host's test covers the shared menu/toolbar delivery path and internal-copy
fallback. Text editing retains PhotoCraft's text-paste behavior.

Live custom-build verification (2026-11-14): Edit > Paste opened an external PNG
from an empty workspace, then placed it into the document as a Smart Object.
Edit > Copy followed by Edit > Paste took the native internal path and added a
pixel layer, without reading the external clipboard again.

## One paste per Ctrl+V gesture

The browser DOM paste event and native Edit → Paste callback previously raced:
the DOM image was placed immediately, then an asynchronous clipboard read could
place it again. If AI removal had started, that second placement correctly
invalidated its document-revision check.

External Ctrl+V now keeps the browser default paste action but stops the raw key
from also queuing the app command. Image paste events and any already-started
native callback share an intent; whichever delivers first claims it. Guards
after clipboard reads and blob conversion reject duplicate or obsolete results,
including reads from a replaced editor or earlier paste. Separate key presses
and explicit menu/toolbar requests still paste separately, even identical bytes.
Internal Copy cancels older external reads and retains the native editable path.
Ordinary text paste remains on its DOM/eframe route. No image hashes or blanket
time-based duplicate-image suppression are used. AI revision checks are unchanged.

The regression reproduces the old extra placement with a delayed read (fails
against the previous production script) and passes with the fix in both race
orders. It also tests delayed blob conversion, menu clicks during a pending
read, separate gestures, permission errors, internal copies and editor restarts.

Live Chrome verification (2026-11-15): a real PNG clipboard and Ctrl+V produced
one image layer and one Place Embedded entry in a blank document. Select →
Remove Background committed its active transform and completed with one masked
image layer, without switching tools or receiving a delayed second placement.
A real text Ctrl+V replaced selected Type-tool text correctly. The test used a
public test portrait on an isolated localhost origin; the prior clipboard was
restored afterwards. No student documents were used or uploaded.
