/* First ten champions. Public metadata: Riot Data Dragon 14.24.1.
 * Distances/speeds use half-size world units. Combat formulas are explicit,
 * reviewable approximations; see docs/restoration-status.md for differences. */
'use strict';
const GAME_SCALE = 0.5;
const cleanRiotText = text => text.replace(/<[^>]*>/g,' ').replace(/\{\{[^}]*\}\}/g,'').replace(/\s+/g,' ').trim();
const abilityRank = (c,key) => c.abilities['QWER'.indexOf(key)].lvl;
const bonusAD = c => Math.max(0,c.stat('ad')-c.def.base.ad-c.def.base.adG*(c.level-1));
function spell(key,aim,range,description,cast,extra={}) {
  return {key,aim,range:range*GAME_SCALE,maxLvl:key==='R'?3:5,desc:description,cast,
    ai:{when:key==='R'?'burst':aim==='self'?'engage':'harass',range:range*GAME_SCALE},...extra};
}
function ring(g,c,r,color='#ffe29a',dur=.4){addEffect(g,{kind:'ring',x:c.x,y:c.y,r,color,dur});}
function burst(g,p,r,color){addEffect(g,{kind:'blast',x:p.x,y:p.y,r,color:color||'rgba(255,170,70,.6)',dur:.45});}
function lineShot(g,c,aim,range,speed,width,color,onHit,extra={}){
  spawnProj(g,{x:c.x,y:c.y,dir:Math.atan2(aim.y-c.y,aim.x-c.x),speed:speed*.5,maxDist:range*.5,r:width*.5,team:c.team,color,owner:c,onHit,...extra});
}
function targetShot(g,c,target,color,onHit){spawnProj(g,{x:c.x,y:c.y,target,speed:850,r:8,color,team:c.team,owner:c,onHit});}
function coneHit(g,c,aim,range,spread,fn,color){
  const ang=Math.atan2(aim.y-c.y,aim.x-c.x);
  addEffect(g,{kind:'cone',x:c.x,y:c.y,r:range,ang,spread,color,dur:.35});
  for(const u of enemiesIn(g,c.team,c.x,c.y,range)){
    let d=Math.atan2(u.y-c.y,u.x-c.x)-ang; d=Math.atan2(Math.sin(d),Math.cos(d));
    if(Math.abs(d)<=spread) fn(u);
  }
}
function dashHero(g,c,aim,range,throughWalls=false){
  const a=Math.atan2(aim.y-c.y,aim.x-c.x),d=Math.min(range,dist(c,aim));
  const p={x:clampW(c.x+Math.cos(a)*d),y:clampW(c.y+Math.sin(a)*d)};
  const end=typeof terrainLanding==='function'?terrainLanding(c,p,throughWalls):p;
  addEffect(g,{kind:'dash',x:c.x,y:c.y,x2:end.x,y2:end.y,color:c.def.color,dur:.3});
  c.x=end.x;c.y=end.y;c._nav=null;c.faceAngle=a; return end;
}
function markLux(g,c,u){addBuff(u,{id:'illumination'+c.id,dur:6,fx:'#ffe498'});}
function igniteLux(g,c,u){if(u.hasBuff('illumination'+c.id)){
  u.buffs=u.buffs.filter(b=>b.id!=='illumination'+c.id);dealDamage(g,c,u,20+10*c.level+.3*c.stat('ap'),'magic');
}}
function hemorrhage(g,c,u){
  if(u.dead)return;
  const id='bleed'+c.id,old=u.buffs.find(b=>b.id===id),stacks=c.hasBuff('noxianMight')?5:Math.min(5,(old?.stacks||0)+1);
  addBuff(u,{id,dur:5,stacks,fx:'#e24d4d',tickEvery:1,onTick:(g,t)=>dealDamage(g,c,t,stacks*(3+c.level+.06*bonusAD(c)),'phys')});
  if(stacks===5&&u.type==='champ')addBuff(c,{id:'noxianMight',dur:5,stats:{ad:20+10*c.level},fx:'#f33'});
}
function annieReady(c,damage){const stun=damage&&(c.annieStack||0)>=4;c.annieStack=stun?0:Math.min(4,(c.annieStack||0)+1);return stun;}
function annieSpellHit(g,c,u,dmg,stun){dealDamage(g,c,u,dmg,'magic');if(stun)addBuff(u,{id:'annieStun',dur:1.25+.25*Math.floor((c.level-1)/6),stun:true,fx:'#ffbded'});}
function alliedChamp(g,c,aim,allowSelf=true){const u=aim?.unit;return u&&!u.dead&&u.type==='champ'&&u.team===c.team&&(allowSelf||u!==c)?u:null;}

