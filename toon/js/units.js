// 单位：英雄、小兵、防御建筑、野怪、训练假人、召唤物。
import * as THREE from 'three';
import { HERO_MODELS, tibbersRig } from './hero-models.js';
import { HERO_MODELS2 } from './hero-models2.js';
import { MAX_RANK, R_LEVELS, xpNeed } from './heroes.js';
import { ITEM_BY_ID, sumStats, sellPrice } from './items.js';
import { SPELLS, castSpell, updateTeleport } from './summoners.js';
import { minionModel, towerModel, inhibModel, nexusModel, dummyModel, dragonModel, baronModel, critterModel, jungleModel, TEAM_COL } from './props.js';
import { projMesh } from './vfx.js';
import { clamp } from './toon-kit.js';

let UID = 1;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export class Unit {
  constructor(world, o) {
    this.id = UID++;
    this.world = world;
    this.kind = o.kind;
    this.team = o.team;
    this.name = o.name || '';
    this.pos = new THREE.Vector3(o.x, 0, o.z);
    this.facing = o.facing ?? 0;
    this.maxHp = this.hp = o.hp;
    this.radius = o.radius ?? 0.6;
    this.baseSpeed = o.speed ?? 0;
    this.ad = o.ad ?? 0;
    this.range = o.range ?? 1.5;
    this.atkSpeed = o.atkSpeed ?? 1;
    this.atkCd = 0;
    this.buffs = [];
    this.dead = false;
    this.height = o.height ?? 2.2;
    this.obj = o.obj || new THREE.Group();
    this.path = null;
    this.target = null;
    this.lastHit = 0;
    this.lift = 0;       // 击飞高度
    this.moving = false;
    this.isStructure = false;
  }
  get alive() { return !this.dead; }
  get targetable() { return !this.dead && !this.has('untargetable'); }
  has(id) { for (const b of this.buffs) if (b.id === id) return true; return false; }
  buff(id) { return this.buffs.find(b => b.id === id); }
  addBuff(id, dur, data = {}) {
    let b = this.buff(id);
    if (b) { b.t = Math.max(b.t, dur); Object.assign(b, data); }
    else { b = { id, t: dur, dur, ...data }; this.buffs.push(b); }
    return b;
  }
  removeBuff(id) {
    const b = this.buff(id);
    if (b) { this.buffs = this.buffs.filter(x => x !== b); b.onEnd && b.onEnd(this); }
  }
  get speed() {
    let mul = 1, slow = 0;
    for (const b of this.buffs) { if (b.haste) mul += b.haste; if (b.slow) slow = Math.max(slow, b.slow); }
    return this.baseSpeed * mul * (1 - slow);
  }
  get atkMul() { let m = 1; for (const b of this.buffs) if (b.as) m += b.as; return m; }
  get stunned() { return this.has('stun') || this.has('knockup'); }
  get rooted() { return this.has('root') || this.stunned; }
  canMove() { return !this.dead && !this.rooted && !this.dashing && !(this.castLock > 0) && !this.has('channel'); }
  canAct() { return !this.dead && !this.stunned && !this.has('charm') && !this.dashing; }
  canCast() { return this.canAct() && !this.has('silence'); }
  updateBuffs(dt) {
    for (const b of this.buffs) {
      b.t -= dt;
      if (b.tick) { b.acc = (b.acc || 0) + dt; while (b.acc >= b.every) { b.acc -= b.every; b.tick(this, b); } }
    }
    if (this.buffs.some(b => b.t <= 0)) {
      const ended = this.buffs.filter(b => b.t <= 0);
      this.buffs = this.buffs.filter(b => b.t > 0);
      ended.forEach(b => b.onEnd && b.onEnd(this));
    }
  }
  dist(u) { return Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z); }
  face(x, z) { if (Math.abs(x - this.pos.x) + Math.abs(z - this.pos.z) > 0.01) this.faceTarget = Math.atan2(x - this.pos.x, z - this.pos.z); }
  turn(dt, rate = 14) {
    if (this.faceTarget === undefined) return;
    const d = angDiff(this.facing, this.faceTarget);
    this.facing += clamp(d, -rate * dt, rate * dt);
  }
  // 朝向某点移动一步；返回是否已到达
  step(dt, tx, tz, stopDist = 0.05) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d <= stopDist) return true;
    const s = Math.min(d, this.speed * dt);
    const nx = this.pos.x + dx / d * s, nz = this.pos.z + dz / d * s;
    const W = this.world;
    // 正在绕行：沿着上次找到的方向继续走一小段，避免在障碍前来回抖动
    if (this.detour && this.detour.t > 0) {
      this.detour.t -= dt;
      const dxs = Math.sin(this.detour.a) * s, dzs = Math.cos(this.detour.a) * s;
      if (W.walkable(this.pos.x + dxs, this.pos.z + dzs)) {
        this.pos.x += dxs; this.pos.z += dzs; this.face(this.pos.x + dxs, this.pos.z + dzs); this.moving = true;
        return false;
      }
      this.detour = null;
    }
    if (W.walkable(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
    else {
      // 被挡住时向两侧偏转绕行（优先保持上一次的绕行方向）
      const base = Math.atan2(dx, dz), side = this.steerSide || 1;
      let ok = false;
      for (const a of [0.6, -0.6, 1.1, -1.1, 1.6, -1.6]) {
        const ang = base + a * side;
        const sx = this.pos.x + Math.sin(ang) * s, sz = this.pos.z + Math.cos(ang) * s;
        if (W.walkable(sx, sz)) { this.pos.x = sx; this.pos.z = sz; if (a < 0) this.steerSide = -side; this.detour = { a: ang, t: 0.35 }; ok = true; break; }
      }
      if (!ok) return true;
    }
    this.face(tx, tz);
    this.moving = true;
    return d - s <= stopDist;
  }
  followPath(dt) {
    if (!this.path || !this.path.length) return true;
    const p = this.path[0];
    if (this.step(dt, p.x, p.z, 0.15)) { this.path.shift(); if (!this.path.length) { this.path = null; return true; } }
    return false;
  }
  moveTo(x, z) { this.path = this.world.findPath(this.pos, { x, z }); }
  syncObj() {
    this.obj.position.set(this.pos.x, this.lift, this.pos.z);
    this.obj.rotation.y = this.facing;
  }
  onDamaged() {}
  die(killer) {
    this.dead = true;
    this.path = null;
    this.buffs = this.buffs.filter(b => b.keepOnDeath);
  }
}

