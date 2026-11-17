const assert=require('node:assert/strict'),api=require('../host/inpaint-core.js');
const w=600,h=400,source=new Uint8ClampedArray(w*h*4),mask=new Uint8Array(w*h);
for(let y=0;y<h;y++)for(let x=0;x<w;x++)source.set([x%251,y%249,(x+y)%253,200],(y*w+x)*4);
for(let y=90;y<130;y++)for(let x=530;x<570;x++)mask[y*w+x]=255;
mask[90*w+530]=128;
const before=source.slice(),marks=mask.slice(),p=api.inputs(source,mask,w,h),r=p.region;
assert.equal(r.width,512);assert(r.left>=0&&r.left+r.width<=w);assert(r.top>=0&&r.top+r.height<=h);
assert.equal(p.image.length,r.width*r.height*3);assert.equal(p.keep[(100-r.top)*r.width+540-r.left],0);assert.equal(p.keep[0],255);
const model=new Uint8Array(r.width*r.height*3).fill(80),result=api.composite(source,mask,w,h,r,model);
for(let i=0;i<w*h;i++){assert.equal(result[i*4+3],source[i*4+3]);if(!mask[i])assert.deepEqual(result.slice(i*4,i*4+4),source.slice(i*4,i*4+4),'Every unmarked byte must remain exact');}
assert.equal(result[(100*w+540)*4],80);assert.equal(result[(90*w+530)*4],Math.round(source[(90*w+530)*4]*(1-128/255)+80*128/255));
assert.deepEqual(source,before);assert.deepEqual(mask,marks);
assert.throws(()=>api.region(new Uint8Array(w*h),w,h),/Brush/);assert.throws(()=>api.region(new Uint8Array(w*h).fill(255),w,h),/small object/);assert.throws(()=>api.dimensions(4097,50),/4096/);assert.throws(()=>api.dimensions(4,4));
const spread=new Uint8Array(1000*1000);spread[1]=255;spread[900]=255;assert.throws(()=>api.region(spread,1000,1000),/768/);
assert.throws(()=>api.inputs(new Uint8ClampedArray(w*h*4),mask,w,h),/visible/);assert.throws(()=>api.composite(source,mask,w,h,r,new Uint8Array(3)),/Invalid/);
console.log('Inpainting crop geometry, binary mask polarity, bounded work, exact unmarked pixels, alpha, soft edges, empty/large masks and source preservation passed.');