const RIFT_KITS = {
  Garen:{id:'garen',color:'#658fcc',role:'top',weapon:'sword',passive:'坚韧：8 秒未受到英雄或野怪伤害后持续回复生命。',
    skillOrder:['E','Q','W'],build:['dshield','boots','bc','trinity','warmog','visage'],
    abilities:[
      spell('Q','self',600,l=>'移除减速，获得 35% 移速；下次普攻额外伤害并沉默目标 1.5 秒。',function(g,c){
        c.buffs=c.buffs.filter(b=>!b.slow);addBuff(c,{id:'garenQ_ms',dur:1+.65*abilityRank(c,'Q'),stats:{msPct:35}});
        c.empowerAA={dmg:5+25*abilityRank(c,'Q')+.5*c.stat('ad'),type:'phys',until:g.t+4.5,silence:1.5};c.nextAtk=g.t;
      }),
      spell('W','self',600,l=>'获得短暂护盾，随后持续减免 30% 伤害。',function(g,c){addShield(c,65+.18*c.stat('maxHp'),.75);addBuff(c,{id:'garenW',dur:1.5+.5*abilityRank(c,'W'),stats:{dr:30},fx:'#ffe3a1'});},{ai:{when:'defend',range:350}}),
      spell('E','self',650,l=>'持续旋转 3 秒，周围敌人受物理伤害；多次命中削减护甲。',function(g,c){
        const l=abilityRank(c,'E'),hits=new Map(),ticks=7+Math.floor((c.stat('as')/c.def.base.as-1)*4);
        addBuff(c,{id:'garenE',dur:3,disarm:true,tickEvery:3/ticks,onTick:(g,u)=>{
          ring(g,u,162,'#e9d18c',.2);for(const e of enemiesIn(g,u.team,u.x,u.y,162)){
            dealDamage(g,u,e,4+4*l+(0.3+.02*l)*u.stat('ad'),'phys');hits.set(e.id,(hits.get(e.id)||0)+1);
            if(hits.get(e.id)>=6)addBuff(e,{id:'garenShred',dur:6,stats:{armorPct:-25}});
          }
        }});
      }),
      spell('R','unit',400,l=>'对敌方英雄造成真实伤害，额外伤害随其已损失生命值增加。',function(g,c,aim){const t=aim.unit,l=abilityRank(c,'R');addEffect(g,{kind:'sword',x:t.x,y:t.y,dur:.6,color:'#ffdc79'});dealDamage(g,c,t,lvlv([150,300,450],l)+lvlv([.25,.3,.35],l)*(t.maxHp-t.hp),'true');},{champOnly:true,ai:{when:'execute',range:200}})
    ]},
  Darius:{id:'darius',color:'#bb4650',role:'top',weapon:'axe',passive:'出血：普攻和斧刃技能叠加持续伤害；5 层进入诺克萨斯之力。',skillOrder:['Q','E','W'],build:['dshield','boots','bc','trinity','warmog','randuin'],aaOnHit:hemorrhage,
    abilities:[
      spell('Q','self',850,l=>'蓄力挥斧。斧刃伤害更高、施加出血，并按命中的英雄数量回复已损失生命。',function(g,c){const l=abilityRank(c,'Q');ring(g,c,230,'#ba5353',.75);addDelayed(g,.75,()=>{if(c.dead)return;let n=0;burst(g,c,230,'rgba(201,71,64,.45)');for(const u of enemiesIn(g,c.team,c.x,c.y,230)){const outer=dist(c,u)>110;dealDamage(g,c,u,(10+30*l+(1+.1*l)*c.stat('ad'))*(outer?1:.35),'phys');if(outer){hemorrhage(g,c,u);if(u.type==='champ')n++;}}healUnit(c,(c.maxHp-c.hp)*Math.min(.45,n*.15));});}),
      spell('W','self',500,l=>'重置普攻，下次攻击造成额外伤害并减速 90%；击杀返还法力及部分冷却。',function(g,c){c.empowerAA={dmg:c.stat('ad')*(.35+.05*abilityRank(c,'W')),type:'phys',until:g.t+4,slow:90,refund:true};c.nextAtk=g.t;}),
      spell('E','pos',535,l=>'将前方扇形范围内的敌人拉向自己，短暂击飞并减速。',function(g,c,aim){coneHit(g,c,aim,267,.65,u=>{const a=Math.atan2(u.y-c.y,u.x-c.x);const p=terrainLanding(u,{x:c.x+Math.cos(a)*65,y:c.y+Math.sin(a)*65},true);u.x=p.x;u.y=p.y;u._nav=null;addBuff(u,{id:'dariusPull',dur:.7,stun:true});addBuff(u,{id:'dariusSlow',dur:1,slow:40});},'rgba(199,96,76,.4)');}),
      spell('R','unit',460,l=>'跃斩造成真实伤害，每层出血提高伤害；击杀英雄可在 20 秒内再次施放。',function(g,c,aim){const u=aim.unit,l=abilityRank(c,'R'),st=u.buffs.find(b=>b.id==='bleed'+c.id)?.stacks||0;dealDamage(g,c,u,(lvlv([125,250,375],l)+.75*bonusAD(c))*(1+.2*st),'true');addEffect(g,{kind:'sword',x:u.x,y:u.y,dur:.5,color:'#f76363'});c.dariusReset=u.dead?g.t+20:0;if(u.dead)addBuff(c,{id:'noxianMight',dur:5,stats:{ad:20+10*c.level},fx:'#f33'});},{champOnly:true,recastWhen:(g,c)=>g.t<(c.dariusReset||0),ai:{when:'execute',range:230}})
    ]},
  Ashe:{id:'ashe',color:'#8bd8f4',role:'bot',weapon:'bow',passive:'冰霜射击：普攻减速目标；连续攻击积累 4 层专注以启用 Q。',skillOrder:['W','Q','E'],build:['dsword','boots','berserker','ie','shiv','btk'],
    aaOnHit(g,c,u){addBuff(u,{id:'frost',dur:2,slow:20+10*c.level/18,fx:'#b0eaff'});if(!c.hasBuff('asheQ')){c.focus=Math.min(4,(c.focus||0)+1);c.focusUntil=g.t+4;}else dealDamage(g,c,u,c.stat('ad')*(.05+.05*abilityRank(c,'Q')),'phys');},
    abilities:[
      spell('Q','self',1200,l=>'消耗 4 层专注，4 秒内获得攻速并射出强化箭阵。',function(g,c){c.focus=0;addBuff(c,{id:'asheQ',dur:4,stats:{as:20+5*abilityRank(c,'Q')},fx:'#b7ebff'});},{canCast:(g,c)=>(c.focus||0)>=4}),
      spell('W','pos',1200,l=>'扇形发射 9 支箭，每支被首个敌人阻挡，同一目标仅受一次伤害和减速。',function(g,c,aim){const l=abilityRank(c,'W'),ang=Math.atan2(aim.y-c.y,aim.x-c.x),hit=new Set();for(let i=-4;i<=4;i++){lineShot(g,c,{x:c.x+Math.cos(ang+i*.1),y:c.y+Math.sin(ang+i*.1)},1200,2000,14,'#b5eaff',(g,u)=>{if(hit.has(u.id))return;hit.add(u.id);dealDamage(g,c,u,5+15*l+c.stat('ad'),'phys');addBuff(u,{id:'frost',dur:2,slow:40,fx:'#bef1ff'});});}}),
      spell('E','pos',28000,l=>'向目标地点发射鹰灵，沿途和落点提供视野。最多储存 2 次。',function(g,c,aim){const d=dist(c,aim),a=Math.atan2(aim.y-c.y,aim.x-c.x);for(let i=0;i<=d;i+=250){const x=c.x+Math.cos(a)*i,y=c.y+Math.sin(a)*i;addDelayed(g,i/1400,()=>{g.wards.push({x,y,team:c.team,r:450,until:g.t+2,scout:true});ring(g,{x,y},120,'#a6dbe8',.4);});}addDelayed(g,d/1400,()=>g.wards.push({x:aim.x,y:aim.y,team:c.team,r:650,until:g.t+5,scout:true}));},{maxCharges:2,ai:{when:'never'}}),
      spell('R','pos',28000,l=>'全图水晶箭，只碰撞敌方英雄；距离越远，眩晕越久（最多 3.5 秒）。',function(g,c,aim){const sx=c.x,sy=c.y,l=abilityRank(c,'R');lineShot(g,c,aim,28000,1600,80,'#8bddff',(g,u)=>{dealDamage(g,c,u,200+200*l+c.stat('ap'),'magic');addBuff(u,{id:'asheR',dur:Math.min(3.5,1+Math.hypot(u.x-sx,u.y-sy)/1000),stun:true,fx:'#8be5ff'});burst(g,u,125,'rgba(130,210,255,.6)');for(const v of enemiesIn(g,c.team,u.x,u.y,125))if(v!==u){dealDamage(g,c,v,100+100*l+.5*c.stat('ap'),'magic');addBuff(v,{id:'frost',dur:3,slow:40});}},{champOnly:true,big:true});},{ai:{when:'burst',range:1000}})
    ]},
  Caitlyn:{id:'caitlyn',color:'#ac88d2',role:'bot',weapon:'rifle',passive:'爆头：每 6 次普攻强化一次；陷阱或绳网命中可额外触发爆头。',skillOrder:['Q','W','E'],build:['dsword','boots','berserker','ie','shiv','btk'],
    aaOnHit(g,c,u){c.headshots=(c.headshots||0)+1;const marked=u.hasBuff('caitMark'+c.id);if(c.headshots>=6||marked){if(!marked)c.headshots=0;u.buffs=u.buffs.filter(b=>b.id!=='caitMark'+c.id);dealDamage(g,c,u,c.stat('ad')*(.5+.5*c.level/18+c.stat('crit')/100),'phys');ring(g,u,45,'#efc9ff');}},
    abilities:[
      spell('Q','pos',1250,l=>'蓄力发射穿透弹，对后续目标伤害降低。',function(g,c,aim){const l=abilityRank(c,'Q');addBuff(c,{id:'caitQcast',dur:.625,root:true});addDelayed(g,.625,()=>{if(c.dead)return;let n=0;lineShot(g,c,aim,1250,2200,70,'#ddb1ff',(g,u)=>dealDamage(g,c,u,(10+40*l+(1.1+.1*l)*c.stat('ad'))*(n++? .6:1),'phys'),{pierce:true,hitSet:new Set()});});}),
      spell('W','pos',800,l=>'放置延迟启动的夹子，禁锢踩中的英雄 1.5 秒，并赋予一次爆头。',function(g,c,aim){const traps=g.zones.filter(z=>z.trap&&z.owner===c);if(traps.length>=3+Math.floor((abilityRank(c,'W')-1)/2))traps[0].doneZ=true;addZone(g,{x:aim.x,y:aim.y,r:35,team:c.team,owner:c,trap:true,dur:30+20*abilityRank(c,'W'),tickEvery:.1,color:'rgba(192,145,74,.25)',onTick(g,u){if(u.type!=='champ'||g.t<this.t0+1||this.triggered)return;this.triggered=true;this.doneZ=true;addBuff(u,{id:'caitTrap',dur:1.5,root:true});addBuff(u,{id:'caitMark'+c.id,dur:3,fx:'#d7a3ed'});}});},{maxCharges:3,ai:{when:'harass',range:360}}),
      spell('E','pos',750,l=>'发射绳网，减速命中的敌人并向后位移；命中赋予爆头。',function(g,c,aim){const l=abilityRank(c,'E'),a=Math.atan2(aim.y-c.y,aim.x-c.x);lineShot(g,c,aim,750,1600,70,'#c7ccdf',(g,u)=>{dealDamage(g,c,u,30+40*l+.8*c.stat('ap'),'magic');addBuff(u,{id:'caitNet',dur:1,slow:50});addBuff(u,{id:'caitMark'+c.id,dur:3,fx:'#d7a3ed'});});dashHero(g,c,{x:c.x-Math.cos(a)*195,y:c.y-Math.sin(a)*195},195,true);}),
      spell('R','unit',3500,l=>'锁定敌方英雄并引导瞄准，发射可被其他敌方英雄挡下的追踪弹。',function(g,c,aim){const target=aim.unit,l=abilityRank(c,'R');addBuff(c,{id:'caitRcast',dur:1,channel:true,root:true});addEffect(g,{kind:'line',x:c.x,y:c.y,x2:target.x,y2:target.y,w:2,color:'#dc768c',dur:1});addDelayed(g,1,()=>{if(c.dead||c.isStunned()||target.dead||!c.hasBuff('caitRcast'))return;spawnProj(g,{x:c.x,y:c.y,target,speed:1600,r:9,color:'#fac0ec',team:c.team,owner:c,intercept:true,onHit:(g,u)=>dealDamage(g,c,u,50+250*l+1.5*bonusAD(c),'phys')});});},{champOnly:true,ai:{when:'execute',range:1300}})
    ]},
  Ahri:{id:'ahri',color:'#ecb7dc',role:'mid',weapon:'orb',passive:'摄魂夺魄：击杀 9 个小兵或野怪后治疗自己；参与英雄击杀也获得治疗。',skillOrder:['Q','W','E'],build:['dring','boots','sorcs','luden','rabadon','zhonya'],
    abilities:[
      spell('Q','pos',900,l=>'宝珠去程造成魔法伤害，返回时追踪阿狸并造成真实伤害。两程可各命中一次。',function(g,c,aim){const l=abilityRank(c,'Q'),dmg=15+25*l+.5*c.stat('ap'),a=Math.atan2(aim.y-c.y,aim.x-c.x);lineShot(g,c,aim,900,1700,90,'#75d9ef',(g,u)=>dealDamage(g,c,u,dmg,'magic'),{pierce:true,hitSet:new Set()});addDelayed(g,900/1700,()=>{if(c.dead)return;spawnProj(g,{x:c.x+Math.cos(a)*450,y:c.y+Math.sin(a)*450,returnTo:c,team:c.team,owner:c,speed:1100,r:35,color:'#f6e0ff',pierce:true,hitSet:new Set(),onHit:(g,u)=>dealDamage(g,c,u,dmg,'true')});});}),
      spell('W','self',1400,l=>'获得短暂移速并召唤三团狐火，优先攻击附近敌方英雄。',function(g,c){const l=abilityRank(c,'W'),hit=new Map();addBuff(c,{id:'ahriW',dur:1.5,stats:{msPct:40},fx:'#d9acff'});for(let i=0;i<3;i++)addDelayed(g,.15+i*.18,()=>{if(c.dead)return;const u=enemiesIn(g,c.team,c.x,c.y,350).sort((a,b)=>(a.type==='champ'?0:1000)+dist(c,a)-(b.type==='champ'?0:1000)-dist(c,b))[0];if(!u)return;const n=hit.get(u.id)||0;hit.set(u.id,n+1);targetShot(g,c,u,'#d8a7ff',(g,t)=>dealDamage(g,c,t,(20+30*l+.3*c.stat('ap'))*(n?.3:1),'magic'));});}),
      spell('E','pos',1000,l=>'魅惑首个命中的敌人，目标短暂失去控制并缓慢走向阿狸。',function(g,c,aim){const l=abilityRank(c,'E');lineShot(g,c,aim,1000,1550,60,'#ff88c5',(g,u)=>{dealDamage(g,c,u,40+40*l+.75*c.stat('ap'),'magic');addBuff(u,{id:'charm',dur:.95+.25*l,charm:c,slow:65,fx:'#ff8dcc'});});}),
      spell('R','pos',450,l=>'向目标方向突进并攻击附近敌人，15 秒内可再次施放两次；参与击杀增加一次。',function(g,c,aim){const active=g.t<(c.ahriRUntil||0);if(!active){c.ahriDashes=3;c.ahriRUntil=g.t+15;}c.ahriDashes--;c.ahriRLock=g.t+1;dashHero(g,c,aim,225,true);const l=abilityRank(c,'R');for(const u of enemiesIn(g,c.team,c.x,c.y,300).sort((a,b)=>(a.type==='champ'?0:1)-(b.type==='champ'?0:1)).slice(0,3))targetShot(g,c,u,'#d69fff',(g,t)=>dealDamage(g,c,t,40+20*l+.35*c.stat('ap'),'magic'));},{recastWhen:(g,c)=>g.t<(c.ahriRUntil||0)&&(c.ahriDashes||0)>0,canCast:(g,c)=>g.t>=(c.ahriRLock||0),ai:{when:'burst',range:430}})
    ]},
  Lux:{id:'lux',color:'#e8d58f',role:'mid',weapon:'staff',passive:'光芒四射：伤害技能标记目标，普攻和终极闪光引爆标记，造成额外魔法伤害。',skillOrder:['E','Q','W'],build:['dring','boots','sorcs','luden','rabadon','zhonya'],aaOnHit:igniteLux,
    abilities:[
      spell('Q','pos',1300,l=>'禁锢最多两个敌人 2 秒并施加光芒四射标记。',function(g,c,aim){let n=0;const l=abilityRank(c,'Q');lineShot(g,c,aim,1300,1200,70,'#ffeac0',(g,u,p)=>{dealDamage(g,c,u,40+40*l+.65*c.stat('ap'),'magic');markLux(g,c,u);addBuff(u,{id:'luxQ',dur:2,root:true,fx:'#ffe6a6'});if(++n>=2)p.deadP=true;},{pierce:true,hitSet:new Set()});}),
      spell('W','pos',1175,l=>'投出回旋光杖，去程和回程为经过的友方英雄各提供一层护盾。',function(g,c,aim){const amount=15+25*abilityRank(c,'W')+.35*c.stat('ap');addShield(c,amount,2.5);const a=Math.atan2(aim.y-c.y,aim.x-c.x),sx=c.x,sy=c.y,ex=sx+Math.cos(a)*587,ey=sy+Math.sin(a)*587;addEffect(g,{kind:'line',x:sx,y:sy,x2:ex,y2:ey,w:8,color:'rgba(250,226,159,.65)',dur:1.2});for(const u of g.champs.filter(u=>!u.dead&&u.team===c.team&&u!==c)){if(distToSeg(u.x,u.y,sx,sy,ex,ey)<65)addDelayed(g,dist(c,u)/1200,()=>addShield(u,amount,2.5));}addDelayed(g,1,()=>{if(c.dead)return;for(const u of g.champs.filter(u=>!u.dead&&u.team===c.team))if(distToSeg(u.x,u.y,ex,ey,c.x,c.y)<65)addShield(u,amount,2.5);});},{ai:{when:'defend',range:500}}),
      spell('E','pos',1100,l=>'放置持续减速区域；再次按 E 或 5 秒后引爆并标记范围内敌人。',function(g,c,aim){if(c.luxZone&&!c.luxZone.doneZ){c.luxZone._expire=g.t;return;}const l=abilityRank(c,'E');const z={x:aim.x,y:aim.y,r:155,team:c.team,dur:5,tickEvery:.1,color:'rgba(230,198,78,.2)',onTick:(g,u)=>addBuff(u,{id:'luxESlow',dur:.35,slow:20+5*l}),onExpire(g,z){burst(g,z,z.r,'rgba(255,225,139,.6)');for(const u of enemiesIn(g,c.team,z.x,z.y,z.r)){dealDamage(g,c,u,20+50*l+.8*c.stat('ap'),'magic');markLux(g,c,u);}c.luxZone=null;}};addZone(g,z);c.luxZone=z;},{recastWhen:(g,c)=>!!c.luxZone&&!c.luxZone.doneZ}),
      spell('R','pos',3400,l=>'引导 1 秒后发射远程光束，造成魔法伤害、引爆旧标记并重新标记。',function(g,c,aim){const l=abilityRank(c,'R'),sx=c.x,sy=c.y,a=Math.atan2(aim.y-sy,aim.x-sx),ex=sx+Math.cos(a)*1700,ey=sy+Math.sin(a)*1700;addBuff(c,{id:'luxRcast',dur:1,root:true});addEffect(g,{kind:'line',x:sx,y:sy,x2:ex,y2:ey,w:16,color:'rgba(255,234,173,.35)',dur:1});addDelayed(g,1,()=>{if(c.dead)return;sfx('beam');addEffect(g,{kind:'line',x:sx,y:sy,x2:ex,y2:ey,w:85,color:'rgba(255,249,209,.95)',dur:.5});for(const u of enemiesIn(g,c.team,(sx+ex)/2,(sy+ey)/2,950))if(distToSeg(u.x,u.y,sx,sy,ex,ey)<50+u.radius){igniteLux(g,c,u);dealDamage(g,c,u,200+100*l+1.2*c.stat('ap'),'magic');markLux(g,c,u);}});},{ai:{when:'burst',range:1250}})
    ]},
  Annie:{id:'annie',color:'#da729c',role:'mid',weapon:'fire',passive:'嗜火：施放 4 次技能后，下一个伤害技能眩晕所有命中的目标。',skillOrder:['Q','W','E'],build:['dring','boots','sorcs','luden','rabadon','rylai'],
    abilities:[
      spell('Q','unit',625,l=>'追踪火球；击杀目标返还全部法力，并返还一半冷却时间。',function(g,c,aim){const l=abilityRank(c,'Q'),stun=annieReady(c,true),mana=lvlv(c.abilities[0].def.mana,l);targetShot(g,c,aim.unit,'#ff8543',(g,u)=>{annieSpellHit(g,c,u,45+35*l+.8*c.stat('ap'),stun);if(u.dead){c.mp=Math.min(c.maxMp,c.mp+mana);c.abilities[0].readyAt=Math.max(g.t,c.abilities[0].readyAt-lvlv(c.abilities[0].def.cd,l)/2);}});}),
      spell('W','pos',600,l=>'扇形烈焰；嗜火就绪时，扇形内所有命中的敌人均被眩晕。',function(g,c,aim){const l=abilityRank(c,'W'),stun=annieReady(c,true);coneHit(g,c,aim,300,.65,u=>annieSpellHit(g,c,u,25+45*l+.85*c.stat('ap'),stun),'rgba(255,104,37,.6)');}),
      spell('E','ally',800,l=>'为自己或友方英雄提供护盾和移速，计入嗜火层数。无友方目标时对自己施放。',function(g,c,aim){const u=alliedChamp(g,c,aim)||c,l=abilityRank(c,'E');addShield(u,40+20*l+.4*c.stat('ap'),3);addBuff(u,{id:'annieE',dur:3,stats:{msPct:20},reflect:c,fx:'#ff9a57'});annieReady(c,false);},{allowSelf:true,ai:{when:'defend',range:400}}),
      spell('R','pos',600,l=>'召唤可移动、攻击的提伯斯，落点造成伤害；提伯斯持续 45 秒并灼烧附近敌人。',function(g,c,aim){const l=abilityRank(c,'R'),stun=annieReady(c,true);burst(g,aim,145,'rgba(255,100,33,.75)');for(const u of enemiesIn(g,c.team,aim.x,aim.y,145))annieSpellHit(g,c,u,150+125*l+.75*c.stat('ap'),stun);for(const p of g.pets)if(p.owner===c)p.dead=true;g.pets.push(new Pet(g,c,aim,l));g._unitsCacheT=-1;},{ai:{when:'burst',range:300}})
    ]},
  MasterYi:{id:'yi',color:'#bbd278',role:'jungle',weapon:'katana',passive:'双重打击：每第 4 次普攻额外攻击一次；普攻缩短阿尔法突袭的冷却。',skillOrder:['Q','E','W'],build:['dsword','boots','berserker','btk','ie','shiv'],
    aaOnHit(g,c,u){c.doubleStrike=(c.doubleStrike||0)+1;c.abilities[0].readyAt-=1;if(c.doubleStrike>=4){c.doubleStrike=0;addDelayed(g,.12,()=>{if(c.dead||u.dead)return;dealDamage(g,c,u,.5*c.stat('ad'),'phys');const b=c.buffs.find(b=>b.trueOnHit);if(b)dealDamage(g,c,u,b.trueOnHit,'true');ring(g,u,30,'#e5ef9c');});}},
    abilities:[
      spell('Q','unit',600,l=>'短暂不可选中，斩击最多 4 个敌人；孤立目标会承受衰减的重复斩击。',function(g,c,aim){const t=aim.unit,l=abilityRank(c,'Q'),targets=[t,...enemiesIn(g,c.team,t.x,t.y,300).filter(u=>u!==t).slice(0,3)],hit=new Map();c.untargetable=true;c.order={type:'hold'};addBuff(c,{id:'alpha',dur:.9,channel:true,root:true});for(let i=0;i<4;i++)addDelayed(g,.16*(i+1),()=>{if(c.dead)return;const u=targets[i%targets.length];if(u.dead)return;const n=hit.get(u.id)||0;hit.set(u.id,n+1);dealDamage(g,c,u,(20+30*l+.5*c.stat('ad'))*(n?.25:1),'phys');ring(g,u,45,'#dce7a4');});addDelayed(g,.8,()=>{c.untargetable=false;if(!c.dead){dashHero(g,c,t,4000,true);c.buffs=c.buffs.filter(b=>b.id!=='alpha');}});}),
      spell('W','self',0,l=>'原地冥想 4 秒，持续治疗并减伤；移动、施法或硬控会中断。',function(g,c){const l=abilityRank(c,'W');addBuff(c,{id:'yiW',dur:4,channel:true,root:true,stats:{dr:45+5*l},tickEvery:.25,fx:'#b6f4a2',onTick:(g,u)=>healUnit(u,(25+15*l+.25*u.stat('ap'))*.25*(1+(1-u.hp/u.maxHp)))});},{ai:{when:'heal',range:0}}),
      spell('E','self',700,l=>'5 秒内普攻附加真实伤害。',function(g,c){addBuff(c,{id:'yiE',dur:5,trueOnHit:25+5*abilityRank(c,'E')+.3*bonusAD(c),fx:'#faf9a3'});}),
      spell('R','self',1000,l=>'获得移速、攻速并免疫减速；参与击杀延长持续时间、削减基础技能冷却。',function(g,c){const l=abilityRank(c,'R');addBuff(c,{id:'yiR',dur:7,slowImmune:true,stats:{msPct:25+10*l,as:10+15*l},fx:'#dbeead'});},{ai:{when:'engage',range:500}})
    ]},
  Malphite:{id:'malphite',color:'#b6ad82',role:'top',weapon:'rock',passive:'花岗岩护盾：脱战后生成最大生命值 10% 的护盾。',skillOrder:['Q','E','W'],build:['dshield','boots','tabi','thorn','randuin','warmog'],
    abilities:[
      spell('Q','unit',625,l=>'投掷地震碎片造成魔法伤害，偷取目标移动速度。',function(g,c,aim){const l=abilityRank(c,'Q');targetShot(g,c,aim.unit,'#c1af72',(g,u)=>{dealDamage(g,c,u,20+50*l+.6*c.stat('ap'),'magic');addBuff(u,{id:'malphiteQslow',dur:3,slow:15+5*l});addBuff(c,{id:'malphiteQhaste',dur:3,stats:{msPct:15+5*l}});});}),
      spell('W','self',550,l=>'重置普攻并强化下次攻击，5 秒内普攻震击目标周围区域。',function(g,c){const l=abilityRank(c,'W');c.empowerAA={dmg:15+15*l+.2*c.stat('ap')+.15*c.stat('armor'),type:'phys',until:g.t+5};c.nextAtk=g.t;addBuff(c,{id:'malphiteW',dur:5,fx:'#b8ae86'});}),
      spell('E','self',800,l=>'拍击地面，造成魔法伤害并降低敌人的攻击速度。',function(g,c){const l=abilityRank(c,'E');burst(g,c,200,'rgba(155,142,106,.6)');for(const u of enemiesIn(g,c.team,c.x,c.y,200)){dealDamage(g,c,u,30+30*l+.6*c.stat('ap')+.4*c.stat('armor'),'magic');addBuff(u,{id:'malphiteE',dur:3,stats:{as:-25-5*l}});}}),
      spell('R','pos',1000,l=>'势不可挡地冲向目标位置，落点敌人受到魔法伤害并被击飞 1.5 秒。',function(g,c,aim){const l=abilityRank(c,'R');c.unstoppableUntil=g.t+.35;dashHero(g,c,aim,500,true);burst(g,c,162,'rgba(207,188,126,.7)');for(const u of enemiesIn(g,c.team,c.x,c.y,162)){dealDamage(g,c,u,100+100*l+.9*c.stat('ap'),'magic');addBuff(u,{id:'airborne',dur:1.5,stun:true,fx:'#e1d4af'});}})
    ],aaOnHit(g,c,u){if(c.hasBuff('malphiteW'))for(const v of enemiesIn(g,c.team,u.x,u.y,100))dealDamage(g,c,v,5+10*abilityRank(c,'W')+.1*c.stat('armor'),'phys');}},
  Soraka:{id:'soraka',color:'#bba9e6',role:'support',weapon:'crescent',passive:'救赎：朝附近生命值低于 40% 的友方英雄移动时，获得额外移速。',skillOrder:['W','Q','E'],build:['dring','boots','sorcs','rylai','rabadon','visage'],
    abilities:[
      spell('Q','pos',800,l=>'星体延迟坠落，减速敌人；命中英雄后获得持续治疗的活力焕发。',function(g,c,aim){const l=abilityRank(c,'Q');ring(g,aim,118,'#d5c2f2',.5);addDelayed(g,.5,()=>{burst(g,aim,118,'rgba(196,160,232,.5)');let hit=false;for(const u of enemiesIn(g,c.team,aim.x,aim.y,118)){dealDamage(g,c,u,40+45*l+.35*c.stat('ap'),'magic');addBuff(u,{id:'sorakaQ',dur:1.5,slow:30});if(u.type==='champ')hit=true;}if(hit)addBuff(c,{id:'rejuvenation',dur:2.5,tickEvery:.5,stats:{msPct:10},fx:'#a8e4d0',onTick:(g,u)=>healUnit(u,(40+20*l+.3*c.stat('ap'))/5)});});}),
      spell('W','ally',550,l=>'消耗部分自身生命值治疗另一名友方英雄；活力焕发期间降低生命消耗。',function(g,c,aim){const u=alliedChamp(g,c,aim,false);if(!u||c.hp<=c.maxHp*.1)return false;const l=abilityRank(c,'W'),rev=c.hasBuff('rejuvenation');c.hp-=c.maxHp*.1*(rev?.2:1);healUnit(u,50+40*l+.65*c.stat('ap'));ring(g,u,65,'#a2f4bd');if(rev)addBuff(u,{id:'rejuvenation',dur:2.5,tickEvery:.5,onTick:(g,t)=>healUnit(t,12+.06*c.stat('ap'))});},{allowSelf:false,ai:{when:'allyHeal',range:275}}),
      spell('E','pos',925,l=>'放置星体结界，持续沉默区域内的敌人，结束时禁锢仍在其中的敌人。',function(g,c,aim){const l=abilityRank(c,'E'),hit=new Set();addZone(g,{x:aim.x,y:aim.y,r:130,team:c.team,dur:1.5,tickEvery:.1,color:'rgba(163,122,217,.3)',onTick:(g,u)=>{addBuff(u,{id:'sorakaSilence',dur:.2,silence:true,fx:'#b299ee'});if(!hit.has(u.id)){hit.add(u.id);dealDamage(g,c,u,30+40*l+.4*c.stat('ap'),'magic');}},onExpire:(g,z)=>{burst(g,z,z.r,'rgba(188,156,239,.7)');for(const u of enemiesIn(g,c.team,z.x,z.y,z.r)){dealDamage(g,c,u,30+40*l+.4*c.stat('ap'),'magic');addBuff(u,{id:'sorakaRoot',dur:.75+.25*l,root:true});}}});}),
      spell('R','self',28000,l=>'治疗全地图所有友方英雄；生命低于 40% 的目标获得 50% 额外治疗。',function(g,c){const l=abilityRank(c,'R');for(const u of g.champs.filter(u=>u.team===c.team&&!u.dead)){healUnit(u,(50+100*l+.5*c.stat('ap'))*(u.hp/u.maxHp<.4?1.5:1));ring(g,u,90,'#b2f0d9',.8);}},{ai:{when:'teamHeal',range:14000}})
    ]}
};

