import assert from 'node:assert/strict';
import {OceanPhysics} from '../src/physics.js';
const step=(s,p,seconds)=>{for(let i=0;i<seconds*120;i++)s.step(1/120,p);};
const calm={wind:0,strength:1,elasticity:.58};
const ocean=new OceanPhysics(73);
ocean.impulse(3,3,-4,.48);step(ocean,calm,.8);
const initial=ocean.energy();assert(initial>1e-6,'impulse must inject stateful energy');
assert(Math.abs(ocean.sample(4.4,3))>.0005,'wave must propagate beyond the contact area');
let mean=0;for(const k of ocean.active)mean+=ocean.h[k];assert(Math.abs(mean/ocean.active.length)<1e-6,'water mean must be conserved');
step(ocean,calm,20);assert(ocean.energy()<initial*.002,'unforced waves must dissipate');
assert(ocean.h.every(Number.isFinite),'no invalid values');
for(const elasticity of[0,.58,1]){
  const s=new OceanPhysics(89);s.impulse(5.9,5.9,15,.30);s.drag={x:3.4,z:2.8,height:.86};
  const params={wind:1.5,strength:2.4,elasticity};step(s,params,4);assert(s.sample(3.4,2.8)>.1,'drag must deform the actual surface');
  s.drag=null;step(s,params,8);assert(s.h.every(Number.isFinite),'stress case must remain finite');assert(Math.max(...s.h)<1.05&&Math.min(...s.h)>-1.05,'displacements must remain bounded');
  s.reset();assert.equal(s.energy(),0,'reset must clear height and velocity');
}
const a=new OceanPhysics(73,12),b=new OceanPhysics(73,12);step(a,{wind:.9,strength:1,elasticity:.4},2);step(b,{wind:.9,strength:1,elasticity:.4},2);assert.deepEqual(a.h,b.h,'fixed timestep must be reproducible');
console.log('PASS: propagation, damping, volume conservation, continuous drag, release, extreme parameters, reset, deterministic fixed steps.');
