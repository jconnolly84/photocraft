# Local image-processing components

- BiRefNet Lite: Peng Zheng and co-authors, MIT licence. Official model:
  https://huggingface.co/ZhengPeng7/BiRefNet_lite
- Browser-compatible 512 x 512 ONNX export: Studio Ludens V.O.F., MIT licence.
  https://huggingface.co/studioludens/birefnet-lite-512
  Pinned revision: 962e67969ec6acec9c19fab76acee4f5e22e990c.
  Full model SHA-256: 1cb0fb360dadd15af77c639085d77a9df67db0c64315560c3de005f676345ac2.
  Verified against the publisher's LFS object hash before splitting into three
  files below GitHub's per-file cap. Concatenation restores the exact ONNX bytes.
  The original model card, processor configuration and licence remain beside it.
- ONNX Runtime Web 1.31.1: Microsoft, MIT licence. Official npm package and
  https://github.com/microsoft/onnxruntime/tree/v1.31.1.
  Its licence and ThirdPartyNotices.txt remain beside the runtime files.
- QuickSRNet Small 2x: Qualcomm Innovation Center, BSD-3-Clause.
  Official checkpoint and source: https://github.com/quic/aimet-model-zoo/tree/1bd2bf5b17cdda9251437c444009b29e1a25054b/aimet_zoo_torch/quicksrnet
  The checkpoint was converted to float32 ONNX without changing learned weights.
  Export script: scripts/export_upscale_model.py in this site's source repository.
  Checkpoint, model and source revisions/hashes are recorded in
  models/quicksrnet-small-2x/provenance.json and manifest.json. Its original
  licence, notices and model source remain beside the exported weights.
- MI-GAN 512 Places2 pipeline: Picsart AI Research (PAIR), MIT licence for code
  and released weights. Official project: https://github.com/Picsart-AI-Research/MI-GAN
  Author-published ONNX pipeline: https://huggingface.co/andraniksargsyan/migan
  Pinned revision: 406830d0fa60666da0071c342ad2fbc8f30c5c64.
  The exact ONNX bytes are preserved, verified against the publisher's LFS
  SHA-256 6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b.
  Its original model card, MIT licence and explicit LICENSE-WEIGHTS remain in
  models/migan-512-406830d/.

The model and runtime load on demand. Only these static files are fetched.
Student images and generated masks stay in the browser. Model caches contain
only public model files, never document or image bytes.
