# Local document recovery

Recovery is enabled by default in the browser host. Changed documents are
serialized as full .pcraft documents about once a minute into IndexedDB in the
same browser profile. After an interrupted session, reopen the same site/profile
to recover the last completed snapshot. No document data is uploaded.

The Recovery panel shows the last successful write, allows opting out (reload
required), requesting persistent browser storage, and clearing inactive copies.
A live-tab lease prevents a second tab from recovering another active editor.
Writes are ordered and atomic: an oversized/failed write retains the old copy.
Limits are 16 documents, 64 MiB per snapshot and 128 MiB total. Errors appear in
the panel. Private browsing, clearing site data and school profile cleanup can
erase recovery. Shared browser profiles share recovery documents. Continue to
download .pcraft backups; work since the last snapshot can be lost.

Automated tests cover persistence after session loss, live-tab isolation,
adoption, failed-write retention, discard and opting out. The production build
compiled and packaged successfully in workflow 43644410662.

Live verification on 2026-11-14: the production app automatically wrote a
snapshot, then closing and reopening the test tab recovered the document with
both its Smart Object layer and masked raster layer intact. This simulates loss
of a session; no deliberate browser-process crash was performed.
