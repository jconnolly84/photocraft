# Fonts for the PhotoCraft web host

66 families / 111 font files. Fonts load on demand
through PhotoCraft's supported `fonts/manifest.txt`; they are not added to Wasm.
Every family retains its licence beside its files. No proprietary Windows fonts
are included. Font names are the fonts' real internal names, not Microsoft aliases.

## Familiar Office alternatives

| Windows font | Choose this family |
| --- | --- |
| Arial | Liberation Sans |
| Times New Roman | Liberation Serif |
| Courier New | Liberation Mono |
| Calibri | Carlito |
| Cambria | Caladea |

These are metric-compatible substitutes, not identical font designs. Existing
documents requesting Microsoft family names may require manual font selection.
Inkscape uses installed fonts; it does not define a universal font collection.
These open fonts can also be installed on Windows for use in Inkscape.

## Selection

- Everyday and editorial: Inter, Lato, Montserrat, Open Sans, Roboto, Poppins,
  Nunito Sans, Source Sans 3, Source Serif 4, Merriweather, Playfair Display,
  Raleway, Rubik, Quicksand, Comfortaa, Cormorant Garamond, Cinzel.
- Bold poster styles: Anton, Bebas Neue, Oswald, Archivo Black, Alfa Slab One,
  Abril Fatface, Bangers, Bungee, Black Ops One, Chewy, Luckiest Guy, Righteous.
- Script and handwriting: Dancing Script, Great Vibes, Lobster, Pacifico,
  Satisfy, Sacramento, Caveat, Indie Flower, Permanent Marker,
  Shadows Into Light, Amatic SC, Courgette, Patrick Hand, Kalam.
- Decorative, retro and technology: Special Elite, Rye, Creepster, Monoton,
  Orbitron, Press Start 2P, Audiowide, Fredericka the Great.

The manifest lists the exact families, available styles, hashes and sources.
Variable fonts offer weight choices through their weight axis. Character coverage
varies: this is primarily a Latin design catalog, not complete worldwide coverage.

## Provenance and maintenance

### Decorative fonts from DaFont

Added Star Minor, Speed Freak, Help Me, Blackcraft, Neon Sans, Glitch Goblin,
Drybrush, Bad Comic, Bubblez Graffiti and Westhorn (14 faces across 10 families).
Speed Freak is by Tup Wanders; the other nine are by GGBotNet. These downloads
include explicit SIL OFL or CC0 licence texts, retained unmodified beside the
font files. `DAFONT-SOURCES.json` records each listing/download URL, archive hash,
font hashes, licence hash and category. `dafont-manifest.txt` retains their manifest
entries. Fonts marked only "free for personal use" were not selected.

Run `python scripts/import_dafont_fonts.py` to reimport these selections. Unlike
the pinned GitHub catalogs, DaFont download URLs may change their contents;
review archive/hash changes before publishing an update. The main font importer
preserves these additional entries when rebuilding its base catalog.

Font files come from the official `storytold/craft-fonts` Latin catalog and
`google/fonts`, at pinned commits recorded in `SOURCES.json`. Craft catalog
checksums were verified against its published manifest. All imported file hashes
(including licences) are recorded in SOURCES.json. Deployment checks font hashes,
licence paths and manifest completeness before publishing.

`python scripts/import_fonts.py` recreates the catalog (requires fontTools and gh).
Normal deployment uses the checked-in files and needs no font tooling or downloads.

Microsoft licensing: https://learn.microsoft.com/en-us/typography/fonts/font-faq
Inkscape fonts: https://wiki.inkscape.org/wiki/Installing_fonts
