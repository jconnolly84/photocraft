"""Activate a reviewed CI build without overwriting the preserved official release."""
from pathlib import Path
import hashlib
import gzip
import json
import sys
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
archive = Path(sys.argv[1]).resolve()
run_id = sys.argv[2]
destination = root / 'custom-build/web'
assert run_id.isdigit(), 'Unexpected workflow run ID'
if destination.exists():
    old_metadata = json.loads((root / 'custom-build/BUILD.json').read_text(encoding='utf-8'))
    old_run = str(old_metadata['workflow_run'])
    assert old_run.isdigit() and old_run != run_id, 'Do not overwrite an existing build'
    backup = root / 'custom-build/previous' / old_run
    boundary = (root / 'custom-build').resolve()
    assert destination.resolve().is_relative_to(boundary) and backup.resolve().is_relative_to(boundary)
    assert not backup.exists(), 'Previous build backup already exists'
    backup.mkdir(parents=True)
    shutil.move(str(destination), str(backup / 'web'))
    shutil.copyfile(root / 'custom-build/BUILD.json', backup / 'BUILD.json')
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
parts = (destination / 'app/parts.txt').read_text().splitlines()[1:]
wasm = gzip.decompress(b''.join((destination / 'app' / name.strip()).read_bytes() for name in parts if name.strip()))
features = ['font_categories']
if b'photocraftRecoverySave' in wasm:
    features.extend(['local_recovery', 'clipboard_export', 'background_menu'])
if b'photocraftBrowserPaste' in wasm:
    features.extend(['browser_menu_paste', 'smart_object_background'])
if b'photocraftRemoveBackground' in wasm:
    features.append('ai_background')
if b'photocraft.history-layers-default.v1' in wasm:
    features.append('history_layers_default')
metadata = {
    'upstream_version': 'v0.23.1', 'upstream_commit': '45066c48292e92229ada3459a83453439514c83d',
    'workflow_run': run_id, 'archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'patch': 'scripts/patch_photocraft_source.py',
    'patches': ['scripts/patch_photocraft_source.py', 'scripts/patch_extra_features.py', 'scripts/patch_ai_background.py', 'scripts/patch_default_panels.py'], 'files': files,
    'features': features,
    'font_catalog_sha256': hashlib.sha256(json.dumps(json.loads((root / 'host/font-catalog.json').read_text(encoding='utf-8')), sort_keys=True, separators=(',', ':')).encode()).hexdigest(),
}
(root / 'custom-build/BUILD.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
print(f'Activated complete custom build from workflow {run_id}: {len(files)} files.')
