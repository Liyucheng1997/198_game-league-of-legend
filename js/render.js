/* ============ 渲染：地形 / 单位 / 小地图 ============ */
"use strict";

const TEAM_COLOR = { blue:'#3b7dd8', red:'#d84a3b' };
const TEAM_COLOR_LIGHT = { blue:'#7fb3ff', red:'#ff9b8a' };

/* ---------- 地形预渲染 ---------- */
function buildTerrain(g){
  const size=1400, s=size/WORLD;
  const cv=document.createElement('canvas'); cv.width=cv.height=size;
  const ctx=cv.getContext('2d');
  // 底色（丛林深绿）
  ctx.fillStyle='#17281c'; ctx.fillRect(0,0,size,size);
  // 丛林噪点
  let seed=42; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  for(let i=0;i<900;i++){
    const x=rnd()*size,y=rnd()*size,r=6+rnd()*26;
    ctx.fillStyle = rnd()>0.5? 'rgba(30,60,38,.5)':'rgba(16,30,20,.55)';
    ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
  }
  // 河道
  ctx.strokeStyle='#1d4a5c'; ctx.lineWidth=560*s; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(1150*s,1150*s); ctx.lineTo(5850*s,5850*s); ctx.stroke();
  ctx.strokeStyle='#25617a'; ctx.lineWidth=380*s;
  ctx.beginPath(); ctx.moveTo(1150*s,1150*s); ctx.lineTo(5850*s,5850*s); ctx.stroke();
  ctx.strokeStyle='rgba(120,200,230,.15)'; ctx.lineWidth=140*s;
  ctx.beginPath(); ctx.moveTo(1200*s,1200*s); ctx.lineTo(5800*s,5800*s); ctx.stroke();
  // 三条路
  for(const lane of ['top','mid','bot']){
    const p=g.lanePaths[lane];
    for(const [w,col] of [[300,'#3a3f30'],[240,'#55523f'],[200,'#6b6750']]){
      ctx.strokeStyle=col; ctx.lineWidth=w*s; ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(p[0].x*s,p[0].y*s);
      for(const q of p) ctx.lineTo(q.x*s,q.y*s);
      ctx.stroke();
    }
  }
  // 基地高台
  for(const team of [TEAM_BLUE,TEAM_RED]){
    const n=NEXUS_POS[team];
    ctx.fillStyle= team===TEAM_BLUE? 'rgba(50,90,160,.35)':'rgba(160,60,50,.35)';
    ctx.beginPath(); ctx.arc(n.x*s,n.y*s,900*s,0,7); ctx.fill();
    const f=FOUNTAIN_POS[team];
    ctx.fillStyle= team===TEAM_BLUE? 'rgba(90,150,255,.5)':'rgba(255,120,100,.5)';
    ctx.beginPath(); ctx.arc(f.x*s,f.y*s,380*s,0,7); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.25)';
    ctx.beginPath(); ctx.arc(f.x*s,f.y*s,140*s,0,7); ctx.fill();
  }
  // 龙坑 / 男爵坑
  for(const [p,col] of [[DRAGON_POS,'rgba(200,140,60,.3)'],[BARON_POS,'rgba(160,80,220,.3)']]){
    ctx.fillStyle='#2c2c34';
    ctx.beginPath(); ctx.arc(p.x*s,p.y*s,320*s,0,7); ctx.fill();
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(p.x*s,p.y*s,260*s,0,7); ctx.fill();
  }
  // 边框
  ctx.strokeStyle='#0a1410'; ctx.lineWidth=16; ctx.strokeRect(0,0,size,size);
  g.terrain=cv; g.terrainScale=s;
}

