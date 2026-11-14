# Fonts for the PhotoCraft web host

56 families / 97 font files, approximately 30.6 MB in total. Fonts load on demand
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

Font files come from the official `storytold/craft-fonts` Latin catalog and
`google/fonts`, at pinned commits recorded in `SOURCES.json`. Craft catalog
checksums were verified against its published manifest. All imported file hashes
(including licences) are recorded in SOURCES.json. Deployment checks font hashes,
licence paths and manifest completeness before publishing.

`python scripts/import_fonts.py` recreates the catalog (requires fontTools and gh).
Normal deployment uses the checked-in files and needs no font tooling or downloads.

Microsoft licensing: https://learn.microsoft.com/en-us/typography/fonts/font-faq
Inkscape fonts: https://wiki.inkscape.org/wiki/Installing_fonts