// Leave the original character in CHAMP_BY_ID for archived saves/tests, but
// only these ten official characters participate in the new champion select.
CHAMPIONS.splice(0,CHAMPIONS.length);
for(const [riotId,kit] of Object.entries(RIFT_KITS)){
  const raw=RIOT_DATA.champions[riotId],s=raw.stats;
  const def={...kit,riotId,name:raw.title,title:raw.name,char:raw.title[0],model:'rift',
    portrait:`assets/riot/champions/${riotId}.png`,splash:`assets/riot/splash/${riotId}.jpg`,passiveIcon:`assets/riot/spells/${riotId}_P.png`,officialPassive:cleanRiotText(raw.passive.description),
    ranged:s.attackrange>300,range:s.attackrange*.5,projSpeed:1000,
    base:{hp:s.hp,hpG:s.hpperlevel,mp:s.mp,mpG:s.mpperlevel,hp5:s.hpregen,mp5:s.mpregen,ad:s.attackdamage,adG:s.attackdamageperlevel,armor:s.armor,armG:s.armorperlevel,mr:s.spellblock,mrG:s.spellblockperlevel,as:s.attackspeed,asG:s.attackspeedperlevel,ms:s.movespeed*.5}};
  def.abilities=kit.abilities.map((a,i)=>({...a,name:raw.spells[i].name,iconImage:`assets/riot/spells/${riotId}_${a.key}.png`,icon:a.key,cd:raw.spells[i].cooldown,mana:raw.spells[i].cost,officialDescription:cleanRiotText(raw.spells[i].description)}));
  CHAMPIONS.push(def);CHAMP_BY_ID[def.id]=def;
}
const ITEM_RIOT_IDS=[1055,1056,1054,1036,1038,1043,3031,3072,3071,3078,3087,1052,1058,3089,3157,6655,3116,1031,1057,3075,3143,3065,3083,1001,3006,3020,3047,3111];
const ITEM_STAT_MAP={FlatPhysicalDamageMod:['ad',1],FlatMagicDamageMod:['ap',1],FlatHPPoolMod:['hp',1],FlatMPPoolMod:['mp',1],FlatArmorMod:['armor',1],FlatSpellBlockMod:['mr',1],PercentAttackSpeedMod:['as',100],FlatMovementSpeedMod:['ms',.5],PercentMovementSpeedMod:['msPct',100],FlatCritChanceMod:['crit',100],PercentLifeStealMod:['ls',100],FlatHPRegenMod:['hp5',5]};
for(let i=0;i<ITEMS.length;i++){
  const item=ITEMS[i],id=ITEM_RIOT_IDS[i],raw=RIOT_DATA.items[id];item.iconImage=`assets/riot/items/${id}.png`;item.riotId=id;
  if(raw){item.name=raw.name;item.price=raw.gold.total;item.sellPrice=raw.gold.sell;item.stats={};item.components=(raw.from||[]).map(Number);item.officialDescription=cleanRiotText(raw.description);
    for(const [key,value] of Object.entries(raw.stats)){const m=ITEM_STAT_MAP[key];if(m)item.stats[m[0]]=value*m[1];}
    for(const [pattern,key]of [[/(\d+) 技能急速/,'haste'],[/(\d+)% 基础生命回复/,'hpRegenPct'],[/(\d+) 法术穿透/,'magicPen'],[/(\d+)% 韧性/,'tenacity']]){const match=item.officialDescription.match(pattern);if(match)item.stats[key]=Number(match[1]);}
    if(id===1056)item.stats.mp5=6.25;
  }
}
Object.assign(STAT_NAMES,{haste:'技能急速',hpRegenPct:'基础生命回复%',msPct:'移动速度%',magicPen:'法术穿透',tenacity:'韧性%'});
Object.assign(SUMMONER_SPELLS.flash,{cd:300,iconImage:'assets/riot/spells/SummonerFlash.png'});
Object.assign(SUMMONER_SPELLS.heal,{cd:240,iconImage:'assets/riot/spells/SummonerHeal.png'});
