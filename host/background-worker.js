/* Local inference only. The worker fetches static model/runtime files, never images. */
import * as ort from './ai/vendor/ort-1.31.1/ort.wasm.min.mjs';
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = new URL('./ai/vendor/ort-1.31.1/', import.meta.url).href;
let session;
const notify = message => self.postMessage({type: 'progress', message});
const hex = bytes => Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
async function checksum(bytes) {return hex(await crypto.subtle.digest('SHA-256', bytes));}
async function loadModel() {
  if (session) return session;
  const base = new URL('./ai/models/birefnet-lite-512-962e679/', import.meta.url);
  const manifest = await (await fetch(new URL('manifest.json', base))).json();
  if (manifest.bytes !== 191877254 || manifest.parts.length !== 3) throw new Error('Unexpected model manifest');
  const data = new Uint8Array(manifest.bytes);
  const cache = globalThis.caches ? await caches.open('photocraft-ai-model-v1').catch(() => null) : null;
  let offset = 0, lastPercent = -1;
  for (const part of manifest.parts) {
    if (!/^model\.part-\d{2}\.bin$/.test(part.file) || part.bytes > 75000000) throw new Error('Invalid model part');
    const url = new URL(part.file, base);
    let response = await cache?.match(url);
    const cached = Boolean(response);
    if (!response) response = await fetch(url);
    if (!response.ok) throw new Error('The background-removal model could not download. Try again online.');
    const copy = !cached && cache ? response.clone() : null;
    const reader = response.body.getReader();
    let received = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      if (received + value.length > part.bytes) throw new Error('Unexpected model download size');
      data.set(value, offset + received); received += value.length;
      const percent = Math.round((offset + received) / manifest.bytes * 100);
      if (percent !== lastPercent) {lastPercent = percent; notify(`Loading AI model: ${percent}% (first use downloads 192 MB)`);}
    }
    if (received !== part.bytes || await checksum(data.subarray(offset, offset + received)) !== part.sha256) {
      await cache?.delete(url); throw new Error('Model download checksum failed. Please retry.');
    }
    if (copy) await cache.put(url, copy).catch(() => {});
    offset += received;
  }
  if (offset !== manifest.bytes || await checksum(data) !== manifest.sha256) throw new Error('Model checksum failed');
  notify('Preparing the AI model on this PC...');
  session = await ort.InferenceSession.create(data, {executionProviders: ['wasm'], graphOptimizationLevel: 'all'});
  return session;
}
self.onmessage = async event => {
  try {
    const {png} = event.data;
    if (!(png instanceof ArrayBuffer) || png.byteLength > 80 * 1024 * 1024) throw new Error('Image exceeds the local processing limit');
    const model = await loadModel();
    notify('Finding the subject locally. Processing time depends on this PC...');
    const image = await createImageBitmap(new Blob([png], {type: 'image/png'}));
    const {width, height} = image;
    if (width * height > 16777216) {image.close(); throw new Error('Resize the image below 16 megapixels first.');}
    const canvas = new OffscreenCanvas(512, 512);
    const context = canvas.getContext('2d', {willReadFrequently: true});
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, 512, 512);
    context.drawImage(image, 0, 0, 512, 512); image.close();
    const rgba = context.getImageData(0, 0, 512, 512).data;
    const count = 512 * 512;
    const input = new Float32Array(count * 3);
    const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
    for (let channel = 0; channel < 3; channel++) {
      for (let pixel = 0; pixel < count; pixel++) input[channel * count + pixel] = (rgba[pixel * 4 + channel] / 255 - mean[channel]) / std[channel];
    }
    const tensor = new ort.Tensor('float32', input, [1, 3, 512, 512]);
    const outputs = await model.run({input_image: tensor});
    const output = (outputs.logits || outputs.output_image);
    if (!output || output.data.length !== count) throw new Error('Unexpected model output');
    const maskPixels = context.createImageData(512, 512);
    for (let pixel = 0; pixel < count; pixel++) {
      const value = Math.round(255 / (1 + Math.exp(-output.data[pixel])));
      maskPixels.data[pixel * 4] = value;
      maskPixels.data[pixel * 4 + 1] = value;
      maskPixels.data[pixel * 4 + 2] = value;
      maskPixels.data[pixel * 4 + 3] = 255;
    }
    context.putImageData(maskPixels, 0, 0);
    tensor.dispose(); for (const value of Object.values(outputs)) value.dispose();
    const full = new OffscreenCanvas(width, height);
    const fullContext = full.getContext('2d', {willReadFrequently: true});
    fullContext.imageSmoothingEnabled = true; fullContext.imageSmoothingQuality = 'high';
    fullContext.drawImage(canvas, 0, 0, width, height);
    const fullPixels = fullContext.getImageData(0, 0, width, height).data;
    const alpha = new Uint8Array(width * height);
    for (let pixel = 0; pixel < alpha.length; pixel++) alpha[pixel] = fullPixels[pixel * 4];
    self.postMessage({type: 'result', alpha: alpha.buffer}, [alpha.buffer]);
  } catch (error) {
    self.postMessage({type: 'error', message: error.message || String(error)});
  }
};
