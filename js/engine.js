/* ============ 游戏引擎：实体 / 战斗 / AI ============ */
"use strict";

let UID = 1;
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function clampW(v){ return Math.max(30, Math.min(WORLD-30, v)); }
function distToSeg(px,py,x1,y1,x2,y2){
  const dx=x2-x1, dy=y2-y1, L2=dx*dx+dy*dy;
  let t = L2? ((px-x1)*dx+(py-y1)*dy)/L2 : 0; t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-(x1+dx*t), py-(y1+dy*t));
}
function enemyTeam(t){ return t===TEAM_BLUE? TEAM_RED : TEAM_BLUE; }

/* ---------- 基础单位 ---------- */
class Unit {
  constructor(o){
    this.id=UID++; this.buffs=[]; this.shields=[]; this.dead=false;
    this.lastDmgAt=-99; this.recentDmg={}; this.nextAtk=0; this.faceAngle=0;
    this.visBlue=true; this.visRed=true;
    Object.assign(this,o);
  }
  hasBuff(id){ return this.buffs.some(b=>b.id===id); }
  isStunned(){ return this.buffs.some(b=>b.stun); }
  isRooted(){ return this.buffs.some(b=>b.stun||b.root); }
  buffStat(k){ let v=0; for(const b of this.buffs) if(b.stats&&b.stats[k]) v+=b.stats[k]; return v; }
  slowPct(){ let v=0; for(const b of this.buffs) if(b.slow) v=Math.max(v,b.slow); return v; }
  drPct(){ let v=0; for(const b of this.buffs) if(b.stats&&b.stats.dr) v=Math.max(v,b.stats.dr); return v; }
  shieldTotal(){ return this.shields.reduce((s,x)=>s+x.amt,0); }
  visibleTo(team){ return team===TEAM_BLUE? this.visBlue : this.visRed; }
}

function addBuff(u, b){
  if(u.dead) return;
  b.until = (b.until!==undefined)? b.until : null; // set in tick using dur
  b._expire = gameRef.t + b.dur;
  b._lastTick = gameRef.t;
  // 同 id 刷新
  const i = u.buffs.findIndex(x=>x.id===b.id);
  if(i>=0) u.buffs[i]=b; else u.buffs.push(b);
  if(b.channel) u.order = {type:'hold'};
}
function addShield(u, amt, dur){ if(!u.dead) u.shields.push({amt, until:gameRef.t+dur}); }
function healUnit(u, amt){ if(!u.dead) u.hp = Math.min(u.maxHp, u.hp+amt); }
function addEffect(g,e){ e.t0=g.t; g.effects.push(e); }
function addZone(g,z){ z.t0=g.t; z._expire=g.t+z.dur; z._lastTick=g.t; g.zones.push(z); }
function addDelayed(g,dt,fn){ g.delayed.push({t:g.t+dt, fn}); }

function enemiesIn(g, team, x, y, r){
  const out=[]; const et=enemyTeam(team);
  for(const u of g.units()){
    if(u.dead || u.untargetable) continue;
    if(u.type==='tower'||u.type==='inhib'||u.type==='nexus') continue;
    if(u.type==='monster'){ if(Math.hypot(u.x-x,u.y-y)<=r+u.radius) out.push(u); continue; }
    if(u.team!==et) continue;
    if(Math.hypot(u.x-x,u.y-y)<=r+u.radius) out.push(u);
  }
  return out;
}

/* ---------- 伤害与击杀 ---------- */
function effArmor(u,type){ return type==='phys'? (u.stat? u.stat('armor'):u.armor||0) : type==='magic'? (u.stat? u.stat('mr'):u.mr||0) : 0; }

function dealDamage(g, src, tgt, amt, type){
  if(!tgt || tgt.dead || tgt.invulnerable || amt<=0) return 0;
  const def = Math.max(0, effArmor(tgt,type));
  let dmg = amt * 100/(100+def);
  dmg *= (1 - (tgt.drPct? tgt.drPct():0)/100);
  // 护盾吸收
  for(const s of tgt.shields){
    if(dmg<=0) break;
    const a=Math.min(s.amt,dmg); s.amt-=a; dmg-=a;
  }
  tgt.shields = tgt.shields.filter(s=>s.amt>0.5);
  if(dmg>0) tgt.hp -= dmg;
  tgt.lastDmgAt = g.t;
  if(src){
    src.lastDmgAt = g.t; // 双方进入战斗状态
    // 打断回城
    if(tgt.order && tgt.order.type==='recall'){ tgt.order={type:'hold'}; if(tgt===g.player) announce(g,'回城被打断',{small:true,color:'#e88'}); }
    // 冥想等引导不被打断（仅回城打断）
    const champSrc = src.type==='champ'? src : (src.owner && src.owner.type==='champ'? src.owner : null);
    if(champSrc && tgt.type==='champ') tgt.recentDmg[champSrc.id]=g.t;
    // 塔的仇恨：英雄攻击敌方英雄
    if(champSrc && tgt.type==='champ'){
      for(const tw of g.towers) if(!tw.dead && tw.team===tgt.team && dist(tw,champSrc)<CFG.towerRange+40) tw.aggroChamp={u:champSrc, t:g.t};
    }
    // 中立生物反击
    if(tgt.type==='monster' && !tgt.atkTarget) tgt.atkTarget=champSrc||src;
  }
  if(tgt.hp<=0) killUnit(g, src, tgt);
  return dmg;
}

function champKiller(src){
  if(!src) return null;
  if(src.type==='champ') return src;
  if(src.owner && src.owner.type==='champ') return src.owner;
  return null;
}

