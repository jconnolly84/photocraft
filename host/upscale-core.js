/* Qualcomm QuickSRNet Small 2x tile adapter. Model attribution: ai/models/quicksrnet-small-2x/. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.photocraftUpscale=api;})(typeof globalThis==='object'?globalThis:this,()=>{
  const TILE=128,HALO=4,CORE=TILE-HALO*2,MAX_PIXELS=1048576;
  function validate(width,height){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_PIXELS||width>4096||height>4096)throw Error('2× AI upscaling supports images up to 1 megapixel and 4096 pixels per side. Use a smaller source image.');}
  const clamp=(v,n)=>Math.max(0,Math.min(n-1,v));
  function alphaAt(data,w,h,x,y){const x0=Math.floor(x),y0=Math.floor(y),dx=x-x0,dy=y-y0;
    const a=(xx,yy)=>data[(clamp(yy,h)*w+clamp(xx,w))*4+3];
    return Math.round((a(x0,y0)*(1-dx)+a(x0+1,y0)*dx)*(1-dy)+(a(x0,y0+1)*(1-dx)+a(x0+1,y0+1)*dx)*dy);
  }
  async function tiled(data,width,height,run,progress=()=>{},region){
    validate(width,height);if(data.length!==width*height*4)throw Error('Invalid source image bytes');
    const r=region||{left:0,top:0,width,height};
    if(![r.left,r.top,r.width,r.height].every(Number.isInteger)||r.left<0||r.top<0||r.width<1||r.height<1||r.left+r.width>width||r.top+r.height>height)throw Error('Invalid upscale preview region');
    const ow=r.width*2,oh=r.height*2,out=new Uint8ClampedArray(ow*oh*4),count=Math.ceil(r.width/CORE)*Math.ceil(r.height/CORE);let done=0;
    for(let y=0;y<r.height;y+=CORE)for(let x=0;x<r.width;x+=CORE){
      const input=new Float32Array(3*TILE*TILE);
      for(let yy=0;yy<TILE;yy++)for(let xx=0;xx<TILE;xx++){
        const at=(clamp(r.top+y+yy-HALO,height)*width+clamp(r.left+x+xx-HALO,width))*4,i=yy*TILE+xx;
        for(let c=0;c<3;c++)input[c*TILE*TILE+i]=data[at+c]/255;
      }
      const values=await run(input);
      if(!(values instanceof Float32Array)||values.length!==3*TILE*TILE*4)throw Error('Unexpected upscaler output');
      const tw=Math.min(CORE,r.width-x)*2,th=Math.min(CORE,r.height-y)*2,edge=TILE*2,plane=edge*edge;
      for(let yy=0;yy<th;yy++)for(let xx=0;xx<tw;xx++){
        const to=((y*2+yy)*ow+x*2+xx)*4,from=(yy+HALO*2)*edge+xx+HALO*2;
        for(let c=0;c<3;c++){const v=values[c*plane+from];if(!Number.isFinite(v))throw Error('Invalid upscaler pixels');out[to+c]=Math.round(Math.max(0,Math.min(1,v))*255);}
        out[to+3]=alphaAt(data,width,height,r.left+x+(xx+0.5)/2-0.5,r.top+y+(yy+0.5)/2-0.5);
      }
      progress(++done,count);
    }
    return{pixels:out,width:ow,height:oh,left:r.left,top:r.top};
  }
  function previewRegion(width,height){validate(width,height);const w=Math.min(width,160),h=Math.min(height,120);return{left:Math.floor((width-w)/2),top:Math.floor((height-h)/2),width:w,height:h};}
  return{TILE,HALO,CORE,MAX_PIXELS,validate,tiled,previewRegion};
});
