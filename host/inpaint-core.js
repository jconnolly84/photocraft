/* Local MI-GAN adapter. Keep every unmarked pixel and all original alpha bytes. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.photocraftInpaint=api;})(typeof globalThis==='object'?globalThis:this,()=>{
  function dimensions(w,h){if(!Number.isInteger(w)||!Number.isInteger(h)||w<8||h<8||w*h>4194304||w>4096||h>4096)throw Error('Object removal supports images from 8 × 8 pixels up to 4 megapixels and 4096 pixels per side.');}
  function region(mask,w,h){dimensions(w,h);if(mask.length!==w*h)throw Error('Invalid removal marks');
    let left=w,top=h,right=-1,bottom=-1,count=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(!count)throw Error('Brush over the object and a little surrounding background first.');
    if(count>w*h*0.4)throw Error('Mark one small object at a time, leaving plenty of background for the fill.');
    const bw=right-left+1,bh=bottom-top+1;
    if(bw>768||bh>768)throw Error('Work on a smaller area (up to 768 pixels across), or resize a copy of the image first.');
    const edge=Math.max(512,Math.max(bw,bh)+256),cw=Math.min(w,edge),ch=Math.min(h,edge);
    const x=Math.max(0,Math.min(w-cw,Math.floor((left+right+1-cw)/2))),y=Math.max(0,Math.min(h-ch,Math.floor((top+bottom+1-ch)/2)));
    return{left:x,top:y,width:cw,height:ch,count,bounds:{left,top,right,bottom}};
  }
  function inputs(source,mask,w,h){const r=region(mask,w,h);if(source.length!==w*h*4)throw Error('Invalid source image');
    const n=r.width*r.height,image=new Uint8Array(n*3),keep=new Uint8Array(n);let known=0,marked=0;
    for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
      const at=(r.top+y)*w+r.left+x,i=y*r.width+x,a=source[at*4+3]/255;
      keep[i]=mask[at]?0:255;if(a>0){if(mask[at])marked++;else known++;}
      for(let c=0;c<3;c++)image[c*n+i]=Math.round(source[at*4+c]*a+255*(1-a));
    }
    if(!marked)throw Error('The marks do not cover visible image pixels.');
    if(known<16)throw Error('Leave more visible background around the object for the fill.');
    return{image,keep,region:r};
  }
  function composite(source,mask,w,h,r,rgb){
    if(source.length!==w*h*4||mask.length!==w*h||rgb.length!==r.width*r.height*3)throw Error('Invalid inpainting result');
    const out=new Uint8ClampedArray(source),plane=r.width*r.height;
    for(let y=r.bounds.top;y<=r.bounds.bottom;y++)for(let x=r.bounds.left;x<=r.bounds.right;x++){
      const at=y*w+x,t=mask[at]/255;if(!t||!source[at*4+3])continue;const from=(y-r.top)*r.width+x-r.left;
      for(let c=0;c<3;c++)out[at*4+c]=Math.round(source[at*4+c]*(1-t)+rgb[c*plane+from]*t);
    }
    return out;
  }
  return{dimensions,region,inputs,composite};
});
