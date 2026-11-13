import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
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
 ['鳚鱼','blenny','#8aab78','#405a50',.10,.14,.40,'bottom',.27,'长身钝头、连续背鳍，靠近礁底活动。']
].map(([name,id,color,accent,w,h,l,behavior,speed,description],i)=>({name,id,color,accent,w,h,l,behavior,speed,description,index:i}));
export function fishGeometry(s,detail=12){
 const parts=[],object=new T.Object3D();
 function part(g,color,x=0,y=0,z=0,sx=1,sy=1,sz=1){if(g.index)g=g.toNonIndexed();object.position.set(x,y,z);object.rotation.set(0,0,0);object.scale.set(sx,sy,sz);object.updateMatrix();g.applyMatrix4(object.matrix);g.deleteAttribute('uv');const c=new T.Color(color),a=[];for(let i=0;i<g.attributes.position.count;i++)a.push(c.r,c.g,c.b);g.setAttribute('color',new T.Float32BufferAttribute(a,3));parts.push(g);}
 function fin(points,color){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();part(g,color);}
 part(new T.SphereGeometry(1,detail,8),s.color,0,0,0,s.w,s.h,s.l);
 const nose=s.behavior==='bottom'?.10:s.id.includes('Tang')||s.id==='butterfly'?.085:.045;
 part(new T.SphereGeometry(1,8,6),s.color,0,-s.h*.13,s.l*.88,s.w*.46,s.h*.24,nose);
 for(const side of [-1,1]){
 part(new T.SphereGeometry(1,8,6),'#f8f3db',side*s.w*.8,s.h*.32,s.l*.55,.035,.038,.035);
 part(new T.SphereGeometry(1,6,5),'#182e35',side*(s.w*.8+.023),s.h*.32,s.l*.56,.015,.021,.021);
 fin([side*s.w*.8,0,.03,side*s.w*2,-s.h*.5,-.12,side*s.w*.6,-s.h*.4,-.18],s.accent);
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
export class ReefSimulation {
 constructor(obstacles=[],seed=42){this.seed=seed;this.obstacles=obstacles;this.time=0;this.lastFeed=-10;this.food=[];this.events=[];this.eaten=0;this.perSpecies=4;this.fish=[];
 for(const s of SPECIES)for(let k=0;k<8;k++){const a=s.index*2.399+k*.18,r=4.3+(k%3)*.42,x=Math.cos(a)*r,z=Math.sin(a)*r;this.fish.push({id:s.index*8+k,s,k,p:new T.Vector3(x,-1.5,z),v:new T.Vector3(.1,0,.1),home:new T.Vector3(x,-1.5,z),target:new T.Vector3(x,-1.5,z),q:new T.Quaternion(),phase:this.rand()*6.28,next:0,fear:0,active:k<4});}
 this.fish.forEach(f=>this.constrain(f)); }
 rand(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 setDensity(n){this.perSpecies=Math.max(1,Math.min(8,Math.round(n)));this.fish.forEach(f=>f.active=f.k<this.perSpecies);}
 disturb(x,z,power=1){if(this.events.length>=24)this.events.shift();this.events.push({x,z,power,time:this.time});}
 feed(x,z){if(this.time-this.lastFeed<2-1e-8||this.food.length>=18||terrainHeight(x,z)>-.7||Math.abs(x)>HALF-.5||Math.abs(z)>HALF-.5)return false;this.lastFeed=this.time;for(let i=0;i<6;i++)this.food.push({p:new T.Vector3(x+(this.rand()-.5)*.25,-.3,z+(this.rand()-.5)*.25),life:12});return true;}
 constrain(f){const margin=.55,bound=HALF-margin;f.p.x=T.MathUtils.clamp(f.p.x,-bound,bound);f.p.z=T.MathUtils.clamp(f.p.z,-bound,bound);
 for(let i=0;i<20&&terrainHeight(f.p.x,f.p.z)>-1;i++){let r=Math.hypot(f.p.x,f.p.z)||1;f.p.x+=f.p.x/r*.15||.15;f.p.z+=f.p.z/r*.15;}
 for(const o of this.obstacles){const dx=f.p.x-o.x,dz=f.p.z-o.z,d=Math.hypot(dx,dz),radius=o.r+.32;if(d<radius&&f.p.y<o.top+.32){f.p.x=o.x+(dx/(d||1)||1)*radius;f.p.z=o.z+dz/(d||1)*radius;}}
 f.p.x=T.MathUtils.clamp(f.p.x,-bound,bound);f.p.z=T.MathUtils.clamp(f.p.z,-bound,bound);f.p.y=T.MathUtils.clamp(f.p.y,terrainHeight(f.p.x,f.p.z)+.30,-.42); }
 step(dt,day=1){this.time+=dt;this.events=this.events.filter(e=>this.time-e.time<3);this.food=this.food.filter(p=>p.life>0);for(const food of this.food){food.life-=dt;food.p.y=Math.max(terrainHeight(food.p.x,food.p.z)+.12,food.p.y-dt*.17);}
 const active=this.fish.filter(f=>f.active),force=new T.Vector3(),d=new T.Vector3();
 for(const f of active){const s=f.s;f.fear=Math.max(0,f.fear-dt*.55);force.set(0,0,0);
 if(this.time>f.next){f.next=this.time+1.2+this.rand()*3;const range=s.behavior==='resident'?.65:s.behavior==='bottom'?.85:1.65;f.target.copy(f.home).add(new T.Vector3((this.rand()-.5)*range,0,(this.rand()-.5)*range));f.target.y=s.behavior==='bottom'?terrainHeight(f.target.x,f.target.z)+.32:-.85-this.rand()*1.4;}
 force.copy(f.target).sub(f.p).multiplyScalar(.7);
 for(const other of active){if(other===f)continue;d.copy(f.p).sub(other.p);const dist=d.length();if(dist<.65&&dist>.001)force.addScaledVector(d,.35/(dist*dist));if(s.behavior==='school'&&other.s===s&&dist<2){force.addScaledVector(other.v,.24);force.addScaledVector(d,-.12);}}
 for(const e of this.events){d.set(f.p.x-e.x,0,f.p.z-e.z);const r=d.length(),age=this.time-e.time;if(r<3&&age>r*.10&&age<r*.10+.55){f.fear=Math.min(2,f.fear+dt*e.power*(3-r));force.addScaledVector(d,3*e.power*(1-r/3)/(r+.2));}}
 let nearest=null,dist=3;for(const food of this.food){const r=f.p.distanceTo(food.p);if(food.life>0&&r<dist){nearest=food;dist=r;}}
 if(nearest&&f.fear<.5){force.copy(nearest.p).sub(f.p).multiplyScalar(1.5);if(dist<.20){nearest.life=0;this.eaten++;}}
 for(const o of this.obstacles){d.set(f.p.x-o.x,0,f.p.z-o.z);const r=d.length();if(r<o.r+1&&f.p.y<o.top+.55)force.addScaledVector(d,3/(r*r+.1));}
 const ahead=f.p.clone().addScaledVector(f.v,.7);if(terrainHeight(ahead.x,ahead.z)>f.p.y-.35){force.x+=f.p.x;force.z+=f.p.z;}
 const activity=.25+.75*day,rest=s.behavior==='bottom'&&Math.sin(this.time*.7+f.phase)>.25&&f.fear<.2&&!nearest;
 f.v.addScaledVector(force,dt).multiplyScalar(Math.exp(-dt*1.3));f.v.clampLength(0,s.speed*activity*(1+f.fear));if(rest)f.v.multiplyScalar(Math.exp(-dt*8));f.p.addScaledVector(f.v,dt);this.constrain(f);
 if(f.v.lengthSq()>.001){const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),f.v.clone().normalize());f.q.slerp(q,1-Math.exp(-dt*5));}
 }
 }
}
export function createEcology(scene,shared,obstacles){
 const sim=new ReefSimulation(obstacles),parts=[],obj=new T.Object3D(),material=new T.MeshStandardMaterial({vertexColors:true,roughness:.42,side:T.DoubleSide});
 for(const s of SPECIES){const body=new T.InstancedMesh(fishGeometry(s),material,8),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,-s.l*.8,0,s.h*.8,-s.l*1.5,0,0,-s.l*1.25,0,0,-s.l*.8,0,0,-s.l*1.25,0,-s.h*.8,-s.l*1.5],3));g.computeVertexNormals();const tail=new T.InstancedMesh(g,new T.MeshStandardMaterial({color:s.accent,roughness:.5,side:T.DoubleSide}),8);body.userData.species=s.index;body.frustumCulled=tail.frustumCulled=false;body.instanceMatrix.setUsage(T.DynamicDrawUsage);tail.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(body,tail);parts.push({body,tail});}
 const pellets=new T.InstancedMesh(new T.SphereGeometry(.035,6,4),new T.MeshStandardMaterial({color:'#d6a36b'}),18);pellets.frustumCulled=false;scene.add(pellets);let acc=0,hz=30;
 function update(t,dt){acc+=dt;let steps=0;while(acc>=1/hz&&steps++<4){sim.step(1/hz,shared.day.value);acc-=1/hz;}if(steps>=4)acc=0;
 for(const s of SPECIES){const {body,tail}=parts[s.index];body.count=tail.count=sim.perSpecies;for(let k=0;k<sim.perSpecies;k++){const f=sim.fish[s.index*8+k];obj.position.copy(f.p);obj.quaternion.copy(f.q);obj.scale.setScalar(.8+(k%3)*.08);obj.updateMatrix();body.setMatrixAt(k,obj.matrix);obj.rotateY(Math.sin(t*(5+s.speed*7)+f.phase)*(.20+f.v.length()*.3));obj.updateMatrix();tail.setMatrixAt(k,obj.matrix);}body.instanceMatrix.needsUpdate=tail.instanceMatrix.needsUpdate=true;}
 pellets.count=sim.food.length;sim.food.forEach((p,i)=>{obj.position.copy(p.p);obj.quaternion.identity();obj.scale.setScalar(1);obj.updateMatrix();pellets.setMatrixAt(i,obj.matrix);});pellets.instanceMatrix.needsUpdate=true; }
 return{sim,parts,update,setQuality(level){hz=level==='eco'?15:level==='high'?40:25;},pick(ray){const hit=ray.intersectObjects(parts.map(p=>p.body),false)[0];return hit?sim.fish[hit.object.userData.species*8+hit.instanceId]:null;},reset(){sim.food=[];sim.events=[];sim.eaten=0;sim.lastFeed=-10;sim.fish.forEach(f=>{f.p.copy(f.home);f.v.set(0,0,0);f.fear=0;sim.constrain(f);});}};
}
