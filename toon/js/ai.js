// 电脑英雄 AI：分路、补刀与换血、躲技能、预判施法、集火团战、塔下判断、打野抓人、控龙推塔、残血撤退回城。
import { LANES, CAMPS, FOUNTAIN, BASE, PITS } from './map.js';

// 难度：思考间隔、看到技能后的反应时间、躲技能概率、预判准度、补刀准度、走A、激进程度、越塔、抓人间隔、运营、敌方资源加成
export const DIFFICULTY = {
  easy: { name: '简单', desc: '反应慢、不躲技能、很少抓人', think: 0.42, react: 0.7, dodge: 0, aim: 0.35, lastHit: 0.5, kite: 0, aggro: 0.8, dive: false, gank: 150, assist: 14, macro: 0, bonus: 0 },
  normal: { name: '普通', desc: '会补刀换血、偶尔躲技能、会抓人控龙', think: 0.26, react: 0.42, dodge: 0.35, aim: 0.7, lastHit: 0.8, kite: 0.5, aggro: 0.95, dive: false, gank: 90, assist: 22, macro: 1, bonus: 0 },
  hard: { name: '困难', desc: '预判施法、走A风筝、会越塔、团队集火运营', think: 0.15, react: 0.24, dodge: 0.7, aim: 0.9, lastHit: 0.95, kite: 0.9, aggro: 1.08, dive: true, gank: 65, assist: 30, macro: 2, bonus: 0 },
  master: { name: '大师', desc: '困难基础上反应更快，敌方金币经验 +15%', think: 0.1, react: 0.14, dodge: 0.88, aim: 1, lastHit: 1, kite: 1, aggro: 1.15, dive: true, gank: 50, assist: 34, macro: 2, bonus: 0.15 },
};
export const DIFF_IDS = Object.keys(DIFFICULTY);

const D2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const DMG_TAGS = new Set(['enemy', 'hero', 'close', 'execute', 'executeFar', 'enemyNear', 'fightFar', 'fight']);
// 冲进敌人堆里的位移技能：只在决定开战时用，不拿来消耗
const ENGAGE = new Set(['yasuoE', 'yasuoR', 'zedW', 'zedR', 'katarinaE', 'katarinaR', 'xinzhaoE', 'yiQ', 'leesinQ', 'leesinR', 'dariusR', 'malphiteR', 'vayneQ', 'ezrealE',
  'leonaE', 'leonaR', 'rivenQ', 'rivenE', 'viQ', 'viR', 'lucianE', 'amumuR', 'garenR']);
// 技能使用优先级：控制和斩杀先放
const PRI = { hero: 0, execute: 0, heal: 0, team: 0, low: 0, executeFar: 1, fight: 1, hurt: 1, escape: 1, enemy: 2, enemyNear: 2, close: 2, fightFar: 3 };
const shieldOf = (u) => { let s = 0; for (const b of u.buffs) if (b.shield > 0) s += b.shield; return s; };
const dpsOf = (u) => u.ad * u.atkSpeed * u.atkMul * (1 + (u.crit || 0) * 0.75) + (u.ap || 0) * 0.5 + 25 + u.level * 12;
const ehpOf = (u) => (u.hp + shieldOf(u)) * (1 + ((u.armor || 0) + (u.mr || 0)) / 200);
const hpPct = (u) => u.hp / u.maxHp;

// 按英雄定位分配分路：打野、下路、辅助、中路、上路
const FIT = {
  jungle: { 刺客: 3, 战士: 3, 坦克: 2 }, bot: { 射手: 5, 法师: 1 }, support: { 辅助: 5, 坦克: 3, 法师: 1 },
  mid: { 法师: 5, 刺客: 3 }, top: { 战士: 4, 坦克: 3, 刺客: 1 },
};
const JUNGLERS = new Set(['yi', 'xinzhao', 'leesin', 'amumu', 'vi', 'nasus', 'darius', 'zed']);
export function assignRoles(defs, roles) {
  let best = null, bs = -1e9;
  const perm = (arr, k = 0) => {
    if (k === arr.length) {
      let s = 0;
      arr.forEach((r, i) => { s += (FIT[r][defs[i].role] || 0) + (r === 'jungle' && JUNGLERS.has(defs[i].id) ? 2 : 0); });
      s += Math.random() * 0.5;
      if (s > bs) { bs = s; best = arr.slice(); }
      return;
    }
    for (let i = k; i < arr.length; i++) { [arr[k], arr[i]] = [arr[i], arr[k]]; perm(arr, k + 1); [arr[k], arr[i]] = [arr[i], arr[k]]; }
  };
  perm(roles.slice());
  return best;
}
// 玩家英雄默认走的路
export function playerRole(def) { return { 射手: 'bot', 辅助: 'support', 法师: 'mid', 刺客: 'mid', 战士: 'top', 坦克: 'top' }[def.role] || 'mid'; }

