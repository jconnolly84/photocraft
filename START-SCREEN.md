# PhotoCraft project hub

The school web build uses a native egui Home screen with PhotoCraft's original
brand mark, clear create/open actions, four illustrated classroom canvas
presets, a browse/drop area, short expandable guides and device-local saving
advice. There is no additional marketing page or third-party branding.

The visual style uses a navy studio hero, oversized headline, lime primary
action, cobalt/lilac/coral/lime canvas cards and original layered poster
artwork painted by egui. It adds no external image dependencies. The hero
artwork is omitted on narrow screens; presets wrap, categories wrap and the
hub scrolls so its actions and guides remain reachable.

Preset actions open the actual New Project dialog for review. A4 portrait and
landscape use 2480 × 3508 and 3508 × 2480 pixels at 300 ppi; Presentation is
1920 × 1080 and Square artwork 1080 × 1080. The existing print/screen resolution
preferences, editable dimensions, orientation controls, colour settings and
Create action remain in use. The dialog starts on a new Classroom category,
with wrapped category tabs and illustrated preset previews.

Recovery & saving opens the host's existing recovery controls, even when the
tools are hidden. A read-only IndexedDB summary lists only copies from closed
or crashed tabs, using the existing live-tab lease checks. It never exposes
document bytes or alters recovery ownership. Empty and unavailable storage
states are explicit. A reload action is shown only when real copies exist,
with a save-first warning; loading still uses the existing recovery bridge.
No documents are uploaded and no cloud recent-file library is implied.

Integration: `scripts/patch_start_screen.py`, `custom-source/school_start.rs`,
`host/start-screen.js` and the summary API in `host/recovery.js`. Native tests
check preset dimensions and actual document creation; host tests check empty,
available and blocked recovery storage, safe text rendering, explicit reload,
and exclusion of active tabs. Original release files remain preserved.

Build 43704099702 passed native packaging and layer checks, the classroom
preset creation test, the toolbar and menu regressions, nine engine cutout
tests and both idle repaint tests. Chrome verification on a separate localhost
origin checked the hero and preset layout, A4 selection and actual creation at
2480 × 3508 / 300 ppi, returning Home, opening an official test PNG from the
computer and recovery access while the tools were hidden. The recovery panel
correctly showed its empty state without reloading or closing open documents.
The original app icon was the test image; no student files were used.
