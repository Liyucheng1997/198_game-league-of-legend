/* Authentic terrain raster and 3D champion composition, with procedural unit/effect fallbacks. */
'use strict';
const RIFT_IMAGES={};
const RIFT_MAP_IMAGE=new Image();
RIFT_MAP_IMAGE.src='assets/map/summoners-rift-2024.webp';
const RIFT_MAP_READY=RIFT_MAP_IMAGE.decode();
RIFT_MAP_READY.catch(()=>{});
for(const c of CHAMPIONS){const img=new Image();img.src=c.portrait;RIFT_IMAGES[c.id]=img;}
function poly(ctx,pts,fill,stroke,width=1){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function ellipse(ctx,x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function strokePath(ctx,pts,width,color){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.stroke();}
buildTerrain=function(g){
  const size=2800,s=size/WORLD,cv=document.createElement('canvas');cv.width=cv.height=size;const ctx=cv.getContext('2d');ctx.scale(s,s);
  let seed=1124;const rnd=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
  ctx.fillStyle='#203c2d';ctx.fillRect(0,0,WORLD,WORLD);
  for(let i=0;i<24000;i++){const x=rnd()*WORLD,y=rnd()*WORLD;ellipse(ctx,x,y,3+rnd()*28,2+rnd()*14,['#294632','#34543a','#1b3429','#385639'][Math.floor(rnd()*4)]);}
  // Broad river banks, shallows and small ripples, with diagonal jungle crossings.
  const river=[[770,990],[1320,1560],[2120,2170],[2800,2900],[3500,3500],[4200,4100],[4880,4830],[5680,5440],[6230,6010]];
  strokePath(ctx,river,660,'#253f37');strokePath(ctx,river,510,'#426452');strokePath(ctx,river,420,'#2e6b71');strokePath(ctx,river,300,'#275864');strokePath(ctx,river,180,'#285563');
  for(let i=0;i<180;i++){const t=rnd(),x=1000+t*5000+(rnd()-.5)*200,y=1000+t*5000+(rnd()-.5)*200;strokePath(ctx,[[x-15,y],[x+25,y+4]],1.6,'#7fbaa535');}
  // Paths to jungle camps: wide enough to walk around terrain islands.
  for(const c of JUNGLE_CAMPS){const dst=c.side==='red'?NEXUS_POS.red:NEXUS_POS.blue;const mid={x:(c.x+3500)/2,y:(c.y+3500)/2};strokePath(ctx,[[c.x,c.y],[mid.x,mid.y]],165,'#3e5036');ellipse(ctx,c.x,c.y,180,140,'#475c3d');ellipse(ctx,c.x,c.y,145,110,'#566046');}
  for(const lane of Object.values(g.lanePaths)){
    const pts=lane.map(p=>[p.x,p.y]);strokePath(ctx,pts,380,'#29452f');strokePath(ctx,pts,315,'#546242');strokePath(ctx,pts,265,'#747651');strokePath(ctx,pts,218,'#828161');
    for(let j=0;j<pts.length-1;j++){const a=pts[j],b=pts[j+1],d=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let k=0;k<d;k+=40){const t=k/d,x=a[0]+(b[0]-a[0])*t+(rnd()-.5)*150,y=a[1]+(b[1]-a[1])*t+(rnd()-.5)*150;poly(ctx,[[x-17,y-10],[x+19,y-11],[x+23,y+4],[x+2,y+12],[x-19,y+7]],rnd()>.5?'#7a7c5c':'#8c8a68','#656b50',1.5);}}
  }
  // Base plazas and fountains use engraved stone paving.
  for(const team of ['blue','red']){
    const n=NEXUS_POS[team],f=FOUNTAIN_POS[team];ctx.save();ctx.beginPath();ctx.arc(n.x,n.y,880,0,7);ctx.clip();ctx.fillStyle='#4b5954';ctx.fillRect(n.x-900,n.y-900,1800,1800);
    for(let y=n.y-900;y<n.y+900;y+=78)for(let x=n.x-900;x<n.x+900;x+=108){poly(ctx,[[x,y],[x+102,y-5],[x+106,y+70],[x+2,y+74]],['#56655f','#627068','#69766b','#5a6b64'][Math.floor(rnd()*4)],'#344b43',4);}
    ctx.restore();ctx.strokeStyle='#869182';ctx.lineWidth=14;ctx.beginPath();ctx.arc(n.x,n.y,850,0,7);ctx.stroke();ctx.strokeStyle='#304a41';ctx.lineWidth=12;ctx.beginPath();ctx.arc(n.x,n.y,815,0,7);ctx.stroke();
    ellipse(ctx,f.x,f.y,265,265,'#334b52');ctx.strokeStyle=team==='blue'?'#6bb4c3':'#b88079';ctx.lineWidth=10;ctx.beginPath();ctx.arc(f.x,f.y,247,0,7);ctx.stroke();
    for(let i=0;i<8;i++){const a=i*Math.PI/4;strokePath(ctx,[[f.x+Math.cos(a)*120,f.y+Math.sin(a)*120],[f.x+Math.cos(a)*220,f.y+Math.sin(a)*220]],4,'#728f87');}
    ellipse(ctx,f.x,f.y,110,110,team==='blue'?'#447f8a':'#896359');
  }
  // Dragon and Baron pits: open entry faces the river.
  for(const [p,col] of [[DRAGON_POS,'#ad8e55'],[BARON_POS,'#8e79a8']]){
    ellipse(ctx,p.x,p.y,265,250,'#253d39');ellipse(ctx,p.x,p.y,208,185,'#1d3d49');
    for(let i=0;i<15;i++){const a=i/15*Math.PI*1.65+.7,x=p.x+Math.cos(a)*245,y=p.y+Math.sin(a)*230;poly(ctx,[[x-42,y+5],[x-37,y-48],[x+13,y-67],[x+52,y-20],[x+40,y+28],[x-8,y+40]],'#526561','#87907a',3);}
    ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,150,0,7);ctx.stroke();
  }
  // Impassable rock faces and conifer canopy. Every silhouette comes from the collision polygons.
  for(const w of RIFT_WALLS){
    poly(ctx,w.points.map(([x,y])=>[x+24,y+38]),'#102b2399');poly(ctx,w.points,'#3a4d43','#152e25',18);poly(ctx,w.points.map(([x,y])=>[x,y-18]),'#4f6252','#7c8265',6);
    for(let i=0;i<32;i++){const x=w.minX+rnd()*(w.maxX-w.minX),y=w.minY+rnd()*(w.maxY-w.minY);if(!inPolygon(x,y,w.points))continue;const r=28+rnd()*42;
      ellipse(ctx,x+12,y+23,r*.9,r*.5,'#152d2580');strokePath(ctx,[[x,y+12],[x,y-r*.8]],7,'#354639');
      for(let k=0;k<3;k++)poly(ctx,[[x-r*(1-k*.19),y-k*r*.5],[x,y-r*1.5-k*r*.4],[x+r*(1-k*.19),y-k*r*.5]],['#254a35','#2e5b3b','#477049'][k],'#203f2e',1);
    }
    for(let i=0;i<w.points.length;i++){const [x,y]=w.points[i];strokePath(ctx,[[x-12,y],[x+5,y+15],[x-2,y+35]],3,'#243f34');}
  }
  for(const b of RIFT_BRUSH){ellipse(ctx,b.x,b.y,b.r,b.r*.7,'#41612b');for(let i=0;i<110;i++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*b.r,x=b.x+Math.cos(a)*r,y=b.y+Math.sin(a)*r*.7;strokePath(ctx,[[x-6,y+7],[x-3,y-12],[x+3,y-28-rnd()*12]],2+rnd()*2,['#668a3b','#8c9b4e','#3e6631'][Math.floor(rnd()*3)]);}}
  for(const c of JUNGLE_CAMPS){ctx.font='13px "Microsoft YaHei"';ctx.textAlign='center';ctx.fillStyle='#c7cca984';ctx.fillText(c.name,c.x,c.y+103);}
  ctx.strokeStyle='#10281e';ctx.lineWidth=55;ctx.strokeRect(0,0,WORLD,WORLD);
  g.terrain=cv;g.terrainScale=s;
};