// ---------------- 团队大脑：控龙、推塔抱团、守家、集火 ----------------
export class TeamBrain {
  constructor(game, team, P) {
    this.g = game; this.team = team; this.P = P;
    this.t = Math.random(); this.obj = null; this.defend = null; this.bots = [];
  }
  get W() { return this.g.world; }
  heroes(team) { return this.W.units.filter(u => u.kind === 'hero' && u.team === team && !u.dead); }
  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1.2;
    const W = this.W, time = W.time, P = this.P;
    const mine = this.heroes(this.team), theirs = this.heroes(3 - this.team);
    this.enemyAlive = theirs.length; this.allyAlive = mine.length;
    const avgHp = mine.reduce((s, u) => s + hpPct(u), 0) / Math.max(1, mine.length);
    const enemyNear = (p, r) => theirs.filter(u => D2(u.pos, p) < r).length;
    // 守家：敌方英雄正在拆我方建筑
    this.defend = W.units.find(s => s.isStructure && !s.dead && s.team === this.team && time - (s.lastHit || -99) < 3 && s.lastAttacker && s.lastAttacker.kind === 'hero') || null;
    // 目标：小龙 / 大龙 / 抱团推进
    const mon = (k) => W.units.find(u => u.kind === 'monster' && u.mkind === k && !u.dead);
    let obj = null;
    if (P.macro > 0) {
      const dragon = mon('dragon'), baron = mon('baron');
      const dragonT = P.macro >= 2 ? 240 : 420;
      if (baron && time > (P.macro >= 2 ? 900 : 1200) && mine.length >= 4 && mine.length >= theirs.length + 1 && enemyNear(PITS.baron, 30) <= 1 && avgHp > 0.6)
        obj = { type: 'baron', unit: baron, pos: PITS.baron, need: 3 };
      else if (dragon && time > dragonT && mine.length >= theirs.length && enemyNear(PITS.dragon, 30) <= 1 && avgHp > 0.55)
        obj = { type: 'dragon', unit: dragon, pos: PITS.dragon, need: 2 };
      else if ((time > (P.macro >= 2 ? 780 : 1080) || (mine.length - theirs.length >= 2 && time > 300)) && avgHp > 0.5 && mine.length >= theirs.length)
        obj = { type: 'push', lane: this.weakestLane() };
      // 推进途中人数劣势就散开回线
      if (this.obj && this.obj.type === 'push' && obj && obj.type === 'push') obj.lane = this.obj.lane;
    }
    this.obj = obj;
  }
  // 敌方防御塔最少的那一路
  weakestLane() {
    let best = 'mid', bs = 1e9;
    for (const lane of ['top', 'mid', 'bot']) {
      const n = this.W.units.filter(u => u.isStructure && !u.dead && u.team !== this.team && u.info.lane === lane).length;
      if (!n) continue;
      const s = n + (lane === 'mid' ? -0.5 : 0);
      if (s < bs) { bs = s; best = lane; }
    }
    return best;
  }
  joins(bot) {
    const o = this.obj, h = bot.h;
    if (!o || h.dead || hpPct(h) < 0.45) return false;
    if (o.type === 'dragon') return bot.role !== 'top' && D2(h.pos, o.pos) < 90;
    return true;
  }
  // 有多少队友正在打这个目标（用于集火）
  attackers(u, me) { let n = 0; for (const b of this.bots) if (b !== me && b.target === u && !b.h.dead) n++; return n; }
}

// ---------------- 单个电脑英雄 ----------------
export class HeroBot {
  constructor(hero, game, role, brain, P) {
    this.h = hero; this.g = game; this.role = role; this.brain = brain; this.P = P;
    this.t = Math.random() * 0.3; this.dodgeT = Math.random() * 0.05; this.dodgeUntil = 0;
    this.seen = new WeakMap();
    this.mode = null; this.target = null; this.gank = null;
    this.nextGank = 80 + Math.random() * 40;
    this.lastPos = { x: hero.pos.x, z: hero.pos.z }; this.stuckT = 0;
    this.foes = [];
    brain.bots.push(this);
  }
  get W() { return this.g.world; }
  get laneName() {
    const o = this.brain.obj;
    if (o && o.type === 'push' && this.brain.joins(this)) return o.lane;
    return this.role === 'support' ? 'bot' : this.role === 'jungle' ? 'mid' : this.role;
  }

  update(dt) {
    const h = this.h;
    if (h.dead) { this.mode = null; this.target = null; this.gank = null; this.dest = null; return; }
    this.dodgeT -= dt;
    if (this.dodgeT <= 0) { this.dodgeT = 0.05; if (this.dodge()) return; }
    if (this.W.time < this.dodgeUntil) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = this.P.think * (0.8 + Math.random() * 0.4);
    this.think();
  }

  think() {
    const h = this.h, W = this.W, P = this.P, hp = hpPct(h);
    this.foes = W.enemiesIn(h.team, h.pos, 18, { heroOnly: true }).filter(u => !h.hides(u));
    const near = this.foes.filter(u => h.dist(u) < 11);
    if (h.recallT > 0 || h.tpT > 0) {
      if (h.recallT > 0 && (near.length || W.time - (h.lastHit || -9) < 0.5)) h.cancelRecall(); else return;
    }
    if (h.castLock > 0 || h.dashing || h.has('channel')) return;
    this.unstick();
    this.usePotion(hp);
    const kill = this.pickTarget();
    this.ratio = kill ? kill.ratio : 9;
    // 被敌方防御塔锁定：先离开射程（除非马上能收掉人头）
    const tw = this.enemyTowerNear(h.pos, 0.5);
    if (tw && tw.target === h && !(kill && kill.killable && hp > 0.35 && P.dive)) {
      this.target = null;
      this.useSpells(hp, true, kill && kill.u);
      this.useSkills(true);
      this.leaveTower(tw);
      return;
    }
    if (this.shouldRetreat(hp, kill)) { this.retreat(hp); return; }
    if (kill && kill.engage) { this.fight(kill.u, hp); return; }
    this.target = null;
    if (this.mode === 'fight') this.mode = null;
    // 不开战时：控制技能自保、远程技能消耗、技能清兵
    this.useSpells(hp, false, null);
    if (this.useSkills(false)) return;
    if (this.wantRecall(hp)) { h.recall(); this.dest = null; return; }
    if (this.assist()) return;
    if (this.defendBase()) return;
    const o = this.brain.obj;
    if (o && (o.type === 'dragon' || o.type === 'baron') && this.brain.joins(this) && this.objective(o)) return;
    if (this.role === 'jungle' && !(o && o.type === 'push' && this.brain.joins(this) && h.level >= 9)) return this.jungle();
    this.lane();
  }

