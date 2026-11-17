const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements={};let closedImages=0,requestResolve,requestReject,requests=[];
class CanvasContext{
 constructor(canvas){this.canvas=canvas;this.globalCompositeOperation='source-over';}
 ensure(){const c=this.canvas;if(!c.data||c.data.length!==c.width*c.height*4)c.data=new Uint8ClampedArray(c.width*c.height*4);return c.data;}
 clearRect(){this.ensure().fill(0);}fillRect(){const a=this.ensure();for(let i=0;i<a.length;i+=4)a.set([255,255,255,255],i);}
 createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};}putImageData(p){this.ensure().set(p.data.subarray(0,this.ensure().length));}
 getImageData(){return{data:this.ensure().slice()};}
 drawImage(image){const a=this.ensure();for(let i=0;i<a.length;i+=4)a.set([100,120,140,255],i);}
 beginPath(){this.points=[];this.circle=null;}arc(x,y,r){this.circle=[x,y,r];}moveTo(x,y){this.points=[[x,y]];}lineTo(x,y){this.points.push([x,y]);}
 fill(){const [x,y,r]=this.circle;this.paint(x,y,x,y,r);}stroke(){if(this.points?.length===2)this.paint(...this.points[0],...this.points[1],this.lineWidth/2);}
 paint(x0,y0,x1,y1,r){const c=this.canvas,a=this.ensure(),dx=x1-x0,dy=y1-y0,n=dx*dx+dy*dy;
  for(let y=Math.max(0,Math.floor(Math.min(y0,y1)-r));y<Math.min(c.height,Math.ceil(Math.max(y0,y1)+r));y++)for(let x=Math.max(0,Math.floor(Math.min(x0,x1)-r));x<Math.min(c.width,Math.ceil(Math.max(x0,x1)+r));x++){
   const t=n?Math.max(0,Math.min(1,((x-x0)*dx+(y-y0)*dy)/n)):0;if((x-x0-t*dx)**2+(y-y0-t*dy)**2<=r*r)a[(y*c.width+x)*4+3]=this.globalCompositeOperation==='destination-out'?0:255;
  }
 }
}
function element(id){if(elements[id])return elements[id];const el={width:100,height:80,value:'20',checked:false,disabled:false,open:false,showModal(){this.open=true;},close(){this.open=false;},focus(){},setPointerCapture(){},getBoundingClientRect(){return{left:0,top:0,width:this.width,height:this.height};},getContext(){return this.context??=new CanvasContext(this);}};return elements[id]=el;}
const host={photocraftInpaint:require('../host/inpaint-core.js')};vm.runInNewContext(fs.readFileSync('host/object-removal.js','utf8'),{
 window:host,document:{getElementById:element,createElement:()=>element('canvas-'+Math.random())},Blob,Uint8Array,Uint8ClampedArray,Math,Number,
 createImageBitmap:async()=>({width:100,height:80,close(){closedImages++;}})
});
const tick=()=>new Promise(setImmediate),own={},context={own,isActive:()=>true,show(){},request(data){requests.push(data);return new Promise((resolve,reject)=>{requestResolve=resolve;requestReject=reject;});},cancel(reason){own.cancelled=reason;requestReject?.(reason);own.abort?.(reason);}};
const source={png:new Uint8Array([1,2,3]),mode:'inpaint'},event=(x,y)=>({button:0,clientX:x,clientY:y,pointerId:1,preventDefault(){}});
(async()=>{
 let promise=host.photocraftObjectRemoval(source,context);await tick();assert.equal(element('object-dialog').open,true);assert.equal(element('object-apply').disabled,true);assert.equal(requests.length,0,'Opening the brush dialog must not load a model');
 const canvas=element('object-canvas');element('object-brush').value='20';canvas.onpointerdown(event(40,35));canvas.onpointermove(event(50,35));canvas.onpointerup();assert.equal(element('object-preview').disabled,false);
 const pending=element('object-preview').onclick();assert.equal(requests.length,1);assert.equal(requests[0].type,'inpaint');const mask=requests[0].paint;assert(mask[35*100+45]>0);assert.equal(mask[0],0);
 own.progress('Loading object-removal model: 50%');assert.match(element('object-view').textContent,/50%/);
 assert.equal(element('object-apply').disabled,true);assert.equal(element('object-clear').disabled,true);canvas.onpointerdown(event(75,60));
 requestResolve({width:100,height:80,background:new Uint8Array(100*80*4).buffer});await pending;assert.equal(element('object-apply').disabled,false);
 element('object-original').checked=true;element('object-original').onchange();assert.match(element('object-view').textContent,/Original/);assert.equal(requests.length,1,'Original comparison reuses the result');
 canvas.onpointerdown(event(70,55));canvas.onpointerup();assert.equal(element('object-apply').disabled,true,'A brush edit must invalidate the previous result');
 element('object-undo').onclick();assert.equal(element('object-apply').disabled,true,'Undoing a mark still requires a fresh preview');
 element('object-erase').checked=true;canvas.onpointerdown(event(45,35));canvas.onpointerup();element('object-undo').onclick();
 const second=element('object-preview').onclick();requestResolve({width:100,height:80,background:new Uint8Array(32000).buffer});await second;element('object-apply').onclick();const result=await promise;assert.equal(result.byteLength,32000);assert.equal(element('object-dialog').open,false);assert.equal(closedImages,1);
 delete own.cancelled;promise=host.photocraftObjectRemoval(source,context);await tick();canvas.onpointerdown(event(40,35));canvas.onpointerup();const running=element('object-preview').onclick();const rejected=assert.rejects(promise,r=>/cancelled/.test(r));element('object-cancel').onclick();await rejected;await running;assert.equal(element('object-dialog').open,false);assert.equal(closedImages,2);
 console.log('Brush marks, unmark/undo, no inference on open/compare, result invalidation, original preservation, Apply and cancellation during inference passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
