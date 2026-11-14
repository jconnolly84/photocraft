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
site = target.parent
(site / '.nojekyll').touch()
for asset in (root / 'host').iterdir():
    if asset.is_file():
        shutil.copyfile(asset, site / asset.name)
print('Verified all release bytes and staged PhotoCraft at /photocraft/.')
