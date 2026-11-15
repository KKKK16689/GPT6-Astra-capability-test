import * as T from 'three';
// Broad phase over body centres. Narrow phase uses an oriented chain of spheres,
// never one giant sphere for the shark. Fins are intentionally not rigid bodies.
export class SpatialGrid {
 constructor(size=1.4){this.size=size;this.cells=new Map();this.maxReach=0;}
 key(x,y,z){return `${x},${y},${z}`;}
 rebuild(fish){this.cells.clear();this.maxReach=0;for(const f of fish){const s=this.size,k=this.key(Math.floor(f.p.x/s),Math.floor(f.p.y/s),Math.floor(f.p.z/s));if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(f);this.maxReach=Math.max(this.maxReach,f.reach);}}
 query(p,r){const a=[],s=this.size;for(let x=Math.floor((p.x-r)/s);x<=Math.floor((p.x+r)/s);x++)for(let y=Math.floor((p.y-r)/s);y<=Math.floor((p.y+r)/s);y++)for(let z=Math.floor((p.z-r)/s);z<=Math.floor((p.z+r)/s);z++){const bucket=this.cells.get(this.key(x,y,z));if(bucket)a.push(...bucket);}return a;}
}
export function setupBody(f){
 const s=f.s,scale=f.scale;
 f.body=s.behavior==='shark'?[[-1.05,.15],[-.68,.22],[-.25,.29],[.2,.29],[.62,.23],[.92,.15]]:[[-s.l*.65,Math.max(s.w,s.h)*.63],[0,Math.max(s.w,s.h)],[s.l*.65,Math.max(s.w,s.h)*.63]];
 f.body=f.body.map(([z,r])=>({z:z*scale,r:(r+.035)*scale}));f.reach=Math.max(...f.body.map(b=>Math.abs(b.z)+b.r));f.spheres=f.body.map(()=>({p:new T.Vector3(),r:0}));updateBody(f);
}
export function updateBody(f){f.body.forEach((b,i)=>{f.spheres[i].p.set(0,0,b.z).applyQuaternion(f.q).add(f.p);f.spheres[i].r=b.r;});}
const delta=new T.Vector3();
export function contact(a,b){
 if(a.p.distanceToSquared(b.p)>(a.reach+b.reach)**2)return null;
 let depth=0,normal=null;
 for(const x of a.spheres)for(const y of b.spheres){delta.copy(x.p).sub(y.p);const dist=delta.length(),d=x.r+y.r-dist;if(d>depth){depth=d;normal=dist>1e-8?delta.clone().divideScalar(dist):new T.Vector3(a.id<b.id?-1:1,0,0);}}
 return normal?{depth,normal}:null;
}
export function solveContacts(fish,grid,constrain,iterations=10){
 let corrected=0;
 for(let pass=0;pass<iterations;pass++){
  fish.forEach(updateBody);grid.rebuild(fish);let worst=0;
  for(const a of fish)for(const b of grid.query(a.p,a.reach+grid.maxReach)){
   if(b.id<=a.id)continue;const c=contact(a,b);if(!c||c.depth<.001)continue;
   worst=Math.max(worst,c.depth);corrected++;
   const wa=a.s.behavior==='shark'?.15:1,wb=b.s.behavior==='shark'?.15:1;
   a.p.addScaledVector(c.normal,(c.depth+.001)*wa/(wa+wb));b.p.addScaledVector(c.normal,-(c.depth+.001)*wb/(wa+wb));
   const approaching=delta.copy(a.v).sub(b.v).dot(c.normal);
   if(approaching<0){a.v.addScaledVector(c.normal,-approaching*wa/(wa+wb));b.v.addScaledVector(c.normal,approaching*wb/(wa+wb));}
   constrain(a);constrain(b);updateBody(a);updateBody(b);
  }
  if(worst<.002)break;
 }
 return corrected;
}
