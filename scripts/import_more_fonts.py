"""Expand every native font section from a pinned official Google Fonts snapshot."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import quote
from fontTools.ttLib import TTFont
import hashlib
import io
import json
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
REV = 'cc39c4c2c304bc368c9b7c311ea2bcc6013299fe'
SELECTION = {
    'Blackletter': 'fruktur astloch jollylodger jacquard12 jacquard24 jacquardabastarda9 medievalsharp',
    'Serif': 'librebaskerville lora crimsontext ebgaramond librecaslontext bodonimoda dmserifdisplay prata vollkorn',
    'Slab Serif': 'robotoslab arvo bitter breeserif creteround josefinslab patuaone slabo27px zillaslab sanchez coustard',
    'Sans Serif': 'dmsans manrope outfit lexend barlow worksans urbanist spacegrotesk',
    'Script': 'allura alexbrush parisienne tangerine yellowtail kaushanscript marckscript italianno',
    'Monospace': 'robotomono sourcecodepro ibmplexmono jetbrainsmono spacemono firacode inconsolata anonymouspro cousine cutivemono sharetechmono synemono vt323 overpassmono',
    'Handwritten': 'architectsdaughter gloriahallelujah handlee justanotherhand neucha rocksalt sueellenfrancisco schoolbell comingsoon',
    'Decorative': 'fasterone nosifer eater rubikglitch wallpoet rampartone stalinistone rubikmoonrocks zentokyozoo sancreek',
}
cache = Path(tempfile.gettempdir()) / 'photocraft-google-font-tree-cc39c4c.json'
if not cache.exists():
    cache.write_bytes(subprocess.check_output(['gh','api',f'repos/google/fonts/git/trees/{REV}?recursive=1']))
tree = json.loads(cache.read_text(encoding='utf-8-sig'))
assert not tree['truncated']
paths = {item['path']: item for item in tree['tree'] if item['type'] == 'blob'}
existing_path = ROOT / 'font-library/fonts/manifest.txt'
existing = [line for line in existing_path.read_text(encoding='utf-8').splitlines() if line.strip() and not line.startswith('#')]
old_families = {line.split('|')[0].strip() for line in existing if '/expanded-' not in line}

def fetch(path):
    url = f'https://raw.githubusercontent.com/google/fonts/{REV}/{quote(path,safe="/")}'
    with urlopen(url,timeout=90) as response: data = response.read()
    blob = hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
    assert blob == paths[path]['sha'], f'Pinned Git blob mismatch: {path}'
    return data,url

def family(job):
    category,slug = job
    prefix = next((p+'/'+slug+'/' for p in ('ofl','apache') if p+'/'+slug+'/METADATA.pb' in paths),None)
    assert prefix, f'No official family: {slug}'
    candidates = [p for p in paths if p.startswith(prefix) and '/' not in p[len(prefix):]]
    license_path = next((p for p in candidates if p.endswith(('/OFL.txt','/LICENSE.txt'))),None)
    assert license_path, f'Missing licence: {slug}'
    licence,licence_url = fetch(license_path)
    if 'SIL OPEN FONT LICENSE' in licence.decode('utf-8-sig'):
        licence_id = 'OFL-1.1'
    else:
        assert b'Apache License' in licence and b'Version 2.0' in licence
        licence_id = 'Apache-2.0'
    directory = 'fonts/expanded-'+slug
    files = [(directory+'/'+Path(license_path).name,licence,licence_url)]
    metadata,metadata_url = fetch(prefix+'METADATA.pb')
    files.append((directory+'/METADATA.pb',metadata,metadata_url))
    rows,names = [],set()
    for path in sorted(p for p in candidates if p.endswith('.ttf')):
        data,url = fetch(path)
        font = TTFont(io.BytesIO(data))
        assert 'glyf' in font or 'CFF ' in font or 'CFF2' in font
        name = font['name'].getBestFamilyName()
        assert name and name not in old_families, f'Existing or invalid family: {name}'
        names.add(name)
        style = font['name'].getBestSubFamilyName()
        if 'fvar' in font: style = 'Italic Variable' if 'italic' in style.lower() or 'Italic' in path else 'Variable'
        relative = directory+'/'+Path(path).name
        rows.append(' | '.join([name,style,relative,'Latn',licence_id,directory+'/'+Path(license_path).name,hashlib.sha256(data).hexdigest(),url]))
        files.append((relative,data,url))
    assert rows, f'No usable TTFs: {slug}'
    for relative,data,_ in files:
        destination = ROOT/'font-library'/relative
        destination.parent.mkdir(parents=True,exist_ok=True)
        destination.write_bytes(data)
    return rows, {'families':sorted(names),'category':category,'upstream_commit':REV,'licence':licence_id,
        'files':[{'path':relative,'sha256':hashlib.sha256(data).hexdigest(),'url':url} for relative,data,url in files]}

jobs = [(category,slug) for category,slugs in SELECTION.items() for slug in slugs.split()]
sources,rows = [],[]
with ThreadPoolExecutor(max_workers=8) as pool:
    for added,source in pool.map(family,jobs): rows.extend(added); sources.append(source)
sources.sort(key=lambda s:s['families'][0].casefold())
(ROOT/'font-library/EXPANDED-SOURCES.json').write_text(json.dumps(sources,indent=2)+'\n',encoding='utf-8')
(ROOT/'font-library/expanded-manifest.txt').write_text('\n'.join(sorted(rows))+'\n',encoding='utf-8')
base = [line for line in existing if '/expanded-' not in line]
all_rows = sorted(base+rows,key=lambda line:(line.split('|')[0].strip().casefold(),line.split('|')[1]))
existing_path.write_text('# family | style | file | scripts | licence | licence file | sha256 | source\n'+'\n'.join(all_rows)+'\n',encoding='utf-8')
print(f'Added {len({r.split("|")[0].strip() for r in rows})} families / {len(rows)} faces across all eight sections.')