  // ---------- 局势判断 ----------
  enemyTowerNear(p, pad = 0) {
    for (const u of this.W.units) if (u.kind === 'tower' && !u.dead && u.team !== this.h.team && D2(u.pos, p) < u.range + 1 + pad) return u;
    return null;
  }
  alliedMinionsNear(p, r) {
    let n = 0;
    for (const u of this.W.units) if (u.kind === 'minion' && !u.dead && u.team === this.h.team && D2(u.pos, p) < r) n++;
    return n;
  }
  // 兰彻斯特式战力比：我方（我身边）对敌方（目标身边），算上小兵和防御塔
  fightRatio(at) {
    const h = this.h;
    let aD = 0, aH = 0, eD = 0, eH = 0;
    for (const u of this.W.units) {
      if (u.dead || u.removed || u.team === 0) continue;
      const ally = u.team === h.team;
      if (u.kind === 'hero') {
        const d = ally ? D2(u.pos, h.pos) : D2(u.pos, at);
        if (d > 14 || (ally && u.recallT > 0)) continue;
        const w = ally && u !== h && d > 9 ? 0.6 : 1;
        if (ally) { aD += dpsOf(u) * w; aH += ehpOf(u) * w; } else { eD += dpsOf(u); eH += ehpOf(u); }
      } else if (u.kind === 'minion') {
        if (D2(u.pos, at) > 8) continue;
        if (ally) { aD += 6; aH += 120; } else { eD += 6; eH += 120; }
      } else if (u.kind === 'tower') {
        if (D2(u.pos, at) > u.range + 2) continue;
        if (ally) { aD += 120; aH += 900; } else { eD += 120; eH += 900; }
      }
    }
    return (aD * aH) / Math.max(1, eD * eH);
  }
  burst(a, t, T = 2.5) {
    const ak = 100 / (100 + (t.armor || 0)), mk = 100 / (100 + (t.mr || 0));
    let dmg = a.ad * a.atkSpeed * a.atkMul * (1 + (a.crit || 0) * 0.75) * T * ak;
    for (const sk of a.def.skills) {
      if (!a.ranks[sk.key] || a.cds[sk.key] > 0.5 || !DMG_TAGS.has(sk.ai)) continue;
      if (!a.manaless && a.mana < a.costOf(sk)) continue;
      dmg += (sk.key === 'R' ? 240 : 90) * a.rk(sk.key) * (ak + mk) / 2;
    }
    for (const k of ['D', 'F']) if (a.spells && a.spells[k] === 'ignite' && a.cds[k] <= 0) dmg += 50 + 20 * a.level;
    return dmg;
  }
  teamBurst(t) {
    let s = 0;
    for (const a of this.W.units) {
      if (a.kind !== 'hero' || a.dead || a.team !== this.h.team) continue;
      if (a === this.h || a.dist(t) < a.range + 4) s += this.burst(a, t);
    }
    return s;
  }
  pickTarget() {
    const h = this.h, P = this.P;
    let best = null, bs = 1e9;
    const reach = Math.max(10, h.range + 6);
    const myDps = dpsOf(h);
    for (const u of this.foes) {
      if (!u.targetable) continue;
      const d = h.dist(u);
      if (d > reach) continue;
      if (this.ignore && this.ignore.u === u && this.W.time < this.ignore.until && d > h.range + 1) continue;
      let s = ehpOf(u) / myDps + Math.max(0, d - h.range) / Math.max(1, h.speed) * 1.5;
      if (u.stunned || u.rooted) s -= 1.2;
      if (hpPct(u) < 0.3) s -= 1;
      s -= 0.8 * this.brain.attackers(u, this);
      if (this.target === u) s -= 0.6; // 不要频繁换目标
      if (s < bs) { bs = s; best = u; }
    }
    if (!best) return null;
    const ratio = this.fightRatio(best.pos);
    const killable = this.teamBurst(best) >= best.hp + shieldOf(best);
    const hp = hpPct(h);
    // 自己血量越低，越需要明显的优势才开战
    const need = hp < 0.35 ? 1.8 : hp < 0.5 ? 1.3 : 1;
    let engage = ratio * P.aggro >= need || (killable && (hp > 0.35 || hpPct(best) < 0.15));
    const tw = this.enemyTowerNear(best.pos, 1);
    if (tw && engage) {
      // 越塔：防御塔在打小兵、或者能秒掉对方且自己血量健康
      const towerBusy = tw.target && tw.target !== h && tw.target.kind === 'minion' && this.alliedMinionsNear(tw.pos, tw.range) >= 2;
      engage = P.dive ? (killable && hp > 0.45) || (towerBusy && ratio > 1.5 && hp > 0.5)
        : (killable && hpPct(best) < 0.15 && hp > 0.6);
    }
    return { u: best, ratio, killable, engage };
  }

  // ---------- 撤退与回城 ----------
  shouldRetreat(hp, kill) {
    const h = this.h, P = this.P;
    const near = this.foes.filter(u => h.dist(u) < 10);
    const finishing = kill && kill.killable && hp > 0.12 && hpPct(kill.u) < 0.25;
    if (this.mode === 'retreat') {
      if (finishing && hp > 0.25) { this.mode = null; return false; }
      if (hp > 0.8 || (!this.foes.length && hp > 0.6)) { this.mode = null; return false; }
      return true;
    }
    if (finishing) return false;
    let go = false;
    if (hp < 0.2) go = true;
    else if (near.length && kill && kill.ratio * P.aggro < 0.6 && hp < 0.75) go = true;
    else if (near.length && hp < 0.33 && !(kill && kill.engage)) go = true;
    else if (near.length && !h.manaless && h.mana < h.maxMana * 0.1 && hp < 0.55) go = true;
    if (go) this.mode = 'retreat';
    return go;
  }
  escapePoint(dist) {
    const h = this.h, f = FOUNTAIN[h.team];
    let dx = f.x - h.pos.x, dz = f.z - h.pos.z;
    let l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    // 同时远离身边的敌人
    for (const u of this.foes) {
      const d = h.dist(u);
      if (d > 9) continue;
      dx += (h.pos.x - u.pos.x) / (d + 0.5) * 1.5; dz += (h.pos.z - u.pos.z) / (d + 0.5) * 1.5;
    }
    l = Math.hypot(dx, dz) || 1;
    return { x: h.pos.x + dx / l * dist, z: h.pos.z + dz / l * dist };
  }
  retreat(hp) {
    const h = this.h, W = this.W, f = FOUNTAIN[h.team];
    this.target = null;
    this.useSpells(hp, true, null);
    if (this.useSkills(true)) return;
    const chaser = this.foes.some(u => h.dist(u) < 14);
    if (!chaser && D2(h.pos, f) > 25 && W.time - (h.lastHit || -9) > 1.5) { h.recall(); this.dest = null; return; }
    if (D2(h.pos, f) < 6) return;
    // 离得近的追兵：先往安全方向拉开，再沿路回泉水
    if (this.foes.some(u => h.dist(u) < 6)) {
      const p = this.escapePoint(4);
      if (W.walkable(p.x, p.z)) { this.stepTo(p); return; }
    }
    this.goTo(f.x, f.z);
  }
  leaveTower(tw) {
    const h = this.h;
    let dx = h.pos.x - tw.pos.x, dz = h.pos.z - tw.pos.z;
    const f = FOUNTAIN[h.team];
    dx += (f.x - h.pos.x) * 0.02; dz += (f.z - h.pos.z) * 0.02;
    const l = Math.hypot(dx, dz) || 1, k = tw.range + 3 - D2(h.pos, tw.pos) + 1;
    const p = { x: h.pos.x + dx / l * Math.max(2, k), z: h.pos.z + dz / l * Math.max(2, k) };
    if (this.W.walkable(p.x, p.z)) this.goTo(p.x, p.z, 1); else this.goTo(f.x, f.z);
  }
  wantRecall(hp) {
    const h = this.h, W = this.W, f = FOUNTAIN[h.team];
    if (D2(h.pos, f) < 30 || this.foes.some(u => h.dist(u) < 16) || W.time - (h.lastHit || -9) < 3) return false;
    const o = this.brain.obj;
    if (o && o.type !== 'push' && this.brain.joins(this) && D2(h.pos, o.pos) < 25) return false;
    if (hp < 0.38) return true;
    if (!h.manaless && h.mana / h.maxMana < 0.15) return true;
    const want = this.g.nextPrice(h);
    return !!want && h.gold >= want && h.gold >= 1100 && (hp < 0.7 || h.gold >= 1700);
  }
  usePotion(hp) {
    const h = this.h, W = this.W;
    // 中娅沙漏：快死了、正在挨打时凝滞躲伤害
    if (hp < 0.22 && W.time - (h.lastHit || -9) < 0.6 && this.foes.some(u => h.dist(u) < 9)) {
      const z = h.items.findIndex(it => it && it.id === 'zhonya');
      if (z >= 0 && h.useItem(z) === 'ok') return;
    }
    if (hp > 0.62 || h.has('potion') || (W.fountainHeal && W.fountainHeal(h))) return;
    if (hp > 0.45 && W.time - (h.lastHit || -9) > 6) return;
    const i = h.items.findIndex(it => it && it.id === 'potion');
    if (i >= 0) h.useItem(i);
  }

