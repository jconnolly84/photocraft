const assert=require('node:assert/strict'),{refine,analyse,enhance}=require('../host/image-finish.js');
const w=7,h=7,mask=new Uint8Array(w*h);for(let y=2;y<5;y++)for(let x=2;x<5;x++)mask[y*w+x]=255;
const grown=refine(mask,w,h,{shift:1,feather:0}),shrunk=refine(mask,w,h,{shift:-1,feather:0});
assert.equal(grown.filter(v=>v===255).length,25);assert.equal(shrunk.filter(v=>v===255).length,1);
assert.equal(mask.filter(v=>v===255).length,9,'Never mutate the original mask');
const soft=refine(mask,w,h,{shift:0,feather:1});assert(soft.some(v=>v>0&&v<255));
assert.deepEqual(refine(mask,w,h,{shift:0,feather:0}),mask);
assert.notDeepEqual(refine(mask,w,h,{shift:0.25,feather:0}),mask,'Scaled preview shifts remain visible below one pixel');
// Compare the linear extrema implementation with a deliberately slow reference.
for(const shift of [-3,-1,1,3]){const expected=new Uint8Array(w*h),r=Math.abs(shift);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=shift>0?0:255;for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++){const p=xx<0||yy<0||xx>=w||yy>=h?0:mask[yy*w+xx];v=shift>0?Math.max(v,p):Math.min(v,p);}expected[y*w+x]=v;}assert.deepEqual(refine(mask,w,h,{shift,feather:0}),expected);}
const rgba=new Uint8ClampedArray([30,40,50,255,100,110,120,255,170,180,190,255,255,0,0,0]);
const stats=analyse(rgba),zero=enhance(rgba,stats,0),full=enhance(rgba,stats,100),half=enhance(rgba,stats,50);
assert.deepEqual(zero,rgba);assert.notDeepEqual(full,rgba);assert.equal(full[15],0);assert.equal(full[12],255,'Ignore fully transparent RGB');
for(let i=0;i<12;i++)if(i%4!==3)assert(Math.abs(half[i]-(full[i]+rgba[i])/2)<=1);
assert.deepEqual(enhance(new Uint8ClampedArray([120,120,120,255]),analyse(new Uint8ClampedArray([120,120,120,255])),100),new Uint8ClampedArray([120,120,120,255]),'Flat neutral art must stay flat');
assert.doesNotThrow(()=>analyse(new Uint8ClampedArray([120,130,140,64])),'Semi-transparent artwork is still visible');
assert.throws(()=>refine(mask,w,h,{shift:9,feather:1}));assert.throws(()=>analyse(new Uint8ClampedArray(4)));assert.throws(()=>enhance(rgba,stats,NaN));
console.log('Cutout expansion/contraction, feathering, reference morphology, original preservation, enhancement strength, transparency and flat-image safeguards passed.');