// ---------------- 英雄 ----------------
export class Hero extends Unit {
  constructor(world, def, team, x, z) {
    const rig = (HERO_MODELS[def.id] || HERO_MODELS2[def.id])();
    super(world, { kind: 'hero', team, x, z, hp: def.hp, radius: def.radius ?? 0.7, speed: def.speed, ad: def.ad, range: def.range, atkSpeed: def.atkSpeed, height: 2.6 * rig.s.scale, name: def.name, obj: rig.root });
    this.def = def;
    this.rig = rig;
    this.cds = { Q: 0, W: 0, E: 0, R: 0, D: 0, F: 0 };
    this.castLock = 0;
    this.respawnT = 0;
    this.order = null;
    this.kills = 0; this.deaths = 0; this.assists = 0;
    this.recallT = 0;
    this.spellCount = 0;
    this.pathT = 0;
    this.home = { x, z };
    // 等级与法力
    this.level = 1; this.xp = 0; this.points = 1;
    this.ranks = { Q: 0, W: 0, E: 0, R: 0 };
    this.maxMana = this.mana = def.mana || 0;
    this.manaless = !def.mana;
    // 召唤师技能
    this.spells = { D: 'flash', F: 'heal' };
    // 金币与装备
    this.gold = 0;
    this.items = [null, null, null, null, null, null];
    this.uniques = new Set();
    this.recalc();
  }
  // 根据等级与装备重新计算属性
  recalc() {
    const d = this.def, L = this.level - 1, { st, uniques } = sumStats(this.items);
    this.uniques = uniques; this.st = st;
    const oldMax = this.maxHp;
    this.maxHp = Math.round(d.hp + d.hpG * L + (st.hp || 0));
    if (!this.dead) this.hp = Math.max(1, Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - oldMax)));
    this.ad = d.ad + d.adG * L + (st.ad || 0);
    if (!this.manaless) {
      const oldMana = this.maxMana;
      this.maxMana = Math.round(d.mana + d.manaG * L + (st.mana || 0));
      this.mana = Math.min(this.maxMana, this.mana + Math.max(0, this.maxMana - oldMana));
    }
    this.armor = (d.tank ? 28 : 20) + 2.4 * L + (st.armor || 0);
    this.mr = 26 + 0.9 * L + (st.mr || 0);
    this.ap = (st.ap || 0) * (uniques.has('rabadon') ? 1.3 : 1);
    this.itemAs = st.as || 0; this.itemMs = st.ms || 0;
    this.cdr = Math.min(0.4, st.cdr || 0); this.crit = Math.min(1, st.crit || 0);
    this.ls = st.ls || 0; this.hp5 = st.hp5 || 0; this.mp5 = st.mp5 || 0; this.tenacity = st.tenacity || 0;
  }
  get atkMul() { return super.atkMul + (this.itemAs || 0); }
  get speed() { return super.speed * (1 + (this.itemMs || 0)); }
  canShop() { const W = this.world; return this.dead || !W.fountainHeal || W.fountainHeal(this) || !!(W.nearShop && W.nearShop(this)); }
  // 购买：返回 'ok' 或失败原因
  // 合成价：已拥有的组件会被消耗并抵扣价格
  costFor(id) {
    const d = ITEM_BY_ID[id], used = [], missing = [];
    let cost = d.price;
    for (const c of d.from || []) {
      const idx = this.items.findIndex((x, i) => x && x.id === c && !used.includes(i));
      if (idx >= 0) { used.push(idx); cost -= ITEM_BY_ID[c].price; } else missing.push(c);
    }
    return { cost, used, missing };
  }
  buy(id) {
    const d = ITEM_BY_ID[id];
    if (!d) return 'none';
    if (!this.canShop()) return 'far';
    const { cost, used } = this.costFor(id);
    if (this.gold < cost) return 'gold';
    if (d.boots && this.items.some((it, i) => it && ITEM_BY_ID[it.id].boots && !used.includes(i))) return 'boots';
    if (d.unique && this.items.some(it => it && it.id === id)) return 'unique';
    const backup = this.items.slice();
    for (const i of used) this.items[i] = null;
    let slot = -1;
    if (d.consumable) slot = this.items.findIndex(it => it && it.id === id && it.count < d.stack);
    if (slot < 0) slot = this.items.indexOf(null);
    if (slot < 0) { this.items = backup; return 'full'; }
    this.gold -= cost;
    if (this.items[slot]) this.items[slot].count++;
    else this.items[slot] = { id, count: 1 };
    this.recalc();
    return 'ok';
  }
  sell(slot) {
    const it = this.items[slot];
    if (!it) return 'none';
    if (!this.canShop()) return 'far';
    const d = ITEM_BY_ID[it.id];
    this.gold += sellPrice(d);
    if (d.consumable && it.count > 1) it.count--; else this.items[slot] = null;
    this.recalc();
    return 'ok';
  }
  useItem(slot) {
    const it = this.items[slot];
    if (!it || this.dead) return 'none';
    const d = ITEM_BY_ID[it.id];
    if (!d.consumable) return 'passive';
    if (this.has('potion')) return 'active';
    const W = this.world;
    this.addBuff('potion', 10, { every: 0.5, tick: (u) => { u.hp = Math.min(u.maxHp, u.hp + 7.5); } });
    W.vfx.puff(this.pos, { n: 8, color: '#ff8a8a', cell: 'heart', size: 0.4, speed: 1.5, up: 1.5, y: 1.5 });
    W.sfx('heal', this.pos, 0.6);
    if (--it.count <= 0) this.items[slot] = null;
    return 'ok';
  }
  addGold(n, show = true) {
    this.gold += n;
    if (show && n >= 1) {
      this.world.texts.push({ x: this.pos.x + 0.6, y: this.height + 1.1, z: this.pos.z, text: '+' + Math.round(n) + 'g', color: '#ffd23c', t: 0, dur: 1.0 });
      if (this.world.isPlayer && this.world.isPlayer(this)) this.world.sfx('coin');
    }
  }
  get skills() { return this.def.skills; }
  // 技能强度系数：随技能等级与英雄等级成长
  rk(key) {
    const r = Math.max(1, this.ranks[key] || 0);
    return (key === 'R' ? 0.8 + 0.45 * r : 0.95 + 0.17 * r) * (1 + 0.025 * (this.level - 1)) * (1 + (this.ap || 0) / 200);
  }
  cdOf(sk) {
    const r = Math.max(1, this.ranks[sk.key]);
    return sk.cd * (sk.key === 'R' ? 1 - 0.15 * (r - 1) : 1 - 0.06 * (r - 1)) * (1 - (this.cdr || 0) - (this.has('blueBuff') ? 0.1 : 0));
  }
  costOf(sk) { return this.manaless || this.freeMana ? 0 : Math.round((sk.mana || 0) * (1 + 0.1 * (Math.max(1, this.ranks[sk.key]) - 1))); }
  canLearn(key) {
    if (this.points <= 0 || this.ranks[key] >= MAX_RANK[key]) return false;
    if (key === 'R') return this.level >= R_LEVELS[this.ranks.R];
    return this.ranks[key] < Math.ceil(this.level / 2);
  }
  learn(key) {
    if (!this.canLearn(key)) return false;
    this.ranks[key]++; this.points--;
    const W = this.world;
    if (W.vfx) { W.vfx.puff(this.pos, { n: 8, color: '#ffe27a', cell: 'star', size: 0.45, speed: 2, up: 1.5, y: 2 }); }
    return true;
  }
  autoLearn() {
    let guard = 20;
    while (this.points > 0 && guard--) {
      if (this.canLearn('R')) { this.learn('R'); continue; }
      const k = [...this.def.skillOrder].find(k => this.canLearn(k) && this.ranks[k] === 0)
        || [...this.def.skillOrder].find(k => this.canLearn(k));
      if (!k) break;
      this.learn(k);
    }
  }
  gainXp(n) {
    if (this.level >= 18) return;
    this.xp += n;
    while (this.level < 18 && this.xp >= xpNeed(this.level)) { this.xp -= xpNeed(this.level); this.levelUp(); }
    if (this.level >= 18) this.xp = 0;
  }
  levelUp() {
    const d = this.def, W = this.world;
    this.level++; this.points++;
    this.recalc();
    if (W.isPlayer && W.isPlayer(this)) W.sfx('levelup');
    if (W.vfx && !this.dead) {
      W.vfx.ring(this.pos, { r1: 3, color: '#ffe27a', dur: 0.6 });
      W.vfx.puff(this.pos, { n: 14, color: ['#ffe27a', '#ffffff'], cell: 'spark', glow: true, size: 0.8, speed: 3, up: 2 });
    }
    W.onLevelUp && W.onLevelUp(this);
  }
  setLevel(lvl) { while (this.level < lvl) this.levelUp(); }
  stop() { this.order = null; this.path = null; }
  orderMove(x, z) {
    if (this.dead) return;
    this.cancelWindup();
    this.order = { type: 'move' };
    this.moveTo(x, z);
    this.cancelRecall();
  }
  orderAttack(u, amove = null) {
    if (this.dead || !u || !u.targetable) return;
    this.order = { type: 'attack', target: u, amove };
    this.pathT = 0;
    this.cancelRecall();
  }
  // 攻击移动：朝目标点走，途中自动攻击进入攻击范围的敌人
  orderAttackMove(x, z) {
    if (this.dead) return;
    this.order = { type: 'amove', x, z };
    this.moveTo(x, z);
    this.cancelRecall();
  }
  // 前摇阶段收到移动指令：取消这次攻击，不进入冷却
  cancelWindup() {
    if (!this.windup) return;
    this.windup = null;
    this.atkCd = 0; this.castLock = 0;
    if (this.rig.action && this.rig.action.atk) this.rig.action = null;
  }
  acquire(r) {
    let best = null, bd = 1e9;
    for (const u of this.world.units) {
      if (u.removed || !u.targetable || u.team === this.team || u.inFog || u.kind === 'dummy') continue;
      const d = this.dist(u) - u.radius + (u.isStructure ? 4 : 0);
      if (d <= r && d < bd) { bd = d; best = u; }
    }
    return best;
  }
  cancelRecall() {
    if (this.recallT > 0) {
      this.recallT = 0; this.removeBuff('recall');
      for (const e of this.recallFx || []) e.kill = true;
      this.recallFx = null; this.rig.action = null;
      this.world.sfx('error', this.pos, 0.4);
    }
  }
  recall() {
    if (this.dead || this.recallT > 0) return;
    this.stop();
    this.recallT = 4;
    this.addBuff('recall', 4);
    this.rig.play('recall', 4);
    this.world.sfx('recall', this.pos);
    this.recallFx = this.world.vfx.recall(this, 4, this.team === 1 ? '#8fd0ff' : '#ff9a8a');
  }
  cast(key, aim, target) {
    const W = this.world;
    if (this.dead) return 'dead';
    if (this.tpT > 0) return 'busy';
    if (key === 'D' || key === 'F') {
      const id = this.spells[key];
      if (this.cds[key] > 0) return 'cd';
      if (this.stunned && id !== 'cleanse') return 'cc';
      const r = castSpell(this, id, aim, target);
      if (r === 'ok') { this.cds[key] = SPELLS[id].cd; this.cancelRecall(); }
      return r;
    }
    const sk = this.def.skills.find(s => s.key === key);
    if (!sk) return 'none';
    if (!this.ranks[key]) return 'unlearned';
    if (this.cds[key] > 0) return 'cd';
    const cost = this.costOf(sk);
    if (this.mana < cost) return 'mana';
    if (!this.canCast()) return 'cc';
    if (this.castLock > 0) return 'busy';
    if (sk.canCast && !sk.canCast(W, this)) return 'cond';
    let tgt = null;
    if (sk.aim === 'unit' || sk.aim === 'ally') {
      tgt = this.findTarget(sk, aim, target);
      if (!tgt) return 'notarget';
      aim = { x: tgt.pos.x, z: tgt.pos.z };
    }
    if (sk.aim === 'point' && sk.range) {
      const d = Math.hypot(aim.x - this.pos.x, aim.z - this.pos.z);
      if (d > sk.range) aim = { x: this.pos.x + (aim.x - this.pos.x) / d * sk.range, z: this.pos.z + (aim.z - this.pos.z) / d * sk.range };
    }
    if (sk.aim !== 'self') { this.face(aim.x, aim.z); this.facing = this.faceTarget; }
    this.cancelRecall();
    this.cds[key] = this.cdOf(sk);
    this.mana -= cost;
    const wind = sk.wind ?? 0.25;
    this.castLock = sk.lock ?? wind;
    if (sk.anim) this.rig.play(sk.anim, sk.animDur ?? wind + 0.35);
    this.spellCount++;
    const a = { x: aim.x, z: aim.z };
    const fire = () => { if (!this.dead) sk.fire(W, this, a, tgt); };
    if (sk.start) sk.start(W, this, a, tgt);
    wind > 0 ? W.after(wind, fire) : fire();
    this.def.onCast && this.def.onCast(W, this, sk);
    if (sk.sfx) W.sfx(sk.sfx, this.pos);
    if (this.uniques.has('sheen')) this.addBuff('sheen', 10, { onHit: (W, h, t) => {
      W.damage(h, t, h.def.ad + h.def.adG * (h.level - 1), { type: 'phys', auto: true });
      W.vfx.spark(t.pos, '#c8a0ff', 8, 0.8); h.removeBuff('sheen');
    } });
    return 'ok';
  }
  // 指向技能会选中的目标：优先鼠标下的单位，否则取落点附近射程内最近的
  findTarget(sk, aim, target) {
    const W = this.world;
    let tgt = target && target.targetable && (sk.aim === 'ally' ? target.team === this.team : target.team !== this.team) && !target.isStructure && this.dist(target) <= sk.range + 1.5 ? target : null;
    if (!tgt) {
      const pool = sk.aim === 'ally' ? W.alliesIn(this.team, aim, 4, sk.heroOnly) : W.enemiesIn(this.team, aim, 4, { heroOnly: sk.heroOnly });
      let bd = 1e9;
      for (const u of pool) {
        if (u === this && !sk.allowSelf) continue;
        const d = Math.hypot(u.pos.x - aim.x, u.pos.z - aim.z);
        if (this.dist(u) <= sk.range + 1 && d < bd) { bd = d; tgt = u; }
      }
    }
    if (!tgt && sk.allowSelf) tgt = this;
    return tgt;
  }
  flash(aim) {
    if (this.dead || this.stunned) return 'cc';
    const W = this.world, from = { x: this.pos.x, z: this.pos.z };
    const dx = aim.x - from.x, dz = aim.z - from.z, d = Math.hypot(dx, dz) || 1, r = Math.min(d, 8);
    const to = W.clampDash(from, { x: from.x + dx / d * r, z: from.z + dz / d * r }, true);
    W.vfx.puff({ x: from.x, z: from.z }, { n: 12, color: '#fff7b0', cell: 'spark', glow: true, size: 1, speed: 3 });
    this.pos.x = to.x; this.pos.z = to.z;
    this.face(aim.x, aim.z); this.facing = this.faceTarget;
    this.path = null;
    W.vfx.puff({ x: to.x, z: to.z }, { n: 14, color: '#fff7b0', cell: 'star', size: 0.6, speed: 4 });
    W.vfx.ring({ x: to.x, z: to.z }, { r1: 2.5, color: '#fff3a0', dur: 0.35 });
    W.sfx('flash', to);
    this.cancelRecall();
    return 'ok';
  }

  update(dt) {
    const W = this.world;
    this.moving = false;
    if (this.dead) {
      this.respawnT -= dt;
      this.rig.update(dt, { dead: true });
      this.deadT = (this.deadT || 0) + dt;
      if (this.deadT > 1.6) this.obj.position.y = -Math.min(2, (this.deadT - 1.6) * 1.2);
      if (this.respawnT <= 0 && W.respawnPoint) this.respawn();
      return;
    }
    this.updateBuffs(dt);
    this.def.tick && this.def.tick(W, this, dt);
    updateTeleport(this, dt);
    for (const k in this.cds) if (this.cds[k] > 0) this.cds[k] = Math.max(0, this.cds[k] - dt * (W.cdMul || 1));
    this.atkCd -= dt;
    if (this.castLock > 0) this.castLock -= dt;
    if (this.recallT > 0) {
      this.recallT -= dt;
      if (this.recallT <= 0 && W.respawnPoint) {
        const p = W.respawnPoint(this.team), col = this.team === 1 ? '#8fd0ff' : '#ff9a8a';
        W.vfx.recallBurst(this.pos, col);
        W.sfx('recallDone', this.pos);
        this.pos.set(p.x, 0, p.z); this.path = null; this.order = null; this.recallFx = null;
        W.vfx.recallBurst(this.pos, col);
        W.sfx('recallDone', this.pos);
        this.rig.play('flex', 0.6);
        W.onRecalled && W.onRecalled(this);
      }
    }
    // 法力回复；在泉水快速回血回蓝
    if (!this.manaless) this.mana = Math.min(this.maxMana, this.mana + (this.def.manaRegen + 0.12 * this.level + this.mp5 + (this.has('blueBuff') ? 6 : 0)) * dt);
    let regen = 1.2 + 0.1 * this.level + this.hp5 + (this.has('redBuff') ? this.maxHp * 0.01 : 0);
    if (this.uniques.has('warmog') && W.time - (this.lastHit || -99) > 5) regen += this.maxHp * 0.03;
    this.hp = Math.min(this.maxHp, this.hp + regen * dt);
    if (this.uniques.has('sunfire')) {
      this.burnT = (this.burnT || 0) - dt;
      if (this.burnT <= 0) {
        this.burnT = 1;
        for (const u of W.enemiesIn(this.team, this.pos, 3.5)) W.damage(this, u, 20 + this.maxHp * 0.01, { type: 'magic', noText: true, item: true });
      }
      if (Math.random() < dt * 8) W.vfx.trail({ x: this.pos.x + (Math.random() - 0.5) * 3, y: 0.3, z: this.pos.z + (Math.random() - 0.5) * 3 }, { color: '#ff8a30', cell: 'flame', size: 0.4, vy: 1, life: 0.5 });
    }
    if (W.fountainHeal && W.fountainHeal(this)) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.12 * dt);
      this.mana = Math.min(this.maxMana, this.mana + this.maxMana * 0.15 * dt);
    }
    const charm = this.buff('charm');
    if (charm && !this.stunned && !this.dashing) {
      const s = charm.src.pos;
      const sp = this.baseSpeed; this.baseSpeed *= 0.35;
      this.step(dt, s.x, s.z, 1.2); this.baseSpeed = sp;
    } else if (!this.dashing && this.canAct()) {
      const o = this.order;
      if (o && o.type === 'amove') {
        const t = this.acquire(this.range + this.radius + 2.5);
        if (t) this.orderAttack(t, { x: o.x, z: o.z });
        else if (this.path && this.canMove()) { if (this.followPath(dt)) this.order = null; }
        else if (!this.path) this.order = null;
      } else if (o && o.type === 'attack') {
        const t = o.target;
        if (!t || !t.targetable || t.inFog) {
          // 目标没了：攻击移动时继续朝原目标点前进
          if (o.amove) this.orderAttackMove(o.amove.x, o.amove.z); else { this.order = null; this.path = null; }
        }
        else {
          const reach = this.range + t.radius + this.radius * 0.5;
          if (this.dist(t) <= reach) {
            this.path = null;
            this.face(t.pos.x, t.pos.z);
            this.tryAttack(t);
          } else if (this.canMove()) {
            this.pathT -= dt;
            if (this.pathT <= 0 || !this.path) { this.moveTo(t.pos.x, t.pos.z); this.pathT = 0.35; }
            this.followPath(dt);
          }
        }
      } else if (this.path && this.canMove()) {
        if (this.followPath(dt)) this.order = null;
      }
    }
    this.turn(dt);
    this.rig.update(dt, { moving: this.moving, speedMul: clamp(this.speed / 7, 0.7, 1.6) });
    this.syncObj();
    // 横斩出刀时剑尖留下一道拖尾
    const act = this.rig.action;
    if (this.def.hSlash && act && act.name.startsWith('hslash')) {
      const k = act.t / act.dur;
      if (k > 0.3 && k < 0.62) {
        const tp = this.tipPos();
        W.vfx.trail(tp, { color: this.def.slashColor || '#d8ffb0', glow: true, cell: 'glow', size: 0.9, life: 0.22, vy: 0, jit: 0.05 });
        W.vfx.trail(tp, { color: '#ffffff', cell: 'spark', size: 0.35, life: 0.18, vy: 0, jit: 0.05 });
      }
    }
  }
  tryAttack(t) {
    if (this.atkCd > 0 || this.castLock > 0 || !this.canAct() || this.has('noAttack')) return;
    const W = this.world, def = this.def;
    const as = this.atkSpeed * this.atkMul;
    this.atkCd = 1 / as;
    const wind = Math.min(0.28, 0.32 / as);
    this.castLock = wind;
    const anims = Array.isArray(def.atkAnim) ? def.atkAnim : [def.atkAnim || 'slash'];
    const combo = this.atkCombo = ((this.atkCombo || 0) + 1) % anims.length;
    this.rig.play(anims[combo], Math.min(0.7, 0.75 / as));
    if (this.rig.action) this.rig.action.atk = true;
    if (!def.atkProj) W.sfx('swing', this.pos, 0.7);
    const wu = this.windup = { t };
    W.after(wind, () => {
      if (this.windup !== wu) return; // 前摇被移动取消
      this.windup = null;
      if (this.dead || !t.targetable) return;
      if (def.atkProj) {
        const from = this.tipPos();
        W.sfx({ arrow: 'arrow', bullet: 'gun', fire: 'fire' }[def.atkProj] || 'orb', this.pos, 0.55);
        W.projectile({ from, target: t, speed: def.projSpeed || 26, team: this.team, owner: this, mesh: projMesh(def.atkProj, def.projColor), trail: def.projTrail,
          onHit: (u) => this.attackHit(u) });
        if (this.uniques.has('runaan')) {
          const extra = W.enemiesIn(this.team, this.pos, this.range + 1).filter(u => u !== t).slice(0, 2);
          for (const u of extra) W.projectile({ from, target: u, speed: 30, team: this.team, owner: this, mesh: projMesh('arrow', '#7ae0b0'),
            onHit: (v) => W.damage(this, v, this.ad * 0.4, { type: 'phys', auto: true }) });
        }
      } else {
        if (this.dist(t) > this.range + t.radius + 2) return;
        this.attackHit(t);
        if (def.hSlash) W.vfx.slash(this.pos, this.facing, { color: def.slashColor || '#ffffff', r: 2.1, y: 1.25, flip: combo === 1, tilt: (combo ? 1 : -1) * 0.12, spin: 2.8, dur: 0.24 });
        else W.vfx.slash(this.pos, this.facing, { color: def.slashColor || '#ffffff', r: 1.6 + this.range * 0.3, flip: Math.random() < 0.5, tilt: (Math.random() - 0.5) * 0.6 });
      }
    });
  }
  attackHit(t) {
    const W = this.world;
    let dmg = this.ad, crit = false;
    if (this.has('blind')) { W.vfx.comic(t.pos, '落空!', { color: '#c8c8c8', size: 1.4, y: 2.6 }); return; }
    if (t.isStructure) dmg *= 0.8;
    else if (Math.random() < this.crit) {
      crit = true;
      dmg *= (this.uniques.has('ie') ? 2.15 : 1.75) * (t.uniques && t.uniques.has('randuin') ? 0.7 : 1);
      W.vfx.comic(t.pos, '暴击!', { color: '#ff6a4a', size: 1.6, y: 2.6 });
    }
    const dealt = W.damage(this, t, dmg, { type: 'phys', auto: true, color: crit ? '#ff5a3a' : undefined });
    if (this.ls > 0 && dealt > 0) this.hp = Math.min(this.maxHp, this.hp + dealt * this.ls);
    if (this.uniques.has('nashor')) W.damage(this, t, 20 + this.ap * 0.15, { type: 'magic', auto: true, noText: true });
    for (const b of [...this.buffs]) if (b.onHit) b.onHit(W, this, t, b);
    if (this.def.onHitSlow) W.cc(t, 'slow', 1, { pct: 0.2, id: 'frost' });
    if (this.def.onHit && !t.isStructure) this.def.onHit(W, this, t);
    W.vfx.puff({ x: t.pos.x, z: t.pos.z }, { n: 4, color: this.def.hitColor || '#ffffff', cell: 'spark', glow: true, size: 0.6, y: t.height * 0.5, speed: 3 });
  }
  tipPos() {
    const v = new THREE.Vector3();
    if (this.rig.tip) { this.obj.updateMatrixWorld(true); this.rig.tip.getWorldPosition(v); }
    else v.set(this.pos.x, 1.5, this.pos.z);
    if (v.y < 0.5) v.y = 1.4;
    return v;
  }
  die(killer) {
    super.die(killer);
    this.deaths++;
    this.deadT = 0;
    this.respawnT = this.world.respawnTime ? this.world.respawnTime(this) : 8;
    this.castLock = 0; this.recallT = 0; this.order = null;
    this.world.sfx('death', this.pos);
    this.world.vfx.puff(this.pos, { n: 18, color: '#ffffff', cell: 'puff', size: 1.4, speed: 3 });
    this.world.vfx.comic(this.pos, '倒!', { color: '#ff6a5a' });
  }
  respawn() {
    const p = this.world.respawnPoint(this.team);
    this.dead = false; this.hp = this.maxHp; this.mana = this.maxMana; this.deadT = 0;
    this.pos.set(p.x, 0, p.z); this.path = null; this.lift = 0;
    this.rig.deadT = -1;
    this.obj.position.y = 0;
    this.world.vfx.pillar(this.pos, { color: '#fff3a0', r: 1.5, h: 10 });
    this.world.vfx.ring(this.pos, { r1: 4, color: '#fff3a0' });
  }
}

