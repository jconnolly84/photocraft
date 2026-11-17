/* Small deterministic image operations, shared by previews and the local worker. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.photocraftImageFinish=api;})(typeof globalThis==='object'?globalThis:this,()=>{
  function range(value,min,max,name){value=Number(value);if(!Number.isFinite(value)||value<min||value>max)throw Error('Invalid '+name);return value;}
  // Sliding-window extrema: linear work even for large masks or broad edges.
  function extrema(input,w,h,r,grow){
    if(!r)return input.slice();
    const pass=(src,vertical)=>{const out=new Uint8Array(src.length),length=vertical?h:w,lines=vertical?w:h,q=new Int32Array(length+2*r);
      for(let line=0;line<lines;line++){let head=0,tail=0;
        const at=i=>vertical?i*w+line:line*w+i;
        const value=i=>i<0||i>=length?0:src[at(i)];
        for(let i=-r;i<length+r;i++){const v=value(i);while(tail>head&&(grow?value(q[tail-1])<=v:value(q[tail-1])>=v))tail--;q[tail++]=i;
          while(tail>head&&q[head]<i-2*r)head++;if(i>=r)out[at(i-r)]=value(q[head]);}
      }return out;};
    return pass(pass(input,false),true);
  }
  function box(input,w,h,r){
    if(!r)return input.slice();
    const pass=(src,vertical)=>{const out=new Uint8Array(src.length),length=vertical?h:w,lines=vertical?w:h;
      for(let line=0;line<lines;line++){const at=i=>vertical?i*w+line:line*w+i;const v=i=>src[at(Math.max(0,Math.min(length-1,i)))];let sum=0;
        for(let k=-r;k<=r;k++)sum+=v(k);
        for(let i=0;i<length;i++){out[at(i)]=Math.round(sum/(2*r+1));sum+=v(i+r+1)-v(i-r);}
      }return out;};return pass(pass(input,false),true);
  }
  function refine(alpha,w,h,options){
    if(alpha.length!==w*h)throw Error('Invalid cutout mask');
    const shift=range(options.shift,-8,8,'edge shift'),feather=range(options.feather,0,8,'edge softness');
    const blend=(a,b,t)=>{for(let i=0;i<a.length;i++)a[i]=Math.round(a[i]*(1-t)+b[i]*t);return a;};
    const r=Math.floor(Math.abs(shift)),fraction=Math.abs(shift)-r;
    let out=extrema(alpha,w,h,r,shift>0);
    if(fraction)out=blend(out,extrema(alpha,w,h,r+1,shift>0),fraction);
    const f=Math.floor(feather),part=feather-f,soft=box(out,w,h,f);
    out=part?blend(soft,box(out,w,h,f+1),part):soft;
    return out;
  }
  // Percentile stretch plus restrained grey-world correction. Ignore transparent pixels.
  function analyse(rgba){
    const hist=[new Uint32Array(256),new Uint32Array(256),new Uint32Array(256)],sum=[0,0,0];let count=0;
    for(let i=0;i<rgba.length;i+=4){const weight=rgba[i+3];if(!weight)continue;count+=weight;for(let c=0;c<3;c++){hist[c][rgba[i+c]]+=weight;sum[c]+=rgba[i+c]*weight;}}
    if(!count)throw Error('This image has no visible pixels to enhance.');
    const avg=sum.map(n=>n/count),grey=(avg[0]+avg[1]+avg[2])/3;
    const channels=hist.map((bins,c)=>{let n=0,low=0,high=255;for(let i=0;i<256;i++){n+=bins[i];if(n>=count*0.005){low=i;break;}}
      n=0;for(let i=255;i>=0;i--){n+=bins[i];if(n>=count*0.005){high=i;break;}}
      // Do not stretch flat artwork or turn a dominant brand colour grey.
      return {low,high,gain:Math.max(0.9,Math.min(1.1,grey/Math.max(1,avg[c]))),stretch:high-low>=40};});
    return channels;
  }
  function enhance(rgba,channels,strength){
    const t=range(strength,0,100,'enhancement strength')/100,out=new Uint8ClampedArray(rgba);
    for(let i=0;i<out.length;i+=4){if(!out[i+3])continue;for(let c=0;c<3;c++){
      const p=channels[c],v=rgba[i+c],stretched=p.stretch?(v-p.low)*255/(p.high-p.low):v;
      // Blend the stretch to keep highlights/shadows from clipping aggressively.
      const target=(v*0.55+stretched*0.45)*(1+(p.gain-1)*0.5);
      out[i+c]=v+(Math.max(0,Math.min(255,target))-v)*t;
    }}return out;
  }
  return {refine,analyse,enhance};
});
