const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
let inferences=0,loads=0;const posted=[];
class Canvas {
 constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4);}
 getContext(){const canvas=this;return{
  fillStyle:'#ffffff',filter:'none',
  fillRect(){const hex=/^#([0-9a-f]{6})$/i.exec(this.fillStyle)?.[1]||'ffffff';const c=[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16),255];for(let i=0;i<canvas.data.length;i+=4)canvas.data.set(c,i);},
  drawImage(image,...args){const data=image.data||new Uint8ClampedArray(image.width*image.height*4).fill(255);for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const at=(Math.min(image.height-1,Math.floor(y*image.height/canvas.height))*image.width+Math.min(image.width-1,Math.floor(x*image.width/canvas.width)))*4;canvas.data.set(data.subarray(at,at+4),(y*canvas.width+x)*4);}},
  createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(p){canvas.data.set(p.data);},getImageData(){return{data:canvas.data.slice()};},
  createLinearGradient(){return{addColorStop(){}};}
 };}
}
class Tensor{dispose(){}}
const scope={ArrayBuffer,Uint8Array,Uint8ClampedArray,Float32Array,Number,Math,Blob,OffscreenCanvas:Canvas,ort:{Tensor},
 photocraftSubjectBlur:require('../host/subject-blur.js'),
 createImageBitmap:async()=>({width:2,height:2,close(){}}),
 checksum:async bytes=>crypto.createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),notify:()=>{},
 loadModel:async()=>{loads++;return{run:async()=>{inferences++;return{logits:{data:new Float32Array(512*512).fill(1),dispose(){}}};}};},
 self:{postMessage:data=>posted.push(data)}
};vm.createContext(scope);const source=fs.readFileSync('host/background-worker.js','utf8');vm.runInContext(source.slice(source.indexOf('const MAX_PIXELS')),scope);
(async()=>{
 const png=new Uint8Array([1,2,3]).buffer;
 await scope.self.onmessage({data:{type:'mask',id:1,png}});assert.equal(inferences,1);let result=posted.at(-1);assert.equal(result.width,2);assert.equal(result.id,1);assert.equal(result.cacheHit,false);assert.equal(new Uint8Array(result.alpha).length,4);
 await scope.self.onmessage({data:{type:'mask',id:2,png:png.slice(0)}});result=posted.at(-1);assert.equal(result.cacheHit,true);assert.equal(inferences,1);assert.equal(loads,1,'Reusing a mask must skip model loading and inference');
 await scope.self.onmessage({data:{type:'mask',id:3,png:new Uint8Array([1,2,4]).buffer}});assert.equal(inferences,2,'Changed pixels must invalidate the cached mask');
 await scope.self.onmessage({data:{type:'effect',id:4,png,mode:'replace',canvasWidth:4,canvasHeight:3,options:{type:'colour',colour1:'#123456',colour2:'#ffffff'}}});
 result=posted.at(-1);assert.equal(result.type,'result');assert.equal(result.background.byteLength,48);assert.deepEqual([...new Uint8Array(result.background).slice(0,4)],[18,52,86,255]);assert.equal(inferences,2,'Background creation must not run AI');
 await scope.self.onmessage({data:{type:'effect',id:5,png,mode:'blur',options:{radius:0}}});assert.match(posted.at(-1).message,/1 to 80/);assert.equal(posted.at(-1).type,'error');
 await scope.self.onmessage({data:{type:'effect',id:6,png,mode:'replace',canvasWidth:50000,canvasHeight:50000,options:{type:'colour',colour1:'#123456',colour2:'#ffffff'}}});assert.equal(posted.at(-1).type,'error');assert.match(posted.at(-1).message,/16 megapixels/);
 assert.throws(()=>scope.dimensions(-1,2));assert.throws(()=>scope.imageBytes('bad'));
 const cover=Array.from(scope.coverRect(100,50,50,100));assert.deepEqual(cover,[-75,0,200,100]);
 const image={width:4,height:1,data:new Uint8ClampedArray([10,20,30,255,255,0,0,255,255,0,0,255,10,20,30,255])};
 const matte=new Uint8Array([0,255,255,0]);
 const clean=scope.photocraftSubjectBlur(image,4,1,2,matte,4,1,(w,h)=>new Canvas(w,h));
 assert.equal(clean.hasBackground,true);
 for(let x=0;x<4;x++)assert.deepEqual([...clean.canvas.data.slice(x*4,x*4+4)],[10,20,30,255],'Subject red must not leak into the background');
 const noBackground=scope.photocraftSubjectBlur(image,4,1,2,new Uint8Array(4).fill(255),4,1,(w,h)=>new Canvas(w,h));assert.equal(noBackground.hasBackground,false);
 console.log('Worker mask content cache, invalidation, no-inference background changes, image budgets, settings validation and cover geometry passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