function killUnit(g, src, u){
  if(u.dead) return;
  u.dead=true; u.hp=0; u.buffs=[]; u.shields=[];
  const killer = champKiller(src);
  if(u.type==='minion' || u.type==='monster'){
    // 经验分享
    const xpTeam = enemyTeam(u.team||'neutral')||null;
    const gainers = g.champs.filter(c=>!c.dead && (u.team? c.team!==u.team : true) && dist(c,u)<CFG.xpRadius);
    for(const c of gainers) giveXP(g,c, u.xp/Math.max(1,gainers.length) * (gainers.length>1?1.3:1));
    if(killer && (!u.team || killer.team!==u.team)){ killer.gold+=u.gold; if(u.type==='minion') killer.cs++; }
    if(u.type==='monster') monsterKilled(g, killer, u);
  } else if(u.type==='champ'){
    champDied(g, killer, u);
  } else if(u.type==='tower'){
    towerDied(g, killer, u);
  } else if(u.type==='inhib'){
    u.respawnAt = g.t + CFG.inhibRespawn;
    announce(g, (u.team===g.playerTeam?'我方':'敌方')+'水晶已被摧毁', {color:u.team===g.playerTeam?'#e05b5b':'#4fc3f7', speech:true});
    sfx('tower');
  } else if(u.type==='nexus'){
    g.over = { winner: enemyTeam(u.team) };
  }
}

function giveXP(g, c, xp){
  if(c.level>=18) return;
  c.xp += xp;
  while(c.level<18 && c.xp >= xpToLevel(c.level)){
    c.xp -= xpToLevel(c.level); c.level++; c.skillPoints++;
    c.hp += c.def.base.hpG;  // 升级回复成长部分
    addEffect(g,{kind:'levelup',x:c.x,y:c.y,dur:1.2,color:'#ffd75e',unit:c});
    if(c===g.player){ sfx('levelup'); }
    if(c.isBot) botAutoSkill(c);
  }
}

function champDied(g, killer, u){
  u.deaths++; u.respawnAt = g.t + Math.min(55, CFG.respawnBase + CFG.respawnPerLvl*u.level);
  u.order={type:'hold'}; u.atkTarget=null;
  addEffect(g,{kind:'blast',x:u.x,y:u.y,r:60,color:'rgba(120,120,140,.5)',dur:0.6});
  let killerName='防御塔';
  if(killer && killer!==u){
    killerName=killer.name;
    killer.kills++; killer.streak=(killer.streak||0)+1;
    let gold = CFG.killGold + Math.min(200,(u.streak||0)*60);
    killer.gold += gold;
    // 多杀
    if(g.t - (killer.lastKillAt||-99) < 11) killer.multi=(killer.multi||1)+1; else killer.multi=1;
    killer.lastKillAt=g.t;
  }
  u.streak=0;
  // 助攻
  for(const c of g.champs){
    if(c===killer||c.team===u.team||c.dead) continue;
    if(g.t-(u.recentDmg[c.id]||-99)<10){ c.assists++; c.gold+=CFG.assistGold; }
  }
  u.recentDmg={};
  killFeed(g, killer, u, killerName);
  // 播报
  if(!g.firstBlood){ g.firstBlood=true; announce(g,'一血！',{color:'#ff5b5b',speech:'第一滴血'}); }
  else if(killer && killer.multi>=2){
    const names={2:'双杀',3:'三杀',4:'四杀',5:'五杀'};
    announce(g, names[Math.min(5,killer.multi)]+'！', {color:'#ffb84d',speech:names[Math.min(5,killer.multi)]});
  } else if(u===g.player){ announce(g,'你已被击杀',{color:'#e05b5b',speech:'你已被击杀'}); }
  else if(killer===g.player){ announce(g,'你击杀了 '+u.name,{color:'#ffd75e',speech:'敌方英雄被击杀'}); }
  else if(u.team!==g.playerTeam){ announce(g,'敌方英雄被击杀',{small:true,color:'#9fd8ef'}); }
  else { announce(g,'我方英雄被击杀',{small:true,color:'#e08888'}); }
  sfx(u.team===g.playerTeam?'allyDeath':'kill');
}

function towerDied(g, killer, u){
  if(killer){ killer.gold += CFG.towerGoldKiller; }
  const winTeam = enemyTeam(u.team);
  for(const c of g.champs) if(c.team===winTeam) c.gold += CFG.towerGoldTeam;
  announce(g, (u.team===g.playerTeam?'我方':'敌方')+'防御塔被摧毁', {color:u.team===g.playerTeam?'#e05b5b':'#4fc3f7', speech:(u.team===g.playerTeam?'我方防御塔被摧毁':'敌方防御塔被摧毁')});
  addEffect(g,{kind:'blast',x:u.x,y:u.y,r:120,color:'rgba(255,180,80,.7)',dur:0.8});
  sfx('tower');
}

function monsterKilled(g, killer, u){
  u.respawnAt = g.t + (u.kind==='baron'? CFG.baronRespawn : CFG.dragonRespawn);
  if(!killer) return;
  const team=killer.team;
  if(u.kind==='dragon'){
    g.dragonStacks[team]++;
    for(const c of g.champs) if(c.team===team){ c.gold+=120; }
    announce(g,(team===g.playerTeam?'我方':'敌方')+'击杀了小龙',{color:'#ffb84d',speech:true});
  } else {
    for(const c of g.champs) if(c.team===team){ c.gold+=300;
      addBuff(c,{id:'baron',dur:180,stats:{ad:40,ap:60}, fx:'#c8a0ff'}); }
    announce(g,(team===g.playerTeam?'我方':'敌方')+'击杀了纳什男爵',{color:'#c86bff',speech:(team===g.playerTeam?'我方团队击杀了男爵':'敌方团队击杀了男爵')});
  }
  sfx('kill');
}

/* ---------- 投射物 ---------- */
function spawnProj(g,o){ o.t0=g.t; o.travelled=0; if(!o.r)o.r=8; g.projectiles.push(o); }

