# Background removal

Select > Remove Background runs BiRefNet Lite in a browser worker and adds the
result as a layer mask. The selected raster layer or Smart Object stays editable.
Undo restores its previous mask and background. Select > Remove Background
(Quick) retains PhotoCraft's original heuristic for fast/offline fallback.

The pinned MIT-licensed 512 x 512 ONNX export is hosted with the site. This avoids
the memory failure of the original 1024 x 1024 ONNX export. The model has a 192 MB
first-use download, plus the selected ONNX runtime files. Subsequent requests
reuse the worker; verified public model parts may be cached in the browser.
Inference uses single-threaded Wasm in a worker, without requiring GPU drivers.
Actual times vary by PC, browser, drivers and other open tabs. Progress, Cancel
and failure messages remain visible even when the toolbar is hidden.

No image is sent to an inference server. Only static model/runtime files are
fetched. The image and resulting mask stay in memory; the model cache stores
only public weights. Existing local document recovery is separate. Attribution,
licences, exact source revision and file hashes are under ai-assets/.

Input layer bounds are limited to 16 megapixels. The model analyzes a resized
512-pixel input and upsamples a soft mask to the original layer bounds. Fine hair,
transparent objects and difficult subjects can still need manual mask cleanup.
The result applies only if the source document and revision are unchanged; edits,
closing/switching documents, a cancelled request or an editor restart cannot put
a delayed mask onto the wrong document. Locked layers stay protected.

Automated host tests cover byte preservation, concurrent-request exclusion,
worker reuse, cancellation, editor restarts and inference failures. The font and
clipboard changes also retain their regression tests.

Live model validation (2026-11-14): a portrait's background was removed while
preserving the main hair silhouette. The CPU-only reference test completed in
8 seconds and matched the GPU-assisted test's mask. These are measurements in
the test browser, not a timing promise for every school PC. No test portrait is
included in the published repository.

The compiled editor integration was also verified on a Smart Object: the mask
applied, Undo restored the original, Cancel kept the original, and editing the
document during processing rejected the delayed result. The exact staged app
was used for these checks before publication.

Completion now wakes the idle editor and explicitly requests a canvas repaint.
A no-input browser check verified that the background becomes transparent
without switching to the Eraser or clicking another tool. The egui regression
harness proves the old behavior fails and the fixed completion/error paths pass.
