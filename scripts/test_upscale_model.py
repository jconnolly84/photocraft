"""Check the shipped real model and its four-pixel tile overlap (build-time only)."""
from pathlib import Path
import hashlib,json,time
import numpy as np
import onnxruntime as ort
from PIL import Image
root=Path(__file__).resolve().parents[1]
folder=root/'ai-assets/models/quicksrnet-small-2x'
manifest=json.loads((folder/'manifest.json').read_text())
assert hashlib.sha256((folder/'model.onnx').read_bytes()).hexdigest()==manifest['sha256']
options=ort.SessionOptions();options.intra_op_num_threads=1
session=ort.InferenceSession(str(folder/'model.onnx'),options,providers=['CPUExecutionProvider'])
rng=np.random.default_rng(7);image=rng.random((3,125,257),dtype=np.float32)
padded=np.pad(image,((0,0),(4,4),(4,4)),mode='edge')
reference=session.run(None,{'image':padded[None]})[0][0,:,8:-8,8:-8]
tiled=np.zeros_like(reference);started=time.perf_counter()
for y in range(0,125,120):
    for x in range(0,257,120):
        yy=np.clip(np.arange(y-4,y+124),0,124);xx=np.clip(np.arange(x-4,x+124),0,256)
        tile=image[:,yy[:,None],xx[None,:]]
        out=session.run(None,{'image':tile[None]})[0][0]
        tw=min(120,257-x)*2;th=min(120,125-y)*2
        tiled[:,y*2:y*2+th,x*2:x*2+tw]=out[:,8:8+th,8:8+tw]
np.testing.assert_allclose(tiled,reference,atol=3e-6,rtol=3e-6)
assert np.isfinite(tiled).all() and tiled.min()>=0 and tiled.max()<=1
print('Real model tile/whole agreement:',float(np.max(np.abs(tiled-reference))))
print('Six 128px CPU tiles:',round(time.perf_counter()-started,3),'seconds (native CPU, not a browser benchmark)')
target=Image.open(root/'host/tutorial/assets/downloads/trainer-original.png').convert('RGB').resize((512,342),Image.Resampling.LANCZOS)
low=target.resize((256,171),Image.Resampling.BICUBIC)
data=np.asarray(low).astype(np.float32)/255
pad=np.pad(data.transpose(2,0,1),((0,0),(4,4),(4,4)),mode='edge')
ai=session.run(None,{'image':pad[None]})[0][0,:,8:-8,8:-8].transpose(1,2,0)
truth=np.asarray(target).astype(np.float32)/255;baseline=np.asarray(low.resize(target.size,Image.Resampling.BICUBIC)).astype(np.float32)/255
psnr=lambda a:float(-10*np.log10(np.mean((a-truth)**2)))
print('Practice trainer reconstruction PSNR: AI',round(psnr(ai),2),'dB; bicubic',round(psnr(baseline),2),'dB')