// ---------------- 小兵 ----------------
export class Minion extends Unit {
  constructor(world, team, type, lane, x, z) {
    const m = minionModel(team, type);
    const caster = type === 'caster';
    super(world, { kind: 'minion', team, x, z, hp: caster ? 260 : 380, radius: 0.5, speed: 5.2, ad: caster ? 22 : 16, range: caster ? 6.5 : 1.2, atkSpeed: caster ? 0.7 : 1.0, height: 1.3, obj: m.obj });
    this.m = m; this.type = type; this.lane = lane;
    this.laneD = lane.progressOf({ x, z });
    this.dir = team === 1 ? 1 : -1;
    this.bob = Math.random() * 6;
    this.thinkT = 0;
    this.atkAnim = 0;
  }
  update(dt) {
    const W = this.world;
    this.moving = false;
    if (this.dead) return;
    this.updateBuffs(dt);
    this.atkCd -= dt;
    if (this.castLock > 0) this.castLock -= dt;
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.3;
      if (!this.target || !this.target.targetable || this.dist(this.target) > 9) this.target = W.pickTarget(this, 7.5);
    }
    if (this.canAct()) {
      const t = this.target;
      if (t && t.targetable) {
        const reach = this.range + t.radius + this.radius;
        if (this.dist(t) <= reach) {
          this.face(t.pos.x, t.pos.z);
          if (this.atkCd <= 0) {
            this.atkCd = 1 / this.atkSpeed;
            this.atkAnim = 0.3;
            if (this.type === 'caster') {
              const from = this.pos.clone(); from.y = 1.1;
              W.projectile({ from, target: t, speed: 18, team: this.team, owner: this, mesh: projMesh('orb', TEAM_COL[this.team]), onHit: (u) => W.damage(this, u, this.ad, { noText: true }) });
            } else W.after(0.15, () => { if (!this.dead && t.targetable) W.damage(this, t, this.ad, { noText: true }); });
          }
        } else if (this.canMove()) this.step(dt, t.pos.x, t.pos.z, reach * 0.9);
      } else if (this.canMove()) {
        this.laneD = this.lane.progressOf(this.pos);
        const next = this.lane.pointAt(this.laneD + this.dir * 4);
        this.step(dt, next.x, next.z, 0.3);
      }
    }
    this.turn(dt, 8);
    // 摇摆小碎步
    this.bob += dt * (this.moving ? 14 : 3);
    const b = this.m.body;
    b.position.y = this.moving ? Math.abs(Math.sin(this.bob)) * 0.12 : Math.sin(this.bob) * 0.02;
    b.rotation.z = this.moving ? Math.sin(this.bob) * 0.12 : 0;
    this.m.feet[0].position.z = this.moving ? Math.sin(this.bob) * 0.15 : 0.02;
    this.m.feet[1].position.z = this.moving ? -Math.sin(this.bob) * 0.15 : 0.02;
    if (this.atkAnim > 0) { this.atkAnim -= dt; this.m.hand.rotation.x = -Math.sin((0.3 - this.atkAnim) / 0.3 * Math.PI) * 1.6; b.rotation.x = Math.sin((0.3 - this.atkAnim) / 0.3 * Math.PI) * 0.2; }
    else { this.m.hand.rotation.x = 0; b.rotation.x = 0; }
    this.syncObj();
  }
  die(k) {
    super.die(k);
    const W = this.world;
    W.vfx.puff(this.pos, { n: 8, color: '#ffffff', cell: 'puff', size: 0.9, speed: 2 });
    W.vfx.puff(this.pos, { n: 5, color: TEAM_COL[this.team], cell: 'star', size: 0.4, speed: 3 });
    W.sfx('minionDie', this.pos, 0.5);
    W.after(0.05, () => W.remove(this));
  }
}

