import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SpatialGrid,setupBody,updateBody,contact,solveContacts} from './contacts.js';
import {terrainHeight,HALF} from './physics.js';
// Stylized Indo-Pacific reef representatives, not a taxonomic identification key.
export const SPECIES=[
 ['小丑鱼','clown','#ed7b28','#fff7db',.16,.23,.37,'resident',.42,'短圆体形、三道白带；在固定礁区附近短距离巡游。'],
 ['蓝绿雀鲷','chromis','#45c8bb','#b6f3dc',.11,.20,.32,'school',.62,'蓝绿色小型群游鱼，受惊后重新集群。'],
 ['蝴蝶鱼','butterfly','#f6d253','#192e39',.085,.33,.36,'reef',.42,'侧扁的圆盘轮廓、眼带与细长吻部。'],
 ['皇帝神仙鱼','angel','#385baf','#f6de63',.10,.39,.44,'reef',.48,'高背轮廓、横向金纹与延长的背鳍。'],
 ['蓝倒吊','blueTang','#2965d6','#f5d63e',.095,.26,.43,'reef',.64,'蓝色椭圆身体、深色侧斑和黄色尾鳍。'],
 ['黄倒吊','yellowTang','#f5d53d','#f5c933',.08,.32,.35,'reef',.52,'近圆的侧扁身体、高背鳍与突出吻部。'],
 ['六线隆头鱼','wrasse','#b9589b','#f0b74d',.10,.14,.45,'reef',.82,'细长身体与横纹，在礁石间快速穿梭。'],
 ['拟花鮨','anthias','#ee8e74','#e9b266',.10,.18,.34,'school',.64,'橙粉色身躯、分叉尾，聚集在礁区上方。'],
 ['银汉鱼','silverside','#b6d7dd','#547b9c',.065,.09,.40,'school',.85,'细长银色体形、深色侧线，协调群游。'],
 ['虾虎鱼','goby','#e3c59a','#826749',.12,.13,.31,'bottom',.32,'低伏体态、两段背鳍；在沙底停留和短促游动。'],
 ['鳚鱼','blenny','#8aab78','#405a50',.10,.14,.40,'bottom',.27,'长身钝头、连续背鳍，靠近礁底活动。'],
 ['黑鳍礁鲨','blacktip','#829e9f','#243f49',.29,.27,1.25,'shark',.78,'黑色鳍尖、流线身体与不对称尾鳍；独自在外围巡游，小鱼会逐渐让路。不追逐普通鱼饲料。']
].map(([name,id,color,accent,w,h,l,behavior,speed,description],i)=>({name,id,color,accent,w,h,l,behavior,speed,description,index:i}));
export function fishGeometry(s,detail=12){
 if(s.behavior==='shark')return sharkGeometry();
 const parts=[],object=new T.Object3D();
 function part(g,color,x=0,y=0,z=0,sx=1,sy=1,sz=1){if(g.index)g=g.toNonIndexed();object.position.set(x,y,z);object.rotation.set(0,0,0);object.scale.set(sx,sy,sz);object.updateMatrix();g.applyMatrix4(object.matrix);g.deleteAttribute('uv');const c=new T.Color(color),a=[];for(let i=0;i<g.attributes.position.count;i++)a.push(c.r,c.g,c.b);g.setAttribute('color',new T.Float32BufferAttribute(a,3));parts.push(g);}
 function fin(points,color){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();part(g,color);}
 part(new T.SphereGeometry(1,detail,8),s.color,0,0,0,s.w,s.h,s.l);
 const nose=s.behavior==='bottom'?.10:s.id.includes('Tang')||s.id==='butterfly'?.085:.045;
 part(new T.SphereGeometry(1,8,6),s.color,0,-s.h*.13,s.l*.88,s.w*.46,s.h*.24,nose);
 for(const side of [-1,1]){
 part(new T.SphereGeometry(1,8,6),'#f8f3db',side*s.w*.8,s.h*.32,s.l*.55,.035,.038,.035);
 part(new T.SphereGeometry(1,6,5),'#182e35',side*(s.w*.8+.023),s.h*.32,s.l*.56,.015,.021,.021);
 
 }
 const tall=['angel','yellowTang'].includes(s.id)?1.7:1.25;
 fin([0,s.h*.5,s.l*.55,0,s.h*tall,-s.l*.25,0,s.h*.5,-s.l*.85],s.accent);
 if(s.id==='goby')fin([0,s.h*.6,.16,0,s.h*1.8,.03,0,s.h*.6,-.02],s.accent);
 if(['clown','butterfly'].includes(s.id))for(const z of(s.id==='clown'?[-.22,0,.20]:[.18])){
 const k=Math.sqrt(Math.max(.1,1-(z/s.l)**2));part(new T.SphereGeometry(1,12,8),s.accent,0,0,z,s.w*k*1.03,s.h*k*1.03,.035);
 }
 if(['wrasse','angel','silverside','goby','blenny','blueTang'].includes(s.id))for(const side of[-1,1]){
 const rows=s.id==='angel'?5:s.id==='wrasse'?3:1;
 for(let j=0;j<rows;j++)part(new T.SphereGeometry(1,12,6),s.accent,side*s.w*.94,(j-(rows-1)/2)*s.h*.32,0,.012,s.id==='blueTang'?.08:.014,s.l*.72);
 }
 const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());return g;
}
// Sculpted shark hull with light belly, pointed snout, gills and black-tipped fins.
function sharkGeometry(){
 const pieces=[];
 function add(g,color){if(g.index)g=g.toNonIndexed();g.deleteAttribute('uv');const c=new T.Color(color),colors=[];for(let i=0;i<g.attributes.position.count;i++)colors.push(c.r,c.g,c.b);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));pieces.push(g);}
 const hull=new T.SphereGeometry(1,28,16),p=hull.attributes.position;
 for(let i=0;i<p.count;i++){const z=p.getZ(i),taper=z<0?.52+.48*(z+1):1;p.setXYZ(i,p.getX(i)*.29*taper,p.getY(i)*.27*taper,z*1.25);}
 hull.computeVertexNormals();add(hull,'#829e9f');
 const belly=new T.SphereGeometry(1,24,12);belly.scale(.255,.12,.99);belly.translate(0,-.155,.13);add(belly,'#dde5d7');
 function fin(points,color){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();add(g,color);}
 fin([0,.16,.32,0,.85,-.08,0,.18,-.55],'#829e9f');
 fin([0,.85,-.08,0,.64,.04,0,.60,-.23],'#243f49');
 fin([0,.12,-.64,0,.35,-.80,0,.08,-1.04],'#6d898d');
 for(const side of[-1,1]){
  const eye=new T.SphereGeometry(.035,8,6);eye.translate(side*.16,.065,.96);add(eye,'#112c34');
  for(let k=0;k<5;k++){const g=new T.BoxGeometry(.012,.17,.018);g.rotateX(-.18);g.translate(side*.279,-.015,.48-k*.065);add(g,'#405c60');}
  fin([side*.13,-.13,-.55,side*.39,-.25,-.88,side*.10,-.12,-.95],'#6d898d');
 }
 const merged=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());return merged;
}
const UP=new T.Vector3(0,1,0),FORWARD=new T.Vector3(0,0,1);
export class ReefSimulation {
 constructor(obstacles=[],seed=42){
  this.seed=seed;this.obstacles=obstacles;this.time=0;this.lastFeed=-10;this.food=[];this.events=[];this.eaten=0;this.perSpecies=4;this.fish=[];this.grid=new SpatialGrid();this.behaviorHz=25;this.behaviorClock=1;this.corrections=0;this.deferred=0;
  for(const s of SPECIES)for(let k=0;k<(s.behavior==='shark'?1:8);k++){
   const a=s.index*2.399+k*.48,r=s.behavior==='shark'?5.25:4.7;
   const f={id:s.index*8+k,s,k,scale:s.behavior==='shark'?1:.8+(k%3)*.08,p:new T.Vector3(Math.cos(a)*r,-1.5,Math.sin(a)*r),v:new T.Vector3(),home:new T.Vector3(),target:new T.Vector3(),q:new T.Quaternion(),phase:this.rand()*6.28,next:0,fear:0,sharkFear:0,sharkSeen:0,cooldown:0,force:new T.Vector3(),active:false};
   setupBody(f);this.constrain(f);f.home.copy(f.p);f.target.copy(f.p);this.fish.push(f);
  }
  this.setDensity(4);
 }
 get count(){return this.fish.filter(f=>f.active).length;}
 rand(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 place(f){
  const neighbours=this.fish.filter(o=>o.active&&o!==f);neighbours.forEach(updateBody);
  for(let n=0;n<180;n++){
   if(n){const a=this.rand()*Math.PI*2,r=4.3+this.rand()*1.4;f.p.set(Math.cos(a)*r,-.9-this.rand()*1.7,Math.sin(a)*r);}
   f.q.setFromAxisAngle(UP,this.rand()*Math.PI*2);f.safeP=null;this.constrain(f);updateBody(f);
   if(this.valid(f)&&neighbours.every(o=>!contact(f,o))){f.home.copy(f.p);f.target.copy(f.p);f.v.set(0,0,0);f.active=true;f.safeP=f.p.clone();f.safeQ=f.q.clone();return true;}
  }
  f.active=false;return false;
 }
 setDensity(n){
  this.perSpecies=Math.max(1,Math.min(8,Math.round(n)));this.deferred=0;
  // Place the only shark first; lowering density never removes it.
  for(const f of this.fish)if(f.s.behavior!=='shark'&&f.k>=this.perSpecies)f.active=false;
  for(const f of [...this.fish].sort((a,b)=>(b.s.behavior==='shark')-(a.s.behavior==='shark'))){if((f.s.behavior==='shark'||f.k<this.perSpecies)&&!f.active&&!this.place(f))this.deferred++;}
 }
 disturb(x,z,power=1){if(this.events.length>=24)this.events.shift();this.events.push({x,z,power,time:this.time});}
 feed(x,z){
  if(this.time-this.lastFeed<2-1e-8||this.food.length>=18||terrainHeight(x,z)>-.7||Math.abs(x)>HALF-.6||Math.abs(z)>HALF-.6)return false;
  this.lastFeed=this.time;
  for(let i=0;i<6&&this.food.length<18;i++){
   const a=i*Math.PI/3+this.rand()*.3,r=.25+this.rand()*.45,px=T.MathUtils.clamp(x+Math.cos(a)*r,-HALF+.5,HALF-.5),pz=T.MathUtils.clamp(z+Math.sin(a)*r,-HALF+.5,HALF-.5);
   if(terrainHeight(px,pz)<-.7)this.food.push({p:new T.Vector3(px,-.3,pz),life:12,owner:null});
  }return true;
 }
 constrain(f){
  // Project every segment out of terrain, columns, water boundaries. This also
  // runs after pair correction, so a neighbouring fish cannot push it into rock.
  for(let pass=0;pass<16;pass++){
   updateBody(f);let moved=false;
   for(const b of f.body){
    const r=b.r,p=new T.Vector3(0,0,b.z).applyQuaternion(f.q).add(f.p),bound=HALF-.035-r,dx=T.MathUtils.clamp(p.x,-bound,bound)-p.x,dz=T.MathUtils.clamp(p.z,-bound,bound)-p.z;
    if(dx||dz){f.p.x+=dx;f.p.z+=dz;p.x+=dx;p.z+=dz;moved=true;}
    const floor=terrainHeight(p.x,p.z)+r+.045,ceiling=-.13-r;
    if(floor>ceiling){const e=.08,gx=terrainHeight(p.x+e,p.z)-terrainHeight(p.x-e,p.z),gz=terrainHeight(p.x,p.z+e)-terrainHeight(p.x,p.z-e),len=Math.hypot(gx,gz)||1;f.p.x-=gx/len*.18;f.p.z-=gz/len*.18;moved=true;}
    else if(p.y<floor){f.p.y+=floor-p.y;moved=true;}else if(p.y>ceiling){f.p.y+=ceiling-p.y;moved=true;}
    for(const o of this.obstacles){const x=p.x-o.x,z=p.z-o.z,d=Math.hypot(x,z),rr=o.r+r+.025;if(d<rr&&p.y-r<o.top){f.p.x+=(d>1e-8?x/d:1)*(rr-d);f.p.z+=(d>1e-8?z/d:0)*(rr-d);moved=true;}}
   }
   if(!moved)break;
  }
  updateBody(f);
  if(!this.valid(f)&&f.safeP){f.p.copy(f.safeP);f.q.copy(f.safeQ);f.v.multiplyScalar(.3);f.next=0;updateBody(f);}
 }
 valid(f){return f.spheres.every(b=>Math.abs(b.p.x)+b.r<=HALF-.005&&Math.abs(b.p.z)+b.r<=HALF-.005&&b.p.y+b.r<=-.10&&b.p.y-b.r>=terrainHeight(b.p.x,b.p.z)+.005&&this.obstacles.every(o=>b.p.y-b.r>=o.top||Math.hypot(b.p.x-o.x,b.p.z-o.z)>=o.r+b.r));}
 steer(active,dt,day){
  this.grid.rebuild(active);const shark=active.find(f=>f.s.behavior==='shark'),d=new T.Vector3();
  for(const food of this.food)food.owner=null;
  for(const f of active){
   const s=f.s,isShark=s.behavior==='shark',force=f.force;force.set(0,0,0);f.fear=Math.max(0,f.fear-dt*.55);f.cooldown=Math.max(0,f.cooldown-dt);
   if(this.time>f.next||f.p.distanceTo(f.target)<.5){
    f.next=this.time+1.5+this.rand()*2.5;
    if(isShark){const a=Math.atan2(f.p.z,f.p.x)+.55+this.rand()*.3;f.target.set(Math.cos(a)*5.25,-1.5-this.rand()*.4,Math.sin(a)*5.25);}
    else {const range=s.behavior==='resident'?.9:s.behavior==='bottom'?1.2:2.5;f.target.copy(f.home).add(new T.Vector3((this.rand()-.5)*range,0,(this.rand()-.5)*range));f.target.y=s.behavior==='bottom'?terrainHeight(f.target.x,f.target.z)+.4:-.85-this.rand()*1.7;}
   }
   force.copy(f.target).sub(f.p).multiplyScalar(isShark?.65:.7);
   const nearby=this.grid.query(f.p,2.5);
   for(const other of nearby){
    if(other===f)continue;d.copy(f.p).sub(other.p);const dist=d.length(),gap=f.reach+other.reach;
    if(dist<gap+.35){force.addScaledVector(d,Math.min(4,1.1/(dist*dist+.04)));}
    // Anticipate approaching traffic; deterministic opposite lateral lanes.
    const future=d.clone().addScaledVector(f.v,.55).addScaledVector(other.v,-.55);
    if(future.length()<gap&&d.dot(f.v.clone().sub(other.v))<0){const side=new T.Vector3(-d.z,0,d.x).normalize();force.addScaledVector(side,.8);}
    if(s.behavior==='school'&&other.s===s&&dist<2){force.addScaledVector(other.v,.22);force.addScaledVector(d,-.10);}
   }
   if(!shark&&!isShark){f.sharkSeen=0;f.sharkFear=Math.max(0,f.sharkFear-dt*.65);}
   if(shark&&!isShark){
    d.copy(f.p).sub(shark.p);const r=d.length(),range=s.behavior==='resident'?2.0:s.behavior==='bottom'?1.7:2.6;
    if(r<range){f.sharkSeen+=dt;if(f.sharkSeen>.12+(f.id%5)*.045){f.sharkFear=Math.min(1,f.sharkFear+dt*(1-r/range)*2);force.addScaledVector(d,2.4*f.sharkFear/(r+.2));}}
    else {f.sharkSeen=0;f.sharkFear=Math.max(0,f.sharkFear-dt*.65);}
   }
   for(const e of this.events){d.set(f.p.x-e.x,0,f.p.z-e.z);const r=d.length(),age=this.time-e.time;if(r<3&&age>r*.1&&age<r*.1+.55){f.fear=Math.min(2,f.fear+dt*e.power*(3-r));force.addScaledVector(d,3*e.power*(1-r/3)/(r+.2));}}
   let nearest=null,dist=3;
   if(!isShark&&f.cooldown<=0&&f.fear<.5&&f.sharkFear<.4)for(const food of this.food){const r=f.p.distanceTo(food.p);if(food.life>0&&food.owner===null&&r<dist){nearest=food;dist=r;}}
   f.meal=nearest;
   if(nearest){nearest.owner=f.id;force.addScaledVector(d.copy(nearest.p).sub(f.p),1.5);f.speedLimit=Math.max(.12,Math.min(s.speed,dist*.9));}
   else f.speedLimit=s.speed;
   if(f.cooldown>0&&f.lastMeal)force.addScaledVector(d.copy(f.p).sub(f.lastMeal).normalize(),1.2);
   for(const o of this.obstacles){d.set(f.p.x-o.x,0,f.p.z-o.z);const r=d.length();if(r<o.r+f.reach+.65&&f.p.y<o.top+.55)force.addScaledVector(d,2.5/(r*r+.1));}
   const ahead=f.p.clone().addScaledVector(f.v,1);if(terrainHeight(ahead.x,ahead.z)>f.p.y-.45){const e=.15;force.x-=(terrainHeight(ahead.x+e,ahead.z)-terrainHeight(ahead.x-e,ahead.z))*3;force.z-=(terrainHeight(ahead.x,ahead.z+e)-terrainHeight(ahead.x,ahead.z-e))*3;}
   for(const axis of['x','z'])if(Math.abs(ahead[axis])>HALF-f.reach-.3)force[axis]-=Math.sign(ahead[axis])*2;
   f.rest=s.behavior==='bottom'&&Math.sin(this.time*.7+f.phase)>.25&&f.fear<.2&&f.sharkFear<.1&&!nearest;
   f.activity=isShark?.75+.25*day:.25+.75*day;force.clampLength(0,6);
  }
 }
 step(dt,day=1){
  if(!Number.isFinite(dt)||dt<=0)return;let remaining=Math.min(dt,.1);
  while(remaining>1e-8){const h=Math.min(remaining,1/60);remaining-=h;this.integrate(h,day);}
 }
 integrate(dt,day){
  this.time+=dt;this.events=this.events.filter(e=>this.time-e.time<3);this.food=this.food.filter(p=>p.life>0);
  for(const food of this.food){food.life-=dt;food.p.y=Math.max(terrainHeight(food.p.x,food.p.z)+.12,food.p.y-dt*.17);}
  const active=this.fish.filter(f=>f.active);this.behaviorClock+=dt;
  if(this.behaviorClock>=1/this.behaviorHz){this.steer(active,Math.min(this.behaviorClock,.1),day);this.behaviorClock=0;}
  for(const f of active){
   f.v.addScaledVector(f.force,dt).multiplyScalar(Math.exp(-dt*1.3));f.v.clampLength(0,(f.speedLimit||f.s.speed)*(f.activity||1)*(1+f.fear+f.sharkFear*.65));if(f.rest)f.v.multiplyScalar(Math.exp(-dt*8));
   if(f.v.lengthSq()>.001){const direction=f.v.clone().normalize();direction.y=T.MathUtils.clamp(direction.y,-.4,.4);direction.normalize();const q=new T.Quaternion().setFromUnitVectors(FORWARD,direction),facing=FORWARD.clone().applyQuaternion(f.q);const bank=T.MathUtils.clamp(facing.x*direction.z-facing.z*direction.x,-.3,.3);q.multiply(new T.Quaternion().setFromAxisAngle(FORWARD,bank));f.q.slerp(q,1-Math.exp(-dt*(f.s.behavior==='shark'?2.2:5)));}
   f.p.addScaledVector(f.v,dt);this.constrain(f);
   if(f.meal&&f.meal.life>0&&f.p.distanceTo(f.meal.p)<.22){f.meal.life=0;f.lastMeal=f.meal.p.clone();f.cooldown=2+this.rand();f.meal=null;this.eaten++;}
  }
  this.corrections+=solveContacts(active,this.grid,f=>this.constrain(f));
  for(const f of active)if(this.valid(f)){f.safeP=f.p.clone();f.safeQ=f.q.clone();}
 }
 diagnostics(){
  const fish=this.fish.filter(f=>f.active);fish.forEach(updateBody);let maxPenetration=0,pairs=0;
  for(let i=0;i<fish.length;i++)for(let j=i+1;j<fish.length;j++){const c=contact(fish[i],fish[j]);if(c&&c.depth>.003){pairs++;maxPenetration=Math.max(maxPenetration,c.depth);}}
  return{count:fish.length,pairs,maxPenetration,corrections:this.corrections,deferred:this.deferred};
 }
}
export function fishPartGeometries(s){
 const shark=s.behavior==='shark';
 const geometry=points=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();return g;};
 const tail=shark?geometry([0,0,-1.04,0,.78,-1.83,0,.10,-1.53,0,0,-1.04,0,.10,-1.53,0,-.43,-1.65]):geometry([0,0,-s.l*.8,0,s.h*.8,-s.l*1.5,0,0,-s.l*1.25,0,0,-s.l*.8,0,0,-s.l*1.25,0,-s.h*.8,-s.l*1.5]);
 const fin=geometry(shark?[0,0,0,.74,-.12,-.52,.10,-.04,-.43]:[0,0,0,s.w*1.4,-s.h*.5,-.16,0,-s.h*.3,-.18]);
 return{body:fishGeometry(s),tail,fin};
}
// Vertex-space bend is shared by the scene and atlas; no second model substitute.
export function bendShark(g,time){
 if(!g.userData.rest)g.userData.rest=g.attributes.position.array.slice();
 const p=g.attributes.position,rest=g.userData.rest;
 for(let i=0;i<p.count;i++){const z=rest[i*3+2],amount=Math.max(0,-z+.1);p.setX(i,rest[i*3]+Math.sin(time*3.7+z*1.5)*amount*amount*.11);}
 p.needsUpdate=true;g.computeVertexNormals();
}
export function createEcology(scene,shared,obstacles){
 const sim=new ReefSimulation(obstacles),parts=[],obj=new T.Object3D(),material=new T.MeshStandardMaterial({vertexColors:true,roughness:.42,side:T.DoubleSide});
 for(const s of SPECIES){
  const geos=fishPartGeometries(s),capacity=s.behavior==='shark'?1:8;
  const body=new T.InstancedMesh(geos.body,material,capacity),finMaterial=new T.MeshStandardMaterial({color:s.accent,roughness:.5,side:T.DoubleSide});
  const tail=new T.InstancedMesh(geos.tail,finMaterial,capacity),left=new T.InstancedMesh(geos.fin,finMaterial,capacity),right=new T.InstancedMesh(geos.fin,finMaterial,capacity);
  body.userData.species=s.index;for(const mesh of[body,tail,left,right]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);}parts.push({body,tail,left,right});
 }
 const pellets=new T.InstancedMesh(new T.SphereGeometry(.035,6,4),new T.MeshStandardMaterial({color:'#d6a36b'}),18);pellets.frustumCulled=false;scene.add(pellets);let acc=0;
 function update(t,dt){
  acc+=Math.min(dt,.1);let steps=0;while(acc>=1/60&&steps++<6){sim.step(1/60,shared.day.value);acc-=1/60;}if(steps>=6)acc=0;
  for(const s of SPECIES){
   const {body,tail,left,right}=parts[s.index],shark=s.behavior==='shark',count=shark?1:sim.perSpecies;
   if(shark){bendShark(body.geometry,t);bendShark(tail.geometry,t);}
   for(const m of[body,tail,left,right])m.count=count;
   for(let k=0;k<count;k++){
    const f=sim.fish[s.index*8+k],speed=f.v.length(),yaw=Math.sin(t*(5+s.speed*7)+f.phase)*(.16+speed*.3);
    function base(){obj.position.copy(f.p);obj.quaternion.copy(f.q);obj.scale.setScalar(f.active?f.scale:0);}
    base();obj.updateMatrix();body.setMatrixAt(k,obj.matrix);
    base();if(!shark){obj.translateZ(-s.l*.8);obj.rotateY(yaw);obj.translateZ(s.l*.8);}obj.updateMatrix();tail.setMatrixAt(k,obj.matrix);
    for(const [side,mesh]of[[-1,left],[1,right]]){base();obj.translateX(side*s.w*.8);obj.translateY(-s.h*.15);obj.translateZ(shark?.3:.03);obj.rotateZ(side*Math.sin(t*(shark?2:5)+f.phase)*.22);obj.scale.x*=side;obj.updateMatrix();mesh.setMatrixAt(k,obj.matrix);}
   }
   for(const m of[body,tail,left,right])m.instanceMatrix.needsUpdate=true;
  }
  pellets.count=sim.food.length;sim.food.forEach((p,i)=>{obj.position.copy(p.p);obj.quaternion.identity();obj.scale.setScalar(1);obj.updateMatrix();pellets.setMatrixAt(i,obj.matrix);});pellets.instanceMatrix.needsUpdate=true;
 }
 return{sim,parts,update,setQuality(level){sim.behaviorHz=level==='eco'?15:level==='high'?40:25;},pick(ray){const hit=ray.intersectObjects(parts.map(p=>p.body),false).find(h=>sim.fish[h.object.userData.species*8+h.instanceId]?.active);return hit?sim.fish[hit.object.userData.species*8+hit.instanceId]:null;},reset(){acc=0;sim.time=0;sim.behaviorClock=1;sim.food=[];sim.events=[];sim.eaten=0;sim.lastFeed=-10;for(const f of sim.fish){f.active=false;f.p.copy(f.home);f.v.set(0,0,0);f.force.set(0,0,0);f.fear=f.sharkFear=f.sharkSeen=f.cooldown=0;f.next=0;f.meal=null;}sim.setDensity(sim.perSpecies);}};
}
