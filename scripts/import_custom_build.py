"""Activate a reviewed CI build without overwriting the preserved official release."""
from pathlib import Path
import hashlib
import json
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
archive = Path(sys.argv[1]).resolve()
run_id = sys.argv[2]
destination = root / 'custom-build/web'
assert not destination.exists(), 'Use a fresh custom build directory; never mix build files'
prefix = 'photocraft-web-0.23.1/'
files = {}
with zipfile.ZipFile(archive) as bundle:
    members = [info for info in bundle.infolist() if not info.is_dir()]
    for member in members:
        assert member.filename.startswith(prefix), member.filename
        relative = member.filename.removeprefix(prefix)
        assert relative and not Path(relative).is_absolute() and '..' not in Path(relative).parts
        assert ':' not in relative and '\\' not in relative
        data = bundle.read(member)
        output = destination / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
        files[relative] = hashlib.sha256(data).hexdigest()
assert 'app/parts.txt' in files and 'index.html' in files
metadata = {
    'upstream_version': 'v0.23.1', 'upstream_commit': '45066c48292e92229ada3459a83453439514c83d',
    'workflow_run': run_id, 'archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'patch': 'scripts/patch_photocraft_source.py', 'files': files,
    'font_catalog_sha256': hashlib.sha256(json.dumps(json.loads((root / 'host/font-catalog.json').read_text(encoding='utf-8')), sort_keys=True, separators=(',', ':')).encode()).hexdigest(),
}
(root / 'custom-build/BUILD.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
print(f'Activated complete custom build from workflow {run_id}: {len(files)} files.')