function updateProjectiles(g,dt){
  for(const p of g.projectiles){
    if(p.deadP) continue;
    if(p.target){ // 跟踪弹
      const t=p.target;
      if(t.dead){ p.deadP=true; continue; }
      const d=dist(p,t), step=p.speed*dt;
      if(d<=step+t.radius){ p.deadP=true; p.onHit&&p.onHit(g,t,p); }
      else { p.x+=(t.x-p.x)/d*step; p.y+=(t.y-p.y)/d*step; }
    } else { // 直线弹
      const step=p.speed*dt;
      const nx=p.x+Math.cos(p.dir)*step, ny=p.y+Math.sin(p.dir)*step;
      // 碰撞检测
      for(const u of g.units()){
        if(p.deadP) break;
        if(u.dead||u.untargetable) continue;
        if(u.type==='tower'||u.type==='inhib'||u.type==='nexus') continue;
        const hostile = u.type==='monster' ? false : u.team!==p.team;
        if(!hostile) continue;
        if(p.champOnly && u.type!=='champ') continue;
        if(p.hitSet && p.hitSet.has(u.id)) continue;
        if(distToSeg(u.x,u.y,p.x,p.y,nx,ny) < p.r+u.radius){
          if(p.hitSet) p.hitSet.add(u.id);
          p.onHit&&p.onHit(g,u,p);
          if(!p.pierce) p.deadP=true;
        }
      }
      p.x=nx; p.y=ny; p.travelled+=step;
      if(p.travelled>(p.maxDist||900) || p.x<0||p.y<0||p.x>WORLD||p.y>WORLD) p.deadP=true;
    }
  }
  g.projectiles = g.projectiles.filter(p=>!p.deadP);
}

/* ---------- 普攻 ---------- */
function doAutoAttack(g, u, t){
  u.faceAngle = Math.atan2(t.y-u.y, t.x-u.x);
  const fire = (victim)=>{
    let dmg = u.stat? u.stat('ad') : u.ad;
    let critted=false;
    if(u.stat && Math.random()*100 < u.stat('crit')){ dmg*=1.75; critted=true; }
    let bonus=0, bonusType=null;
    if(u.empowerAA && g.t<u.empowerAA.until){ bonus=u.empowerAA.dmg; bonusType=u.empowerAA.type; u.empowerAA=null; }
    const dealt = dealDamage(g,u,victim,dmg,'phys');
    if(bonus) dealDamage(g,u,victim,bonus,bonusType||'phys');
    // 真伤 on-hit（剑圣E）
    const tb=u.buffs&&u.buffs.find(b=>b.trueOnHit);
    if(tb) dealDamage(g,u,victim,tb.trueOnHit,'true');
    if(u.def && u.def.aaOnHit) u.def.aaOnHit(g,u,victim);
    if(u.stat && u.stat('ls')>0) healUnit(u, dealt*u.stat('ls')/100);
    if(critted) addEffect(g,{kind:'crit',x:victim.x,y:victim.y,dur:0.4,color:'#ff6b4d'});
  };
  if(u.ranged || u.type==='tower'){
    const col = u.type==='tower'? (u.team===TEAM_BLUE?'#7fb3ff':'#ff9b7f') : '#e8e8ff';
    spawnProj(g,{x:u.x,y:u.y,target:t,speed:u.projSpeed||650,team:u.team,color:col,r:u.type==='tower'?11:6,
      owner:u, onHit:(g,v)=>fire(v)});
  } else {
    addEffect(g,{kind:'slash',x:t.x,y:t.y,ang:u.faceAngle,dur:0.18,color:'#fff'});
    fire(t);
  }
  if(u.type==='champ' && u.visBlue) sfx('attack');
}

// 通用：朝目标移动并攻击
function moveAndAttack(g, u, t, dt){
  if(t.dead || t.untargetable || (t.attackable===false)){ u.atkTarget=null; return; }
  const range = (u.stat? u.stat('range') : u.range) + u.radius + t.radius;
  const d = dist(u,t);
  if(d > range){
    if(!u.isRooted()) stepToward(u, t.x, t.y, unitMS(u)*dt);
  } else {
    u.faceAngle = Math.atan2(t.y-u.y, t.x-u.x);
    const as = u.stat? u.stat('as') : u.as;
    if(g.t >= u.nextAtk){ u.nextAtk = g.t + 1/as; doAutoAttack(g,u,t); }
  }
}
function unitMS(u){ return u.stat? u.stat('ms') : u.ms*(1-u.slowPct()/100); }
function stepToward(u, x, y, step){
  const d=Math.hypot(x-u.x,y-u.y); if(d<1) return true;
  const s=Math.min(step,d);
  u.x=clampW(u.x+(x-u.x)/d*s); u.y=clampW(u.y+(y-u.y)/d*s);
  u.faceAngle=Math.atan2(y-u.y+0.001,x-u.x+0.001);
  return d<=step+2;
}

