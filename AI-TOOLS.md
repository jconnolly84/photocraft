# Local AI subject tools

Select a raster image or placed Smart Object, then use the **Select** menu:

- **Select Subject (AI)** creates a normal editable selection. It changes no image layers.
- **Blur Background (AI)…** finds the subject, then opens a blur slider and preview. Apply creates a masked subject and a separate blurred background.
- **Replace Background (AI)…** offers a solid colour, a two-colour gradient or a local PNG/JPEG/WebP. An uploaded background fills the canvas and crops centrally to fit.
- **Remove Background** keeps its existing mask workflow. **Remove Background (Quick)** remains available.
- **Refine Cutout…** adjusts the edge inward/outward by up to 8 pixels and adds up to 8 pixels of softness. It reuses an enabled layer mask; otherwise it finds the subject with the existing model. Apply replaces the mask, preserving the image pixels. Undo restores the previous mask. Existing mask feathering is retained.

Use **Image → Auto Enhance…** for a restrained automatic colour/contrast correction,
with a 0–100% strength slider and original comparison. It uses image processing,
not a generative AI model. Apply makes an enhanced raster layer with the original
image hidden underneath; masks, opacity and blending settings are retained.
An original Smart Object stays available underneath the raster result.

The background tools hide the original image underneath their new layers. Each
completed tool is one Undo step. Existing masks are intersected with the new
subject mask; the original layer and its pixels remain available. The preview
shows the selected image and background, not the other layers in the document.
The finishing previews likewise show the selected layer only. Refine Cutout
can tighten a fringe or soften an edge; it cannot reconstruct missing hair or
invent detail. Use the mask brush for local corrections. A resized preview is
approximate; Apply processes the original image dimensions.
Save an editable project to keep the layers after closing the browser.

## Enhance Resolution 2× (AI)

Select an unlocked raster image or placed Smart Object and choose
**Image → Enhance Resolution 2× (AI)…**. A centre-detail preview compares the
real AI result with a smooth 2× enlargement. Apply processes the whole captured
image and inserts a new embedded Smart Object above the hidden original.

The embedded PNG has twice the width and height of the captured layer pixels.
The new layer starts at the same position and displayed size, preserving the
advert layout and its existing mask. Use Transform to enlarge the new layer,
or Edit Contents to open the double-resolution image. The canvas size and
the resolution of an ordinary canvas export are unchanged by this operation.
This avoids discarding the extra pixels in a raster layer at the old size.
Undo restores the original in one step. Preserve the Smart Object by saving
an editable project; a flattened PNG/JPEG only keeps the exported canvas pixels.

The input limit is **1,048,576 pixels** (one megapixel), with at most 4096 pixels
per side, producing up to four megapixels. Oversized inputs are refused before model work, without a silent
resize. Transparency is resized separately from RGB; the model does not infer
new transparency or re-run background removal. Existing document-space masks
and blending settings are retained on the new Smart Object.

QuickSRNet Small 2x is a 93,836-byte, BSD-3-Clause model from Qualcomm's official
checkpoint, converted to ONNX with the learned weights unchanged. The source,
licence, notices, hashes and reproducible export live in the repository. The
model is checksum-verified and downloaded only when this tool is selected;
it shares the existing ONNX runtime and local worker. 128-pixel tiles with a
4-pixel halo bound inference memory and avoid tile seams. Progress and Cancel
stay available. Preview comparison reuses pixels and does not run inference.
Cancel before Apply skips whole-image processing. Editing/switching documents
while it runs rejects the stale result. No images are uploaded.

Verification: `node scripts/test_upscale.cjs` (tiling/alpha/limits),
`python scripts/test_upscale_model.py` (actual model and tile/whole agreement),
and `upscaling_keeps_true_double_resolution_and_layout_with_one_undo` in the
native subject-tool tests. AI can improve reconstructed edges; results vary,
and it cannot recover exact details missing from the original.

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

Auto Enhance and refinement of an existing mask do not download or run the AI
model. Enhancement samples colour statistics at a maximum 1024-pixel edge;
preview changes process at most 480 × 360 pixels. Full-size enhancement and
linear-time mask operations run in the worker only on Apply. No additional
runtime, model or external service is added.

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
Image operation tests: `node scripts/test_image_finish.cjs`.
Native selection, layer preservation, pixel placement, stale-result and Undo
tests: `cargo test -p photocraft-engine --lib school_subject_tools_tests` in
the patched official source. The existing idle-repaint tests exercise the
production poll function, including completion without another mouse event.
