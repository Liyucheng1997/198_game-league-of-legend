// 第二批二十位英雄：属性、技能说明与技能实现。结构与 heroes.js 相同，
// 法力表 res、施法音效 sfx、指示器 ind 直接写在各自的定义里。
import * as THREE from 'three';
import { P, G, glowMat } from './toon-kit.js';
import { projMesh } from './vfx.js';
import { dirOf, at, rot, distXZ, inCone, lineHits, notMinion, dropFromSky, L, C, A, SELF, T, NONE } from './skill-kit.js';

const V3 = (p, y = 1.3) => new THREE.Vector3(p.x, y, p.z);
const bigUnit = (u) => u.kind === 'hero' || u.kind === 'dummy';
// 点到线段的距离（风墙、监牢墙）
function segDist(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
}
// 瞬移（闪现式，不走路径）
function blink(W, h, to, through = true) {
  const p = W.clampDash(h.pos, to, through);
  W.vfx.puff(h.pos, { n: 10, color: '#ffffff', cell: 'spark', glow: true, size: 0.7 });
  h.pos.x = p.x; h.pos.z = p.z; h.path = null;
  W.vfx.puff(h.pos, { n: 10, color: '#ffffff', cell: 'star', size: 0.5, speed: 3 });
  return p;
}
// 临时改变单位体型（变形、狂野生长），到时恢复
function resize(W, u, k, dur) {
  if (u.sizeT) return;
  const s0 = u.obj.scale.x; u.sizeT = true;
  u.obj.scale.setScalar(s0 * k);
  W.after(dur, () => { u.obj.scale.setScalar(s0); u.sizeT = false; });
}
// 挂在单位上的持续伤害
function dot(W, h, u, id, dur, per, color) {
  u.addBuff(id, dur, { every: 1, tick: (v) => { W.damage(h, v, per, { type: 'magic' }); if (color) W.vfx.puff(v.pos, { n: 3, color, cell: 'flame', size: 0.4, speed: 1, up: 1.5, y: 1.2 }); } });
}
const hpCost = (h, x) => { h.hp = Math.max(1, h.hp - x); };

// ---------- 技能道具模型 ----------
function tornadoMesh() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(G.torus(0.35 + i * 0.22, 0.07, Math.PI * 1.6, 6, 20), glowMat('#cfe8ff', 0.6));
    m.rotation.x = Math.PI / 2; m.position.y = -1.1 + i * 0.55; g.add(m);
  }
  const core = new THREE.Mesh(G.cone(1.1, 3, 12), glowMat('#9fd0ff', 0.25)); core.rotation.x = Math.PI; core.position.y = 0.2; g.add(core);
  g.userData.spinY = true;
  return g;
}
function shurikenMesh() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) P(G.cone(0.1, 0.45, 4), '#e8e8f0', { parent: g, pos: [Math.cos(i * Math.PI / 2) * 0.25, Math.sin(i * Math.PI / 2) * 0.25, 0], rot: [0, 0, i * Math.PI / 2 - Math.PI / 2], s: [1, 1, 0.3], ol: 0.015 });
  P(G.cyl(0.12, 0.12, 0.06, 10), '#b3262e', { parent: g, rot: [Math.PI / 2, 0, 0], emissive: '#ff3030', ei: 0.6 });
  const h = new THREE.Mesh(G.sphere(10, 8), glowMat('#ff5a5a', 0.35)); h.scale.setScalar(0.6); g.add(h);
  return g;
}
function shadowMesh() {
  const g = new THREE.Group();
  const o = { opacity: 0.6, emissive: '#6a0a20', ei: 0.5, outline: false };
  P(G.capsule(0.42, 0.7), '#2a1420', { parent: g, pos: [0, 1.1, 0], ...o });
  P(G.sphere(), '#2a1420', { parent: g, pos: [0, 2.15, 0], s: 0.55, ...o });
  for (const s of [1, -1]) P(G.box(0.08, 0.06, 0.2), '#ff3a3a', { parent: g, pos: [s * 0.2, 2.15, 0.5], emissive: '#ff2020', ei: 1, outline: false });
  const h = new THREE.Mesh(G.sphere(12, 8), glowMat('#b3262e', 0.25)); h.scale.set(1, 1.6, 1); h.position.y = 1.4; g.add(h);
  return g;
}
function rocketMesh() {
  const g = new THREE.Group();
  P(G.capsule(0.35, 1.4, 8), '#6a8aa0', { parent: g, rot: [Math.PI / 2, 0, 0] });
  P(G.cone(0.36, 0.6, 10), '#e04a6a', { parent: g, pos: [0, 0, 1.2], rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 4; i++) P(G.box(0.05, 0.5, 0.45), '#e04a6a', { parent: g, pos: [0, 0, -0.8], rot: [0, 0, i * Math.PI / 2] });
  for (const s of [1, -1]) P(G.sphere(8, 6), '#ffffff', { parent: g, pos: [s * 0.2, 0.2, 0.9], s: 0.09, outline: false });
  P(G.box(0.4, 0.06, 0.05), '#ffffff', { parent: g, pos: [0, -0.12, 1.05], outline: false });
  return g;
}
function chomperMesh() {
  const g = new THREE.Group();
  P(G.sphere(), '#e04a6a', { parent: g, pos: [0, 0.25, 0], s: [0.4, 0.25, 0.4] });
  for (let i = 0; i < 8; i++) P(G.cone(0.05, 0.15, 4), '#ffffff', { parent: g, pos: [Math.cos(i * 0.785) * 0.3, 0.42, Math.sin(i * 0.785) * 0.3], ol: 0.01 });
  P(G.sphere(8, 6), '#ffe27a', { parent: g, pos: [0, 0.5, 0], s: 0.08, emissive: '#ffe040', ei: 1 });
  return g;
}
function cardMesh(color) {
  const g = new THREE.Group();
  P(G.box(0.42, 0.03, 0.6), '#fff8e8', { parent: g, ol: 0.015 });
  P(G.box(0.3, 0.035, 0.46), color, { parent: g, emissive: color, ei: 0.6, outline: false });
  const h = new THREE.Mesh(G.sphere(10, 8), glowMat(color, 0.35)); h.scale.set(0.5, 0.2, 0.6); g.add(h);
  return g;
}
function clawMesh(color) {
  const g = new THREE.Group();
  P(G.sphere(), '#6a7080', { parent: g, s: 0.22 });
  for (let i = 0; i < 3; i++) P(G.cone(0.07, 0.4, 5), '#c8d0d8', { parent: g, pos: [Math.cos(i * 2.09) * 0.16, Math.sin(i * 2.09) * 0.16, 0.25], rot: [Math.PI / 2, 0, 0] });
  const h = new THREE.Mesh(G.sphere(10, 8), glowMat(color, 0.4)); h.scale.setScalar(0.5); g.add(h);
  return g;
}
function lanternMesh() {
  const g = new THREE.Group();
  P(G.cyl(0.2, 0.25, 0.4, 8), '#2a4a3a', { parent: g });
  P(G.sphere(12, 8), '#7dffb0', { parent: g, s: 0.18, emissive: '#40ff90', ei: 1 });
  const h = new THREE.Mesh(G.sphere(10, 8), glowMat('#7dffb0', 0.5)); h.scale.setScalar(0.6); g.add(h);
  return g;
}
function daggerMesh() {
  const g = new THREE.Group();
  P(G.cone(0.08, 0.6, 4), '#e4ecf4', { parent: g, pos: [0, -0.3, 0], rot: [Math.PI, 0, 0], s: [1, 1, 0.4], ol: 0.015 });
  P(G.box(0.3, 0.06, 0.08), '#c0303a', { parent: g });
  P(G.cyl(0.04, 0.04, 0.22, 6), '#3a2020', { parent: g, pos: [0, 0.14, 0] });
  const h = new THREE.Mesh(G.sphere(10, 8), glowMat('#ff5a6a', 0.3)); h.scale.set(0.4, 0.7, 0.4); g.add(h);
  return g;
}
function mushroomMesh() {
  const g = new THREE.Group();
  P(G.cyl(0.14, 0.18, 0.35, 8), '#f4ecd8', { parent: g, pos: [0, 0.17, 0] });
  P(G.hemi(), '#c0302a', { parent: g, pos: [0, 0.33, 0], s: [0.42, 0.34, 0.42] });
  for (let i = 0; i < 5; i++) P(G.sphere(8, 6), '#ffffff', { parent: g, pos: [Math.cos(i * 1.26) * 0.26, 0.52, Math.sin(i * 1.26) * 0.26], s: 0.06, outline: false });
  return g;
}
function cleaverMesh() {
  const g = new THREE.Group();
  P(G.box(0.7, 0.05, 0.5), '#b8c2cc', { parent: g, pos: [0.15, 0, 0] });
  P(G.box(0.4, 0.07, 0.1), '#5a3a26', { parent: g, pos: [-0.4, 0, 0] });
  P(G.box(0.7, 0.055, 0.06), '#e4ecf4', { parent: g, pos: [0.15, 0, 0.26], outline: false });
  return g;
}
function bubbleMesh() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(G.sphere(20, 14), glowMat('#8ad8ff', 0.45)); m.scale.setScalar(0.8); g.add(m);
  P(G.sphere(10, 8), '#ffffff', { parent: g, pos: [0.25, 0.3, 0.3], s: 0.12, outline: false, emissive: '#ffffff' });
  return g;
}
function waveMesh() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(G.torus(2.4, 0.9, Math.PI, 8, 24), glowMat('#4ab0e0', 0.55)); m.rotation.set(0, 0, 0); m.position.y = 0; g.add(m);
  const f = new THREE.Mesh(G.torus(2.4, 0.35, Math.PI, 6, 24), glowMat('#e6f7ff', 0.7)); f.position.y = 0.6; f.position.z = 0.4; g.add(f);
  return g;
}

// ---------- 被动小工具 ----------
function ezStack(h) { const b = h.buff('ezP'); const n = Math.min(5, (b ? b.n : 0) + 1); h.addBuff('ezP', 6, { n, as: 0.08 * n }); }
function ezPop(W, h, u) {
  if (!(u.ezMark > W.time)) return;
  u.ezMark = 0;
  W.damage(h, u, 110 * h.rk('W'), { type: 'magic' });
  W.vfx.ring(u.pos, { r1: 2.5, color: '#ffd84a', dur: 0.4 }); W.vfx.spark(u.pos, '#ffe27a', 10, 0.8);
}
const sunMark = (W, u) => { u.leonaSun = W.time + 1.5; };
function ignite(W, h, u) {
  const was = u.brandBurn > W.time;
  u.brandBurn = W.time + 4;
  dot(W, h, u, 'brandBurn', 4, 8 + 2.5 * h.level, '#ff8a30');
  return was;
}
const veigarAmp = (h) => 1 + 0.01 * (h.veigarStacks || 0);
function veigarStack(W, h, n = 1) {
  h.veigarStacks = (h.veigarStacks || 0) + n;
  W.vfx.puff(h.pos, { n: 4, color: '#b58aff', cell: 'star', size: 0.4, speed: 1.5, up: 2, y: 2 });
}
const namiSurf = (u) => u.addBuff('namiP', 1.5, { haste: 0.2 });
const amuAmp = (W, u, x) => (u.amuCurse > W.time ? x * 1.1 : x);
function drain(W, h, dealt) { if (dealt > 0) W.heal(h, dealt * 0.15); }

// 飞爪 / 钩子
function hookShot(W, h, aim, o) {
  const d = dirOf(h, aim);
  W.projectile({ from: h.tipPos(), dir: d, speed: o.speed || 28, range: o.range, radius: 0.8, team: h.team, owner: h, mesh: clawMesh(o.color), filter: o.filter,
    onStep: (p) => { W.vfx.trail(p.pos, { color: o.color, size: 0.3, life: 0.35, vy: 0, jit: 0.05 }); },
    onHit: (u) => {
      W.vfx.beam(h.tipPos(), V3(u.pos, 1.2), { width: 0.25, color: o.color, dur: 0.45 });
      o.onHit(u, d);
    } });
}

