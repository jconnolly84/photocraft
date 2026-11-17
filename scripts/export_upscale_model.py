"""Reproduce the browser ONNX model from Qualcomm's official 2x checkpoint.

Build dependencies only: torch==2.9.0+cpu, onnx==1.20.1, onnxruntime==1.24.4.
No training and no dependency on a remote inference service.
"""
from pathlib import Path
import collections
import hashlib
import json
import urllib.request
import sys
import numpy as np
import onnx
import onnxruntime as ort
import torch
from torch import nn

CHECKPOINT = 'https://github.com/quic/aimet-model-zoo/releases/download/phase_2_january_artifacts/quicksrnet_small_2x_checkpoint_float32.pth.tar'
CHECKSUM = 'd95d70f1d2366cb9c28d99f8c7aa5bb07e1ffeaf5d7e30d9c66ab0fa28c6d0f8'
SOURCE = '1bd2bf5b17cdda9251437c444009b29e1a25054b'
root = Path(__file__).resolve().parents[1]
folder = root / 'ai-assets/models/quicksrnet-small-2x'
folder.mkdir(parents=True, exist_ok=True)
checkpoint = Path(sys.argv[1])
assert hashlib.sha256(checkpoint.read_bytes()).hexdigest() == CHECKSUM
# The official training checkpoint includes an Adam optimizer, discarded here.
# Only these known library types are allowed; arbitrary pickle globals stay blocked.
torch.serialization.add_safe_globals([collections.defaultdict, torch.optim.Adam, dict])
state = torch.load(checkpoint, map_location='cpu', weights_only=True)['state_dict']

class QuickSRNetSmall2x(nn.Module):
    """Four 3x3 convolutions, clipped activations and 2x pixel shuffle.

    Architecture and pretrained weights: Qualcomm Innovation Center, BSD-3-Clause.
    See the pinned model/models.py in provenance.json. No learned values changed.
    """
    def __init__(self):
        super().__init__()
        self.cnn = nn.Sequential(nn.Conv2d(3,32,3,padding=1),nn.Hardtanh(0,1),
            nn.Conv2d(32,32,3,padding=1),nn.Hardtanh(0,1),
            nn.Conv2d(32,32,3,padding=1),nn.Hardtanh(0,1))
        self.conv_last = nn.Conv2d(32,12,3,padding=1)
    def forward(self,x):
        return nn.functional.pixel_shuffle(self.conv_last(self.cnn(x)).clamp(0,1),2)

torch.manual_seed(1)
model = QuickSRNetSmall2x().eval()
model.load_state_dict(state,strict=True)
sample = torch.rand(1,3,128,128)
output = folder/'model.onnx'
torch.onnx.export(model,sample,str(output),opset_version=17,dynamo=False,
    input_names=['image'],output_names=['upscaled'],
    dynamic_axes={'image':{2:'height',3:'width'},'upscaled':{2:'height2',3:'width2'}})
onnx.checker.check_model(onnx.load(str(output)))
options=ort.SessionOptions();options.intra_op_num_threads=1
session=ort.InferenceSession(str(output),options,providers=['CPUExecutionProvider'])
with torch.no_grad(): expected=model(sample).numpy()
actual=session.run(None,{'image':sample.numpy()})[0]
np.testing.assert_allclose(actual,expected,rtol=2e-5,atol=2e-5)
for name,relative in [('LICENSE','LICENSE.md'),('NOTICE.txt','NOTICE.txt'),('model-source.py','aimet_zoo_torch/quicksrnet/model/models.py')]:
    (folder/name).write_bytes(urllib.request.urlopen(f'https://raw.githubusercontent.com/quic/aimet-model-zoo/{SOURCE}/{relative}').read())
manifest={'name':'QuickSRNet Small 2x','scale':2,'tile':128,'halo':4,
    'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
provenance={'checkpoint_url':CHECKPOINT,'checkpoint_sha256':CHECKSUM,'source_commit':SOURCE,
    'source_url':f'https://github.com/quic/aimet-model-zoo/blob/{SOURCE}/aimet_zoo_torch/quicksrnet/model/models.py',
    'license':'BSD-3-Clause','export':'scripts/export_upscale_model.py','changes':'Float32 ONNX format conversion only; original learned weights retained.',
    'torch_version':torch.__version__,'onnx_version':onnx.__version__,'max_export_error':float(np.max(np.abs(actual-expected)))}
(folder/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n',encoding='utf-8',newline='\n')
print(manifest)
print('Native PyTorch / ONNX agreement:',provenance['max_export_error'])
