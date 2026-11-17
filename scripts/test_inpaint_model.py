"""Validate the exact author-published MI-GAN weights against a synthetic removal."""
from pathlib import Path
import hashlib,json,time
import numpy as np
import onnxruntime as ort
root=Path(__file__).resolve().parents[1]
folder=root/'ai-assets/models/migan-512-406830d'
m=json.loads((folder/'manifest.json').read_text())
assert hashlib.sha256((folder/'model.onnx').read_bytes()).hexdigest()==m['sha256']
options=ort.SessionOptions();options.intra_op_num_threads=1
session=ort.InferenceSession(str(folder/'model.onnx'),options,providers=['CPUExecutionProvider'])
image=np.full((1,3,256,384),180,np.uint8);image[:,:,80:140,120:180]=np.array([220,25,25],np.uint8)[None,:,None,None]
mask=np.full((1,1,256,384),255,np.uint8);mask[:,:,76:144,116:184]=0
original=image.copy();started=time.perf_counter();result=session.run(None,{'image':image,'mask':mask})[0]
assert result.shape==image.shape and result.dtype==np.uint8
centre=result[0,:,90:130,130:170].astype(np.float32)
assert np.abs(centre-180).mean()<30,'The simple test object should be filled with the surrounding grey background'
assert np.abs(centre-original[0,:,90:130,130:170]).mean()>50,'The marked object must actually change'
np.testing.assert_array_equal(image,original)
print('Actual MI-GAN model removed the synthetic object:',round(time.perf_counter()-started,3),'seconds on native CPU (not a browser benchmark).')