/* ---------- 英雄 ---------- */
class Champion extends Unit {
  constructor(def, team, opts){
    super({type:'champ', team, def, radius:20, ...opts});
    this.name = opts.displayName || def.name;
    this.level=1; this.xp=0; this.skillPoints=1;
    this.kills=0; this.deaths=0; this.assists=0; this.cs=0;
    this.gold=CFG.startGold; this.items=[]; this.streak=0;
    this.ranged=def.ranged; this.projSpeed=def.projSpeed;
    this.abilities = def.abilities.map(a=>({def:a, lvl:0, readyAt:0}));
    this.summs = [{def:SUMMONER_SPELLS.flash, readyAt:0},{def:SUMMONER_SPELLS.heal, readyAt:0}];
    this.maxHp=this.stat('maxHp'); this.hp=this.maxHp;
    this.maxMp=this.stat('maxMp'); this.mp=this.maxMp;
    this._prevMaxHp=this.maxHp; this._prevMaxMp=this.maxMp;
    this.order={type:'hold'}; this.respawnAt=0; this.buildIdx=0;
  }
  itemStat(k){ let v=0; for(const it of this.items) if(it.stats[k]) v+=it.stats[k]; return v; }
  stat(k){
    const b=this.def.base, lv=this.level-1;
    switch(k){
      case 'ad':    return b.ad + b.adG*lv + this.itemStat('ad') + this.buffStat('ad');
      case 'ap':    { let ap=this.itemStat('ap')+this.buffStat('ap'); if(this.items.some(i=>i.passive==='rabadon')) ap*=1.35; return ap; }
      case 'maxHp': return b.hp + b.hpG*lv + this.itemStat('hp');
      case 'maxMp': return b.mp + b.mpG*lv + this.itemStat('mp');
      case 'armor': return b.armor + b.armG*lv + this.itemStat('armor') + this.buffStat('armor');
      case 'mr':    return b.mr + b.mrG*lv + this.itemStat('mr') + this.buffStat('mr');
      case 'as':    return Math.min(2.5, b.as*(1+(b.asG*lv + this.itemStat('as') + this.buffStat('as'))/100));
      case 'ms':    { let v=(b.ms + this.itemStat('ms'))*(1+this.buffStat('msPct')/100)*(1-this.slowPct()/100); return Math.max(60,v); }
      case 'crit':  return this.itemStat('crit');
      case 'ls':    return this.itemStat('ls');
      case 'cdr':   return Math.min(40, this.itemStat('cdr'));
      case 'hp5':   return b.hp5 + this.itemStat('hp5');
      case 'mp5':   return b.mp5 + this.itemStat('mp5');
      case 'range': return this.def.range;
    }
    return 0;
  }
  canLevel(i){
    const a=this.abilities[i];
    if(this.skillPoints<=0 || a.lvl>=a.def.maxLvl) return false;
    if(i===3) return this.level>=[6,11,16][a.lvl];
    return a.lvl < Math.ceil(this.level/2);
  }
  levelUp(i){ if(this.canLevel(i)){ this.abilities[i].lvl++; this.skillPoints--; return true; } return false; }
  abilityReady(i){
    const a=this.abilities[i];
    return a.lvl>0 && gameRef.t>=a.readyAt && this.mp>=lvlv(a.def.mana,a.lvl) && !this.dead && !this.isStunned() && !this.hasBuff('luxRcast');
  }
  castAbility(g, i, aim){
    if(!this.abilityReady(i)) return false;
    const a=this.abilities[i], def=a.def;
    // 目标类校验
    if(def.aim==='unit'){
      if(!aim.unit || aim.unit.dead || aim.unit.team===this.team) return false;
      if(dist(this,aim.unit)>def.range+aim.unit.radius) return false;
    }
    if(def.aim==='pos' && def.range<9000){
      const d=dist(this,aim); if(d>def.range){ const a2=Math.atan2(aim.y-this.y,aim.x-this.x);
        aim={x:this.x+Math.cos(a2)*def.range, y:this.y+Math.sin(a2)*def.range}; }
    }
    // 打断引导（冥想）
    this.buffs=this.buffs.filter(b=>!b.channel);
    def._l = (c)=>a.lvl;
    const ok = def.cast(g,this,aim);
    if(ok===false) return false;
    a.readyAt = g.t + lvlv(def.cd,a.lvl)*(1-this.stat('cdr')/100);
    this.mp -= lvlv(def.mana,a.lvl);
    this.lastDmgAt=g.t;
    if(this.visBlue) sfx('spell');
    return true;
  }
  castSumm(g, i, aim){
    const s=this.summs[i];
    if(g.t<s.readyAt || this.dead || this.isStunned()) return false;
    s.def.cast(g,this,aim||{x:this.x,y:this.y});
    s.readyAt=g.t+s.def.cd;
    return true;
  }
}

/* ---------- 小兵 ---------- */
class Minion extends Unit {
  constructor(g, kind, team, lane){
    const c=CFG[kind+'Minion'];
    const scale = 1 + Math.floor(g.t/90)*0.03; // 随时间成长
    const path = team===TEAM_BLUE? g.lanePaths[lane] : g.lanePathsRev[lane];
    super({type:'champ'===kind?null:'minion', kind, team, lane,
      x:path[0].x+(Math.random()*60-30), y:path[0].y+(Math.random()*60-30),
      radius:c.radius, maxHp:c.hp*scale, hp:c.hp*scale, ad:c.ad*scale, armor:0, mr:0,
      range:c.range, ms:c.ms, as:0.75, gold:Math.round(c.gold*(scale>1.3?1.3:scale)), xp:c.xp,
      ranged:c.range>100, projSpeed:c.projSpeed, wpIdx:1, path});
    this.name = {melee:'近战兵', caster:'法师兵', cannon:'炮车', super:'超级兵'}[kind];
    if(kind==='super'){ this.armor=30; this.mr=30; }
  }
  update(g,dt){
    if(this.isStunned()) return;
    // 索敌（每 0.4s）
    if(!this._nextThink || g.t>this._nextThink){
      this._nextThink=g.t+0.4;
      if(!this.atkTarget || this.atkTarget.dead || dist(this,this.atkTarget)>560){
        this.atkTarget=null;
        let best=null, bd=1e9;
        for(const u of g.units()){
          if(u.dead||u.untargetable||u.team===this.team||u.type==='monster'||!u.team) continue;
          if(u.attackable===false) continue;
          const pref = u.type==='minion'?0 : u.type==='champ'?150 : 40; // 优先小兵
          const d=dist(this,u)+pref;
          const maxD = u.type==='tower'||u.type==='inhib'||u.type==='nexus'? 260 : CFG.aggroRadius;
          if(dist(this,u)<maxD+u.radius && d<bd){ bd=d; best=u; }
        }
        this.atkTarget=best;
      }
    }
    if(this.atkTarget){ moveAndAttack(g,this,this.atkTarget,dt); return; }
    // 沿路线推进
    const wp=this.path[Math.min(this.wpIdx,this.path.length-1)];
    if(stepToward(this, wp.x, wp.y, unitMS(this)*dt) && this.wpIdx<this.path.length-1) this.wpIdx++;
  }
}

