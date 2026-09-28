// 战斗世界：单位管理、弹道、区域、伤害、控制效果与位移。
import * as THREE from 'three';
import { VFX, projMesh } from './vfx.js';
import { clamp } from './toon-kit.js';

export class World {
  constructor(scene, o = {}) {
    this.scene = scene;
    this.vfx = new VFX(scene);
    this.units = [];
    this.projs = [];
    this.timers = [];
    this.zones = [];
    this.texts = [];
    this.events = [];
    this.time = 0;
    this.grid = o.grid || null;
    this.boundR = o.boundR || 0;
    this.cdMul = 1;
    this.sfx = () => {};      // 由对局/展台接到音效引擎
    this.isPlayer = null;
    this.vfx.sfx = (...a) => this.sfx(...a);
  }
  add(u) { this.units.push(u); if (u.obj && !u.obj.parent) this.scene.add(u.obj); u.syncObj && u.syncObj(); return u; }
  remove(u) { u.removed = true; if (u.obj && u.obj.parent) u.obj.parent.remove(u.obj); }
  get heroes() { return this.units.filter(u => u.kind === 'hero'); }
  after(t, fn) { this.timers.push({ t, fn }); }

  walkable(x, z) {
    if (this.grid) return this.grid.ok(x, z);
    return !this.boundR || Math.hypot(x, z) < this.boundR;
  }
  findPath(from, to) {
    if (this.grid) return this.grid.path(from.x, from.z, to.x, to.z);
    const d = Math.hypot(to.x, to.z);
    if (this.boundR && d > this.boundR - 0.5) return [{ x: to.x / d * (this.boundR - 0.5), z: to.z / d * (this.boundR - 0.5) }];
    return [{ x: to.x, z: to.z }];
  }
  clampDash(from, to, through = false) {
    if (this.grid) return this.grid.lastOpen(from.x, from.z, to.x, to.z, through);
    const d = Math.hypot(to.x, to.z), R = this.boundR - 0.5;
    if (this.boundR && d > R) return { x: to.x / d * R, z: to.z / d * R };
    return { x: to.x, z: to.z };
  }

