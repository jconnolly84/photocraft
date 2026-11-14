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
