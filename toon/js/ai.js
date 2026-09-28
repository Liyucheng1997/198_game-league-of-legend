// 电脑英雄 AI：对线、打野、团战放技能、残血回家。
import { LANES, CAMPS, FOUNTAIN, BASE } from './map.js';

export class HeroBot {
  constructor(hero, game, role) {
    this.h = hero; this.g = game; this.role = role;
    this.t = Math.random() * 0.3;
    this.camp = 0; this.gank = null; this.retreating = false;
    this.lastPos = { x: hero.pos.x, z: hero.pos.z }; this.stuckT = 0;
  }
  get W() { return this.g.world; }
  enemyTowerNear(p, pad = 0) {
    return this.W.units.find(u => u.kind === 'tower' && !u.dead && u.team !== this.h.team && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < u.range + 1 + pad);
  }
  alliedMinionsNear(p, r) {
    return this.W.units.filter(u => u.kind === 'minion' && !u.dead && u.team === this.h.team && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r).length;
  }
  update(dt) {
    const h = this.h, W = this.W;
    if (h.dead) { this.retreating = false; return; }
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.22 + Math.random() * 0.12;
    if (h.recallT > 0) {
      if (W.enemiesIn(h.team, h.pos, 9, { heroOnly: true }).length) h.cancelRecall();
      else return;
    }
    const hp = h.hp / h.maxHp;
    const foes = W.enemiesIn(h.team, h.pos, 14, { heroOnly: true });
    // 卡住检测
    const moved = Math.hypot(h.pos.x - this.lastPos.x, h.pos.z - this.lastPos.z);
    this.lastPos = { x: h.pos.x, z: h.pos.z };
    if (h.path && moved < 0.05) { this.stuckT += 0.25; if (this.stuckT > 1.2) { h.path = null; this.stuckT = 0; } } else this.stuckT = 0;

    // 撤退：只有真的很危险、又杀不掉对面时才跑
    const prey = this.pickHero(foes);
    const killable = prey && (prey.hp < h.ad * 2.5 || prey.hp / prey.maxHp < hp - 0.05);
    if (this.retreating && killable && prey.hp / prey.maxHp < 0.25) this.retreating = false; // 回头补刀
    if (this.retreating || (hp < 0.12 && !killable)) {
      if (!this.retreating) { this.retreating = true; this.useSpells(foes, hp); }
      if (hp > 0.85) { this.retreating = false; }
      else {
        const f = FOUNTAIN[h.team];
        this.useSkills(foes, true);
        if (!foes.length && Math.hypot(h.pos.x - f.x, h.pos.z - f.z) > 20 && !h.path && W.time - (h.lastHit || 0) > 3) h.recall();
        else if (!h.path || h.order?.type !== 'move') h.orderMove(f.x, f.z);
        return;
      }
    }
    // 钱够买下一件装备、附近又没有敌方英雄时回城购物
    const want = this.g.nextPrice(h);
    if (want && h.gold >= Math.max(want, 900) && !foes.length && W.time - (this.shopRecall || -99) > 40) {
      const f = FOUNTAIN[h.team];
      if (Math.hypot(h.pos.x - f.x, h.pos.z - f.z) > 30) { this.shopRecall = W.time; h.recall(); return; }
    }
    // 技能
    this.useSkills(foes, false);
    this.useSpells(foes, hp);
    // 追击英雄
    const target = this.pickHero(foes);
    if (target) {
      const dive = this.enemyTowerNear(target.pos);
      const tp = target.hp / target.maxHp;
      const worth = hp > 0.2 || tp < hp + 0.25;
      if (worth && (!dive || tp < 0.25 || this.alliedMinionsNear(dive.pos, 11) >= 2)) {
        if (h.order?.target !== target) h.orderAttack(target);
        return;
      }
    }
    if (this.role === 'jungle') return this.jungle();
    this.laning();
  }
  useSpells(foes, hp) {
    const h = this.h, W = this.W;
    const near = foes.filter(u => h.dist(u) < 7), t = this.pickHero(foes);
    for (const key of ['D', 'F']) {
      if (h.cds[key] > 0) continue;
      const id = h.spells[key];
      let aim = null, tgt = null;
      if (id === 'flash' && hp < 0.15 && near.length) aim = FOUNTAIN[h.team];
      else if ((id === 'heal' || id === 'barrier') && hp < 0.3 && near.length) aim = h.pos;
      else if (id === 'ghost' && ((this.retreating && near.length) || (t && t.hp / t.maxHp < 0.35 && h.dist(t) > h.range + 2))) aim = h.pos;
      else if (id === 'ignite' && t && h.dist(t) < 7 && t.hp / t.maxHp < 0.3) { aim = t.pos; tgt = t; }
      else if (id === 'exhaust' && t && h.dist(t) < 6 && hp < 0.6) { aim = t.pos; tgt = t; }
      else if (id === 'cleanse' && (h.has('stun') || h.has('root') || h.has('charm')) && near.length) aim = h.pos;
      else if (id === 'smite') {
        const m = W.units.find(u => u.kind === 'monster' && !u.dead && u.hp < 600 && h.dist(u) < 6 && (u.big || u.mkind === 'blue' || u.mkind === 'red' || u.target === h));
        if (m) { aim = m.pos; tgt = m; }
      } else if (id === 'teleport' && this.role !== 'jungle' && h.canShop() && hp > 0.9 && !foes.length) {
        const lane = LANES[this.role];
        const tw = W.units.filter(u => u.kind === 'tower' && !u.dead && u.team === h.team && u.info.lane === this.role)
          .sort((a, b) => (h.team === 1 ? b.info.d - a.info.d : a.info.d - b.info.d))[0];
        if (tw && lane) aim = tw.pos;
      }
      if (aim && h.cast(key, { x: aim.x, z: aim.z }, tgt) === 'ok') return;
    }
  }
  pickHero(foes) {
    const h = this.h;
    let best = null, bs = 1e9;
    for (const u of foes) {
      const d = h.dist(u);
      if (d > Math.max(9, h.range + 4)) continue;
      const s = u.hp + d * 30;
      if (s < bs) { bs = s; best = u; }
    }
    return best;
  }
  useSkills(foes, fleeing) {
    const h = this.h, W = this.W, hp = h.hp / h.maxHp;
    if (h.castLock > 0) return;
    const t = foes.slice().sort((a, b) => h.dist(a) - h.dist(b))[0];
    for (const sk of h.skills) {
      if (h.cds[sk.key] > 0) continue;
      const r = sk.range || 0;
      let aim = null, target = null;
      const td = t ? h.dist(t) : 1e9;
      switch (sk.ai) {
        case 'fight': if (t && td < Math.max(6, h.range + 2) && !fleeing) aim = t.pos; break;
        case 'close': {
          const near = W.enemiesIn(h.team, h.pos, 3.6);
          if ((near.some(u => u.kind === 'hero') || near.length >= 3) && !fleeing) aim = h.pos;
          break;
        }
        case 'enemy':
          if (t && td < r * 0.9) { aim = lead(t, 0.25); target = t; }
          else if (!fleeing && sk.cd <= 8) {
            const ms = W.enemiesIn(h.team, h.pos, r * 0.85).filter(u => u.kind === 'minion');
            if (ms.length >= 3) { aim = ms[0].pos; target = ms[0]; }
          }
          break;
        case 'hero': if (t && td < r * 0.85 && !fleeing) { aim = lead(t, 0.3); target = t; } break;
        case 'execute': if (t && td < r && t.hp / t.maxHp < 0.4) { aim = t.pos; target = t; } break;
        case 'executeFar': {
          const lo = W.enemiesIn(h.team, h.pos, r, { heroOnly: true }).find(u => u.hp / u.maxHp < 0.35);
          if (lo && !fleeing) { aim = lo.pos; target = lo; }
          break;
        }
        case 'hurt': if (hp < 0.7 && t && td < 9) aim = h.pos; break;
        case 'low': if (hp < 0.35 && (!t || td > 3)) aim = h.pos; break;
        case 'heal': {
          const a = W.alliesIn(h.team, h.pos, r, true).find(u => u !== h && u.hp / u.maxHp < 0.6);
          if (a) { aim = a.pos; target = a; }
          break;
        }
        case 'team': if (W.units.some(u => u.kind === 'hero' && u.team === h.team && !u.dead && u.hp / u.maxHp < 0.3)) aim = h.pos; break;
        case 'escape': if (t && td < 5) { aim = t.pos; target = t; } break;
        case 'enemyNear': if (t && td < r) { aim = t.pos; target = t; } break;
        case 'fightFar': if (t && td < 10 && t.hp / t.maxHp < 0.5 && !fleeing) { aim = t.pos; target = t; } else if (fleeing && t && td < 6) aim = FOUNTAIN[h.team]; break;
        default: break;
      }
      if (aim && h.cast(sk.key, { x: aim.x, z: aim.z }, target) === 'ok') return;
    }
  }
  laning() {
    if (this.gank && this.W.time > this.gankUntil) this.gank = null;
    const h = this.h, W = this.W, lane = LANES[this.gank || this.role] || LANES.mid;
    const dir = h.team === 1 ? 1 : -1;
    const myD = lane.progressOf(h.pos);
    // 最前排友方小兵
    let front = null;
    for (const u of W.units) {
      if (u.kind !== 'minion' || u.dead || u.team !== h.team || u.lane !== lane) continue;
      if (front === null || (u.laneD - front) * dir > 0) front = u.laneD;
    }
    const towers = W.units.filter(u => u.kind === 'tower' && !u.dead && u.info.lane === (this.gank || this.role));
    const myTowers = towers.filter(u => u.team === h.team).map(u => u.info.d);
    const enemyTowers = towers.filter(u => u.team !== h.team).map(u => u.info.d);
    const safe = myTowers.length ? (dir > 0 ? Math.max(...myTowers) : Math.min(...myTowers)) : (dir > 0 ? 20 : lane.len - 20);
    let want = front !== null ? front - dir * 3 : safe - dir * 2;
    if (enemyTowers.length) {
      const et = dir > 0 ? Math.min(...enemyTowers) : Math.max(...enemyTowers);
      const minionsAtTower = front !== null && (et - front) * dir < 10;
      if (!minionsAtTower) want = dir > 0 ? Math.min(want, et - 14) : Math.max(want, et + 14);
      else want = dir > 0 ? Math.min(want, et - 6) : Math.max(want, et + 6);
    }
    // 攻击范围内的敌方小兵 / 塔
    const reach = h.range + 3;
    const tw = this.enemyTowerNear(h.pos, 1);
    if (tw && this.alliedMinionsNear(tw.pos, 11) >= 2 && h.dist(tw) < h.range + 6) { if (h.order?.target !== tw) h.orderAttack(tw); return; }
    const m = W.units.filter(u => u.kind === 'minion' && !u.dead && u.team !== h.team && h.dist(u) < reach && !this.enemyTowerNear(u.pos, -1)).sort((a, b) => a.hp - b.hp)[0];
    if (m) { if (h.order?.target !== m) h.orderAttack(m); return; }
    const p = lane.pointAt(want);
    if (Math.hypot(p.x - h.pos.x, p.z - h.pos.z) > 3 && (!h.path || h.order?.type !== 'move' || Math.random() < 0.15)) h.orderMove(p.x + (Math.random() - 0.5) * 3, p.z + (Math.random() - 0.5) * 3);
  }
  jungle() {
    const h = this.h, W = this.W;
    if (this.gank) return this.laning();
    // 发现附近有残血敌方英雄就去抓
    if (W.time > (this.nextGank || 60)) {
      const lanes = ['top', 'mid', 'bot'];
      this.gank = lanes[Math.floor(Math.random() * 3)];
      this.gankUntil = W.time + 25;
      this.nextGank = W.time + 70;
      return;
    }
    const mine = CAMPS.filter(c => Math.hypot(c.x - BASE[h.team].x, c.z - BASE[h.team].z) < Math.hypot(c.x - BASE[3 - h.team].x, c.z - BASE[3 - h.team].z));
    const camp = mine[this.camp % mine.length];
    const mon = W.units.find(u => u.kind === 'monster' && !u.dead && Math.hypot(u.pos.x - camp.x, u.pos.z - camp.z) < 6);
    if (mon) { if (h.order?.target !== mon) h.orderAttack(mon); return; }
    if (Math.hypot(camp.x - h.pos.x, camp.z - h.pos.z) < 4) { this.camp++; return; }
    if (!h.path || h.order?.type !== 'move') h.orderMove(camp.x, camp.z);
  }
}

function lead(u, t) {
  if (!u.path || !u.path.length) return u.pos;
  const p = u.path[0], d = Math.hypot(p.x - u.pos.x, p.z - u.pos.z) || 1, s = Math.min(d, u.speed * t);
  return { x: u.pos.x + (p.x - u.pos.x) / d * s, z: u.pos.z + (p.z - u.pos.z) / d * s };
}
