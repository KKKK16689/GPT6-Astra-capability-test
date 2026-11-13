// Fixed-step elastic shallow surface. Heights AND velocities are state variables.
// Tension uses the spatial Laplacian; bending uses -∇⁴h. The island is a
// no-flux obstacle, the square perimeter is reflective, and volume drift is removed.
export const SIZE = 12.8, HALF = SIZE / 2, BASE = -3.85;
export function terrainHeight(x,z) {
  const a = Math.atan2((z+.45)/2.7,(x+.45)/3.25);
  const r = Math.hypot((x+.45)/3.25,(z+.45)/2.7) / (1+.075*Math.sin(3*a+.4)+.04*Math.cos(5*a));
  const shelf = .30*Math.exp(-((x-3.7)**2+(z+2.5)**2)/5);
  const sand = .10*Math.sin(x*1.1+z*.6)*Math.cos(z*1.6)+.045*Math.sin(x*3.8-z*2.1);
  return -3.32+4.14*Math.exp(-1.12*r**4)+shelf+sand;
}
export class OceanPhysics {
  constructor(n=89,seed=7381) {
    this.n=n; this.dx=SIZE/(n-1); this.count=n*n; this.seed=seed;
    this.h=new Float32Array(this.count); this.v=new Float32Array(this.count);
    this.lap=new Float32Array(this.count); this.wet=new Uint8Array(this.count);
    this.depth=new Float32Array(this.count); this.active=[];
    this.shear={x:0,z:0,vx:0,vz:0}; this.drag=null; this.elapsed=0; this.gust=0;
    for(let j=0;j<n;j++) for(let i=0;i<n;i++) {
      const k=j*n+i,d=-terrainHeight(i*this.dx-HALF,j*this.dx-HALF);
      this.depth[k]=d; this.wet[k]=d>.035?1:0; if(this.wet[k])this.active.push(k);
    }
  }
  random(){let t=this.seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
  value(a,i,j,center){return i<0||i>=this.n||j<0||j>=this.n||!this.wet[j*this.n+i]?center:a[j*this.n+i];}
  impulse(x,z,strength=.8,radius=.48) {
    const n=this.n,dx=this.dx; let total=0;
    const imin=Math.max(0,Math.floor((x+HALF-radius*3)/dx)), imax=Math.min(n-1,Math.ceil((x+HALF+radius*3)/dx));
    const jmin=Math.max(0,Math.floor((z+HALF-radius*3)/dx)), jmax=Math.min(n-1,Math.ceil((z+HALF+radius*3)/dx));
    for(let j=jmin;j<=jmax;j++)for(let i=imin;i<=imax;i++){
      const k=j*n+i;if(!this.wet[k])continue;
      const q=((i*dx-HALF-x)**2+(j*dx-HALF-z)**2)/(radius*radius);
      const dv=strength*(1-q*.5)*Math.exp(-q*.5); this.v[k]+=dv; total+=dv;
    }
    const mean=total/this.active.length;for(const k of this.active)this.v[k]-=mean;
  }
  sample(x,z) {
    const u=Math.max(0,Math.min(this.n-1.001,(x+HALF)/this.dx)),w=Math.max(0,Math.min(this.n-1.001,(z+HALF)/this.dx));
    const i=Math.floor(u),j=Math.floor(w),a=u-i,b=w-j,k=j*this.n;
    return (this.h[k+i]*(1-a)+this.h[k+i+1]*a)*(1-b)+(this.h[k+this.n+i]*(1-a)+this.h[k+this.n+i+1]*a)*b;
  }
  step(dt,p) {
    this.elapsed+=dt; this.gust-=dt;
    if(p.wind>.001&&this.gust<=0){
      this.gust=.09+this.random()*.26;
      const x=(this.random()*2-1)*HALF,z=(this.random()*2-1)*HALF;
      this.impulse(x,z,(this.random()-.37)*p.wind*p.strength*.9,.30+this.random()*.48);
    }
    const n=this.n,inv=1/(this.dx*this.dx),c2=2.0+p.elasticity*5.8;
    const bend=.0018+p.elasticity*.0022,damp=.52+(1-p.elasticity)*.65;
    const {h,v,lap}=this;
    for(const k of this.active){
      const i=k%n,j=(k/n)|0,a=h[k];
      lap[k]=(this.value(h,i-1,j,a)+this.value(h,i+1,j,a)+this.value(h,i,j-1,a)+this.value(h,i,j+1,a)-4*a)*inv;
    }
    let meanH=0,meanV=0;
    for(const k of this.active){
      const i=k%n,j=(k/n)|0,l=lap[k];
      const bih=(this.value(lap,i-1,j,l)+this.value(lap,i+1,j,l)+this.value(lap,i,j-1,l)+this.value(lap,i,j+1,l)-4*l)*inv;
      const shallow=Math.min(1,Math.max(.18,this.depth[k]/.65));
      let acc=c2*shallow*l-bend*bih-(.42+1.5*p.elasticity)*h[k]-damp*v[k];
      if(this.drag){
        const d=this.drag,q=((i*this.dx-HALF-d.x)**2+(j*this.dx-HALF-d.z)**2)/.40;
        if(q<15)acc+=(d.height-h[k])*58*Math.exp(-q)-v[k]*3*Math.exp(-q);
      }
      v[k]+=acc*dt; v[k]=Math.max(-9,Math.min(9,v[k]));
      h[k]+=v[k]*dt;
      if(h[k]>.95){h[k]=.95;v[k]*=-.2;}if(h[k]<-.95){h[k]=-.95;v[k]*=-.2;}
      meanH+=h[k];meanV+=v[k];
    }
    meanH/=this.active.length;meanV/=this.active.length;
    for(const k of this.active){h[k]-=meanH;v[k]-=meanV;}
    const s=this.shear,stiff=6+p.elasticity*13;
    s.vx+=(-stiff*s.x-2.3*s.vx)*dt;s.vz+=(-stiff*s.z-2.3*s.vz)*dt;
    s.x+=s.vx*dt;s.z+=s.vz*dt;
    s.x=Math.max(-.35,Math.min(.35,s.x));s.z=Math.max(-.35,Math.min(.35,s.z));
  }
  energy(){let e=0;for(const k of this.active)e+=this.h[k]**2+this.v[k]**2*.15;return e/this.active.length;}
  reset(){this.h.fill(0);this.v.fill(0);this.lap.fill(0);Object.assign(this.shear,{x:0,z:0,vx:0,vz:0});this.drag=null;this.gust=0;}
}
