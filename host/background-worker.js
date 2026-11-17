/* Local inference only. The worker fetches static model/runtime files, never images. */
import * as ort from './ai/vendor/ort-1.31.1/ort.wasm.min.mjs';
import './subject-blur.js?v=__SUBJECT_BLUR_VERSION__';
import './image-finish.js?v=__IMAGE_FINISH_VERSION__';
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

const MAX_PIXELS = 16777216;
let maskCache;
function dimensions(width,height) {
  if (!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_PIXELS) throw new Error('Resize the image or canvas below 16 megapixels first.');
}
function imageBytes(value) {
  if (!(value instanceof ArrayBuffer)||value.byteLength<1||value.byteLength>80*1024*1024) throw new Error('Image exceeds the local processing limit');
}
function coverRect(iw,ih,w,h) {
  const scale=Math.max(w/iw,h/ih);return [(w-iw*scale)/2,(h-ih*scale)/2,iw*scale,ih*scale];
}
async function inferMask(png) {
  imageBytes(png);
  const image=await createImageBitmap(new Blob([png],{type:'image/png'}));
  try {
    const {width,height}=image;dimensions(width,height);
    const key=await checksum(png);
    let small;
    const cacheHit=maskCache?.key===key;
    if(cacheHit) {small=maskCache.small;notify('Reusing the subject mask — no new AI run needed.');}
    else {
      const model=await loadModel();notify('Finding the subject locally. Processing time depends on this PC...');
      const canvas=new OffscreenCanvas(512,512),context=canvas.getContext('2d',{willReadFrequently:true});
      context.fillStyle='#ffffff';context.fillRect(0,0,512,512);context.drawImage(image,0,0,512,512);
      const rgba=context.getImageData(0,0,512,512).data,count=512*512;
      const input=new Float32Array(count*3),mean=[0.485,0.456,0.406],std=[0.229,0.224,0.225];
      for(let c=0;c<3;c++)for(let i=0;i<count;i++)input[c*count+i]=(rgba[i*4+c]/255-mean[c])/std[c];
      const tensor=new ort.Tensor('float32',input,[1,3,512,512]);let outputs;
      try {
        outputs=await model.run({input_image:tensor});const output=outputs.logits||outputs.output_image;
        if(!output||output.data.length!==count)throw new Error('Unexpected model output');
        small=new Uint8Array(count);for(let i=0;i<count;i++)small[i]=Math.round(255/(1+Math.exp(-output.data[i])));
      } finally {tensor.dispose();if(outputs)for(const value of Object.values(outputs))value.dispose();}
      // Only one 256 KB mask is retained. No image or full-resolution mask cache.
      maskCache={key,small};
    }
    const canvas=new OffscreenCanvas(512,512),context=canvas.getContext('2d');
    const pixels=context.createImageData(512,512);
    for(let i=0;i<small.length;i++){pixels.data[i*4]=small[i];pixels.data[i*4+1]=small[i];pixels.data[i*4+2]=small[i];pixels.data[i*4+3]=255;}
    context.putImageData(pixels,0,0);
    const full=new OffscreenCanvas(width,height),fc=full.getContext('2d',{willReadFrequently:true});
    fc.imageSmoothingEnabled=true;fc.imageSmoothingQuality='high';fc.drawImage(canvas,0,0,width,height);
    const fullPixels=fc.getImageData(0,0,width,height).data,alpha=new Uint8Array(width*height);
    for(let i=0;i<alpha.length;i++)alpha[i]=fullPixels[i*4];
    return {alpha:alpha.buffer,width,height,cacheHit};
  } finally {image.close();}
}
async function makeBackground({png,mode,options,canvasWidth,canvasHeight,backdrop}) {
  imageBytes(png);
  if(!['blur','replace'].includes(mode))throw new Error('Unknown background operation');
  const image=await createImageBitmap(new Blob([png],{type:'image/png'}));let replacement;
  try {
    dimensions(image.width,image.height);
    const w=mode==='blur'?image.width:canvasWidth,h=mode==='blur'?image.height:canvasHeight;dimensions(w,h);
    const full=new OffscreenCanvas(w,h),fc=full.getContext('2d',{willReadFrequently:true});
    if(mode==='blur') {
      const radius=Number(options.radius);if(!Number.isFinite(radius)||radius<1||radius>80)throw new Error('Choose a blur from 1 to 80 pixels');
      // Bound filter work to 2048 px, independently of the document resolution.
      const scale=Math.min(1,2048/Math.max(w,h)),sw=Math.max(1,Math.round(w*scale)),sh=Math.max(1,Math.round(h*scale));
      if(maskCache?.key!==await checksum(png))throw new Error('The subject mask expired. Please try again.');
      const blurred=globalThis.photocraftSubjectBlur(image,sw,sh,radius*scale,maskCache.small,512,512,(w,h)=>new OffscreenCanvas(w,h));
      if(!blurred.hasBackground)throw new Error('This image has no visible background to blur. Use Replace Background instead.');
      fc.drawImage(blurred.canvas,0,0,w,h);
    } else {
      if(!['colour','gradient','image'].includes(options.type)||!/^#[0-9a-f]{6}$/i.test(options.colour1)||!/^#[0-9a-f]{6}$/i.test(options.colour2))throw new Error('Choose a valid background');
      fc.fillStyle=options.colour1;
      if(options.type==='gradient'){const g=fc.createLinearGradient(0,0,w,h);g.addColorStop(0,options.colour1);g.addColorStop(1,options.colour2);fc.fillStyle=g;}
      fc.fillRect(0,0,w,h);
      if(options.type==='image') {
        imageBytes(backdrop);replacement=await createImageBitmap(new Blob([backdrop]));dimensions(replacement.width,replacement.height);
        fc.drawImage(replacement,...coverRect(replacement.width,replacement.height,w,h));
      }
    }
    return {background:fc.getImageData(0,0,w,h).data.buffer,width:w,height:h};
  } finally {image.close();replacement?.close();}
}
async function finishImage({png,mode,options,alpha}) {
  imageBytes(png);
  const image=await createImageBitmap(new Blob([png],{type:'image/png'}));
  try {
    const {width:w,height:h}=image;dimensions(w,h);
    if(mode==='refine') {
      if(!(alpha instanceof ArrayBuffer)||alpha.byteLength!==w*h)throw Error('Invalid cutout mask');
      const result=globalThis.photocraftImageFinish.refine(new Uint8Array(alpha),w,h,options);
      if(!result.some(v=>v>0))throw Error('The refined cutout is empty. Reduce the inward edge shift.');
      return{alpha:result.buffer,width:w,height:h};
    }
    if(mode!=='enhance')throw Error('Unknown image operation');
    const scale=Math.min(1,1024/Math.max(w,h)),sample=new OffscreenCanvas(Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale))),sc=sample.getContext('2d',{willReadFrequently:true});
    sc.drawImage(image,0,0,sample.width,sample.height);
    const stats=globalThis.photocraftImageFinish.analyse(sc.getImageData(0,0,sample.width,sample.height).data);
    const canvas=new OffscreenCanvas(w,h),c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);
    const pixels=c.getImageData(0,0,w,h).data;
    return{background:globalThis.photocraftImageFinish.enhance(pixels,stats,options.strength).buffer,width:w,height:h};
  } finally {image.close();}
}
self.onmessage=async ({data})=>{
  try {
    const result=data.type==='finish'?await finishImage(data):data.type==='effect'?await makeBackground(data):await inferMask(data.png);
    const transfer=result.alpha?[result.alpha]:[result.background];
    self.postMessage({type:'result',id:data.id,...result},transfer);
  }catch(error){self.postMessage({type:'error',id:data.id,message:error.message||String(error)});}
};