// ---------------- 防御塔 / 水晶 ----------------
export class Structure extends Unit {
  constructor(world, s) {
    const model = s.kind === 'tower' ? towerModel(s.team) : s.kind === 'inhib' ? inhibModel(s.team) : nexusModel(s.team);
    const hp = s.kind === 'tower' ? (s.tier === 'outer' ? 2600 : 3000) : s.kind === 'inhib' ? 2200 : 5000;
    super(world, { kind: s.kind, team: s.team, x: s.x, z: s.z, hp, radius: s.kind === 'nexus' ? 3 : s.kind === 'tower' ? 1.4 : 1.6, ad: 120, range: s.kind === 'tower' ? 11 : 0, atkSpeed: 0.85, height: model.top, obj: model.obj });
    this.model = model; this.info = s; this.isStructure = true;
    this.t = Math.random() * 5;
    this.facing = 0;
  }
  update(dt) {
    const W = this.world;
    this.t += dt;
    const c = this.model.crystal;
    if (this.dead) { this.obj.position.y = Math.max(-3, this.obj.position.y - dt * 1.5); return; }
    this.updateBuffs(dt);
    c.rotation.y += dt * 0.8;
    c.position.y = (this.kind === 'nexus' ? 4 : this.kind === 'inhib' ? 2 : 5.9) + Math.sin(this.t * 1.5) * 0.15;
    if (this.model.ring) this.model.ring.rotation.z += dt * 0.6;
    if (this.kind !== 'tower') { this.syncObj(); return; }
    this.atkCd -= dt;
    if (!this.target || !this.target.targetable || this.dist(this.target) > this.range + this.target.radius) this.target = W.towerTarget(this);
    const t = this.target;
    if (t && this.atkCd <= 0) {
      this.atkCd = 1 / this.atkSpeed;
      const from = new THREE.Vector3(this.pos.x, 5.9, this.pos.z);
      W.sfx('tower', this.pos, 0.8);
      W.projectile({ from, target: t, speed: 24, team: this.team, owner: this, mesh: projMesh('bigOrb', TEAM_COL[this.team]),
        trail: { color: TEAM_COL[this.team], glow: true, size: 0.9 },
        onHit: (u) => { W.damage(this, u, u.kind === 'hero' ? 150 : u.kind === 'minion' ? u.maxHp * 0.45 : 120, { type: 'true' }); W.vfx.spark(u.pos, TEAM_COL[this.team], 8, 0.8); } });
    }
    this.syncObj();
  }
  die(k) {
    super.die(k);
    const W = this.world;
    W.vfx.puff(this.pos, { n: 30, color: '#e8dcc0', cell: 'puff', size: 2.2, speed: 5, spread: 2 });
    W.vfx.puff(this.pos, { n: 16, color: '#a8997f', cell: 'shard', size: 0.8, speed: 7, grav: 12, up: 2 });
    W.vfx.comic(this.pos, '轰!', { size: 3.4, y: 6 });
    W.sfx('crumble', this.pos);
    W.vfx.shake(0.6);
    W.onStructureDown && W.onStructureDown(this, k);
  }
}