  // ---------- 移动 ----------
  goTo(x, z, tol = 2) {
    const h = this.h;
    if (this.dest && D2(this.dest, { x, z }) < tol && h.path && h.path.length && h.order && h.order.type === 'move') return;
    h.orderMove(x, z);
    this.dest = { x, z };
  }
  // 短距离直线移动（不寻路），用于走A和躲技能
  stepTo(p) {
    const h = this.h;
    if (h.windup) h.cancelWindup();
    h.order = { type: 'move' }; h.path = [{ x: p.x, z: p.z }];
    this.dest = null;
  }
  unstick() {
    const h = this.h;
    const moved = D2(h.pos, this.lastPos);
    this.lastPos = { x: h.pos.x, z: h.pos.z };
    if (h.path && moved < 0.05) { this.stuckT += this.P.think; if (this.stuckT > 1.2) { h.path = null; this.dest = null; this.stuckT = 0; } }
    else this.stuckT = 0;
  }

  // ---------- 躲技能 ----------
  dodge() {
    const h = this.h, W = this.W, P = this.P;
    if (P.dodge <= 0 || h.dashing || !h.canMove() || h.castLock > 0 || h.recallT > 0 || h.tpT > 0) return false;
    for (const p of W.projs) {
      if (p.dead || !p.dir || !p.onHit || p.team === h.team || p.team === 0 || !p.owner || p.owner.kind !== 'hero') continue;
      let s = this.seen.get(p);
      if (!s) { s = { t: W.time, ok: Math.random() < P.dodge }; this.seen.set(p, s); }
      if (!s.ok || W.time - s.t < P.react) continue;
      const rx = h.pos.x - p.pos.x, rz = h.pos.z - p.pos.z;
      const along = rx * p.dir.x + rz * p.dir.z;
      if (along < -0.5 || along > p.range - p.traveled + 1) continue;
      const perp = rx * p.dir.z - rz * p.dir.x;
      const width = p.radius + h.radius + 0.45;
      if (Math.abs(perp) > width) continue;
      const tHit = Math.max(0, along) / p.speed;
      const side = perp >= 0 ? 1 : -1;
      for (const [sg, need] of [[side, width - Math.abs(perp) + 0.35], [-side, width + Math.abs(perp) + 0.35]]) {
        if (need / Math.max(1, h.speed) > tHit + 0.08) continue;
        const q = { x: h.pos.x + p.dir.z * sg * need, z: h.pos.z - p.dir.x * sg * need };
        if (!W.walkable(q.x, q.z)) continue;
        this.stepTo(q);
        this.dodgeUntil = W.time + need / Math.max(1, h.speed) + 0.04;
        return true;
      }
    }
    // 站在敌方短时范围技能里（光之奇点、毒雾、星体结界等）：走出去
    if (P.dodge >= 0.5) {
      for (const z of W.zones) {
        if (z.dead || z.team === h.team || z.noDodge || z.r < 2 || z.dur > 6) continue;
        const d = D2(h.pos, z.pos);
        if (d > z.r + h.radius) continue;
        let s = this.seen.get(z);
        if (!s) { s = { t: W.time, ok: Math.random() < P.dodge }; this.seen.set(z, s); }
        if (!s.ok || W.time - s.t < P.react) continue;
        const dx = (h.pos.x - z.pos.x) / (d || 1), dz = (h.pos.z - z.pos.z) / (d || 1);
        const need = z.r + h.radius + 0.6 - d;
        const q = { x: h.pos.x + (d ? dx : 1) * need, z: h.pos.z + (d ? dz : 0) * need };
        if (!W.walkable(q.x, q.z)) continue;
        this.stepTo(q);
        this.dodgeUntil = W.time + need / Math.max(1, h.speed);
        return true;
      }
    }
    return false;
  }

