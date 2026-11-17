/* Brush marks and previews stay on this device. Inference runs in the shared worker. */
(() => {
  const get=id=>document.getElementById(id);
  window.photocraftObjectRemoval=async(source,context)=>{
    const {own,request,cancel,isActive,show}=context;
    const image=await createImageBitmap(new Blob([source.png],{type:'image/png'}));
    if(!isActive()||own.cancelled){image.close();throw own.cancelled||'Object removal cancelled.';}
    const w=image.width,h=image.height;window.photocraftInpaint.dimensions(w,h);
    const dialog=get('object-dialog'),view=get('object-canvas'),size=get('object-brush'),erase=get('object-erase'),undo=get('object-undo'),clear=get('object-clear'),run=get('object-preview'),apply=get('object-apply'),compare=get('object-original'),error=get('object-error');
    const scale=Math.min(1,768/w,320/h);view.width=Math.max(1,Math.round(w*scale));view.height=Math.max(1,Math.round(h*scale));
    const make=(cw,ch)=>{const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;return canvas;};
    const marks=make(w,h),mc=marks.getContext('2d',{willReadFrequently:true}),tint=make(view.width,view.height),tc=tint.getContext('2d');
    const base=make(w,h),bc=base.getContext('2d',{willReadFrequently:true});bc.drawImage(image,0,0);
    let visibleMask;
    if(source.mask){visibleMask=make(w,h);const c=visibleMask.getContext('2d'),p=c.createImageData(w,h),alpha=new Uint8Array(source.mask);for(let i=0;i<alpha.length;i++){p.data[i*4]=p.data[i*4+1]=p.data[i*4+2]=255;p.data[i*4+3]=alpha[i];}c.putImageData(p,0,0);bc.globalCompositeOperation='destination-in';bc.drawImage(visibleMask,0,0);bc.globalCompositeOperation='source-over';}
    size.value=String(Math.min(300,Math.max(8,Math.round(Math.max(w,h)/30))));erase.checked=false;compare.checked=false;
    error.textContent='';get('object-brush-value').value=size.value;
    let strokes=[],stroke,closed=false,busy=false,result,resultCanvas,resultVersion=-1,version=0,hover,progress='';
    const invalidate=()=>{version++;result=null;if(resultCanvas){resultCanvas.width=1;resultCanvas=null;}compare.checked=false;error.textContent='';};
    const controls=()=>{size.disabled=erase.disabled=undo.disabled=clear.disabled=run.disabled=busy;undo.disabled=busy||!strokes.length;clear.disabled=busy||!strokes.length;run.disabled=busy||!strokes.length;apply.disabled=busy||!result||resultVersion!==version;compare.disabled=!result||busy;};
    const render=()=>{if(closed)return;controls();const c=view.getContext('2d');c.clearRect(0,0,view.width,view.height);c.drawImage(resultCanvas&&!compare.checked?resultCanvas:base,0,0,view.width,view.height);
      if(!result){tc.clearRect(0,0,tint.width,tint.height);tc.globalCompositeOperation='source-over';tc.fillStyle='#ff367f';tc.fillRect(0,0,tint.width,tint.height);tc.globalCompositeOperation='destination-in';tc.drawImage(marks,0,0,tint.width,tint.height);tc.globalCompositeOperation='source-over';c.globalAlpha=0.55;c.drawImage(tint,0,0);c.globalAlpha=1;}
      get('object-view').textContent=busy?(progress||'Filling the marked region locally…'):result?(compare.checked?'Preview: Original — before removal':'Preview: Object removed — Apply to keep this result'):'Paint pink over one object, its outline and shadow. Then choose Preview removal.';
      get('object-brush-value').value=size.value;
      if(hover&&!busy&&!result){c.beginPath();c.arc(hover[0]*view.width/w,hover[1]*view.height/h,Number(size.value)*view.width/w/2,0,Math.PI*2);c.strokeStyle='#fff';c.lineWidth=1;c.stroke();}
    };
    const draw=(s,from,to)=>{mc.globalCompositeOperation=s.erase?'destination-out':'source-over';mc.fillStyle=mc.strokeStyle='#fff';mc.lineWidth=s.size;mc.lineCap=mc.lineJoin='round';if(!from){mc.beginPath();mc.arc(to[0],to[1],s.size/2,0,Math.PI*2);mc.fill();}else{mc.beginPath();mc.moveTo(...from);mc.lineTo(...to);mc.stroke();}mc.globalCompositeOperation='source-over';};
    const rebuild=()=>{mc.clearRect(0,0,w,h);for(const s of strokes){draw(s,null,s.points[0]);for(let i=1;i<s.points.length;i++)draw(s,s.points[i-1],s.points[i]);}};
    const point=e=>{const rect=view.getBoundingClientRect();return[Math.max(0,Math.min(w-1,(e.clientX-rect.left)*w/rect.width)),Math.max(0,Math.min(h-1,(e.clientY-rect.top)*h/rect.height))];};
    return new Promise((resolve,reject)=>{
      const finish=(value,reason)=>{if(closed)return;closed=true;own.abort=null;own.progress=null;image.close();for(const key of ['onpointerdown','onpointermove','onpointerup','onpointercancel','onpointerleave'])view[key]=null;
        for(const el of [size,erase,undo,clear,run,apply,compare,get('object-cancel')]){el.onclick=null;el.oninput=null;el.onchange=null;}dialog.oncancel=null;if(dialog.open)dialog.close();for(const canvas of [marks,tint,base,visibleMask,resultCanvas])if(canvas){canvas.width=1;canvas.height=1;}reason?reject(reason):resolve(value);};
      own.abort=reason=>finish(null,reason);
      own.progress=message=>{if(!closed&&busy){progress=message;render();}};
      view.onpointerdown=e=>{if(e.button!==0||busy)return;e.preventDefault();view.focus();if(strokes.length>=200){error.textContent='Use Clear marks to start a fresh set of marks.';return;}invalidate();const p=point(e);stroke={erase:erase.checked,size:Number(size.value),points:[p]};strokes.push(stroke);draw(stroke,null,p);hover=p;try{view.setPointerCapture(e.pointerId);}catch{}render();};
      view.onpointermove=e=>{hover=point(e);if(stroke&&!busy&&stroke.points.length<2000){const previous=stroke.points.at(-1);stroke.points.push(hover);draw(stroke,previous,hover);}render();};
      const end=()=>{stroke=null;render();};view.onpointerup=end;view.onpointercancel=end;view.onpointerleave=()=>{hover=null;if(!stroke)render();};
      size.oninput=render;erase.onchange=render;compare.onchange=render;compare.oninput=render;
      undo.onclick=()=>{if(busy)return;strokes.pop();invalidate();rebuild();render();};clear.onclick=()=>{if(busy)return;strokes=[];stroke=null;invalidate();mc.clearRect(0,0,w,h);render();};
      run.onclick=async()=>{if(busy)return;try{
        const rgba=mc.getImageData(0,0,w,h).data,paint=new Uint8Array(w*h);for(let i=0;i<paint.length;i++)paint[i]=rgba[i*4+3];window.photocraftInpaint.region(paint,w,h);
        const captured=version;busy=true;hover=null;progress='Preparing object removal on this device...';error.textContent='';render();show(progress);
        const answer=await request({type:'inpaint',png:source.png,paint});if(closed||!isActive()||own.cancelled||version!==captured)return;
        if(answer.width!==w||answer.height!==h||answer.background.byteLength!==w*h*4)throw Error('The removal result has the wrong size.');
        result=answer.background;resultVersion=captured;resultCanvas=make(w,h);const c=resultCanvas.getContext('2d'),p=c.createImageData(w,h);p.data.set(new Uint8ClampedArray(result));c.putImageData(p,0,0);if(visibleMask){c.globalCompositeOperation='destination-in';c.drawImage(visibleMask,0,0);c.globalCompositeOperation='source-over';}
      }catch(e){if(!closed)error.textContent=e.message||String(e);}finally{if(!closed){busy=false;render();}}};
      apply.onclick=()=>{if(!apply.disabled)finish(result);};get('object-cancel').onclick=()=>cancel('Object removal cancelled. The original was kept.');dialog.oncancel=e=>{e.preventDefault();cancel('Object removal cancelled. The original was kept.');};
      render();dialog.showModal();
    });
  };
})();