/* ---------- 建筑 ---------- */
class Tower extends Unit {
  constructor(def, team){
    super({type:'tower', team, lane:def.lane, tier:def.tier,
      x: team===TEAM_BLUE? def.x : WORLD-def.x, y: team===TEAM_BLUE? def.y : WORLD-def.y,
      radius:CFG.towerRadius, maxHp:CFG.towerHp[def.tier], hp:CFG.towerHp[def.tier],
      armor:55, mr:55, range:CFG.towerRange, as:0.8, ad:CFG.towerAd, heat:0});
    this.name='防御塔';
  }
  get attackable(){
    if(this.tier===1) return true;
    const g=gameRef;
    if(this.tier===4) return g.inhibs.some(i=>i.team===this.team && i.dead);
    const prev = g.towers.find(t=>t.team===this.team && t.lane===this.lane && t.tier===this.tier-1);
    return !prev || prev.dead;
  }
  update(g,dt){
    // 选目标：优先小兵，仇恨英雄优先
    let t=this.atkTarget;
    if(t && (t.dead || t.untargetable || dist(this,t)>this.range+t.radius+20)) t=null;
    if(this.aggroChamp && g.t-this.aggroChamp.t<2.5 && !this.aggroChamp.u.dead && dist(this,this.aggroChamp.u)<this.range+30){
      t=this.aggroChamp.u;
    }
    if(!t){
      let best=null,bd=1e9;
      for(const u of g.units()){
        if(u.dead||u.untargetable||u.team===this.team||!u.team||u.type==='monster') continue;
        if(u.type==='tower'||u.type==='inhib'||u.type==='nexus') continue;
        const d=dist(this,u); if(d>this.range+u.radius) continue;
        const pref=u.type==='minion'?0:500;
        if(d+pref<bd){ bd=d+pref; best=u; }
      }
      t=best; this.heat=0;
    }
    if(this.atkTarget!==t){ this.heat=0; this.atkTarget=t; }
    if(t && g.t>=this.nextAtk){
      this.nextAtk=g.t+1/this.as;
      const mult = t.type==='champ'? 1+Math.min(4,this.heat)*0.25 : 1;
      const dmg=this.ad*mult;
      spawnProj(g,{x:this.x,y:this.y-40,target:t,speed:750,team:this.team,r:11,owner:this,
        color:this.team===TEAM_BLUE?'#7fb3ff':'#ff8f6f',
        onHit:(g,v)=>dealDamage(g,this,v,dmg,'phys')});
      if(t.type==='champ') this.heat++;
    }
  }
}

class Building extends Unit {
  constructor(type, team, pos, hp, radius, lane){
    super({type, team, lane, x:pos.x, y:pos.y, radius, maxHp:hp, hp, armor:20, mr:20});
    this.name = type==='inhib'?'水晶':'水晶枢纽';
  }
  get attackable(){
    const g=gameRef;
    if(this.type==='inhib'){
      const t3=g.towers.find(t=>t.team===this.team&&t.lane===this.lane&&t.tier===3);
      return !t3 || t3.dead;
    }
    // 枢纽：两座门牙塔均被摧毁
    return g.towers.filter(t=>t.team===this.team&&t.tier===4).every(t=>t.dead);
  }
}

/* ---------- 中立生物 ---------- */
class Monster extends Unit {
  constructor(kind){
    const isB = kind==='baron';
    const pos = isB? BARON_POS : DRAGON_POS;
    super({type:'monster', kind, team:null, x:pos.x, y:pos.y, home:pos,
      radius:isB?42:32, maxHp:isB?9000:3800, hp:isB?9000:3800,
      ad:isB?220:110, armor:40, mr:40, range:isB?200:150, as:0.6, ms:120, ranged:false,
      xp:isB?600:250, gold:0});
    this.name = isB?'纳什男爵':'远古巨龙';
  }
  update(g,dt){
    const t=this.atkTarget;
    if(t && !t.dead && dist({x:this.home.x,y:this.home.y},t)<700){
      moveAndAttack(g,this,t,dt);
    } else {
      this.atkTarget=null;
      if(dist(this,this.home)>10) stepToward(this,this.home.x,this.home.y,this.ms*dt);
      else if(this.hp<this.maxHp) this.hp=Math.min(this.maxHp,this.hp+this.maxHp*0.05*dt*60/60+this.maxHp*0.04*dt);
    }
  }
}

/* ---------- 游戏状态 ---------- */
let gameRef=null;

