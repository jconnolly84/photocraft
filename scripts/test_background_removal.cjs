const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const callbacks={},workers=[],elements={};
const canvasContext=()=>({filter:'none',drawImage(){},putImageData(){},clearRect(){},fillRect(){},getImageData(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4).fill(255)};},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},createLinearGradient(){return{addColorStop(){}};}});
function element(id){return elements[id]??=( {value:id==='ai-bg-colour1'?'#143cff':id==='ai-bg-colour2'?'#d9ff43':'',hidden:false,disabled:false,files:[],open:false,
 addEventListener(event,fn){callbacks[id+':'+event]=fn;},showModal(){this.open=true;},close(){this.open=false;},getContext:canvasContext});}
const frame=element('editor');frame.contentWindow={Uint8Array};
class Worker{constructor(url,options){this.url=url;this.options=options;this.sent=[];workers.push(this);}postMessage(data,transfer){this.sent.push({data,transfer});}terminate(){this.terminated=true;}}
const host={photocraftSubjectBlur:require('../host/subject-blur.js'),photocraftImageFinish:require('../host/image-finish.js')};vm.runInNewContext(fs.readFileSync('host/background-removal.js','utf8'),{
 document:{getElementById:element,createElement:()=>element('canvas-'+Math.random())},window:host,Worker,Uint8Array,Uint8ClampedArray,ArrayBuffer,URL,Blob,
 createImageBitmap:async()=>({width:2,height:2,close(){}}),requestAnimationFrame:fn=>fn(),location:{href:'https://school.github.io/photocraft/'},
});
const original=new Uint8Array([137,80,78,71]),mask=[0,64,128,255];
const reply=(worker,data)=>worker.onmessage({data:{id:worker.sent.at(-1).data.id,...data}});
const maskReply=worker=>reply(worker,{type:'result',alpha:new Uint8Array(mask).buffer,width:2,height:2});
const tick=()=>new Promise(setImmediate),deadline=setTimeout(()=>{console.error('AI host test timed out');process.exit(1);},10000);
(async()=>{
 let result=host.photocraftRemoveBackground({png:original});assert.equal(element('background-tools').hidden,false);assert.equal(element('background-cancel').hidden,false);
 assert.equal(workers.length,1);assert.equal(workers[0].url.origin,'https://school.github.io');assert.equal(workers[0].options.type,'module');
 assert.deepEqual([...new Uint8Array(workers[0].sent[0].data.png)],[...original]);assert.notEqual(workers[0].sent[0].data.png,original.buffer);
 await assert.rejects(host.photocraftSubjectTool({png:original,mode:'select'}),r=>/already running/.test(r));
 reply(workers[0],{type:'progress',message:'Processing locally'});assert.equal(element('background-status').textContent,'Processing locally');
 maskReply(workers[0]);assert.deepEqual([...(await result)],mask);assert.equal(element('background-cancel').hidden,true);
 host.photocraftBackgroundComplete('Mask applied');assert.equal(element('background-status').textContent,'Mask applied');callbacks['background-dismiss:click']();assert.equal(element('background-tools').hidden,true);
 result=host.photocraftSubjectTool({png:original,mode:'select'});assert.equal(workers.length,1);maskReply(workers[0]);assert.deepEqual([...(await result).alpha],mask);
 result=host.photocraftRemoveBackground({png:original});callbacks['background-cancel:click']();await assert.rejects(result,r=>/cancelled/.test(r));assert.equal(workers[0].terminated,true);
 result=host.photocraftRemoveBackground({png:original});callbacks['editor:load']();await assert.rejects(result,r=>/restarted/.test(r));
 result=host.photocraftRemoveBackground({png:original});reply(workers.at(-1),{type:'error',message:'out of memory'});await assert.rejects(result,r=>/out of memory/.test(r));
 await assert.rejects(host.photocraftRemoveBackground({png:'invalid'}),r=>/too large/.test(r));
 const source={png:original,canvasWidth:4,canvasHeight:3,left:1,top:1};
 result=host.photocraftSubjectTool({...source,mode:'blur'});let worker=workers.at(-1);maskReply(worker);await tick();
 assert.equal(element('ai-effect-dialog').open,true);assert.equal(element('ai-blur-fields').hidden,false);
 const before=worker.sent.length;element('ai-blur-radius').value='37';element('ai-blur-radius').oninput();
 assert.equal(worker.sent.length,before,'Moving the preview slider must not run AI');
 element('ai-effect-apply').onclick();await tick();assert.equal(worker.sent.at(-1).data.type,'effect');assert.equal(worker.sent.at(-1).data.options.radius,37);
 reply(worker,{type:'result',background:new Uint8Array(16).buffer});let output=await result;assert.deepEqual([...output.alpha],mask);assert.equal(output.background.length,16);
 result=host.photocraftSubjectTool({...source,mode:'replace'});maskReply(worker);await tick();
 element('ai-background-type').value='image';element('ai-background-type').oninput();assert.equal(element('ai-effect-apply').disabled,true,'Do not apply an absent image');
 element('ai-background-type').value='gradient';element('ai-background-type').oninput();assert.equal(element('ai-effect-apply').disabled,false);
 element('ai-effect-apply').onclick();await tick();assert.equal(worker.sent.at(-1).data.options.type,'gradient');assert.equal(worker.sent.at(-1).data.canvasWidth,4);
 reply(worker,{type:'result',background:new Uint8Array(48).buffer});assert.equal((await result).background.length,48);
 result=host.photocraftSubjectTool({...source,mode:'replace'});maskReply(worker);await tick();
 element('ai-background-type').value='image';element('ai-background-type').oninput();
 element('ai-bg-file').files=[{name:'school.png',size:4,arrayBuffer:async()=>new Uint8Array([1,2,3,4]).buffer}];
 await element('ai-bg-file').onchange();assert.equal(element('ai-effect-apply').disabled,false);
 element('ai-effect-apply').onclick();await tick();
 assert.deepEqual([...new Uint8Array(worker.sent.at(-1).data.backdrop)],[1,2,3,4]);
 assert.equal(worker.sent.at(-1).transfer.length,2,'Send the chosen file only to the local worker');
 reply(worker,{type:'result',background:new Uint8Array(48).buffer});await result;
 result=host.photocraftSubjectTool({...source,mode:'blur'});maskReply(worker);await tick();element('ai-effect-dialog').oncancel({preventDefault(){}});
 await assert.rejects(result,r=>/cancelled/.test(r));assert.equal(element('ai-effect-dialog').open,false);
 result=host.photocraftSubjectTool({...source,mode:'replace'});maskReply(worker);callbacks['background-cancel:click']();await assert.rejects(result,r=>/cancelled/.test(r));assert.equal(element('ai-effect-dialog').open,false,'Cancellation during decode must not open a dialog later');
 result=host.photocraftSubjectTool({...source,mode:'select'});worker=workers.at(-1);
 const current=worker.sent.at(-1).data.id;worker.onmessage({data:{type:'result',id:current-1,alpha:new Uint8Array(mask).buffer}});
 assert.equal(element('background-cancel').hidden,false,'Ignore stale worker replies');maskReply(worker);await result;
 const requests=worker.sent.length;
 result=host.photocraftSubjectTool({png:original,mode:'enhance'});await tick();
 assert.equal(element('image-finish-dialog').open,true);assert.equal(worker.sent.length,requests,'Enhancement preview must not request a model or mask');
 element('image-strength').value='45';element('image-strength').oninput();element('image-finish-original').checked=true;element('image-finish-original').oninput();
 assert.equal(worker.sent.length,requests,'Preview and comparison must not start any worker operation');
 element('image-finish-apply').onclick();await tick();assert.equal(worker.sent.at(-1).data.type,'finish');assert.equal(worker.sent.at(-1).data.options.strength,45);
 reply(worker,{type:'result',background:new Uint8Array(16).buffer});output=await result;assert.equal(output.alpha.length,0);assert.equal(output.background.length,16);
 const maskBefore=new Uint8Array(mask);const previous=worker.sent.length;
 result=host.photocraftSubjectTool({png:original,mode:'refine',mask:maskBefore,width:2,height:2});await tick();
 assert.equal(element('image-finish-dialog').open,true);assert.equal(worker.sent.length,previous,'Existing layer masks skip inference');
 element('image-edge').value='-2';element('image-edge').oninput();element('image-finish-apply').onclick();await tick();
 assert.equal(worker.sent.at(-1).data.mode,'refine');assert.equal(worker.sent.at(-1).data.options.shift,-2);assert.deepEqual([...new Uint8Array(worker.sent.at(-1).data.alpha)],mask);
 reply(worker,{type:'result',alpha:new Uint8Array(mask).buffer});assert.deepEqual([...(await result).alpha],mask);assert.deepEqual([...maskBefore],mask);
 result=host.photocraftSubjectTool({png:original,mode:'refine'});assert.equal(worker.sent.at(-1).data.type,'mask');maskReply(worker);await tick();
 element('image-finish-cancel').onclick();await assert.rejects(result,r=>/cancelled/.test(r));assert.equal(element('image-finish-dialog').open,false);
 result=host.photocraftSubjectTool({png:original,mode:'enhance'});await tick();callbacks['background-cancel:click']();await assert.rejects(result,r=>/cancelled/.test(r));assert.equal(element('image-finish-dialog').open,false);
 console.log('All AI modes: shared worker, original bytes, settings without inference, local images, cancellation races, stale replies and editor restart passed.');
})().then(()=>clearTimeout(deadline)).catch(e=>{clearTimeout(deadline);console.error(e);process.exitCode=1;});
