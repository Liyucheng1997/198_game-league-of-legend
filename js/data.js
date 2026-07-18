/* ============ 游戏数据：英雄 / 装备 / 常量 ============ */
"use strict";

const WORLD = 7000;            // 世界尺寸
const TEAM_BLUE = 'blue', TEAM_RED = 'red';

/* ---------- 装备 ---------- */
const ITEMS = [
  // 起始装
  { id:'dsword',  name:'多兰之剑', icon:'🗡', price:450,  tab:'攻击', stats:{ad:8, hp:80, ls:3} },
  { id:'dring',   name:'多兰之戒', icon:'💍', price:400,  tab:'法术', stats:{ap:15, hp:70, mp5:4} },
  { id:'dshield', name:'多兰之盾', icon:'🛡', price:450,  tab:'防御', stats:{hp:110, hp5:6} },
  // 攻击
  { id:'lsword',  name:'长剑',     icon:'⚔', price:350,  tab:'攻击', stats:{ad:10} },
  { id:'bfsword', name:'暴风大剑', icon:'🔪', price:1300, tab:'攻击', stats:{ad:40} },
  { id:'bow',     name:'反曲之弓', icon:'🏹', price:1000, tab:'攻击', stats:{as:25} },
  { id:'ie',      name:'无尽之刃', icon:'💠', price:3400, tab:'攻击', stats:{ad:70, crit:25} },
  { id:'btk',     name:'饮血剑',   icon:'🩸', price:3200, tab:'攻击', stats:{ad:55, ls:15} },
  { id:'bc',      name:'黑色切割者', icon:'🪓', price:3000, tab:'攻击', stats:{ad:45, hp:300, cdr:15} },
  { id:'trinity', name:'三相之力', icon:'🔱', price:3333, tab:'攻击', stats:{ad:30, hp:300, as:30, ms:10, cdr:10} },
  { id:'shiv',    name:'斯塔缇克电刃', icon:'⚡', price:2800, tab:'攻击', stats:{ad:45, as:30, crit:15} },
  // 法术
  { id:'tome',    name:'增幅典籍', icon:'📖', price:435,  tab:'法术', stats:{ap:20} },
  { id:'rod',     name:'无用大棒', icon:'🪄', price:1250, tab:'法术', stats:{ap:45} },
  { id:'rabadon', name:'灭世者的死亡之帽', icon:'🎩', price:3600, tab:'法术', stats:{ap:120}, passive:'rabadon' },
  { id:'zhonya',  name:'中娅沙漏', icon:'⏳', price:2900, tab:'法术', stats:{ap:65, armor:45} },
  { id:'luden',   name:'卢登的回声', icon:'🌊', price:3200, tab:'法术', stats:{ap:90, mp:600, cdr:10} },
  { id:'rylai',   name:'瑞莱的冰晶节杖', icon:'❄', price:2600, tab:'法术', stats:{ap:75, hp:300} },
  // 防御
  { id:'chain',   name:'锁子甲',   icon:'⛓', price:800,  tab:'防御', stats:{armor:40} },
  { id:'cloak',   name:'负极斗篷', icon:'🧣', price:900,  tab:'防御', stats:{mr:40} },
  { id:'thorn',   name:'荆棘之甲', icon:'🌵', price:2700, tab:'防御', stats:{armor:70, hp:250} },
  { id:'randuin', name:'兰顿之兆', icon:'🔰', price:2900, tab:'防御', stats:{armor:60, hp:400} },
  { id:'visage',  name:'振奋盔甲', icon:'✨', price:2900, tab:'防御', stats:{mr:60, hp:400, hp5:10, cdr:10} },
  { id:'warmog',  name:'狂徒铠甲', icon:'💚', price:2850, tab:'防御', stats:{hp:800, hp5:20} },
  // 鞋子
  { id:'boots',   name:'速度之靴', icon:'👟', price:300,  tab:'移动', stats:{ms:13}, boots:true },
  { id:'berserker',name:'狂战士胫甲', icon:'🥾', price:1100, tab:'移动', stats:{ms:22, as:25}, boots:true },
  { id:'sorcs',   name:'法师之靴', icon:'👢', price:1100, tab:'移动', stats:{ms:22, ap:18}, boots:true },
  { id:'tabi',    name:'忍者足具', icon:'🩴', price:1100, tab:'移动', stats:{ms:22, armor:20}, boots:true },
  { id:'mercury', name:'水银之靴', icon:'🥿', price:1100, tab:'移动', stats:{ms:22, mr:25}, boots:true },
];
const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i=>[i.id,i]));
const STAT_NAMES = {ad:'攻击力', ap:'法术强度', hp:'生命值', mp:'法力值', armor:'护甲', mr:'魔法抗性',
  as:'攻击速度%', ms:'移动速度', crit:'暴击几率%', ls:'生命偷取%', hp5:'生命回复/5秒', mp5:'法力回复/5秒', cdr:'冷却缩减%'};