class Game {
  constructor(playerChampId){
    gameRef=this;
    this.t=0; this.paused=false; this.over=null; this.firstBlood=false;
    this.playerTeam=TEAM_BLUE;
    this.effects=[]; this.projectiles=[]; this.zones=[]; this.delayed=[];
    this.revealUntil={blue:0, red:0};
    this.dragonStacks={blue:0, red:0};
    this.waveNum=0; this.nextWaveAt=CFG.firstWave;
    this.lanePaths=LANE_PATHS_BLUE;
    this.lanePathsRev={}; for(const k in LANE_PATHS_BLUE) this.lanePathsRev[k]=LANE_PATHS_BLUE[k].slice().reverse();

    // 建筑
    this.towers=[]; this.inhibs=[]; this.nexuses=[];
    for(const team of [TEAM_BLUE,TEAM_RED]){
      for(const d of TOWER_DEFS_BLUE) this.towers.push(new Tower(d,team));
      for(const d of INHIB_DEFS_BLUE){
        const p = team===TEAM_BLUE? d : reflect(d);
        this.inhibs.push(new Building('inhib',team,p,CFG.inhibHp,26,d.lane));
      }
      this.nexuses.push(new Building('nexus',team,NEXUS_POS[team],CFG.nexusHp,46));
    }
    this.monsters=[new Monster('dragon'), new Monster('baron')];
    this.minions=[];

    // 英雄阵容
    const others = CHAMPIONS.filter(c=>c.id!==playerChampId);
    const shuffled = others.slice().sort(()=>Math.random()-0.5);
    const enemyPicks = CHAMPIONS.slice().sort(()=>Math.random()-0.5);
    this.champs=[];
    // 玩家：中路
    this.player = new Champion(CHAMP_BY_ID[playerChampId], TEAM_BLUE, {displayName:'你', lane:'mid'});
    this.champs.push(this.player);
    const allyLanes=['top','bot','bot','mid'];
    shuffled.forEach((def,i)=>{
      const b=new Champion(def, TEAM_BLUE, {displayName:'电脑·'+def.name, lane:allyLanes[i]});
      b.isBot=true; this.champs.push(b);
    });
    const enemyLanes=['mid','top','bot','bot','mid'];
    enemyPicks.forEach((def,i)=>{
      const b=new Champion(def, TEAM_RED, {displayName:'电脑·'+def.name, lane:enemyLanes[i]});
      b.isBot=true; this.champs.push(b);
    });
    // 出生点
    for(const c of this.champs){
      const f=FOUNTAIN_POS[c.team];
      c.x=f.x+(Math.random()*160-80); c.y=f.y+(Math.random()*160-80);
      c.x=clampW(c.x); c.y=clampW(c.y);
      if(c.isBot) botAutoSkill(c);
    }
  }
  units(){ // 所有可交互单位
    if(this._unitsCacheT===this.t && this._unitsCache) return this._unitsCache;
    this._unitsCache=[...this.champs, ...this.minions, ...this.towers, ...this.inhibs, ...this.nexuses, ...this.monsters];
    this._unitsCacheT=this.t;
    return this._unitsCache;
  }
  teamKills(team){ return this.champs.filter(c=>c.team===team).reduce((s,c)=>s+c.kills,0); }

  update(dt){
    if(this.over) return;
    this.t+=dt;
    // 延迟回调
    for(const d of this.delayed) if(this.t>=d.t && !d.done){ d.done=true; d.fn(); }
    this.delayed=this.delayed.filter(d=>!d.done);
    // 兵线
    if(this.t>=this.nextWaveAt){ this.spawnWave(); this.nextWaveAt+=CFG.minionWaveEvery; }
    // buff / 护盾 / 区域
    for(const u of this.units()){
      if(u.dead) continue;
      for(const b of u.buffs){
        if(b.tickEvery && this.t-b._lastTick>=b.tickEvery){ b._lastTick=this.t; b.onTick&&b.onTick(this,u); }
      }
      u.buffs=u.buffs.filter(b=>this.t<b._expire && !u.dead);
      u.shields=u.shields.filter(s=>this.t<s.until && s.amt>0.5);
    }
    for(const z of this.zones){
      if(this.t-z._lastTick>=z.tickEvery){ z._lastTick=this.t;
        for(const e of enemiesIn(this,z.team,z.x,z.y,z.r)) z.onTick&&z.onTick(this,e); }
      if(this.t>=z._expire && !z.doneZ){ z.doneZ=true; z.onExpire&&z.onExpire(this,z); }
    }
    this.zones=this.zones.filter(z=>!z.doneZ);
    // 水晶重生
    for(const i of this.inhibs) if(i.dead && this.t>=i.respawnAt){ i.dead=false; i.hp=i.maxHp; }
    // 野怪重生
    for(const m of this.monsters) if(m.dead && this.t>=m.respawnAt){ m.dead=false; m.hp=m.maxHp; m.x=m.home.x; m.y=m.home.y; m.atkTarget=null; }
    // 视野
    this.computeVision();
    // 单位更新
    for(const c of this.champs) this.updateChamp(c,dt);
    for(const m of this.minions) if(!m.dead) m.update(this,dt);
    for(const t of this.towers) if(!t.dead) t.update(this,dt);
    for(const m of this.monsters) if(!m.dead) m.update(this,dt);
    updateProjectiles(this,dt);
    // 小兵分离（防止重叠成一点）
    this.separateMinions();
    this.minions=this.minions.filter(m=>!m.dead);
    this.effects=this.effects.filter(e=>this.t-e.t0<e.dur);
  }

  spawnWave(){
    this.waveNum++;
    if(this.waveNum===1) announce(this,'全军出击！',{color:'#ffd75e',speech:'全军出击'});
    for(const team of [TEAM_BLUE,TEAM_RED]){
      for(const lane of ['top','mid','bot']){
        const enemyInhib=this.inhibs.find(i=>i.team===enemyTeam(team)&&i.lane===lane);
        for(let i=0;i<3;i++) this.minions.push(new Minion(this,'melee',team,lane));
        for(let i=0;i<3;i++) this.minions.push(new Minion(this,'caster',team,lane));
        if(this.waveNum%3===0) this.minions.push(new Minion(this,'cannon',team,lane));
        if(enemyInhib && enemyInhib.dead) this.minions.push(new Minion(this,'super',team,lane));
      }
    }
  }

