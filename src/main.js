import * as THREE from 'three';
import {createReefUI} from './reef-ui.js';
import {OceanPhysics,HALF,terrainHeight} from './physics.js';
import {createWater} from './water.js';
import {createWorld} from './world.js';
import {TouchIntent,AdaptiveQuality} from './experience.js';

const $=s=>document.querySelector(s),clamp=THREE.MathUtils.clamp;
const p={strength:.85,elasticity:.58,clarity:.82,wind:.30,hour:14.5};
const loading=$('#loading');let failed=false;
let saved={};try{saved=JSON.parse(localStorage.getItem('jelly-ocean-v2')||'{}')||{};}catch{}
function saveSettings(mode){try{localStorage.setItem('jelly-ocean-v2',JSON.stringify({parameters:p,quality:mode}));}catch{}}

function fail(message){failed=true;loading.classList.remove('loadingdone');$('#loadtext').textContent=message;}
window.addEventListener('error',e=>{if(!window.__JELLY_READY__)fail('海洋加载遇到了问题：'+e.message);});
try{start();}catch(error){console.error(error);fail('无法启动 3D 海洋。请使用支持 WebGL 2 的浏览器并启用硬件加速。'+error.message);}

function start(){
  const viewport=$('#viewport'),isMobile=()=>matchMedia('(max-width:760px)').matches;
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
  renderer.setClearColor('#deebe4');renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  viewport.appendChild(renderer.domElement);const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','3D 果冻海洋；方向键旋转，加减号缩放，空格暂停，R 恢复视角');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.15,150);
  let initialTier='auto';try{initialTier=saved.quality||'auto';}catch{}
  const physics=new OceanPhysics(initialTier==='eco'?49:initialTier==='high'?89:isMobile()?65:81);
  const shared={time:{value:0},day:{value:1},wave:{value:null},caustic:{value:null}};
  const water=createWater(scene,physics,shared),world=createWorld(scene,shared);
  if(isMobile())world.lights.key.shadow.mapSize.set(1024,1024);
  const cursor=new THREE.Group(),ring=new THREE.Mesh(new THREE.TorusGeometry(.23,.009,6,48),new THREE.MeshBasicMaterial({color:'#faffdc',transparent:true,opacity:.88,depthWrite:false}));ring.rotation.x=-Math.PI/2;cursor.add(ring);cursor.visible=false;cursor.renderOrder=20;scene.add(cursor);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),waterPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hitPoint=new THREE.Vector3();
  const qualityControl=new AdaptiveQuality(isMobile(),devicePixelRatio||1),touchIntent=new TouchIntent();
  let quality=qualityControl.setMode(saved.quality),width=1,height=1,frame=0,t=0,accumulator=0,last=performance.now(),paused=false;
  let touchMode=true,gesture=null,dragOrigin=null,camGoal=null,toastTimeout=0,captureCount=0,impulseCount=0;
  const pointers=new Map(),angular={theta:0,phi:0};
  let interaction='water',selectedFish=null,followFish=null,requestedDensity=4,reefUI=null,disturbTime=-1;
  const cam={theta:.68,phi:1.00,radius:25,target:new THREE.Vector3(0,-.65,0)};
  const spherical=new THREE.Spherical(),offset=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3();
  function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').classList.remove('show'),2400);}
  function fitRadius(base=24.5){return base*Math.max(1,.93/(width/height));}
  function setView(view='island',immediate=false){
    followFish=null;if(reefUI)reefUI.following(false);
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    const presets={island:{theta:.68,phi:1.00,radius:fitRadius(),target:new THREE.Vector3(0,-.65,0)},reef:{theta:.24,phi:1.42,radius:fitRadius(18.8),target:new THREE.Vector3(0,-1.65,1)},top:{theta:.0,phi:.09,radius:fitRadius(22),target:new THREE.Vector3(0,-.1,0)}};
    camGoal=presets[view];angular.theta=angular.phi=0;
    if(immediate){cam.theta=camGoal.theta;cam.phi=camGoal.phi;cam.radius=camGoal.radius;cam.target.copy(camGoal.target);camGoal=null;}
  }
  function updateCamera(dt){
    if(followFish){if(!followFish.active){followFish=null;reefUI.following(false);}else {camGoal=null;cam.target.lerp(followFish.p,1-Math.exp(-dt*4));}}
    if(camGoal){const f=1-Math.exp(-dt*5);cam.theta=THREE.MathUtils.lerp(cam.theta,camGoal.theta,f);cam.phi=THREE.MathUtils.lerp(cam.phi,camGoal.phi,f);cam.radius=THREE.MathUtils.lerp(cam.radius,camGoal.radius,f);cam.target.lerp(camGoal.target,f);if(Math.abs(cam.radius-camGoal.radius)+Math.abs(cam.phi-camGoal.phi)+Math.abs(cam.theta-camGoal.theta)<.001)camGoal=null;}
    else if(!pointers.size){cam.theta+=angular.theta*dt*45;cam.phi+=angular.phi*dt*45;angular.theta*=Math.exp(-dt*8);angular.phi*=Math.exp(-dt*8);}
    cam.phi=clamp(cam.phi,.045,Math.PI-.09);cam.radius=clamp(cam.radius,6.5,78);cam.target.x=clamp(cam.target.x,-8,8);cam.target.z=clamp(cam.target.z,-8,8);cam.target.y=clamp(cam.target.y,-5,5);
    spherical.set(cam.radius,cam.phi,cam.theta);offset.setFromSpherical(spherical);camera.position.copy(cam.target).add(offset);camera.lookAt(cam.target);camera.updateMatrixWorld();
  }
  function resize(){
    const rect=viewport.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);renderer.setPixelRatio(quality);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    const size=new THREE.Vector2();renderer.getDrawingBufferSize(size);water.resize(width,height,quality);water.uniforms.uResolution.value.copy(size);
  }
  resize();setView('island',true);updateCamera(0);
  new ResizeObserver(()=>{const previousFit=fitRadius();resize();cam.radius*=fitRadius()/previousFit;if(camGoal)camGoal.radius*=fitRadius()/previousFit;}).observe(viewport);
  function ndc(x,y){const r=canvas.getBoundingClientRect();pointer.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);}
  function surfaceHit(x,y,loose=false){
    ndc(x,y);const hit=raycaster.intersectObject(water.top,false)[0];let pt=hit?.point;
    if(!pt&&loose)pt=raycaster.ray.intersectPlane(waterPlane,hitPoint);
    if(!pt)return null;const px=clamp(pt.x,-HALF+.08,HALF-.08),pz=clamp(pt.z,-HALF+.08,HALF-.08);
    if(!loose&&(Math.abs(pt.x)>HALF+.25||Math.abs(pt.z)>HALF+.25||terrainHeight(px,pz)>-.08))return null;
    return{x:px,z:pz};
  }
  function pan(dx,dy){
    const scale=2*cam.radius*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/height;
    right.setFromMatrixColumn(camera.matrixWorld,0);up.setFromMatrixColumn(camera.matrixWorld,1);cam.target.addScaledVector(right,-dx*scale).addScaledVector(up,dy*scale);
  }
  function markCustomView(){document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));camGoal=null;}
  function pairInfo(){const a=[...pointers.values()];return{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2,d:Math.max(1,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y))};}
  canvas.addEventListener('pointerdown',e=>{
    e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});angular.theta=angular.phi=0;
    if(pointers.size>=2){touchIntent.clear();physics.drag=null;cursor.visible=false;gesture={kind:'pinch',last:pairInfo()};markCustomView();return;}
    if((interaction==='inspect'||interaction==='feed')&&e.button===0&&!e.shiftKey){gesture={kind:'action',x:e.clientX,y:e.clientY};return;}
    const hit=touchMode&&!paused&&e.button===0&&!e.shiftKey?surfaceHit(e.clientX,e.clientY):null;
    if(hit&&e.pointerType==='touch'){touchIntent.begin(e.pointerId,e.clientX,e.clientY,hit);gesture={kind:'pending'};return;}
    if(hit){
      impulseCount++;physics.impulse(hit.x,hit.z,-2.2*p.strength,.46);world.ecology.sim.disturb(hit.x,hit.z,p.strength);physics.drag={...hit,height:-.25*p.strength};dragOrigin={y:e.clientY,x:hit.x,z:hit.z};gesture={kind:'water'};cursor.visible=true;cursor.position.set(hit.x,physics.sample(hit.x,hit.z)+.07,hit.z);ring.scale.setScalar(1.15);
    }else{gesture={kind:e.button===2||e.shiftKey?'pan':e.button===1?'zoom':'orbit'};markCustomView();}
  });
  canvas.addEventListener('pointermove',e=>{
    const prev=pointers.get(e.pointerId);
    if(!prev){if(touchMode&&e.pointerType!=='touch'){const h=surfaceHit(e.clientX,e.clientY);cursor.visible=!!h;if(h){cursor.position.set(h.x,physics.sample(h.x,h.z)+.055,h.z);ring.scale.setScalar(1);canvas.style.cursor='grab';}else canvas.style.cursor='default';}return;}
    const dx=e.clientX-prev.x,dy=e.clientY-prev.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>=2){const pair=pairInfo(),old=gesture.last||pair;cam.radius*=old.d/pair.d;pan(pair.x-old.x,pair.y-old.y);gesture={kind:'pinch',last:pair};return;}
    if(gesture?.kind==='action'){if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<8)return;gesture={kind:'orbit'};markCustomView();}
    if(gesture?.kind==='pending'){
      const intent=touchIntent.move(e.pointerId,e.clientX,e.clientY);if(!intent)return;
      dragOrigin={y:intent.y,x:intent.hit.x,z:intent.hit.z};physics.drag={...intent.hit,height:-.25*p.strength};gesture={kind:'water'};cursor.visible=true;
    }
    if(gesture?.kind==='water'){
      const h=surfaceHit(e.clientX,e.clientY,true);if(h&&terrainHeight(h.x,h.z)<-.04){
        const old=physics.drag||h;physics.shear.vx+=clamp((h.x-old.x)*.19,-.15,.15);physics.shear.vz+=clamp((h.z-old.z)*.19,-.15,.15);
        physics.drag={...h,height:clamp(-.23*p.strength-(e.clientY-dragOrigin.y)*.012,-.86,.86)};cursor.position.set(h.x,physics.sample(h.x,h.z)+.06,h.z);canvas.style.cursor='grabbing';
      }
    }else if(gesture?.kind==='pan')pan(dx,dy);
    else if(gesture?.kind==='zoom')cam.radius*=Math.exp(dy*.008);
    else{cam.theta-=dx*.006;cam.phi-=dy*.005;angular.theta=clamp(-dx*.004,-.09,.09);angular.phi=clamp(-dy*.003,-.07,.07);}
  });
  function endPointer(e){
    if(!pointers.has(e.pointerId))return;
    if(gesture?.kind==='action'&&e.type==='pointerup'&&pointers.size===1){if(interaction==='inspect'){ndc(e.clientX,e.clientY);selectFish(world.ecology.pick(raycaster));}else if(!paused){const h=surfaceHit(e.clientX,e.clientY);if(h)toast(world.ecology.sim.feed(h.x,h.z)?'食物入水，静候鱼群靠近。':'请稍等两秒，并选择较深的水域。');}else toast('继续动画后可投喂。');}
    const tap=touchIntent.end(e.pointerId,e.type!=='pointerup');
    if(tap&&!paused&&touchMode){physics.impulse(tap.hit.x,tap.hit.z,-2.2*p.strength,.46);world.ecology.sim.disturb(tap.hit.x,tap.hit.z,p.strength);impulseCount++;}
    pointers.delete(e.pointerId);physics.drag=null;cursor.visible=false;canvas.style.cursor='default';
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(pointers.size===1)gesture={kind:'orbit'};else if(!pointers.size)gesture=null;
  }
  canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('lostpointercapture',endPointer);
  canvas.addEventListener('pointerleave',()=>{if(!pointers.size)cursor.visible=false;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{e.preventDefault();markCustomView();cam.radius*=Math.exp(clamp(e.deltaY,-180,180)*.0015);},{passive:false});
  function updateMode(mode){interaction=mode?'water':'orbit';if(reefUI)reefUI.setMode(interaction);touchMode=mode;touchIntent.clear();physics.drag=null;$('#touch').classList.toggle('active',mode);$('#orbit').classList.toggle('active',!mode);$('#touch').setAttribute('aria-pressed',mode);$('#orbit').setAttribute('aria-pressed',!mode);cursor.visible=false;$('#hint').innerHTML=mode?(isMobile()?'<b>单指</b> 触摸或拖动水面 · <b>双指</b> 缩放与移动镜头':'<b>点击</b> 水面泛起涟漪 · <b>拖动</b> 轻揉海洋 · 空白处拖动旋转'):(isMobile()?'<b>单指</b> 旋转 · <b>双指</b> 缩放与移动':'<b>拖动</b> 旋转 · <b>滚轮</b> 缩放 · <b>右键 / Shift + 拖动</b> 平移');}
  function selectFish(f){selectedFish=f;reefUI.select(f);if(!f)toast('请点选鱼身，或从图鉴选择。');}
  function stopFollowing(){followFish=null;reefUI.following(false);}
  reefUI=createReefUI(world.ecology,{onMode(mode){updateMode(mode==='water');interaction=mode;reefUI.setMode(mode);if(mode==='inspect'||mode==='feed'){$('#hint').textContent=mode==='inspect'?'轻点鱼身查看 · 拖动旋转 · 双指缩放':'轻点深水区投喂 · 每两秒一次 · 拖动旋转';}},onDensity(n){requestedDensity=n;applyDetail();},onSelect:selectFish,onFollow(f){followFish=f;camGoal=null;cam.radius=f.s.behavior==='shark'?Math.max(10,fitRadius(7)):9;reefUI.following(true);},onStop:stopFollowing});
  $('#touch').onclick=()=>updateMode(true);$('#orbit').onclick=()=>updateMode(false);updateMode(true);
  function splash(){world.ecology.sim.disturb(3.5,3.35,p.strength*1.5);if(paused){togglePause();}physics.impulse(3.5,3.35,-4.3*p.strength,.64);physics.shear.vx+=.21;impulseCount++;toast('一滴水，一个小小的波澜。');}
  $('#splash').onclick=splash;
  function togglePause(){paused=!paused;touchIntent.clear();physics.drag=null;$('#pause').setAttribute('aria-pressed',paused);$('#pause').setAttribute('aria-label',paused?'继续动画':'暂停动画');$('#pause').classList.toggle('active',paused);$('#pauseIcon').innerHTML=paused?'<path d="m8 4 12 8-12 8Z"/>':'<path d="M9 5v14M15 5v14"/>';$('#liveLabel').textContent=paused?'PAUSED':'LIVE WORLD';last=performance.now();accumulator=0;}
  $('#pause').onclick=togglePause;$('#resetView').onclick=()=>{setView();toast('回到这座小岛。');};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  const presets={calm:{strength:.85,elasticity:.58,clarity:.82,wind:.30,hour:14.5},jelly:{strength:1.65,elasticity:.88,clarity:.88,wind:.18,hour:15.4},breeze:{strength:2.0,elasticity:.42,clarity:.72,wind:1.25,hour:17.1}};
  function applyTime(){
    const env=world.setTime(p.hour);water.uniforms.uSunset.value=env.sunset;water.uniforms.uSun.value.copy(world.lights.key.position).normalize();document.body.classList.toggle('night',env.day<.45);renderer.shadowMap.needsUpdate=true;
  }
  function updateSliders(){
    for(const key of Object.keys(p)){
      const input=$('#'+key);input.value=p[key];const frac=(p[key]-Number(input.min))/(Number(input.max)-Number(input.min))*100;input.style.background=`linear-gradient(to right,var(--accent) ${frac}%,var(--line) ${frac}%)`;
      let value=key==='hour'?`${String(Math.floor(p.hour)%24).padStart(2,'0')}:${String(Math.round(p.hour%1*60)).padStart(2,'0')}`:key==='wind'?(p.wind*10).toFixed(1)+' m/s':key==='strength'?p.strength.toFixed(2):Math.round(p[key]*100)+'%';
      $('#'+key+'Out').textContent=value;
    }
    water.uniforms.uClarity.value=p.clarity;
  }
  for(const key of Object.keys(p))$('#'+key).addEventListener('input',e=>{
    p[key]=Number(e.target.value);updateSliders();document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));$('#mood').textContent='由你定义的海洋';if(key==='hour')applyTime();saveSettings(qualityControl.mode);
  });
  function applyPreset(name){Object.assign(p,presets[name]);updateSliders();applyTime();document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));$('#mood').textContent={calm:'阳光正好 · 海风微甜',jelly:'弹性增强 · 轻揉试试看',breeze:'风起浪涌 · 自在漂流'}[name];saveSettings(qualityControl.mode);}
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{applyPreset(b.dataset.preset);if(b.dataset.preset==='jelly')splash();});
  $('#resetAll').onclick=()=>{physics.reset();world.resetBoat();world.ecology.reset();requestedDensity=4;selectFish(null);stopFollowing();updateMode(true);applyPreset('calm');setQuality('auto');setView();toast('海洋已恢复初始状态。');};
  const restored=saved.parameters;
  applyPreset('calm');
  if(restored&&typeof restored==='object'){
    for(const key of Object.keys(p)){const input=$('#'+key);if(Number.isFinite(restored[key]))p[key]=clamp(restored[key],Number(input.min),Number(input.max));}
    updateSliders();applyTime();document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));$('#mood').textContent='已恢复上次的海洋';saveSettings(qualityControl.mode);
  }
  function applyDetail(){
    const tier=qualityControl.mode==='auto'?(quality<1?'eco':'auto'):qualityControl.mode;
    world.setQuality(tier);water.setQuality(tier);const cap=tier==='eco'?2:tier==='high'?(isMobile()?6:8):isMobile()?4:6;
    world.ecology.sim.setDensity(Math.min(requestedDensity,cap));reefUI.density(requestedDensity,cap);
    if(followFish&&!followFish.active)stopFollowing();
    const shadowSize=tier==='eco'?512:tier==='high'?1536:1024;if(world.lights.key.shadow.mapSize.x!==shadowSize){world.lights.key.shadow.mapSize.set(shadowSize,shadowSize);world.lights.key.shadow.map?.dispose();world.lights.key.shadow.map=null;renderer.shadowMap.needsUpdate=true;}
  }
  function setQuality(mode){quality=qualityControl.setMode(mode);$('#quality').value=qualityControl.mode;resize();applyDetail();saveSettings(qualityControl.mode);}
  applyDetail();
  $('#quality').value=qualityControl.mode;$('#quality').onchange=e=>{setQuality(e.target.value);toast('画质已应用；刷新页面后切换水面网格精度。');};
  let panelVisible=!isMobile();
  function panelOpen(open){panelVisible=open;$('#panel').classList.toggle('open',open);$('#panel').inert=!open;document.body.classList.toggle('panel-closed',!open);$('#tune').setAttribute('aria-expanded',open);$('#tune').classList.toggle('active',open);}
  panelOpen(panelVisible);
  matchMedia('(max-width:760px)').addEventListener('change',()=>panelOpen(!isMobile()));
  $('#tune').onclick=()=>panelOpen(!panelVisible);$('#closePanel').onclick=()=>{panelOpen(false);$('#tune').focus();};
  function moreOpen(open){$('#moreMenu').hidden=!open;$('#more').setAttribute('aria-expanded',open);}
  $('#more').onclick=()=>moreOpen($('#moreMenu').hidden);
  $('#moreReset').onclick=()=>{moreOpen(false);$('#resetView').click();};
  $('#moreCapture').onclick=()=>{moreOpen(false);$('#capture').click();};
  function showHelp(){moreOpen(false);$('#help').showModal();}
  $('#helpBtn').onclick=showHelp;$('#moreHelp').onclick=showHelp;
  $('#closeHelp').onclick=()=>$('#help').close();
  $('#help').addEventListener('click',e=>{if(e.target===$('#help')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  function immersive(on){document.body.classList.toggle('immersive',on);$('#restoreUI').hidden=!on;for(const sel of ['.masthead','.toptools','.viewtabs','#panel','.bottomnav','#reefTools'])$(sel).inert=on||(sel==='#panel'&&!panelVisible);moreOpen(false);if(on)$('#restoreUI').focus();else $(isMobile()?'#more':'#immersive').focus();}
  $('#immersive').onclick=()=>immersive(true);$('#moreImmersive').onclick=()=>immersive(true);$('#restoreUI').onclick=()=>immersive(false);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){immersive(false);moreOpen(false);if(isMobile())panelOpen(false);}});
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#moreMenu,#more'))moreOpen(false);});
  $('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器未允许全屏显示。');}};
  if(!document.fullscreenEnabled)$('#fullscreen').hidden=true;
  $('#capture').onclick=()=>{
    cursor.visible=false;water.render(renderer,camera,frame,cursor);
    canvas.toBlob(blob=>{if(!blob){toast('图片生成失败，请重试。');return;}const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='Jelly-Ocean-'+new Date().toISOString().slice(0,19).replaceAll(':','-')+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);captureCount++;toast('已保存这一刻的海洋。');},'image/png');
  };
  canvas.addEventListener('keydown',e=>{
    const actions={' ':togglePause,'r':()=>setView(),R:()=>setView(),'+':()=>{camGoal=null;cam.radius*=.9;},'=':()=>{camGoal=null;cam.radius*=.9;},'-':()=>{camGoal=null;cam.radius*=1.1;},ArrowLeft:()=>{camGoal=null;cam.theta-=.10;},ArrowRight:()=>{camGoal=null;cam.theta+=.10;},ArrowUp:()=>{camGoal=null;cam.phi-=.10;},ArrowDown:()=>{camGoal=null;cam.phi+=.10;}};if(actions[e.key]){e.preventDefault();actions[e.key]();}
  });
  document.addEventListener('visibilitychange',()=>{last=performance.now();accumulator=0;if(document.hidden){physics.drag=null;touchIntent.clear();pointers.clear();gesture=null;angular.theta=angular.phi=0;}});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('图形上下文暂时中断。请刷新页面，重新唤醒海洋。');});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
  // Small nonperiodic initial perturbations. No sinusoid displaces the ocean.
  for(let i=0;i<16;i++)physics.impulse((physics.random()*2-1)*5.9,(physics.random()*2-1)*5.9,(physics.random()-.5)*.9,.34+physics.random()*.4);
  let fpsFrames=0,fpsStart=performance.now(),fps=60,maxDragHeight=0;
  function animate(now){
    if(failed)return;requestAnimationFrame(animate);if(document.hidden){last=now;return;}
    const dt=Math.min((now-last)/1000,.06);last=now;updateCamera(dt);
    if(!paused){
      accumulator+=dt;let steps=0;while(accumulator>=1/120&&steps<8){physics.step(1/120,p);accumulator-=1/120;steps++;}
      t+=dt;shared.time.value=t;world.update(t,dt,physics);water.update(frame);
      if(physics.drag){const d=physics.drag;if(t-disturbTime>.18){world.ecology.sim.disturb(d.x,d.z,p.strength*.6);disturbTime=t;}cursor.position.y=physics.sample(d.x,d.z)+.06;maxDragHeight=Math.max(maxDragHeight,Math.abs(physics.sample(d.x,d.z)));}
    }
    if(frame%(qualityControl.mode==='eco'?10:5)===0)renderer.shadowMap.needsUpdate=true;
    water.render(renderer,camera,frame,cursor);frame++;fpsFrames++;
    if(frame===2){loading.classList.add('loadingdone');window.__JELLY_READY__=true;setTimeout(()=>{loading.style.display='none';try{if(!localStorage.getItem('jelly-guide-v3')){$('#help').showModal();localStorage.setItem('jelly-guide-v3','1');}}catch{}},1000);}
    if(now-fpsStart>1000){fps=fpsFrames*1000/(now-fpsStart);$('#fpsCount').textContent=Math.round(fps)+' FPS';fpsFrames=0;fpsStart=now;
      if(qualityControl.sample(fps)){quality=qualityControl.ratio;resize();applyDetail();}
    }
  }
  world.update(0,0,physics);requestAnimationFrame(animate);
  // Read-only diagnostics, useful for verifying the delivered scene without mocking it.
  window.__JELLY__={get state(){return{ready:!!window.__JELLY_READY__,three:THREE.REVISION,webgl2:renderer.capabilities.isWebGL2,frames:frame,time:t,paused,touchMode,parameters:{...p},camera:{theta:cam.theta,phi:cam.phi,radius:cam.radius,target:cam.target.toArray()},energy:physics.energy(),maxHeight:Math.max(...physics.h),minHeight:Math.min(...physics.h),grid:physics.n,impulseCount,maxDragHeight,captureCount,boat:{height:world.boat.position.y,pitch:world.boat.rotation.x,roll:world.boat.rotation.z,surface:physics.sample(world.boat.position.x,world.boat.position.z)},fps,pixelRatio:quality,qualityMode:qualityControl.mode,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fish:world.counts.fish,species:12,contacts:world.ecology.sim.diagnostics(),food:world.ecology.sim.food.length,eaten:world.ecology.sim.eaten,interaction,following:followFish?.id??null,errors:renderer.info.programs?.filter(x=>x.diagnostics&&!x.diagnostics.runnable).length||0};}};
}
