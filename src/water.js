import * as T from 'three';
import {HALF,SIZE,BASE,terrainHeight} from './physics.js';

export function createWater(scene,physics,shared){
  const n=physics.n,count=n*n;
  const waveBytes=new Uint8Array(count*4),causticBytes=new Uint8Array(count*4),energy=new Float32Array(count);
  const waveTex=new T.DataTexture(waveBytes,n,n,T.RGBAFormat),causticTex=new T.DataTexture(causticBytes,n,n,T.RGBAFormat);
  for(const tex of[waveTex,causticTex]){tex.minFilter=tex.magFilter=T.LinearFilter;tex.wrapS=tex.wrapT=T.ClampToEdgeWrapping;tex.generateMipmaps=false;}
  shared.wave.value=waveTex;shared.caustic.value=causticTex;
  const group=new T.Group();scene.add(group);
  const rt=new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true});
  rt.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  const reflection=new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true});
  const uniforms={uScene:{value:rt.texture},uDepth:{value:rt.depthTexture},uReflection:{value:reflection.texture},uResolution:{value:new T.Vector2(1,1)},uInvProjection:{value:new T.Matrix4()},uCameraWorld:{value:new T.Matrix4()},uReflectionMatrix:{value:new T.Matrix4()},uClarity:{value:.82},uDay:shared.day,uSunset:{value:0},uWave:shared.wave,uSun:{value:new T.Vector3(-.45,.82,.35).normalize()},uTop:{value:1}};
  const vertex=`varying vec3 vWorld;varying vec3 vNormal;varying vec4 vReflect;uniform mat4 uReflectionMatrix;
    void main(){vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;vNormal=normalize(mat3(modelMatrix)*normal);vReflect=uReflectionMatrix*vec4(w.x,0.0,w.z,1.0);gl_Position=projectionMatrix*viewMatrix*w;}`;
  const fragment=`precision highp float;
    uniform sampler2D uScene,uDepth,uReflection,uWave;uniform vec2 uResolution;
    uniform mat4 uInvProjection,uCameraWorld,projectionMatrix;uniform float uClarity,uDay,uSunset,uTop;uniform vec3 uSun;
    varying vec3 vWorld,vNormal;varying vec4 vReflect;
    vec3 sceneWorld(vec2 uv){float z=texture2D(uDepth,uv).x;vec4 p=uInvProjection*vec4(uv*2.0-1.0,z*2.0-1.0,1.0);return(uCameraWorld*vec4(p.xyz/p.w,1.0)).xyz;}
    vec3 sky(vec3 d){float t=smoothstep(-.3,.9,d.y);vec3 c=mix(vec3(.42,.65,.62),vec3(.64,.80,.78),t);c=mix(c,vec3(.92,.63,.40),uSunset*(1.0-t)*.28);return mix(vec3(.027,.072,.091),c,uDay);}
    void main(){
      vec2 uv=gl_FragCoord.xy/uResolution;vec3 N=normalize(vNormal);vec3 V=normalize(cameraPosition-vWorld);if(dot(N,V)<0.0)N=-N;
      float facing=clamp(dot(N,V),0.0,1.0);float fresnel=.0204+.9796*pow(1.0-facing,5.0);
      vec3 refr=refract(-V,N,1.0/1.333);
      vec3 bounds=vec3(${HALF.toFixed(1)},0.1,${HALF.toFixed(1)}),lo=vec3(-${HALF.toFixed(1)},${BASE.toFixed(2)},-${HALF.toFixed(1)});
      vec3 safeDir=sign(refr)*max(abs(refr),vec3(.0001));vec3 exits=mix((lo-vWorld)/safeDir,(bounds-vWorld)/safeDir,step(vec3(0.),refr));
      float travel=max(.05,min(exits.x,min(exits.y,exits.z)));
      float behind=length(sceneWorld(uv)-vWorld);float path=min(travel,behind);
      vec4 projected=projectionMatrix*viewMatrix*vec4(vWorld+refr*path,1.0);vec2 refrUV=projected.xy/projected.w*.5+.5;
      refrUV=mix(uv,refrUV,.65);refrUV=clamp(refrUV,vec2(.002),vec2(.998));
      vec3 sw=sceneWorld(refrUV);if(length(sw-cameraPosition)<length(vWorld-cameraPosition)-.1)refrUV=uv;
      vec3 background=texture2D(uScene,refrUV).rgb;
      float density=.65+(1.0-uClarity)*4.5;vec3 extinction=vec3(.23,.066,.055)*density;
      vec3 transmittance=exp(-extinction*path);vec3 scatter=mix(vec3(.008,.06,.085),vec3(.055,.42,.40),uDay);
      vec3 transmitted=background*transmittance+scatter*(1.0-transmittance)*.68;
      vec3 R=reflect(-V,N),reflected=sky(R);
      if(uTop>.5&&vReflect.w>0.0&&cameraPosition.y>0.0){vec2 ruv=vReflect.xy/vReflect.w+N.xz*.022;if(all(greaterThan(ruv,vec2(.002)))&&all(lessThan(ruv,vec2(.998))))reflected=mix(reflected,texture2D(uReflection,ruv).rgb,.90);}
      vec3 color=mix(transmitted,reflected,min(.85,fresnel));
      vec3 H=normalize(V+uSun);float spec=pow(max(dot(N,H),0.0),210.0)*2.6+pow(max(dot(N,H),0.0),28.0)*.06;
      color+=vec3(1.0,.91,.72)*spec*(.06+uDay)*(.3+fresnel);
      vec4 wave=texture2D(uWave,vWorld.xz/${SIZE.toFixed(1)}+.5);
      float rim=0.0;if(uTop>.5){float edge=min(${HALF.toFixed(1)}-abs(vWorld.x),${HALF.toFixed(1)}-abs(vWorld.z));rim=(1.0-smoothstep(.0,.035,edge))*.07;}
      else rim=exp(-abs(vWorld.y-(wave.r-.5)*2.0)/.027)*.10;
      float foam=uTop*smoothstep(.72,1.0,wave.a)*.20;
      color+=vec3(.5,.80,.71)*(rim+foam)*(.2+uDay);
      gl_FragColor=vec4(color,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const material=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms,side:T.FrontSide});
  const geometry=new T.BufferGeometry(),positions=new Float32Array(count*3),normals=new Float32Array(count*3),indices=[];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const k=j*n+i;positions[k*3]=i*physics.dx-HALF;positions[k*3+2]=j*physics.dx-HALF;normals[k*3+1]=1;
    if(i<n-1&&j<n-1)indices.push(k,k+n,k+1,k+1,k+n,k+n+1);
  }
  geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('normal',new T.BufferAttribute(normals,3).setUsage(T.DynamicDrawUsage));geometry.setIndex(indices);geometry.boundingSphere=new T.Sphere(new T.Vector3(),11);
  const top=new T.Mesh(geometry,material);top.renderOrder=10;group.add(top);
  const sideMat=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{...uniforms,uTop:{value:0}},side:T.FrontSide});
  const sides=[];
  for(let edge=0;edge<4;edge++){
    const levels=10,ps=new Float32Array(n*(levels+1)*3),ind=[];
    for(let j=0;j<levels;j++)for(let i=0;i<n-1;i++){const k=j*n+i;ind.push(k,k+n,k+1,k+1,k+n,k+n+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(ps,3).setUsage(T.DynamicDrawUsage));g.setIndex(ind);g.boundingSphere=new T.Sphere(new T.Vector3(0,-1.8,0),11);
    const mesh=new T.Mesh(g,sideMat);mesh.renderOrder=11;group.add(mesh);sides.push({edge,g,ps,levels});
  }
  const mirrorCamera=new T.PerspectiveCamera(),reflectionClip=new T.Plane(new T.Vector3(0,1,0),-.015),bias=new T.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  const target=new T.Vector3();let reflected=false;
  const sx=new Float32Array(count),sz=new Float32Array(count);
  let refresh=3;
  function update(frame=0){
    const {h,dx,shear}=physics;
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const k=j*n+i,x=i*dx-HALF,z=j*dx-HALF,blend=T.MathUtils.smoothstep(Math.hypot(x,z),1.9,5.9);
      const gx=(h[j*n+Math.min(n-1,i+1)]-h[j*n+Math.max(0,i-1)])/(dx*(i===0||i===n-1?1:2));
      const gz=(h[Math.min(n-1,j+1)*n+i]-h[Math.max(0,j-1)*n+i])/(dx*(j===0||j===n-1?1:2));sx[k]=gx;sz[k]=gz;
      positions[k*3]=x+shear.x*blend;positions[k*3+1]=h[k];positions[k*3+2]=z+shear.z*blend;
      const inv=1/Math.hypot(gx,1,gz);normals[k*3]=-gx*inv;normals[k*3+1]=inv;normals[k*3+2]=-gz*inv;
      waveBytes[k*4]=T.MathUtils.clamp(128+h[k]*127,0,255);waveBytes[k*4+1]=T.MathUtils.clamp(128+gx*100,0,255);waveBytes[k*4+2]=T.MathUtils.clamp(128+gz*100,0,255);waveBytes[k*4+3]=T.MathUtils.clamp(Math.abs(physics.lap[k])*3,0,255);
    }
    geometry.attributes.position.needsUpdate=geometry.attributes.normal.needsUpdate=true;waveTex.needsUpdate=true;
    for(const side of sides){
      const{ps,g,edge,levels}=side;
      for(let j=0;j<=levels;j++)for(let i=0;i<n;i++){
        const t=i*dx-HALF,f=1-j/levels;let x,z,k;
        if(edge===0){x=t;z=HALF;k=(n-1)*n+i;}if(edge===1){x=-t;z=-HALF;k=n-1-i;}if(edge===2){x=HALF;z=-t;k=(n-1-i)*n+n-1;}if(edge===3){x=-HALF;z=t;k=i*n;}
        const q=(j*n+i)*3,bend=Math.sin(Math.PI*f)*h[k]*.055;ps[q]=x+shear.x*f*f+(edge===2?bend:edge===3?-bend:0);ps[q+1]=BASE+(h[k]-BASE)*f;ps[q+2]=z+shear.z*f*f+(edge===0?bend:edge===1?-bend:0);
      }
      g.attributes.position.needsUpdate=true;g.computeVertexNormals();
    }
    // Refract a grid of light rays through the current surface. Bilinear splats
    // deposit irradiance at seabed intersections; focusing produces the caustics.
    if(frame%refresh===0){
      energy.fill(0);const sun=uniforms.uSun.value,eta=1/1.333;
      for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){
        const k=j*n+i;if(!physics.wet[k])continue;const ni=1/Math.hypot(sx[k],1,sz[k]),nx=-sx[k]*ni,ny=ni,nz=-sz[k]*ni;
        const dot=-(nx*sun.x+ny*sun.y+nz*sun.z),a=eta*dot+Math.sqrt(Math.max(0,1-eta*eta*(1-dot*dot)));
        const rx=-sun.x*eta-a*nx,ry=-sun.y*eta-a*ny,rz=-sun.z*eta-a*nz;
        const depth=physics.depth[k]+physics.h[k],travel=depth/Math.max(.15,-ry),x=i+rx*travel/dx,z=j+rz*travel/dx;
        const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;if(ix<0||ix>=n-1||iz<0||iz>=n-1)continue;
        const q=iz*n+ix;energy[q]+=(1-fx)*(1-fz);energy[q+1]+=fx*(1-fz);energy[q+n]+=(1-fx)*fz;energy[q+n+1]+=fx*fz;
      }
      for(let j=0;j<n;j++)for(let i=0;i<n;i++){
        const k=j*n+i,blur=(energy[k]*4+(energy[k-1]||0)+(energy[k+1]||0)+(energy[k-n]||0)+(energy[k+n]||0))/8;
        const e=Math.max(0,Math.min(1,(blur-.55)*.58));const c=Math.round(e*255);
        causticBytes[k*4]=causticBytes[k*4+1]=causticBytes[k*4+2]=c;causticBytes[k*4+3]=255;
      }causticTex.needsUpdate=true;
    }
  }
  function resize(w,h,ratio){rt.setSize(Math.max(1,Math.floor(w*ratio)),Math.max(1,Math.floor(h*ratio)));reflection.setSize(Math.max(1,Math.floor(w*ratio*.55)),Math.max(1,Math.floor(h*ratio*.55)));uniforms.uResolution.value.set(w*ratio,h*ratio);reflected=false;}
  function render(renderer,camera,frame,cursor){
    uniforms.uInvProjection.value.copy(camera.projectionMatrixInverse);uniforms.uCameraWorld.value.copy(camera.matrixWorld);
    group.visible=false;const cursorVisible=cursor.visible;cursor.visible=false;
    renderer.setRenderTarget(rt);renderer.render(scene,camera);
    if(!reflected||frame%refresh===0){
      mirrorCamera.copy(camera);mirrorCamera.position.y=-camera.position.y;camera.getWorldDirection(target);target.add(camera.position);target.y=-target.y;mirrorCamera.up.set(0,-1,0);mirrorCamera.lookAt(target);mirrorCamera.updateMatrixWorld();
      uniforms.uReflectionMatrix.value.copy(bias).multiply(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);
      renderer.clippingPlanes=[reflectionClip];renderer.setRenderTarget(reflection);renderer.render(scene,mirrorCamera);renderer.clippingPlanes=[];reflected=true;
    }
    group.visible=true;cursor.visible=cursorVisible;renderer.setRenderTarget(null);renderer.render(scene,camera);
  }
  update(0);return{setQuality(level){refresh=level==='eco'?6:level==='high'?2:3;reflected=false;},group,top,uniforms,update,render,resize,rt,reflection};
}