  updateChamp(c,dt){
    // 死亡与复活
    if(c.dead){
      if(this.t>=c.respawnAt){
        c.dead=false; c.hp=c.maxHp; c.mp=c.maxMp;
        const f=FOUNTAIN_POS[c.team]; c.x=f.x; c.y=f.y; c.order={type:'hold'}; c.atkTarget=null;
      }
      return;
    }
    // 属性成长导致的上限变动
    const mh=c.stat('maxHp'), mm=c.stat('maxMp');
    if(mh!==c._prevMaxHp){ c.hp+=Math.max(0,mh-c._prevMaxHp); c._prevMaxHp=mh; }
    if(mm!==c._prevMaxMp){ c.mp+=Math.max(0,mm-c._prevMaxMp); c._prevMaxMp=mm; }
    c.maxHp=mh; c.maxMp=mm;
    c.hp=Math.min(c.hp,mh); c.mp=Math.min(c.mp,mm);
    // 回复
    c.hp=Math.min(mh, c.hp + c.stat('hp5')/5*dt);
    c.mp=Math.min(mm, c.mp + c.stat('mp5')/5*dt);
    // 盖伦被动：脱战回复
    if(c.def.id==='garen' && this.t-c.lastDmgAt>7) healUnit(c, mh*0.015*dt);
    // 泉水
    const f=FOUNTAIN_POS[c.team];
    if(dist(c,f)<400){ c.hp=Math.min(mh,c.hp+mh*0.09*dt); c.mp=Math.min(mm,c.mp+mm*0.12*dt); }
    // 被动金币
    if(this.t>30) c.gold += CFG.passiveGoldPerSec*dt;
    // AI
    if(c.isBot) botThink(this,c,dt);
    // 眩晕
    if(c.isStunned()) return;
    // 回城
    if(c.order.type==='recall'){
      if(this.t>=c.order.doneAt){
        c.x=f.x; c.y=f.y; c.order={type:'hold'};
        addEffect(this,{kind:'ring',x:f.x,y:f.y,r:60,color:'rgba(120,180,255,.8)',dur:0.6});
        if(c.isBot) botShopping(this,c);
      }
      return;
    }
    // 引导（冥想）：不移动不攻击
    if(c.buffs.some(b=>b.channel)) return;
    // 执行指令
    if(c.order.type==='attack'){
      const t=c.order.unit;
      if(!t||t.dead||t.untargetable||(t.attackable===false)){ c.order={type:'hold'}; }
      else if(t.type!=='monster' && t.team && !t.visibleTo(c.team)){ c.order={type:'move',x:t.x,y:t.y}; }
      else { moveAndAttack(this,c,t,dt); return; }
    }
    if(c.order.type==='move'){
      if(c.isRooted()) return;
      if(stepToward(c,c.order.x,c.order.y,c.stat('ms')*dt)) c.order={type:'hold'};
      return;
    }
    if(c.order.type==='hold'){
      // 自动反击：附近敌人（仅玩家不自动，AI 在 botThink 处理）—— 玩家站立时自动攻击靠近的敌人（仿 LoL 站立 AA）
      if(!c.isBot){
        if(!c.atkTarget||c.atkTarget.dead||dist(c,c.atkTarget)>c.stat('range')+60){
          c.atkTarget=null;
          let bd=1e9,best=null;
          for(const u of this.units()){
            if(u.dead||u.untargetable||!u.team||u.team===c.team||u.type==='tower'||u.type==='inhib'||u.type==='nexus') continue;
            if(!u.visibleTo(c.team)) continue;
            const d=dist(c,u); if(d<c.stat('range')+u.radius+c.radius && d<bd){bd=d;best=u;}
          }
          c.atkTarget=best;
        }
        if(c.atkTarget) moveAndAttackHold(this,c,dt);
      }
    }
  }

  startRecall(c){
    if(c.dead) return;
    c.order={type:'recall', doneAt:this.t+8};
    c.atkTarget=null;
    if(c===this.player) sfx('recall');
  }

  separateMinions(){
    const ms=this.minions;
    for(let i=0;i<ms.length;i++){
      const a=ms[i]; if(a.dead) continue;
      for(let j=i+1;j<ms.length;j++){
        const b=ms[j]; if(b.dead) continue;
        const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy), min=a.radius+b.radius;
        if(d<min&&d>0.01){ const push=(min-d)/2/d;
          a.x-=dx*push*0.5; a.y-=dy*push*0.5; b.x+=dx*push*0.5; b.y+=dy*push*0.5; }
      }
    }
  }

  computeVision(){
    for(const team of [TEAM_BLUE,TEAM_RED]){
      const key = team===TEAM_BLUE?'visBlue':'visRed';
      const revealed = this.t < this.revealUntil[team];
      const sources=[];
      for(const u of this.units()){
        if(u.dead||u.team!==team) continue;
        sources.push(u);
      }
      for(const u of this.units()){
        if(u.team===team || !u.team){ u[key]=true; continue; } // 己方与中立恒可见
        if(u.type==='tower'||u.type==='inhib'||u.type==='nexus'){ u[key]=true; continue; }
        if(revealed){ u[key]=true; continue; }
        u[key]=sources.some(s=>dist(s,u)<CFG.visionRadius);
      }
    }
  }
}

// 玩家站立自动攻击（不追击太远）
function moveAndAttackHold(g,c,dt){
  const t=c.atkTarget;
  const range=c.stat('range')+c.radius+t.radius;
  if(dist(c,t)<=range){
    c.faceAngle=Math.atan2(t.y-c.y,t.x-c.x);
    if(g.t>=c.nextAtk){ c.nextAtk=g.t+1/c.stat('as'); doAutoAttack(g,c,t); }
  }
}

