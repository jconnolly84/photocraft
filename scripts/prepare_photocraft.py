"""Stage the complete official release, preserving every original file byte for byte."""
from pathlib import Path
import hashlib
import shutil

root = Path(__file__).resolve().parents[1]
source = root / 'photocraft'
target = root / '_site' / 'photocraft'
if target.exists():
    raise SystemExit('Use a fresh _site directory to avoid stale release files.')
shutil.copytree(source, target)

# v0.23.1 glue imports ./snippets relative to app/, but the archive puts it
# at the site root. Add an exact copy; retain all upstream paths and bytes.
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
print('Verified all release bytes and staged PhotoCraft at /photocraft/.')
