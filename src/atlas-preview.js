import * as T from 'three';
import {fishPartGeometries,bendShark} from './ecology.js';
export function createAtlasPreview(host){
 let renderer=null,scene=null,camera=null,model=null,parts=null,species=null,frame=0,open=false,start=0;
 function clear(){if(model){model.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});scene.remove(model);model=null;}}
 function draw(now){
  if(!open)return;frame=requestAnimationFrame(draw);if(document.hidden)return;
  const t=(now-start)/1000,w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
  if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  model.rotation.y=.8+Math.sin(t*.3)*.45;
  if(species.behavior==='shark'){bendShark(parts.body.geometry,t);bendShark(parts.tail.geometry,t);}else parts.tail.rotation.y=Math.sin(t*7)*.25;
  parts.left.rotation.z=-Math.sin(t*4)*.2;parts.right.rotation.z=Math.sin(t*4)*.2;
  renderer.render(scene,camera);
 }
 return{
  show(s){
   species=s;
   try{
    if(!renderer){renderer=new T.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.domElement.setAttribute('aria-label','当前鱼类的实时三维模型预览');host.replaceChildren(renderer.domElement);scene=new T.Scene();scene.add(new T.HemisphereLight('#efffff','#69887a',2.5));const light=new T.DirectionalLight('#fff4db',3);light.position.set(3,4,6);scene.add(light);camera=new T.PerspectiveCamera(35,1,.01,30);}
    clear();const g=fishPartGeometries(s),mat=()=>new T.MeshStandardMaterial({color:s.accent,side:T.DoubleSide,roughness:.45});model=new T.Group();
    parts={body:new T.Mesh(g.body,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.45})),tail:new T.Mesh(g.tail,mat()),left:new T.Mesh(g.fin,mat()),right:new T.Mesh(g.fin.clone(),mat())};
    parts.left.position.set(-s.w*.8,-s.h*.15,s.behavior==='shark'?.3:.03);parts.left.scale.x=-1;parts.right.position.set(s.w*.8,-s.h*.15,s.behavior==='shark'?.3:.03);
    Object.values(parts).forEach(p=>model.add(p));scene.add(model);const radius=s.behavior==='shark'?4.7:Math.max(s.l*5,s.h*5);camera.position.set(radius*.8,radius*.3,radius*.65);camera.lookAt(0,0,-s.l*.2);
    cancelAnimationFrame(frame);open=true;start=performance.now();frame=requestAnimationFrame(draw);
   }catch{host.textContent='当前浏览器无法创建模型预览，请在海洋中观察。';}
  },close(){open=false;cancelAnimationFrame(frame);clear();}
 };
}
