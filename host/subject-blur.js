/* Shared, mask-aware Canvas blur. No model, network or persistent image state. */
(function(root,factory){
  const blur=factory();
  if(typeof module==='object'&&module.exports)module.exports=blur;
  else root.photocraftSubjectBlur=blur;
})(globalThis,()=>function(image,w,h,radius,mask,mw,mh,createCanvas){
  const source=createCanvas(w,h),sc=source.getContext('2d',{willReadFrequently:true});
  sc.drawImage(image,0,0,w,h);
  const data=sc.getImageData(0,0,w,h),originalAlpha=new Uint8Array(w*h);
  let weightSum=0,red=0,green=0,blue=0;
  // Exclude the subject before filtering, rather than blurring its colours
  // into the background and hiding only the centre afterwards.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=y*w+x,i=p*4;
    originalAlpha[p]=data.data[i+3];
    const m=mask[Math.min(mh-1,Math.floor(y*mh/h))*mw+Math.min(mw-1,Math.floor(x*mw/w))];
    const weight=(data.data[i+3]/255)*Math.max(0,1-m/32);
    red+=data.data[i]*weight;green+=data.data[i+1]*weight;blue+=data.data[i+2]*weight;weightSum+=weight;
    data.data[i+3]=Math.round(weight*255);
  }
  sc.putImageData(data,0,0);
  const result=createCanvas(w,h),rc=result.getContext('2d',{willReadFrequently:true});
  if(!('filter' in rc))throw Error('This browser does not support background blur. Try Chrome or Edge.');
  rc.filter=`blur(${radius}px)`;rc.drawImage(source,0,0);rc.filter='none';
  // Canvas returns unpremultiplied colour, normalising the blurred weights.
  // Deep inside the covered subject, use the background's average colour;
  // the sharp foreground covers this region. Never reveal a blurred ghost.
  const output=rc.getImageData(0,0,w,h);
  const average=weightSum?[red/weightSum,green/weightSum,blue/weightSum]:[0,0,0];
  for(let p=0;p<w*h;p++){
    const i=p*4;
    if(output.data[i+3]===0){output.data[i]=average[0];output.data[i+1]=average[1];output.data[i+2]=average[2];}
    output.data[i+3]=originalAlpha[p];
  }
  rc.putImageData(output,0,0);
  return{canvas:result,hasBackground:weightSum>0};
});
