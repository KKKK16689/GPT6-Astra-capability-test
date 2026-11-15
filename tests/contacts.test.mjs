import assert from 'node:assert/strict';
import * as T from 'three';
import {ReefSimulation,createEcology,SPECIES} from '../src/ecology.js';
import {updateBody,contact} from '../src/contacts.js';
import {terrainHeight,HALF} from '../src/physics.js';
const sim=new ReefSimulation([{x:4.5,z:1,r:.45,top:-.6},{x:-4.5,z:-1,r:.4,top:-.8}]);
sim.setDensity(8);assert.equal(sim.count,89);assert.equal(sim.fish.filter(f=>f.active&&f.s.behavior==='shark').length,1);assert.equal(sim.diagnostics().pairs,0,'safe spawning');
let stalled=0,maxStalled=0,worst=0,persistent=0,maxPersistent=0,boundaryErrors=0,sharkTravel=0,fearPeak=0;
const shark=sim.fish.at(-1),last=shark.p.clone();
for(let i=0;i<10800;i++){
 if(i%120===0)sim.feed(4.4,3.8);
 if(i%600===0)sim.disturb(4,4,1);
 if(i===3000)sim.setDensity(2);if(i===3600)sim.setDensity(8);
 sim.behaviorHz=i%1800<900?15:40;sim.step(1/60,i%3600<1800?1:.1);
 const travelled=last.distanceTo(shark.p);stalled=travelled<.0001?stalled+1:0;maxStalled=Math.max(maxStalled,stalled);sharkTravel+=travelled;last.copy(shark.p);
 if(i%10===0){const report=sim.diagnostics();worst=Math.max(worst,report.maxPenetration);persistent=report.maxPenetration>.03?persistent+10:0;maxPersistent=Math.max(maxPersistent,persistent);}
 for(const f of sim.fish.filter(f=>f.active)){
  fearPeak=Math.max(fearPeak,f.sharkFear);assert(f.p.toArray().every(Number.isFinite));
  for(const b of f.spheres)if(Math.abs(b.p.x)+b.r>HALF+.03||Math.abs(b.p.z)+b.r>HALF+.03||b.p.y-b.r<terrainHeight(b.p.x,b.p.z)-.03)boundaryErrors++;
 }
 assert(sim.food.length<=18);assert(!shark.meal,'shark never eats ordinary pellets');
}
console.log(JSON.stringify({scenario:'180s dense feeding, density and quality changes',worst,maxPersistentSeconds:maxPersistent/60,boundaryErrors,sharkTravel,maxStalledSeconds:maxStalled/60,fearPeak,eaten:sim.eaten}));
assert(worst<.08);assert(maxPersistent<60);assert.equal(boundaryErrors,0);assert(sharkTravel>10);assert(maxStalled<600);assert(fearPeak>.1);
// Force two fish to exactly coincide, including at an obstacle, then recover.
const pair=new ReefSimulation();pair.fish.forEach(f=>f.active=false);const a=pair.fish[0],b=pair.fish[1];a.active=b.active=true;a.p.set(4,-1,4);b.p.copy(a.p);a.q.identity();b.q.identity();a.v.set(.4,0,0);b.v.set(-.4,0,0);
for(let i=0;i<60;i++)pair.step(1/60);updateBody(a);updateBody(b);assert((contact(a,b)?.depth||0)<.005);
// Fear decays when the shark is away; fish keep their own home targets.
const fearful=sim.fish.find(f=>f.sharkFear>.05&&f.s.behavior!=='shark');assert(fearful);shark.active=false;
// A removed shark is not a user option: this is an isolated recovery fixture.
for(let i=0;i<600;i++)sim.step(1/60);
assert(fearful.sharkFear<.01);
// Renderer reset and quality changes keep one shark and shared actual geometries.
const e=createEcology(new T.Scene(),{day:{value:1}},[]);e.setQuality('eco');e.update(1,1/30);assert.equal(e.parts.length,12);assert.equal(e.parts.at(-1).body.count,1);e.reset();assert.equal(e.sim.count,45);assert.equal(e.sim.diagnostics().pairs,0);
console.log('PASS: spawn clearance, body contacts, dense feeding, segmented shark, boundaries, fixed collision rate, reset');
// Regression: food attraction must add to separation, not overwrite it.
const feeding=new ReefSimulation();feeding.fish.forEach(f=>f.active=false);
const fa=feeding.fish[0],fb=feeding.fish[1];fa.active=fb.active=true;
fa.p.set(4,-1,4);fb.p.set(4.3,-1,4);fa.v.set(0,0,0);fb.v.set(0,0,0);
fa.target.copy(fa.p);fb.target.copy(fb.p);fa.next=fb.next=100;
feeding.food=[{p:new T.Vector3(4,-1,5),life:12,owner:null}];feeding.steer([fa,fb],1/30,1);
assert(fa.force.x<0);assert.equal(feeding.food[0].owner,fa.id);assert.equal(fb.meal,null);
console.log('PASS: feeding retains separation and reserves each pellet for one fish');