  // ---------- 战斗 ----------
  fight(t, hp) {
    const h = this.h, P = this.P;
    const W = this.W, d = h.dist(t);
    // 追不上就放弃：目标持续在攻击距离外超过 2.5 秒，4 秒内不再追它
    if (this.target !== t || d <= h.range + t.radius + 0.8) this.chaseT = W.time;
    else if (W.time - this.chaseT > 2.5 && hpPct(t) > 0.08) { this.ignore = { u: t, until: W.time + 4 }; this.target = null; this.mode = null; return; }
    this.mode = 'fight'; this.target = t;
    this.useSpells(hp, false, t);
    if (this.useSkills(false, t)) return;
    if (h.castLock > 0 || h.dashing) return;
    // 远程走A：出手后的空档往后撤，保持距离
    if (h.range > 4 && Math.random() < P.kite && !h.windup && h.atkCd > 0.12) {
      const threat = this.foes.find(u => u.range < 4 && h.dist(u) < u.range + 2.6);
      if (threat || d < h.range * 0.6) {
        if (this.kiteFrom(threat || t, t)) return;
      }
    }
    if (!h.order || h.order.type !== 'attack' || h.order.target !== t) h.orderAttack(t);
  }
  kiteFrom(a, t) {
    const h = this.h, W = this.W;
    let dx = h.pos.x - a.pos.x, dz = h.pos.z - a.pos.z;
    const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    for (const ang of [0, 0.5, -0.5, 1.0, -1.0]) {
      const c = Math.cos(ang), s = Math.sin(ang), vx = dx * c + dz * s, vz = -dx * s + dz * c;
      const p = { x: h.pos.x + vx * 2.2, z: h.pos.z + vz * 2.2 };
      if (!W.walkable(p.x, p.z) || !W.walkable(h.pos.x + vx, h.pos.z + vz)) continue;
      if (D2(p, t.pos) > h.range + t.radius + 1.5) continue;
      if (this.enemyTowerNear(p, 0.5) && !this.enemyTowerNear(h.pos, 0.5)) continue;
      this.stepTo(p);
      return true;
    }
    return false;
  }
  // 预判目标在 delay 秒后的位置（沿它的寻路路径走）
  predict(t, sk) {
    const h = this.h, P = this.P;
    const p = { x: t.pos.x, z: t.pos.z };
    if (t.stunned || t.rooted || t.dashing || !t.path || !t.path.length || t.castLock > 0) return p;
    const d = h.dist(t);
    const delay = (sk.wind ?? 0.25) + (sk.aim === 'dir' || sk.aim === 'point' ? d / (sk.speed || 24) : 0);
    let s = t.speed * delay * P.aim;
    let cx = p.x, cz = p.z;
    for (const q of t.path) {
      const l = Math.hypot(q.x - cx, q.z - cz);
      if (l >= s) { cx += (q.x - cx) / (l || 1) * s; cz += (q.z - cz) / (l || 1) * s; s = 0; break; }
      cx = q.x; cz = q.z; s -= l;
    }
    const err = (1 - P.aim) * 1.6;
    return { x: cx + (Math.random() - 0.5) * err, z: cz + (Math.random() - 0.5) * err };
  }
  // 直线技能会不会先打到挡在前面的小兵
  blocked(p, t) {
    const h = this.h, ax = h.pos.x, az = h.pos.z, bx = p.x, bz = p.z;
    const L2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1, td = h.dist(t);
    for (const u of this.W.units) {
      if (u === t || u.dead || u.removed || u.team === h.team || (u.kind !== 'minion' && u.kind !== 'monster' && u.kind !== 'pet')) continue;
      if (h.dist(u) > td) continue;
      const k = Math.max(0, Math.min(1, ((u.pos.x - ax) * (bx - ax) + (u.pos.z - az) * (bz - az)) / L2));
      if (Math.hypot(ax + (bx - ax) * k - u.pos.x, az + (bz - az) * k - u.pos.z) < u.radius + 0.9) return true;
    }
    return false;
  }
  // 范围技能瞄准敌方英雄最密集的位置
  cluster(t, r) {
    const hs = this.W.enemiesIn(this.h.team, t.pos, r * 1.6, { heroOnly: true });
    if (hs.length < 2) return { x: t.pos.x, z: t.pos.z };
    let x = 0, z = 0;
    for (const u of hs) { x += u.pos.x; z += u.pos.z; }
    return { x: x / hs.length, z: z / hs.length };
  }
  // 可以用技能清的兵/野怪：返回 [价值, 目标]
  farmValue(at, r) {
    let v = 0, best = null;
    for (const u of this.W.enemiesIn(this.h.team, at, r)) {
      if (u.kind === 'hero' || (u.kind === 'monster' && u.big)) continue;
      v += u.kind === 'monster' ? 2.5 : 1;
      if (!best || u.hp > best.hp) best = u;
    }
    return [v, best];
  }
  useSkills(fleeing, focus = null) {
    const h = this.h, W = this.W, P = this.P;
    if (h.castLock > 0 || !h.canCast() || h.dashing) return false;
    const hp = hpPct(h);
    const fighting = !!focus;
    const foes = this.foes.filter(u => u.targetable);
    const t = focus || foes.slice().sort((a, b) => h.dist(a) - h.dist(b))[0] || null;
    const td = t ? h.dist(t) : 1e9;
    const hitRecently = W.time - (h.lastHit || -9) < 1.2;
    const jungling = h.order && h.order.type === 'attack' && h.order.target && h.order.target.kind === 'monster';
    const towerHere = this.enemyTowerNear(h.pos, 0);
    const manaOk = (sk) => h.manaless || fighting || fleeing || h.mana - h.costOf(sk) > h.maxMana * (jungling ? 0.25 : 0.4);
    const pokeOk = this.ratio >= 0.85;
    const skills = h.skills.slice().sort((a, b) => (PRI[a.ai] ?? 5) - (PRI[b.ai] ?? 5));
    for (const sk of skills) {
      const key = sk.key, id = h.def.id + key;
      if (!h.ranks[key] || h.cds[key] > 0 || h.mana < h.costOf(sk)) continue;
      if (sk.canCast && !sk.canCast(W, h)) continue;
      if (fleeing && (sk.wind ?? 0.25) > 0.15 && !['hero', 'escape', 'low', 'hurt', 'heal', 'team', 'fightFar'].includes(sk.ai)) continue;
      if (fleeing && ENGAGE.has(id) && sk.ai !== 'fightFar') continue;
      const r = sk.aiRange || sk.range || 0;
      let aim = null, target = null;
      switch (sk.ai) {
        case 'hero': {
          if (!t) break;
          if (!fighting && !fleeing && (!pokeOk || ENGAGE.has(id))) break;
          if (fleeing && key === 'R') break;
          if (key === 'R' && !fighting && hpPct(t) > 0.5) break;
          if (sk.aim === 'self') { if (td < (sk.ind && sk.ind.r ? sk.ind.r : 4) * 0.9) { aim = t.pos; target = t; } break; }
          const p = this.predict(t, sk);
          if (D2(h.pos, p) > (sk.aim === 'unit' ? r + 0.5 : r * 0.92)) break;
          if (sk.aim === 'dir' && key !== 'R' && P.aim >= 0.6 && this.blocked(p, t)) break;
          aim = sk.aim === 'point' && sk.ind && sk.ind.r ? this.cluster(t, sk.ind.r) : p;
          if (sk.aim === 'point' && D2(h.pos, aim) > r) aim = p;
          target = t;
          break;
        }
        case 'enemy': {
          if (t && !(ENGAGE.has(id) && !fighting)) {
            const p = sk.aim === 'self' ? t.pos : this.predict(t, sk);
            if (D2(h.pos, p) <= (sk.aim === 'unit' ? r + 0.5 : r * 0.95) && (fighting || (manaOk(sk) && !fleeing))) {
              if (!(sk.aim === 'dir' && P.aim >= 0.6 && this.blocked(p, t) && !fighting)) { aim = p; target = t; break; }
            }
          }
          if (fighting || fleeing || key === 'R' || !manaOk(sk) || towerHere) break;
          const [v, u] = this.farmValue(h.pos, Math.max(3, r * 0.85));
          if (u && (v >= 3 || (jungling && v >= 2.5))) {
            if (ENGAGE.has(id) && (this.enemyTowerNear(u.pos, 1) || foes.some(f => D2(f.pos, u.pos) < 7))) break;
            aim = u.pos; target = u;
          }
          break;
        }
        case 'close': {
          const rr = sk.aiRange || (sk.ind && sk.ind.r) || 3.6;
          if (t && td < rr * 0.9 && (fighting || fleeing || pokeOk || key !== 'R')) { aim = t.pos; target = t; break; }
          if (fighting || fleeing || key === 'R' || !manaOk(sk)) break;
          const [v, u] = this.farmValue(h.pos, rr);
          if (u && v >= 3) { aim = u.pos; target = u; }
          break;
        }
        case 'fight':
          if (t && (fighting || (pokeOk && td < h.range + 1.5)) && td < Math.max(h.range + 2, 6)) { aim = sk.aim === 'self' || sk.aim === 'ally' ? h.pos : t.pos; target = sk.aim === 'ally' ? h : t; }
          else if (jungling && manaOk(sk) && h.dist(h.order.target) < h.range + 2) { aim = sk.aim === 'self' || sk.aim === 'ally' ? h.pos : h.order.target.pos; target = sk.aim === 'ally' ? h : h.order.target; }
          break;
        case 'execute': {
          const lo = foes.filter(u => h.dist(u) < r + 0.5 && (hpPct(u) < 0.4 || u.hp < 260 * h.rk(key))).sort((a, b) => a.hp - b.hp)[0];
          if (lo) { aim = lo.pos; target = lo; }
          break;
        }
        case 'executeFar': {
          const lo = W.enemiesIn(h.team, h.pos, r, { heroOnly: true }).filter(u => u.targetable && (hpPct(u) < 0.35 || u.hp < 280 * h.rk(key))).sort((a, b) => a.hp - b.hp)[0];
          if (lo && (!fleeing || h.dist(lo) > 8)) { aim = sk.aim === 'unit' ? lo.pos : this.predict(lo, sk); target = lo; }
          break;
        }
        case 'hurt':
          if (hp < 0.8 && (hitRecently || (t && td < 4)) && (td < 10 || towerHere)) { aim = t ? t.pos : h.pos; target = sk.aim === 'ally' ? h : t; }
          break;
        case 'low':
          if (hp < 0.35 && (hitRecently || td < 6)) { aim = h.pos; target = h; }
          break;
        case 'heal': {
          const as = W.alliesIn(h.team, h.pos, r + 0.5, true).filter(a => (a !== h || sk.allowSelf) && (hpPct(a) < 0.65 || (hpPct(a) < 0.9 && W.time - (a.lastHit || -9) < 1 && a.lastHeroHit && W.time - a.lastHeroHit.t < 1)));
          const a = as.sort((x, y) => hpPct(x) - hpPct(y))[0];
          if (a) { aim = a.pos; target = a; }
          break;
        }
        case 'team': {
          const hs = W.units.filter(u => u.kind === 'hero' && u.team === h.team && !u.dead);
          if (hs.some(u => hpPct(u) < 0.3 && W.time - (u.lastHit || -9) < 3) || hs.filter(u => hpPct(u) < 0.5).length >= 2) { aim = h.pos; target = h; }
          break;
        }
        case 'escape':
          if (t && ((fleeing && td < 7) || (h.range > 4 && td < 3 && t.range < 4))) { aim = t.pos; target = t; }
          break;
        case 'enemyNear':
          if (t && td < r && (fighting || pokeOk || fleeing)) { aim = this.predict(t, sk); target = t; }
          break;
        case 'fightFar':
          if (fleeing && t && td < 7) { aim = this.escapePoint(r || 5); }
          else if (fighting && t && td > h.range + 1 && td < r + h.range + 1 && (hpPct(t) < 0.6 || this.ratio > 1.3)) { aim = t.pos; target = t; }
          break;
        default: break;
      }
      if (!aim) continue;
      if (h.cast(key, { x: aim.x, z: aim.z }, target) === 'ok') { this.lastCast = W.time; return true; }
    }
    return false;
  }
  useSpells(hp, fleeing, t) {
    const h = this.h, W = this.W, P = this.P;
    const near = this.foes.filter(u => h.dist(u) < 8);
    const hitRecently = W.time - (h.lastHit || -9) < 1.2;
    for (const key of ['D', 'F']) {
      if (h.cds[key] > 0) continue;
      const id = h.spells[key];
      let aim = null, tgt = null;
      switch (id) {
        case 'flash':
          if (hp < 0.18 && near.length && hitRecently) aim = this.escapePoint(8);
          else if (!fleeing && t && P.dive && hp > 0.3 && hpPct(t) < 0.2 && h.dist(t) > h.range + 1 && h.dist(t) < h.range + 7 && this.burst(h, t, 1.5) > t.hp) aim = t.pos;
          break;
        case 'heal': {
          const ally = W.alliesIn(h.team, h.pos, 8, true).find(a => a !== h && hpPct(a) < 0.2 && W.time - (a.lastHit || -9) < 1);
          if ((hp < 0.25 && hitRecently && (near.length || this.enemyTowerNear(h.pos))) || ally) aim = h.pos;
          break;
        }
        case 'barrier': if (hp < 0.25 && hitRecently && (near.length || this.enemyTowerNear(h.pos))) aim = h.pos; break;
        case 'ghost': if ((fleeing && near.length && hp < 0.5) || (t && !fleeing && hpPct(t) < 0.4 && h.dist(t) > h.range + 2)) aim = h.pos; break;
        case 'ignite':
          if (t && h.dist(t) < 6.5 && (t.hp < 60 + 26 * h.level || (hpPct(t) < 0.35 && this.ratio > 0.8))) { aim = t.pos; tgt = t; }
          break;
        case 'exhaust': {
          const e = near.filter(u => h.dist(u) < 6.5).sort((a, b) => dpsOf(b) - dpsOf(a))[0];
          if (e && (hp < 0.55 || (t && this.ratio < 1.3)) && (hitRecently || W.time - (e.aggroT || -9) < 0)) { aim = e.pos; tgt = e; }
          break;
        }
        case 'cleanse': if ((h.has('stun') || h.has('root') || h.has('charm') || h.has('silence')) && near.length) aim = h.pos; break;
        case 'smite': {
          const m = W.units.find(u => u.kind === 'monster' && !u.dead && u.hp <= 600 && h.dist(u) < 6 + u.radius
            && (u.big || u.mkind === 'blue' || u.mkind === 'red' || u.mkind === 'crab' || (u.target === h && Math.random() < 0.25)));
          if (m) { aim = m.pos; tgt = m; }
          break;
        }
        case 'teleport': {
          if (this.role === 'jungle' || fleeing || !h.canShop() || hp < 0.9 || this.foes.length) break;
          const lane = this.laneName;
          const tw = W.units.filter(u => u.kind === 'tower' && !u.dead && u.team === h.team && u.info.lane === lane)
            .sort((a, b) => (h.team === 1 ? b.info.d - a.info.d : a.info.d - b.info.d))[0];
          if (tw && D2(tw.pos, h.pos) > 60) aim = tw.pos;
          break;
        }
        default: break;
      }
      if (aim && h.cast(key, { x: aim.x, z: aim.z }, tgt) === 'ok') return true;
    }
    return false;
  }