function drawRiftFog(g,ctx){
  if(g.training&&g.practiceReveal||g.t<g.revealUntil[g.playerTeam])return;
  if(!g.fogCanvas){g.fogCanvas=document.createElement('canvas');g.fogCanvas.width=g.fogCanvas.height=700;}
  if(g.t>=(g.fogNext||0)){
    g.fogNext=g.t+.12;const fc=g.fogCanvas.getContext('2d'),s=.1;fc.globalCompositeOperation='source-over';fc.clearRect(0,0,700,700);fc.fillStyle='rgba(0,8,18,.69)';fc.fillRect(0,0,700,700);fc.globalCompositeOperation='destination-out';
    for(const u of g.visionSources?.[g.playerTeam]||[]){const grad=fc.createRadialGradient(u.x*s,u.y*s,u.r*s*.7,u.x*s,u.y*s,u.r*s);grad.addColorStop(0,'rgba(0,0,0,1)');grad.addColorStop(1,'rgba(0,0,0,0)');fc.fillStyle=grad;fc.beginPath();fc.arc(u.x*s,u.y*s,u.r*s,0,7);fc.fill();}
    fc.globalCompositeOperation='source-over';
  }
  ctx.drawImage(g.fogCanvas,0,0,WORLD,WORLD);
}
function drawRiftDetails(g,ctx){
  for(const w of g.wards){if(w.scout||w.team!==g.playerTeam)continue;ellipse(ctx,w.x,w.y,12,7,'#142c21');strokePath(ctx,[[w.x,w.y],[w.x,w.y-22]],5,'#91895a');ellipse(ctx,w.x,w.y-25,9,6,'#84d6a4');}
  const c=g.player;if(c.dead)return;
  if(typeof attackMoveArmed!=='undefined'&&attackMoveArmed){ctx.strokeStyle='#edcf8760';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(c.x,c.y,c.stat('range')+c.radius,0,7);ctx.stroke();}
  if(c.order.type==='move'||c.order.type==='attackmove'){const path=c._nav?.points||[];if(path.length){ctx.save();ctx.strokeStyle='#c9dc9755';ctx.lineWidth=2;ctx.setLineDash([6,9]);ctx.beginPath();ctx.moveTo(c.x,c.y);path.forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();ctx.restore();}}
}
function drawRiftChampion(ctx,g,c,ringColor){
  if(window.RiftModels?.draw(ctx,g,c)){ctx.save();ellipse(ctx,c.x,c.y+8,25,10,'#09221b45');ctx.strokeStyle=ringColor;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(c.x,c.y+6,26,12,0,0,7);ctx.stroke();ctx.restore();return;}
  const id=c.def.id,moving=c.order?.type==='move'||c.order?.type==='attackmove'||c.order?.type==='attack'&&dist(c,c.order.unit)>c.stat('range');
  const walk=moving?Math.sin(g.t*12):0,anim=c.heroAnim,active=anim&&g.t<anim.start+anim.dur,p=active?(g.t-anim.start)/anim.dur:0,swing=active?Math.sin(p*Math.PI)*.8:0;
  ctx.save();ctx.translate(c.x,c.y);ctx.globalAlpha=c.untargetable?.38:1;
  ellipse(ctx,5,16,30,12,'#06181788');ctx.strokeStyle=ringColor;ctx.lineWidth=c===g.player?2.5:1.3;ctx.beginPath();ctx.ellipse(0,10,27,16,0,0,7);ctx.stroke();
  ctx.scale(1.25,1.25);ctx.translate(0,-10);const facing=Math.cos(c.faceAngle)<0?-1:1;ctx.scale(facing,1);
  if(id==='malphite'){
    poly(ctx,[[-25,6],[-35,-6],[-32,-27],[-13,-35],[0,-47],[16,-32],[33,-20],[36,4],[19,15],[10,25],[-9,25]],'#7c7960','#363f34',3);
    for(const [x,y,r] of [[-22,-14,13],[19,-13,16],[0,-23,14],[-12,14,9],[15,14,10]])poly(ctx,[[x-r,y],[x-r*.7,y-r],[x+3,y-r-5],[x+r,y-2],[x+r*.6,y+r],[x-4,y+r]],'#aaa082','#535c47',2);
    strokePath(ctx,[[-6,-27],[-1,-24]],3,'#d8f590');strokePath(ctx,[[7,-27],[12,-24]],3,'#d8f590');ctx.restore();return;
  }
  if(id==='ahri'){
    for(let i=0;i<9;i++){const a=-2.4+i*.24+Math.sin(g.t*2+i)*.04;ctx.save();ctx.rotate(a);ctx.fillStyle=i%2?'#f1e7e7':'#d8c9d7';ctx.beginPath();ctx.moveTo(-5,5);ctx.bezierCurveTo(-30,22,-23,57,2,51);ctx.bezierCurveTo(-3,35,18,20,5,7);ctx.fill();ctx.restore();}
  }
  const robes=['lux','ahri','soraka','annie','caitlyn'].includes(id),cloth={garen:'#235b9f',darius:'#8c2837',ashe:'#345785',caitlyn:'#643f84',ahri:'#be424f',lux:'#c2bf91',annie:'#bb3978',yi:'#576841',soraka:'#9675b0'}[id];
  if(['garen','darius','ashe'].includes(id))poly(ctx,[[-16,-12],[13,-12],[22+walk*2,26],[2,32],[-22,24]],cloth,'#193144',1.5);
  strokePath(ctx,[[-7,9],[-8+walk*2,24+walk*3]],9,'#303c47');strokePath(ctx,[[7,9],[9-walk*2,24-walk*3]],9,'#303c47');ellipse(ctx,-8+walk*2,26+walk*3,7,4,'#555d68');ellipse(ctx,9-walk*2,26-walk*3,7,4,'#555d68');
  if(robes)poly(ctx,[[-10,-10],[10,-10],[15,19],[-15,19]],cloth,'#d7c29e',1.2);else poly(ctx,[[-14,-12],[13,-12],[12,10],[0,17],[-12,10]],'#667889','#c9bf95',2);
  const bulky=id==='garen'||id==='darius';if(bulky){poly(ctx,[[-11,-16],[-24,-16],[-27,-3],[-13,0]],id==='garen'?'#a4b4bf':'#727b89','#d4c4a0',2);poly(ctx,[[12,-16],[24,-15],[26,-2],[13,0]],'#8294a5','#c9bd9f',2);}
  strokePath(ctx,[[-14,-9],[-19,-2+walk]],7,robes?'#e0b49d':'#697c90');strokePath(ctx,[[13,-9],[19+swing*5,3-swing*18]],7,robes?'#e2bea4':'#768391');
  ellipse(ctx,0,-23,9,11,id==='soraka'?'#b08dbd':'#e4bda1');
  const hair={garen:'#6e5741',darius:'#292d32',ashe:'#d4e1e0',caitlyn:'#4a3159',ahri:'#272b40',lux:'#e1c763',annie:'#b54558',yi:'#959549',soraka:'#cddac9'}[id];
  ellipse(ctx,0,-30,10,7,hair);poly(ctx,[[-10,-30],[-9,-18],[-5,-27],[8,-28],[10,-18],[10,-31]],hair);
  if(id==='ashe'){poly(ctx,[[-15,-20],[-15,-31],[0,-40],[16,-31],[15,-20],[7,-31],[-6,-31]],'#3c668d','#a1c4d9',1.3);}
  if(id==='caitlyn'){ellipse(ctx,0,-32,17,4,'#4e345e');poly(ctx,[[-10,-32],[-8,-48],[9,-48],[11,-32]],'#62416f','#b0a070',1.5);strokePath(ctx,[[-9,-35],[10,-35]],3,'#aa865e');}
  if(id==='ahri'){poly(ctx,[[-9,-31],[-13,-45],[-2,-36]],'#292a3b','#e0b6ca');poly(ctx,[[4,-36],[13,-44],[10,-30]],'#292a3b','#e0b6ca');}
  if(id==='yi'){poly(ctx,[[-10,-33],[0,-42],[11,-33],[10,-18],[-9,-18]],'#989054','#d8cc8d',1.5);for(let i=-1;i<=1;i++){ellipse(ctx,i*5,-26,2.5,3,'#c3f48a');}}
  if(id==='soraka'){poly(ctx,[[-2,-34],[1,-51],[5,-32]],'#ece1a8');}
  ctx.save();ctx.translate(18,0);ctx.rotate(-swing*.6);
  switch(c.def.weapon){
    case 'sword':case 'katana':strokePath(ctx,[[0,12],[4,-6]],5,'#bd945a');poly(ctx,[[1,-6],[4,-52],[9,-61],[10,-6]],'#dae5e4','#7d949b',1);strokePath(ctx,[[-5,-7],[14,-6]],4,'#cfb474');break;
    case 'axe':strokePath(ctx,[[0,21],[5,-44]],6,'#715d4d');poly(ctx,[[5,-42],[24,-51],[31,-40],[25,-22],[4,-28]],'#99a6ae','#d7dad0',2);poly(ctx,[[4,-42],[-7,-47],[-15,-32],[3,-29]],'#748697');break;
    case 'bow':ctx.strokeStyle='#a9e0ed';ctx.lineWidth=4;ctx.beginPath();ctx.arc(-6,-4,28,-1.25,1.3);ctx.stroke();strokePath(ctx,[[3,-30],[3,23]],1.3,'#e7e9df');strokePath(ctx,[[-8,-4],[37,-4]],2,'#b7dbef');poly(ctx,[[37,-4],[29,-9],[29,1]],'#d9f5ff');break;
    case 'rifle':ctx.rotate(-.65);strokePath(ctx,[[0,17],[0,-45]],6,'#71615f');strokePath(ctx,[[0,-26],[0,-48]],3,'#bcc5c8');ellipse(ctx,0,-13,7,3,'#c2a46e');break;
    case 'staff':case 'crescent':strokePath(ctx,[[0,23],[0,-47]],4,'#cbb981');if(c.def.weapon==='crescent'){ctx.strokeStyle='#e5d693';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-48,12,.3,Math.PI*1.8);ctx.stroke();}else{poly(ctx,[[0,-58],[8,-46],[0,-33],[-8,-46]],'#b7e8e4','#f4e1af',2);}break;
    case 'orb':ctx.shadowColor='#88e9f1';ctx.shadowBlur=14;ellipse(ctx,4,-8+Math.sin(g.t*3)*3,10,10,'#a3e8eb');ellipse(ctx,2,-12,4,4,'#ecffff');break;
    case 'fire':ctx.shadowColor='#ff9a44';ctx.shadowBlur=15;poly(ctx,[[0,0],[-8,-10],[-3,-25],[4,-15],[6,-32],[13,-12],[10,0]],'#ffae4f');ellipse(ctx,4,-5,4,7,'#fff0b4');break;
  }
  ctx.restore();ctx.restore();
}
const legacyDrawChamp=drawChamp;
drawChamp=function(ctx,g,c){
  if(c.def.model!=='rift'){legacyDrawChamp(ctx,g,c);return;}
  drawRiftChampion(ctx,g,c,c===g.player?'#d7d690':TEAM_COLOR_LIGHT[c.team]);
  if(c.hasBuff('garenE')){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(g.t*11);ctx.strokeStyle='#ead498bb';ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,115,0,Math.PI*1.55);ctx.stroke();ctx.restore();}
  if(c.order.type==='recall'){ctx.strokeStyle='#85ddff';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(c.x,c.y+8,36+Math.sin(g.t*3)*4,22,0,0,7);ctx.stroke();}
  if(c.shieldTotal()>0){ctx.strokeStyle='#b6dcdb99';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(c.x,c.y-20,36,50,0,0,7);ctx.stroke();}
  if(c.isStunned())drawStunStars(ctx,g,c);
  if(c.isSilenced()){ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillStyle='#e4cce4';ctx.fillText('沉默',c.x,c.y-70);}
  if(c.buffs.some(b=>b.charm)){ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fc8dbe';ctx.fillText('♥',c.x,c.y-70);}
  if(c.def.id==='annie'&&(c.annieStack||0)>=4){ctx.strokeStyle='#eebae5';ctx.lineWidth=2;ctx.beginPath();ctx.arc(c.x,c.y,33,0,7);ctx.stroke();}
  for(const b of c.buffs.filter(b=>b.stacks)){ctx.font='bold 12px sans-serif';ctx.fillStyle='#ff7575';ctx.textAlign='center';ctx.fillText('●'.repeat(b.stacks),c.x,c.y+40);}
};
drawMinion=function(ctx,g,m){
  ctx.save();ctx.translate(m.x,m.y);ellipse(ctx,3,7,14,7,'#09241a77');const col=m.team==='blue'?'#4588b2':'#ba5950',light=m.team==='blue'?'#8cb6c5':'#dca083';
  if(m.kind==='cannon'){poly(ctx,[[-18,4],[-13,-11],[14,-11],[20,4],[10,12],[-11,12]],'#6c7d72','#2b443c',2);ellipse(ctx,-14,7,6,6,'#a99a75');ellipse(ctx,14,7,6,6,'#a99a75');strokePath(ctx,[[0,-1],[Math.cos(m.faceAngle)*23,Math.sin(m.faceAngle)*23-6]],9,col);}
  else{poly(ctx,[[-9,-8],[8,-8],[12,11],[-12,11]],col,'#293d37',1.5);ellipse(ctx,0,-11,8,8,light);poly(ctx,[[-9,-13],[0,-22],[9,-13]],col,light,1);if(m.ranged){strokePath(ctx,[[11,10],[13,-17]],3,'#c4ad7b');ellipse(ctx,13,-17,4,4,m.team==='blue'?'#b1eaff':'#ffcebc');}else{poly(ctx,[[8,-4],[13,-20],[18,-24],[17,-3]],'#c2c9b7');ellipse(ctx,-10,1,7,9,col);}}
  if(m.hasBuff('baronMinion')){ctx.strokeStyle='#b492db';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,22,0,7);ctx.stroke();}ctx.restore();
};
drawTower=function(ctx,g,t){
  ctx.save();ctx.translate(t.x,t.y);const col=TEAM_COLOR_LIGHT[t.team];ellipse(ctx,10,17,50,22,'#122b2788');ellipse(ctx,0,5,47,28,'#4c625e');ellipse(ctx,0,0,40,25,'#8a9687');poly(ctx,[[-25,0],[-21,-42],[-14,-73],[15,-73],[25,-42],[27,0],[1,14]],'#697e7a','#3b5554',3);poly(ctx,[[-15,-8],[-11,-52],[0,-62],[13,-52],[15,-8],[0,0]],'#96a396');
  poly(ctx,[[-13,-42],[-30,-60],[-26,-78],[-12,-60]],'#a8b0a0','#4a6563',2);poly(ctx,[[13,-42],[30,-60],[26,-78],[12,-60]],'#a8b0a0','#4a6563',2);ellipse(ctx,0,-78,14,12,'#6c8580');ctx.shadowColor=col;ctx.shadowBlur=12;poly(ctx,[[0,-112],[13,-93],[0,-74],[-13,-93]],col,'#c3e7df',1.5);ctx.shadowBlur=0;
  if(!t.attackable){ctx.strokeStyle='#a3cedb70';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,-45,43,68,0,0,7);ctx.stroke();}
  ctx.restore();
};
drawNexus=function(ctx,g,n){if(n.dead)return;ctx.save();ctx.translate(n.x,n.y);const col=TEAM_COLOR_LIGHT[n.team];ellipse(ctx,0,10,78,46,'#364e4b');ellipse(ctx,0,0,70,38,'#8c977f');ellipse(ctx,0,-7,55,30,'#495e55');ctx.shadowColor=col;ctx.shadowBlur=24;poly(ctx,[[0,-102],[33,-56],[22,-14],[0,9],[-25,-15],[-35,-58]],col,'#d2e4d6',2);poly(ctx,[[0,-102],[0,9],[-25,-15],[-35,-58]],n.team==='blue'?'#3076b0':'#b45057');poly(ctx,[[0,-102],[33,-56],[22,-14],[9,-23]],n.team==='blue'?'#a6eff9':'#ffc2bb');ctx.restore();};
drawMonster=function(ctx,g,m){
  ctx.save();ctx.translate(m.x,m.y);ellipse(ctx,6,16,m.radius+10,m.radius*.5,'#09231d77');
  if(m.kind==='dragon'){
    const flap=Math.sin(g.t*2)*12;poly(ctx,[[-8,-20],[-68,-54-flap],[-91,-20],[-51,-26],[-30,8]],'#8a7950','#354b42',3);poly(ctx,[[8,-20],[68,-54-flap],[91,-20],[51,-26],[30,8]],'#b2a16a','#354b42',3);ellipse(ctx,0,-5,24,39,'#ada16c');strokePath(ctx,[[0,20],[13,44],[30,49]],10,'#817b50');poly(ctx,[[-16,-30],[0,-62],[17,-31],[10,-13],[-10,-13]],'#c5af75','#61724f',2);ellipse(ctx,-6,-41,3,3,'#ffdc76');ellipse(ctx,7,-41,3,3,'#ffdc76');
  }else if(m.kind==='baron'){
    strokePath(ctx,[[-28,19],[18,17],[28,-10],[2,-34],[6,-85]],35,'#85719d');strokePath(ctx,[[-24,17],[15,15],[21,-9],[0,-32],[5,-79]],20,'#b3a0b7');poly(ctx,[[-15,-71],[-23,-102],[-6,-93],[8,-116],[17,-93],[33,-106],[25,-76]],'#9c86b2','#524c74',2);ellipse(ctx,3,-81,4,4,'#ecdda6');ellipse(ctx,18,-81,4,4,'#ecdda6');
  }else if(m.kind==='blue'||m.kind==='krugs'){
    for(const [x,y,r] of [[-22,0,17],[19,0,19],[-12,20,12],[15,22,12],[0,-16,25]])poly(ctx,[[x-r,y],[x-r*.5,y-r],[x+r*.7,y-r*.6],[x+r,y+r*.4],[x,y+r]],m.kind==='blue'?'#607f83':'#888c73','#3b5548',2);ellipse(ctx,0,-15,10,12,m.kind==='blue'?'#73daf9':'#c1bd85');
  }else if(m.kind==='red'){
    strokePath(ctx,[[-8,14],[-29,27]],10,'#726048');strokePath(ctx,[[8,14],[29,27]],10,'#726048');ellipse(ctx,0,-4,29,31,'#836a44');poly(ctx,[[-20,-15],[-29,-41],[-10,-27],[0,-47],[12,-26],[30,-39],[21,-14]],'#6d753b');ellipse(ctx,0,-4,13,16,'#cf8f44');ellipse(ctx,0,-7,7,9,'#ffd482');
  }else if(m.kind==='gromp'){ellipse(ctx,0,0,34,25,'#777493');ellipse(ctx,-20,-13,10,12,'#938eaa');ellipse(ctx,20,-13,10,12,'#938eaa');ellipse(ctx,-20,-16,3,3,'#e2d8a8');ellipse(ctx,20,-16,3,3,'#e2d8a8');strokePath(ctx,[[-19,8],[0,13],[19,8]],3,'#4c536a');}
  else if(m.kind==='wolves'){ellipse(ctx,0,-3,23,13,'#8d9c9a');poly(ctx,[[12,-12],[32,-10],[24,2],[10,6]],'#b2bbb0');poly(ctx,[[11,-12],[13,-28],[20,-12]],'#8d9c9a');strokePath(ctx,[[-16,0],[-22,20]],7,'#747f7d');strokePath(ctx,[[9,1],[15,20]],7,'#747f7d');strokePath(ctx,[[-17,-5],[-35,-16]],7,'#969f99');}
  else if(m.kind==='raptors'){ellipse(ctx,0,0,21,23,'#9d7264');poly(ctx,[[-16,0],[-35,-16],[-25,8]],'#bc8f77');poly(ctx,[[16,0],[35,-16],[25,8]],'#bc8f77');poly(ctx,[[0,-22],[12,-17],[0,-10]],'#d9b56c');}
  else {ellipse(ctx,0,0,25,16,'#7a9270');for(let i=-1;i<=1;i++){strokePath(ctx,[[-15,i*10],[-30,i*15]],4,'#a1ae81');strokePath(ctx,[[15,i*10],[30,i*15]],4,'#a1ae81');}}
  ctx.restore();
};
function drawPet(ctx,g,p){ctx.save();ctx.translate(p.x,p.y);ellipse(ctx,0,20,32,15,'#11241a77');ctx.shadowColor='#f48b34';ctx.shadowBlur=12;ellipse(ctx,0,0,28,32,'#8f5330');ellipse(ctx,-24,0,12,24,'#a4663d');ellipse(ctx,24,0,12,24,'#a4663d');ellipse(ctx,0,-29,23,21,'#bd814e');ellipse(ctx,-18,-46,9,9,'#c68a53');ellipse(ctx,18,-46,9,9,'#c68a53');ellipse(ctx,-8,-31,4,4,'#ffde92');ellipse(ctx,8,-31,4,4,'#ffde92');ellipse(ctx,0,-21,7,5,'#442c27');ctx.restore();drawBar(ctx,g,p,65,5,-70);}
const originalDrawEffect=drawEffect;
drawEffect=function(ctx,g,e){if(e.kind==='damage'){const p=(g.t-e.t0)/e.dur;ctx.save();ctx.globalAlpha=1-p;ctx.fillStyle=e.color;ctx.strokeStyle='#101b20';ctx.lineWidth=3;ctx.textAlign='center';ctx.font='bold 16px sans-serif';ctx.strokeText(e.amount,e.x,e.y-35*p);ctx.fillText(e.amount,e.x,e.y-35*p);ctx.restore();return;}originalDrawEffect(ctx,g,e);};
const proceduralTerrain=buildTerrain;
buildTerrain=function(g){if(!RIFT_MAP_IMAGE.complete||!RIFT_MAP_IMAGE.naturalWidth){proceduralTerrain(g);return;}const cv=document.createElement('canvas');cv.width=cv.height=4096;const ctx=cv.getContext('2d');ctx.fillStyle='#112c26';ctx.fillRect(0,0,4096,4096);ctx.drawImage(RIFT_MAP_IMAGE,-65/WORLD*4096,-30/WORLD*4096,7115/WORLD*4096,7080/WORLD*4096);g.terrain=cv;g.terrainScale=4096/WORLD;g.authenticTerrain=true;};