/* ---------- 世界渲染 ---------- */
function renderWorld(g, ctx, cam){
  const W=ctx.canvas.width, H=ctx.canvas.height;
  ctx.fillStyle='#050805'; ctx.fillRect(0,0,W,H);
  ctx.save();
  ctx.translate(W/2, H/2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  // 地形
  const ts=WORLD/g.terrain.width;
  ctx.drawImage(g.terrain, 0,0, g.terrain.width,g.terrain.height, 0,0, WORLD, WORLD);

  const view = {x1:cam.x-W/2/cam.zoom-100, y1:cam.y-H/2/cam.zoom-100, x2:cam.x+W/2/cam.zoom+100, y2:cam.y+H/2/cam.zoom+100};
  const inView=u=>u.x>view.x1&&u.x<view.x2&&u.y>view.y1&&u.y<view.y2;
  const visible=u=> u.team===g.playerTeam || !u.team || u.visBlue;

  // 区域
  for(const z of g.zones){
    if(!inView(z)) continue;
    ctx.fillStyle=z.color; ctx.beginPath(); ctx.arc(z.x,z.y,z.r,0,7); ctx.fill();
    ctx.strokeStyle=z.color.replace(/[\d.]+\)$/,'0.8)'); ctx.lineWidth=2; ctx.stroke();
  }

  // 建筑
  for(const t of g.towers) if(!t.dead&&inView(t)) drawTower(ctx,g,t);
  for(const b of g.inhibs) if(inView(b)) drawInhib(ctx,g,b);
  for(const n of g.nexuses) if(inView(n)) drawNexus(ctx,g,n);

  // 野怪
  for(const m of g.monsters) if(!m.dead&&inView(m)) drawMonster(ctx,g,m);

  // 小兵
  for(const m of g.minions) if(!m.dead&&inView(m)&&visible(m)) drawMinion(ctx,g,m);

  // 英雄
  for(const c of g.champs) if(!c.dead&&inView(c)&&visible(c)) drawChamp(ctx,g,c);

  // 投射物
  for(const p of g.projectiles){
    if(!inView(p)) continue;
    ctx.save();
    ctx.shadowColor=p.color; ctx.shadowBlur=10;
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill();
    if(p.big){ ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=3; ctx.stroke(); }
    ctx.restore();
  }

  // 特效
  for(const e of g.effects) drawEffect(ctx,g,e);

  // 血条
  for(const t of g.towers) if(!t.dead&&inView(t)&&t.hp<t.maxHp) drawBar(ctx,g,t,70,7,-t.radius-26);
  for(const b of g.inhibs) if(!b.dead&&inView(b)&&b.hp<b.maxHp) drawBar(ctx,g,b,64,7,-b.radius-20);
  for(const n of g.nexuses) if(!n.dead&&inView(n)&&n.hp<n.maxHp) drawBar(ctx,g,n,90,8,-n.radius-24);
  for(const m of g.monsters) if(!m.dead&&inView(m)&&m.hp<m.maxHp) drawBar(ctx,g,m,80,7,-m.radius-18);
  for(const m of g.minions) if(!m.dead&&inView(m)&&visible(m)) drawBar(ctx,g,m,34,4,-m.radius-10);
  for(const c of g.champs) if(!c.dead&&inView(c)&&visible(c)) drawChampBar(ctx,g,c);

  ctx.restore();
}