function itemDesc(it){
  return Object.entries(it.stats).map(([k,v])=>`+${v} ${STAT_NAMES[k]}`).join('　');
}

/* ---------- 技能辅助（运行时调用 engine.js 中的函数） ---------- */
function lvlv(arr, lvl){ return arr[Math.min(lvl, arr.length)-1]; }

/* ---------- 英雄 ---------- */
const CHAMPIONS = [
{
  id:'landuo', name:'岚铎', title:'裂星壁垒', char:'岚', color:'#164d52',
  portrait:'assets/heroes/landuo/portrait.png', portraitPos:'50% 42%', model:'landuo',
  ranged:false, range:105,
  base:{hp:690, hpG:104, mp:310, mpG:18, hp5:8.5, mp5:7, ad:68, adG:4.2, armor:40, armG:4.5, mr:33, mrG:1.6, as:0.63, asG:2.2, ms:169},
  passive:'熔芯：施放基础技能积累 1 层铸火（最多 3 层）。满层后，下一个基础技能获得独特强化。角色模型腰甲上的熔金铆钉会显示当前层数。',
  skillOrder:['Q','E','W'],
  build:['dshield','boots','bc','tabi','warmog','randuin','visage','thorn'],
  abilities:[
    { key:'Q', name:'断岳横斩', icon:'◒', maxLvl:5, aim:'pos', range:280, cd:[8,7.5,7,6.5,6], mana:[35,35,35,35,35],
      desc:l=>`挥动陨铁战刃横扫前方，造成 ${45+30*l} (+90%AD) 物理伤害并减速 25%。满铸火强化：范围扩大、伤害提升 30%并击晕 0.8 秒。`,
      ai:{when:'engage', range:250},
      cast(g,c,aim){ const l=this._l(c), empowered=landuoForge(c); const ang=Math.atan2(aim.y-c.y,aim.x-c.x);
        setHeroAnim(g,c,'q',0.48,ang); const r=empowered?275:225, spread=empowered?1.05:0.82;
        addEffect(g,{kind:'forgeSweep',x:c.x,y:c.y,ang,spread,r,color:empowered?'#ffd36a':'#e48732',dur:0.48,empowered});
        for(const e of enemiesIn(g,c.team,c.x,c.y,r)){
          const a2=Math.atan2(e.y-c.y,e.x-c.x); let d=Math.abs(a2-ang); if(d>Math.PI)d=2*Math.PI-d;
          if(d<=spread){ dealDamage(g,c,e,((45+30*l)+0.9*c.stat('ad'))*(empowered?1.3:1),'phys');
            addBuff(e,{id:'landuoQslow',dur:1.5,slow:25,fx:'#e99a43'});
            if(empowered) addBuff(e,{id:'landuoQstun',dur:0.8,stun:true,fx:'#ffd36a'}); }
        }
      }
    },
    { key:'W', name:'铸垒回响', icon:'⬢', maxLvl:5, aim:'self', cd:[17,16,15,14,13], mana:[50,55,60,65,70],
      desc:l=>`竖起壁垒，获得 ${70+40*l} (+8%最大生命值) 护盾与 25% 减伤，2.5 秒后震裂，对周围敌人造成魔法伤害。满铸火强化：护盾提高 50%，震裂附带 40% 减速。`,
      ai:{when:'defend', range:360},
      cast(g,c){ const l=this._l(c), empowered=landuoForge(c), shield=((70+40*l)+c.maxHp*0.08)*(empowered?1.5:1);
        setHeroAnim(g,c,'w',0.62,c.faceAngle); addShield(c,shield,2.5);
        addBuff(c,{id:'landuoW',dur:2.5,stats:{dr:25},fx:empowered?'#ffd36a':'#55c3b8'});
        addEffect(g,{kind:'bastion',x:c.x,y:c.y,r:80,color:empowered?'#ffd36a':'#55c3b8',dur:0.65});
        addDelayed(g,2.5,()=>{ if(c.dead) return;
          addEffect(g,{kind:'forgeBurst',x:c.x,y:c.y,r:empowered?210:175,color:empowered?'rgba(255,190,74,.8)':'rgba(75,188,174,.68)',dur:0.55});
          for(const e of enemiesIn(g,c.team,c.x,c.y,empowered?210:175)){
            dealDamage(g,c,e,(30+25*l)+0.35*c.stat('ad'),'magic');
            if(empowered) addBuff(e,{id:'landuoWslow',dur:1.5,slow:40,fx:'#ffd36a'});
          }
        });
      }
    },
    { key:'E', name:'熔痕突进', icon:'➤', maxLvl:5, aim:'pos', range:390, cd:[13,12,11,10,9], mana:[45,50,55,60,65],
      desc:l=>`拖刃突进，对路径上的敌人造成 ${35+28*l} (+75%AD) 物理伤害。满铸火强化：留下 3 秒熔痕，每秒造成魔法伤害并减速。`,
      ai:{when:'engage', range:390},
      cast(g,c,aim){ const l=this._l(c), empowered=landuoForge(c), sx=c.x, sy=c.y;
        const ang=Math.atan2(aim.y-sy,aim.x-sx), d=Math.min(390,Math.hypot(aim.x-sx,aim.y-sy));
        const ex=clampW(sx+Math.cos(ang)*d), ey=clampW(sy+Math.sin(ang)*d);
        setHeroAnim(g,c,'e',0.38,ang); addEffect(g,{kind:'forgeDash',x:sx,y:sy,x2:ex,y2:ey,color:empowered?'#ffd36a':'#d9752a',dur:0.42});
        for(const u of g.units()){
          if(u.dead||u.untargetable||u.type==='tower'||u.type==='inhib'||u.type==='nexus') continue;
          if(u.type!=='monster' && u.team===c.team) continue;
          if(distToSeg(u.x,u.y,sx,sy,ex,ey)<55+u.radius) dealDamage(g,c,u,(35+28*l)+0.75*c.stat('ad'),'phys');
        }
        c.x=ex; c.y=ey;
        if(empowered) addZone(g,{x:(sx+ex)/2,y:(sy+ey)/2,r:110,team:c.team,dur:3,tickEvery:0.75,color:'rgba(238,125,38,.20)',
          onTick:(g,u)=>{ dealDamage(g,c,u,(12+7*l)+0.08*c.stat('ad'),'magic'); addBuff(u,{id:'landuoEslow',dur:0.9,slow:25}); }});
      }
    },
    { key:'R', name:'天坠·裂星', icon:'✦', maxLvl:3, aim:'pos', range:620, cd:[110,95,80], mana:[100,100,100],
      desc:l=>`跃向目标区域并砸裂地面，造成 ${150+125*l} (+110%额外AD) 物理伤害和目标 18% 已损失生命值的魔法伤害，中心敌人被击晕 1.25 秒。施放后立即充满铸火。`,
      ai:{when:'burst', range:600},
      cast(g,c,aim){ const l=this._l(c), sx=c.x, sy=c.y, ang=Math.atan2(aim.y-sy,aim.x-sx), d=Math.min(620,dist(c,aim));
        const ex=clampW(sx+Math.cos(ang)*d), ey=clampW(sy+Math.sin(ang)*d);
        setHeroAnim(g,c,'r',0.82,ang); c.untargetable=true; c.order={type:'hold'};
        addEffect(g,{kind:'leapTrail',x:sx,y:sy,x2:ex,y2:ey,color:'#ffc45a',dur:0.7,unit:c});
        addDelayed(g,0.68,()=>{ if(c.dead){c.untargetable=false;return;} c.untargetable=false; c.x=ex; c.y=ey; c.forgeStacks=3;
          addEffect(g,{kind:'starCrater',x:ex,y:ey,r:250,color:'rgba(255,171,55,.88)',dur:0.85});
          for(const e of enemiesIn(g,c.team,ex,ey,250)){
            const bonusAd=Math.max(0,c.stat('ad')-(c.def.base.ad+c.def.base.adG*(c.level-1)));
            dealDamage(g,c,e,(150+125*l)+1.1*bonusAd,'phys');
            dealDamage(g,c,e,0.18*(e.maxHp-e.hp),'magic');
            if(Math.hypot(e.x-ex,e.y-ey)<125+e.radius) addBuff(e,{id:'landuoRstun',dur:1.25,stun:true,fx:'#ffd36a'});
          }
        });
      }
    },
  ],
},
{
  id:'garen', name:'盖伦', title:'德玛西亚之力', char:'盖', color:'#4a7ab5',
  ranged:false, range:95,
  base:{hp:660, hpG:98, mp:0, mpG:0, hp5:8, mp5:0, ad:66, adG:4.5, armor:38, armG:4.2, mr:32, mrG:1.5, as:0.66, asG:2.9, ms:172},
  passive:'坚韧：脱战 7 秒后每秒回复 1.5% 最大生命值。',
  skillOrder:['E','Q','W'],
  build:['dshield','boots','warmog','tabi','bc','randuin','visage','thorn'],
  abilities:[
    { key:'Q', name:'致命打击', icon:'⚔', maxLvl:5, aim:'self', cd:[8,7.5,7,6.5,6], mana:[0,0,0,0,0],
      desc:l=>`移动速度提升 30%，持续 1.5 秒；强化下次普攻，额外造成 ${30+25*l} (+50%AD) 物理伤害。`,
      ai:{when:'engage', range:300},
      cast(g,c){ addBuff(c,{id:'garenQ_ms',dur:1.5,stats:{msPct:30}});
        c.empowerAA={dmg:30+25*this._l(c)+0.5*c.stat('ad'), type:'phys', until:g.t+4.5, fx:'#f5d76e'}; }
    },
    { key:'W', name:'勇气', icon:'🛡', maxLvl:5, aim:'self', cd:[20,19,18,17,16], mana:[0,0,0,0,0],
      desc:l=>`获得 ${60+35*l} 点护盾并减免 30% 伤害，持续 3 秒。`,
      ai:{when:'defend', range:350},
      cast(g,c){ const l=this._l(c); addShield(c, 60+35*l, 3); addBuff(c,{id:'garenW',dur:3,stats:{dr:30}, fx:'#d8c98a'}); }
    },
    { key:'E', name:'审判', icon:'🌀', maxLvl:5, aim:'self', cd:[12,11,10,9,8], mana:[0,0,0,0,0],
      desc:l=>`旋转大剑 3 秒，每 0.5 秒对周围敌人造成 ${9+7*l} (+36%AD) 物理伤害。`,
      ai:{when:'engage', range:180},
      cast(g,c){ const l=this._l(c);
        addBuff(c,{id:'garenE',dur:3,spin:true,tickEvery:0.5,onTick:(g,u)=>{
          addEffect(g,{kind:'ring',x:u.x,y:u.y,r:120,color:'rgba(220,220,255,.5)',dur:0.3});
          for(const e of enemiesIn(g,u.team,u.x,u.y,120)) dealDamage(g,u,e,(9+7*l)+0.36*u.stat('ad'),'phys');
        }});}
    },
    { key:'R', name:'德玛西亚正义', icon:'⚜', maxLvl:3, aim:'unit', range:210, cd:[110,95,80], mana:[0,0,0],
      desc:l=>`召唤德玛西亚之剑处决目标，造成 ${100+100*l} + 25% 已损失生命值的魔法伤害。`,
      ai:{when:'execute', range:210},
      cast(g,c,aim){ const t=aim.unit; if(!t) return false; const l=this._l(c);
        addEffect(g,{kind:'sword',x:t.x,y:t.y,dur:0.5,color:'#ffd75e'});
        dealDamage(g,c,t, 100+100*l + 0.25*(t.maxHp-t.hp), 'magic'); }
    },
  ],
},
{
  id:'annie', name:'安妮', title:'黑暗之女', char:'安', color:'#c0538a',
  ranged:true, range:313, projSpeed:700,
  base:{hp:560, hpG:88, mp:418, mpG:25, hp5:5.5, mp5:8, ad:52, adG:2.7, armor:23, armG:4, mr:30, mrG:1.3, as:0.61, asG:1.4, ms:167},
  passive:'嗜火：每施放 4 次技能后，下一个伤害性技能会晕眩目标 1.25 秒。',
  skillOrder:['Q','W','E'],
  build:['dring','sorcs','luden','rabadon','zhonya','rylai','cloak'],
  abilities:[
    { key:'Q', name:'崩裂晃动', icon:'🔥', maxLvl:5, aim:'unit', range:330, cd:[4,4,4,4,4], mana:[60,65,70,75,80],
      desc:l=>`投掷火球，造成 ${45+35*l} (+80%AP) 魔法伤害。`,
      ai:{when:'harass', range:330},
      cast(g,c,aim){ const t=aim.unit; if(!t) return false; const l=this._l(c);
        spawnProj(g,{x:c.x,y:c.y,target:t,speed:700,team:c.team,color:'#ff7b3c',r:9,
          onHit:(g,u)=>{ annieHit(g,c,u,(45+35*l)+0.8*c.stat('ap')); }}); annieCount(g,c); }
    },
    { key:'W', name:'焚烧', icon:'🌋', maxLvl:5, aim:'pos', range:310, cd:[8,8,8,8,8], mana:[70,80,90,100,110],
      desc:l=>`喷出扇形烈焰，造成 ${45+40*l} (+85%AP) 魔法伤害。`,
      ai:{when:'harass', range:300},
      cast(g,c,aim){ const l=this._l(c); const ang=Math.atan2(aim.y-c.y, aim.x-c.x);
        addEffect(g,{kind:'cone',x:c.x,y:c.y,ang,spread:0.55,r:310,color:'rgba(255,110,40,.55)',dur:0.35});
        for(const e of enemiesIn(g,c.team,c.x,c.y,310)){
          const a2=Math.atan2(e.y-c.y,e.x-c.x); let d=Math.abs(a2-ang); if(d>Math.PI)d=2*Math.PI-d;
          if(d<0.55) annieHit(g,c,e,(45+40*l)+0.85*c.stat('ap'));
        } annieCount(g,c); }
    },
    { key:'E', name:'熔岩护盾', icon:'🔆', maxLvl:5, aim:'self', cd:[12,12,12,12,12], mana:[40,40,40,40,40],
      desc:l=>`获得 ${40+30*l} (+40%AP) 点护盾并提升 20% 移速，持续 1.5 秒。`,
      ai:{when:'defend', range:400},
      cast(g,c){ const l=this._l(c); addShield(c,(40+30*l)+0.4*c.stat('ap'),3);
        addBuff(c,{id:'annieE',dur:1.5,stats:{msPct:20}}); annieCount(g,c); }
    },
    { key:'R', name:'提伯斯之怒', icon:'🐻', maxLvl:3, aim:'pos', range:300, cd:[110,100,90], mana:[100,100,100],
      desc:l=>`召唤提伯斯砸向地面，造成 ${150+125*l} (+75%AP) 魔法伤害，并留下持续 4 秒的燃烧区域。`,
      ai:{when:'burst', range:300},
      cast(g,c,aim){ const l=this._l(c);
        addEffect(g,{kind:'blast',x:aim.x,y:aim.y,r:150,color:'rgba(255,90,30,.7)',dur:0.5});
        for(const e of enemiesIn(g,c.team,aim.x,aim.y,150)) annieHit(g,c,e,(150+125*l)+0.75*c.stat('ap'));
        addZone(g,{x:aim.x,y:aim.y,r:150,team:c.team,dur:4,tickEvery:1,color:'rgba(255,80,20,.22)',
          onTick:(g,u)=>dealDamage(g,c,u,25+0.1*c.stat('ap'),'magic')});
        annieCount(g,c); }
    },
  ],
},
{
  id:'ashe', name:'艾希', title:'寒冰射手', char:'艾', color:'#6db8d8',
  ranged:true, range:300, projSpeed:800,
  base:{hp:610, hpG:91, mp:280, mpG:16, hp5:4, mp5:7, ad:59, adG:3, armor:26, armG:4.2, mr:30, mrG:1.3, as:0.66, asG:3.3, ms:167},
  passive:'冰霜射击：普攻使目标减速 20%，持续 1.5 秒。',
  skillOrder:['W','Q','E'],
  build:['dsword','berserker','bfsword','ie','shiv','btk','bow'],
  aaOnHit(g,c,t){ addBuff(t,{id:'frost',dur:1.5,slow:20, fx:'#9fd8ef'}); },
  abilities:[
    { key:'Q', name:'射手的专注', icon:'🎯', maxLvl:5, aim:'self', cd:[13,12,11,10,9], mana:[50,50,50,50,50],
      desc:l=>`攻击速度提升 ${25+15*l}%，持续 4 秒。`,
      ai:{when:'engage', range:320},
      cast(g,c){ const l=this._l(c); addBuff(c,{id:'asheQ',dur:4,stats:{as:25+15*l}, fx:'#bfe8f7'}); }
    },
    { key:'W', name:'万箭齐发', icon:'🏹', maxLvl:5, aim:'pos', range:620, cd:[9,8.5,8,7.5,7], mana:[75,75,75,75,75],
      desc:l=>`射出一片箭雨，每支造成 ${20+18*l} (+60%AD) 物理伤害并减速 30%。`,
      ai:{when:'harass', range:600},
      cast(g,c,aim){ const l=this._l(c); const ang=Math.atan2(aim.y-c.y,aim.x-c.x);
        const hitSet=new Set();
        for(let i=-2;i<=2;i++){
          const a=ang+i*0.14;
          spawnProj(g,{x:c.x,y:c.y,dir:a,speed:850,maxDist:620,team:c.team,color:'#bfeaff',r:6,pierce:true,hitSet,
            onHit:(g,u)=>{ dealDamage(g,c,u,(20+18*l)+0.6*c.stat('ad'),'phys');
              addBuff(u,{id:'asheW',dur:1.5,slow:30, fx:'#9fd8ef'}); }});
        } }
    },
    { key:'E', name:'鹰击长空', icon:'🦅', maxLvl:5, aim:'self', cd:[60,55,50,45,40], mana:[0,0,0,0,0],
      desc:l=>`派出冰晶雄鹰侦察全图，获得 5 秒全地图视野。`,
      ai:{when:'never'},
      cast(g,c){ g.revealUntil[c.team]=g.t+5; if(c===g.player) announce(g,'获得全图视野',{color:'#9fd8ef',small:true}); }
    },
    { key:'R', name:'魔法水晶箭', icon:'💎', maxLvl:3, aim:'pos', range:99999, cd:[95,80,65], mana:[100,100,100],
      desc:l=>`向全图射出巨型水晶箭，对命中的第一个敌方英雄造成 ${200+200*l} (+100%AP) 魔法伤害并晕眩（距离越远晕眩越久，最多 3.5 秒）。`,
      ai:{when:'burst', range:900},
      cast(g,c,aim){ const l=this._l(c); const ang=Math.atan2(aim.y-c.y,aim.x-c.x); const sx=c.x, sy=c.y;
        spawnProj(g,{x:c.x,y:c.y,dir:ang,speed:800,maxDist:99999,team:c.team,color:'#7fd4ff',r:16,big:true,champOnly:true,
          onHit:(g,u)=>{
            const d=Math.hypot(u.x-sx,u.y-sy);
            dealDamage(g,c,u,(200+200*l)+1.0*c.stat('ap'),'magic');
            addBuff(u,{id:'asheR',dur:Math.min(3.5,Math.max(1,d/700)),stun:true, fx:'#bfe8f7'});
            addEffect(g,{kind:'blast',x:u.x,y:u.y,r:130,color:'rgba(140,220,255,.7)',dur:0.5});
            for(const e of enemiesIn(g,c.team,u.x,u.y,130)) if(e!==u) dealDamage(g,c,e,(100+100*l)/1,'magic');
          }}); }
    },
  ],
},
{
  id:'lux', name:'拉克丝', title:'光辉女郎', char:'光', color:'#e8c95c',
  ranged:true, range:295, projSpeed:750,
  base:{hp:580, hpG:89, mp:400, mpG:24, hp5:4.5, mp5:8, ad:54, adG:2.7, armor:22, armG:4, mr:30, mrG:1.3, as:0.63, asG:1.7, ms:165},
  passive:'光芒四射：技能命中会点燃目标（此复刻版中未实装标记引爆）。',
  skillOrder:['E','Q','W'],
  build:['dring','sorcs','luden','rabadon','zhonya','rylai','cloak'],
  abilities:[
    { key:'Q', name:'光之束缚', icon:'⛓', maxLvl:5, aim:'pos', range:650, cd:[10,9.5,9,8.5,8], mana:[50,55,60,65,70],
      desc:l=>`射出光球，禁锢最多 2 个敌人 1.5 秒并造成 ${40+40*l} (+65%AP) 魔法伤害。`,
      ai:{when:'harass', range:640},
      cast(g,c,aim){ const l=this._l(c); const ang=Math.atan2(aim.y-c.y,aim.x-c.x); let hits=0;
        spawnProj(g,{x:c.x,y:c.y,dir:ang,speed:850,maxDist:650,team:c.team,color:'#ffe9a8',r:10,pierce:true,hitSet:new Set(),
          onHit:(g,u,p)=>{ if(hits>=2){p.deadP=true;return;} hits++;
            dealDamage(g,c,u,(40+40*l)+0.65*c.stat('ap'),'magic');
            addBuff(u,{id:'luxQ',dur:1.5,root:true, fx:'#ffe9a8'});
            if(hits>=2) p.deadP=true; }}); }
    },
    { key:'W', name:'曲光屏障', icon:'🪞', maxLvl:5, aim:'self', cd:[13,12.5,12,11.5,11], mana:[60,60,60,60,60],
      desc:l=>`为自己和附近队友提供 ${45+25*l} (+35%AP) 点护盾。`,
      ai:{when:'defend', range:400},
      cast(g,c){ const l=this._l(c); const v=(45+25*l)+0.35*c.stat('ap');
        addShield(c,v,2.5);
        for(const a of g.champs) if(a!==c && a.team===c.team && !a.dead && dist(a,c)<350) addShield(a,v,2.5);
        addEffect(g,{kind:'ring',x:c.x,y:c.y,r:350,color:'rgba(255,240,180,.4)',dur:0.4}); }
    },
    { key:'E', name:'透光奇点', icon:'🌟', maxLvl:5, aim:'pos', range:550, cd:[10,9.5,9,8.5,8], mana:[70,75,80,85,90],
      desc:l=>`制造减速 30% 的光域，2.5 秒后引爆，造成 ${45+40*l} (+70%AP) 魔法伤害。`,
      ai:{when:'harass', range:540},
      cast(g,c,aim){ const l=this._l(c);
        addZone(g,{x:aim.x,y:aim.y,r:160,team:c.team,dur:2.5,tickEvery:0.4,color:'rgba(255,230,150,.25)',
          onTick:(g,u)=>addBuff(u,{id:'luxE',dur:0.5,slow:30}),
          onExpire:(g,z)=>{ addEffect(g,{kind:'blast',x:z.x,y:z.y,r:160,color:'rgba(255,230,150,.7)',dur:0.4});
            for(const e of enemiesIn(g,c.team,z.x,z.y,160)) dealDamage(g,c,e,(45+40*l)+0.7*c.stat('ap'),'magic'); }}); }
    },
    { key:'R', name:'终极闪光', icon:'💥', maxLvl:3, aim:'pos', range:1700, cd:[70,60,50], mana:[100,100,100],
      desc:l=>`短暂吟唱后射出终极激光，对直线上所有敌人造成 ${200+150*l} (+100%AP) 魔法伤害。`,
      ai:{when:'burst', range:1400},
      cast(g,c,aim){ const l=this._l(c); const ang=Math.atan2(aim.y-c.y,aim.x-c.x);
        const sx=c.x, sy=c.y, ex=sx+Math.cos(ang)*1700, ey=sy+Math.sin(ang)*1700;
        addBuff(c,{id:'luxRcast',dur:0.45,root:true});
        addEffect(g,{kind:'line',x:sx,y:sy,x2:ex,y2:ey,color:'rgba(255,250,200,.35)',w:20,dur:0.45});
        addDelayed(g,0.45,()=>{ if(c.dead) return;
          addEffect(g,{kind:'line',x:sx,y:sy,x2:ex,y2:ey,color:'rgba(255,250,210,.95)',w:64,dur:0.5});
          sfx('beam');
          for(const e of enemiesIn(g,c.team,(sx+ex)/2,(sy+ey)/2,900)){
            if(distToSeg(e.x,e.y,sx,sy,ex,ey)<40+e.radius) dealDamage(g,c,e,(200+150*l)+1.0*c.stat('ap'),'magic');
          }}); }
    },
  ],
},
{
  id:'yi', name:'易', title:'无极剑圣', char:'易', color:'#9d7bd8',
  ranged:false, range:90,
  base:{hp:600, hpG:100, mp:250, mpG:14, hp5:7.5, mp5:7, ad:66, adG:3.5, armor:33, armG:4.2, mr:32, mrG:1.5, as:0.68, asG:2.5, ms:177},
  passive:'双重打击：每第 4 次普攻会额外挥剑一次（此复刻版中以攻速体现）。',
  skillOrder:['Q','E','W'],
  build:['dsword','berserker','bfsword','ie','btk','shiv','bow'],
  abilities:[
    { key:'Q', name:'阿尔法突袭', icon:'⚡', maxLvl:5, aim:'unit', range:320, cd:[13,12,11,10,9], mana:[50,50,50,50,50],
      desc:l=>`突进斩击目标及附近敌人，造成 ${20+25*l} (+90%AD) 物理伤害。`,
      ai:{when:'engage', range:320},
      cast(g,c,aim){ const t=aim.unit; if(!t) return false; const l=this._l(c);
        addEffect(g,{kind:'dash',x:c.x,y:c.y,x2:t.x,y2:t.y,color:'rgba(180,140,255,.7)',dur:0.3});
        c.x=clampW(t.x+30); c.y=clampW(t.y+30);
        const dmg=(20+25*l)+0.9*c.stat('ad');
        dealDamage(g,c,t,dmg,'phys'); let n=0;
        for(const e of enemiesIn(g,c.team,t.x,t.y,220)){ if(e!==t&&n<3){ dealDamage(g,c,e,dmg,'phys'); n++; } } }
    },
    { key:'W', name:'冥想', icon:'🧘', maxLvl:5, aim:'self', cd:[20,18,16,14,12], mana:[40,40,40,40,40],
      desc:l=>`原地冥想 2.5 秒，期间减免 55% 伤害并共回复 ${100+80*l} 生命值。`,
      ai:{when:'heal', range:0},
      cast(g,c){ const l=this._l(c);
        addBuff(c,{id:'yiW',dur:2.5,channel:true,root:true,stats:{dr:55},tickEvery:0.5,fx:'#b8f5c8',
          onTick:(g,u)=>{ healUnit(u,(100+80*l)/5); addEffect(g,{kind:'ring',x:u.x,y:u.y,r:50,color:'rgba(150,255,180,.5)',dur:0.4}); }});}
    },
    { key:'E', name:'无极剑道', icon:'🗡', maxLvl:5, aim:'self', cd:[14,13,12,11,10], mana:[0,0,0,0,0],
      desc:l=>`5 秒内普攻附带 ${12+9*l} 点真实伤害。`,
      ai:{when:'engage', range:320},
      cast(g,c){ const l=this._l(c); addBuff(c,{id:'yiE',dur:5,trueOnHit:12+9*l, fx:'#ffb0b0'}); }
    },
    { key:'R', name:'高原血统', icon:'🌪', maxLvl:3, aim:'self', cd:[85,75,65], mana:[60,60,60],
      desc:l=>`移动速度提升 35%、攻击速度提升 ${25+20*l}%，持续 7 秒。`,
      ai:{when:'engage', range:500},
      cast(g,c){ const l=this._l(c); addBuff(c,{id:'yiR',dur:7,stats:{msPct:35,as:25+20*l}, fx:'#d8c0ff'}); }
    },
  ],
},
];
const CHAMP_BY_ID = Object.fromEntries(CHAMPIONS.map(c=>[c.id,c]));