export const HEROES2 = [
  // ======================= 亚索 =======================
  {
    id: 'yasuo', name: '亚索', title: '疾风剑豪', role: '战士', color: '#3f6fa8',
    hp: 1300, ad: 70, range: 1.7, atkSpeed: 0.78, speed: 7.2, atkAnim: ['hslash', 'hslashBack'], hSlash: true, slashColor: '#cfe8ff', hitColor: '#cfe8ff',
    passive: '浪客之道：普攻有 25% 几率带出剑气，额外造成 60% 攻击力的伤害。',
    onHit(W, h, t) {
      if (Math.random() < 0.25) { W.damage(h, t, h.ad * 0.6, { type: 'phys', color: '#9fd0ff' }); W.vfx.slash(t.pos, h.facing, { color: '#9fd0ff', r: 2.2, tilt: 1 }); }
    },
    res: { mana: 0, cost: [0, 0, 0, 0], order: 'QEW' }, sfx: ['swing', 'whoosh', 'whoosh', 'roar'], ind: [L(0.8), L(3, 3), T(), A(4)],
    skills: [
      { key: 'Q', name: '斩钢闪', icon: '斩', aim: 'dir', range: 5, cd: 3.5, wind: 0.18, lock: 0.3, anim: 'thrust', animDur: 0.45, ai: 'enemy',
        desc: '向前突刺；连续命中两次后，第三次会卷起一道旋风，击飞直线上的所有敌人。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), st = h.yasQ && W.time < h.yasQ.until ? h.yasQ.n : 0;
          if (st >= 2) {
            h.yasQ = null;
            W.projectile({ from: V3(h.pos, 1.3), dir: d, speed: 20, range: 12, radius: 1.3, pierce: true, team: h.team, owner: h, mesh: tornadoMesh(), spin: 0,
              onStep: (p) => { if (p.mesh) p.mesh.rotation.y += 0.6; if (Math.random() < 0.5) W.vfx.trail(p.pos, { color: '#cfe8ff', glow: true, size: 0.8 }); },
              onHit: (u) => { W.damage(h, u, 100 * h.rk('Q'), { type: 'phys' }); W.cc(u, 'knockup', 1, { height: 2.6 }); } });
            W.vfx.comic(h.pos, '哈撒给!', { color: '#9fd0ff' });
            return;
          }
          const a = { x: h.pos.x, z: h.pos.z }, b = at(a, d, 5);
          let hit = false;
          for (const u of lineHits(W, h, a, b, 0.8)) { W.damage(h, u, 90 * h.rk('Q'), { type: 'phys' }); hit = true; W.vfx.spark(u.pos, '#cfe8ff', 6); }
          W.vfx.beam(h.tipPos(), b, { width: 0.4, color: '#cfe8ff', dur: 0.22 });
          if (hit) {
            h.yasQ = { n: st + 1, until: W.time + 6 };
            if (st + 1 >= 2) W.vfx.aura(h, { color: '#9fd0ff', glow: true, r: 1.2, dur: 1.5, particles: 12 });
          }
        } },
      { key: 'W', name: '风之障壁', icon: '墙', aim: 'dir', range: 3, cd: 20, wind: 0.1, anim: 'cast2', animDur: 0.5, ai: 'hurt',
        desc: '在身前立起一道风墙，持续 3.5 秒，挡下所有敌方飞行道具（包括防御塔的炮弹）。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), c = at(h.pos, d, 2.5), n = { x: -d.z, z: d.x };
          const A1 = at(c, n, -3), B1 = at(c, n, 3);
          const wall = new THREE.Group(); wall.position.set(c.x, 0, c.z);
          for (let i = -3; i <= 3; i++) {
            const m = new THREE.Mesh(G.sphere(10, 8), glowMat(i % 2 ? '#bfe8ff' : '#e6f7ff', 0.45));
            m.scale.set(0.55, 1.7, 0.35); m.position.set(n.x * i * 0.9, 1.4, n.z * i * 0.9); m.rotation.y = Math.atan2(n.x, n.z); wall.add(m);
          }
          W.vfx.add(wall, 3.5, (k, dt, e) => {
            wall.children.forEach((m, i) => { m.position.y = 1.4 + Math.sin(e.t * 6 + i) * 0.2; m.material.opacity = 0.45 * (1 - Math.max(0, k - 0.85) / 0.15); });
            if (Math.random() < 0.4) { const q = at(c, n, (Math.random() - 0.5) * 6); W.vfx.trail({ x: q.x, y: Math.random() * 2.5, z: q.z }, { color: '#e6f7ff', glow: true, size: 0.5, vy: 1.5 }); }
          });
          W.zone({ pos: c, r: 3, dur: 3.5, every: 0.03, team: h.team, onTick: () => {
            for (const p of W.projs) {
              if (p.dead || p.team === h.team) continue;
              if (segDist(p.pos, A1, B1) < 1.0) { p.dead = true; W.vfx.puff(p.pos, { n: 6, color: '#cfe8ff', cell: 'spark', glow: true, size: 0.5, y: 0 }); }
            }
          } });
          W.vfx.comic(c, '风!', { color: '#cfe8ff' });
        } },
      { key: 'E', name: '踏前斩', icon: '踏', aim: 'unit', range: 6, cd: 2.5, wind: 0, lock: 0.3, anim: 'thrust', animDur: 0.35, ai: 'enemy',
        desc: '穿过目标敌人冲刺一段距离，对其造成魔法伤害。冷却很短，可以在兵线中来回穿梭。',
        fire(W, h, aim, t) {
          if (!t) return;
          const d = dirOf(h, t.pos);
          W.dash(h, at(h.pos, d, Math.max(4.5, h.dist(t) + 1.8)), { dur: 0.25, through: true, trail: { color: '#cfe8ff', glow: true, size: 0.7 } });
          W.damage(h, t, 70 * h.rk('E'), { type: 'magic' });
          W.vfx.slash(t.pos, h.facing, { color: '#cfe8ff', r: 2.2 });
        } },
      { key: 'R', name: '狂风绝息斩', icon: '狂', aim: 'point', range: 12, cd: 45, wind: 0, lock: 0.8, anim: 'leap', animDur: 0.8, ai: 'hero',
        canCast: (W, h) => W.enemiesIn(h.team, h.pos, 12).some(u => u.has('knockup')),
        desc: '只能对被击飞的敌人使用：瞬移到其身边，把它和周围被击飞的敌人再次挑起并连斩，造成大量伤害。',
        fire(W, h, aim) {
          const ups = W.enemiesIn(h.team, h.pos, 13).filter(u => u.has('knockup'));
          if (!ups.length) return;
          ups.sort((a, b) => distXZ(a.pos, aim) - distXZ(b.pos, aim));
          const t = ups[0], d = dirOf(h, t.pos);
          blink(W, h, at(t.pos, d, -1.2));
          h.face(t.pos.x, t.pos.z); h.facing = h.faceTarget;
          for (const u of W.enemiesIn(h.team, t.pos, 4)) {
            if (u !== t && !u.has('knockup')) continue;
            W.cc(u, 'knockup', 1, { height: 3.4 });
            for (let i = 0; i < 4; i++) W.after(0.14 * i, () => W.vfx.slash(u.pos, Math.random() * 6.28, { color: '#cfe8ff', r: 2.6, y: 2.6, tilt: (Math.random() - 0.5) * 2, dur: 0.25 }));
            W.after(0.6, () => W.damage(h, u, 260 * h.rk('R'), { type: 'phys' }));
          }
          W.vfx.comic(t.pos, '疾风!', { color: '#9fd0ff', size: 3.2 }); W.vfx.shake(0.6);
        } },
    ],
  },
  // ======================= 劫 =======================
  {
    id: 'zed', name: '劫', title: '影流之主', role: '刺客', color: '#b3262e',
    hp: 1200, ad: 72, range: 1.6, atkSpeed: 0.8, speed: 7.3, atkAnim: ['slash', 'swipe'], slashColor: '#ff6a6a', hitColor: '#ff5a5a',
    passive: '影忆：普攻生命低于 50% 的敌人时，额外造成 8% 最大生命值的魔法伤害（同一目标 10 秒一次）。',
    onHit(W, h, t) {
      if (t.hp / t.maxHp < 0.5 && W.time > (t.zedP || 0)) { t.zedP = W.time + 10; W.damage(h, t, t.maxHp * 0.08, { type: 'magic' }); W.vfx.comic(t.pos, '影!', { color: '#ff5a5a', size: 1.6 }); }
    },
    res: { mana: 0, cost: [0, 0, 0, 0], order: 'QEW' }, sfx: ['whoosh', 'magic', 'swing', 'roar'], ind: [L(0.7), A(1.2), SELF(3.2), T()],
    skills: [
      { key: 'Q', name: '影奥义！诸刃', icon: '刃', aim: 'dir', range: 10, cd: 6, wind: 0.2, anim: 'throw', animDur: 0.45, ai: 'enemy',
        desc: '本体和影分身同时掷出手里剑，贯穿直线上的敌人。被两枚都命中的敌人第二次受到一半伤害。',
        fire(W, h, aim) {
          const hit = new Set(), from = [{ x: h.pos.x, z: h.pos.z }];
          if (h.zedShadow && W.time < h.zedShadow.until) from.push(h.zedShadow.pos);
          for (const o of from) {
            W.projectile({ from: V3(o, 1.3), dir: dirOf({ pos: o }, aim), speed: 26, range: 10, radius: 0.7, pierce: true, team: h.team, owner: h, mesh: shurikenMesh(), spin: 16,
              trail: { color: '#ff7a7a', glow: true, size: 0.4, rate: 0.5 },
              onHit: (u) => { const f = hit.has(u) ? 0.5 : 1; hit.add(u); W.damage(h, u, 110 * h.rk('Q') * f, { type: 'phys' }); } });
          }
        } },
      { key: 'W', name: '影奥义！分身', icon: '影', aim: 'point', range: 8, cd: 16, wind: 0, lock: 0.1, anim: 'cast2', animDur: 0.4, ai: 'enemy',
        desc: '向目标处放出影分身，持续 5 秒；分身会模仿你的 Q 和 E。分身存在时再次施放，与分身交换位置。',
        fire(W, h, aim) {
          const s = h.zedShadow;
          if (s && W.time < s.until) {
            const me = { x: h.pos.x, z: h.pos.z };
            W.vfx.puff(me, { n: 12, color: '#b3262e', cell: 'spark', glow: true, size: 0.8 });
            h.pos.x = s.pos.x; h.pos.z = s.pos.z; h.path = null;
            s.pos.x = me.x; s.pos.z = me.z; s.swapped = true;
            W.vfx.puff(h.pos, { n: 12, color: '#ff5a5a', cell: 'spark', glow: true, size: 0.8 });
            h.cds.W = Math.max(1, s.until - W.time + 9);
            return;
          }
          const p = W.clampDash(h.pos, aim), from = { x: h.pos.x, z: h.pos.z };
          const mesh = shadowMesh(); mesh.rotation.y = h.facing;
          const ns = h.zedShadow = { pos: { x: p.x, z: p.z }, until: W.time + 5, mesh };
          W.vfx.add(mesh, 5, (k, dt, e) => {
            const q = Math.min(1, e.t / 0.25);
            mesh.position.set(from.x + (ns.pos.x - from.x) * q, 0, from.z + (ns.pos.z - from.z) * q);
            if (Math.random() < 0.3) W.vfx.trail({ x: mesh.position.x, y: 0.5 + Math.random() * 1.8, z: mesh.position.z }, { color: '#ff3a3a', glow: true, size: 0.4, vy: 0.8 });
          });
          h.cds.W = 0.5;
          W.after(5, () => { if (h.zedShadow === ns) h.zedShadow = null; if (!ns.swapped) h.cds.W = Math.max(h.cds.W, 11); });
        } },
      { key: 'E', name: '影奥义！鬼斩', icon: '鬼', aim: 'self', cd: 4, wind: 0, anim: 'spin', animDur: 0.4, ai: 'close',
        desc: '本体与影分身同时旋身斩击周围敌人；被分身斩中的敌人会减速。',
        fire(W, h) {
          const done = new Set();
          const cut = (p, slow) => {
            for (const u of W.enemiesIn(h.team, p, 3.2)) {
              if (!done.has(u)) { done.add(u); W.damage(h, u, 80 * h.rk('E'), { type: 'phys' }); }
              if (slow) W.cc(u, 'slow', 1.5, { pct: 0.3 });
            }
            W.vfx.slash(p, h.facing, { color: '#ff6a6a', r: 3.2, dur: 0.3, spin: 4, y: 1 });
            W.vfx.ring(p, { r1: 3.4, color: '#ff5a5a', dur: 0.3 });
          };
          cut(h.pos, false);
          if (h.zedShadow && W.time < h.zedShadow.until) cut(h.zedShadow.pos, true);
        } },
      { key: 'R', name: '禁奥义！瞬狱影杀阵', icon: '狱', aim: 'unit', range: 8, cd: 55, wind: 0, lock: 0.5, anim: 'leap', animDur: 0.5, ai: 'hero',
        desc: '化为影子闪到目标身后并打上死亡印记。3 秒后印记引爆，额外造成这段时间内它所受伤害的 35%。',
        fire(W, h, aim, t) {
          if (!t) return;
          h.addBuff('untargetable', 0.5);
          blink(W, h, at(t.pos, dirOf(h, t.pos), 1.3));
          h.face(t.pos.x, t.pos.z); h.facing = h.faceTarget;
          const hp0 = t.hp;
          W.damage(h, t, 60 * h.rk('R'), { type: 'phys' });
          W.vfx.disc(t.pos, { r: 1.5, color: '#ff3a3a', dur: 3, opacity: 0.85, spin: 3, follow: t.pos, hold: true });
          W.vfx.comic(t.pos, '杀!', { color: '#ff3a3a' });
          W.after(3, () => {
            if (t.dead || t.removed) return;
            W.damage(h, t, 120 * h.rk('R') + Math.max(0, hp0 - t.hp) * 0.35, { type: 'phys', color: '#ff3a3a' });
            W.vfx.ring(t.pos, { r1: 4, color: '#ff3a3a', dur: 0.5 }); W.vfx.puff(t.pos, { n: 18, color: ['#ff3a3a', '#2a1420'], cell: 'shard', size: 0.6, speed: 6 });
            W.vfx.comic(t.pos, '影杀!', { color: '#ff3a3a', size: 3 }); W.vfx.shake(0.5);
          });
        } },
    ],
  },
  // ======================= 金克丝 =======================
  {
    id: 'jinx', name: '金克丝', title: '暴走萝莉', role: '射手', color: '#4a7fd0',
    hp: 1040, ad: 64, range: 10.5, atkSpeed: 0.72, speed: 6.9, atkAnim: 'shoot', atkProj: 'bullet', projColor: '#ff7ad0', projSpeed: 40,
    projTrail: { color: '#ff9ad8', glow: true, size: 0.3, rate: 0.5 }, hitColor: '#ff9ad8',
    passive: '罪恶快感：普攻击杀敌人后兴奋起来，3 秒内移速与攻速大幅提升。',
    onHit(W, h, t) { if (t.dead && bigUnit(t)) { h.addBuff('jinxP', 3, { haste: 0.5, as: 0.5 }); W.vfx.comic(h.pos, '嗨起来!', { color: '#ff7ad0' }); } },
    tick(W, h) { if (h.range !== h.def.range && !h.has('jinxQ')) h.range = h.def.range; }, // 阵亡时 buff 不走 onEnd，这里兜底恢复射程
    res: { mana: 300, cost: [20, 50, 70, 100], order: 'QWE' }, sfx: ['click', 'laser', 'click', 'boom'], ind: [NONE, L(0.6), A(1.6), L(1.2, 30)],
    skills: [
      { key: 'Q', name: '枪炮交响曲', icon: '炮', aim: 'self', cd: 9, wind: 0, anim: 'flex', animDur: 0.4, ai: 'fight',
        desc: '换上鱼骨头火箭炮 5 秒：攻击距离增加，普攻变成火箭，对目标周围造成溅射伤害。',
        fire(W, h) {
          h.range = h.def.range + 2.5;
          W.vfx.aura(h, { color: '#ff7ad0', glow: true, r: 1.2, dur: 5, particles: 12 });
          h.addBuff('jinxQ', 5, {
            onHit(W, h, t) {
              for (const u of W.enemiesIn(h.team, t.pos, 2.6)) if (u !== t) W.damage(h, u, h.ad * 0.6, { type: 'phys', noText: true });
              W.vfx.ring(t.pos, { r1: 2.8, color: '#ff9ad8', dur: 0.3 }); W.vfx.puff(t.pos, { n: 8, color: ['#ffcf4a', '#ff6a2a'], cell: 'flame', size: 0.6, speed: 3 });
            },
            onEnd: (u) => { u.range = u.def.range; },
          });
          W.vfx.comic(h.pos, '砰砰!', { color: '#ff7ad0' });
        } },
      { key: 'W', name: '震荡电磁波', icon: '电', aim: 'dir', range: 15, cd: 8, wind: 0.5, lock: 0.5, anim: 'shoot', animDur: 0.8, ai: 'hero',
        desc: '蓄力后射出一道电磁波，对第一个命中的敌人造成伤害并大幅减速。',
        start(W, h, aim) { W.vfx.puff(h.pos, { n: 12, color: '#6ad0ff', cell: 'spark', glow: true, size: 0.6, speed: -2, spread: 2 }); },
        fire(W, h, aim) {
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 50, range: 15, radius: 0.7, team: h.team, owner: h, mesh: projMesh('bullet', '#6ad0ff'), scale: 1.8,
            trail: { color: '#8ae0ff', glow: true, size: 0.7, cell: 'spark' },
            onHit: (u) => { W.damage(h, u, 120 * h.rk('W'), { type: 'phys' }); W.cc(u, 'slow', 2, { pct: 0.5 }); W.vfx.spark(u.pos, '#8ae0ff', 12, 0.8); W.vfx.comic(u.pos, '滋!', { color: '#6ad0ff' }); } });
        } },
      { key: 'E', name: '嚼火者手雷', icon: '雷', aim: 'point', range: 9, cd: 20, wind: 0.2, anim: 'throw', animDur: 0.5, ai: 'enemyNear',
        desc: '扔出三个咬人手雷，0.5 秒后激活；敌方英雄踩到会被禁锢并引爆全部手雷。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), n = { x: -d.z, z: d.x }, st = { done: false }, meshes = [];
          const blow = () => { st.done = true; for (const m of meshes) { W.vfx.puff({ x: m.position.x, z: m.position.z }, { n: 10, color: ['#ffcf4a', '#ff6a2a'], cell: 'flame', size: 0.8, speed: 4 }); m.parent && m.parent.remove(m); } };
          for (let i = -1; i <= 1; i++) {
            const p = W.clampDash(aim, at(aim, n, i * 1.8));
            const m = chomperMesh(); m.position.set(p.x, 0, p.z); W.scene.add(m); meshes.push(m);
            W.zone({ pos: p, r: 1, dur: 5, every: 0.1, team: h.team,
              onTick: (z) => {
                if (st.done) { z.dead = true; return; }
                if (z.t < 0.5) return;
                const u = W.enemiesIn(h.team, z.pos, 1.1).find(notMinion);
                if (!u) return;
                W.cc(u, 'root', 1.5, { color: '#ff7ad0' }); W.damage(h, u, 100 * h.rk('E'), { type: 'magic' });
                W.vfx.comic(u.pos, '咔嚓!', { color: '#ff7ad0' });
                blow(); z.dead = true;
              },
              onEnd: () => { if (!st.done) blow(); } });
          }
        } },
      { key: 'R', name: '超究极死神飞弹', icon: '弹', aim: 'dir', range: 60, cd: 60, wind: 0.6, lock: 0.6, anim: 'shoot', animDur: 1.0, ai: 'executeFar',
        desc: '发射一枚越飞越快的鲨鱼火箭，命中第一个英雄后爆炸，目标损失的生命越多伤害越高。',
        fire(W, h, aim) {
          W.vfx.comic(h.pos, '死神飞弹!', { color: '#ff7ad0' });
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 16, range: 60, radius: 1.2, team: h.team, owner: h, mesh: rocketMesh(), filter: notMinion,
            trail: { color: '#ff8a30', cell: 'flame', size: 1.0 },
            onStep: (p, dt) => { p.speed = Math.min(42, p.speed + dt * 18); },
            onHit: (u) => {
              W.damage(h, u, 250 * h.rk('R') + (u.maxHp - u.hp) * 0.25, { type: 'phys' });
              for (const v of W.enemiesIn(h.team, u.pos, 3.5)) if (v !== u) W.damage(h, v, 180 * h.rk('R'), { type: 'phys' });
              W.vfx.ring(u.pos, { r1: 5, color: '#ff8a30', dur: 0.5 });
              W.vfx.puff(u.pos, { n: 26, color: ['#ffcf4a', '#ff6a2a', '#ff3a1a'], cell: 'flame', size: 1.2, speed: 7 });
              W.vfx.comic(u.pos, '轰!!', { color: '#ff8a30', size: 3.2 }); W.vfx.shake(0.8);
            } });
        } },
    ],
  },
  // ======================= 伊泽瑞尔 =======================
  {
    id: 'ezreal', name: '伊泽瑞尔', title: '探险家', role: '射手', color: '#d8a030',
    hp: 1040, ad: 62, range: 10, atkSpeed: 0.72, speed: 6.9, atkAnim: 'shoot', atkProj: 'orb', projColor: '#ffd84a', projSpeed: 30,
    projTrail: { color: '#ffe27a', glow: true, size: 0.35, rate: 0.6 }, hitColor: '#ffe27a',
    passive: '咒能高涨：技能命中叠加攻速，最多 5 层（每层 8%）。',
    onHit(W, h, t) { ezPop(W, h, t); },
    res: { mana: 375, cost: [30, 50, 90, 100], order: 'QEW' }, sfx: ['orb', 'magic', 'flash', 'laser'], ind: [L(0.6), L(0.7), A(1), L(2, 30)],
    skills: [
      { key: 'Q', name: '秘术射击', icon: '射', aim: 'dir', range: 12, cd: 4.5, wind: 0.25, anim: 'shoot', animDur: 0.5, ai: 'enemy',
        desc: '射出一道能量弹，对第一个敌人造成物理伤害，命中后减少其他技能 1.5 秒冷却。',
        fire(W, h, aim) {
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 36, range: 12, radius: 0.6, team: h.team, owner: h, mesh: projMesh('bullet', '#ffd84a'), scale: 1.4,
            trail: { color: '#ffe27a', glow: true, size: 0.5 },
            onHit: (u) => {
              W.damage(h, u, 60 * h.rk('Q') + h.ad, { type: 'phys' }); ezPop(W, h, u); ezStack(h);
              for (const k of 'WER') h.cds[k] = Math.max(0, h.cds[k] - 1.5);
              W.vfx.spark(u.pos, '#ffe27a', 8);
            } });
        } },
      { key: 'W', name: '精华跃动', icon: '跃', aim: 'dir', range: 12, cd: 10, wind: 0.25, anim: 'shoot', animDur: 0.5, ai: 'hero',
        desc: '射出魔法球，给命中的英雄打上 4 秒印记；之后你的普攻或技能命中它会引爆印记，造成额外魔法伤害。',
        fire(W, h, aim) {
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 26, range: 12, radius: 0.8, team: h.team, owner: h, mesh: projMesh('bigOrb', '#ffcf40'), filter: notMinion,
            trail: { color: '#ffe27a', glow: true, size: 0.8 },
            onHit: (u) => { u.ezMark = W.time + 4; ezStack(h); W.vfx.disc(u.pos, { r: 1.2, color: '#ffd84a', dur: 4, spin: 2, follow: u.pos, hold: true, opacity: 0.8 }); } });
        } },
      { key: 'E', name: '奥术跃迁', icon: '迁', aim: 'point', range: 5, cd: 16, wind: 0, lock: 0.2, anim: 'twirl', animDur: 0.35, ai: 'fightFar',
        desc: '瞬移到目标位置，并向附近的敌人（优先带印记的英雄）射出一道追踪能量弹。',
        fire(W, h, aim) {
          blink(W, h, aim);
          const foes = W.enemiesIn(h.team, h.pos, 8).sort((a, b) => ((b.ezMark > W.time) - (a.ezMark > W.time)) || (bigUnit(b) - bigUnit(a)) || h.dist(a) - h.dist(b));
          if (foes[0]) W.projectile({ from: V3(h.pos, 1.5), target: foes[0], speed: 30, team: h.team, owner: h, mesh: projMesh('orb', '#ffd84a'), trail: { color: '#ffe27a', glow: true, size: 0.5 },
            onHit: (u) => { W.damage(h, u, 90 * h.rk('E'), { type: 'magic' }); ezPop(W, h, u); ezStack(h); } });
        } },
      { key: 'R', name: '精准弹幕', icon: '幕', aim: 'dir', range: 60, cd: 60, wind: 1.0, lock: 1.0, anim: 'shoot', animDur: 1.3, ai: 'hero',
        desc: '蓄力后射出一道横贯地图的巨大能量波，对沿途所有敌人造成魔法伤害（对小兵减半）。',
        start(W, h) { W.vfx.puff(h.pos, { n: 16, color: '#ffe27a', cell: 'spark', glow: true, size: 0.8, speed: -2, spread: 2.5 }); },
        fire(W, h, aim) {
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 30, range: 60, radius: 2, pierce: true, team: h.team, owner: h, mesh: projMesh('bigOrb', '#ffd84a'), scale: 2.2,
            trail: { color: '#ffe27a', glow: true, size: 1.8, cell: 'glow' },
            onHit: (u) => { W.damage(h, u, 280 * h.rk('R') * (u.kind === 'minion' ? 0.5 : 1), { type: 'magic' }); ezPop(W, h, u); } });
          W.vfx.comic(h.pos, '弹幕!', { color: '#ffd84a', size: 3 });
        } },
    ],
  },
  // ======================= 薇恩 =======================
  {
    id: 'vayne', name: '薇恩', title: '暗夜猎手', role: '射手', color: '#5a4a8a',
    hp: 1000, ad: 60, range: 9, atkSpeed: 0.75, speed: 7.0, atkAnim: 'shoot', atkProj: 'arrow', projColor: '#c8a0ff', projSpeed: 36,
    projTrail: { color: '#d8c0ff', glow: true, size: 0.3, rate: 0.5 }, hitColor: '#d8c0ff',
    passive: '夜行猎手：普攻命中英雄后获得 1 秒 20% 移速加成。',
    onHit(W, h, t) { if (bigUnit(t)) h.addBuff('vayneP', 1, { haste: 0.2 }); },
    res: { mana: 300, cost: [30, 0, 90, 80], order: 'QWE' }, sfx: ['whoosh', 'magic', 'arrow', 'magic'], ind: [A(0.8), NONE, T(), NONE],
    skills: [
      { key: 'Q', name: '闪避突袭', icon: '滚', aim: 'point', range: 3.5, cd: 4, wind: 0, lock: 0.2, anim: 'twirl', animDur: 0.3, ai: 'fight',
        desc: '翻滚一小段距离，重置普攻，下一次普攻造成额外伤害。终极时刻期间翻滚后隐身 1 秒。',
        fire(W, h, aim) {
          const d = dirOf(h, aim);
          W.dash(h, at(h.pos, d, 3), { dur: 0.2, trail: { color: '#d8c0ff', size: 0.6 } });
          h.atkCd = 0;
          h.addBuff('vayneQ', 4, { onHit(W, h, t) { W.damage(h, t, 30 * h.rk('Q') + h.ad * 0.5, { type: 'phys' }); h.removeBuff('vayneQ'); W.vfx.spark(t.pos, '#c8a0ff', 8); } });
          if (h.has('vayneR')) { h.addBuff('untargetable', 1); W.vfx.puff(h.pos, { n: 14, color: '#5a4a8a', cell: 'puff', size: 1, speed: 2 }); }
        } },
      { key: 'W', name: '圣银弩箭', icon: '银', aim: 'self', cd: 12, wind: 0, anim: 'flex', animDur: 0.4, ai: 'fight',
        desc: '8 秒内，对同一目标每第三次普攻额外造成其最大生命值 6%～10% 的真实伤害。',
        fire(W, h) {
          W.vfx.aura(h, { color: '#e0e8ff', glow: true, r: 1.1, dur: 8, particles: 10 });
          h.addBuff('vayneW', 8, { n: 0, tgt: null, onHit(W, h, t, b) {
            if (b.tgt !== t) { b.tgt = t; b.n = 0; }
            if (++b.n < 3) { W.vfx.ring(t.pos, { r1: 1 + b.n * 0.4, color: '#e0e8ff', dur: 0.3 }); return; }
            b.n = 0;
            W.damage(h, t, Math.min(t.kind === 'hero' ? 9999 : 250, t.maxHp * (0.05 + 0.01 * h.ranks.W)), { type: 'true' });
            W.vfx.ring(t.pos, { r1: 3, color: '#ffffff', dur: 0.4 }); W.vfx.comic(t.pos, '银!', { color: '#e0e8ff', size: 1.8 });
          } });
        } },
      { key: 'E', name: '恶魔审判', icon: '审', aim: 'unit', range: 7, cd: 12, wind: 0.2, anim: 'bow', animDur: 0.5, ai: 'hero',
        desc: '射出一支重弩把目标击退；如果它被撞到墙上，会被晕眩并受到额外伤害。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.projectile({ from: h.tipPos(), target: t, speed: 34, team: h.team, owner: h, mesh: projMesh('arrow', '#c8a0ff'), scale: 2, trail: { color: '#d8c0ff', glow: true, size: 0.6 },
            onHit: (u) => {
              W.damage(h, u, 80 * h.rk('E'), { type: 'phys' });
              const d = dirOf(h, u.pos), want = at(u.pos, d, 4), end = W.clampDash(u.pos, want);
              W.displace(u, end, 0.3);
              if (distXZ(end, want) > 0.6 && !u.isStructure) W.after(0.3, () => {
                W.cc(u, 'stun', 1.5); W.damage(h, u, 80 * h.rk('E'), { type: 'phys' });
                W.vfx.comic(u.pos, '钉!', { color: '#c8a0ff' }); W.vfx.shake(0.3);
              });
            } });
        } },
      { key: 'R', name: '终极时刻', icon: '夜', aim: 'self', cd: 60, wind: 0, anim: 'raise', animDur: 0.6, ai: 'fight',
        desc: '8 秒内攻速提升、普攻附带额外伤害，且闪避突袭会让你隐身 1 秒。',
        fire(W, h) {
          h.addBuff('vayneR', 8, { as: 0.3, onHit(W, h, t) { W.damage(h, t, 25 * h.rk('R'), { type: 'phys', noText: true }); } });
          W.vfx.aura(h, { color: '#8a6ad0', glow: true, r: 1.5, dur: 8, particles: 24, pcolor: '#d8c0ff' });
          W.vfx.comic(h.pos, '狩猎!', { color: '#c8a0ff' }); W.vfx.ring(h.pos, { r1: 3.5, color: '#8a6ad0' });
        } },
    ],
  },
  // ======================= 提莫 =======================
  {
    id: 'teemo', name: '提莫', title: '迅捷斥候', role: '射手', color: '#5fae4a',
    hp: 1000, ad: 56, range: 8, atkSpeed: 0.72, speed: 7.1, atkAnim: 'shoot', atkProj: 'shard', projColor: '#8ad050', projSpeed: 30,
    projTrail: { color: '#b0e080', size: 0.3, rate: 0.4 }, hitColor: '#b0e080',
    passive: '侦查兵：普攻命中后 1 秒内移速提升 10%。',
    onHit(W, h) { h.addBuff('teemoP', 1, { haste: 0.1 }); },
    res: { mana: 330, cost: [70, 40, 0, 75], order: 'EQW' }, sfx: ['arrow', 'whoosh', 'magic', 'click'], ind: [T(), NONE, NONE, A(3)],
    skills: [
      { key: 'Q', name: '致盲吹箭', icon: '盲', aim: 'unit', range: 9, cd: 8, wind: 0.2, anim: 'shoot', animDur: 0.45, ai: 'hero',
        desc: '吹出一支毒箭造成魔法伤害，并让目标致盲 1.5 秒（普攻全部落空）。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.projectile({ from: h.tipPos(), target: t, speed: 30, team: h.team, owner: h, mesh: projMesh('shard', '#6ad040'), trail: { color: '#b0e080', size: 0.4 },
            onHit: (u) => { W.damage(h, u, 90 * h.rk('Q'), { type: 'magic' }); W.cc(u, 'blind', 1.5); W.vfx.comic(u.pos, '瞎!', { color: '#8ad050' }); W.vfx.puff(u.pos, { n: 8, color: '#5a5a5a', cell: 'puff', size: 0.6, y: 2 }); } });
        } },
      { key: 'W', name: '小莫快跑', icon: '跑', aim: 'self', cd: 14, wind: 0, anim: 'flex', animDur: 0.3, ai: 'escape',
        desc: '3 秒内移速大幅提升。',
        fire(W, h) { h.addBuff('teemoW', 3, { haste: 0.5 }); W.vfx.aura(h, { color: '#b0e080', glow: true, r: 1, dur: 3, particles: 16 }); W.vfx.comic(h.pos, '跑!', { color: '#8ad050' }); } },
      { key: 'E', name: '毒性射击', icon: '毒', aim: 'self', cd: 12, wind: 0, anim: 'flex', animDur: 0.4, ai: 'fight',
        desc: '8 秒内普攻涂毒：命中后 4 秒内每秒造成魔法伤害。',
        fire(W, h) {
          W.vfx.aura(h, { color: '#8ad050', glow: true, r: 1.1, dur: 8, particles: 12 });
          h.addBuff('teemoE', 8, { onHit(W, h, t) { dot(W, h, t, 'teemoPoison', 4, 20 * h.rk('E')); W.vfx.puff(t.pos, { n: 4, color: '#8ad050', cell: 'puff', size: 0.4, y: 1.2 }); } });
        } },
      { key: 'R', name: '种蘑菇', icon: '菇', aim: 'point', range: 8, cd: 16, wind: 0.2, anim: 'throw', animDur: 0.4, ai: 'enemyNear',
        desc: '种下一颗毒蘑菇（最多 3 颗，持续 60 秒），1 秒后生效；敌人踩到会爆出毒雾，造成持续伤害并减速。',
        fire(W, h, aim) {
          const m = mushroomMesh(); m.position.set(aim.x, 0, aim.z); m.scale.setScalar(0.1); W.scene.add(m);
          W.vfx.puff(aim, { n: 6, color: '#b0e080', cell: 'leaf', size: 0.5, y: 0.2 });
          const z = W.zone({ pos: aim, r: 1.2, dur: 60, every: 0.1, team: h.team,
            onUpdate: (z) => { m.scale.setScalar(Math.min(1, 0.1 + z.t * 2)); },
            onTick: (z) => {
              if (z.t < 1) return;
              if (!W.enemiesIn(h.team, z.pos, 1.1).length) return;
              for (const u of W.enemiesIn(h.team, z.pos, 3)) { W.damage(h, u, 60 * h.rk('R'), { type: 'magic' }); dot(W, h, u, 'teemoShroom', 4, 40 * h.rk('R')); W.cc(u, 'slow', 3, { pct: 0.4 }); }
              W.vfx.puff(z.pos, { n: 26, color: ['#8ad050', '#5a8a30', '#c8e890'], cell: 'puff', size: 1.4, speed: 3, y: 0.4 });
              W.vfx.comic(z.pos, '噗!', { color: '#8ad050' });
              z.dead = true; m.parent && m.parent.remove(m);
            },
            onEnd: () => { m.parent && m.parent.remove(m); } });
          z.mesh = m;
          h.shrooms = (h.shrooms || []).filter(s => !s.dead);
          h.shrooms.push(z);
          if (h.shrooms.length > 3) { const o = h.shrooms.shift(); o.dead = true; o.mesh.parent && o.mesh.parent.remove(o.mesh); }
        } },
    ],
  },
  // ======================= 锤石 =======================
  {
    id: 'thresh', name: '锤石', title: '魂锁典狱长', role: '辅助', color: '#3a8a6a',
    hp: 1150, ad: 56, range: 8, atkSpeed: 0.65, speed: 6.8, atkAnim: 'throw', atkProj: 'orb', projColor: '#7dffb0', projSpeed: 24,
    projTrail: { color: '#9dffc8', glow: true, size: 0.4, rate: 0.6 }, hitColor: '#9dffc8',
    passive: '地狱诅咒：普攻额外造成 15 + 等级×3 的魔法伤害。',
    onHit(W, h, t) { W.damage(h, t, 15 + 3 * h.level, { type: 'magic', noText: true }); },
    res: { mana: 400, cost: [70, 50, 60, 100], order: 'QEW' }, sfx: ['whoosh', 'shield', 'swing', 'magic'], ind: [L(0.8), T(), L(1.3), SELF(4.5)],
    skills: [
      { key: 'Q', name: '死亡判决', icon: '钩', aim: 'dir', range: 11, cd: 14, wind: 0.45, lock: 0.45, anim: 'throw', animDur: 0.7, ai: 'hero',
        desc: '甩出锁链镰刀，钩住第一个敌人，将其晕眩并拽向自己。',
        fire(W, h, aim) {
          hookShot(W, h, aim, { range: 11, color: '#7dffb0', onHit: (u) => {
            W.damage(h, u, 100 * h.rk('Q'), { type: 'magic' });
            W.displace(u, { x: (u.pos.x + h.pos.x) / 2, z: (u.pos.z + h.pos.z) / 2 }, 0.4);
            W.cc(u, 'stun', 1.5);
            W.vfx.comic(u.pos, '过来!', { color: '#7dffb0' });
          } });
        } },
      { key: 'W', name: '魂引之灯', icon: '灯', aim: 'ally', range: 9, cd: 16, wind: 0.15, anim: 'throw', animDur: 0.5, ai: 'heal', allowSelf: true,
        desc: '把灯笼抛给队友：为它和自己提供护盾，并把它拉到身边。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.shield(h, 140 * h.rk('W'), 3, '#7dffb0');
          if (t === h) return;
          W.projectile({ from: h.tipPos(), target: t, speed: 24, team: h.team, owner: h, mesh: lanternMesh(), trail: { color: '#9dffc8', glow: true, size: 0.5 },
            onHit: (a) => {
              W.shield(a, 140 * h.rk('W'), 3, '#7dffb0');
              if (a.kind === 'hero' && a.dist(h) > 2.5) W.dash(a, at(h.pos, dirOf(h, a.pos), 1.8), { dur: 0.35, trail: { color: '#9dffc8', glow: true, size: 0.6 } });
            } });
        } },
      { key: 'E', name: '厄运钟摆', icon: '摆', aim: 'dir', range: 5, cd: 10, wind: 0.25, anim: 'swipe', animDur: 0.5, ai: 'enemy',
        desc: '挥动锁链横扫身前身后的直线区域，把敌人朝瞄准方向甩开并减速。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), a = at(h.pos, d, -4.5), b = at(h.pos, d, 4.5);
          for (const u of lineHits(W, h, a, b, 1.3)) {
            W.damage(h, u, 90 * h.rk('E'), { type: 'magic' });
            W.displace(u, at(u.pos, d, 2.5), 0.25); W.cc(u, 'slow', 1.5, { pct: 0.4 });
          }
          W.vfx.beam(V3(a), b, { width: 0.8, color: '#7dffb0', dur: 0.3 });
          W.vfx.slash(h.pos, h.facing, { color: '#7dffb0', r: 4, dur: 0.3 });
        } },
      { key: 'R', name: '幽冥监牢', icon: '牢', aim: 'self', cd: 60, wind: 0.3, anim: 'slam', animDur: 0.7, ai: 'close',
        desc: '在周围升起五面幽魂墙，持续 5 秒；每面墙会重创第一个穿过的敌人并使其大幅减速，然后碎裂。',
        fire(W, h) {
          const c = { x: h.pos.x, z: h.pos.z }, R = 4.5, walls = [], grp = new THREE.Group();
          for (let i = 0; i < 5; i++) {
            const a0 = i * Math.PI * 2 / 5, a1 = (i + 1) * Math.PI * 2 / 5;
            const A1 = { x: c.x + Math.cos(a0) * R, z: c.z + Math.sin(a0) * R }, B1 = { x: c.x + Math.cos(a1) * R, z: c.z + Math.sin(a1) * R };
            const m = new THREE.Mesh(G.box(0.35, 2.2, distXZ(A1, B1)), glowMat('#7dffb0', 0.5));
            m.position.set((A1.x + B1.x) / 2 - c.x, 1.1, (A1.z + B1.z) / 2 - c.z); m.rotation.y = Math.atan2(B1.x - A1.x, B1.z - A1.z);
            grp.add(m); walls.push({ A: A1, B: B1, m, alive: true });
          }
          grp.position.set(c.x, 0, c.z);
          W.vfx.add(grp, 5, (k, dt, e) => { for (const w of walls) { w.m.scale.y = Math.min(1, e.t * 4); w.m.material.opacity = 0.5 * (1 - Math.max(0, k - 0.9) * 10); } });
          W.zone({ pos: c, r: R, dur: 5, every: 0.1, team: h.team, onTick: () => {
            for (const w of walls) {
              if (!w.alive) continue;
              const hits = lineHits(W, h, w.A, w.B, 0.4);
              const u = hits.find(bigUnit) || hits[0];
              if (!u) continue;
              w.alive = false; w.m.visible = false;
              W.damage(h, u, 200 * h.rk('R'), { type: 'magic' }); W.cc(u, 'slow', 2, { pct: 0.9 });
              W.vfx.puff(u.pos, { n: 16, color: ['#7dffb0', '#2a4a3a'], cell: 'shard', size: 0.6, speed: 5 });
            }
          } });
          W.vfx.ring(c, { r1: R + 1, color: '#7dffb0', dur: 0.5 }); W.vfx.comic(c, '监牢!', { color: '#7dffb0' });
        } },
    ],
  },
  // ======================= 布里茨 =======================
  {
    id: 'blitzcrank', name: '布里茨', title: '蒸汽机器人', role: '坦克', color: '#d8a830', radius: 0.85,
    hp: 1500, ad: 66, range: 1.8, atkSpeed: 0.68, speed: 6.9, atkAnim: 'punch', hitColor: '#ffe27a',
    passive: '法力屏障：生命值低于 30% 时，获得等同 30% 最大法力值的护盾（60 秒冷却）。',
    tick(W, h) {
      if (h.hp / h.maxHp < 0.3 && W.time > (h.blitzP || 0)) {
        h.blitzP = W.time + 60;
        W.shield(h, h.maxMana * 0.3 + 60, 6, '#ffe27a'); W.vfx.comic(h.pos, '屏障!', { color: '#ffe27a' });
      }
    },
    res: { mana: 420, cost: [100, 75, 25, 100], order: 'QEW' }, sfx: ['whoosh', 'magic', 'hitHeavy', 'thunder'], ind: [L(0.8), NONE, NONE, SELF(6)],
    skills: [
      { key: 'Q', name: '机械飞爪', icon: '爪', aim: 'dir', range: 12, cd: 16, wind: 0.3, lock: 0.45, anim: 'punch', animDur: 0.6, ai: 'hero',
        desc: '射出机械手，抓住第一个命中的敌人，把它拉到自己面前并晕眩。',
        fire(W, h, aim) {
          hookShot(W, h, aim, { range: 12, speed: 30, color: '#ffe27a', onHit: (u) => {
            W.damage(h, u, 110 * h.rk('Q'), { type: 'magic' });
            W.displace(u, at(h.pos, dirOf(h, u.pos), 1.8), 0.35);
            W.after(0.35, () => W.cc(u, 'stun', 0.65));
            W.vfx.comic(u.pos, '抓!', { color: '#ffe27a' });
          } });
        } },
      { key: 'W', name: '过载', icon: '载', aim: 'self', cd: 14, wind: 0, anim: 'flex', animDur: 0.4, ai: 'fight',
        desc: '超载引擎：3 秒内移速与攻速大幅提升，结束后短暂减速。',
        fire(W, h) {
          h.addBuff('blitzW', 3, { haste: 0.6, as: 0.4, onEnd: (u) => W.cc(u, 'slow', 1.5, { pct: 0.3 }) });
          W.vfx.aura(h, { color: '#ffe27a', glow: true, r: 1.3, dur: 3, particles: 25 });
          W.vfx.comic(h.pos, '过载!', { color: '#ffe27a' });
        } },
      { key: 'E', name: '能量铁拳', icon: '拳', aim: 'self', cd: 8, wind: 0, anim: 'flex', animDur: 0.35, ai: 'close',
        desc: '下一次普攻把目标击飞并造成额外伤害。',
        fire(W, h) {
          h.atkCd = 0;
          const aura = W.vfx.aura(h, { color: '#ffb347', glow: true, r: 1.3, dur: 5, particles: 12 });
          h.addBuff('blitzE', 5, { onHit(W, h, t) {
            W.damage(h, t, 60 * h.rk('E'), { type: 'phys' }); W.cc(t, 'knockup', 1, { height: 2.6 });
            W.vfx.comic(t.pos, '嘭!', { color: '#ffb347' }); W.vfx.shake(0.3); h.removeBuff('blitzE'); aura.kill = true;
          } });
        } },
      { key: 'R', name: '静电力场', icon: '电', aim: 'self', cd: 40, wind: 0.15, anim: 'raise', animDur: 0.6, ai: 'close',
        desc: '释放强力电场，对周围敌人造成魔法伤害并沉默 1 秒。',
        fire(W, h) {
          for (const u of W.enemiesIn(h.team, h.pos, 6)) { W.damage(h, u, 220 * h.rk('R'), { type: 'magic' }); W.cc(u, 'silence', 1); W.vfx.beam(V3(h.pos, 2), u.pos, { width: 0.3, color: '#fff38a', dur: 0.3, y: 1.5 }); }
          W.vfx.ring(h.pos, { r1: 7, color: '#fff38a', dur: 0.5 }); W.vfx.bubble(h.pos, { color: '#fff38a', r0: 1, r1: 6, dur: 0.4, opacity: 0.35, y: 0.8 });
          W.vfx.puff(h.pos, { n: 26, color: '#fff38a', cell: 'spark', glow: true, size: 0.9, speed: 9 });
          W.vfx.comic(h.pos, '滋啦!', { color: '#fff38a', size: 3 }); W.vfx.shake(0.4);
        } },
    ],
  },
  // ======================= 蕾欧娜 =======================
  {
    id: 'leona', name: '蕾欧娜', title: '曙光女神', role: '坦克', color: '#e8a030',
    hp: 1480, ad: 62, range: 1.7, atkSpeed: 0.66, speed: 6.8, atkAnim: 'slash', slashColor: '#ffe27a', hitColor: '#ffe27a',
    passive: '日光：技能命中的敌人 1.5 秒内被普攻时，额外受到 40 + 等级×8 的魔法伤害。',
    onHit(W, h, t) { if (t.leonaSun > W.time) { t.leonaSun = 0; W.damage(h, t, 40 + 8 * h.level, { type: 'magic' }); W.vfx.spark(t.pos, '#ffe27a', 10); } },
    res: { mana: 300, cost: [45, 60, 60, 100], order: 'QWE' }, sfx: ['shield', 'shield', 'whoosh', 'laser'], ind: [NONE, SELF(3.5), L(0.8), A(3.5)],
    skills: [
      { key: 'Q', name: '破晓之盾', icon: '盾', aim: 'self', cd: 6, wind: 0, anim: 'flex', animDur: 0.35, ai: 'close',
        desc: '下一次普攻用盾牌猛击目标，造成额外伤害并晕眩 1 秒。',
        fire(W, h) {
          h.atkCd = 0;
          const aura = W.vfx.aura(h, { color: '#ffe27a', glow: true, r: 1.2, dur: 5, particles: 12 });
          h.addBuff('leonaQ', 5, { onHit(W, h, t) {
            W.damage(h, t, 60 * h.rk('Q'), { type: 'magic' }); W.cc(t, 'stun', 1); sunMark(W, t);
            W.vfx.comic(t.pos, '当!', { color: '#ffe27a' }); h.removeBuff('leonaQ'); aura.kill = true;
          } });
        } },
      { key: 'W', name: '日蚀', icon: '蚀', aim: 'self', cd: 12, wind: 0, anim: 'flex', animDur: 0.4, ai: 'hurt',
        desc: '3 秒内大幅减伤，结束时对周围敌人造成魔法伤害；打中敌人则减伤再持续 3 秒。',
        fire(W, h) {
          h.addBuff('leonaW', 3, { dr: 0.35 });
          W.vfx.bubble(h.pos, { color: '#ffe27a', r: 1.5, dur: 3, opacity: 0.25, follow: h.pos, y: 1.3, fade: false });
          W.after(3, () => {
            if (h.dead) return;
            const hits = W.enemiesIn(h.team, h.pos, 3.5);
            for (const u of hits) { W.damage(h, u, 100 * h.rk('W'), { type: 'magic' }); sunMark(W, u); }
            if (hits.length) h.addBuff('leonaW', 3, { dr: 0.35 });
            W.vfx.ring(h.pos, { r1: 4, color: '#ffe27a', dur: 0.4 }); W.vfx.puff(h.pos, { n: 16, color: '#fff3a0', cell: 'spark', glow: true, size: 0.8, speed: 6 });
          });
        } },
      { key: 'E', name: '天顶之刃', icon: '刃', aim: 'dir', range: 9, cd: 10, wind: 0.2, anim: 'thrust', animDur: 0.5, ai: 'hero',
        desc: '射出一道太阳能量，伤害沿途敌人；命中英雄时蕾欧娜冲到它面前并将其禁锢 0.5 秒。',
        fire(W, h, aim) {
          let dashed = false;
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 30, range: 9, radius: 0.8, pierce: true, team: h.team, owner: h, mesh: projMesh('shard', '#ffe27a'), scale: 2,
            trail: { color: '#fff3a0', glow: true, size: 0.8 },
            onHit: (u) => {
              W.damage(h, u, 90 * h.rk('E'), { type: 'magic' }); sunMark(W, u);
              if (!dashed && bigUnit(u)) { dashed = true; W.cc(u, 'root', 0.5, { color: '#ffe27a' }); W.dash(h, at(u.pos, dirOf(u, h.pos), 1.3), { dur: 0.3, trail: { color: '#ffe27a', glow: true, size: 0.8 } }); }
            } });
        } },
      { key: 'R', name: '日炎耀斑', icon: '耀', aim: 'point', range: 14, cd: 60, wind: 0.6, lock: 0.6, anim: 'raise', animDur: 0.8, ai: 'hero',
        desc: '召唤一道太阳光柱落在目标区域：中心的敌人被晕眩，外圈的敌人被大幅减速。',
        start(W, h, aim) { W.vfx.disc(aim, { r: 3.5, color: '#ffe27a', dur: 0.65, opacity: 0.7, spin: 2 }); },
        fire(W, h, aim) {
          for (const u of W.enemiesIn(h.team, aim, 3.5)) {
            W.damage(h, u, 200 * h.rk('R'), { type: 'magic' }); sunMark(W, u);
            if (distXZ(u.pos, aim) < 1.5 + u.radius) W.cc(u, 'stun', 1.75); else W.cc(u, 'slow', 1.75, { pct: 0.8 });
          }
          W.vfx.pillar(aim, { color: '#fff3a0', r: 3, h: 18, dur: 0.8 }); W.vfx.ring(aim, { r1: 5, color: '#ffe27a', dur: 0.5 });
          W.vfx.puff(aim, { n: 24, color: ['#ffe27a', '#ffffff'], cell: 'spark', glow: true, size: 1, speed: 7 });
          W.vfx.comic(aim, '耀斑!', { color: '#ffe27a', size: 3 }); W.vfx.shake(0.6);
        } },
    ],
  },
  // ======================= 璐璐 =======================
  {
    id: 'lulu', name: '璐璐', title: '仙灵女巫', role: '辅助', color: '#8a5ad0',
    hp: 1000, ad: 52, range: 9, atkSpeed: 0.65, speed: 6.9, atkAnim: 'throw', atkProj: 'orb', projColor: '#ff9ad0', projSpeed: 24,
    projTrail: { color: '#ffb0e0', glow: true, size: 0.4, rate: 0.6 }, hitColor: '#ffb0e0',
    passive: '皮克斯：仙灵皮克斯会跟着普攻额外射出三发小光弹。',
    onHit(W, h, t) {
      for (let i = 0; i < 3; i++) W.after(0.08 * i + 0.05, () => {
        if (!t.targetable) return;
        W.projectile({ from: V3(h.pos, 2.4), target: t, speed: 26, team: h.team, owner: h, mesh: projMesh('orb', '#c8a0ff'), scale: 0.5, onHit: (u) => W.damage(h, u, 4 + 0.8 * h.level, { type: 'magic', noText: true }) });
      });
    },
    res: { mana: 350, cost: [50, 65, 60, 100], order: 'QEW' }, sfx: ['orb', 'charm', 'shield', 'magic'], ind: [L(0.7), T(), T(), T(3.5)],
    skills: [
      { key: 'Q', name: '闪耀长枪', icon: '枪', aim: 'dir', range: 10, cd: 7, wind: 0.2, anim: 'throw', animDur: 0.45, ai: 'enemy',
        desc: '射出一道彩光，贯穿沿途敌人造成魔法伤害并大幅减速。',
        fire(W, h, aim) {
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 24, range: 10, radius: 0.7, pierce: true, team: h.team, owner: h, mesh: projMesh('bigOrb', '#ff9ad0'),
            trail: { color: '#ffb0e0', glow: true, size: 0.8, cell: 'star' },
            onHit: (u) => { W.damage(h, u, 90 * h.rk('Q'), { type: 'magic' }); W.cc(u, 'slow', 1.5, { pct: 0.6 }); } });
        } },
      { key: 'W', name: '奇思妙想', icon: '变', aim: 'unit', range: 8, cd: 15, wind: 0.2, anim: 'cast2', animDur: 0.45, ai: 'hero',
        desc: '把敌人变成一只小可爱 1.3 秒：无法攻击和施法，并被减速。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.cc(t, 'silence', 1.3); t.addBuff('noAttack', 1.3); W.cc(t, 'slow', 1.3, { pct: 0.3 });
          resize(W, t, 0.55, 1.3);
          W.vfx.puff(t.pos, { n: 16, color: ['#ff9ad0', '#ffffff'], cell: 'heart', size: 0.6, speed: 3 });
          W.vfx.comic(t.pos, '变!', { color: '#ff9ad0' });
        } },
      { key: 'E', name: '帮忙，皮克斯！', icon: '帮', aim: 'ally', range: 8, cd: 8, wind: 0.1, anim: 'cast2', animDur: 0.4, ai: 'heal', allowSelf: true,
        desc: '让皮克斯飞到队友身边，为它提供护盾。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.shield(t, 140 * h.rk('E'), 2.5, '#ff9ad0');
          W.vfx.puff(t.pos, { n: 12, color: '#c8a0ff', cell: 'star', size: 0.5, speed: 2, up: 1.5, y: 2 });
        } },
      { key: 'R', name: '狂野生长', icon: '长', aim: 'ally', range: 8, cd: 60, wind: 0.2, anim: 'raise', animDur: 0.6, ai: 'team', allowSelf: true,
        desc: '让队友瞬间长大 7 秒：回复生命并获得护盾，同时击飞它身边的敌人。',
        fire(W, h, aim, t) {
          if (!t) return;
          const low = W.alliesIn(h.team, h.pos, 8, true).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          if (low && low.hp / low.maxHp < t.hp / t.maxHp) t = low;
          W.heal(t, 200 * h.rk('R')); W.shield(t, 150 * h.rk('R'), 7, '#c8a0ff');
          resize(W, t, 1.45, 7);
          for (const u of W.enemiesIn(h.team, t.pos, 3.5)) W.cc(u, 'knockup', 1, { height: 2.4 });
          W.vfx.ring(t.pos, { r1: 4.5, color: '#c8a0ff', dur: 0.5 }); W.vfx.puff(t.pos, { n: 20, color: ['#ff9ad0', '#c8a0ff'], cell: 'star', size: 0.7, speed: 5 });
          W.vfx.comic(t.pos, '长大吧!', { color: '#c8a0ff', size: 3 });
        } },
    ],
  },
  // ======================= 莫甘娜 =======================
  {
    id: 'morgana', name: '莫甘娜', title: '堕落天使', role: '辅助', color: '#6a3fa0',
    hp: 1040, ad: 54, range: 9, atkSpeed: 0.65, speed: 6.8, atkAnim: 'throw', atkProj: 'orb', projColor: '#b58aff', projSpeed: 24,
    projTrail: { color: '#c8a0ff', glow: true, size: 0.4, rate: 0.6 }, hitColor: '#c8a0ff',
    passive: '灵魂虹吸：技能伤害的 15% 转化为自身生命。',
    res: { mana: 400, cost: [60, 70, 70, 100], order: 'QWE' }, sfx: ['orb', 'magic', 'shield', 'magic'], ind: [L(0.8), A(2.8), T(), SELF(6)],
    skills: [
      { key: 'Q', name: '暗之禁锢', icon: '锢', aim: 'dir', range: 12, cd: 10, wind: 0.25, anim: 'cast2', animDur: 0.5, ai: 'hero',
        desc: '射出暗影魔法球，禁锢第一个命中的敌人 2.5 秒。',
        fire(W, h, aim) {
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 20, range: 12, radius: 0.7, team: h.team, owner: h, mesh: projMesh('bigOrb', '#8a4ad0'),
            trail: { color: '#b58aff', glow: true, size: 0.9 },
            onHit: (u) => {
              drain(W, h, W.damage(h, u, 90 * h.rk('Q'), { type: 'magic' })); W.cc(u, 'root', 2.5, { color: '#b58aff' });
              W.vfx.add(null, 2.5, () => { if (Math.random() < 0.4) W.vfx.trail({ x: u.pos.x + (Math.random() - 0.5), y: Math.random() * 2, z: u.pos.z + (Math.random() - 0.5) }, { color: '#8a4ad0', glow: true, size: 0.5, vy: 1 }); });
            } });
        } },
      { key: 'W', name: '痛苦腐蚀', icon: '蚀', aim: 'point', range: 9, cd: 10, wind: 0.2, anim: 'throw', animDur: 0.45, ai: 'enemy',
        desc: '让一片土地变得腐蚀，5 秒内持续伤害其中的敌人。',
        fire(W, h, aim) {
          const pos = { x: aim.x, z: aim.z };
          W.vfx.disc(pos, { r: 2.8, color: '#6a3fa0', dur: 5, opacity: 0.7, spin: 1, hold: true, pulse: true });
          W.zone({ pos, r: 2.8, dur: 5, every: 0.5, team: h.team, onTick: () => {
            for (const u of W.enemiesIn(h.team, pos, 2.8)) drain(W, h, W.damage(h, u, 18 * h.rk('W'), { type: 'magic', noText: true }));
            W.vfx.puff(pos, { n: 4, color: ['#8a4ad0', '#2a1a3a'], cell: 'puff', size: 0.8, speed: 1, spread: 2.5, y: 0.2 });
          } });
        } },
      { key: 'E', name: '黑暗之盾', icon: '盾', aim: 'ally', range: 8, cd: 18, wind: 0.1, anim: 'cast2', animDur: 0.4, ai: 'heal', allowSelf: true,
        desc: '为队友套上黑暗护盾，吸收伤害，并让它 4 秒内大幅减少受到的控制时间。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.shield(t, 180 * h.rk('E'), 4, '#b58aff'); t.tenacityBuff = W.time + 4;
          W.vfx.comic(t.pos, '护!', { color: '#b58aff' });
        } },
      { key: 'R', name: '灵魂镣铐', icon: '链', aim: 'self', cd: 60, wind: 0.2, anim: 'raise', animDur: 0.6, ai: 'close',
        desc: '用锁链连住周围的敌人：立即造成伤害并减速；3 秒后仍被连着的敌人会被晕眩并再次受到伤害。',
        fire(W, h) {
          const foes = W.enemiesIn(h.team, h.pos, 6).filter(notMinion);
          h.addBuff('morganaR', 3, { haste: 0.35 });
          for (const t of foes) {
            drain(W, h, W.damage(h, t, 150 * h.rk('R'), { type: 'magic' })); W.cc(t, 'slow', 3, { pct: 0.2 });
            W.vfx.add(null, 3, () => {
              if (Math.random() < 0.7) { const k = Math.random(); W.vfx.trail({ x: h.pos.x + (t.pos.x - h.pos.x) * k, y: 1.3, z: h.pos.z + (t.pos.z - h.pos.z) * k }, { color: '#b58aff', glow: true, size: 0.5, vy: 0, life: 0.25 }); }
            });
            W.after(3, () => {
              if (h.dead || t.dead || h.dist(t) > 9) return;
              drain(W, h, W.damage(h, t, 150 * h.rk('R'), { type: 'magic' })); W.cc(t, 'stun', 1.5);
              W.vfx.comic(t.pos, '锁!', { color: '#b58aff' }); W.vfx.ring(t.pos, { r1: 2.5, color: '#b58aff', dur: 0.4 });
            });
          }
          W.vfx.ring(h.pos, { r1: 6.5, color: '#b58aff', dur: 0.6 });
        } },
    ],
  },
  // ======================= 卡特琳娜 =======================
  {
    id: 'katarina', name: '卡特琳娜', title: '不祥之刃', role: '刺客', color: '#c0303a',
    hp: 1150, ad: 66, range: 1.6, atkSpeed: 0.78, speed: 7.3, atkAnim: ['hslash', 'hslashBack'], hSlash: true, slashColor: '#ff9a9a', hitColor: '#ff9a9a',
    passive: '贪婪：捡起落地的匕首时旋身斩击周围敌人，并减少瞬步 3 秒冷却。',
    tick(W, h) {
      if (!h.daggers || !h.daggers.length) return;
      for (const d of h.daggers) {
        if (W.time > d.until) { d.gone = true; d.e.kill = true; continue; }
        if (W.time < d.ready || h.dead || distXZ(h.pos, d.pos) > 1.6) continue;
        d.gone = true; d.e.kill = true;
        for (const u of W.enemiesIn(h.team, h.pos, 3.4)) W.damage(h, u, 70 * h.rk('E') + h.ad * 0.5, { type: 'magic' });
        W.vfx.slash(h.pos, h.facing, { color: '#ff5a6a', r: 3.4, dur: 0.3, spin: 5, y: 1 }); W.vfx.ring(h.pos, { r1: 3.6, color: '#ff5a6a', dur: 0.3 });
        h.cds.E = Math.max(0, h.cds.E - 3); h.rig.play('spin', 0.35);
      }
      h.daggers = h.daggers.filter(d => !d.gone);
    },
    res: { mana: 0, cost: [0, 0, 0, 0], order: 'QEW' }, sfx: ['whoosh', 'whoosh', 'flash', 'swing'], ind: [T(3), NONE, A(1.5), SELF(6)],
    skills: [
      { key: 'Q', name: '弹射之刃', icon: '弹', aim: 'unit', range: 7.5, cd: 8, wind: 0.2, anim: 'throw', animDur: 0.4, ai: 'enemy',
        desc: '掷出匕首在最多 3 个敌人之间弹射，随后匕首落在第一个目标身后。',
        fire(W, h, aim, t) {
          if (!t) return;
          const hit = [t];
          const go = (from, u) => W.projectile({ from, target: u, speed: 26, team: h.team, owner: h, mesh: daggerMesh(), spin: 18, trail: { color: '#ff9a9a', glow: true, size: 0.4 },
            onHit: (v) => {
              W.damage(h, v, 80 * h.rk('Q'), { type: 'magic' });
              if (hit.length >= 3) return;
              const nx = W.nearestEnemy(h.team, v.pos, 5, (x) => !hit.includes(x));
              if (nx) { hit.push(nx); go(V3(v.pos, 1.4), nx); }
            } });
          go(h.tipPos(), t);
          dropDagger(W, h, at(t.pos, dirOf(h, t.pos), 2.2), 1.1);
        } },
      { key: 'W', name: '伺机待发', icon: '伺', aim: 'self', cd: 12, wind: 0, anim: 'flex', animDur: 0.3, ai: 'fight',
        desc: '向上抛出一把匕首，1.25 秒后落在原地；同时获得短暂加速。',
        fire(W, h) { h.addBuff('kataW', 1.25, { haste: 0.5 }); dropDagger(W, h, { x: h.pos.x, z: h.pos.z }, 1.25); } },
      { key: 'E', name: '瞬步', icon: '瞬', aim: 'point', range: 7.5, cd: 9, wind: 0, lock: 0.15, anim: 'slash', animDur: 0.35, ai: 'enemy',
        desc: '瞬移到目标位置；若目标点附近有敌人，则闪到它身后并斩击。',
        fire(W, h, aim) {
          const u = W.nearestEnemy(h.team, aim, 2);
          if (u) { blink(W, h, at(u.pos, dirOf(h, u.pos), 1.1)); h.face(u.pos.x, u.pos.z); h.facing = h.faceTarget; W.damage(h, u, 60 * h.rk('E') + h.ad * 0.4, { type: 'magic' }); W.vfx.slash(u.pos, h.facing, { color: '#ff9a9a', r: 2.2 }); }
          else blink(W, h, aim);
        } },
      { key: 'R', name: '死亡莲华', icon: '莲', aim: 'self', cd: 60, wind: 0, lock: 0.1, anim: 'spin', animDur: 2.5, ai: 'close',
        desc: '原地旋转 2.5 秒，不断向附近最多 3 个敌人投掷匕首。被控制会打断。',
        fire(W, h) {
          h.addBuff('channel', 2.5); h.addBuff('noAttack', 2.5);
          let n = 0;
          const tick = () => {
            if (h.dead || !h.canAct() || n++ >= 10) { h.removeBuff('channel'); h.removeBuff('noAttack'); return; }
            const ts = W.enemiesIn(h.team, h.pos, 6).sort((a, b) => (bigUnit(b) - bigUnit(a)) || h.dist(a) - h.dist(b)).slice(0, 3);
            for (const t of ts) W.projectile({ from: V3(h.pos, 1.3), target: t, speed: 30, team: h.team, owner: h, mesh: daggerMesh(), spin: 20, onHit: (u) => W.damage(h, u, 38 * h.rk('R'), { type: 'magic' }) });
            W.vfx.ring(h.pos, { r0: 1, r1: 6, color: '#ff5a6a', dur: 0.25 });
            W.after(0.25, tick);
          };
          tick();
          W.vfx.comic(h.pos, '莲华!', { color: '#ff5a6a' });
        } },
    ],
  },
  // ======================= 赵信 =======================
  {
    id: 'xinzhao', name: '赵信', title: '德邦总管', role: '战士', color: '#b8302a',
    hp: 1400, ad: 70, range: 2.1, atkSpeed: 0.72, speed: 7.0, atkAnim: 'thrust', slashColor: '#ffd070', hitColor: '#ffd070',
    passive: '决意：每第三次普攻造成额外伤害并回复生命。',
    onHit(W, h, t) {
      h.xinN = (h.xinN || 0) + 1;
      if (h.xinN >= 3) { h.xinN = 0; W.damage(h, t, h.ad * 0.4, { type: 'phys' }); W.heal(h, 20 + 4 * h.level); W.vfx.spark(t.pos, '#ffd070', 8); }
    },
    res: { mana: 280, cost: [30, 45, 50, 100], order: 'QEW' }, sfx: ['whoosh', 'swing', 'whoosh', 'roar'], ind: [NONE, L(0.9), T(2.2), SELF(4.5)],
    skills: [
      { key: 'Q', name: '三重爪击', icon: '爪', aim: 'self', cd: 7, wind: 0, anim: 'flex', animDur: 0.35, ai: 'close',
        desc: '接下来三次普攻造成额外伤害，第三下把目标挑飞。',
        fire(W, h) {
          h.atkCd = 0;
          const aura = W.vfx.aura(h, { color: '#ffd070', glow: true, r: 1.2, dur: 5, particles: 14 });
          h.addBuff('xinQ', 5, { n: 3, onHit(W, h, t, b) {
            W.damage(h, t, 40 * h.rk('Q'), { type: 'phys' });
            if (--b.n <= 0) { W.cc(t, 'knockup', 0.75, { height: 2.2 }); W.vfx.comic(t.pos, '起!', { color: '#ffd070' }); h.removeBuff('xinQ'); aura.kill = true; }
          } });
        } },
      { key: 'W', name: '风斩电刺', icon: '刺', aim: 'dir', range: 8, cd: 10, wind: 0.3, anim: 'thrust', animDur: 0.6, ai: 'enemy',
        desc: '先向前横扫，再用长枪直刺，刺中的敌人被减速。',
        fire(W, h, aim) {
          const d = dirOf(h, aim);
          for (const u of inCone(W, h, d, 4, 1.0)) W.damage(h, u, 60 * h.rk('W'), { type: 'phys' });
          W.vfx.slash(h.pos, h.facing, { color: '#ffd070', r: 3.6 });
          W.after(0.2, () => {
            if (h.dead) return;
            for (const u of lineHits(W, h, h.pos, at(h.pos, d, 8), 0.9)) { W.damage(h, u, 80 * h.rk('W'), { type: 'phys' }); W.cc(u, 'slow', 1.5, { pct: 0.5 }); }
            W.vfx.beam(h.tipPos(), at(h.pos, d, 8), { width: 0.6, color: '#fff3a0', dur: 0.3 });
          });
        } },
      { key: 'E', name: '无畏冲锋', icon: '冲', aim: 'unit', range: 7, cd: 11, wind: 0, lock: 0.35, anim: 'leap', animDur: 0.4, ai: 'enemy',
        desc: '冲向目标，伤害并减速其周围的敌人，随后 4 秒攻速提升。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.dash(h, at(t.pos, dirOf(t, h.pos), 1.2), { dur: 0.3, arc: 1.5, trail: { color: '#ffd070', glow: true, size: 0.8 }, onEnd: () => {
            for (const u of W.enemiesIn(h.team, t.pos, 2.2)) { W.damage(h, u, 80 * h.rk('E'), { type: 'magic' }); W.cc(u, 'slow', 0.6, { pct: 0.5 }); }
            h.addBuff('xinE', 4, { as: 0.4 });
            W.vfx.ring(t.pos, { r1: 2.8, color: '#ffd070', dur: 0.35 }); W.vfx.shake(0.2);
          } });
        } },
      { key: 'R', name: '新月护卫', icon: '月', aim: 'self', cd: 50, wind: 0.2, anim: 'whirl', animDur: 0.6, ai: 'close',
        desc: '挥枪横扫一周，造成基于目标当前生命的伤害并将其击退，之后 3 秒减伤。',
        fire(W, h) {
          for (const u of W.enemiesIn(h.team, h.pos, 4.5)) {
            W.damage(h, u, 180 * h.rk('R') + u.hp * 0.15, { type: 'phys' });
            W.displace(u, at(u.pos, dirOf(h, u.pos), 3), 0.3);
          }
          h.addBuff('xinR', 3, { dr: 0.3 });
          W.vfx.slash(h.pos, h.facing, { color: '#ffd070', r: 4.6, dur: 0.4, spin: 6.3 });
          W.vfx.ring(h.pos, { r1: 5, color: '#ffd070', dur: 0.45 }); W.vfx.comic(h.pos, '德邦!', { color: '#ffd070', size: 3 }); W.vfx.shake(0.4);
        } },
    ],
  },
  // ======================= 阿木木 =======================
  {
    id: 'amumu', name: '阿木木', title: '殇之木乃伊', role: '坦克', color: '#6a9a5a',
    hp: 1480, ad: 60, range: 1.7, atkSpeed: 0.65, speed: 6.8, atkAnim: 'punch', hitColor: '#c8e8a0',
    passive: '诅咒之触：普攻附带魔法伤害，并使目标 3 秒内受到阿木木的技能伤害提高 10%。',
    onHit(W, h, t) { t.amuCurse = W.time + 3; W.damage(h, t, 10 + 2 * h.level, { type: 'magic', noText: true }); },
    res: { mana: 280, cost: [70, 8, 35, 100], order: 'EWQ' }, sfx: ['whoosh', 'magic', 'slam', 'roar'], ind: [L(0.8), SELF(3), SELF(3.5), SELF(5.5)],
    skills: [
      { key: 'Q', name: '绷带牵引', icon: '绷', aim: 'dir', range: 11, cd: 11, wind: 0.25, anim: 'throw', animDur: 0.5, ai: 'hero',
        desc: '甩出绷带缠住第一个敌人，把自己拉过去并晕眩它 1 秒。',
        fire(W, h, aim) {
          hookShot(W, h, aim, { range: 11, color: '#e8dcb0', onHit: (u) => {
            W.damage(h, u, amuAmp(W, u, 90 * h.rk('Q')), { type: 'magic' }); W.cc(u, 'stun', 1);
            W.dash(h, at(u.pos, dirOf(u, h.pos), 1.1), { dur: 0.3, trail: { color: '#e8dcb0', size: 0.6 } });
            W.vfx.comic(u.pos, '缠!', { color: '#c8e8a0' });
          } });
        } },
      { key: 'W', name: '绝望', icon: '泪', aim: 'self', cd: 10, wind: 0, anim: 'channel', animDur: 0.5, ai: 'close',
        desc: '哭泣 5 秒，每 0.5 秒对周围敌人造成基于其最大生命值的魔法伤害。',
        fire(W, h) {
          W.vfx.aura(h, { color: '#8ad0ff', glow: true, r: 3, dur: 5, particles: 20, pcolor: '#bfe8ff' });
          h.addBuff('amumuW', 5, { every: 0.5, tick: (me) => { for (const u of W.enemiesIn(me.team, me.pos, 3)) W.damage(me, u, amuAmp(W, u, 8 * h.rk('W') + u.maxHp * 0.005), { type: 'magic', noText: true }); } });
        } },
      { key: 'E', name: '愤怒', icon: '怒', aim: 'self', cd: 8, wind: 0.2, anim: 'slam', animDur: 0.5, ai: 'close',
        desc: '怒气爆发，对周围敌人造成魔法伤害，并在 3 秒内减少受到的伤害。',
        fire(W, h) {
          for (const u of W.enemiesIn(h.team, h.pos, 3.5)) W.damage(h, u, amuAmp(W, u, 110 * h.rk('E')), { type: 'magic' });
          h.addBuff('amumuE', 3, { dr: 0.12 });
          W.vfx.ring(h.pos, { r1: 4, color: '#c8e8a0', dur: 0.4 }); W.vfx.puff(h.pos, { n: 14, color: '#e8dcb0', cell: 'shard', size: 0.5, speed: 6 });
        } },
      { key: 'R', name: '木乃伊之咒', icon: '咒', aim: 'self', cd: 60, wind: 0.25, anim: 'raise', animDur: 0.7, ai: 'close',
        desc: '绷带向四周爆开，晕眩周围所有敌人 1.5 秒并造成魔法伤害。',
        fire(W, h) {
          for (const u of W.enemiesIn(h.team, h.pos, 5.5)) {
            W.damage(h, u, amuAmp(W, u, 180 * h.rk('R')), { type: 'magic' }); W.cc(u, 'stun', 1.5);
            W.vfx.beam(V3(h.pos), u.pos, { width: 0.3, color: '#e8dcb0', dur: 0.5 });
          }
          W.vfx.ring(h.pos, { r1: 6.5, color: '#e8dcb0', dur: 0.6 }); W.vfx.puff(h.pos, { n: 24, color: ['#e8dcb0', '#c8e8a0'], cell: 'shard', size: 0.8, speed: 8 });
          W.vfx.comic(h.pos, '别走!', { color: '#c8e8a0', size: 3 }); W.vfx.shake(0.5);
        } },
    ],
  },
  // ======================= 布兰德 =======================
  {
    id: 'brand', name: '布兰德', title: '复仇焰魂', role: '法师', color: '#e0602a',
    hp: 1000, ad: 54, range: 9, atkSpeed: 0.65, speed: 6.8, atkAnim: 'throw', atkProj: 'fire', projSpeed: 22,
    projTrail: { color: '#ff9a40', glow: true, size: 0.5, rate: 0.8 }, hitColor: '#ffb040',
    passive: '炽热之焰：技能会点燃敌人，4 秒内每秒造成魔法伤害。',
    res: { mana: 420, cost: [50, 60, 70, 100], order: 'WQE' }, sfx: ['fire', 'fire', 'fire', 'fire'], ind: [L(0.7), A(2.6), T(4), T(6)],
    skills: [
      { key: 'Q', name: '火焰烧灼', icon: '烧', aim: 'dir', range: 11, cd: 6, wind: 0.25, anim: 'throw', animDur: 0.45, ai: 'hero',
        desc: '射出火球，对第一个敌人造成魔法伤害；若目标已被点燃，则晕眩 1.5 秒。',
        fire(W, h, aim) {
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 26, range: 11, radius: 0.7, team: h.team, owner: h, mesh: projMesh('fire'), scale: 1.2, trail: { color: '#ff8a30', glow: true, size: 0.8 },
            onHit: (u) => {
              const was = u.brandBurn > W.time;
              W.damage(h, u, 110 * h.rk('Q'), { type: 'magic' });
              if (was) { W.cc(u, 'stun', 1.5); W.vfx.comic(u.pos, '晕!', { color: '#ff8a30' }); }
              ignite(W, h, u);
            } });
        } },
      { key: 'W', name: '烈焰之柱', icon: '柱', aim: 'point', range: 10, cd: 9, wind: 0.2, anim: 'raise', animDur: 0.5, ai: 'enemy',
        desc: '0.6 秒后在目标处升起火柱，对已被点燃的敌人伤害提高 25%。',
        fire(W, h, aim) {
          const pos = { x: aim.x, z: aim.z };
          W.vfx.disc(pos, { r: 2.6, color: '#ff8a30', dur: 0.65, opacity: 0.7, spin: 2 });
          W.after(0.6, () => {
            for (const u of W.enemiesIn(h.team, pos, 2.6)) { W.damage(h, u, 120 * h.rk('W') * (u.brandBurn > W.time ? 1.25 : 1), { type: 'magic' }); ignite(W, h, u); }
            W.vfx.pillar(pos, { color: '#ff8a30', r: 2.4, h: 8, dur: 0.6 });
            W.vfx.puff(pos, { n: 24, color: ['#ffcf4a', '#ff6a2a', '#ff3a1a'], cell: 'flame', size: 1.1, speed: 5 });
          });
        } },
      { key: 'E', name: '烈火燃烧', icon: '燃', aim: 'unit', range: 7.5, cd: 8, wind: 0.2, anim: 'cast2', animDur: 0.45, ai: 'enemy',
        desc: '引燃目标造成魔法伤害；若目标已被点燃，火焰会蔓延到它周围的敌人。',
        fire(W, h, aim, t) {
          if (!t) return;
          const was = t.brandBurn > W.time;
          W.damage(h, t, 90 * h.rk('E'), { type: 'magic' }); ignite(W, h, t);
          W.vfx.puff(t.pos, { n: 14, color: ['#ffcf4a', '#ff6a2a'], cell: 'flame', size: 0.9, speed: 3 });
          if (was) for (const u of W.enemiesIn(h.team, t.pos, 4)) if (u !== t) { W.damage(h, u, 60 * h.rk('E'), { type: 'magic' }); ignite(W, h, u); W.vfx.beam(V3(t.pos), u.pos, { width: 0.3, color: '#ff8a30', dur: 0.3 }); }
        } },
      { key: 'R', name: '烈焰风暴', icon: '暴', aim: 'unit', range: 8, cd: 55, wind: 0.25, anim: 'raise', animDur: 0.6, ai: 'hero',
        desc: '释放一团烈焰在敌人之间弹跳 5 次，每次造成魔法伤害并点燃目标。',
        fire(W, h, aim, t) {
          if (!t) return;
          const hop = (from, u, n) => W.projectile({ from, target: u, speed: 20, team: h.team, owner: h, mesh: projMesh('fire'), scale: 1.8, trail: { color: '#ff6a2a', glow: true, size: 1.1 },
            onHit: (v) => {
              W.damage(h, v, 100 * h.rk('R'), { type: 'magic' }); ignite(W, h, v);
              W.vfx.puff(v.pos, { n: 12, color: ['#ffcf4a', '#ff3a1a'], cell: 'flame', size: 0.9, speed: 4 });
              if (n <= 1) return;
              const pool = W.enemiesIn(h.team, v.pos, 6).filter(x => x !== v);
              const nx = pool.find(bigUnit) || pool[0];
              if (nx) hop(V3(v.pos, 1.6), nx, n - 1);
            } });
          hop(h.tipPos(), t, 5);
          W.vfx.comic(h.pos, '风暴!', { color: '#ff8a30' });
        } },
    ],
  },
  // ======================= 维迦 =======================
  {
    id: 'veigar', name: '维迦', title: '邪恶小法师', role: '法师', color: '#5a3fa0',
    hp: 980, ad: 50, range: 9, atkSpeed: 0.65, speed: 6.7, atkAnim: 'throw', atkProj: 'orb', projColor: '#b58aff', projSpeed: 24,
    projTrail: { color: '#c8a0ff', glow: true, size: 0.4, rate: 0.6 }, hitColor: '#c8a0ff',
    passive: '超凡邪力：技能命中英雄、或用厄运的礼物击杀单位时，永久提高 1% 技能伤害。',
    res: { mana: 400, cost: [40, 70, 80, 100], order: 'QWE' }, sfx: ['orb', 'boom', 'magic', 'laser'], ind: [L(0.7), A(2.5), A(3.2), T()],
    skills: [
      { key: 'Q', name: '厄运的礼物', icon: '礼', aim: 'dir', range: 10, cd: 5, wind: 0.25, anim: 'throw', animDur: 0.45, ai: 'enemy',
        desc: '射出暗能量弹，最多穿透两个敌人；击杀单位可叠加被动。',
        fire(W, h, aim) {
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 24, range: 10, radius: 0.6, pierce: true, maxHits: 2, team: h.team, owner: h, mesh: projMesh('bigOrb', '#8a4ad0'), scale: 0.8,
            trail: { color: '#b58aff', glow: true, size: 0.7 },
            onHit: (u) => { W.damage(h, u, 100 * h.rk('Q') * veigarAmp(h), { type: 'magic' }); if (u.dead) veigarStack(W, h, u.kind === 'hero' ? 3 : 1); else if (u.kind === 'hero') veigarStack(W, h); } });
        } },
      { key: 'W', name: '黑暗物质', icon: '暗', aim: 'point', range: 10, cd: 8, wind: 0.2, anim: 'raise', animDur: 0.5, ai: 'enemy',
        desc: '1.2 秒后一颗暗物质从天而降，砸中区域内的敌人。',
        fire(W, h, aim) {
          const pos = { x: aim.x, z: aim.z };
          W.vfx.disc(pos, { r: 2.5, color: '#8a4ad0', dur: 1.25, opacity: 0.7, spin: 2, hold: true });
          const m = projMesh('bigOrb', '#3a1a6a'); m.scale.setScalar(1.6);
          dropFromSky(W, pos, m, 1.2, () => {
            for (const u of W.enemiesIn(h.team, pos, 2.5)) { W.damage(h, u, 180 * h.rk('W') * veigarAmp(h), { type: 'magic' }); if (u.kind === 'hero') veigarStack(W, h); }
            W.vfx.ring(pos, { r1: 3.6, color: '#b58aff', dur: 0.45 }); W.vfx.puff(pos, { n: 22, color: ['#8a4ad0', '#2a1a3a'], cell: 'puff', size: 1.2, speed: 5 });
            W.vfx.comic(pos, '砸!', { color: '#b58aff' }); W.vfx.shake(0.3); m.visible = false;
          }, 16);
        } },
      { key: 'E', name: '扭曲空间', icon: '笼', aim: 'point', range: 9, cd: 16, wind: 0.3, anim: 'cast2', animDur: 0.5, ai: 'hero',
        desc: '0.5 秒后在目标处生成一圈牢笼，持续 3 秒；碰到牢笼边缘的敌人会被晕眩 1.5 秒。',
        fire(W, h, aim) {
          const pos = { x: aim.x, z: aim.z }, R = 3.2, done = new Set();
          const ring = new THREE.Mesh(G.torus(R, 0.14, Math.PI * 2, 8, 48), glowMat('#b58aff', 0.7)); ring.rotation.x = Math.PI / 2;
          const grp = new THREE.Group(); grp.add(ring); grp.position.set(pos.x, 0.3, pos.z);
          W.vfx.add(grp, 3.5, (k, dt, e) => { ring.material.opacity = e.t < 0.5 ? 0.25 : 0.7 * (1 - Math.max(0, k - 0.9) * 10); ring.rotation.z += dt; if (e.t > 0.5 && Math.random() < 0.5) { const a = Math.random() * 6.28; W.vfx.trail({ x: pos.x + Math.cos(a) * R, y: 0.3 + Math.random(), z: pos.z + Math.sin(a) * R }, { color: '#c8a0ff', glow: true, size: 0.5, vy: 1.5 }); } });
          W.zone({ pos, r: R, dur: 3.5, every: 0.05, team: h.team, onTick: (z) => {
            if (z.t < 0.5) return;
            for (const u of W.enemiesIn(h.team, pos, R + 0.7)) {
              if (done.has(u) || Math.abs(distXZ(u.pos, pos) - R) > 0.6 + u.radius) continue;
              done.add(u); W.cc(u, 'stun', 1.5); W.vfx.comic(u.pos, '困!', { color: '#b58aff' }); if (u.kind === 'hero') veigarStack(W, h);
            }
          } });
        } },
      { key: 'R', name: '魔能爆破', icon: '爆', aim: 'unit', range: 8, cd: 55, wind: 0.25, anim: 'cast2', animDur: 0.6, ai: 'execute',
        desc: '向敌人射出一颗巨大的魔能球，目标损失的生命越多，伤害越高（最多翻倍）。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.projectile({ from: h.tipPos(), target: t, speed: 22, team: h.team, owner: h, mesh: projMesh('bigOrb', '#6a3ad0'), scale: 1.6, trail: { color: '#b58aff', glow: true, size: 1.2 },
            onHit: (u) => {
              W.damage(h, u, 220 * h.rk('R') * (2 - u.hp / u.maxHp) * veigarAmp(h), { type: 'magic', color: '#c8a0ff' });
              if (u.kind === 'hero') veigarStack(W, h);
              W.vfx.ring(u.pos, { r1: 4, color: '#b58aff', dur: 0.5 }); W.vfx.puff(u.pos, { n: 22, color: ['#b58aff', '#ffffff'], cell: 'star', size: 0.7, speed: 6 });
              W.vfx.comic(u.pos, '爆!', { color: '#b58aff', size: 3 }); W.vfx.shake(0.5);
            } });
        } },
    ],
  },
  // ======================= 崔斯特 =======================
  {
    id: 'twistedfate', name: '崔斯特', title: '卡牌大师', role: '法师', color: '#7a4ab0',
    hp: 1000, ad: 56, range: 9.5, atkSpeed: 0.7, speed: 6.9, atkAnim: 'throw', atkProj: 'shard', projColor: '#ffd84a', projSpeed: 28,
    projTrail: { color: '#ffe27a', glow: true, size: 0.3, rate: 0.5 }, hitColor: '#ffe27a',
    passive: '灌铅骰子：普攻击杀单位时掷骰子，额外获得 1～6 金币。',
    onHit(W, h, t) { if (t.dead) h.addGold(1 + Math.floor(Math.random() * 6)); },
    res: { mana: 330, cost: [60, 40, 0, 100], order: 'QWE' }, sfx: ['whoosh', 'click', 'magic', 'magic'], ind: [C(0.35), NONE, NONE, A(1.5)],
    skills: [
      { key: 'Q', name: '万能牌', icon: '牌', aim: 'dir', range: 12, cd: 6, wind: 0.25, anim: 'throw', animDur: 0.45, ai: 'enemy',
        desc: '扇形掷出三张卡牌，贯穿沿途敌人造成魔法伤害。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), hit = new Set();
          for (const a of [-0.35, 0, 0.35]) W.projectile({ from: h.tipPos(), dir: rot(d, a), speed: 24, range: 12, radius: 0.6, pierce: true, team: h.team, owner: h, mesh: cardMesh('#b58aff'), spin: 8,
            trail: { color: '#e0c8ff', glow: true, size: 0.4 },
            onHit: (u) => { if (hit.has(u)) return; hit.add(u); W.damage(h, u, 100 * h.rk('Q'), { type: 'magic' }); } });
        } },
      { key: 'W', name: '选牌', icon: '选', aim: 'self', cd: 8, wind: 0, anim: 'twirl', animDur: 0.5, ai: 'fight',
        desc: '洗牌后抽出一张：蓝牌造成伤害并回蓝，红牌范围伤害并减速，黄牌造成伤害并晕眩。下一次普攻打出。',
        fire(W, h) {
          const cards = [['blue', '#4a8ae0', '蓝牌'], ['red', '#e04040', '红牌'], ['gold', '#e8c25a', '黄牌']];
          const m = cardMesh('#ffffff'); m.rotation.x = Math.PI / 2;
          let chosen = null;
          const e = W.vfx.add(m, 7, (k, dt, e) => {
            m.position.set(h.pos.x, h.height + 1.1, h.pos.z); m.rotation.z += dt * 3;
            if (!chosen) { const c = cards[Math.floor(e.t * 8) % 3]; W.vfx.trail(m.position, { color: c[1], glow: true, size: 0.6, vy: 0 }); }
          });
          W.after(0.6, () => {
            if (h.dead) { e.kill = true; return; }
            chosen = cards[Math.floor(Math.random() * 3)];
            const [type, col, name] = chosen;
            W.vfx.comic(h.pos, name + '!', { color: col });
            W.vfx.aura(h, { color: col, glow: true, r: 1.1, dur: 6, particles: 10 });
            h.atkCd = 0;
            h.addBuff('tfCard', 6, { onEnd: () => { e.kill = true; }, onHit(W, h, t) {
              if (type === 'blue') { W.damage(h, t, 60 * h.rk('W') + h.ad, { type: 'magic' }); h.mana = Math.min(h.maxMana, h.mana + 50); }
              else if (type === 'red') { for (const u of W.enemiesIn(h.team, t.pos, 2.5)) { W.damage(h, u, 50 * h.rk('W'), { type: 'magic' }); W.cc(u, 'slow', 2, { pct: 0.3 }); } W.vfx.ring(t.pos, { r1: 3, color: col, dur: 0.35 }); }
              else { W.damage(h, t, 40 * h.rk('W'), { type: 'magic' }); W.cc(t, 'stun', 1.2); }
              W.vfx.puff(t.pos, { n: 10, color: col, cell: 'spark', glow: true, size: 0.7, speed: 4 });
              h.removeBuff('tfCard');
            } });
          });
        } },
      { key: 'E', name: '卡牌骗术', icon: '骗', aim: 'self', cd: 12, wind: 0, anim: 'flex', animDur: 0.35, ai: 'fight',
        desc: '6 秒内攻速提升，普攻额外造成魔法伤害。',
        fire(W, h) {
          h.addBuff('tfE', 6, { as: 0.35, onHit(W, h, t) { W.damage(h, t, 25 * h.rk('E'), { type: 'magic', noText: true }); } });
          W.vfx.aura(h, { color: '#b58aff', glow: true, r: 1.1, dur: 6, particles: 12 });
        } },
      { key: 'R', name: '命运', icon: '命', aim: 'point', range: 30, cd: 70, wind: 1.5, lock: 1.5, anim: 'channel', animDur: 1.5, ai: 'never',
        desc: '引导 1.5 秒后传送到远处的目标位置。',
        start(W, h, aim) { h.addBuff('channel', 1.5); W.vfx.disc(aim, { r: 1.6, color: '#b58aff', dur: 1.5, opacity: 0.9, spin: 3, hold: true }); W.vfx.aura(h, { color: '#b58aff', glow: true, r: 1.4, dur: 1.5, particles: 20 }); },
        fire(W, h, aim) { blink(W, h, aim); W.vfx.pillar(h.pos, { color: '#b58aff', r: 1.5, h: 10 }); W.vfx.comic(h.pos, '命运!', { color: '#b58aff' }); } },
    ],
  },
  // ======================= 李青 =======================
  {
    id: 'leesin', name: '李青', title: '盲僧', role: '战士', color: '#c07a2a',
    hp: 1350, ad: 70, range: 1.6, atkSpeed: 0.75, speed: 7.2, atkAnim: 'punch', hitColor: '#ffd070',
    passive: '疾风骤雨：施放技能后，接下来两次普攻攻速大幅提升。',
    onCast(W, h) { h.addBuff('leeP', 3, { as: 0.4, n: 2, onHit(W, h, t, b) { if (--b.n <= 0) h.removeBuff('leeP'); } }); },
    res: { mana: 0, cost: [0, 0, 0, 0], order: 'QWE' }, sfx: ['orb', 'shield', 'slam', 'hitHeavy'], ind: [L(0.7), T(), SELF(3.8), T(2.2)],
    skills: [
      { key: 'Q', name: '天音波 / 回音击', icon: '音', aim: 'dir', range: 11, cd: 8, wind: 0.2, anim: 'punch', animDur: 0.4, ai: 'enemy',
        desc: '发出音波，命中后 3 秒内可再次施放：飞身冲向目标，造成基于其损失生命的额外伤害。',
        fire(W, h, aim) {
          const st = h.leeQ;
          if (st && W.time < st.until && st.t.targetable) {
            h.leeQ = null;
            const t = st.t;
            W.dash(h, at(t.pos, dirOf(t, h.pos), 1.2), { dur: 0.3, anim: 'leap', trail: { color: '#ffd070', glow: true, size: 0.8 }, onEnd: () => {
              if (!t.targetable) return;
              W.damage(h, t, 90 * h.rk('Q') + (t.maxHp - t.hp) * 0.08, { type: 'phys' });
              W.vfx.comic(t.pos, '回音!', { color: '#ffd070' }); W.vfx.ring(t.pos, { r1: 2.5, color: '#ffd070' });
            } });
            return;
          }
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 28, range: 11, radius: 0.7, team: h.team, owner: h, mesh: projMesh('orb', '#ffd070'), scale: 1.3, trail: { color: '#ffe8a0', glow: true, size: 0.7 },
            onHit: (u) => {
              W.damage(h, u, 90 * h.rk('Q'), { type: 'phys' });
              const mark = h.leeQ = { t: u, until: W.time + 3 };
              h.cds.Q = Math.min(h.cds.Q, 0.4);
              W.vfx.disc(u.pos, { r: 1.2, color: '#ffd070', dur: 3, follow: u.pos, hold: true, spin: 2 });
              W.after(3.05, () => { if (h.leeQ === mark) { h.leeQ = null; h.cds.Q = Math.max(h.cds.Q, 4); } });
            } });
        } },
      { key: 'W', name: '金钟罩', icon: '罩', aim: 'ally', range: 7, cd: 12, wind: 0, lock: 0.3, anim: 'leap', animDur: 0.35, ai: 'hurt', allowSelf: true,
        desc: '冲向一名队友，为自己和它提供护盾。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.shield(h, 120 * h.rk('W'), 2, '#ffd070');
          if (t !== h) { W.dash(h, at(t.pos, dirOf(t, h.pos), 1), { dur: 0.3, trail: { color: '#ffd070', glow: true, size: 0.7 } }); W.shield(t, 120 * h.rk('W'), 2, '#ffd070'); }
        } },
      { key: 'E', name: '天雷破', icon: '雷', aim: 'self', cd: 9, wind: 0.15, anim: 'slam', animDur: 0.45, ai: 'close',
        desc: '猛击地面，对周围敌人造成魔法伤害并减速。',
        fire(W, h) {
          for (const u of W.enemiesIn(h.team, h.pos, 3.8)) { W.damage(h, u, 100 * h.rk('E'), { type: 'magic' }); W.cc(u, 'slow', 2, { pct: 0.4 }); }
          W.vfx.ring(h.pos, { r1: 4.5, color: '#ffd070', dur: 0.4 }); W.vfx.disc(h.pos, { r: 3.8, color: '#c07a2a', dur: 0.6, opacity: 0.5 });
          W.vfx.puff(h.pos, { n: 14, color: '#e8dcc0', cell: 'puff', size: 1, speed: 4, y: 0.3 }); W.vfx.shake(0.25);
        } },
      { key: 'R', name: '猛龙摆尾', icon: '龙', aim: 'unit', range: 3.5, cd: 50, wind: 0.25, anim: 'punch', animDur: 0.5, ai: 'hero',
        desc: '一脚把目标踢飞，被踢飞的目标撞到的敌人也会受到伤害并被击飞。',
        fire(W, h, aim, t) {
          if (!t) return;
          const d = dirOf(h, t.pos), end = W.clampDash(t.pos, at(t.pos, d, 7));
          W.damage(h, t, 220 * h.rk('R'), { type: 'phys' });
          if (!t.isStructure) W.displace(t, end, 0.45);
          W.vfx.comic(t.pos, '摆尾!', { color: '#ffd070', size: 3 }); W.vfx.shake(0.5);
          W.vfx.add(null, 0.45, () => W.vfx.trail({ x: t.pos.x, y: 1.3, z: t.pos.z }, { color: '#ffd070', glow: true, size: 1, vy: 0 }));
          W.after(0.45, () => {
            for (const u of W.enemiesIn(h.team, end, 2.2)) if (u !== t) { W.damage(h, u, 180 * h.rk('R'), { type: 'phys' }); W.cc(u, 'knockup', 0.75); }
            W.vfx.ring(end, { r1: 3, color: '#ffd070', dur: 0.4 });
          });
        } },
    ],
  },
  // ======================= 蒙多医生 =======================
  {
    id: 'mundo', name: '蒙多', title: '祖安狂人', role: '坦克', color: '#8a5ab0', radius: 0.9,
    hp: 1600, ad: 68, range: 1.8, atkSpeed: 0.66, speed: 6.8, atkAnim: 'slash', slashColor: '#e0c8ff', hitColor: '#c8a0ff',
    passive: '想去哪就去哪：技能消耗生命而不是法力；每秒额外回复 0.6% 最大生命值。',
    tick(W, h, dt) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.006 * dt); },
    res: { mana: 0, cost: [0, 0, 0, 0], order: 'QEW' }, sfx: ['whoosh', 'thunder', 'hitHeavy', 'roar'], ind: [L(0.7), SELF(3), NONE, NONE],
    skills: [
      { key: 'Q', name: '巨型切肉刀', icon: '刀', aim: 'dir', range: 11, cd: 4, wind: 0.25, anim: 'throw', animDur: 0.45, ai: 'enemy',
        desc: '消耗生命，扔出切肉刀：对第一个敌人造成基于其当前生命的伤害并减速，命中后返还部分生命。',
        fire(W, h, aim) {
          hpCost(h, 40);
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 24, range: 11, radius: 0.7, team: h.team, owner: h, mesh: cleaverMesh(), spin: 14, trail: { color: '#c8d0d8', size: 0.4 },
            onHit: (u) => { W.damage(h, u, 60 * h.rk('Q') + Math.min(u.hp * 0.12, u.kind === 'hero' ? 9999 : 250), { type: 'magic' }); W.cc(u, 'slow', 2, { pct: 0.4 }); W.heal(h, 30); } });
        } },
      { key: 'W', name: '心脏除颤', icon: '颤', aim: 'self', cd: 14, wind: 0, anim: 'flex', animDur: 0.4, ai: 'close',
        desc: '消耗生命给自己电击：4 秒内减少受到的伤害，并持续电击周围敌人。',
        fire(W, h) {
          hpCost(h, h.hp * 0.05);
          W.vfx.aura(h, { color: '#8ad0ff', glow: true, r: 3, dur: 4, particles: 18, pcolor: '#fff38a' });
          h.addBuff('mundoW', 4, { dr: 0.15, every: 0.5, tick: (me) => { for (const u of W.enemiesIn(me.team, me.pos, 3)) W.damage(me, u, 12 * h.rk('W'), { type: 'magic', noText: true }); } });
        } },
      { key: 'E', name: '钝器重击', icon: '击', aim: 'self', cd: 8, wind: 0, anim: 'flex', animDur: 0.35, ai: 'close',
        desc: '消耗生命，下一次普攻造成基于自身最大生命值的额外伤害。',
        fire(W, h) {
          hpCost(h, 20); h.atkCd = 0;
          const aura = W.vfx.aura(h, { color: '#c8a0ff', glow: true, r: 1.2, dur: 5, particles: 10 });
          h.addBuff('mundoE', 5, { onHit(W, h, t) { W.damage(h, t, 50 * h.rk('E') + h.maxHp * 0.04, { type: 'phys' }); W.vfx.comic(t.pos, '咚!', { color: '#c8a0ff' }); h.removeBuff('mundoE'); aura.kill = true; } });
        } },
      { key: 'R', name: '背水一战', icon: '战', aim: 'self', cd: 70, wind: 0, anim: 'raise', animDur: 0.6, ai: 'low',
        desc: '10 秒内回复大量损失的生命，并获得移速加成。',
        fire(W, h) {
          const per = (h.maxHp - h.hp) * (0.35 + 0.05 * h.ranks.R) / 20;
          h.addBuff('mundoR', 10, { haste: 0.25, every: 0.5, tick: (me) => W.heal(me, per) });
          W.vfx.aura(h, { color: '#7dff7a', glow: true, r: 1.5, dur: 10, particles: 20, pcolor: '#c8ffb0' });
          W.vfx.comic(h.pos, '蒙多!', { color: '#c8a0ff', size: 3 });
        } },
    ],
  },
  // ======================= 娜美 =======================
  {
    id: 'nami', name: '娜美', title: '唤潮鲛姬', role: '辅助', color: '#3fa0b0',
    hp: 1000, ad: 52, range: 9, atkSpeed: 0.65, speed: 6.8, atkAnim: 'throw', atkProj: 'orb', projColor: '#6ad0ff', projSpeed: 24,
    projTrail: { color: '#8ae0ff', glow: true, size: 0.4, rate: 0.6 }, hitColor: '#8ae0ff',
    passive: '踏浪之行：技能作用到友方英雄时，使其获得 1.5 秒 20% 移速。',
    res: { mana: 380, cost: [60, 70, 50, 100], order: 'WEQ' }, sfx: ['orb', 'heal', 'magic', 'whoosh'], ind: [A(2), T(), T(), L(2.6, 30)],
    skills: [
      { key: 'Q', name: '碧波之牢', icon: '泡', aim: 'point', range: 9.5, cd: 10, wind: 0.25, anim: 'throw', animDur: 0.5, ai: 'hero',
        desc: '抛出一个水泡，落地后把范围内的敌人困在水泡里击飞 1.5 秒。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), dist = Math.max(1, distXZ(h.pos, aim));
          W.projectile({ from: h.tipPos(), dir: d, speed: 14, range: dist, arc: 2.5, team: h.team, owner: h, mesh: bubbleMesh(), trail: { color: '#8ae0ff', glow: true, size: 0.5 },
            onEnd: (p) => {
              const pos = { x: p.x, z: p.z };
              for (const u of W.enemiesIn(h.team, pos, 2)) {
                W.damage(h, u, 110 * h.rk('Q'), { type: 'magic' }); W.cc(u, 'knockup', 1.5, { height: 1.6 });
                W.vfx.bubble(u.pos, { color: '#8ad8ff', r: 1.3, dur: 1.5, opacity: 0.4, follow: u.pos, y: 2.2, fade: false });
              }
              W.vfx.ring(pos, { r1: 3, color: '#8ae0ff', dur: 0.4 }); W.vfx.puff(pos, { n: 14, color: '#bfe8ff', cell: 'puff', size: 0.8, speed: 3 });
            } });
        } },
      { key: 'W', name: '冲击之潮', icon: '潮', aim: 'ally', range: 8, cd: 9, wind: 0.2, anim: 'cast2', animDur: 0.45, ai: 'heal', allowSelf: true,
        desc: '释放一道水流：先治疗队友，再弹到附近的敌方英雄造成伤害，最后弹回另一名队友再次治疗。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.heal(t, 120 * h.rk('W')); namiSurf(t);
          W.vfx.puff(t.pos, { n: 10, color: '#8ae0ff', cell: 'glow', glow: true, size: 0.6, speed: 2, up: 1.5 });
          const foe = W.enemiesIn(h.team, t.pos, 8).find(notMinion);
          if (!foe) return;
          W.projectile({ from: V3(t.pos, 1.5), target: foe, speed: 22, team: h.team, owner: h, mesh: projMesh('orb', '#4ab0e0'), scale: 1.3, trail: { color: '#8ae0ff', glow: true, size: 0.7 },
            onHit: (e) => {
              W.damage(h, e, 100 * h.rk('W'), { type: 'magic' });
              const ally = W.alliesIn(h.team, e.pos, 8, true).find(a => a !== t);
              if (ally) W.projectile({ from: V3(e.pos, 1.5), target: ally, speed: 22, team: h.team, owner: h, mesh: projMesh('orb', '#6ad0ff'), trail: { color: '#8ae0ff', glow: true, size: 0.6 },
                onHit: (a) => { W.heal(a, 80 * h.rk('W')); namiSurf(a); } });
            } });
        } },
      { key: 'E', name: '唤潮之佑', icon: '佑', aim: 'ally', range: 9, cd: 11, wind: 0.1, anim: 'cast2', animDur: 0.4, ai: 'fight', allowSelf: true,
        desc: '祝福一名队友：它接下来的三次普攻附带魔法伤害并减速目标。',
        fire(W, h, aim, t) {
          if (!t) return;
          namiSurf(t); t.atkCd = 0;
          const aura = W.vfx.aura(t, { color: '#6ad0ff', glow: true, r: 1.2, dur: 6, particles: 14 });
          t.addBuff('namiE', 6, { n: 3, onHit(W, a, tt, b) {
            W.damage(h, tt, 40 * h.rk('E'), { type: 'magic' }); W.cc(tt, 'slow', 1, { pct: 0.3 });
            W.vfx.puff(tt.pos, { n: 6, color: '#8ae0ff', cell: 'puff', size: 0.5 });
            if (--b.n <= 0) { a.removeBuff('namiE'); aura.kill = true; }
          } });
        } },
      { key: 'R', name: '怒涛之啸', icon: '啸', aim: 'dir', range: 30, cd: 70, wind: 0.5, lock: 0.5, anim: 'raise', animDur: 0.8, ai: 'hero',
        desc: '召唤一道巨浪向前推进，击飞并减速沿途所有敌人，同时为接触到的友方英雄加速。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), boosted = new Set();
          W.projectile({ from: V3(h.pos, 0.5), dir: d, speed: 13, range: 30, radius: 2.6, pierce: true, team: h.team, owner: h, mesh: waveMesh(),
            trail: { color: '#bfe8ff', size: 1.2, rate: 0.9 },
            onStep: (p) => { for (const a of W.alliesIn(h.team, p.pos, 2.6, true)) if (!boosted.has(a)) { boosted.add(a); namiSurf(a); } },
            onHit: (u) => { W.damage(h, u, 200 * h.rk('R'), { type: 'magic' }); W.cc(u, 'knockup', 1, { height: 2.2 }); W.cc(u, 'slow', 2.5, { pct: 0.5 }); } });
          W.vfx.comic(h.pos, '怒涛!', { color: '#6ad0ff', size: 3 });
        } },
    ],
  },
];

// 卡特琳娜的匕首：落地后可以捡起
function dropDagger(W, h, pos, delay) {
  const p = W.clampDash(h.pos, pos);
  const m = daggerMesh();
  const d = { pos: { x: p.x, z: p.z }, ready: W.time + delay, until: W.time + delay + 4 };
  d.e = W.vfx.add(m, delay + 4, (k, dt, e) => {
    const t = Math.min(1, e.t / delay);
    m.position.set(p.x, 0.6 + Math.sin(t * Math.PI) * 4 * (1 - t) + (1 - t) * 0.5, p.z);
    m.rotation.x = t < 1 ? e.t * 12 : 0.15;
    if (t >= 1 && Math.random() < 0.15) W.vfx.trail({ x: p.x, y: 0.6, z: p.z }, { color: '#ff5a6a', glow: true, size: 0.5, vy: 1 });
  });
  (h.daggers = h.daggers || []).push(d);
}
