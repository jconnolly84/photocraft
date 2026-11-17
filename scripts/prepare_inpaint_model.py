"""Fetch the authors' exact MI-GAN pipeline, verifying its published LFS hash."""
from pathlib import Path
import hashlib,json,urllib.request
root=Path(__file__).resolve().parents[1]
revision='406830d0fa60666da0071c342ad2fbc8f30c5c64'
source='2b793c5ece43f4253e32d4afc257120a5deed6f5'
base=f'https://huggingface.co/andraniksargsyan/migan/resolve/{revision}/'
folder=root/'ai-assets/models/migan-512-406830d'
folder.mkdir(parents=True,exist_ok=True)
expected='6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b'
model=folder/'model.onnx'
if not model.exists():
    data=urllib.request.urlopen(base+'migan_pipeline_v2.onnx',timeout=120).read()
    assert len(data)==28079181 and hashlib.sha256(data).hexdigest()==expected
    model.write_bytes(data)
assert model.stat().st_size==28079181 and hashlib.sha256(model.read_bytes()).hexdigest()==expected
for local,url in [('LICENSE',base+'LICENSE'),('README.md',base+'README.md'),
    ('LICENSE-WEIGHTS',f'https://raw.githubusercontent.com/Picsart-AI-Research/MI-GAN/{source}/LICENSE-WEIGHTS')]:
    (folder/local).write_bytes(urllib.request.urlopen(url,timeout=30).read())
manifest={'name':'MI-GAN 512 Places2 ONNX pipeline','bytes':model.stat().st_size,'sha256':expected,
    'source_url':base+'migan_pipeline_v2.onnx','revision':revision,'license':'MIT',
    'source_project':f'https://github.com/Picsart-AI-Research/MI-GAN/tree/{source}',
    'changes':'None. Exact author-published ONNX bytes; upstream LFS SHA-256 verified.'}
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
print('Verified author-published MI-GAN model:',model.stat().st_size,'bytes',expected)