// ---------------- 野怪 ----------------
// 野怪属性：[名字, 生命, 攻击, 半径, 高度, 刷新秒数]
export const MONSTERS = {
  dragon: ['元素小龙', 2600, 90, 2.6, 5, 90], baron: ['纳什男爵', 4000, 110, 2.6, 5, 120],
  blue: ['蓝色哨兵', 1500, 45, 1.6, 4, 90], red: ['红色树精', 1500, 50, 1.6, 4, 90],
  gromp: ['魔沼蛙', 1000, 40, 1.4, 2.6, 60],
  wolf: ['暗影狼', 800, 35, 1.1, 2.2, 60], wolfS: ['小暗影狼', 320, 14, 0.7, 1.4, 60],
  raptor: ['锋喙鸟', 700, 30, 1.0, 2.6, 60], raptorS: ['小锋喙鸟', 220, 10, 0.6, 1.5, 60],
  krug: ['远古石甲虫', 1000, 40, 1.3, 2.4, 60], krugS: ['石甲虫', 400, 18, 0.8, 1.4, 60],
  crab: ['迅捷蟹', 700, 0, 1.0, 1.6, 75],
};
export class Monster extends Unit {
  constructor(world, kind, x, z, camp = null) {
    const big = kind === 'dragon' || kind === 'baron';
    const st = MONSTERS[kind] || ['野怪', 700, 30, 1, 1.8, 60];
    const m = kind === 'dragon' ? dragonModel() : kind === 'baron' ? baronModel() : jungleModel(kind);
    super(world, { kind: 'monster', team: 0, x, z, hp: st[1], radius: st[3], speed: kind === 'crab' ? 4 : 5, ad: st[2], range: big ? 4 : 1.5, atkSpeed: 0.7, height: st[4], obj: m.obj, name: st[0] });
    this.m = m; this.mkind = kind; this.home = { x, z }; this.t = Math.random() * 5;
    this.respawnSec = st[5]; this.camp = camp;
    this.facing = Math.atan2(-x, -z);
    this.big = big;
    if (big) this.obj.scale.setScalar(kind === 'baron' ? 1.3 : 1.35);
  }
  onDamaged(src) {
    if (!src || src.team === 0 || src.isStructure) return;
    if (this.mkind === 'crab') { this.fleeFrom = src; this.fleeT = 2; return; }
    this.target = src;
    // 同一营地的野怪一起反击
    if (this.camp) for (const u of this.world.units) if (u !== this && u.camp === this.camp && !u.dead && !u.target) u.target = src;
  }
  update(dt) {
    const W = this.world;
    this.t += dt;
    this.moving = false;
    if (this.dead) {
      this.obj.position.y -= dt * 2;
      return;
    }
    this.updateBuffs(dt);
    this.atkCd -= dt;
    if (this.m.fire && Math.random() < dt * 10) W.vfx.trail({ x: this.pos.x + (Math.random() - 0.5) * 2, y: 2 + Math.random() * 1.5, z: this.pos.z + (Math.random() - 0.5) * 2 }, { color: Math.random() < 0.5 ? '#ffb030' : '#ff5a20', cell: 'flame', size: 0.5, vy: 1.5, life: 0.5 });
    if (this.mkind === 'crab') {
      this.fleeT = (this.fleeT || 0) - dt;
      if (this.fleeT > 0 && this.fleeFrom && this.canMove()) {
        const f = this.fleeFrom.pos, dx = this.pos.x - f.x, dz = this.pos.z - f.z, d = Math.hypot(dx, dz) || 1;
        this.step(dt, this.pos.x + dx / d * 3, this.pos.z + dz / d * 3, 0.1);
      } else if (this.canMove()) {
        const a = this.t * 0.4;
        this.step(dt, this.home.x + Math.cos(a) * 3, this.home.z - Math.cos(a) * 3, 0.2);
      }
      this.m.body.position.y = Math.abs(Math.sin(this.t * 10)) * 0.08;
      this.turn(dt, 6); this.syncObj();
      return;
    }
    const t = this.target;
    const leash = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
    if (t && (!t.targetable || leash > 12 || this.dist(t) > 14)) { this.target = null; }
    if (this.target && this.canAct()) {
      const reach = this.range + this.target.radius + this.radius;
      this.face(this.target.pos.x, this.target.pos.z);
      if (this.dist(this.target) <= reach) {
        if (this.atkCd <= 0) this.monsterAttack(this.target);
      } else if (!this.big && this.canMove()) this.step(dt, this.target.pos.x, this.target.pos.z, reach * 0.9);
    } else if (!this.target) {
      if (leash > 0.5 && !this.big) this.step(dt, this.home.x, this.home.z, 0.3);
      else if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.1 * dt);
    }
    this.turn(dt, 4);
    const b = this.m.body;
    if (this.mkind === 'dragon') {
      b.position.y = Math.sin(this.t * 2) * 0.1;
      for (const s of [1, -1]) { const w = this.obj.userData['wing' + s]; if (w) w.rotation.z = s * (0.3 + Math.sin(this.t * 4) * 0.35); }
      this.m.head.rotation.x = Math.sin(this.t * 1.3) * 0.1;
    } else if (this.mkind === 'baron') {
      this.m.segs.forEach((s, i) => { s.rotation.x = Math.sin(this.t * 1.5 - i * 0.6) * 0.08; s.rotation.z = Math.sin(this.t - i * 0.5) * 0.06; });
    } else {
      b.position.y = this.moving ? Math.abs(Math.sin(this.t * 12)) * 0.25 : Math.abs(Math.sin(this.t * 2)) * 0.06;
      b.scale.set(1 + Math.sin(this.t * 2) * 0.03, 1 - Math.sin(this.t * 2) * 0.03, 1);
    }
    this.syncObj();
  }
  monsterAttack(t) {
    const W = this.world;
    this.atkCd = 1 / this.atkSpeed;
    if (this.mkind === 'dragon') {
      const from = new THREE.Vector3(this.pos.x, 3, this.pos.z);
      W.projectile({ from, target: t, speed: 20, team: 0, owner: this, mesh: projMesh('fire'), trail: { color: '#ff8a30', glow: true, size: 1.2 },
        onHit: (u) => { W.damage(this, u, this.ad, { type: 'magic' }); W.vfx.puff(u.pos, { n: 8, color: ['#ffcf4a', '#ff6a2a'], cell: 'flame', size: 0.8, speed: 3 }); } });
    } else {
      W.after(0.2, () => {
        if (this.dead || !t.targetable) return;
        W.damage(this, t, this.ad, { type: 'phys' });
        if (this.big) { W.vfx.ring(t.pos, { r1: 3, color: '#c8a0ff' }); W.vfx.shake(0.2); }
      });
      this.m.body.rotation.x = 0.3; W.after(0.3, () => { this.m.body.rotation.x = 0; });
    }
  }
  die(k) {
    super.die(k);
    const W = this.world;
    W.vfx.puff(this.pos, { n: this.big ? 30 : 12, color: '#ffffff', cell: 'puff', size: this.big ? 2.2 : 1.1, speed: 3 });
    if (this.big) { W.vfx.comic(this.pos, this.mkind === 'dragon' ? '屠龙!' : '斩男爵!', { size: 3.4, y: 5 }); W.sfx('roar', this.pos); }
    W.onMonsterDown && W.onMonsterDown(this, k);
    W.after(this.respawnSec || 60, () => {
      this.dead = false; this.hp = this.maxHp; this.pos.set(this.home.x, 0, this.home.z); this.obj.position.y = 0; this.target = null;
      W.vfx.puff(this.pos, { n: 14, color: '#ffffff', cell: 'puff', size: 1.2 });
    });
  }
}

