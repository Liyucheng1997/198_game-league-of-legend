/* Deterministic, renderer-independent dodge simulation. Distances are game units. */
'use strict';
const DODGE_KITS = [
  {id:'lux',name:'光之束缚',key:'q',kind:'shot',speed:1200,range:1175,r:70,wind:.25,color:'#ffe497'},
  {id:'ahri',name:'魅惑妖术',key:'e',kind:'shot',speed:1550,range:975,r:60,wind:.25,color:'#ff83bc'},
  {id:'ashe',name:'万箭齐发',key:'w',kind:'fan',speed:2000,range:1200,r:20,wind:.25,color:'#9ce8ff'},
  {id:'caitlyn',name:'和平使者',key:'q',kind:'shot',speed:2200,range:1300,r:90,wind:.625,color:'#e3b3f4'},
  {id:'soraka',name:'流星坠落',key:'q',kind:'circle',r:235,wind:.75,color:'#d3b5ff'},
  {id:'malphite',name:'势不可挡',key:'r',kind:'dash',r:200,speed:1835,wind:.25,color:'#ddbd7b'},
  {id:'annie',name:'焚烧',key:'w',kind:'cone',range:600,spread:.55,wind:.4,color:'#ff9257'},
  {id:'darius',name:'大杀四方',key:'q',kind:'ring',r:460,inner:220,wind:.75,color:'#ff707b'},
  {id:'garen',name:'审判 · 范围脱离',key:'e',kind:'spin',r:325,wind:.65,duration:3,color:'#f8d57b'},
  {id:'yi',name:'高原血统 · 拉开距离',key:'r',kind:'chase',r:125,wind:.7,duration:3,color:'#c9f48a'},
];
function dodgeSegment(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(px-ax-t*dx,py-ay-t*dy);}
class DodgeSession {
  constructor({hero='ahri',speed=330,difficulty='standard',opponent='all',random=Math.random}={}){
    Object.assign(this,{t:0,hero,speed,difficulty,opponent,random,score:0,combo:0,bestCombo:0,hits:0,dodged:0,castCount:0,nextCast:2,shots:[],casts:[],actors:[],feedback:'右键移动，离开危险区域',feedbackUntil:3,paused:false,over:false,flashReady:0});
    this.player={id:'dodge-player',def:{id:hero},x:0,y:0,radius:50,faceAngle:0,order:{type:'stop'}};
    this.limit=780;this.duration=90;this.maxHits=10;
  }
  move(x,y){const d=Math.hypot(x,y),s=Math.min(1,(this.limit-this.player.radius)/(d||1));this.target={x:x*s,y:y*s};this.player.order={type:'move'};}
  flash(x,y){if(this.over||this.paused||this.t<this.flashReady)return false;const p=this.player,a=Math.atan2(y-p.y,x-p.x),d=Math.min(400,Math.hypot(x-p.x,y-p.y));this.move(p.x+Math.cos(a)*d,p.y+Math.sin(a)*d);Object.assign(p,this.target);this.target=null;p.order={type:'stop'};this.flashReady=this.t+15;return true;}
  spawn(){
    const pool=this.opponent==='all'?DODGE_KITS:DODGE_KITS.filter(k=>k.id===this.opponent),kit=pool[this.castCount%pool.length];
    const p=this.player;let a=this.random()*Math.PI*2;const near=['cone','ring','spin','chase'].includes(kit.kind),distance=near?(kit.kind==='cone'?420:kit.kind==='chase'?330:300):850;
    if(Math.hypot(p.x+Math.cos(a)*distance,p.y+Math.sin(a)*distance)>1050)a=Math.atan2(-p.y,-p.x);
    const actor={id:'caster-'+this.castCount,def:{id:kit.id},x:p.x+Math.cos(a)*distance,y:p.y+Math.sin(a)*distance,faceAngle:a+Math.PI,order:{type:'stop'}};
    const wind=kit.wind+(this.difficulty==='beginner'?.35:0),cast={kit,actor,aim:{x:p.x,y:p.y},angle:a+Math.PI,start:this.t,fire:this.t+wind,hit:false,done:false,fired:false,near:false};
    actor.heroAnim={type:kit.key,start:this.t,dur:wind};this.casts.push(cast);this.castCount++;
    this.feedback=actor.def.id==='yi'?'易：保持距离，Q 点名不可走位躲避':CHAMP_LABEL(kit);this.feedbackUntil=this.t+wind+1;
  }
  hit(c){if(c.hit)return;c.hit=true;this.hits++;this.combo=0;this.feedback='命中 · '+c.kit.name;this.feedbackUntil=this.t+.9;this.hitUntil=this.t+.18;}
  settle(c){if(c.done)return;c.done=true;if(!c.hit){this.dodged++;this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);const points=100+Math.min(200,(this.combo-1)*10)+(c.near?50:0);this.score+=points;this.feedback=(c.near?'擦边躲避':'成功躲避')+' +'+points;this.feedbackUntil=this.t+.8;}}
  update(dt){
    if(this.paused||this.over)return;
    // Fixed substeps keep moving-player / fast-projectile collision frame independent.
    for(let remain=Math.min(.25,Math.max(0,dt));remain>1e-8;){const step=Math.min(1/120,remain);this.step(step);remain-=step;if(this.over)break;}
  }
  step(dt){
    this.t+=dt;const p=this.player,old={x:p.x,y:p.y};
    if(this.target){const dx=this.target.x-p.x,dy=this.target.y-p.y,d=Math.hypot(dx,dy),step=this.speed*dt;p.faceAngle=Math.atan2(dy,dx);if(d<=step){Object.assign(p,this.target);this.target=null;p.order={type:'stop'};}else{p.x+=dx/d*step;p.y+=dy/d*step;}}
    if(this.t>=this.nextCast&&this.t<this.duration-4){this.spawn();const interval=this.difficulty==='beginner'?3.4:this.difficulty==='expert'?1.65:2.5;this.nextCast=this.t+Math.max(1.15,interval-this.t/180);}
    for(const c of this.casts){
      if(c.done)continue;const k=c.kit,a=c.actor;
      if(!c.fired&&this.t>=c.fire){c.fired=true;
        if(k.kind==='shot'||k.kind==='fan'){const n=k.kind==='fan'?9:1;for(let i=0;i<n;i++){const angle=c.angle+(n>1?(i/(n-1)-.5)*.8:0);this.shots.push({c,x:a.x,y:a.y,dx:Math.cos(angle),dy:Math.sin(angle),travel:0});}}
        else if(['circle','ring','cone'].includes(k.kind)){const center=k.kind==='circle'?c.aim:a,d=Math.hypot(p.x-center.x,p.y-center.y);let hit=d<=(k.r||k.range)+p.radius;
          if(k.kind==='cone'){const angle=Math.atan2(p.y-a.y,p.x-a.x),diff=Math.abs(Math.atan2(Math.sin(angle-c.angle),Math.cos(angle-c.angle)));hit=hit&&diff<=k.spread+Math.asin(Math.min(1,p.radius/Math.max(1,d)));}
          // Darius inner handle still hits in the real game; do not award a dodge inside it.
          if(hit)this.hit(c);c.expire=this.t+.3;
        }else c.expire=this.t+(k.duration||Math.hypot(c.aim.x-a.x,c.aim.y-a.y)/k.speed);
      }
      if(c.fired&&['spin','chase','dash'].includes(k.kind)){
        const target=k.kind==='dash'?c.aim:p,dx=target.x-a.x,dy=target.y-a.y,d=Math.hypot(dx,dy),speed=k.kind==='dash'?k.speed:k.kind==='chase'?this.speed*.88:this.speed*.62,step=Math.min(d,speed*dt);
        a.faceAngle=Math.atan2(dy,dx);a.x+=dx/(d||1)*step;a.y+=dy/(d||1)*step;a.order={type:'move'};
        if(k.kind!=='dash'&&Math.hypot(p.x-a.x,p.y-a.y)<=k.r+p.radius)this.hit(c);
        if(k.kind==='dash'&&this.t>=c.expire&&Math.hypot(p.x-c.aim.x,p.y-c.aim.y)<=k.r+p.radius)this.hit(c);
      }
      if(c.expire&&this.t>=c.expire)this.settle(c);
    }
    for(const s of this.shots){if(s.dead)continue;const k=s.c.kit,step=Math.min(k.speed*dt,k.range-s.travel),x=s.x+s.dx*step,y=s.y+s.dy*step;
      const d=dodgeSegment(0,0,s.x-old.x,s.y-old.y,x-p.x,y-p.y);if(d<k.r+p.radius+35)s.c.near=true;if(d<=k.r+p.radius)this.hit(s.c);
      s.x=x;s.y=y;s.travel+=step;if(s.travel>=k.range-.001)s.dead=true;
    }
    this.shots=this.shots.filter(s=>!s.dead);
    for(const c of this.casts)if(c.fired&&!c.expire&&!this.shots.some(s=>s.c===c))this.settle(c);
    this.casts=this.casts.filter(c=>!c.done||this.t<(c.expire||c.fire)+.5);
    if(this.t>=this.duration||this.hits>=this.maxHits)this.over=true;
  }
}
function CHAMP_LABEL(k){return k.name+' · '+k.key.toUpperCase();}
if(typeof module!=='undefined')module.exports={DodgeSession,DODGE_KITS,dodgeSegment};
