# Local AI subject tools

Select a raster image or placed Smart Object, then use the **Select** menu:

- **Select Subject (AI)** creates a normal editable selection. It changes no image layers.
- **Blur Background (AI)…** finds the subject, then opens a blur slider and preview. Apply creates a masked subject and a separate blurred background.
- **Replace Background (AI)…** offers a solid colour, a two-colour gradient or a local PNG/JPEG/WebP. An uploaded background fills the canvas and crops centrally to fit.
- **Remove Background** keeps its existing mask workflow. **Remove Background (Quick)** remains available.

The background tools hide the original image underneath their new layers. Each
completed tool is one Undo step. Existing masks are intersected with the new
subject mask; the original layer and its pixels remain available. The preview
shows the selected image and background, not the other layers in the document.
Save an editable project to keep the layers after closing the browser.

## Responsiveness and privacy

All four tools share the existing BiRefNet Lite 512 model and one lazily started
worker. Opening the app or editing normally does not load the AI runtime or run
inference. Model files are cached in the browser after the first download
(approximately 192 MB). No additional AI model is added by these tools.

The worker keeps one 512 × 512 byte mask (256 KB), keyed by the source PNG's
SHA-256. An unchanged image reuses it; changed source bytes invalidate it.
Changing preview settings does not run AI. Previews are at most 480 × 360;
mask-aware blur filter work is capped at a 2048-pixel working edge before returning a
background at the source image's size. Replacement backgrounds render at the
document's size. Stopping an active worker releases its model and mask cache;
cancelling the options dialog keeps the warm worker available. Closing the
page releases both.

Image and canvas processing is capped at 16 megapixels, with an 80 MB encoded
file limit. Full-resolution background processing occurs only on Apply. A
progress panel and Cancel remain available while processing. Editing or
switching documents during inference can invalidate the result; it is then
discarded without changing the document.

Student images and uploaded background files stay on the device. Only the
static runtime and model assets are fetched. There is no inference API,
account, backend or image upload.

## Verification

Host lifecycle/settings tests: `node scripts/test_background_removal.cjs`.
Worker cache/limits tests: `node scripts/test_subject_worker.cjs`.
Native selection, layer preservation, pixel placement, stale-result and Undo
tests: `cargo test -p photocraft-engine --lib school_subject_tools_tests` in
the patched official source. The existing idle-repaint tests exercise the
production poll function, including completion without another mouse event.