// ---------------- 训练假人 ----------------
export class Dummy extends Unit {
  constructor(world, x, z, team = 2) {
    const m = dummyModel();
    super(world, { kind: 'dummy', team, x, z, hp: 3000, radius: 0.7, height: 2.5, obj: m.obj, name: '训练假人' });
    this.m = m; this.wob = 0; this.wv = 0;
  }
  onDamaged() { this.wv += 5; this.lastHit = this.world.time; }
  update(dt) {
    this.updateBuffs(dt);
    this.wv += -this.wob * 40 * dt; this.wv *= Math.exp(-dt * 3); this.wob += this.wv * dt;
    this.m.body.rotation.x = -this.wob * 0.3;
    if (this.world.time - this.lastHit > 3) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.5 * dt);
    if (this.hp < 50) this.hp = this.maxHp;
    this.syncObj();
  }
  die() { this.hp = this.maxHp; }
}

// ---------------- 提伯斯 ----------------
export class Pet extends Unit {
  constructor(world, owner, x, z) {
    const rig = tibbersRig();
    super(world, { kind: 'pet', team: owner.team, x, z, hp: 1200, radius: 1.1, speed: 7.5, ad: 70, range: 1.8, atkSpeed: 1.0, height: 4.5, obj: rig.root, name: '提伯斯' });
    this.rig = rig; this.owner = owner; this.life = 20; this.auraT = 0;
  }
  update(dt) {
    const W = this.world;
    this.moving = false;
    if (this.dead) return;
    this.updateBuffs(dt);
    this.life -= dt; this.atkCd -= dt; this.auraT -= dt;
    if (this.life <= 0 || this.owner.dead) { this.die(); return; }
    if (this.auraT <= 0) {
      this.auraT = 0.5;
      for (const u of W.enemiesIn(this.team, this.pos, 3)) W.damage(this, u, 18, { type: 'magic', noText: true });
    }
    if (Math.random() < dt * 20) W.vfx.trail({ x: this.pos.x + (Math.random() - 0.5) * 2, y: 1 + Math.random() * 3, z: this.pos.z + (Math.random() - 0.5) * 2 }, { color: Math.random() < 0.5 ? '#ffb030' : '#ff5a20', cell: 'flame', size: 0.7, vy: 2, life: 0.5, grow: -0.4 });
    if (!this.target || !this.target.targetable || this.dist(this.target) > 10) this.target = W.pickTarget(this, 9, true);
    const t = this.target;
    if (t && this.canAct()) {
      const reach = this.range + t.radius + this.radius;
      if (this.dist(t) <= reach) {
        this.face(t.pos.x, t.pos.z);
        if (this.atkCd <= 0) {
          this.atkCd = 1;
          this.rig.play('slam', 0.6);
          W.after(0.3, () => { if (!this.dead && t.targetable) { W.damage(this, t, this.ad, { type: 'magic' }); W.vfx.ring(t.pos, { r1: 2, color: '#ff8a30' }); W.vfx.puff(t.pos, { n: 6, color: ['#ffcf4a', '#ff6a2a'], cell: 'flame', size: 0.7 }); } });
        }
      } else if (this.canMove()) this.step(dt, t.pos.x, t.pos.z, reach * 0.9);
    } else if (this.canMove() && this.dist(this.owner) > 4) this.step(dt, this.owner.pos.x, this.owner.pos.z, 3);
    this.turn(dt, 8);
    this.rig.update(dt, { moving: this.moving });
    this.syncObj();
  }
  die() {
    if (this.dead) return;
    this.dead = true;
    const W = this.world;
    W.vfx.puff(this.pos, { n: 20, color: '#ffffff', cell: 'puff', size: 1.6, speed: 3 });
    W.after(0.05, () => W.remove(this));
  }
}
