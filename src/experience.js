// A touch is a water gesture only after movement, or after a completed tap.
// The second finger cancels the candidate before either can deform the water.
export class TouchIntent {
  constructor(){this.clear();}
  begin(id,x,y,hit){this.pending={id,x,y,hit};}
  move(id,x,y){const p=this.pending;if(!p||p.id!==id||Math.hypot(x-p.x,y-p.y)<8)return null;this.clear();return p;}
  end(id,cancelled=false){const p=this.pending;this.clear();return !cancelled&&p?.id===id?p:null;}
  clear(){this.pending=null;}
}
export class AdaptiveQuality {
  constructor(mobile,dpr=1){this.mobile=mobile;this.dpr=dpr;this.mode='auto';this.ratio=this.ceiling;this.low=0;this.high=0;}
  get ceiling(){return Math.min(this.dpr,this.mode==='eco'?1:this.mode==='high'?2:this.mobile?1.4:1.65);}
  setMode(mode){this.mode=['auto','eco','high'].includes(mode)?mode:'auto';this.ratio=this.ceiling;this.low=this.high=0;return this.ratio;}
  sample(fps){if(this.mode!=='auto')return false;this.low=fps<32?this.low+1:0;this.high=fps>53?this.high+1:0;const old=this.ratio;if(this.low>=4){this.ratio=Math.max(.7,this.ratio*.84);this.low=0;this.high=0;}else if(this.high>=12){this.ratio=Math.min(this.ceiling,this.ratio+.1);this.high=0;}return Math.abs(old-this.ratio)>.001;}
}
