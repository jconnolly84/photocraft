"""Import selected DaFont archives with their explicit OFL or CC0 licence."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
from fontTools.ttLib import TTFont
import hashlib
import io
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SELECTION = {
    'star_minor': 'Decorative', 'speed_freak': 'Decorative',
    'help_me': 'Decorative', 'blackcraft': 'Decorative',
    'neon_sans': 'Decorative', 'glitch_goblin': 'Decorative',
    'drybrush': 'Handwritten', 'bad_comic': 'Decorative',
    'bubblez_graffiti': 'Decorative', 'westhorn': 'Decorative',
}

def load(item):
    slug, category = item
    url = f'https://dl.dafont.com/dl/?f={slug}'
    with urlopen(url, timeout=60) as response:
        data = response.read()
    archive = zipfile.ZipFile(io.BytesIO(data))
    licenses = []
    for name in archive.namelist():
        if name.lower().endswith('.txt'):
            text = archive.read(name).decode('utf-8-sig', errors='replace')
            if 'SIL OPEN FONT LICENSE' in text and 'PERMISSION & CONDITIONS' in text:
                licenses.append((name, 'OFL-1.1'))
            elif 'CC0 1.0 Universal' in text and 'Waiver' in text and 'Public License Fallback' in text:
                licenses.append((name, 'CC0-1.0'))
    assert licenses, f'No full permitted licence found in {slug}; do not publish'
    directory = ROOT / 'font-library/fonts' / ('dafont-' + slug.replace('_', '-'))
    directory.mkdir(parents=True, exist_ok=True)
    license_name, license_id = licenses[0]
    license_path = directory / Path(license_name).name
    license_path.write_bytes(archive.read(license_name))
    rows, families, files = [], set(), []
    for name in archive.namelist():
        if not name.lower().endswith(('.ttf', '.otf')):
            continue
        font_bytes = archive.read(name)
        font = TTFont(io.BytesIO(font_bytes))
        family = font['name'].getBestFamilyName()
        style = font['name'].getBestSubFamilyName()
        path = directory / Path(name).name
        path.write_bytes(font_bytes)
        digest = hashlib.sha256(font_bytes).hexdigest()
        rows.append(' | '.join([family, style,
            path.relative_to(ROOT / 'font-library').as_posix(), 'Latn', license_id,
            license_path.relative_to(ROOT / 'font-library').as_posix(), digest, url]))
        families.add(family)
        files.append({'path': path.relative_to(ROOT).as_posix(), 'sha256': digest})
    assert rows, f'No fonts in {slug}'
    return rows, {'dafont_page': f'https://www.dafont.com/{slug.replace("_", "-")}.font',
        'download': url, 'archive_sha256': hashlib.sha256(data).hexdigest(),
        'license_path': license_path.relative_to(ROOT).as_posix(),
        'license_sha256': hashlib.sha256(license_path.read_bytes()).hexdigest(),
        'families': sorted(families), 'license': license_id, 'category': category, 'files': files}

rows, sources = [], []
with ThreadPoolExecutor(max_workers=5) as pool:
    for added, source in pool.map(load, SELECTION.items()):
        rows.extend(added); sources.append(source)
base_manifest = ROOT / 'font-library/fonts/manifest.txt'
existing = [line for line in base_manifest.read_text(encoding='utf-8').splitlines()
            if 'fonts/dafont-' not in line]
base_manifest.write_text('\n'.join(existing + sorted(rows)) + '\n', encoding='utf-8')
(ROOT / 'font-library/dafont-manifest.txt').write_text('\n'.join(sorted(rows)) + '\n', encoding='utf-8')
(ROOT / 'font-library/DAFONT-SOURCES.json').write_text(json.dumps(sources, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'families': [family for source in sources for family in source['families']], 'faces': len(rows)}))
