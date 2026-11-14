# Local background-removal components

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

The model and runtime load on demand. Only these static files are fetched.
Student images and generated masks stay in the browser. Model caches contain
only public model files, never document or image bytes.
