import * as T from 'three';
import {createEcology} from './ecology.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {HALF,SIZE,BASE,terrainHeight} from './physics.js';

export function createWorld(scene,shared) {
  let seed=11321;const rand=()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
  const rr=(a,b)=>a+(b-a)*rand(), V=(x,y,z)=>new T.Vector3(x,y,z);
  const causticHook=(s)=>{
    s.uniforms.uCaustic=shared.caustic;s.uniforms.uDay=shared.day;
    s.vertexShader='varying vec3 vCW;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 cw=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        cw=instanceMatrix*cw;
      #endif
      vCW=(modelMatrix*cw).xyz;`);
    s.fragmentShader='varying vec3 vCW;uniform sampler2D uCaustic;uniform float uDay;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`float ca=texture2D(uCaustic,vCW.xz/${SIZE.toFixed(1)}+0.5).r;
      float underwater=1.0-smoothstep(-0.15,0.04,vCW.y);
      outgoingLight+=vec3(0.30,0.56,0.43)*ca*ca*2.3*underwater*uDay;
      #include <opaque_fragment>`);
  };
  const mat=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.72,...extra});m.onBeforeCompile=causticHook;return m;};
  const mats={sand:mat('#e6cfa0',{vertexColors:true}),sediment:mat('#bba789'),rock:mat('#788e80',{flatShading:true}),rockLight:mat('#a6b3a0',{flatShading:true}),wood:mat('#b78150'),woodLight:mat('#d1a16b'),woodDark:mat('#6e5140'),trunk:mat('#9d7b4f'),leaf:mat('#497e40',{side:T.DoubleSide}),leafLight:mat('#7a9f46',{side:T.DoubleSide}),leafDark:mat('#295f41',{side:T.DoubleSide}),roof:mat('#a16942'),roofLight:mat('#bf8150'),cream:mat('#fff2d4'),red:mat('#dd765a'),teal:mat('#4f9b90'),metal:mat('#526e67',{metalness:.5,roughness:.3})};
  const bucket=new Map(),temp=new T.Object3D();
  function add(g,m,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){
    temp.position.set(x,y,z);temp.rotation.set(rx,ry,rz);temp.scale.set(sx,sy,sz);temp.updateMatrix();
    let geo=g.clone();if(geo.index)geo=geo.toNonIndexed();geo.clearGroups();
    if(!geo.attributes.uv)geo.setAttribute('uv',new T.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
    geo.applyMatrix4(temp.matrix);if(!bucket.has(m))bucket.set(m,[]);bucket.get(m).push(geo);
  }
  const box=new T.BoxGeometry(1,1,1),sphere=new T.SphereGeometry(1,12,8),rockG=new T.DodecahedronGeometry(1,0);
  const cube=(m,x,y,z,sx,sy,sz,ry=0,rz=0)=>add(box,m,x,y,z,0,ry,rz,sx,sy,sz);
  function tube(points,r,m){add(new T.TubeGeometry(new T.CatmullRomCurve3(points),Math.max(6,points.length*3),r,5,false),m);}
  function stick(a,b,r,m,r2=r*.85){
    const d=b.clone().sub(a),g=new T.CylinderGeometry(r2,r,d.length(),7),q=new T.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize());
    g.applyQuaternion(q);g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,m);
  }
  // The island and the seabed are one continuous, colored terrain mesh.
  const ng=112,terrain=new T.PlaneGeometry(SIZE,SIZE,ng,ng);terrain.rotateX(-Math.PI/2);
  const colors=[],pos=terrain.attributes.position,cc=new T.Color(),dry=new T.Color('#f3dfac'),wet=new T.Color('#c9d9af'),deep=new T.Color('#a1c9b5');
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),y=terrainHeight(x,z);pos.setY(i,y);
    cc.copy(deep).lerp(wet,T.MathUtils.smoothstep(y,-3.4,-.25)).lerp(dry,T.MathUtils.smoothstep(y,-.4,.16));
    cc.multiplyScalar(.93+rand()*.13);colors.push(cc.r,cc.g,cc.b);
  }
  terrain.setAttribute('color',new T.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
  const seabed=new T.Mesh(terrain,mats.sand);seabed.receiveShadow=true;scene.add(seabed);
  // Geological cutaway beneath the clear water. Its top matches the seabed exactly.
  for(let edge=0;edge<4;edge++){
    const vs=[],cs=[],idx=[];const sandLayer=new T.Color('#ac9a7f');
    for(let j=0;j<=3;j++)for(let i=0;i<=ng;i++){
      const t=-HALF+i*SIZE/ng;let x,z;
      if(edge===0){x=t;z=HALF;}if(edge===1){x=-t;z=-HALF;}if(edge===2){x=HALF;z=-t;}if(edge===3){x=-HALF;z=t;}
      const y=T.MathUtils.lerp(terrainHeight(x,z),BASE-.22,j/3);
      vs.push(x,y,z);cc.copy(sandLayer).multiplyScalar([1.17,.94,.83,.79][j]+rand()*.05);cs.push(cc.r,cc.g,cc.b);
      if(j<3&&i<ng){const k=j*(ng+1)+i;idx.push(k,k+ng+1,k+1,k+1,k+ng+1,k+ng+2);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setAttribute('color',new T.Float32BufferAttribute(cs,3));g.setIndex(idx);g.computeVertexNormals();
    const m=mat('#ffffff',{vertexColors:true,side:T.DoubleSide});scene.add(new T.Mesh(g,m));
  }
  cube(mats.sediment,0,BASE-.23,0,SIZE,.08,SIZE);
  const obstacles=[];
  // Reef rocks, with a few sun-warmed boulders around the beach.
  for(let i=0;i<43;i++){
    let x=rr(-5.9,5.9),z=rr(-5.9,5.9),y=terrainHeight(x,z);if(y>.1&&i<34)continue;
    const s=rr(.18,.62);obstacles.push({x,z,r:s,top:y+s*.9});add(rockG,i%3?mats.rock:mats.rockLight,x,y+s*.23,z,rr(0,2),rr(0,6),0,s,s*.65,s*.8);
  }
  for(const [x,z,s] of [[-2.1,.1,.55],[-2.0,-1.3,.4],[1.45,-.8,.35],[.8,1.25,.25]])add(rockG,mats.rockLight,x,terrainHeight(x,z)+s*.2,z,.1,.6,.4,s,s*.7,s*.9);
  // Feathered palm fronds, gently curved trunks and coconuts.
  function palm(x,z,height,lean,rot){
    const y=terrainHeight(x,z)-.08,top=V(x+Math.cos(rot)*lean,y+height,z+Math.sin(rot)*lean),points=[];
    for(let j=0;j<=9;j++){
      const t=j/9;points.push(V(x+Math.cos(rot)*lean*t*t,y+height*t,z+Math.sin(rot)*lean*t*t));
      if(j)stick(points[j-1],points[j],.12*(1-t*.5),j%3===0?mats.woodDark:mats.trunk);
    }
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4+rot,len=rr(1.25,1.7),pts=[];
      for(let k=0;k<=12;k++){const t=k/12;pts.push(V(top.x+Math.cos(a)*len*t,top.y+.36*Math.sin(t*Math.PI)-.55*t*t,top.z+Math.sin(a)*len*t));}
      tube(pts,.014,mats.leafLight);
      for(let k=1;k<12;k++)for(let side=-1;side<=1;side+=2){
        const t=k/12,p=pts[k],w=.39*Math.sin(Math.PI*t)**.65,pa=a+side*1.1;
        const tip=V(p.x+Math.cos(pa)*w+.13*Math.cos(a),p.y-.1-w*.15,p.z+Math.sin(pa)*w+.13*Math.sin(a));
        const b=V(p.x+Math.cos(a)*.17,p.y-.018,p.z+Math.sin(a)*.17);
        const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...p.toArray(),...tip.toArray(),...b.toArray()],3));g.computeVertexNormals();add(g,j%3===0?mats.leafLight:j%3===1?mats.leaf:mats.leafDark);
      }
    }
    for(let j=0;j<3;j++)add(sphere,mats.woodDark,top.x+rr(-.13,.13),top.y-.12,top.z+rr(-.13,.13),0,0,0,.105,.13,.105);
  }
  palm(-1.45,-.9,2.65,-.28,.4);palm(.72,-1.25,2.35,.35,-.4);palm(-1.55,.55,2.3,.5,2.3);palm(.05,.45,2.65,.25,1.5);
  // Tiny timber cabin. Roof strips are real geometry, not a texture.
  const hx=-.35,hz=-.55,hy=terrainHeight(hx,hz)+.13;
  cube(mats.woodDark,hx,hy,hz,1.5,.13,1.4);
  for(let k=0;k<7;k++){
    const y=hy+.1+k*.116;cube(k%2?mats.wood:mats.woodLight,hx,y,hz,1.12,.108,.96);
  }
  for(const dx of[-.63,.63])for(const dz of[-.57,.57])cube(mats.woodDark,hx+dx,hy-.2,hz+dz,.09,.65,.09);
  const windowMat=mat('#314a41',{roughness:.18,metalness:.12,emissive:'#ffb052',emissiveIntensity:.04});
  cube(windowMat,hx-.27,hy+.43,hz+.489,.31,.34,.024);cube(mats.woodDark,hx+.24,hy+.35,hz+.493,.28,.67,.03);
  cube(mats.woodLight,hx-.27,hy+.43,hz+.508,.035,.35,.02);cube(mats.woodLight,hx-.27,hy+.43,hz+.51,.33,.035,.02);
  cube(windowMat,hx+.57,hy+.43,hz,.02,.30,.32);cube(mats.woodLight,hx+.586,hy+.43,hz,.02,.32,.025);
  for(let side=-1;side<=1;side+=2){
    cube(mats.roof,hx+side*.36,hy+1.0,hz,.94,.09,1.42,0,-side*.55);
    for(let k=0;k<19;k++)cube(k%3?mats.roofLight:mats.roof,hx+side*.37,hy+1.055,hz-.68+k*.076,.96,.042,.045,0,-side*.55);
  }
  tube([V(hx,hy+1.30,hz-.75),V(hx,hy+1.32,hz+.75)],.06,mats.woodDark);
  for(let k=0;k<5;k++)cube(mats.woodLight,hx,hy-.03-k*.07,hz+.74+k*.10,.52,.08,.14);
  // Dock on pilings, with rope railings.
  const dock=new T.Group();scene.add(dock);const dockAngle=.42,origin=V(.87,.19,.95);
  const dp=(x,y,z)=>V(origin.x+x*Math.cos(dockAngle)+z*Math.sin(dockAngle),origin.y+y,origin.z-x*Math.sin(dockAngle)+z*Math.cos(dockAngle));
  for(let j=0;j<23;j++){const p=dp(0,0,j*.135);cube(j%3?mats.woodLight:mats.wood,p.x,p.y,p.z,.84,.085,.123,dockAngle);}
  for(const x of[-.34,.34])for(const z of[.12,1.4,2.83]){
    const p=dp(x,-.45,z);add(new T.CylinderGeometry(.046,.065,1.8,8),mats.woodDark,...p.toArray());
    const q=dp(x,.47,z);add(sphere,mats.woodLight,...q.toArray(),0,0,0,.07,.04,.07);
  }
  for(const x of[-.35,.35])for(const z of[.12,1.4])tube([dp(x,.37,z),dp(x,.20,z+.64),dp(x,.37,z+1.28)],.017,mats.cream);
  // Beach details: a striped towel, parasol and scattered shells.
  const tx=-.55,tz=1.0,ty=terrainHeight(tx,tz)+.025;
  for(let i=0;i<7;i++)cube(i%2?mats.cream:mats.red,tx+(.06*i-.18),ty,tz,.058,.018,.68,-.3);
  const ux=-1.05,uz=.91,uy=terrainHeight(ux,uz);stick(V(ux,uy,uz),V(ux,uy+.92,uz),.022,mats.woodDark);
  for(let j=0;j<8;j++){
    const a=j*Math.PI/4,b=(j+1)*Math.PI/4,g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([ux,uy+1.04,uz,ux+Math.cos(a)*.53,uy+.83,uz+Math.sin(a)*.53,ux+Math.cos(b)*.53,uy+.83,uz+Math.sin(b)*.53],3));g.computeVertexNormals();add(g,j%2?mats.cream:mats.teal);
  }
  for(let i=0;i<20;i++){const x=rr(-2,2),z=rr(-1.8,1.8),y=terrainHeight(x,z);if(y<.06||y>.42)continue;add(sphere,mats.cream,x,y+.03,z,0,rand()*6,0,.05,.025,.07);}
  // Branching coral, plate coral and sculpted brain coral.
  const coralMats=['#d47977','#d4a080','#bd728e','#a292b8','#ecb776','#6cbcae'].map(c=>mat(c,{roughness:.65}));
  const reefSpots=[[-4.6,3.1],[-3.7,4.4],[-4.2,.6],[4.35,1.1],[4.8,3.8],[2.2,4.7],[-1.4,4.9],[4.7,-3.6],[-4.6,-3.2]];
  function branch(p,dir,len,r,depth,m){
    const end=p.clone().addScaledVector(dir,len);stick(p,end,r,m,r*.64);add(sphere,m,...end.toArray(),0,0,0,r*.68,r*.68,r*.68);
    if(depth>0)for(let j=0;j<3;j++){const a=rr(0,Math.PI*2),d=V(Math.cos(a)*.65,rr(.6,.96),Math.sin(a)*.65).normalize();branch(end,d,len*rr(.45,.7),r*.63,depth-1,m);}
  }
  reefSpots.forEach(([x,z],i)=>{
    const y=terrainHeight(x,z);add(rockG,mats.rock,x,y+.09,z,0,i,0,.65,.23,.53);
    for(let j=0;j<3;j++){const px=x+rr(-.35,.35),pz=z+rr(-.28,.28);branch(V(px,terrainHeight(px,pz)+.09,pz),V(rr(-.15,.15),1,rr(-.15,.15)),rr(.25,.54),.065,2,coralMats[(i+j)%6]);}
    const bx=x+.52,bz=z+.3,by=terrainHeight(bx,bz)+.20;
    add(sphere,coralMats[(i+1)%6],bx,by,bz,0,0,0,.33,.26,.31);
    for(let j=0;j<7;j++){
      const pts=[];for(let k=0;k<=12;k++){const a=k/12*Math.PI;pts.push(V(bx+Math.cos(a)*.29,by+Math.sin(a)*.25,bz+(j-3)*.065+.016*Math.sin(a*7+j)));}tube(pts,.014,coralMats[(i+2)%6]);
    }
    for(let j=0;j<3;j++)add(new T.CylinderGeometry(.2+j*.06,.14,.045,14),coralMats[(i+4)%6],x-.5,y+.13+j*.11,z+.24,0,j,.14*j);
  });
  function starfish(x,z){const y=terrainHeight(x,z)+.04,verts=[];for(let j=0;j<10;j++){const a=j*Math.PI/5,b=(j+1)*Math.PI/5,r=j%2?.09:.23,r2=(j+1)%2?.09:.23;verts.push(x,y+.07,z,x+r*Math.cos(a),y,z+r*Math.sin(a),x+r2*Math.cos(b),y,z+r2*Math.sin(b));}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();add(g,mats.red);}
  starfish(-2.65,4.8);starfish(3.6,4.9);starfish(-4.6,-.5);
  // Static geometries are merged by material to keep draw calls bounded.
  for(const [m,geos]of bucket){const g=mergeGeometries(geos,false),mesh=new T.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);geos.forEach(g=>g.dispose());}
  // Seagrass, instanced and responding to sampled surface currents.
  const blade=new T.PlaneGeometry(.085,.9,1,7);blade.translate(0,.45,0);
  const gp=blade.attributes.position;for(let i=0;i<gp.count;i++){const y=gp.getY(i);gp.setX(i,gp.getX(i)*(1-y/.95)+.10*y*y);}blade.computeVertexNormals();
  const grassMat=mat('#528c6b',{side:T.DoubleSide});grassMat.onBeforeCompile=s=>{
    causticHook(s);s.uniforms.uTime=shared.time;s.uniforms.uWave=shared.wave;
    s.vertexShader='uniform float uTime;uniform sampler2D uWave;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec2 gpos=instanceMatrix[3].xz;vec2 current=texture2D(uWave,gpos/${SIZE.toFixed(1)}+0.5).gb-0.5;
      transformed.x+=position.y*position.y*(sin(uTime*1.1+gpos.x+gpos.y)*0.12+current.x*1.4);
      transformed.z+=position.y*position.y*(cos(uTime*.85+gpos.x)*0.05+current.y*1.4);`);
  };
  const grass=new T.InstancedMesh(blade,grassMat,230);let gi=0;
  while(gi<230){const x=rr(-6.1,6.1),z=rr(-6.1,6.1),y=terrainHeight(x,z);if(y>-.7)continue;temp.position.set(x,y,z);temp.rotation.set(0,rr(0,6.28),rr(-.2,.2));temp.scale.set(rr(.7,1.4),rr(.55,1.5),1);temp.updateMatrix();grass.setMatrixAt(gi++,temp.matrix);}scene.add(grass);
  // Small anchored sailboat, with a real floating rigid-body response.
  const boat=new T.Group();boat.position.set(3.25,.05,2.45);boat.rotation.y=.35;scene.add(boat);
  function boatMesh(g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;boat.add(o);return o;}
  const hull=new T.Shape();hull.moveTo(0,-.92);hull.bezierCurveTo(-.48,-.70,-.51,.48,0,.98);hull.bezierCurveTo(.51,.48,.48,-.70,0,-.92);
  const hullGeo=new T.ExtrudeGeometry(hull,{depth:.19,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.07,bevelThickness:.10,curveSegments:12});hullGeo.rotateX(Math.PI/2);
  boatMesh(hullGeo,mat('#f3e8ce',{roughness:.42}),0,.02,0);
  const inside=new T.ShapeGeometry(hull,20);inside.rotateX(Math.PI/2);const ins=boatMesh(inside,mat('#755f48',{side:T.DoubleSide}),0,.035,0);ins.scale.set(.82,1,.88);
  for(const z of[-.45,.15,.5])boatMesh(new T.BoxGeometry(.66,.06,.14),mats.woodLight,0,.09,z);
  const mast=boatMesh(new T.CylinderGeometry(.021,.031,1.95,8),mats.woodDark,0,1.02,-.10);
  boatMesh(new T.CylinderGeometry(.016,.016,1.2,7),mats.woodDark,.03,.40,.42).rotation.x=Math.PI/2;
  const sail=new T.BufferGeometry();sail.setAttribute('position',new T.Float32BufferAttribute([.04,1.92,-.10,.13,.50,-.10,.10,.48,1.02,.04,1.92,-.10,.10,.48,1.02,.23,1.03,.44],3));sail.computeVertexNormals();
  boatMesh(sail,mat('#fff3d8',{side:T.DoubleSide,roughness:.9}));
  const jib=new T.BufferGeometry();jib.setAttribute('position',new T.Float32BufferAttribute([.02,1.72,-.14,.02,.43,-.14,.04,.37,-.85],3));jib.computeVertexNormals();boatMesh(jib,mat('#de8164',{side:T.DoubleSide}));
  const flagG=new T.BufferGeometry();flagG.setAttribute('position',new T.Float32BufferAttribute([0,2.03,-.10,0,1.84,-.10,0,1.96,.25],3));flagG.computeVertexNormals();boatMesh(flagG,mat('#4c9b92',{side:T.DoubleSide}));
  const rimPts=[];for(let i=0;i<60;i++){const pt=hull.getPoint(i/59);rimPts.push(V(pt.x,.055,pt.y));}boatMesh(new T.TubeGeometry(new T.CatmullRomCurve3(rimPts),60,.025,5,false),mats.red);
  let boatV=0,pitchV=0,rollV=0;
  for(const z of [.2,1.45,2.8])for(const x of[-.36,.36]){const p=dp(x,-.6,z);obstacles.push({x:p.x,z:p.z,r:.075,top:.2});}
  const ecology=createEcology(scene,shared,[...obstacles,...reefSpots.map(([x,z])=>({x,z,r:.7,top:terrainHeight(x,z)+.9}))]);
  const bubbleCount=35,bubbleGeo=new T.SphereGeometry(1,8,6),bubbleMat=new T.MeshPhysicalMaterial({color:'#c9fff2',roughness:.04,metalness:.05,transparent:true,opacity:.38,depthWrite:false,clearcoat:1});
  const bubbles=new T.InstancedMesh(bubbleGeo,bubbleMat,bubbleCount),bubbleInfo=[];
  for(let i=0;i<bubbleCount;i++){const spot=reefSpots[i%reefSpots.length];bubbleInfo.push({x:spot[0],z:spot[1],base:terrainHeight(...spot)+.25,s:rr(.025,.07),offset:rand()*4,speed:rr(.15,.35)});}scene.add(bubbles);
  // A quiet studio floor and soft area-like directional lighting.
  const ground=new T.Mesh(new T.PlaneGeometry(240,240),new T.MeshStandardMaterial({color:'#c6dbcf',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-5.4;ground.receiveShadow=true;scene.add(ground);
  // Soft contact shadow, procedurally painted and anchored below the floating slice.
  const cv=document.createElement('canvas');cv.width=cv.height=128;const ctx=cv.getContext('2d'),gr=ctx.createRadialGradient(64,64,5,64,64,63);gr.addColorStop(0,'rgba(30,65,52,.24)');gr.addColorStop(.55,'rgba(30,65,52,.12)');gr.addColorStop(1,'rgba(30,65,52,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,128,128);
  const shadow=new T.Mesh(new T.PlaneGeometry(17,17),new T.MeshBasicMaterial({map:new T.CanvasTexture(cv),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(.2,-5.38,.2);scene.add(shadow);
  const key=new T.DirectionalLight('#fff0ce',3.0);key.position.set(-7,12,7);key.castShadow=true;key.shadow.mapSize.set(1536,1536);key.shadow.camera.left=key.shadow.camera.bottom=-10;key.shadow.camera.right=key.shadow.camera.top=10;key.shadow.camera.near=1;key.shadow.camera.far=40;key.shadow.normalBias=.025;key.shadow.bias=-.00014;key.shadow.radius=3;scene.add(key);
  const hemi=new T.HemisphereLight('#d8f2ed','#7b9175',2.0),fill=new T.DirectionalLight('#b3e4ed',1.05);fill.position.set(6,5,-7);scene.add(hemi,fill);
  const lamp=new T.PointLight('#ffc77f',0,4,2);lamp.position.set(hx,hy+.6,hz+.6);scene.add(lamp);
  const starPositions=[];for(let i=0;i<160;i++){const a=rand()*Math.PI*2,y=rr(10,40),r=rr(40,70);starPositions.push(Math.cos(a)*r,y,Math.sin(a)*r);}
  const starsGeo=new T.BufferGeometry();starsGeo.setAttribute('position',new T.Float32BufferAttribute(starPositions,3));const stars=new T.Points(starsGeo,new T.PointsMaterial({color:'#dfefdd',size:.10,transparent:true,opacity:0,depthWrite:false}));scene.add(stars);
  const quat=new T.Quaternion(),up=V(0,0,1),dir=V(0,0,0),force=V(0,0,0),delta=V(0,0,0),eq=new T.Quaternion();
  function update(t,dt,physics){
    // Buoyancy integrates vertical and angular accelerations, instead of setting a sine bob.
    const bx=boat.position.x,bz=boat.position.z,hy=physics.sample(bx,bz)+.05;
    boatV+=((hy-boat.position.y)*23-boatV*6)*dt;boat.position.y+=boatV*dt;
    const c=Math.cos(boat.rotation.y),s=Math.sin(boat.rotation.y),front=physics.sample(bx+s*.65,bz+c*.65),back=physics.sample(bx-s*.65,bz-c*.65);
    const left=physics.sample(bx-c*.30,bz+s*.30),right=physics.sample(bx+c*.30,bz-s*.30);
    const pitch=-Math.atan2(front-back,1.3),roll=Math.atan2(right-left,.60);
    pitchV+=((pitch-boat.rotation.x)*17-pitchV*4.6)*dt;rollV+=((roll-boat.rotation.z)*17-rollV*4.6)*dt;
    boat.rotation.x+=pitchV*dt;boat.rotation.z+=rollV*dt;
    ecology.update(t,dt);
    bubbleInfo.forEach((b,i)=>{const rise=(t*b.speed+b.offset)%(-b.base+.07),y=b.base+rise;temp.position.set(b.x+.08*Math.sin(t*.9+i),y,b.z+.06*Math.cos(t*.8+i));temp.rotation.set(0,0,0);temp.scale.setScalar(b.s*(1+rise*.07));temp.updateMatrix();bubbles.setMatrixAt(i,temp.matrix);});bubbles.instanceMatrix.needsUpdate=true;
  }
  function setTime(hour){
    const elevation=Math.sin((hour-6)*Math.PI/12),day=T.MathUtils.smoothstep(elevation,-.18,.25),sunset=Math.exp(-(((elevation-.12)/.28)**2))*day;
    shared.day.value=day;key.intensity=.10+day*2.85;hemi.intensity=.30+day*1.55;fill.intensity=.22+day*.65;
    key.color.set('#fff0ce').lerp(new T.Color('#ffba7f'),sunset*.75);key.position.set(-7,Math.max(3,8+elevation*6),5+Math.cos(hour*Math.PI/12)*5);
    ground.material.color.set('#172f35').lerp(new T.Color('#c6dbcf'),day).lerp(new T.Color('#d7c6b3'),sunset*.22);
    const bg=new T.Color('#142b33').lerp(new T.Color('#deebe4'),day).lerp(new T.Color('#e3cfbd'),sunset*.30);scene.background=bg;
    scene.fog=new T.Fog(bg,39,110);windowMat.emissiveIntensity=(1-day)*2+.025;lamp.intensity=(1-day)*3.5;stars.material.opacity=(1-day)*.85;
    return{day,sunset,bg};
  }
  return{ecology,setQuality(level){ecology.setQuality(level);grass.count=level==='eco'?90:level==='high'?230:160;bubbles.count=level==='eco'?12:level==='high'?35:24;},update,setTime,boat,lights:{key,hemi,fill},counts:{get fish(){return ecology.sim.count;},grass:230},resetBoat(){boat.position.y=.05;boat.rotation.x=boat.rotation.z=0;boatV=pitchV=rollV=0;}};
}