  // ---------- 查询 ----------
  enemiesIn(team, p, r, o = {}) {
    const out = [];
    for (const u of this.units) {
      if (u.removed || !u.targetable || u.team === team) continue;
      if (u.isStructure && !o.structures) continue;
      if (o.heroOnly && u.kind !== 'hero') continue;
      if (Math.hypot(u.pos.x - p.x, u.pos.z - p.z) <= r + u.radius) out.push(u);
    }
    return out;
  }
  alliesIn(team, p, r, heroOnly = false) {
    return this.units.filter(u => !u.removed && u.targetable && u.team === team && !u.isStructure && (!heroOnly || u.kind === 'hero') && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) <= r + u.radius);
  }
  nearestEnemy(team, p, r, pred) {
    let best = null, bd = 1e9;
    for (const u of this.enemiesIn(team, p, r)) {
      if (pred && !pred(u)) continue;
      const d = Math.hypot(u.pos.x - p.x, u.pos.z - p.z);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }
  // 小兵/召唤物选敌：优先小兵，其次英雄，最后建筑；不主动打野怪
  pickTarget(me, r, preferHero = false) {
    let best = null, bs = 1e9;
    for (const u of this.units) {
      if (u.removed || !u.targetable || u.team === me.team || u.team === 0) continue;
      const d = me.dist(u);
      if (d > r + u.radius) continue;
      const score = d + (u.isStructure ? 20 : u.kind === 'hero' ? (preferHero ? -5 : 6) : 0);
      if (score < bs) { bs = score; best = u; }
    }
    return best;
  }
  towerTarget(tw) {
    let best = null, bs = 1e9;
    for (const u of this.units) {
      if (u.removed || !u.targetable || u.team === tw.team || u.team === 0 || u.isStructure) continue;
      const d = tw.dist(u);
      if (d > tw.range + u.radius) continue;
      // 英雄攻击了塔下友方英雄时优先打他
      const aggro = u.kind === 'hero' && u.aggroT > this.time;
      const score = d + (u.kind === 'hero' ? (aggro ? -50 : 15) : 0);
      if (score < bs) { bs = score; best = u; }
    }
    return best;
  }

  // ---------- 伤害与治疗 ----------
  damage(src, u, amt, o = {}) {
    if (!u || u.dead || u.removed) return 0;
    if (u.has('untargetable') && !o.force) return 0;
    let dmg = amt;
    for (const b of u.buffs) if (b.dr) dmg *= 1 - b.dr;
    if (src && src.buffs) for (const b of src.buffs) if (b.weaken) dmg *= 1 - b.weaken;
    // 护甲与魔抗
    if (o.type === 'phys' && u.armor) dmg *= 100 / (100 + u.armor);
    else if (o.type === 'magic' && u.mr) dmg *= 100 / (100 + u.mr);
    // 护盾
    for (const b of u.buffs) {
      if (b.shield > 0 && dmg > 0) { const a = Math.min(b.shield, dmg); b.shield -= a; dmg -= a; if (b.shield <= 0) b.t = 0; }
    }
    u.hp -= dmg;
    u.lastHit = this.time;
    u.lastAttacker = src;
    if (src && src.kind === 'hero' && u.kind === 'hero') { src.aggroT = this.time + 2.5; u.lastHeroHit = { src, t: this.time }; }
    u.onDamaged && u.onDamaged(src);
    if (this.isPlayer && src && this.isPlayer(src) && u.team !== src.team) { this.playerTarget = u; this.playerTargetT = this.time; }
    // 装备特效：荆棘反伤、冰杖减速
    if (o.auto && src && u.uniques && u.uniques.has('thorns') && src.kind !== 'minion') this.damage(u, src, 20 + u.armor * 0.1, { type: 'magic', noText: true });
    if (!o.auto && !o.item && src && src.uniques && src.uniques.has('rylai') && src !== u) this.cc(u, 'slow', 1, { pct: 0.3, id: 'rylai' });
    if (u.kind !== 'minion' && amt > 8) this.sfx(o.type === 'magic' ? 'zap' : 'hit', u.pos, Math.min(1, 0.35 + amt / 250));
    if (u.rig && dmg > 30) u.rig.hitReact();
    if (!o.noText && amt > 0) {
      const col = o.type === 'magic' ? '#b98aff' : o.type === 'true' ? '#ffffff' : '#ffb03a';
      this.texts.push({ x: u.pos.x + (Math.random() - 0.5) * 0.8, y: u.height + 0.3, z: u.pos.z, text: Math.round(amt), color: o.color || col, t: 0, dur: 0.9, big: amt > 150 });
    }
    if (u.hp <= 0) {
      u.hp = 0;
      if (!u.dead) {
        u.die(src);
        this.events.push({ type: 'kill', killer: src, victim: u, t: this.time });
      }
    }
    return dmg;
  }
  heal(u, amt) {
    if (!u || u.dead) return;
    if (u.uniques && u.uniques.has('spirit')) amt *= 1.25;
    for (const b of u.buffs) if (b.grievous) amt *= 1 - b.grievous;
    const h = Math.min(amt, u.maxHp - u.hp);
    u.hp += h;
    if (h > 5) this.texts.push({ x: u.pos.x, y: u.height + 0.3, z: u.pos.z, text: '+' + Math.round(h), color: '#7dff7a', t: 0, dur: 0.9 });
  }
  shield(u, amt, dur, color = '#ffe27a') {
    if (u.uniques && u.uniques.has('spirit')) amt *= 1.25;
    const id = 'shield' + Math.random();
    u.addBuff(id, dur, { shield: amt });
    const e = this.vfx.bubble(u.pos, { color, r: 1.1 * (u.rig ? u.rig.s.scale : 1) + 0.2, dur, opacity: 0.3, fade: false, follow: u.pos, y: 1.2 });
    const orig = e.upd;
    e.upd = (k, dt, ee) => { orig(k, dt, ee); ee.obj.position.y = 1.2 + u.lift; const b = u.buff(id); if (!b || u.dead) ee.kill = true; };
  }
  cc(u, type, dur, data = {}) {
    if (!u || u.dead || u.isStructure) return;
    if (u.kind === 'monster' && u.big && type !== 'slow') return;
    const ten = Math.max(u.tenacity || 0, (u.tenacityBuff || 0) > this.time ? 0.65 : 0);
    if (ten && type !== 'knockup') dur *= 1 - ten;
    if (type === 'stun') this.sfx('stun', u.pos);
    if (type === 'charm') this.sfx('charm', u.pos);
    if (type === 'slow') u.addBuff('slow' + (data.id || ''), dur, { slow: data.pct ?? 0.3 });
    else if (type === 'charm') { u.addBuff('charm', dur, { src: data.src }); u.path = null; }
    else u.addBuff(type, dur, data);
    if (type === 'stun' || type === 'root' || type === 'knockup') {
      u.path = null;
      if (type === 'stun') this.vfx.add(null, dur, (k) => {
        if (Math.random() < 0.3) this.vfx.trail({ x: u.pos.x + Math.cos(this.time * 8) * 0.5, y: u.height + 0.2, z: u.pos.z + Math.sin(this.time * 8) * 0.5 }, { color: '#ffe36a', cell: 'star', size: 0.45, vy: 0, life: 0.25, grow: 0 });
      });
      if (type === 'root') this.vfx.disc(u.pos, { r: 1.1, color: data.color || '#9ad0ff', dur, opacity: 0.8, spin: 2, follow: u.pos });
    }
    if (type === 'knockup') {
      const h = data.height ?? 2.2;
      this.vfx.add(null, dur, (k) => { u.lift = Math.sin(k * Math.PI) * h; if (k > 0.97) u.lift = 0; }, { onEnd: () => { u.lift = 0; } });
    }
    if (type === 'silence') this.vfx.add(null, dur, () => { if (Math.random() < 0.15) this.vfx.trail({ x: u.pos.x, y: u.height + 0.4, z: u.pos.z }, { color: '#c8a0ff', cell: 'spark', size: 0.5, vy: 0.5, life: 0.4 }); });
  }

  // ---------- 位移 ----------
  dash(u, to, o = {}) {
    const from = { x: u.pos.x, z: u.pos.z };
    const end = o.exact ? to : this.clampDash(from, to, o.through);
    const dur = o.dur ?? 0.25;
    u.dashing = true; u.path = null;
    u.face(end.x, end.z); u.facing = u.faceTarget;
    if (o.anim && u.rig) u.rig.play(o.anim, dur + 0.15);
    this.vfx.add(null, dur, (k) => {
      u.pos.x = from.x + (end.x - from.x) * k;
      u.pos.z = from.z + (end.z - from.z) * k;
      u.lift = o.arc ? Math.sin(k * Math.PI) * o.arc : 0;
      if (o.trail) this.vfx.trail({ x: u.pos.x, y: 1 + u.lift, z: u.pos.z }, o.trail);
      o.during && o.during(k);
    }, { onEnd: () => { u.pos.x = end.x; u.pos.z = end.z; u.lift = 0; u.dashing = false; o.onEnd && o.onEnd(end); } });
    return end;
  }
  // 把单位拉向/推离某点
  displace(u, to, dur = 0.25) {
    if (u.isStructure || (u.kind === 'monster' && u.big)) return;
    const end = this.clampDash(u.pos, to);
    const from = { x: u.pos.x, z: u.pos.z };
    u.addBuff('stun', dur);
    this.vfx.add(null, dur, (k) => { u.pos.x = from.x + (end.x - from.x) * k; u.pos.z = from.z + (end.z - from.z) * k; });
  }

  // ---------- 弹道 ----------
  projectile(o) {
    const p = {
      pos: o.from.clone ? o.from.clone() : new THREE.Vector3(o.from.x, o.from.y ?? 1.3, o.from.z),
      dir: null, target: o.target || null, speed: o.speed || 20, range: o.range || 30, traveled: 0,
      radius: o.radius ?? 0.6, team: o.team, owner: o.owner, pierce: o.pierce || false, hit: new Set(),
      onHit: o.onHit, onEnd: o.onEnd, mesh: o.mesh || null, trail: o.trail, spin: o.spin || 0, maxHits: o.maxHits || 99,
      heroOnly: o.heroOnly, onStep: o.onStep, returnTo: o.returnTo || null, hitStructures: o.hitStructures, dead: false, arc: o.arc || 0,
      scale: o.scale || 1, filter: o.filter || null,
    };
    if (o.dir) { p.dir = new THREE.Vector3(o.dir.x, 0, o.dir.z).normalize(); }
    if (p.mesh) {
      p.mesh.position.copy(p.pos); p.mesh.scale.setScalar(p.scale);
      this.scene.add(p.mesh);
    }
    this.projs.push(p);
    return p;
  }
  updateProjs(dt) {
    for (const p of this.projs) {
      if (p.dead) continue;
      let dx, dy = 0, dz;
      if (p.target) {
        const t = p.target;
        if (!t.targetable && !p.targetLost) { p.targetLost = true; }
        const ty = (t.height || 2) * 0.55 + (t.lift || 0);
        const vx = t.pos.x - p.pos.x, vy = ty - p.pos.y, vz = t.pos.z - p.pos.z;
        const d = Math.hypot(vx, vy, vz);
        const s = p.speed * dt;
        if (d <= s + 0.3) {
          p.dead = true;
          if (t.targetable) p.onHit && p.onHit(t, p);
          p.onEnd && p.onEnd(p.pos, p);
          continue;
        }
        dx = vx / d * s; dy = vy / d * s; dz = vz / d * s;
      } else if (p.returnTo) {
        const t = p.returnTo;
        const vx = t.pos.x - p.pos.x, vz = t.pos.z - p.pos.z, d = Math.hypot(vx, vz), s = p.speed * dt;
        if (d <= s + 0.5 || t.dead) { p.dead = true; p.onEnd && p.onEnd(p.pos, p); continue; }
        dx = vx / d * s; dz = vz / d * s; dy = (1.3 - p.pos.y) * 0.1;
      } else {
        const s = p.speed * dt;
        dx = p.dir.x * s; dz = p.dir.z * s;
        p.traveled += s;
        if (p.traveled >= p.range) { p.dead = true; p.onEnd && p.onEnd(p.pos, p); continue; }
      }
      p.pos.x += dx; p.pos.y += dy; p.pos.z += dz;
      if (p.mesh) {
        p.mesh.position.copy(p.pos);
        if (p.arc && p.dir) p.mesh.position.y += Math.sin(clamp(p.traveled / p.range) * Math.PI) * p.arc;
        p.mesh.rotation.y = Math.atan2(dx, dz);
        if (p.spin) p.mesh.rotation.z += p.spin * dt;
      }
      if (p.trail && Math.random() < (p.trail.rate ?? 0.9)) this.vfx.trail(p.mesh ? p.mesh.position : p.pos, p.trail);
      p.onStep && p.onStep(p, dt);
      // 技能弹道碰撞
      if (!p.target && p.onHit) {
        for (const u of this.enemiesIn(p.team, p.pos, p.radius, { heroOnly: p.heroOnly, structures: p.hitStructures })) {
          if (p.hit.has(u) || (p.filter && !p.filter(u))) continue;
          p.hit.add(u);
          p.onHit(u, p);
          if (!p.pierce || p.hit.size >= p.maxHits) { p.dead = true; p.onEnd && p.onEnd(p.pos, p, u); break; }
        }
      }
    }
    for (const p of this.projs) if (p.dead && p.mesh) { p.mesh.parent && p.mesh.parent.remove(p.mesh); p.mesh = null; }
    this.projs = this.projs.filter(p => !p.dead);
  }

  // ---------- 区域 ----------
  zone(o) {
    const z = { pos: { x: o.pos.x, z: o.pos.z }, r: o.r, t: 0, dur: o.dur, every: o.every ?? 0.5, acc: 0, team: o.team, onTick: o.onTick, onEnd: o.onEnd, onUpdate: o.onUpdate, dead: false };
    this.zones.push(z);
    return z;
  }
  updateZones(dt) {
    for (const z of this.zones) {
      z.t += dt; z.acc += dt;
      z.onUpdate && z.onUpdate(z, dt);
      while (z.acc >= z.every && !z.dead) { z.acc -= z.every; z.onTick && z.onTick(z); }
      if (z.t >= z.dur && !z.dead) { z.dead = true; z.onEnd && z.onEnd(z); }
    }
    this.zones = this.zones.filter(z => !z.dead);
  }

  update(dt) {
    this.time += dt;
    const T = this.timers;
    this.timers = [];
    for (const t of T) { t.t -= dt; if (t.t <= 0) t.fn(); else this.timers.push(t); }
    for (const u of this.units) if (!u.removed) u.update(dt);
    // 轻微分离，避免小兵叠成一坨
    const us = this.units;
    for (let i = 0; i < us.length; i++) {
      const a = us[i];
      if (a.dead || a.removed || a.isStructure || a.dashing || a.kind === 'dummy') continue;
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j];
        if (b.dead || b.removed || b.dashing || b.kind === 'dummy') continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), m = (a.radius + b.radius) * 0.8;
        if (d < m && d > 0.001) {
          const push = (m - d) * 0.5 * Math.min(1, dt * 10);
          const nx = dx / d * push, nz = dz / d * push;
          if (b.isStructure || b.kind === 'monster' && b.big) { if (this.walkable(a.pos.x - nx * 2, a.pos.z - nz * 2)) { a.pos.x -= nx * 2; a.pos.z -= nz * 2; } continue; }
          if (a.kind !== 'hero' || b.kind === 'hero') { if (this.walkable(a.pos.x - nx, a.pos.z - nz)) { a.pos.x -= nx; a.pos.z -= nz; } }
          if (b.kind !== 'hero' || a.kind === 'hero') { if (this.walkable(b.pos.x + nx, b.pos.z + nz)) { b.pos.x += nx; b.pos.z += nz; } }
        }
      }
    }
    this.updateProjs(dt);
    this.updateZones(dt);
    this.vfx.update(dt);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter(t => t.t < t.dur);
    if (this.units.some(u => u.removed)) this.units = this.units.filter(u => !u.removed);
  }
}

export { projMesh };
