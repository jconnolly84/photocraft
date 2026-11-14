"""Stage the complete official release, preserving every original file byte for byte."""
from pathlib import Path
import hashlib
import json
import re
import shutil

root = Path(__file__).resolve().parents[1]
source = root / 'photocraft'
custom_metadata = root / 'custom-build/BUILD.json'
if custom_metadata.exists():
    source = root / 'custom-build/web'
    metadata = json.loads(custom_metadata.read_text(encoding='utf-8'))
    expected_files = metadata['files']
    catalog = json.loads((root / 'host/font-catalog.json').read_text(encoding='utf-8'))
    catalog_hash = hashlib.sha256(json.dumps(catalog, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    assert catalog_hash == metadata['font_catalog_sha256'], 'Font catalog changed: rebuild the custom app to update its category hints'
    actual_files = {path.relative_to(source).as_posix() for path in source.rglob('*') if path.is_file()}
    assert actual_files == set(expected_files), 'Custom build file set differs from the reviewed artifact'
    for relative, digest in expected_files.items():
        assert hashlib.sha256((source / relative).read_bytes()).hexdigest() == digest, relative
target = root / '_site' / 'photocraft'
if target.exists():
    raise SystemExit('Use a fresh _site directory to avoid stale release files.')
shutil.copytree(source, target)

# v0.23.1 glue imports ./snippets relative to app/, but the archive puts it
# at the site root. Add an exact copy; retain all upstream paths and bytes.
if (source / 'snippets').is_dir() and not (target / 'app' / 'snippets').exists():
    shutil.copytree(source / 'snippets', target / 'app' / 'snippets')

manifest = (target / 'app' / 'parts.txt').read_text().splitlines()
assert manifest[0] == 'photocraft-parts 1'
for name in manifest[1:]:
    if name.strip():
        assert Path(name).name == name, 'Unexpected part path'
        part = target / 'app' / name
        assert part.is_file() and part.stat().st_size > 0, f'Missing part: {name}'
for original in source.rglob('*'):
    if original.is_file():
        copied = target / original.relative_to(source)
        assert hashlib.sha256(original.read_bytes()).digest() == hashlib.sha256(copied.read_bytes()).digest()
# Host-supplied fonts use the upstream supported optional manifest mechanism.
# Keep them separate from the checksum-verified release in the repository.
font_library = root / 'font-library'
families = set()
for line in (font_library / 'fonts' / 'manifest.txt').read_text(encoding='utf-8').splitlines():
    if not line.strip() or line.startswith('#'):
        continue
    family, style, path, scripts, license_id, license_path, expected, url = map(str.strip, line.split('|'))
    for rel in (path, license_path):
        assert rel.startswith('fonts/') and '..' not in Path(rel).parts
        assert (font_library / rel).is_file(), f'Missing font asset: {rel}'
    assert license_id in ('OFL-1.1', 'Apache-2.0', 'CC0-1.0')
    assert hashlib.sha256((font_library / path).read_bytes()).hexdigest() == expected, path
    families.add(family)
shutil.copytree(font_library / 'fonts', target / 'fonts')
print(f'Verified and staged {len(families)} font families with licences.')
site = target.parent
(site / '.nojekyll').touch()
for asset in (root / 'host').iterdir():
    if asset.is_file():
        shutil.copyfile(asset, site / asset.name)
# Local inference assets are versioned, checksum-verified static files.
ai = root / 'ai-assets'
if ai.is_dir():
    checksums = json.loads((ai / 'SHA256SUMS.json').read_text(encoding='utf-8'))
    actual = {p.relative_to(ai).as_posix() for p in ai.rglob('*') if p.is_file() and p.name != 'SHA256SUMS.json'}
    assert actual == set(checksums), 'AI asset set differs from its reviewed manifest'
    for relative, digest in checksums.items():
        assert '..' not in Path(relative).parts and not Path(relative).is_absolute()
        assert hashlib.sha256((ai / relative).read_bytes()).hexdigest() == digest, relative
    shutil.copytree(ai, site / 'ai')
worker = site / 'background-worker.js'
background_host = site / 'background-removal.js'
if worker.is_file() and background_host.is_file():
    background_host.write_text(background_host.read_text(encoding='utf-8').replace('__BACKGROUND_WORKER_VERSION__', hashlib.sha256(worker.read_bytes()).hexdigest()[:12]), encoding='utf-8')
editor_path = './photocraft/'
if custom_metadata.exists():
    run_id = str(metadata['workflow_run'])
    assert run_id.isdigit(), 'Unexpected workflow identifier'
    build_path = f'build-{run_id}'
    # Separate directory per compiled app: Pages cannot revalidate the upstream's
    # fixed parts.txt and glue URLs on demand, so never reuse those URLs across builds.
    shutil.copytree(target, site / build_path)
    editor_path = f'./{build_path}/'
recovery_supported = custom_metadata.exists() and 'local_recovery' in metadata.get('features', [])
(site / 'build-config.js').write_text('window.PHOTOCRAFT_EDITOR_PATH = ' + json.dumps(editor_path) + ';\nwindow.PHOTOCRAFT_RECOVERY_SUPPORTED = ' + json.dumps(recovery_supported) + ';\n', encoding='utf-8')
index = site / 'index.html'
html = index.read_text(encoding='utf-8')
for script in site.glob('*.js'):
    digest = hashlib.sha256(script.read_bytes()).hexdigest()[:12]
    html = re.sub(r'src="\./' + re.escape(script.name) + r'(?:\?[^\"]*)?"',
                  'src="./' + script.name + '?v=' + digest + '"', html)
index.write_text(html, encoding='utf-8')
print('Verified all build bytes and staged PhotoCraft at /photocraft/.')