  // ---------- 团队协作 ----------
  // 附近的队友在和敌方英雄交手：过去帮忙
  assist() {
    const h = this.h, W = this.W, P = this.P;
    if (hpPct(h) < 0.45) return false;
    let best = null, bd = 1e9;
    for (const a of W.units) {
      if (a.kind !== 'hero' || a.team !== h.team || a === h || a.dead) continue;
      const d = h.dist(a);
      if (d > P.assist || d < 3) continue;
      const busy = (a.aggroT || 0) > W.time || (a.lastHeroHit && W.time - a.lastHeroHit.t < 2.5);
      if (!busy || !W.enemiesIn(h.team, a.pos, 10, { heroOnly: true }).length) continue;
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) return false;
    const e = W.enemiesIn(h.team, best.pos, 10, { heroOnly: true })[0];
    if (e && this.enemyTowerNear(e.pos, 2) && !P.dive) return false;
    this.goTo(best.pos.x, best.pos.z, 3);
    return true;
  }
  defendBase() {
    const s = this.brain.defend, h = this.h;
    if (!s || s.dead || hpPct(h) < 0.5 || h.dist(s) > 55 || this.fightRatio(s.pos) < 0.45) return false;
    this.goTo(s.pos.x, s.pos.z, 4);
    return true;
  }
  objective(o) {
    const h = this.h, W = this.W, m = o.unit;
    if (!m || m.dead) return false;
    if (h.dist(m) > 13) { this.goTo(o.pos.x, o.pos.z, 3); return true; }
    const allies = W.alliesIn(h.team, m.pos, 14, true).length;
    if (allies < o.need && m.hp >= m.maxHp * 0.95 && h.level < 11) {
      // 等队友到齐再开龙
      const p = { x: o.pos.x + (BASE[h.team].x - o.pos.x) * 0.08, z: o.pos.z + (BASE[h.team].z - o.pos.z) * 0.08 };
      this.goTo(p.x, p.z, 3);
      return true;
    }
    this.target = m;
    if (!h.order || h.order.target !== m) h.orderAttack(m);
    return true;
  }

