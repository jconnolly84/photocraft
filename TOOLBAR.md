# Classroom toolbar preset

The default visible buttons follow the compact toolbar in the supplied reference:

Move, Rectangular Marquee, Magic Wand, Crop, Spot Healing, Eraser, Paint Bucket,
Blur, Type, Pen, Path Selection, Rectangle, Hand and Zoom.

Gradient remains enabled inside the Paint Bucket flyout. Press and hold the
button to choose it. The existing last-used tool behaviour still applies after
choosing a different member of a group.

These are 14 slots with 15 enabled tools. The other 54 tools are unchecked in
Edit → Keyboard Shortcuts and Menus → Toolbar. They remain installed and can
be enabled there; this does not remove their commands or erase user shortcuts.
Restore Defaults in that tab restores the classroom visibility preset.

`scripts/patch_default_toolbar.py` changes native defaults and performs a
one-time browser migration (`photocraft.compact-toolbar.v1`). Later toolbar
customisations are remembered. A native regression checks the exact visible
slot order, Paint Bucket/Gradient group, hidden tools and missing-key defaults.

The tab favicon is the unmodified `assets/app-icon/photocraft.ico` from official
PhotoCraft v0.23.1, commit `45066c48292e92229ada3459a83453439514c83d`.
SHA256: `7f43b2116edbd7a32ed3f3507d11d55b5f23f70caec72a0b56d90ce86e7f6f94`.
Its original licence notice is retained in `host/FAVICON-LICENSE.txt`; the
release's full MIT and Apache licence texts remain in the deployed app folder.

The staged build from workflow 43681423326 was checked in Chrome on a fresh
localhost origin: a new blank document showed the compact toolbar with Paint
Bucket first, its flyout listed Paint Bucket and Gradient, and the actual
Toolbar dialog showed the extra tools unchecked. App and font bytes passed
static-site staging verification. The favicon returned HTTP 200 with
`image/vnd.microsoft.icon` on Pages.
