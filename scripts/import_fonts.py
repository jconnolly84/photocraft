"""Import a pinned open-licensed font catalog; requires fontTools and GitHub CLI."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import quote
import hashlib
import io
import json
import subprocess
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
CRAFT = 'c1db6d1a8ed772191241c3d185e2104be84d8691'
GOOGLE = 'cc39c4c2c304bc368c9b7c311ea2bcc6013299fe'
CREATIVE = set('anton bebasneue oswald abrilfatface alfaslabone bangers bungee blackopsone cinzel cormorantgaramond dancingscript greatvibes lobster pacifico satisfy sacramento caveat indieflower permanentmarker shadowsintolight amaticsc specialelite rye creepster monoton orbitron pressstart2p righteous rubik quicksand comfortaa raleway archivoblack audiowide frederickathegreat courgette patrickhand kalam chewy luckiestguy'.split())

def read(url):
    with urlopen(url, timeout=90) as response:
        return response.read()

def raw(repo, rev, path):
    return f'https://raw.githubusercontent.com/{repo}/{rev}/{quote(path, safe="/")}'

def save(path, data):
    dest = ROOT / 'font-library' / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)

manifest = read(raw('storytold/craft-fonts', CRAFT, 'fonts/latin-manifest.txt')).decode()
rows = [[v.strip() for v in line.split('|')] for line in manifest.splitlines()
        if line.strip() and not line.startswith('#')]
jobs = []
for row in rows:
    jobs.append((row[2], raw('storytold/craft-fonts', CRAFT, row[2]), row[6]))
for license_path in sorted({r[5] for r in rows}):
    jobs.append((license_path, raw('storytold/craft-fonts', CRAFT, license_path), None))

tree = json.loads(subprocess.check_output([
    'gh', 'api', f'repos/google/fonts/git/trees/{GOOGLE}?recursive=1']))
assert not tree['truncated'], 'Incomplete upstream tree'
selected = [item['path'] for item in tree['tree']
            if len(item['path'].split('/')) == 3
            and item['path'].split('/')[0] in ('ofl', 'apache')
            and item['path'].split('/')[1] in CREATIVE
            and (item['path'].endswith('.ttf') or item['path'].endswith('/OFL.txt')
                 or item['path'].endswith('/LICENSE.txt'))]
found = {p.split('/')[1] for p in selected}
assert found == CREATIVE, f'Missing families: {CREATIVE - found}'
for path in selected:
    relative = 'fonts/' + '/'.join(path.split('/')[1:])
    jobs.append((relative, raw('google/fonts', GOOGLE, path), None))

def download(job):
    path, url, expected = job
    data = read(url)
    digest = hashlib.sha256(data).hexdigest()
    if expected:
        assert digest == expected, f'Checksum mismatch: {path}'
    save(path, data)
    if path.endswith('.ttf'):
        font = TTFont(io.BytesIO(data))
        family = font['name'].getBestFamilyName()
        style = font['name'].getBestSubFamilyName()
        if 'fvar' in font:
            style = 'Italic Variable' if 'italic' in style.lower() or 'Italic' in path else 'Variable'
        if not expected:
            apache = f'/{GOOGLE}/apache/' in url
            return [family, style, path, 'Latn', 'Apache-2.0' if apache else 'OFL-1.1',
                    str(Path(path).parent / ('LICENSE.txt' if apache else 'OFL.txt')).replace('\\', '/'), digest, url]
    return None

with ThreadPoolExecutor(max_workers=8) as pool:
    for result in pool.map(download, jobs):
        if result:
            rows.append(result)
rows.sort(key=lambda r: (r[0].casefold(), r[1]))
extra = ROOT / 'font-library/dafont-manifest.txt'
if extra.exists():
    rows.extend([[v.strip() for v in line.split('|')] for line in extra.read_text(encoding='utf-8').splitlines() if line.strip()])
save('fonts/manifest.txt', ('# family | style | file | scripts | licence | licence file | sha256 | source\n' +
     '\n'.join(' | '.join(row) for row in rows) + '\n').encode())
save('SOURCES.json', json.dumps({'craft_fonts_commit': CRAFT, 'google_fonts_commit': GOOGLE,
     'files': [{'path': p, 'url': u, 'sha256': hashlib.sha256((ROOT / 'font-library' / p).read_bytes()).hexdigest()}
               for p, u, _ in jobs]}, indent=2).encode())
print(f'Imported {len({r[0] for r in rows})} families, {len(rows)} faces; '
      f'{sum((ROOT / "font-library" / r[2]).stat().st_size for r in rows):,} font bytes.')
