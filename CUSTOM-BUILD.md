# PhotoCraft font category build

This host now maintains a small custom patch of official PhotoCraft v0.23.1,
source commit `45066c48292e92229ada3459a83453439514c83d`.
The original checksum-verified release remains under `photocraft/` in the repository.

## Change

The native font menu's category lookup uses a curated class for every hosted
family even before its font bytes download. It retains actual weight, PANOSE
and format metadata once a font has loaded. Unknown families retain the upstream
behaviour. Common Windows family names have class hints too; no Microsoft font
bytes are embedded or published. Fonts remain lazily loaded.

`scripts/patch_photocraft_source.py` applies a guarded patch to the one UI file
`crates/ui-egui/src/text/font_filters.rs` and generates `host_font_classes.rs`
from our hosted catalog plus the common Windows names. It stops if upstream's
expected code has changed. Upstream code, credits and licences are preserved.

## Rebuild

Run the **Build custom PhotoCraft font categories** workflow. It checks out the
exact official commit, applies the patch, loads pinned translations, and builds
both app and boot module with upstream's `packaging/web/package.sh` and Trunk
0.21.14. The resulting archive is a workflow artifact, not an official release.

The independent **Test custom PhotoCraft font categories** workflow compiles
the exact patched helper functions and upstream data-type definitions with
rustc, checks every hosted family before download, and checks preservation of
loaded font traits. This is a focused regression harness, not the full native
PhotoCraft test suite. The WebAssembly build checks the complete app integration.

After a successful build and review, stage its entire archive as the host's
custom build. Keep the original release for rollback. Do not mix glue, boot
modules and app parts across builds.

## Published and verified

Build workflow `43654832257` succeeded, including upstream packaging and source
layer checks. Its full archive is preserved under `custom-build/web`, with hashes
and source details in `custom-build/BUILD.json`, and the exact diff in
`custom-build/source.patch`. The original release is still under `photocraft/`.

The served app lives at a per-build URL (`build-43654832257/`) and the wrapper
selects it through a fingerprinted config script. This prevents Pages' fixed
10-minute cache from mixing old manifests/glue with new app parts. Every host
script is also fingerprinted. A changed font catalog requires a fresh custom
build; deployment checks its normalized-content hash before publishing.

Live browser checks confirmed the built-in Serif and Decorative categories
list their correct fonts before download, including the new DaFont families.
The focused Rust harness passed all three tests (every hosted classification,
actual menu filter results, and preservation of loaded font traits).


## Recovery, clipboard and background removal

The current build also exposes upstream `layer.removeBackground` under Select,
adds PNG export to the browser clipboard, and connects native full-document
.pcraft autosave/recovery to the host's local IndexedDB store. The exact native
changes are in `custom-build/source.patch`; reproducible integration is in
`scripts/patch_extra_features.py` and `custom-source/browser_recovery.rs`.
Previous build 43641177593 is preserved under `custom-build/previous/`.

Remove Background uses the upstream heuristic subject detector and adds an
undoable layer mask. It supports raster layers and Smart Objects; Smart Object content remains
editable beneath the new mask. Complex subjects and hair may need manual mask refinement.


## AI upgrade verification

Select > Remove Background now uses the local BiRefNet Lite 512 worker through
an explicit Rust host service. Remove Background (Quick) retains the heuristic.
`BACKGROUND-REMOVAL.md` documents download size, local processing, limits and
licences. `scripts/patch_ai_background.py` and `custom-source/browser_background.rs`
wire the service; `custom-source/background_mask.rs` validates and applies its
result as one undoable engine edit only to the unchanged source revision.

The final browser build compiled, packaged and passed source layer checks in run
43654832257. The menu/Smart Object native regressions passed in run 43647163896
(nine cutout tests and one actual menu test); all three classification tests
passed for the expanded 72-family catalog in run 43647842593. Host clipboard,
recovery, font access, shortcuts and AI cancellation/restart tests passed too.
Live checks verified external Edit > Paste, internal Copy/Paste, the AI mask on a
Smart Object, Undo, cancellation and rejecting a stale result. The native
Blackletter category listed all six families; UnifrakturCook downloaded and
rendered its Blackletter preview. Test photos are not shipped.


## Idle repaint and school workspace defaults

The AI completion bridge now wakes egui when its promise settles and explicitly
requests a UI paint after applying the mask. The real egui regression harness
executes the production poll function on an idle context: the pre-fix behavior
fails, and both successful completion and failure/cancellation pass with the fix
(workflow 43652394217). This test is included in future custom build workflows.
A live check ran Remove Background, then waited without another input event;
the transparent background appeared automatically with the original tool kept.

The Essentials workspace defaults to History above Layers. A one-time migration
updates existing Essentials layouts; named custom workspaces remain untouched,
and later layout changes are remembered normally. The reproducible patch is
scripts/patch_default_panels.py. Build 43654832257 contains both changes and
passed compilation, upstream packaging and source layer checks. All app, model
and font bytes were verified during static-site staging.


## User font-file loading

The host accepts staged .ttf/.otf files through Fonts & import, validates bounded
SFNT naming metadata and browser font decoding, and applies them through the
existing session-only font worker. Applying is an explicit editor restart;
choosing or cancelling staged files does not touch the document. The font worker
URL is fingerprinted to avoid mixing old and new handlers in Pages caches.

Live Chrome tests loaded Berkshire Swash TTF and Source Code Pro OTF together,
then rendered both in PhotoCraft's own font picker. The final native defaults
also keep History and Layers visible after importing from an empty workspace.
Native named/saved workspaces still restore their own layouts. Private test font
files were kept outside the repository and are not in the Pages artifact.

## Background removal during Free Transform

The previous idle repaint fix did not close an active Free Transform preview.
The browser menu now delegates to the regular app command path, which commits
the transform before starting inference. Its existing asynchronous commit queue
also handles larger transforms; failed commits do not start removal. Both AI
and Quick removal commit pending transforms before changing the document.
The menu regression creates a raster image, opens and translates Free Transform,
invokes the actual removal menu, and checks that the preview is closed and the
model service receives the translated pixels at the current document revision.
Build 43678802137 passed upstream web packaging/layer checks, nine engine
cutout regressions, both menu regressions (including the active-transform case),
and both idle repaint regressions. Static staging verified all 15 app files,
model assets and licensed font files before publication.