/* ---------- AI ---------- */
function botAutoSkill(c){
  // R 优先，然后按 skillOrder
  while(c.skillPoints>0){
    if(c.canLevel(3)){ c.levelUp(3); continue; }
    let done=false;
    for(const k of c.def.skillOrder){
      const i={Q:0,W:1,E:2}[k];
      if(c.canLevel(i)){ c.levelUp(i); done=true; break; }
    }
    if(!done){ for(let i=0;i<3;i++) if(c.canLevel(i)){ c.levelUp(i); done=true; break; } }
    if(!done) break;
  }
}

function botShopping(g,c){
  while(c.buildIdx<c.def.build.length){
    const it=ITEM_BY_ID[c.def.build[c.buildIdx]];
    if(c.gold>=it.price && c.items.length<6){ c.gold-=it.price; c.items.push(it); c.buildIdx++; }
    else break;
  }
}

function botThink(g,c,dt){
  if(!c._nextThink) c._nextThink=0;
  if(g.t<c._nextThink) return;
  c._nextThink=g.t+0.3;
  if(c.order.type==='recall') return;

  const f=FOUNTAIN_POS[c.team];
  const hpPct=c.hp/c.maxHp;
  const nearEnemies = enemiesIn(g,c.team,c.x,c.y,650).filter(u=>u.type==='champ'||u.type==='minion');
  const enemyChampsNear = nearEnemies.filter(u=>u.type==='champ' && u.visibleTo(c.team));

  // 逃跑 / 回城
  if(hpPct<0.28){
    if(nearEnemies.length===0 && dist(c,f)>500){ g.startRecall(c); return; }
    if(nearEnemies.length>0){
      // 治疗术
      if(hpPct<0.2) c.castSumm(g,0+1,null);
      c.order={type:'move',x:f.x,y:f.y}; c.atkTarget=null; return;
    }
  }
  if(dist(c,f)<420 && hpPct>0.95) botShopping(g,c);

  // 塔下危险：敌塔在射程内且没有己方小兵抗塔 → 后撤
  const dangerTower = g.towers.find(t=>!t.dead&&t.team!==c.team&&dist(t,c)<CFG.towerRange+40);
  if(dangerTower){
    const meat = g.minions.some(m=>!m.dead&&m.team===c.team&&dist(m,dangerTower)<CFG.towerRange);
    if(!meat){
      const a=Math.atan2(c.y-dangerTower.y,c.x-dangerTower.x);
      c.order={type:'move',x:clampW(c.x+Math.cos(a)*300),y:clampW(c.y+Math.sin(a)*300)}; return;
    }
  }

  // 选攻击目标
  let target=null;
  const lowChamp = enemyChampsNear.filter(u=>dist(c,u)<520).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
  if(lowChamp && (g.minions.some(m=>m.team===c.team&&!m.dead&&dist(m,c)<400) || lowChamp.hp/lowChamp.maxHp<0.5)) target=lowChamp;
  if(!target){
    const ms=nearEnemies.filter(u=>u.type==='minion').sort((a,b)=>a.hp-b.hp)[0];
    if(ms) target=ms;
  }
  if(!target){
    // 攻击建筑
    const structs=[...g.towers,...g.inhibs,...g.nexuses].filter(s=>!s.dead&&s.team!==c.team&&s.attackable&&dist(c,s)<600);
    if(structs.length){
      const meat=g.minions.some(m=>!m.dead&&m.team===c.team&&dist(m,structs[0])<CFG.towerRange);
      if(meat || structs[0].type!=='tower' || structs[0].hp<structs[0].maxHp*0.15) target=structs[0];
    }
  }

  if(target){
    c.order={type:'attack',unit:target};
    // 放技能
    if(target.type==='champ') botCast(g,c,target);
    return;
  }

  // 无目标：沿线推进（找最近路径线段，朝其下一个路点走，保证单调前进）
  const path = c.team===TEAM_BLUE? g.lanePaths[c.lane] : g.lanePathsRev[c.lane];
  let seg=0,bd=1e9;
  for(let i=0;i<path.length-1;i++){
    const d=distToSeg(c.x,c.y,path[i].x,path[i].y,path[i+1].x,path[i+1].y);
    if(d<bd){bd=d;seg=i;}
  }
  let wpi=Math.min(seg+1,path.length-1);
  if(dist(c,path[wpi])<130) wpi=Math.min(wpi+1,path.length-1);
  const wp=path[wpi];
  c.order={type:'move',x:wp.x+(Math.random()*60-30),y:wp.y+(Math.random()*60-30)};
}

function botCast(g,c,target){
  for(let i=0;i<4;i++){
    const a=c.abilities[i]; if(a.lvl===0||!c.abilityReady(i)) continue;
    const def=a.def, ai=def.ai||{};
    if(ai.when==='never') continue;
    if(ai.when==='heal'){ if(c.hp/c.maxHp<0.45 && enemiesIn(g,c.team,c.x,c.y,250).length===0) c.castAbility(g,i,{x:c.x,y:c.y}); continue; }
    if(ai.when==='defend'){ if(c.hp/c.maxHp<0.6 && dist(c,target)<(ai.range||350)) c.castAbility(g,i,{x:c.x,y:c.y,unit:c}); continue; }
    if(ai.when==='execute'){ if(target.hp/target.maxHp<0.35 && dist(c,target)<(ai.range||300)) c.castAbility(g,i,{x:target.x,y:target.y,unit:target}); continue; }
    if(ai.when==='burst'){ if((target.hp/target.maxHp<0.6||i<3) && dist(c,target)<(ai.range||500)) c.castAbility(g,i,{x:target.x,y:target.y,unit:target}); continue; }
    // engage / harass
    if(dist(c,target)<(ai.range||400)) c.castAbility(g,i,{x:target.x,y:target.y,unit:target});
  }
  // 治疗术保命在逃跑分支处理
}
