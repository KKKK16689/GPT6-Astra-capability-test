import assert from 'node:assert/strict';
import {SPECIES,fishGeometry,ReefSimulation} from '../src/ecology.js';
import {terrainHeight,HALF} from '../src/physics.js';
assert.equal(SPECIES.length,12);assert.equal(new Set(SPECIES.map(s=>s.id)).size,12);
const shapes=SPECIES.map(s=>{const g=fishGeometry(s);assert(g.attributes.position.array.every(Number.isFinite));g.computeBoundingBox();const signature=g.boundingBox.getSize({set(x,y,z){return [x,y,z].join(',');},subVectors(a,b){return this.set(a.x-b.x,a.y-b.y,a.z-b.z);}});g.dispose();return signature;});assert.equal(new Set(shapes).size,12);
const sim=new ReefSimulation([{x:4,z:1,r:.5,top:-1}]);sim.setDensity(8);assert.equal(sim.fish.filter(f=>f.active).length,89);
assert(sim.feed(4,4));assert(!sim.feed(4,4));assert(!sim.feed(0,0));
const f=sim.fish[0];sim.disturb(f.p.x,f.p.z,2);let fear=0;for(let i=0;i<120;i++){sim.step(1/60);fear=Math.max(fear,f.fear);}assert(fear>0);assert(sim.feed(4,4));
for(let i=0;i<7200;i++){if(i%300===0)sim.disturb(4,4,2);sim.step(1/60,i%3600<1800?1:0);for(const f of sim.fish){assert(f.p.toArray().every(Number.isFinite));assert(Math.abs(f.p.x)<HALF&&Math.abs(f.p.z)<HALF);assert(f.p.y>=terrainHeight(f.p.x,f.p.z)+.08);assert(f.p.y<=-.20);}assert(sim.food.length<=18);assert(sim.events.length<=24);}
assert.equal(sim.food.length,0);sim.setDensity(2);assert.equal(sim.fish.filter(f=>f.active).length,23);
const feedSim=new ReefSimulation();const feeder=feedSim.fish[0];feedSim.feed(feeder.p.x,feeder.p.z);feedSim.food[0].p.copy(feeder.p);feedSim.step(1/30);assert(feedSim.eaten>0);
console.log('PASS: 12 distinct geometries, density caps, feeding throttle/consumption, disturbance response, 120-second ecological stability, terrain and volume bounds.');