/* 岚铎：基础技能在三层铸火时消耗强化，否则积累一层。 */
function landuoForge(c){
  const stacks=c.forgeStacks||0;
  if(stacks>=3){ c.forgeStacks=0; return true; }
  c.forgeStacks=Math.min(3,stacks+1); return false;
}
function setHeroAnim(g,c,type,dur,angle){ c.heroAnim={type,start:g.t,dur,angle:angle===undefined?c.faceAngle:angle}; }

/* 安妮被动计数 */
function annieCount(g,c){ c.annieStack=(c.annieStack||0)+1; if(c.annieStack>=5) c.annieStack=5; }
function annieHit(g,c,t,dmg){
  dealDamage(g,c,t,dmg,'magic');
  if(c.annieStack>=4){ c.annieStack=0; addBuff(t,{id:'annieStun',dur:1.25,stun:true, fx:'#ffd0e8'}); }
}

/* ---------- 召唤师技能 ---------- */
const SUMMONER_SPELLS = {
  flash:{ key:'D', name:'闪现', icon:'⚡', cd:210, desc:'向鼠标方向瞬移一小段距离。',
    cast(g,c,aim){ const d=Math.min(210,Math.hypot(aim.x-c.x,aim.y-c.y)); const a=Math.atan2(aim.y-c.y,aim.x-c.x);
      addEffect(g,{kind:'ring',x:c.x,y:c.y,r:40,color:'rgba(255,230,120,.8)',dur:0.4});
      c.x=clampW(c.x+Math.cos(a)*d); c.y=clampW(c.y+Math.sin(a)*d);
      addEffect(g,{kind:'ring',x:c.x,y:c.y,r:40,color:'rgba(255,230,120,.8)',dur:0.4}); sfx('flash'); } },
  heal:{ key:'F', name:'治疗术', icon:'➕', cd:140, desc:'回复 100 + 20×等级 生命值，并短暂加速。',
    cast(g,c){ healUnit(c,100+20*c.level); addBuff(c,{id:'healMs',dur:1,stats:{msPct:30}});
      addEffect(g,{kind:'ring',x:c.x,y:c.y,r:70,color:'rgba(120,255,150,.8)',dur:0.5}); sfx('heal'); } },
};

