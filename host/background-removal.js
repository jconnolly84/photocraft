/* On-device subject tools. Only static model/runtime files are fetched. */
(() => {
  const get=id=>document.getElementById(id),frame=get('editor'),panel=get('background-tools'),status=get('background-status'),cancel=get('background-cancel');
  let worker,pending,task,sequence=0;
  const show=message=>{status.textContent=message;panel.hidden=false;task?.progress?.(message);};
  function stop(reason) {
    worker?.terminate();worker=null;
    if(task)task.cancelled=reason;
    const request=pending;pending=null;request?.reject(reason);task?.abort?.(reason);
    show(reason);
  }
  function request(data) {
    if(!worker) {
      const current=new Worker(new URL('./background-worker.js?v=__BACKGROUND_WORKER_VERSION__',location.href),{type:'module'});worker=current;
      current.onmessage=({data})=>{
        if(worker!==current||!task)return;
        if(data.type==='progress'){show(data.message);return;}
        if(!pending||data.id!==pending.id)return;
        const active=pending;pending=null;
        if(data.type==='result')active.resolve(data);
        else if(data.type==='error'){active.reject(data.message);current.terminate();worker=null;}
      };
      current.onerror=()=>{if(worker===current)stop('The AI worker stopped. Close other tabs and retry, or use Remove Background (Quick).');};
    }
    return new Promise((resolve,reject)=>{
      const id=++sequence;pending={resolve,reject,id};const transfer=[];
      const message={...data,id};
      if(data.png){message.png=new Uint8Array(data.png).buffer;transfer.push(message.png);}
      if(data.backdrop){message.backdrop=new Uint8Array(data.backdrop).buffer;transfer.push(message.backdrop);}
      if(data.alpha){message.alpha=new Uint8Array(data.alpha).buffer;transfer.push(message.alpha);}
      if(data.paint){message.paint=new Uint8Array(data.paint).buffer;transfer.push(message.paint);}
      worker.postMessage(message,transfer);
    });
  }
  const cover=(iw,ih,w,h)=>{const s=Math.max(w/iw,h/ih);return[(w-iw*s)/2,(h-ih*s)/2,iw*s,ih*s];};
  async function chooseEffect(own,source,mask) {
    const dialog=get('ai-effect-dialog');if(!dialog)throw 'AI controls are unavailable. Reload after saving your work.';
    const mode=source.mode,preview=get('ai-effect-preview'),radius=get('ai-blur-radius'),type=get('ai-background-type');
    const colour1=get('ai-bg-colour1'),colour2=get('ai-bg-colour2'),file=get('ai-bg-file'),apply=get('ai-effect-apply'),error=get('ai-effect-error');
    get('ai-effect-title').textContent=mode==='blur'?'Blur Background (AI)':'Replace Background (AI)';
    get('ai-blur-fields').hidden=mode!=='blur';get('ai-replace-fields').hidden=mode!=='replace';
    error.textContent='';file.value='';type.value='colour';radius.value='18';get('ai-blur-value').value='18';apply.disabled=false;
    const image=await createImageBitmap(new Blob([source.png],{type:'image/png'}));
    if(task!==own||own.cancelled){image.close();throw own.cancelled||'AI tool cancelled.';}
    const w=mode==='blur'?mask.width:source.canvasWidth,h=mode==='blur'?mask.height:source.canvasHeight;
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>16777216){image.close();throw 'Resize the canvas below 16 megapixels first.';}
    const scale=Math.min(480/w,360/h,1);preview.width=Math.max(1,Math.round(w*scale));preview.height=Math.max(1,Math.round(h*scale));
    const left=mode==='blur'?0:source.left,top=mode==='blur'?0:source.top;
    const sw=Math.max(1,Math.round(mask.width*scale)),sh=Math.max(1,Math.round(mask.height*scale));
    const subject=document.createElement('canvas');subject.width=sw;subject.height=sh;const sc=subject.getContext('2d');
    sc.drawImage(image,0,0,sw,sh);const matte=document.createElement('canvas');matte.width=sw;matte.height=sh;
    const mc=matte.getContext('2d'),mp=mc.createImageData(sw,sh),alpha=new Uint8Array(mask.alpha);
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++) {
      const i=(y*sw+x)*4;mp.data[i]=mp.data[i+1]=mp.data[i+2]=255;
      mp.data[i+3]=alpha[Math.min(mask.height-1,Math.floor(y*mask.height/sh))*mask.width+Math.min(mask.width-1,Math.floor(x*mask.width/sw))];
    }
    mc.putImageData(mp,0,0);sc.globalCompositeOperation='destination-in';sc.drawImage(matte,0,0);sc.globalCompositeOperation='source-over';
    let replacement,backdrop,loading=false,closed=false,decodeGeneration=0,scheduled=false;
    const options=()=>({radius:Number(radius.value),type:type.value,colour1:colour1.value,colour2:colour2.value});
    const render=()=>{
      scheduled=false;if(closed)return;const c=preview.getContext('2d'),o=options();c.clearRect(0,0,preview.width,preview.height);c.filter='none';
      get('ai-blur-value').value=String(o.radius);
      get('ai-colour2-label').hidden=o.type!=='gradient';get('ai-bg-file-fields').hidden=o.type!=='image';
      apply.disabled=loading||(mode==='replace'&&o.type==='image'&&!backdrop);
      if(mode==='blur') {
        const blurred=window.photocraftSubjectBlur(image,preview.width,preview.height,o.radius*scale,alpha,mask.width,mask.height,(w,h)=>{
          const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;
        });
        c.drawImage(blurred.canvas,0,0);
        if(!blurred.hasBackground){error.textContent='This image has no visible background to blur. Use Replace Background instead.';apply.disabled=true;}
      }else{
        c.fillStyle=o.colour1;
        if(o.type==='gradient'){const g=c.createLinearGradient(0,0,preview.width,preview.height);g.addColorStop(0,o.colour1);g.addColorStop(1,o.colour2);c.fillStyle=g;}
        c.fillRect(0,0,preview.width,preview.height);
        if(o.type==='image'&&replacement)c.drawImage(replacement,...cover(replacement.width,replacement.height,preview.width,preview.height));
      }
      c.drawImage(subject,Math.round(left*scale),Math.round(top*scale));
    };
    const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(render);}};
    return new Promise((resolve,reject)=>{
      const finish=(result,reason)=>{
        if(closed)return;closed=true;decodeGeneration++;own.abort=null;image.close();replacement?.close();
        for(const input of [radius,type,colour1,colour2])input.oninput=null;file.onchange=null;apply.onclick=null;
        get('ai-effect-cancel').onclick=null;dialog.oncancel=null;if(dialog.open)dialog.close();
        reason?reject(reason):resolve(result);
      };
      own.abort=reason=>finish(null,reason);
      for(const input of [radius,type,colour1,colour2])input.oninput=schedule;
      file.onchange=async()=>{
        const generation=++decodeGeneration;backdrop=null;replacement?.close();replacement=null;error.textContent='';
        const selected=file.files?.[0];if(!selected){loading=false;schedule();return;}
        loading=true;schedule();
        try {
          if(selected.size>80*1024*1024)throw Error('Choose an image smaller than 80 MB.');
          const bytes=await selected.arrayBuffer(),bitmap=await createImageBitmap(selected);
          if(closed||generation!==decodeGeneration){bitmap.close();return;}
          if(bitmap.width*bitmap.height>16777216){bitmap.close();throw Error('Resize the background image below 16 megapixels first.');}
          backdrop=bytes;replacement=bitmap;get('ai-bg-file-status').textContent=selected.name+' — fills the canvas, cropped centrally to fit. File stays on this device.';
        }catch(e){if(!closed&&generation===decodeGeneration)error.textContent=e.message||String(e);}
        finally{if(!closed&&generation===decodeGeneration){loading=false;schedule();}}
      };
      apply.onclick=()=>{if(!apply.disabled)finish({options:options(),backdrop});};
      get('ai-effect-cancel').onclick=()=>finish(null,'AI tool cancelled. The original was kept.');
      dialog.oncancel=event=>{event.preventDefault();finish(null,'AI tool cancelled. The original was kept.');};
      render();dialog.showModal();
    });
  }
  async function chooseFinish(own,source,mask) {
    const dialog=get('image-finish-dialog'),preview=get('image-finish-preview'),edge=get('image-edge'),feather=get('image-feather'),strength=get('image-strength'),original=get('image-finish-original'),apply=get('image-finish-apply'),error=get('image-finish-error');
    const refining=source.mode==='refine';
    get('image-finish-title').textContent=refining?'Refine Cutout':'Auto Enhance';
    get('image-finish-description').textContent=refining?'Adjust the cutout edge. Existing masks are reused; an unmasked image uses Select Subject first. This adjusts the mask, not the original pixels.':'Gently balance colour and contrast. This uses lightweight image processing, with no AI model download. A new layer keeps your original underneath.';
    get('image-refine-fields').hidden=!refining;get('image-enhance-fields').hidden=refining;
    edge.value='0';feather.value='1';strength.value='65';original.checked=false;error.textContent='';apply.disabled=false;
    const image=await createImageBitmap(new Blob([source.png],{type:'image/png'}));
    if(task!==own||own.cancelled){image.close();throw own.cancelled||'Image tool cancelled.';}
    const scale=Math.min(480/image.width,360/image.height,1),w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale));
    preview.width=w;preview.height=h;
    const make=(cw,ch)=>{const c=document.createElement('canvas');c.width=cw;c.height=ch;return c;};
    const sampleScale=Math.min(1,1024/Math.max(image.width,image.height)),sample=make(Math.max(1,Math.round(image.width*sampleScale)),Math.max(1,Math.round(image.height*sampleScale))),sc=sample.getContext('2d',{willReadFrequently:true});
    sc.drawImage(image,0,0,sample.width,sample.height);
    const stats=refining?null:window.photocraftImageFinish.analyse(sc.getImageData(0,0,sample.width,sample.height).data);
    const base=make(w,h),bc=base.getContext('2d',{willReadFrequently:true});bc.drawImage(image,0,0,w,h);const pixels=bc.getImageData(0,0,w,h);
    let small;
    if(mask){const full=make(mask.width,mask.height),fc=full.getContext('2d'),p=fc.createImageData(mask.width,mask.height),alpha=new Uint8Array(mask.alpha);
      for(let i=0;i<alpha.length;i++){p.data[i*4]=p.data[i*4+1]=p.data[i*4+2]=alpha[i];p.data[i*4+3]=255;}
      fc.putImageData(p,0,0);const reduced=make(w,h),rc=reduced.getContext('2d',{willReadFrequently:true});rc.drawImage(full,0,0,w,h);const data=rc.getImageData(0,0,w,h).data;small=new Uint8Array(w*h);for(let i=0;i<small.length;i++)small[i]=data[i*4];
    }
    let closed=false,scheduled=false;
    const options=()=>({shift:Number(edge.value),feather:Number(feather.value),strength:Number(strength.value)});
    const render=()=>{scheduled=false;if(closed)return;const o=options(),c=preview.getContext('2d'),out=c.createImageData(w,h);out.data.set(pixels.data);
      get('image-edge-value').value=String(o.shift);get('image-feather-value').value=String(o.feather);get('image-strength-value').value=String(o.strength);
      get('image-finish-view').textContent=original.checked?'Preview: Original — before changes':refining?'Preview: Refined cutout':`Preview: Enhanced — ${o.strength}% strength`;
      if(refining){const alpha=original.checked?small:window.photocraftImageFinish.refine(small,w,h,{shift:o.shift*scale,feather:o.feather*scale});for(let i=0;i<alpha.length;i++)out.data[i*4+3]=Math.round(out.data[i*4+3]*alpha[i]/255);}
      else {
        if(!original.checked)out.data.set(window.photocraftImageFinish.enhance(pixels.data,stats,o.strength));
        if(small)for(let i=0;i<small.length;i++)out.data[i*4+3]=Math.round(out.data[i*4+3]*small[i]/255);
      }
      c.putImageData(out,0,0);
    };
    return new Promise((resolve,reject)=>{
      const finish=(result,reason)=>{if(closed)return;closed=true;own.abort=null;image.close();for(const el of [edge,feather,strength,original])el.oninput=null;original.onchange=null;apply.onclick=null;get('image-finish-cancel').onclick=null;dialog.oncancel=null;if(dialog.open)dialog.close();reason?reject(reason):resolve(result);};
      own.abort=reason=>finish(null,reason);
      for(const el of [edge,feather,strength,original])el.oninput=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(render);}};
      original.onchange=original.oninput;
      apply.onclick=()=>finish(options());get('image-finish-cancel').onclick=()=>finish(null,'Image tool cancelled. The original was kept.');dialog.oncancel=e=>{e.preventDefault();finish(null,'Image tool cancelled. The original was kept.');};
      render();dialog.showModal();
    });
  }
  async function chooseUpscale(own,source,result) {
    const image=await createImageBitmap(new Blob([source.png],{type:'image/png'}));
    if(task!==own||own.cancelled){image.close();throw own.cancelled||'Upscaling cancelled.';}
    const dialog=get('upscale-dialog'),preview=get('upscale-preview'),original=get('upscale-original');
    preview.width=result.width;preview.height=result.height;original.checked=false;
    get('upscale-dimensions').textContent=`Source: ${result.sourceWidth} × ${result.sourceHeight} → ${result.sourceWidth*2} × ${result.sourceHeight*2} pixels.`;
    const baseline=document.createElement('canvas');baseline.width=result.width;baseline.height=result.height;
    const bc=baseline.getContext('2d',{willReadFrequently:true});bc.imageSmoothingEnabled=true;bc.imageSmoothingQuality='high';
    bc.drawImage(image,result.left,result.top,result.width/2,result.height/2,0,0,result.width,result.height);
    const before=bc.getImageData(0,0,result.width,result.height).data,after=new Uint8ClampedArray(result.background);
    let closed=false;
    const render=()=>{if(closed)return;const c=preview.getContext('2d'),p=c.createImageData(result.width,result.height);p.data.set(original.checked?before:after);
      if(source.mask){const alpha=new Uint8Array(source.mask);for(let y=0;y<result.height;y++)for(let x=0;x<result.width;x++){
        const at=(y*result.width+x)*4+3,m=(result.top+Math.floor(y/2))*result.sourceWidth+result.left+Math.floor(x/2);p.data[at]=Math.round(p.data[at]*alpha[m]/255);
      }}
      get('upscale-view').textContent=original.checked?'Preview: Original — smooth 2× enlargement':'Preview: AI 2× — enhanced resolution';c.putImageData(p,0,0);
    };
    return new Promise((resolve,reject)=>{
      const finish=reason=>{if(closed)return;closed=true;own.abort=null;image.close();original.oninput=null;original.onchange=null;get('upscale-apply').onclick=null;get('upscale-cancel').onclick=null;dialog.oncancel=null;if(dialog.open)dialog.close();reason?reject(reason):resolve();};
      own.abort=finish;original.oninput=render;original.onchange=render;
      get('upscale-apply').onclick=()=>finish();get('upscale-cancel').onclick=()=>finish('Upscaling cancelled. The original was kept.');dialog.oncancel=e=>{e.preventDefault();finish('Upscaling cancelled. The original was kept.');};
      render();dialog.showModal();
    });
  }
  async function run(source) {
    if(task)throw 'An AI tool is already running.';
    const mode=source.mode||'remove';
    if(!['remove','select','blur','replace','refine','enhance','upscale','inpaint'].includes(mode))throw 'Unknown image tool.';
    if(!ArrayBuffer.isView(source.png)||source.png.byteLength>80*1024*1024)throw 'Image is too large for local background removal.';
    const own={};task=own;cancel.hidden=false;show(mode==='enhance'?'Preparing the enhancement preview...':'Preparing the cutout on this PC...');
    try {
      if(mode==='inpaint') {
        const pixels=await window.photocraftObjectRemoval(source,{own,request,cancel:stop,isActive:()=>task===own,show});
        if(own.cancelled)throw own.cancelled;const realm=frame.contentWindow.Uint8Array;
        return{alpha:new realm(0),background:new realm(pixels)};
      }
      if(mode==='upscale') {
        show('Preparing a 2× AI detail preview locally...');
        const preview=await request({type:'upscale',png:source.png,preview:true});if(own.cancelled)throw own.cancelled;
        await chooseUpscale(own,source,preview);if(own.cancelled)throw own.cancelled;
        show('Upscaling the full image locally...');
        const result=await request({type:'upscale',png:source.png,preview:false});
        const realm=frame.contentWindow.Uint8Array;return{alpha:new realm(0),background:new realm(result.background)};
      }
      if(mode==='enhance'||mode==='refine') {
        const mask=source.mask?{alpha:source.mask,width:source.width,height:source.height}:mode==='enhance'?null:await request({type:'mask',png:source.png});
        if(own.cancelled)throw own.cancelled;
        const options=await chooseFinish(own,source,mask);if(own.cancelled)throw own.cancelled;
        show('Finishing the image locally...');
        const result=await request({type:'finish',png:source.png,mode,options,...(mask?{alpha:new Uint8Array(mask.alpha)}:{})});
        const realm=frame.contentWindow.Uint8Array;
        return{alpha:new realm(result.alpha||0),...(result.background?{background:new realm(result.background)}:{})};
      }
      const mask=await request({type:'mask',png:source.png});
      if(own.cancelled)throw own.cancelled;
      const realm=frame.contentWindow.Uint8Array;
      if(mode==='remove'){show('Mask calculated. Applying it to the source layer...');return new realm(mask.alpha);}
      if(mode==='select'){show('Mask calculated. Creating the selection...');return{alpha:new realm(mask.alpha)};}
      const settings=await chooseEffect(own,source,mask);
      if(own.cancelled)throw own.cancelled;
      show('Preparing the background locally...');
      const background=await request({type:'effect',png:source.png,mode,canvasWidth:source.canvasWidth,canvasHeight:source.canvasHeight,...settings});
      show('Applying the subject and background as separate layers...');
      return{alpha:new realm(mask.alpha),background:new realm(background.background)};
    }catch(reason){show('AI tool: '+(reason.message||String(reason)));throw reason;}
    finally{if(task===own){task=null;pending=null;cancel.hidden=true;}}
  }
  window.photocraftRemoveBackground=source=>run({...source,mode:'remove'});
  window.photocraftSubjectTool=run;
  window.photocraftBackgroundComplete=show;
  cancel.addEventListener('click',()=>{if(task)stop('AI tool cancelled. The original was kept.');});
  get('background-dismiss').addEventListener('click',()=>{if(!task)panel.hidden=true;});
  frame.addEventListener('load',()=>{if(task)stop('The editor restarted. The AI result was discarded.');});
})();