  // ---------- 对线 ----------
  lane() {
    const h = this.h, W = this.W, P = this.P, hp = hpPct(h);
    const name = this.laneName, L = LANES[name] || LANES.mid;
    const dir = h.team === 1 ? 1 : -1;
    const ranged = h.range > 4;
    const myM = [], foeM = [];
    let front = null;
    for (const u of W.units) {
      if (u.kind !== 'minion' || u.dead || u.removed || u.lane !== L) continue;
      if (u.team === h.team) { myM.push(u); if (front === null || (u.laneD - front) * dir > 0) front = u.laneD; }
      else foeM.push(u);
    }
    const towers = W.units.filter(u => u.kind === 'tower' && !u.dead && u.info.lane === name);
    const myT = towers.filter(u => u.team === h.team).map(u => u.info.d), enT = towers.filter(u => u.team !== h.team);
    const safeD = myT.length ? (dir > 0 ? Math.max(...myT) : Math.min(...myT)) : (dir > 0 ? 18 : L.len - 18);
    const foesNear = this.foes.filter(u => h.dist(u) < 14);
    // 1. 推塔 / 拆水晶
    if (this.siege(myM, foesNear, hp)) return;
    // 2. 补刀：预估友方小兵造成的伤害，刚好能一下打死时出手
    const support = this.role === 'support' && W.units.some(u => u.kind === 'hero' && u.team === h.team && !u.dead && u !== h && D2(u.pos, h.pos) < 12 && u.range > 4);
    let lh = null, push = null;
    for (const m of foeM) {
      const d = h.dist(m);
      if (d > h.range + 7) continue;
      const tw = this.enemyTowerNear(m.pos, -0.5);
      if (tw && !(tw.target && tw.target.kind === 'minion')) continue;
      const travel = Math.max(0, d - h.range) / Math.max(1, h.speed) + 0.3 + (ranged ? d / 26 : 0);
      let incoming = 0;
      for (const a of myM) if (a.target === m) incoming += a.ad * a.atkSpeed * travel;
      const err = Math.random() < P.lastHit ? 1 : 0.6 + Math.random() * 0.9;
      if (m.hp - incoming * 0.8 <= h.ad * err && m.hp > 0) { if (!lh || d < h.dist(lh)) lh = m; }
      if (!push || m.hp < push.hp) push = m;
    }
    if (lh && !support) { if (h.order?.target !== lh) h.orderAttack(lh); return; }
    // 3. 换血：对面英雄站进了我的攻击距离，而且我血量不比他差
    const foe = foesNear.filter(u => u.targetable && h.dist(u) < h.range + (ranged ? 1 : 2.5) && !this.enemyTowerNear(u.pos, 1)).sort((a, b) => a.hp - b.hp)[0];
    if (foe && hp >= hpPct(foe) - 0.1 && this.ratio >= 0.75 && (ranged || support || hp > 0.6)) {
      if (h.order?.target !== foe) h.orderAttack(foe);
      return;
    }
    // 4. 推线：附近没有敌方英雄，或者辅助在帮着清兵
    if (push && (!foesNear.length || (myM.length > foeM.length + 2 && !support))) {
      if (h.order?.target !== push) h.orderAttack(push);
      return;
    }
    // 5. 站位：在友方兵线后面一点，不进敌方塔
    let want = front !== null ? front - dir * (ranged ? 3.5 : 2) : safeD - dir * 3;
    const tanking = enT.some(t => t.target && t.target.kind === 'minion');
    if (enT.length) {
      const et = dir > 0 ? Math.min(...enT.map(u => u.info.d)) : Math.max(...enT.map(u => u.info.d));
      const limit = et - dir * (tanking ? 7 : 14);
      want = dir > 0 ? Math.min(want, limit) : Math.max(want, limit);
    }
    // 对面英雄在附近时，保持在他的攻击距离之外
    const threat = foesNear.find(u => u.range >= h.range - 1);
    if (threat && !foe && hp < hpPct(threat) + 0.15) want -= dir * 2;
    const p = L.pointAt(want);
    if (this.enemyTowerNear(p, 0) && !tanking) { const q = L.pointAt(safeD); this.goTo(q.x, q.z, 3); return; }
    if (D2(p, h.pos) > 2.5) this.goTo(p.x + (Math.random() - 0.5) * 2.5, p.z + (Math.random() - 0.5) * 2.5, 2.5);
  }
  // 攻击敌方建筑：有小兵抗塔、或敌方没人防守时
  siege(myM, foesNear, hp) {
    const h = this.h, W = this.W;
    let s = null, sd = 1e9;
    for (const u of W.units) {
      if (!u.isStructure || u.dead || u.team === h.team) continue;
      const d = h.dist(u) - u.radius;
      if (d < h.range + 8 && d < sd) { sd = d; s = u; }
    }
    if (!s) return false;
    const defenders = foesNear.filter(u => D2(u.pos, s.pos) < 16).length;
    const allies = W.alliesIn(h.team, s.pos, 14, true).length;
    const tw = s.kind === 'tower' ? s : this.enemyTowerNear(s.pos, 0);
    const minionsTank = myM.filter(m => D2(m.pos, s.pos) < (tw ? tw.range + 1 : 12)).length;
    const towerBusy = !tw || (tw.target && tw.target !== h && tw.target.kind !== 'hero') || (tw.target === null && minionsTank > 0);
    const free = defenders === 0 && this.brain.enemyAlive <= 2 && allies >= 3 && hp > 0.6;
    if (defenders > allies) return false;
    if ((minionsTank >= 1 && towerBusy && hp > 0.5) || free || (!tw && defenders === 0)) {
      this.target = s;
      if (h.order?.target !== s) h.orderAttack(s);
      return true;
    }
    return false;
  }

