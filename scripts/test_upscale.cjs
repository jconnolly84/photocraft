const assert=require('node:assert/strict'),api=require('../host/upscale-core.js');
(async()=>{
 const w=257,h=125,data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set([x%251,y%249,(x+y)%253,x%256],(y*w+x)*4);
 let calls=0,last=0;const run=async input=>{calls++;const out=new Float32Array(3*256*256);for(let c=0;c<3;c++)for(let y=0;y<256;y++)for(let x=0;x<256;x++)out[c*256*256+y*256+x]=input[c*128*128+Math.floor(y/2)*128+Math.floor(x/2)];return out;};
 const full=await api.tiled(data,w,h,run,(done,total)=>{assert.equal(done,last+1);last=done;assert.equal(total,6);});
 assert.equal(calls,6);assert.equal(full.width,w*2);assert.equal(full.height,h*2);
 for(let y=0;y<h*2;y++)for(let x=0;x<w*2;x++){const at=(y*w*2+x)*4,src=(Math.floor(y/2)*w+Math.floor(x/2))*4;assert.deepEqual([...full.pixels.slice(at,at+3)],[...data.slice(src,src+3)],'All pixels, including tile boundaries and partial tiles, must align');}
 assert.equal(full.pixels[3],data[3]);assert.equal(full.pixels[(w*2-1)*4+3],data[(w-1)*4+3]);
 const region={left:71,top:22,width:160,height:91},part=await api.tiled(data,w,h,run,()=>{},region);
 for(let y=0;y<part.height;y++){const a=part.pixels.slice(y*part.width*4,(y+1)*part.width*4),from=((y+region.top*2)*full.width+region.left*2)*4;assert.deepEqual(a,full.pixels.slice(from,from+a.length),'Centre preview must match the same region of the whole result');}
 const original=data.slice();await api.tiled(data,w,h,run,()=>{},{left:0,top:0,width:1,height:1});assert.deepEqual(data,original);
 assert.throws(()=>api.validate(1025,1024),/1 megapixel/);assert.throws(()=>api.validate(0,1));assert.throws(()=>api.validate(5000,2),/4096/);assert.deepEqual(api.previewRegion(200,100),{left:20,top:0,width:160,height:100});
 await assert.rejects(api.tiled(data,w,h,async()=>new Float32Array(4)),/output/);
 await assert.rejects(api.tiled(data,w,h,run,()=>{},{left:-1,top:0,width:1,height:1}),/region/);
 console.log('2x tile placement, halo crop, partial tiles, preview/full agreement, transparency, source preservation and limits passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