function drawTower(ctx,g,t){
  const invul=!t.attackable;
  ctx.save();
  ctx.globalAlpha = invul? 0.75:1;
  // 底座
  ctx.fillStyle='#3a3a42'; ctx.beginPath(); ctx.arc(t.x,t.y,t.radius,0,7); ctx.fill();
  ctx.fillStyle='#55555f'; ctx.beginPath(); ctx.arc(t.x,t.y,t.radius-8,0,7); ctx.fill();
  // 塔身
  ctx.fillStyle='#71717d';
  ctx.beginPath(); ctx.arc(t.x,t.y-14,16,0,7); ctx.fill();
  // 水晶
  const col=TEAM_COLOR_LIGHT[t.team];
  ctx.shadowColor=col; ctx.shadowBlur=12;
  ctx.fillStyle=col;
  ctx.beginPath();
  ctx.moveTo(t.x,t.y-44); ctx.lineTo(t.x+9,t.y-26); ctx.lineTo(t.x,t.y-8); ctx.lineTo(t.x-9,t.y-26);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur=0;
  if(invul){
    ctx.fillStyle='rgba(255,255,255,.75)'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center';
    ctx.fillText('🛡',t.x,t.y+16);
  }
  ctx.restore();
}
function drawInhib(ctx,g,b){
  ctx.save();
  if(b.dead){
    ctx.fillStyle='#3a3a3a'; ctx.beginPath(); ctx.arc(b.x,b.y,b.radius,0,7); ctx.fill();
    ctx.fillStyle='#999'; ctx.font='12px sans-serif'; ctx.textAlign='center';
    ctx.fillText(Math.ceil(b.respawnAt-g.t)+'s', b.x, b.y+4);
  } else {
    const col=TEAM_COLOR_LIGHT[b.team];
    ctx.fillStyle='#44444c'; ctx.beginPath(); ctx.arc(b.x,b.y,b.radius,0,7); ctx.fill();
    const a=g.t*1.2;
    ctx.translate(b.x,b.y); ctx.rotate(a);
    ctx.shadowColor=col; ctx.shadowBlur=14;
    ctx.fillStyle=col; ctx.fillRect(-13,-13,26,26);
    ctx.rotate(Math.PI/4); ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillRect(-9,-9,18,18);
  }
  ctx.restore();
}
function drawNexus(ctx,g,n){
  if(n.dead) return;
  ctx.save();
  const col=TEAM_COLOR_LIGHT[n.team];
  const pulse=1+Math.sin(g.t*2)*0.06;
  ctx.fillStyle='#3c3c46'; ctx.beginPath(); ctx.arc(n.x,n.y,n.radius,0,7); ctx.fill();
  ctx.translate(n.x,n.y); ctx.rotate(g.t*0.6); ctx.scale(pulse,pulse);
  ctx.shadowColor=col; ctx.shadowBlur=24;
  ctx.fillStyle=col;
  ctx.beginPath(); ctx.moveTo(0,-34); ctx.lineTo(24,0); ctx.lineTo(0,34); ctx.lineTo(-24,0); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.6)';
  ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(12,0); ctx.lineTo(0,18); ctx.lineTo(-12,0); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawMonster(ctx,g,m){
  ctx.save();
  const col = m.kind==='baron'? '#b06bff':'#e8a04a';
  ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(m.x,m.y+m.radius*0.7,m.radius,m.radius*0.4,0,0,7); ctx.fill();
  ctx.shadowColor=col; ctx.shadowBlur=14;
  ctx.fillStyle=col; ctx.beginPath(); ctx.arc(m.x,m.y,m.radius,0,7); ctx.fill();
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.lineWidth=3; ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font=`bold ${m.radius}px "Microsoft YaHei",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(m.kind==='baron'?'爵':'龙', m.x, m.y+2);
  ctx.restore();
}
function drawMinion(ctx,g,m){
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(m.x,m.y+m.radius*0.7,m.radius*0.9,m.radius*0.35,0,0,7); ctx.fill();
  ctx.fillStyle=TEAM_COLOR[m.team];
  ctx.beginPath(); ctx.arc(m.x,m.y,m.radius,0,7); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.lineWidth=2; ctx.stroke();
  if(m.kind==='cannon'||m.kind==='super'){
    ctx.strokeStyle=m.kind==='super'?'#ffd75e':'#ddd'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(m.x,m.y,m.radius+3.5,0,7); ctx.stroke();
  }
  ctx.fillStyle='rgba(255,255,255,.85)';
  ctx.font=`${m.radius+1}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(m.ranged?'✦':'▲', m.x, m.y+1);
  ctx.restore();
}
function drawChamp(ctx,g,c){
  ctx.save();
  // 阴影
  ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(c.x,c.y+c.radius*0.8,c.radius,c.radius*0.4,0,0,7); ctx.fill();
  // 回城特效
  if(c.order.type==='recall'){
    const p=(g.t*2)%1;
    ctx.strokeStyle=`rgba(120,190,255,${0.9-p*0.7})`; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(c.x,c.y,c.radius+6+p*26,0,7); ctx.stroke();
  }
  // buff 光环
  const fxBuff=c.buffs.find(b=>b.fx);
  if(fxBuff){ ctx.strokeStyle=fxBuff.fx; ctx.lineWidth=3; ctx.globalAlpha=.7;
    ctx.beginPath(); ctx.arc(c.x,c.y,c.radius+5,0,7); ctx.stroke(); ctx.globalAlpha=1; }
  // 盖伦 E 旋转
  if(c.hasBuff('garenE')){
    ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(g.t*12);
    ctx.strokeStyle='rgba(230,230,255,.8)'; ctx.lineWidth=4;
    for(let i=0;i<3;i++){ ctx.rotate(Math.PI*2/3);
      ctx.beginPath(); ctx.moveTo(c.radius,0); ctx.lineTo(c.radius+90,0); ctx.stroke(); }
    ctx.restore();
  }
  // 本体
  const ring = c===g.player? '#f0d87a' : TEAM_COLOR[c.team];
  if(c.def.model==='landuo'){
    drawLanduoModel(ctx,g,c,ring);
    if(c.isStunned()) drawStunStars(ctx,g,c);
    ctx.restore();
    return;
  }
  ctx.strokeStyle=ring; ctx.lineWidth=3.5;
  ctx.fillStyle=c.def.color;
  ctx.beginPath(); ctx.arc(c.x,c.y,c.radius,0,7); ctx.fill(); ctx.stroke();
  // 朝向指示
  ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(c.x+Math.cos(c.faceAngle)*c.radius*0.5, c.y+Math.sin(c.faceAngle)*c.radius*0.5);
  ctx.lineTo(c.x+Math.cos(c.faceAngle)*(c.radius+6), c.y+Math.sin(c.faceAngle)*(c.radius+6));
  ctx.stroke();
  // 名字字
  ctx.fillStyle='#fff'; ctx.font=`bold ${c.radius}px "Microsoft YaHei",sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(c.def.char, c.x, c.y+1.5);
  // 眩晕星星
  if(c.isStunned()) drawStunStars(ctx,g,c);
  ctx.restore();
}

function drawStunStars(ctx,g,c){
  ctx.fillStyle='#ffe66e'; ctx.font='14px sans-serif'; ctx.textAlign='center';
  for(let i=0;i<3;i++){ const a=g.t*4+i*2.1; ctx.fillText('★', c.x+Math.cos(a)*16, c.y-c.radius-10+Math.sin(a)*4); }
}

/* ---------- 岚铎：程序化分件模型与动作 ---------- */
function drawLanduoModel(ctx,g,c,ring){
  const anim=c.heroAnim;
  let type='idle', p=0;
  if(anim && g.t<anim.start+anim.dur){ type=anim.type; p=Math.max(0,Math.min(1,(g.t-anim.start)/anim.dur)); }
  const moving=!anim || g.t>=anim.start+anim.dur ? (c.order.type==='move'||(c.order.type==='attack'&&c.atkTarget&&dist(c,c.atkTarget)>c.stat('range')+45)) : false;
  const walk=moving?Math.sin(g.t*11):0;
  const idle=Math.sin(g.t*2.4)*0.7;
  const jump=type==='r'?Math.sin(Math.PI*p)*34:0;
  const squash=type==='r'&&p>0.82?1-(p-0.82)*0.8:1;
  const attackSwing=type==='attack'?(-1.15+2.5*(1-Math.pow(1-p,2))):0;
  const qSwing=type==='q'?(-1.45+3.05*(p<0.72?(p/0.72):1)):0;
  const eLean=type==='e'?7*Math.sin(Math.PI*p):0;
  const wPulse=type==='w'?Math.sin(Math.PI*p):0;

  ctx.save();
  ctx.translate(c.x,c.y-jump);
  ctx.rotate(c.faceAngle+Math.PI/2);
  ctx.scale(1/squash,squash);
  ctx.translate(0,idle-eLean);

  // 选中环与铸火层数
  ctx.strokeStyle=ring; ctx.lineWidth=2.2; ctx.globalAlpha=.9;
  ctx.beginPath(); ctx.ellipse(0,8,27,15,0,0,7); ctx.stroke(); ctx.globalAlpha=1;
  for(let i=0;i<3;i++){
    const on=i<(c.forgeStacks||0), x=(i-1)*9;
    ctx.shadowColor=on?'#ffb43f':'transparent'; ctx.shadowBlur=on?9:0;
    ctx.fillStyle=on?'#ffc45a':'#24383a';
    ctx.beginPath(); ctx.moveTo(x,-43); ctx.lineTo(x+4,-37); ctx.lineTo(x,-33); ctx.lineTo(x-4,-37); ctx.closePath(); ctx.fill();
  }
  ctx.shadowBlur=0;

  // 短披风（身体后方）
  ctx.fillStyle='#11191b';
  ctx.beginPath(); ctx.moveTo(-15,1); ctx.lineTo(15,1); ctx.lineTo(12,28); ctx.lineTo(2,22+walk*2); ctx.lineTo(-8,30); ctx.closePath(); ctx.fill();

  // 双腿，奔跑时交替摆动
  drawLanduoLimb(ctx,-8,11+walk*5,-0.10-walk*.18);
  drawLanduoLimb(ctx,8,11-walk*5,0.10+walk*.18);

  // 躯干：青黑多边形胸甲
  ctx.fillStyle='#0b1719'; ctx.strokeStyle='#9c7a45'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(-19,8); ctx.lineTo(-16,-16); ctx.lineTo(-8,-27); ctx.lineTo(9,-27); ctx.lineTo(18,-14); ctx.lineTo(20,8); ctx.lineTo(0,18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#164d52';
  ctx.beginPath(); ctx.moveTo(-14,-14); ctx.lineTo(0,-23); ctx.lineTo(14,-13); ctx.lineTo(11,5); ctx.lineTo(0,12); ctx.lineTo(-12,4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#d6923a'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(0,-21); ctx.lineTo(-3,-8); ctx.lineTo(4,-2); ctx.lineTo(0,11); ctx.stroke();

  // 左侧堡垒肩甲与右肩，W 时外扩
  drawLanduoShoulder(ctx,-21-wPulse*3,-13,1.18+wPulse*.12,true);
  drawLanduoShoulder(ctx,18+wPulse*2,-14,.82+wPulse*.08,false);
  drawLanduoArm(ctx,-20-wPulse*5,-2, type==='w'?-0.55:-0.15-walk*.12, true);
  drawLanduoArm(ctx,18,0, type==='w'?0.65:0.18+walk*.12, false);

  // 头盔与熔金面窗
  ctx.fillStyle='#101b1d'; ctx.strokeStyle='#a98654'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(-9,-29); ctx.lineTo(-7,-41); ctx.lineTo(0,-46); ctx.lineTo(8,-40); ctx.lineTo(10,-28); ctx.lineTo(0,-23); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#ffbd45'; ctx.shadowColor='#ff9b2f'; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.moveTo(-6,-37); ctx.lineTo(0,-33); ctx.lineTo(7,-38); ctx.lineTo(5,-31); ctx.lineTo(0,-27); ctx.lineTo(-5,-31); ctx.closePath(); ctx.fill(); ctx.shadowBlur=0;
  ctx.strokeStyle='#42696b'; ctx.beginPath(); ctx.moveTo(0,-45); ctx.lineTo(0,-38); ctx.stroke();

  // 陨铁巨刃：普攻/Q 做完整横扫，E 贴地拖刃
  ctx.save();
  const bx=19, by=2;
  ctx.translate(bx,by);
  let bladeRot=.38+walk*.08;
  if(type==='attack') bladeRot=attackSwing;
  if(type==='q') bladeRot=qSwing;
  if(type==='e') bladeRot=1.18;
  if(type==='r') bladeRot=-0.15+p*.35;
  ctx.rotate(bladeRot);
  drawLanduoBlade(ctx,type==='q'?1.12:1);
  ctx.restore();

  // W 的正面能量壁
  if(type==='w'){
    ctx.globalAlpha=.25+.45*wPulse; ctx.fillStyle='#63d5c6'; ctx.strokeStyle='#ffd16a'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-30,-30); ctx.lineTo(30,-30); ctx.lineTo(25,-5); ctx.lineTo(0,8); ctx.lineTo(-25,-5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.globalAlpha=1;
  }
  ctx.restore();
}

function drawLanduoLimb(ctx,x,y,rot){
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
  ctx.fillStyle='#101719'; ctx.strokeStyle='#7c674b'; ctx.lineWidth=1.2;
  ctx.fillRect(-6,-2,12,17); ctx.strokeRect(-6,-2,12,17);
  ctx.fillStyle='#16464a'; ctx.beginPath(); ctx.moveTo(-8,9); ctx.lineTo(7,8); ctx.lineTo(9,18); ctx.lineTo(-9,18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawLanduoShoulder(ctx,x,y,s,bastion){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.fillStyle='#123c40'; ctx.strokeStyle='#a4804f'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(-10,7); ctx.lineTo(-12,-4); ctx.lineTo(-4,-12); ctx.lineTo(9,-8); ctx.lineTo(12,5); ctx.lineTo(4,11); ctx.closePath(); ctx.fill(); ctx.stroke();
  if(bastion){ ctx.fillStyle='#d58a35'; ctx.beginPath(); ctx.moveTo(-7,-3);ctx.lineTo(3,-8);ctx.lineTo(7,3);ctx.lineTo(0,7);ctx.closePath();ctx.fill(); }
  ctx.restore();
}
function drawLanduoArm(ctx,x,y,rot,left){
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
  ctx.fillStyle='#0d1719'; ctx.strokeStyle='#806b50'; ctx.lineWidth=1.1;
  ctx.beginPath(); ctx.roundRect(-5,-2,10,22,4); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#15474b'; ctx.fillRect(-7,8,14,10); ctx.strokeRect(-7,8,14,10);
  ctx.restore();
}
function drawLanduoBlade(ctx,s){
  ctx.scale(s,s);
  // 手柄沿局部 -Y，刀身向角色前方伸出
  ctx.strokeStyle='#2a2020'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(0,10); ctx.lineTo(0,-13); ctx.stroke();
  ctx.strokeStyle='#ba8748'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-9,-10); ctx.lineTo(9,-10); ctx.stroke();
  ctx.fillStyle='#172326'; ctx.strokeStyle='#9b7a4e'; ctx.lineWidth=1.7;
  ctx.beginPath(); ctx.moveTo(-9,-10); ctx.lineTo(-15,-47); ctx.lineTo(-8,-68); ctx.lineTo(10,-57); ctx.lineTo(14,-18); ctx.lineTo(7,-10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='#ef9a34'; ctx.shadowColor='#ff9d2e'; ctx.shadowBlur=6; ctx.lineWidth=2.3;
  ctx.beginPath(); ctx.moveTo(-7,-18); ctx.lineTo(2,-28); ctx.lineTo(-3,-42); ctx.lineTo(7,-55); ctx.stroke(); ctx.shadowBlur=0;
  ctx.fillStyle='#091113'; ctx.beginPath(); ctx.moveTo(4,-20);ctx.lineTo(8,-27);ctx.lineTo(7,-38);ctx.lineTo(1,-31);ctx.closePath();ctx.fill();
}

function drawBar(ctx,g,u,w,h,dy){
  const x=u.x-w/2, y=u.y+dy;
  const col = !u.team? '#c8a0ff' : u.team===g.playerTeam? '#3fb950':'#d64545';
  ctx.fillStyle='rgba(0,0,0,.7)'; ctx.fillRect(x-1,y-1,w+2,h+2);
  ctx.fillStyle=col; ctx.fillRect(x,y,w*Math.max(0,u.hp/u.maxHp),h);
}
function drawChampBar(ctx,g,c){
  const w=58,h=7, x=c.x-w/2, y=c.y-c.radius-22;
  // 等级框
  ctx.fillStyle='rgba(0,0,0,.8)'; ctx.fillRect(x-15,y-2.5,13,h+5);
  ctx.fillStyle='#f0d87a'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(c.level, x-8.5, y+h/2+0.5);
  // 名字
  ctx.fillStyle=c===g.player?'#f0d87a':(c.team===g.playerTeam?'#9fc8ef':'#ef9f9f');
  ctx.font='10px "Microsoft YaHei",sans-serif';
  ctx.fillText(c.name, c.x, y-8);
  // 血条
  ctx.fillStyle='rgba(0,0,0,.75)'; ctx.fillRect(x-1,y-1,w+2,h+2);
  const col = c===g.player? '#3fb950' : c.team===g.playerTeam? '#3f80c8':'#d64545';
  ctx.fillStyle=col; ctx.fillRect(x,y,w*Math.max(0,c.hp/c.maxHp),h);
  // 刻度
  ctx.fillStyle='rgba(0,0,0,.45)';
  for(let v=250;v<c.maxHp;v+=250) ctx.fillRect(x+w*v/c.maxHp,y,1,h);
  // 护盾
  const sh=c.shieldTotal();
  if(sh>0){ ctx.fillStyle='rgba(255,255,255,.85)';
    const sw=Math.min(w, w*sh/c.maxHp);
    ctx.fillRect(x+w*Math.max(0,c.hp/c.maxHp)-0.5, y, Math.min(sw, w-w*c.hp/c.maxHp+1), h); }
  // 蓝条
  if(c.maxMp>0){ ctx.fillStyle='rgba(0,0,0,.75)'; ctx.fillRect(x-1,y+h+1,w+2,4);
    ctx.fillStyle='#3f6fd8'; ctx.fillRect(x,y+h+1.5,w*Math.max(0,c.mp/c.maxMp),3); }
}

function drawEffect(ctx,g,e){
  const p=(g.t-e.t0)/e.dur; if(p>1) return;
  ctx.save();
  if(e.kind==='ring'){
    ctx.globalAlpha=1-p; ctx.strokeStyle=e.color; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r*(0.4+0.6*p),0,7); ctx.stroke();
  } else if(e.kind==='blast'){
    ctx.globalAlpha=(1-p)*0.9; ctx.fillStyle=e.color;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r*(0.5+0.5*p),0,7); ctx.fill();
  } else if(e.kind==='line'){
    ctx.globalAlpha=1-p*0.7; ctx.strokeStyle=e.color; ctx.lineWidth=e.w; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(e.x,e.y); ctx.lineTo(e.x2,e.y2); ctx.stroke();
  } else if(e.kind==='dash'){
    ctx.globalAlpha=1-p; ctx.strokeStyle=e.color; ctx.lineWidth=8; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(e.x,e.y); ctx.lineTo(e.x2,e.y2); ctx.stroke();
  } else if(e.kind==='cone'){
    ctx.globalAlpha=(1-p)*0.8; ctx.fillStyle=e.color;
    ctx.beginPath(); ctx.moveTo(e.x,e.y);
    ctx.arc(e.x,e.y,e.r,e.ang-e.spread,e.ang+e.spread); ctx.closePath(); ctx.fill();
  } else if(e.kind==='slash'){
    ctx.globalAlpha=1-p; ctx.strokeStyle=e.color; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(e.x,e.y,14,e.ang-1+p*2,e.ang+0.2+p*2); ctx.stroke();
  } else if(e.kind==='crit'){
    ctx.globalAlpha=1-p; ctx.fillStyle=e.color; ctx.font='bold 18px sans-serif'; ctx.textAlign='center';
    ctx.fillText('暴击!', e.x, e.y-30-p*20);
  } else if(e.kind==='sword'){
    ctx.globalAlpha=1-p; ctx.fillStyle=e.color; ctx.font='bold 46px sans-serif'; ctx.textAlign='center';
    ctx.fillText('⚔', e.x, e.y-20-p*40);
  } else if(e.kind==='levelup'){
    const u=e.unit;
    ctx.globalAlpha=1-p; ctx.strokeStyle=e.color; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(u.x,u.y,20+p*30,0,7); ctx.stroke();
    ctx.fillStyle=e.color; ctx.font='bold 14px sans-serif'; ctx.textAlign='center';
    ctx.fillText('升级!', u.x, u.y-40-p*15);
  } else if(e.kind==='click'){
    ctx.globalAlpha=1-p; ctx.strokeStyle=e.color; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(e.x,e.y,18*(1-p*0.6),0,7); ctx.stroke();
    ctx.beginPath(); ctx.arc(e.x,e.y,7,0,7); ctx.stroke();
  } else if(e.kind==='forgeSweep'){
    ctx.globalAlpha=(1-p)*.9; ctx.strokeStyle=e.color; ctx.lineWidth=e.empowered?18:12; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r*(.72+.22*p),e.ang-e.spread+p*.25,e.ang+e.spread+p*.25); ctx.stroke();
    ctx.globalAlpha=(1-p)*.55; ctx.strokeStyle='#ffe1a0'; ctx.lineWidth=3; ctx.stroke();
  } else if(e.kind==='bastion'){
    ctx.globalAlpha=(1-p)*.8; ctx.strokeStyle=e.color; ctx.lineWidth=6*(1-p)+2;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r*(.75+.3*p),0,7); ctx.stroke();
    for(let i=0;i<6;i++){ const a=i*Math.PI/3; ctx.beginPath(); ctx.moveTo(e.x+Math.cos(a)*35,e.y+Math.sin(a)*35); ctx.lineTo(e.x+Math.cos(a)*e.r,e.y+Math.sin(a)*e.r); ctx.stroke(); }
  } else if(e.kind==='forgeBurst'){
    ctx.globalAlpha=(1-p)*.75; ctx.strokeStyle=e.color; ctx.lineWidth=12*(1-p)+2;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r*(.15+.85*p),0,7); ctx.stroke();
  } else if(e.kind==='forgeDash'){
    ctx.globalAlpha=1-p; ctx.strokeStyle=e.color; ctx.lineWidth=18*(1-p)+5; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(e.x,e.y); ctx.lineTo(e.x2,e.y2); ctx.stroke();
    ctx.strokeStyle='#ffd38a'; ctx.lineWidth=3; ctx.stroke();
  } else if(e.kind==='leapTrail'){
    ctx.globalAlpha=(1-p)*.8; ctx.strokeStyle=e.color; ctx.lineWidth=5; ctx.setLineDash([10,8]);
    ctx.beginPath(); ctx.moveTo(e.x,e.y); ctx.quadraticCurveTo((e.x+e.x2)/2,(e.y+e.y2)/2-120,e.x2,e.y2); ctx.stroke();
  } else if(e.kind==='starCrater'){
    ctx.globalAlpha=(1-p)*.8; ctx.fillStyle=e.color;
    ctx.beginPath();
    for(let i=0;i<16;i++){ const a=i*Math.PI/8, r=i%2?e.r*(.45+.45*p):e.r*(.75+.25*p); const x=e.x+Math.cos(a)*r,y=e.y+Math.sin(a)*r; i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#ffe2a0';ctx.lineWidth=5;ctx.beginPath();ctx.arc(e.x,e.y,e.r*(.2+.65*p),0,7);ctx.stroke();
  }
  ctx.restore();
}

/* ---------- 小地图 ---------- */
function renderMinimap(g, ctx, cam, mainCanvas){
  const S=ctx.canvas.width, s=S/WORLD;
  ctx.clearRect(0,0,S,S);
  ctx.drawImage(g.terrain,0,0,g.terrain.width,g.terrain.height,0,0,S,S);
  ctx.fillStyle='rgba(0,0,10,.25)'; ctx.fillRect(0,0,S,S);
  // 建筑
  for(const t of g.towers){ if(t.dead) continue;
    ctx.fillStyle=TEAM_COLOR_LIGHT[t.team];
    ctx.fillRect(t.x*s-3,t.y*s-3,6,6);
    ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=1; ctx.strokeRect(t.x*s-3,t.y*s-3,6,6);
  }
  for(const b of g.inhibs){ if(b.dead) continue;
    ctx.save(); ctx.translate(b.x*s,b.y*s); ctx.rotate(Math.PI/4);
    ctx.fillStyle=TEAM_COLOR_LIGHT[b.team]; ctx.fillRect(-3.5,-3.5,7,7); ctx.restore();
  }
  for(const n of g.nexuses){ if(n.dead) continue;
    ctx.save(); ctx.translate(n.x*s,n.y*s); ctx.rotate(Math.PI/4);
    ctx.fillStyle=TEAM_COLOR_LIGHT[n.team]; ctx.fillRect(-5,-5,10,10);
    ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(-5,-5,10,10); ctx.restore();
  }
  // 野怪
  for(const m of g.monsters){ if(m.dead) continue;
    ctx.fillStyle= m.kind==='baron'? '#b06bff':'#e8a04a';
    ctx.beginPath(); ctx.arc(m.x*s,m.y*s,4,0,7); ctx.fill();
  }
  // 小兵（弱化点）
  for(const m of g.minions){
    if(m.dead) continue;
    if(m.team!==g.playerTeam && !m.visBlue) continue;
    ctx.fillStyle=TEAM_COLOR[m.team];
    ctx.fillRect(m.x*s-1,m.y*s-1,2.4,2.4);
  }
  // 英雄
  for(const c of g.champs){
    if(c.dead) continue;
    if(c.team!==g.playerTeam && !c.visBlue) continue;
    ctx.beginPath(); ctx.arc(c.x*s,c.y*s,c===g.player?5.5:4.8,0,7);
    ctx.fillStyle=c.def.color; ctx.fill();
    ctx.lineWidth=1.8;
    ctx.strokeStyle = c===g.player? '#fff' : TEAM_COLOR_LIGHT[c.team];
    ctx.stroke();
  }
  // 相机视野框
  const vw=mainCanvas.width/cam.zoom*s, vh=mainCanvas.height/cam.zoom*s;
  ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1;
  ctx.strokeRect(cam.x*s-vw/2, cam.y*s-vh/2, vw, vh);
}
