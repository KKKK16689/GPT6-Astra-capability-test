// Compile-source export and deterministic scene checks. No browser is emulated.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from 'three';
import {WebGLPrograms} from 'three/src/renderers/webgl/WebGLPrograms.js';
import {WebGLProgram} from 'three/src/renderers/webgl/WebGLProgram.js';
import {OceanPhysics} from '../src/physics.js';
import {createWater} from '../src/water.js';
import {createWorld} from '../src/world.js';
globalThis.document={createElement(){return{width:128,height:128,getContext(){return{createRadialGradient(){return{addColorStop(){}};},fillRect(){}};}};}};
const scene=new T.Scene(),physics=new OceanPhysics(73),shared={time:{value:0},day:{value:1},wave:{value:null},caustic:{value:null}};
const water=createWater(scene,physics,shared),world=createWorld(scene,shared);world.setTime(14.5);
const initialBoat=world.boat.position.y;physics.impulse(3.25,2.45,7,.6);let maxBoat=0;
for(let frame=0;frame<420;frame++){physics.step(1/120,{wind:.5,strength:1,elasticity:.8});world.update(frame/120,1/120,physics);if(frame%2===0)water.update(frame);maxBoat=Math.max(maxBoat,Math.abs(world.boat.position.y-initialBoat));}
assert(maxBoat>.035,'boat must respond to the simulated wave');
let vertices=0,meshes=0;scene.traverse(o=>{if(o.geometry){meshes++;for(const a of Object.values(o.geometry.attributes)){assert(a.array.every(Number.isFinite),'all geometry attributes must be finite');}vertices+=o.geometry.attributes.position.count;}if(o.instanceMatrix)assert(o.instanceMatrix.array.every(Number.isFinite),'instance transforms must be finite');});
assert(meshes>30&&vertices>50000);assert(water.group.children[1].geometry.attributes.normal.getZ(5)>.9,'front face normal must point outward');
const noon=world.setTime(12),night=world.setTime(0);assert(noon.day>.99&&night.day<.01);world.setTime(14.5);
const compiled=[];let activeSources=[];
const gl={VERTEX_SHADER:0x8b31,FRAGMENT_SHADER:0x8b30,createShader:type=>({type}),shaderSource:(shader,source)=>activeSources.push({type:shader.type,source}),compileShader(){},createProgram:()=>({}),attachShader(){},linkProgram(){},bindAttribLocation(){}};
let currentTarget=null;const renderer={getContext:()=>gl,getRenderTarget:()=>currentTarget,outputColorSpace:T.SRGBColorSpace,toneMapping:T.ACESFilmicToneMapping,shadowMap:{enabled:true,type:T.PCFSoftShadowMap},state:{buffers:{depth:{getReversed:()=>false}}}};
const clipping={numPlanes:0,numIntersection:0},binding={},maps={get:x=>x},ext={has:()=>false},caps={precision:'highp',vertexTextures:true,getMaxPrecision:x=>x};
const programs=WebGLPrograms(renderer,maps,maps,ext,caps,binding,clipping);
const lights={directional:[{},{}],point:[{}],hemi:[{}],spot:[],spotLightMap:[],rectArea:[],directionalShadowMap:[{}],pointShadowMap:[],spotShadowMap:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};
const seen=new Set();
for(const phase of['screen','offscreen','reflection']){
  currentTarget=phase==='screen'?null:water.rt;clipping.numPlanes=phase==='reflection'?1:0;
  scene.traverse(o=>{if(!o.material||!o.geometry)return;
    const m=o.material,params=programs.getParameters(m,lights,[{}],scene,o);params.uniforms={};m.onBeforeCompile(params,renderer);activeSources=[];new WebGLProgram(renderer,'test',params,binding);
    const key=crypto.createHash('sha256').update(activeSources.map(s=>s.source).join('\n')).digest('hex');if(!seen.has(key)){seen.add(key);compiled.push({name:m.type+'_'+phase+'_'+compiled.length,shaders:activeSources});}
  });
}
const out=process.argv[2];if(out)fs.writeFileSync(out,JSON.stringify(compiled));
console.log(`PASS: ${meshes} meshes, ${vertices} vertices, finite geometry and instance transforms, outward water walls, wave-driven boat, day/night lights; exported ${compiled.length} shader variants.`);