  // ---------- 打野 ----------
  jungle() {
    const h = this.h, W = this.W, P = this.P;
    if (this.gank) {
      const e = this.gank.e;
      if (W.time > this.gank.until || e.dead || !e.targetable || (this.enemyTowerNear(e.pos, 2) && !P.dive) || hpPct(h) < 0.4) this.gank = null;
      else { this.goTo(e.pos.x, e.pos.z, 4); return; }
    }
    if (W.time > this.nextGank && h.level >= 3 && hpPct(h) > 0.6) {
      const e = this.findGank();
      this.nextGank = W.time + (e ? P.gank : 6);
      if (e) { this.gank = { e, until: W.time + 22 }; this.goTo(e.pos.x, e.pos.z, 4); return; }
    }
    const c = this.pickCamp();
    if (c) {
      const m = c.mons.slice().sort((a, b) => (b.target === h) - (a.target === h) || a.hp - b.hp)[0];
      if (h.dist(m) < 12) { this.target = m; if (h.order?.target !== m) h.orderAttack(m); }
      else this.goTo(c.x, c.z, 3);
      return;
    }
    // 野区刷完了：去中路帮忙
    this.lane();
  }
  campsAlive() {
    const W = this.W, out = [];
    CAMPS.forEach((c, i) => {
      const mons = W.units.filter(u => u.kind === 'monster' && !u.dead && u.camp === 'camp' + i);
      if (mons.length) out.push({ x: c.x, z: c.z, mons, mine: D2(c, BASE[this.h.team]) < D2(c, BASE[3 - this.h.team]) });
    });
    for (const u of W.units) if (u.kind === 'monster' && u.mkind === 'crab' && !u.dead) out.push({ x: u.pos.x, z: u.pos.z, mons: [u], mine: true, crab: true });
    return out;
  }
  pickCamp() {
    const h = this.h, P = this.P;
    let best = null, bs = 1e9;
    for (const c of this.campsAlive()) {
      if (!c.mine && !(P.macro >= 2 && h.level >= 6)) continue;
      if (c.crab && h.level < 3) continue;
      if (!c.mine && this.W.enemiesIn(h.team, c, 18, { heroOnly: true }).length) continue;
      const s = D2(c, h.pos) + (c.mine ? 0 : 25) + (c.crab ? 10 : 0);
      if (s < bs) { bs = s; best = c; }
    }
    return best;
  }
  // 找适合抓的人：残血、压线过深、离我近、我方队友在旁边
  findGank() {
    const h = this.h, W = this.W;
    let best = null, bs = this.P.macro >= 2 ? 1.0 : 1.3;
    for (const e of W.units) {
      if (e.kind !== 'hero' || e.team === h.team || e.dead || !e.targetable) continue;
      let lane = null, ld = 1e9;
      for (const k of ['top', 'mid', 'bot']) { const L = LANES[k], p = L.pointAt(L.progressOf(e.pos)), d = D2(p, e.pos); if (d < ld) { ld = d; lane = k; } }
      if (ld > 10 || this.enemyTowerNear(e.pos, 3)) continue;
      const L = LANES[lane], prog = L.progressOf(e.pos) / L.len;
      const over = h.team === 1 ? prog < 0.5 : prog > 0.5;
      const ally = W.units.some(a => a.kind === 'hero' && a.team === h.team && !a.dead && a !== h && D2(a.pos, e.pos) < 16);
      const d = h.dist(e);
      if (d > 90) continue;
      const s = (1 - hpPct(e)) * 2 + (over ? 0.8 : 0) + (ally ? 0.8 : 0) - d / 70 + (e.level <= h.level ? 0.3 : 0);
      if (s > bs) { bs = s; best = e; }
    }
    return best;
  }
}