/* ---------- 地图几何 ---------- */
function reflect(p){ return {x:WORLD-p.x, y:WORLD-p.y}; }

const LANE_PATHS_BLUE = {
  mid:[{x:1050,y:5950},{x:1560,y:5450},{x:2380,y:4740},{x:3500,y:3500},{x:4620,y:2260},{x:5440,y:1550},{x:5950,y:1050}],
  top:[{x:950,y:5900},{x:700,y:5350},{x:660,y:5000},{x:600,y:3850},{x:560,y:2100},{x:620,y:1050},{x:1050,y:620},{x:2040,y:540},{x:3730,y:600},{x:5000,y:660},{x:5650,y:750},{x:6050,y:1100}],
};
LANE_PATHS_BLUE.bot = LANE_PATHS_BLUE.top.slice().reverse().map(reflect);

// 防御塔：tier 1=外塔 2=内塔 3=高地塔 4=门牙塔
const TOWER_DEFS_BLUE = [
  {lane:'top', tier:1, x:560,  y:2100},
  {lane:'top', tier:2, x:600,  y:3850},
  {lane:'top', tier:3, x:660,  y:5000},
  {lane:'mid', tier:1, x:2380, y:4740},
  {lane:'mid', tier:2, x:1560, y:5450},
  {lane:'mid', tier:3, x:1180, y:5830},
  {lane:'bot', tier:1, x:4960, y:6460},
  {lane:'bot', tier:2, x:3270, y:6400},
  {lane:'bot', tier:3, x:2000, y:6340},
  {lane:'nexus', tier:4, x:830,  y:5960},
  {lane:'nexus', tier:4, x:1040, y:6170},
];
const INHIB_DEFS_BLUE = [
  {lane:'top', x:715, y:5330},
  {lane:'mid', x:1000, y:6000},
  {lane:'bot', x:1670, y:6290},
];
const NEXUS_POS = { blue:{x:600,y:6400}, red:reflect({x:600,y:6400}) };
const FOUNTAIN_POS = { blue:{x:330,y:6670}, red:reflect({x:330,y:6670}) };
const DRAGON_POS = {x:4350,y:4350};
const BARON_POS  = {x:2650,y:2650};

/* ---------- 常量 ---------- */
const CFG = {
  minionWaveEvery:30, firstWave:15,
  meleeMinion:{hp:475, ad:12, range:35, ms:145, gold:21, xp:60, radius:13},
  casterMinion:{hp:290, ad:24, range:280, ms:145, gold:14, xp:30, radius:12, projSpeed:600},
  cannonMinion:{hp:950, ad:40, range:300, ms:145, gold:60, xp:92, radius:17, projSpeed:600},
  superMinion:{hp:1600, ad:65, range:40, ms:160, gold:45, xp:95, radius:18},
  towerHp:[0,3800,4000,4200,4500], towerAd:170, towerRange:430, towerRadius:34,
  inhibHp:3600, inhibRespawn:180, nexusHp:5500,
  visionRadius:950, xpRadius:700, passiveGoldPerSec:2.0, startGold:500,
  aggroRadius:300, champAggroRadius:320,
  respawnBase:8, respawnPerLvl:2.2,
  killGold:300, assistGold:150, towerGoldKiller:250, towerGoldTeam:125,
  dragonRespawn:150, baronRespawn:360,
};

function xpToLevel(l){ return 180 + 100*(l-1); }  // 升到 l+1 级所需
