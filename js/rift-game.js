'use strict';
const ROLE_NAMES={top:'上路',jungle:'打野',mid:'中路',bot:'下路',support:'辅助'};
function createDraft(champId,role){
  const available=CHAMPIONS.filter(c=>c.id!==champId),blue=[{def:CHAMP_BY_ID[champId],role}],red=[];
  const preferences={top:['garen','darius','malphite'],jungle:['yi','malphite','darius','garen'],mid:['ahri','lux','annie'],bot:['ashe','caitlyn'],support:['soraka','lux','annie','malphite']};
  const take=(list,r)=>{const id=preferences[r].find(id=>available.some(c=>c.id===id));const i=Math.max(0,available.findIndex(c=>c.id===id)),def=available.splice(i,1)[0];if(def)list.push({def,role:r});};
  for(const r of Object.keys(ROLE_NAMES))if(r!==role)take(blue,r);
  for(const r of Object.keys(ROLE_NAMES))take(red,r);
  return {blue,red};
}
class JungleMonster extends Unit {
  constructor(def){super({type:'monster',...def,team:null,home:{x:def.x,y:def.y},radius:def.kind==='scuttle'?20:30,maxHp:def.hp,hp:def.hp,range:75,armor:20,mr:20,as:.7,ms:130,dead:true,respawnAt:def.kind==='scuttle'?210:90});}
  update(g,dt){
    if(this.isStunned())return;
    const t=this.atkTarget;
    if(t&&!t.dead&&!t.untargetable&&dist(t,this.home)<450&&dist(this,this.home)<550){if(this.ad>0)moveAndAttack(g,this,t,dt);}
    else {this.atkTarget=null;if(dist(this,this.home)>8)stepToward(this,this.home.x,this.home.y,this.ms*dt);this.hp=Math.min(this.maxHp,this.hp+this.maxHp*.15*dt);}
  }
}
class Pet extends Unit {
  constructor(g,owner,pos,rank){super({type:'pet',kind:'tibbers',owner,team:owner.team,x:pos.x,y:pos.y,radius:32,maxHp:800+500*rank+.75*owner.stat('ap'),hp:800+500*rank+.75*owner.stat('ap'),ad:25+25*rank+.15*owner.stat('ap'),armor:30+rank*20,mr:30+rank*20,range:75,as:.75,ms:185,until:g.t+45});this.name='提伯斯';}
  update(g,dt){
    if(g.t>=this.until){this.dead=true;return;}if(this.isStunned())return;
    if(!this.atkTarget||this.atkTarget.dead||dist(this,this.atkTarget)>700)this.atkTarget=enemiesIn(g,this.team,this.x,this.y,500).sort((a,b)=>dist(this,a)-dist(this,b))[0];
    if(this.atkTarget)moveAndAttack(g,this,this.atkTarget,dt);else if(!this.owner.dead&&dist(this,this.owner)>150)stepToward(this,this.owner.x,this.owner.y,this.ms*dt);
    if(g.t>=(this.auraAt||0)){this.auraAt=g.t+.5;for(const u of enemiesIn(g,this.team,this.x,this.y,100))dealDamage(g,this,u,10+.06*this.owner.stat('ap'),'magic');}
  }
}
const originalMonsterKilled=monsterKilled;
monsterKilled=function(g,killer,u){
  if(u instanceof JungleMonster){u.respawnAt=g.t+(u.kind==='blue'||u.kind==='red'?300:135);if(killer&&u.buff)addBuff(killer,{id:u.buff,dur:120,fx:u.kind==='blue'?'#56b5f4':'#f38353',stats:u.kind==='blue'?{mp5:35}:{hp5:15}});return;}
  originalMonsterKilled(g,killer,u);
};
function championTakedown(g,killer,u){
  if(u.type==='champ'){
    for(const c of g.champs){if(c.team===u.team||c.dead||!(c===killer||g.t-(u.recentDmg[c.id]??-99)<10))continue;
      if(c.def.id==='ahri'){healUnit(c,70+12*c.level+.3*c.stat('ap'));if(g.t<(c.ahriRUntil||0)){c.ahriDashes++;c.ahriRUntil=g.t+10;}}
      if(c.def.id==='yi'){for(let i=0;i<3;i++)c.abilities[i].readyAt=g.t+Math.max(0,c.abilities[i].readyAt-g.t)*.3;const b=c.buffs.find(b=>b.id==='yiR');if(b)b._expire+=7;}
    }
  }
  if(killer?.def.id==='ahri'&&(u.type==='minion'||u.type==='monster')){killer.soulCount=(killer.soulCount||0)+1;if(killer.soulCount>=9){killer.soulCount=0;healUnit(killer,30+8*killer.level);}}
}
function setupRiftGame(g,options){
  g.mode=options.mode||'classic';g.training=g.mode==='practice';g.practiceBots=false;g.freeCooldowns=false;g.wardReadyAt=0;
  const draft=createDraft(g.player.def.id,options.lane||g.player.def.role||'mid');
  g.champs=[];
  for(const team of ['blue','red'])for(const pick of draft[team]){const c=new Champion(pick.def,team,{displayName:pick.def.name,lane:pick.role==='support'?'bot':pick.role,role:pick.role});c.isBot=!(team==='blue'&&pick.def.id===g.player.def.id);c.x=FOUNTAIN_POS[team].x+Math.random()*100-50;c.y=FOUNTAIN_POS[team].y+Math.random()*100-50;if(c.isBot)botAutoSkill(c);else g.player=c;
    Object.assign(c,terrainLanding(c,c,true));if(c.role==='jungle')c.summs[1]={def:SUMMONER_SPELLS.smite,readyAt:0};g.champs.push(c);}
  for(const m of g.monsters){m.dead=true;m.respawnAt=m.kind==='baron'?1200:300;}
  g.monsters.push(...JUNGLE_CAMPS.map(d=>new JungleMonster(d)));
  g._unitsCacheT=-1;
  if(g.training){
    g.champs=[g.player];g.player.x=3150;g.player.y=3850;g.player.level=18;g.player.skillPoints=0;g.player.gold=15000;g.player.abilities.forEach(a=>a.lvl=a.def.maxLvl);
    Object.assign(g.player,terrainLanding(g.player,g.player,true));
    for(let i=0;i<4;i++){const c=new Champion(CHAMP_BY_ID[i===3?'soraka':'garen'],i===3?'blue':'red',{displayName:i===3?'友方训练目标':'训练目标 '+(i+1),lane:'mid'});c.isDummy=true;c.x=i===3?3000:3470+i*140;c.y=i===3?3900:3520+i*110;const p=terrainLanding(c,c,true);c.x=p.x;c.y=p.y;c.hp=i===3?200:c.hp;g.champs.push(c);}
    g.nextWaveAt=Infinity;g.monsters.forEach(m=>{m.dead=false;m.respawnAt=0;});refreshPractice(g,false);
  }
}
function refreshPractice(g,notify=true){
  const p=g.player;p.dead=false;p.maxHp=p.stat('maxHp');p.maxMp=p.stat('maxMp');p.hp=p.maxHp;p.mp=p.maxMp;p._prevMaxHp=p.maxHp;p._prevMaxMp=p.maxMp;p.untargetable=false;
  for(const a of p.abilities){a.readyAt=0;if(a.def.maxCharges)a.charges=a.def.maxCharges;}
  p.summs.forEach(s=>s.readyAt=0);p.focus=4;p.focusUntil=g.t+120;p.annieStack=4;p.ahriRLock=0;g.wardReadyAt=0;
  if(notify)announce(g,'状态与冷却已重置',{small:true,color:'#a9e2cd'});
}
function updateRiftSystems(g,dt){
  g.wards=g.wards.filter(w=>g.t<w.until);
  if(g.training&&g.freeCooldowns){const p=g.player;p.mp=p.maxMp;for(const a of p.abilities){a.readyAt=0;if(a.def.maxCharges)a.charges=a.def.maxCharges;}}
  for(const c of g.champs){
    if(c.isDummy){if(c.dead&&g.t>=c.respawnAt){c.dead=false;c.hp=c.maxHp;}continue;}
    if(c.dead){c.untargetable=false;continue;}
    for(const a of c.abilities)if(a.def.maxCharges&&a.charges<a.def.maxCharges&&g.t>=a.rechargeAt){a.charges++;a.rechargeAt=g.t+lvlv(a.def.cd,Math.max(1,a.lvl));a.readyAt=a.charges>0?0:a.rechargeAt;}
    if(c.focusUntil&&g.t>c.focusUntil)c.focus=0;
    if(c.def.id==='malphite'&&g.t-(c.lastHostileDmgAt??-99)>10&&!c.shields.some(s=>s.granite)){const shield={amt:c.maxHp*.1,until:Infinity,granite:true};c.shields.push(shield);}
    if(c.def.id==='soraka'){
      const low=g.champs.find(u=>u!==c&&u.team===c.team&&!u.dead&&u.hp/u.maxHp<.4&&dist(c,u)<1250);
      if(low&&c.order.type==='move'){const a={x:c.order.x-c.x,y:c.order.y-c.y},b={x:low.x-c.x,y:low.y-c.y};if(a.x*b.x+a.y*b.y>0)addBuff(c,{id:'salvation',dur:.2,stats:{msPct:70}});}
    }
    if(c.hasBuff('baron')){for(const m of g.minions)if(!m.dead&&m.team===c.team&&dist(c,m)<550&&!m.hasBuff('baronMinion')){addBuff(m,{id:'baronMinion',dur:1,stats:{dr:40},fx:'#bb83f2'});}}
    const enemyF=FOUNTAIN_POS[enemyTeam(c.team)];if(dist(c,enemyF)<300&&!g.training)dealDamage(g,null,c,1500*dt,'true');
  }
}
const baseUpdateChamp=Game.prototype.updateChamp;
Game.prototype.updateChamp=function(c,dt){if(c.isDummy){if(c.dead&&this.t>=c.respawnAt){c.dead=false;c.hp=c.maxHp;}return;}baseUpdateChamp.call(this,c,dt);if(c.order.type==='attackmove'&&!c.dead&&!c.isStunned()&&!c.untargetable&&!c.buffs.some(b=>b.charm)){const t=this.units().filter(u=>!u.dead&&!u.untargetable&&u.team&&u.team!==c.team&&u.attackable!==false&&u.visibleTo(c.team)&&dist(c,u)<c.stat('range')+110).sort((a,b)=>dist(c,a)-dist(c,b))[0];if(t)moveAndAttack(this,c,t,dt);else if(!c.isRooted()&&stepToward(c,c.order.x,c.order.y,c.stat('ms')*dt))c.order={type:'hold'};}};
const baseBotThink=botThink;
botThink=function(g,c,dt){
  if(g.training&&!g.practiceBots)return;
  if(c.role==='jungle'&&!c.dead&&c.hp/c.maxHp>.28){
    if(!c._jungleThink||g.t>=c._jungleThink){c._jungleThink=g.t+.4;
      const camps=g.monsters.filter(m=>!m.dead&&(m.side===c.team||m.kind==='scuttle')&&m instanceof JungleMonster);
      const target=camps.sort((a,b)=>dist(c,a)-dist(c,b))[0];
      if(target){c.order={type:'attack',unit:target};botCast(g,c,target);if(target.hp<600&&c.summs[1].def===SUMMONER_SPELLS.smite)c.castSumm(g,1,{unit:target});return;}
      const near=enemiesIn(g,c.team,c.x,c.y,700).find(u=>u.type==='champ');if(near){c.order={type:'attack',unit:near};botCast(g,c,near);return;}
      const home=g.monsters.find(m=>m.side===c.team&&m.kind==='blue');if(home){c.order={type:'move',x:home.x,y:home.y};return;}
    }else return;
  }
  if(c.role==='jungle'){const lane=c.lane;c.lane='mid';baseBotThink(g,c,dt);c.lane=lane;}else baseBotThink(g,c,dt);
};
const baseBotCast=botCast;
botCast=function(g,c,target){
  if(c.def.id==='soraka'){
    const ally=g.champs.filter(u=>u!==c&&!u.dead&&u.team===c.team&&dist(c,u)<275&&u.hp/u.maxHp<.7).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];if(ally)c.castAbility(g,1,{unit:ally});
    if(g.champs.some(u=>!u.dead&&u.team===c.team&&u.hp/u.maxHp<.3))c.castAbility(g,3,{});
  }
  baseBotCast(g,c,target);
  if(c.def.id==='lux'&&c.luxZone&&g.t-c.luxZone.t0>.3&&dist(c.luxZone,target)<c.luxZone.r)c.castAbility(g,2,{x:target.x,y:target.y});
};
function computeRiftVision(g){
  if(g.t<(g.nextVisionAt||0))return;g.nextVisionAt=g.t+.12;
  const units=g.units();g.visionSources={blue:[],red:[]};
  for(const team of ['blue','red']){
    const sources=units.filter(u=>!u.dead&&u.team===team).map(u=>({x:u.x,y:u.y,r:u.type==='minion'?500:CFG.visionRadius,brush:brushAt(u)}));
    sources.push(...g.wards.filter(w=>w.team===team).map(w=>({...w,brush:brushAt(w)})));g.visionSources[team]=sources;
    const key=team==='blue'?'visBlue':'visRed';
    for(const u of units){if(u.team===team||['tower','inhib','nexus'].includes(u.type)){u[key]=true;continue;}if(g.training&&g.practiceReveal||g.t<g.revealUntil[team]){u[key]=true;continue;}const brush=brushAt(u);u[key]=sources.some(s=>dist(s,u)<s.r&&(brush<0||s.brush===brush||s.scout)&&(typeof visionLineClear==='function'?visionLineClear(s,u):mapLineClear(s,u,0)));}
  }
}
SUMMONER_SPELLS.flash.cast=function(g,c,aim){const p=terrainLanding(c,{x:c.x+(aim.x-c.x)/(dist(c,aim)||1)*Math.min(200,dist(c,aim)),y:c.y+(aim.y-c.y)/(dist(c,aim)||1)*Math.min(200,dist(c,aim))},true);ring(g,c,50,'#ffe894');c.x=p.x;c.y=p.y;c._nav=null;ring(g,c,50,'#ffe894');sfx('flash');};
SUMMONER_SPELLS.heal.cast=function(g,c){const ally=g.champs.filter(u=>u!==c&&!u.dead&&u.team===c.team&&dist(c,u)<425).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];for(const u of [c,ally].filter(Boolean)){healUnit(u,65+15*c.level);addBuff(u,{id:'healMs',dur:1,stats:{msPct:30}});ring(g,u,65,'#9ce8b0');}sfx('heal');};
SUMMONER_SPELLS.smite={key:'F',name:'惩戒',icon:'惩',iconImage:'assets/riot/spells/SummonerSmite.png',cd:90,desc:'对范围内的野怪造成 600 点真实伤害。',cast(g,c,aim){let u=aim?.unit;if(!u||u.type!=='monster')u=g.monsters.filter(m=>!m.dead&&dist(c,m)<250).sort((a,b)=>dist(c,a)-dist(c,b))[0];if(!u||u.dead||dist(c,u)>300)return false;dealDamage(g,c,u,600,'true');ring(g,u,70,'#ffe89a');}};
function placeWard(g,aim){if(g.paused||g.over||g.player.dead||g.t<g.wardReadyAt)return;const p=g.player,d=dist(p,aim),a=Math.atan2(aim.y-p.y,aim.x-p.x);const pos=terrainLanding(p,{x:p.x+Math.cos(a)*Math.min(d,300),y:p.y+Math.sin(a)*Math.min(d,300)},true);g.wards.push({...pos,team:p.team,r:450,until:g.t+90});g.wardReadyAt=g.t+120;ring(g,pos,45,'#89d9b0');}
