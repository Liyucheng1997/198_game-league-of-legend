// 十位英雄：属性、技能说明与技能实现（伤害、控制、特效）。
import * as THREE from 'three';
import { P, G, glowMat, clamp } from './toon-kit.js';
import { projMesh } from './vfx.js';
import { Pet } from './units.js';

const dirOf = (h, aim) => { const dx = aim.x - h.pos.x, dz = aim.z - h.pos.z, d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d }; };
const fwd = (h) => ({ x: Math.sin(h.facing), z: Math.cos(h.facing) });
const at = (p, d, k) => ({ x: p.x + d.x * k, z: p.z + d.z * k });
const rot = (d, a) => ({ x: d.x * Math.cos(a) + d.z * Math.sin(a), z: -d.x * Math.sin(a) + d.z * Math.cos(a) });
function inCone(W, h, dir, range, half) {
  return W.enemiesIn(h.team, h.pos, range).filter(u => {
    const dx = u.pos.x - h.pos.x, dz = u.pos.z - h.pos.z, d = Math.hypot(dx, dz) || 1;
    return (dx * dir.x + dz * dir.z) / d >= Math.cos(half);
  });
}
function lineHits(W, h, a, b, width, o) {
  return W.enemiesIn(h.team, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, Math.hypot(b.x - a.x, b.z - a.z) / 2 + width, o).filter(u => {
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
    const t = clamp(((u.pos.x - a.x) * dx + (u.pos.z - a.z) * dz) / L2);
    return Math.hypot(a.x + dx * t - u.pos.x, a.z + dz * t - u.pos.z) <= width + u.radius;
  });
}
const tip = (h) => h.tipPos();
const notMinion = (u) => u.kind !== 'minion';

// 从天而降的物体
function dropFromSky(W, pos, mesh, dur, onLand, h0 = 14) {
  mesh.position.set(pos.x, h0, pos.z);
  W.vfx.add(mesh, dur + 0.7, (k, dt, e) => {
    const t = e.t / dur;
    if (t <= 1) mesh.position.y = h0 * (1 - t * t);
    else if (!e.landed) { e.landed = true; mesh.position.y = 0; onLand && onLand(); }
    else mesh.scale.multiplyScalar(1 - dt * 1.5);
  });
}
// 剑尖朝下、原点在剑尖的巨剑
function bigSword(scale = 3) {
  const w = new THREE.Group();
  P(G.cone(0.08, 0.25, 4), '#fff4c0', { parent: w, pos: [0, 0.12, 0], rot: [Math.PI, Math.PI / 4, 0], s: [1, 1, 0.3], emissive: '#ffcf40', ei: 0.6 });
  P(G.cyl(0.13, 0.08, 1.4, 4), '#fff4c0', { parent: w, pos: [0, 0.95, 0], rot: [0, Math.PI / 4, 0], s: [1, 1, 0.3], emissive: '#ffcf40', ei: 0.6 });
  P(G.box(0.6, 0.1, 0.14), '#e8c25a', { parent: w, pos: [0, 1.7, 0] });
  P(G.cyl(0.045, 0.045, 0.4, 8), '#5a3b26', { parent: w, pos: [0, 1.95, 0] });
  P(G.sphere(), '#e8c25a', { parent: w, pos: [0, 2.2, 0], s: 0.09 });
  const halo = new THREE.Mesh(G.sphere(12, 8), glowMat('#ffe27a', 0.35)); halo.scale.set(0.5, 1.3, 0.5); halo.position.y = 1.0; w.add(halo);
  w.scale.setScalar(scale);
  return w;
}
function bigAxe(scale = 3) {
  const w = new THREE.Group();
  const g = new THREE.Group(); w.add(g);
  P(G.cyl(0.05, 0.05, 1.6, 8), '#3a2a22', { parent: g, pos: [0, 0.8, 0] });
  const blade = () => { const s = new THREE.Shape(); s.moveTo(0, 0.26); s.quadraticCurveTo(0.3, 0.3, 0.6, 0.55); s.quadraticCurveTo(0.9, 0, 0.6, -0.55); s.quadraticCurveTo(0.3, -0.3, 0, -0.26); s.closePath(); return s; };
  P(G.shape('dariusBlade', blade, 0.05, 0.02), '#d23a3a', { parent: g, pos: [0.4, 0.3, 0], emissive: '#a01010', ei: 0.5 });
  w.scale.setScalar(scale);
  return w;
}
function trapMesh() {
  const g = new THREE.Group();
  P(G.torus(0.45, 0.07, Math.PI * 2, 6, 16), '#6a5a7a', { parent: g, rot: [Math.PI / 2, 0, 0], pos: [0, 0.08, 0] });
  for (let i = 0; i < 8; i++) P(G.cone(0.06, 0.22, 4), '#e0e0e8', { parent: g, pos: [Math.cos(i * 0.785) * 0.45, 0.2, Math.sin(i * 0.785) * 0.45] });
  P(G.cyl(0.14, 0.14, 0.08, 10), '#e0b85a', { parent: g, pos: [0, 0.08, 0] });
  return g;
}
// 安妮被动：第 4 个技能附带晕眩
function annieStun(W, h, u) {
  if (h.annieReady) { W.cc(u, 'stun', 1.25); return true; }
  return false;
}

export const HEROES = [
  // ======================= 盖伦 =======================
  {
    id: 'garen', name: '盖伦', title: '德玛西亚之力', role: '战士', color: '#4d6fb8',
    hp: 1500, ad: 72, range: 1.6, atkSpeed: 0.75, speed: 7.1, atkAnim: 'slash', slashColor: '#dfe8ff',
    passive: '坚韧：一段时间未受伤后快速回复生命。',
    skills: [
      { key: 'Q', name: '致命打击', icon: '击', aim: 'self', cd: 8, wind: 0, anim: 'flex', animDur: 0.5, ai: 'fight',
        desc: '移速提升，下一次普攻造成额外伤害并沉默目标。',
        fire(W, h) {
          h.buffs = h.buffs.filter(b => !b.slow);
          h.addBuff('garenQhaste', 1.6, { haste: 0.35 });
          const aura = W.vfx.aura(h, { color: '#ffe27a', glow: true, r: 1.3, dur: 4.5, particles: 20 });
          h.addBuff('garenQ', 4.5, {
            onHit(W, h, t) {
              W.damage(h, t, 90 * h.rk('Q'), { type: 'phys' }); W.cc(t, 'silence', 1.5);
              W.vfx.comic(t.pos, '嘭!'); W.vfx.ring(t.pos, { r1: 2.5, color: '#ffe27a' }); W.vfx.shake(0.25);
              W.vfx.slash(t.pos, h.facing, { color: '#ffe27a', r: 2.6, tilt: 1.3 });
              h.removeBuff('garenQ'); aura.kill = true;
            },
          });
          W.vfx.puff(h.pos, { n: 10, color: '#ffe27a', cell: 'spark', glow: true, size: 0.7 });
        } },
      { key: 'W', name: '勇气', icon: '勇', aim: 'self', cd: 14, wind: 0, anim: 'flex', animDur: 0.5, ai: 'hurt',
        desc: '获得护盾与减伤，持续 3 秒。',
        fire(W, h) {
          W.shield(h, 260 * h.rk('W'), 3, '#ffe27a'); h.addBuff('garenW', 3, { dr: 0.3 });
          W.vfx.comic(h.pos, '勇!', { color: '#9fd0ff' }); W.vfx.ring(h.pos, { r1: 2.2, color: '#ffe27a' });
        } },
      { key: 'E', name: '审判', icon: '审', aim: 'self', cd: 9, wind: 0, lock: 0, anim: 'spin', animDur: 3, ai: 'close',
        desc: '挥剑旋转 3 秒，持续伤害周围敌人。可以边转边走。',
        fire(W, h) {
          h.addBuff('noAttack', 3); h.addBuff('garenE', 3, { haste: 0.1 });
          let n = 0;
          const tick = () => {
            if (h.dead || n++ >= 10) return;
            for (const u of W.enemiesIn(h.team, h.pos, 3.2)) W.damage(h, u, 34 * h.rk('E'), { type: 'phys' });
            W.vfx.slash(h.pos, h.facing + n * 2, { color: '#e8f0ff', r: 3.0, dur: 0.28, spin: 3.5, y: 1.0 });
            if (n % 2) W.vfx.ring(h.pos, { r0: 2, r1: 3.4, color: '#bcd4ff', dur: 0.3 });
            W.after(0.3, tick);
          };
          tick();
        } },
      { key: 'R', name: '德玛西亚正义', icon: '正', aim: 'unit', range: 8, cd: 40, wind: 0.45, anim: 'raise', animDur: 0.9, ai: 'execute',
        desc: '召唤巨剑从天而降，对目标造成大量伤害，目标损失生命越多伤害越高。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.vfx.disc(t.pos, { r: 2.4, color: '#ffe27a', dur: 0.5, follow: t.pos });
          const sword = bigSword(3.2);
          sword.position.set(t.pos.x, 0, t.pos.z);
          dropFromSky(W, t.pos, sword, 0.28, () => {
            W.damage(h, t, 240 * h.rk('R') + (t.maxHp - t.hp) * 0.3, { type: 'true', color: '#fff27a' });
            W.vfx.pillar(t.pos, { color: '#fff3a0', r: 2, h: 14 });
            W.vfx.ring(t.pos, { r1: 6, color: '#ffe27a', dur: 0.6 });
            W.vfx.puff(t.pos, { n: 20, color: '#ffe27a', cell: 'star', size: 0.8, speed: 7 });
            W.vfx.comic(t.pos, '正义!', { size: 3.2 }); W.vfx.shake(0.7);
          });
        } },
    ],
  },
  // ======================= 德莱厄斯 =======================
  {
    id: 'darius', name: '德莱厄斯', title: '诺克萨斯之手', role: '战士', color: '#a8232d',
    hp: 1520, ad: 74, range: 1.7, atkSpeed: 0.7, speed: 6.9, atkAnim: 'slash', slashColor: '#ffb0b0', hitColor: '#ff6a6a',
    passive: '出血：攻击与技能使敌人持续流血。',
    skills: [
      { key: 'Q', name: '大杀四方', icon: '杀', aim: 'self', cd: 7, wind: 0.55, lock: 0.55, anim: 'whirl', animDur: 0.85, ai: 'close',
        desc: '蓄力后挥动巨斧一周，斧刃命中造成更高伤害并回复生命。',
        fire(W, h) {
          let heroes = 0;
          for (const u of W.enemiesIn(h.team, h.pos, 4.8)) {
            const edge = h.dist(u) > 2.2;
            W.damage(h, u, (edge ? 130 : 70) * h.rk('Q'), { type: 'phys' });
            if (edge && u.kind === 'hero') heroes++;
            W.vfx.puff(u.pos, { n: 5, color: '#e0303a', cell: 'spark', glow: true, size: 0.6 });
          }
          if (heroes) W.heal(h, 60 * h.rk('Q') * heroes);
          W.vfx.ring(h.pos, { r0: 1.5, r1: 5.2, color: '#e0303a', dur: 0.45 });
          for (let i = 0; i < 4; i++) W.vfx.slash(h.pos, h.facing + i * Math.PI / 2, { color: '#ff5a5a', r: 4.4, dur: 0.35, spin: 2, y: 0.9 });
          W.vfx.comic(h.pos, '杀!', { color: '#ff5a5a' }); W.vfx.shake(0.25);
        } },
      { key: 'W', name: '致残打击', icon: '残', aim: 'self', cd: 6, wind: 0, anim: 'flex', animDur: 0.4, ai: 'close',
        desc: '下一次普攻造成额外伤害并大幅减速。',
        fire(W, h) {
          const aura = W.vfx.aura(h, { color: '#ff4a4a', glow: true, r: 1.2, dur: 4, particles: 15 });
          h.addBuff('dariusW', 4, { onHit(W, h, t) {
            W.damage(h, t, 70 * h.rk('W'), { type: 'phys' }); W.cc(t, 'slow', 1.5, { pct: 0.6 });
            W.vfx.slash(t.pos, h.facing, { color: '#ff4a4a', r: 2.4, tilt: 1.4 }); W.vfx.comic(t.pos, '砍!', { color: '#ff7a6a' });
            h.removeBuff('dariusW'); aura.kill = true;
          } });
        } },
      { key: 'E', name: '无情铁手', icon: '拽', aim: 'dir', range: 8, cd: 12, wind: 0.3, anim: 'thrust', animDur: 0.6, ai: 'enemy',
        desc: '向前方扇形区域伸出铁手，把敌人拽到身前并减速。',
        fire(W, h, aim) {
          const d = dirOf(h, aim);
          for (let i = -2; i <= 2; i++) {
            const dd = rot(d, i * 0.28);
            W.projectile({ from: new THREE.Vector3(h.pos.x, 1.2, h.pos.z), dir: dd, speed: 40, range: 8, team: h.team, owner: h, mesh: projMesh('shard', '#ff5a5a'), trail: { color: '#ff5a5a', glow: true, size: 0.5 } });
          }
          for (const u of inCone(W, h, d, 8, 0.6)) {
            W.displace(u, at(h.pos, d, 1.8), 0.25);
            W.cc(u, 'slow', 1.5, { pct: 0.4 });
            W.vfx.puff(u.pos, { n: 6, color: '#ff5a5a', cell: 'shard', size: 0.4 });
          }
        } },
      { key: 'R', name: '诺克萨斯断头台', icon: '断', aim: 'unit', range: 7, cd: 35, wind: 0.05, lock: 0.6, anim: 'leap', animDur: 0.7, ai: 'execute',
        desc: '跃向目标，巨斧劈下造成真实伤害；若击杀目标，技能立即刷新。',
        fire(W, h, aim, t) {
          if (!t) return;
          const d = dirOf(h, t.pos);
          W.dash(h, at(t.pos, d, -1.3), { dur: 0.42, arc: 3.5, anim: 'leap', trail: { color: '#ff4a4a', glow: true, size: 0.7 }, onEnd: () => {
            if (!t.targetable) return;
            h.rig.play('slam', 0.5);
            const axe = bigAxe(2.5); axe.rotation.y = h.facing;
            dropFromSky(W, t.pos, axe, 0.18, null, 7);
            W.damage(h, t, 220 * h.rk('R') + (t.maxHp - t.hp) * 0.35, { type: 'true', color: '#ff5a5a' });
            W.vfx.ring(t.pos, { r1: 5, color: '#ff3a3a', dur: 0.5 });
            W.vfx.puff(t.pos, { n: 18, color: ['#ff4a4a', '#2b1b14'], cell: 'shard', size: 0.6, speed: 7, grav: 10 });
            W.vfx.comic(t.pos, '断头台!', { color: '#ff5a5a', size: 3.2 }); W.vfx.shake(0.8);
            if (t.dead) { h.cds.R = 0; W.vfx.comic(h.pos, '再来!', { color: '#ffe27a', y: 4.5 }); }
          } });
        } },
    ],
  },
  // ======================= 艾希 =======================
  {
    id: 'ashe', name: '艾希', title: '寒冰射手', role: '射手', color: '#5d8fcf',
    hp: 1060, ad: 62, range: 10, atkSpeed: 0.75, speed: 6.8, atkAnim: 'bow', atkProj: 'arrow', projColor: '#9fdcff', projSpeed: 32,
    projTrail: { color: '#bfe8ff', glow: true, size: 0.35, rate: 0.6 }, hitColor: '#bfe8ff',
    passive: '冰霜射击：普攻会让敌人减速。',
    onHitSlow: true,
    skills: [
      { key: 'Q', name: '射手的专注', icon: '专', aim: 'self', cd: 12, wind: 0, anim: 'flex', animDur: 0.45, ai: 'fight',
        desc: '4 秒内攻速大幅提升，每次普攻额外射出冰箭。',
        fire(W, h) {
          W.vfx.aura(h, { color: '#9fdcff', glow: true, r: 1.3, dur: 4, particles: 25 });
          h.addBuff('asheQ', 4, { as: 0.9, onHit(W, h, t) {
            for (const s of [-1, 1]) {
              const d = rot(dirOf(h, t.pos), s * 0.12);
              W.projectile({ from: h.tipPos(), dir: d, speed: 34, range: 11, team: h.team, owner: h, mesh: projMesh('arrow', '#9fdcff'), onHit: (u) => W.damage(h, u, 18 * h.rk('Q'), { type: 'phys', noText: true }) });
            }
          } });
          W.vfx.comic(h.pos, '专注!', { color: '#9fdcff' });
        } },
      { key: 'W', name: '万箭齐发', icon: '箭', aim: 'dir', range: 11, cd: 6, wind: 0.32, anim: 'bow', animDur: 0.6, ai: 'enemy',
        desc: '扇形射出 9 支冰箭，造成伤害并减速。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), hit = new Set(), from = h.tipPos();
          for (let i = -4; i <= 4; i++) {
            W.projectile({ from, dir: rot(d, i * 0.11), speed: 32, range: 11, team: h.team, owner: h, radius: 0.5,
              mesh: projMesh('arrow', '#9fdcff'), trail: { color: '#cfefff', glow: true, size: 0.3, rate: 0.5 },
              onHit: (u) => { if (hit.has(u)) return; hit.add(u); W.damage(h, u, 75 * h.rk('W'), { type: 'phys' }); W.cc(u, 'slow', 2, { pct: 0.35, id: 'ice' }); W.vfx.puff(u.pos, { n: 5, color: '#cfefff', cell: 'shard', size: 0.35 }); } });
          }
        } },
      { key: 'E', name: '鹰击长空', icon: '鹰', aim: 'point', range: 40, cd: 10, wind: 0.2, anim: 'raise', animDur: 0.5, ai: 'never',
        desc: '放出一只冰晶之鹰飞向远方，照亮沿途区域。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), dist = Math.hypot(aim.x - h.pos.x, aim.z - h.pos.z);
          const hawk = new THREE.Group();
          P(G.sphere(), '#bfe8ff', { parent: hawk, s: [0.3, 0.25, 0.5], emissive: '#5fb6ff', ei: 0.6 });
          for (const s of [1, -1]) P(G.box(0.9, 0.04, 0.35), '#e6f7ff', { parent: hawk, pos: [s * 0.55, 0.05, 0], rot: [0, 0, s * 0.3], emissive: '#7fd0ff', ei: 0.5 });
          W.projectile({ from: new THREE.Vector3(h.pos.x, 3, h.pos.z), dir: d, speed: 26, range: dist, team: h.team, owner: h, mesh: hawk,
            trail: { color: '#bfe8ff', glow: true, cell: 'spark', size: 0.6 },
            onEnd: (p) => { W.vfx.ring(p, { r1: 8, color: '#9fdcff', dur: 1.2 }); W.vfx.puff(p, { n: 20, color: '#cfefff', cell: 'spark', glow: true, size: 0.8, speed: 5 }); } });
        } },
      { key: 'R', name: '魔法水晶箭', icon: '冰', aim: 'dir', range: 60, cd: 40, wind: 0.42, anim: 'bow', animDur: 0.9, ai: 'hero',
        desc: '射出一支巨大的寒冰箭，晕眩命中的第一位敌人（飞得越远晕得越久）。',
        fire(W, h, aim) {
          const d = dirOf(h, aim);
          W.vfx.comic(h.pos, '冰!', { color: '#9fdcff' });
          W.projectile({ from: h.tipPos(), dir: d, speed: 24, range: 60, radius: 1.1, team: h.team, owner: h, mesh: projMesh('bigArrow'), filter: notMinion,
            trail: { color: '#bfe8ff', glow: true, size: 1.4, cell: 'spark' },
            onHit: (u, p) => {
              const stun = Math.min(3.5, 1 + p.traveled / 15);
              W.damage(h, u, 260 * h.rk('R'), { type: 'magic' }); W.cc(u, 'stun', stun);
              for (const v of W.enemiesIn(h.team, u.pos, 3)) if (v !== u) { W.damage(h, v, 120 * h.rk('R'), { type: 'magic' }); W.cc(v, 'slow', 2, { pct: 0.5 }); }
              W.vfx.ring(u.pos, { r1: 4.5, color: '#9fdcff', dur: 0.6 });
              W.vfx.puff(u.pos, { n: 22, color: ['#cfefff', '#7fd0ff'], cell: 'shard', size: 0.6, speed: 6, grav: 8 });
              W.vfx.comic(u.pos, '冻!', { color: '#9fdcff', size: 3 }); W.vfx.shake(0.5);
            } });
        } },
    ],
  },
  // ======================= 凯特琳 =======================
  {
    id: 'caitlyn', name: '凯特琳', title: '皮城女警', role: '射手', color: '#6a45a8',
    hp: 1040, ad: 66, range: 12, atkSpeed: 0.7, speed: 6.8, atkAnim: 'shoot', atkProj: 'bullet', projColor: '#ffd76a', projSpeed: 40,
    projTrail: { color: '#ffe8a0', glow: true, size: 0.25, rate: 0.5 },
    passive: '爆头：每隔几次普攻造成额外伤害。',
    skills: [
      { key: 'Q', name: '和平使者', icon: '穿', aim: 'dir', range: 16, cd: 8, wind: 0.6, lock: 0.6, anim: 'shoot', animDur: 0.9, ai: 'enemy',
        desc: '瞄准后射出穿透子弹，贯穿直线上所有敌人。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), from = h.tipPos();
          let first = true;
          W.vfx.beam(from, at(from, d, 16), { width: 0.5, color: '#ffe27a', dur: 0.35 });
          W.vfx.puff(from, { n: 8, color: '#ffffff', cell: 'puff', size: 0.6, y: 0, speed: 2 });
          W.projectile({ from, dir: d, speed: 60, range: 16, radius: 0.8, pierce: true, team: h.team, owner: h, mesh: projMesh('bullet'),
            onHit: (u) => { W.damage(h, u, (first ? 160 : 100) * h.rk('Q'), { type: 'phys' }); first = false; W.vfx.spark(u.pos, '#ffe27a', 8); } });
          W.vfx.comic(from, '砰!', { y: 1.5 });
        } },
      { key: 'W', name: '约德尔诱捕器', icon: '夹', aim: 'point', range: 9, cd: 5, wind: 0.25, anim: 'throw', animDur: 0.5, ai: 'enemyNear',
        desc: '放置捕兽夹，敌人踩中后被禁锢并受到伤害。',
        fire(W, h, aim) {
          const m = trapMesh(); m.position.set(aim.x, 0, aim.z); W.scene.add(m);
          W.vfx.puff(aim, { n: 6, color: '#ffffff', cell: 'puff', size: 0.5, y: 0.2 });
          const z = W.zone({ pos: aim, r: 1, dur: 25, every: 0.1, team: h.team,
            onTick: (z) => {
              const u = W.enemiesIn(h.team, z.pos, 0.9).find(u => u.kind !== 'minion' || false);
              if (!u) return;
              W.cc(u, 'root', 1.5, { color: '#c8a0ff' }); W.damage(h, u, 120 * h.rk('W'), { type: 'magic' });
              W.vfx.comic(u.pos, '咔!', { color: '#c8a0ff' }); W.vfx.puff(u.pos, { n: 8, color: '#e0e0e8', cell: 'shard', size: 0.4 });
              z.dead = true; m.parent && m.parent.remove(m);
            },
            onEnd: () => { m.parent && m.parent.remove(m); } });
        } },
      { key: 'E', name: '90口径绳网', icon: '网', aim: 'dir', range: 9, cd: 10, wind: 0.15, anim: 'shoot', animDur: 0.5, ai: 'escape',
        desc: '向前发射绳网减速敌人，自己被后坐力向后弹开。',
        fire(W, h, aim) {
          const d = dirOf(h, aim);
          W.projectile({ from: h.tipPos(), dir: d, speed: 28, range: 9, radius: 1, team: h.team, owner: h, mesh: projMesh('net'), spin: 4,
            onHit: (u) => { W.damage(h, u, 90 * h.rk('E'), { type: 'magic' }); W.cc(u, 'slow', 1.5, { pct: 0.5 }); W.vfx.puff(u.pos, { n: 6, color: '#d8c9a0', cell: 'puff', size: 0.6 }); } });
          W.vfx.puff(h.pos, { n: 10, color: '#ffffff', cell: 'puff', size: 0.9, speed: 3, y: 0.5 });
          W.dash(h, at(h.pos, d, -5), { dur: 0.3, arc: 1.2, trail: { color: '#e0d8ff', size: 0.6 } });
          h.face(aim.x, aim.z);
        } },
      { key: 'R', name: '让子弹飞', icon: '狙', aim: 'unit', range: 22, cd: 40, wind: 1.1, lock: 1.1, anim: 'shoot', animDur: 1.5, ai: 'executeFar', heroOnly: false,
        desc: '锁定远处的敌人，瞄准片刻后射出致命一枪。',
        fire(W, h, aim, t) {
          if (!t || !t.targetable) return;
          const from = h.tipPos();
          W.vfx.puff(from, { n: 10, color: '#ffffff', cell: 'puff', size: 0.8, y: 0, speed: 3 });
          W.projectile({ from, target: t, speed: 70, team: h.team, owner: h, mesh: projMesh('bullet'), scale: 2, trail: { color: '#ffe27a', glow: true, size: 0.8 },
            onHit: (u) => { W.damage(h, u, 380 * h.rk('R'), { type: 'phys' }); W.vfx.comic(u.pos, '砰!!', { size: 3 }); W.vfx.ring(u.pos, { r1: 3, color: '#ffe27a' }); W.vfx.shake(0.4); } });
        },
        start(W, h, aim, t) {
          if (!t) return;
          W.vfx.disc(t.pos, { r: 1.6, color: '#ff4a4a', dur: 1.15, opacity: 0.9, spin: 3, follow: t.pos, hold: true });
          W.vfx.ring(t.pos, { r0: 4, r1: 1.2, color: '#ff4a4a', dur: 1.1, follow: t.pos });
          W.vfx.add(null, 1.1, () => { if (Math.random() < 0.5) W.vfx.trail({ x: t.pos.x, y: t.height + 0.8, z: t.pos.z }, { color: '#ff4a4a', glow: true, cell: 'spark', size: 0.7, vy: 0, life: 0.2 }); });
        },
      },
    ],
  },
  // ======================= 阿狸 =======================
  {
    id: 'ahri', name: '阿狸', title: '九尾妖狐', role: '法师', color: '#c93b4e',
    hp: 1040, ad: 56, range: 9, atkSpeed: 0.7, speed: 7.0, atkAnim: 'throw', atkProj: 'orb', projColor: '#c8a0ff', projSpeed: 24,
    projTrail: { color: '#d8b8ff', glow: true, size: 0.4, rate: 0.7 },
    passive: '摄魂夺魄：技能命中积累能量，回复生命。',
    skills: [
      { key: 'Q', name: '欺诈宝珠', icon: '珠', aim: 'dir', range: 9, cd: 6, wind: 0.25, anim: 'throw', animDur: 0.55, ai: 'enemy',
        desc: '掷出宝珠后收回，去程造成魔法伤害，回程造成真实伤害。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), trail = { color: '#9fc0ff', glow: true, size: 0.9, cell: 'glow' };
          W.projectile({ from: h.tipPos(), dir: d, speed: 22, range: 9, radius: 1.0, pierce: true, team: h.team, owner: h, mesh: projMesh('bigOrb', '#7fb7ff'), trail,
            onHit: (u) => W.damage(h, u, 75 * h.rk('Q'), { type: 'magic' }),
            onEnd: (p) => {
              W.projectile({ from: p.clone(), returnTo: h, speed: 26, radius: 1.0, pierce: true, team: h.team, owner: h, mesh: projMesh('bigOrb', '#ff9ad0'), trail: { ...trail, color: '#ffb0e0' },
                onHit: (u) => W.damage(h, u, 75 * h.rk('Q'), { type: 'true' }), onEnd: () => W.vfx.spark(h.pos, '#ffb0e0', 6) });
            } });
        } },
      { key: 'W', name: '妖异狐火', icon: '火', aim: 'self', cd: 8, wind: 0.05, anim: 'twirl', animDur: 0.6, ai: 'close',
        desc: '召唤三团狐火环绕自身，随后自动追击附近敌人。',
        fire(W, h) {
          for (let i = 0; i < 3; i++) {
            const m = projMesh('orb', '#6ab0ff'); m.scale.setScalar(1.4);
            let launched = false;
            W.vfx.add(m, 3, (k, dt, e) => {
              const a = W.time * 5 + i * 2.094;
              m.position.set(h.pos.x + Math.cos(a) * 1.4, 1.4 + Math.sin(a * 2) * 0.2, h.pos.z + Math.sin(a) * 1.4);
              if (Math.random() < 0.5) W.vfx.trail(m.position, { color: '#8ac0ff', glow: true, size: 0.5 });
              if (!launched && e.t > 0.35 + i * 0.12) {
                const t = W.nearestEnemy(h.team, h.pos, 7, u => u.kind === 'hero') || W.nearestEnemy(h.team, h.pos, 7);
                if (t) {
                  launched = true; e.kill = true;
                  W.projectile({ from: m.position.clone(), target: t, speed: 20, team: h.team, owner: h, mesh: projMesh('orb', '#6ab0ff'), trail: { color: '#8ac0ff', glow: true, size: 0.6 },
                    onHit: (u) => { W.damage(h, u, 55 * h.rk('W'), { type: 'magic' }); W.vfx.spark(u.pos, '#8ac0ff', 6); } });
                }
              }
            });
          }
          h.addBuff('ahriW', 1.5, { haste: 0.35 });
        } },
      { key: 'E', name: '魅惑妖术', icon: '魅', aim: 'dir', range: 10, cd: 12, wind: 0.2, anim: 'cast2', animDur: 0.5, ai: 'hero',
        desc: '送出一个飞吻，魅惑第一个命中的敌人，使其朝阿狸走来。',
        fire(W, h, aim) {
          const d = dirOf(h, aim);
          W.projectile({ from: h.tipPos(), dir: d, speed: 22, range: 10, radius: 0.8, team: h.team, owner: h, mesh: projMesh('heart'), trail: { color: '#ff8ac0', cell: 'heart', size: 0.5, rate: 0.5 },
            onHit: (u) => {
              W.damage(h, u, 85 * h.rk('E'), { type: 'magic' }); W.cc(u, 'charm', 1.4, { src: h });
              W.vfx.puff(u.pos, { n: 10, color: '#ff8ac0', cell: 'heart', size: 0.6, speed: 2, up: 1.5, y: 2 });
              W.vfx.comic(u.pos, '魅!', { color: '#ff8ac0' });
            } });
        } },
      { key: 'R', name: '灵魄突袭', icon: '袭', aim: 'dir', range: 6, cd: 1, wind: 0, lock: 0.2, anim: 'twirl', animDur: 0.35, ai: 'fightFar',
        desc: '最多三段的冲刺，每次冲刺后向附近敌人射出三道精魄。',
        fire(W, h, aim) {
          const d = dirOf(h, aim);
          const st = h.ahriR && W.time < h.ahriR.until ? h.ahriR : (h.ahriR = { left: 3, until: W.time + 10 });
          st.left--;
          h.cds.R = st.left > 0 ? 1.0 : 35;
          if (st.left > 0) W.after(10.05, () => { if (h.ahriR === st && st.left > 0) { st.left = 0; h.cds.R = 25; } });
          W.dash(h, at(h.pos, d, 5), { dur: 0.2, trail: { color: '#ff9ad0', glow: true, size: 0.9, cell: 'glow' }, onEnd: () => {
            const ts = W.enemiesIn(h.team, h.pos, 7).sort((a, b) => (b.kind === 'hero') - (a.kind === 'hero') || h.dist(a) - h.dist(b)).slice(0, 3);
            ts.forEach((t, i) => W.projectile({ from: new THREE.Vector3(h.pos.x, 1.5, h.pos.z), target: t, speed: 24, team: h.team, owner: h, mesh: projMesh('orb', '#ff9ad0'), trail: { color: '#ffb0e0', glow: true, size: 0.5 },
              onHit: (u) => W.damage(h, u, 65 * h.rk('R'), { type: 'magic' }) }));
          } });
          W.vfx.puff(h.pos, { n: 10, color: '#ffb0e0', cell: 'spark', glow: true, size: 0.7 });
        } },
    ],
  },
  // ======================= 拉克丝 =======================
  {
    id: 'lux', name: '拉克丝', title: '光辉女郎', role: '法师', color: '#4a78cf',
    hp: 1000, ad: 54, range: 9.5, atkSpeed: 0.65, speed: 6.9, atkAnim: 'throw', atkProj: 'orb', projColor: '#fff38a', projSpeed: 24,
    projTrail: { color: '#fff7c0', glow: true, size: 0.4, rate: 0.7 },
    passive: '光芒四射：技能命中后，下一次普攻引爆额外伤害。',
    skills: [
      { key: 'Q', name: '光之束缚', icon: '缚', aim: 'dir', range: 12, cd: 9, wind: 0.25, anim: 'cast2', animDur: 0.55, ai: 'hero',
        desc: '射出光球，禁锢最多两个敌人。',
        fire(W, h, aim) {
          const d = dirOf(h, aim);
          W.projectile({ from: h.tipPos(), dir: d, speed: 26, range: 12, radius: 0.8, pierce: true, maxHits: 2, team: h.team, owner: h, mesh: projMesh('bigOrb', '#fff38a'), trail: { color: '#fff7c0', glow: true, size: 0.9 },
            onHit: (u) => {
              W.damage(h, u, 85 * h.rk('Q'), { type: 'magic' }); W.cc(u, 'root', 1.6, { color: '#fff38a' });
              W.vfx.add(null, 1.6, () => { if (Math.random() < 0.4) W.vfx.trail({ x: u.pos.x + (Math.random() - 0.5), y: Math.random() * 2, z: u.pos.z + (Math.random() - 0.5) }, { color: '#fff38a', glow: true, cell: 'spark', size: 0.5, vy: 1 }); });
            } });
        } },
      { key: 'W', name: '曲光屏障', icon: '屏', aim: 'dir', range: 10, cd: 12, wind: 0.2, anim: 'throw', animDur: 0.5, ai: 'hurt',
        desc: '掷出魔杖后收回，为自己和途经的队友提供护盾。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), got = new Set([h]);
          W.shield(h, 150 * h.rk('W'), 2.5, '#fff38a');
          const step = (p) => { for (const a of W.alliesIn(h.team, p.pos, 1.5, true)) if (!got.has(a)) { got.add(a); W.shield(a, 150 * h.rk('W'), 2.5, '#fff38a'); } };
          W.projectile({ from: h.tipPos(), dir: d, speed: 20, range: 10, team: h.team, owner: h, mesh: projMesh('wand'), spin: 10, trail: { color: '#bfe0ff', glow: true, size: 0.9 }, onStep: step,
            onEnd: (p) => W.projectile({ from: p.clone(), returnTo: h, speed: 20, team: h.team, owner: h, mesh: projMesh('wand'), spin: 10, trail: { color: '#bfe0ff', glow: true, size: 0.9 }, onStep: step }) });
        } },
      { key: 'E', name: '透光奇点', icon: '点', aim: 'point', range: 11, cd: 10, wind: 0.25, anim: 'throw', animDur: 0.5, ai: 'enemy',
        desc: '抛出光之奇点，减速区域内敌人，2.5 秒后爆炸造成伤害。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), dist = Math.max(1, Math.hypot(aim.x - h.pos.x, aim.z - h.pos.z));
          W.projectile({ from: h.tipPos(), dir: d, speed: 22, range: dist, team: h.team, owner: h, mesh: projMesh('bigOrb', '#fffbd0'), arc: 2, trail: { color: '#fff7c0', glow: true, size: 0.7 },
            onEnd: (p) => {
              const pos = { x: p.x, z: p.z };
              const disc = W.vfx.disc(pos, { r: 3.2, color: '#fff38a', dur: 2.5, opacity: 0.7, spin: 1.5, hold: true, glow: true });
              const orb = projMesh('bigOrb', '#fffbd0'); orb.position.set(pos.x, 0.8, pos.z); W.vfx.add(orb, 2.5, (k, dt, e) => orb.scale.setScalar(1 + Math.sin(e.t * 10) * 0.1));
              W.zone({ pos, r: 3.2, dur: 2.5, every: 0.25, team: h.team,
                onTick: () => { for (const u of W.enemiesIn(h.team, pos, 3.2)) W.cc(u, 'slow', 0.3, { pct: 0.45, id: 'luxE' }); },
                onEnd: () => {
                  for (const u of W.enemiesIn(h.team, pos, 3.4)) W.damage(h, u, 130 * h.rk('E'), { type: 'magic' });
                  W.vfx.ring(pos, { r1: 4.5, color: '#fff38a', dur: 0.5 }); W.vfx.puff(pos, { n: 26, color: '#fff38a', cell: 'spark', glow: true, size: 1.0, speed: 7 });
                  W.vfx.bubble(pos, { color: '#fffbd0', r0: 1, r1: 3.6, dur: 0.4, opacity: 0.5, y: 0.5 });
                  W.vfx.comic(pos, '爆!', { color: '#fff38a' });
                } });
            } });
        } },
      { key: 'R', name: '终极闪光', icon: '光', aim: 'dir', range: 30, cd: 30, wind: 0.85, lock: 0.9, anim: 'cast2', animDur: 1.4, ai: 'hero',
        desc: '蓄力片刻后射出一道横贯战场的巨型光束。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), from = h.tipPos(), a = { x: h.pos.x, z: h.pos.z }, b = at(a, d, 30);
          W.vfx.beam(from, at(from, d, 30), { width: 1.8, color: '#fff38a', dur: 0.9, y: 1.2 });
          for (const u of lineHits(W, h, a, b, 1.6)) { W.damage(h, u, 320 * h.rk('R'), { type: 'magic' }); W.vfx.spark(u.pos, '#fff38a', 10, 1); }
          for (let i = 0; i < 30; i += 1.5) W.vfx.puff(at(a, d, i), { n: 2, color: '#fff7c0', cell: 'spark', glow: true, size: 0.9, speed: 3 });
          W.vfx.comic(from, '闪!', { color: '#fff38a', size: 3 }); W.vfx.shake(0.5);
        },
        start(W, h, aim) {
          const d = dirOf(h, aim), from = new THREE.Vector3(h.pos.x, 0.2, h.pos.z);
          W.vfx.beam(from, at(from, d, 30), { width: 0.35, color: '#fff7c0', dur: 0.85, y: 0.15 });
          W.vfx.puff(h.pos, { n: 14, color: '#fff38a', cell: 'spark', glow: true, size: 0.7, speed: -2, spread: 2.5 });
        },
      },
    ],
  },
  // ======================= 安妮 =======================
  {
    id: 'annie', name: '安妮', title: '黑暗之女', role: '法师', color: '#e8739b',
    hp: 1000, ad: 52, range: 8.5, atkSpeed: 0.65, speed: 6.7, atkAnim: 'throw', atkProj: 'fire', projSpeed: 22,
    projTrail: { color: '#ff9a40', glow: true, size: 0.5, rate: 0.8 }, hitColor: '#ffb040',
    passive: '嗜火：每施放 4 个技能，下一个伤害技能会晕眩敌人。',
    onCast(W, h) {
      h.annieStacks = (h.annieStacks || 0) + 1;
      if (h.annieStacks >= 4 && !h.annieReady) {
        h.annieReady = true;
        h.annieAura = W.vfx.aura(h, { color: '#ffffff', glow: true, r: 1.2, dur: 999, particles: 12, pcolor: '#ffe0a0' });
      }
    },
    skills: [
      { key: 'Q', name: '碎裂之火', icon: '碎', aim: 'unit', range: 8.5, cd: 4, wind: 0.25, anim: 'throw', animDur: 0.5, ai: 'enemy',
        desc: '向目标扔出火球。',
        fire(W, h, aim, t) {
          if (!t) return;
          const stun = consume(h);
          W.projectile({ from: h.tipPos(), target: t, speed: 22, team: h.team, owner: h, mesh: projMesh('fire'), scale: 1.3, trail: { color: '#ff8a30', glow: true, size: 0.8 },
            onHit: (u) => { W.damage(h, u, 115 * h.rk('Q'), { type: 'magic' }); if (stun) W.cc(u, 'stun', 1.25); W.vfx.puff(u.pos, { n: 10, color: ['#ffcf4a', '#ff6a2a'], cell: 'flame', size: 0.7, speed: 3 }); } });
        } },
      { key: 'W', name: '焚烧', icon: '焚', aim: 'dir', range: 7, cd: 7, wind: 0.25, anim: 'cast2', animDur: 0.55, ai: 'enemy',
        desc: '向前方扇形区域喷出烈焰。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), stun = consume(h);
          for (const u of inCone(W, h, d, 7, 0.45)) { W.damage(h, u, 125 * h.rk('W'), { type: 'magic' }); if (stun) W.cc(u, 'stun', 1.25); }
          for (let i = 0; i < 40; i++) {
            const dd = rot(d, (Math.random() - 0.5) * 0.9), sp = 10 + Math.random() * 6;
            W.vfx.glow.spawn({ x: h.pos.x + d.x, y: 1.2, z: h.pos.z + d.z, vx: dd.x * sp, vy: Math.random() * 1.5, vz: dd.z * sp, color: i % 2 ? '#ff8a30' : '#ffcf4a', size: 1.4, life: 0.5, cell: 0, drag: 2.2, grow: 1 });
            if (i % 3 === 0) W.vfx.ink.spawn({ x: h.pos.x + d.x, y: 1.2, z: h.pos.z + d.z, vx: dd.x * sp * 0.8, vy: 1, vz: dd.z * sp * 0.8, color: i % 2 ? '#ff6a2a' : '#ffcf4a', size: 0.8, life: 0.5, cell: 6, drag: 2 });
          }
          W.vfx.comic(at(h.pos, d, 4), '呼!', { color: '#ff8a30' });
        } },
      { key: 'E', name: '熔岩护盾', icon: '盾', aim: 'self', cd: 10, wind: 0, anim: 'flex', animDur: 0.45, ai: 'hurt',
        desc: '获得火焰护盾与短暂加速。',
        fire(W, h) {
          W.shield(h, 190 * h.rk('E'), 3, '#ff9a40'); h.addBuff('annieE', 1.5, { haste: 0.3 });
          W.vfx.add(null, 3, () => { if (Math.random() < 0.5) { const a = W.time * 6 + Math.random(); W.vfx.trail({ x: h.pos.x + Math.cos(a) * 1.2, y: 0.6 + Math.random() * 1.5, z: h.pos.z + Math.sin(a) * 1.2 }, { color: '#ff8a30', cell: 'flame', size: 0.45, vy: 1.2 }); } });
        } },
      { key: 'R', name: '提伯斯之怒', icon: '熊', aim: 'point', range: 8, cd: 45, wind: 0.3, anim: 'raise', animDur: 0.7, ai: 'hero',
        desc: '召唤巨熊提伯斯砸向地面，之后它会为安妮战斗 20 秒。',
        fire(W, h, aim) {
          const stun = consume(h);
          for (const u of W.enemiesIn(h.team, aim, 3.5)) { W.damage(h, u, 180 * h.rk('R'), { type: 'magic' }); if (stun) W.cc(u, 'stun', 1.25); }
          W.vfx.ring(aim, { r1: 5, color: '#ff8a30', dur: 0.5 });
          W.vfx.puff(aim, { n: 26, color: ['#ffcf4a', '#ff6a2a', '#ff3a1a'], cell: 'flame', size: 1.2, speed: 6 });
          W.vfx.puff(aim, { n: 12, color: '#ffffff', cell: 'puff', size: 1.5, speed: 3 });
          W.vfx.comic(aim, '提伯斯!', { color: '#ff8a30', size: 3.2 }); W.vfx.shake(0.6);
          if (h.tibbers && !h.tibbers.dead) h.tibbers.die();
          const p = W.clampDash(h.pos, aim);
          h.tibbers = W.add(new Pet(W, h, p.x, p.z));
          h.tibbers.facing = h.facing;
        } },
    ],
  },
  // ======================= 易 =======================
  {
    id: 'yi', name: '易', title: '无极剑圣', role: '刺客', color: '#d6a646',
    hp: 1250, ad: 70, range: 1.6, atkSpeed: 0.85, speed: 7.3, atkAnim: ['hslash', 'hslashBack'], hSlash: true, slashColor: '#d8ffb0', hitColor: '#c8ff8a',
    passive: '双重打击：每第四次普攻会连击两次。',
    skills: [
      { key: 'Q', name: '阿尔法突袭', icon: '突', aim: 'unit', range: 7, cd: 10, wind: 0, lock: 1.0, ai: 'enemy',
        desc: '化为剑光在附近敌人之间穿梭斩击，期间无法被选中。',
        fire(W, h, aim, t) {
          if (!t) return;
          const list = [t, ...W.enemiesIn(h.team, t.pos, 6).filter(u => u !== t)].slice(0, 4);
          h.addBuff('untargetable', 1.0); h.addBuff('channel', 1.0);
          h.obj.visible = false;
          W.vfx.puff(h.pos, { n: 12, color: '#c8ff8a', cell: 'spark', glow: true, size: 0.8 });
          list.forEach((u, i) => W.after(0.2 * i + 0.05, () => {
            if (!u.targetable) return;
            const a = Math.random() * 6.28;
            W.vfx.slash(u.pos, a, { color: '#c8ff8a', r: 2.6, dur: 0.25, tilt: (Math.random() - 0.5) * 1.5 });
            W.vfx.puff(u.pos, { n: 6, color: '#d8ffb0', cell: 'spark', glow: true, size: 0.6, speed: 4 });
            W.damage(h, u, 95 * h.rk('Q'), { type: 'phys' });
            h.pos.x = u.pos.x + Math.cos(a) * 1.2; h.pos.z = u.pos.z + Math.sin(a) * 1.2;
            h.face(u.pos.x, u.pos.z); h.facing = h.faceTarget;
          }));
          W.after(0.95, () => { h.obj.visible = true; W.vfx.puff(h.pos, { n: 10, color: '#c8ff8a', cell: 'spark', glow: true, size: 0.8 }); h.rig.play('slash', 0.4); });
          W.vfx.comic(t.pos, '斩!', { color: '#c8ff8a' });
        } },
      { key: 'W', name: '冥想', icon: '冥', aim: 'self', cd: 14, wind: 0, lock: 2.5, anim: 'channel', animDur: 2.5, ai: 'low',
        desc: '盘坐冥想 2.5 秒，快速回复生命并大幅减少所受伤害。',
        fire(W, h) {
          h.addBuff('yiW', 2.5, { dr: 0.55, every: 0.5, tick: (u) => W.heal(u, 55 * h.rk('W')) });
          h.addBuff('channel', 2.5);
          W.vfx.aura(h, { color: '#c8ff8a', glow: true, r: 1.6, dur: 2.5, particles: 20, pcolor: '#e0ffc0' });
          W.vfx.bubble(h.pos, { color: '#c8ff8a', r: 1.6, dur: 2.5, opacity: 0.2, follow: h.pos, y: 1.3, fade: false });
        } },
      { key: 'E', name: '无极剑道', icon: '道', aim: 'self', cd: 12, wind: 0, anim: 'flex', animDur: 0.4, ai: 'fight',
        desc: '5 秒内普攻附带额外真实伤害。',
        fire(W, h) {
          W.vfx.aura(h, { color: '#ffe27a', glow: true, r: 1.1, dur: 5, particles: 18 });
          h.addBuff('yiE', 5, { onHit(W, h, t) { W.damage(h, t, 32 * h.rk('E'), { type: 'true' }); W.vfx.spark(t.pos, '#ffe27a', 5); } });
        } },
      { key: 'R', name: '高原血统', icon: '血', aim: 'self', cd: 35, wind: 0, anim: 'flex', animDur: 0.6, ai: 'fight',
        desc: '8 秒内移动速度与攻击速度大幅提升。',
        fire(W, h) {
          h.addBuff('yiR', 8, { haste: 0.45, as: 0.6 });
          h.buffs = h.buffs.filter(b => !b.slow);
          W.vfx.aura(h, { color: '#c88aff', glow: true, r: 1.5, dur: 8, particles: 30, pcolor: '#e0c0ff' });
          W.vfx.comic(h.pos, '高原!', { color: '#c88aff' }); W.vfx.ring(h.pos, { r1: 3.5, color: '#c88aff' });
        } },
    ],
  },
  // ======================= 墨菲特 =======================
  {
    id: 'malphite', name: '墨菲特', title: '熔岩巨兽', role: '坦克', color: '#8d8174',
    hp: 1700, ad: 66, range: 1.8, atkSpeed: 0.7, speed: 6.7, atkAnim: 'punch', hitColor: '#ffb347', radius: 0.9,
    passive: '花岗岩护盾：一段时间未受伤后获得护盾。',
    skills: [
      { key: 'Q', name: '地震碎片', icon: '碎', aim: 'unit', range: 9, cd: 7, wind: 0.25, anim: 'throw', animDur: 0.55, ai: 'enemy',
        desc: '掷出大地碎片，造成伤害并偷取目标的移动速度。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.projectile({ from: h.tipPos(), target: t, speed: 20, team: h.team, owner: h, mesh: projMesh('rock'), spin: 8, trail: { color: '#b0a090', size: 0.6 },
            onHit: (u) => {
              W.damage(h, u, 115 * h.rk('Q'), { type: 'magic' }); W.cc(u, 'slow', 2, { pct: 0.4 }); h.addBuff('malphQ', 2, { haste: 0.3 });
              W.vfx.puff(u.pos, { n: 10, color: ['#8d8174', '#ffb347'], cell: 'shard', size: 0.5, speed: 5, grav: 10 });
            } });
        } },
      { key: 'W', name: '雷霆拍击', icon: '雷', aim: 'self', cd: 9, wind: 0, anim: 'flex', animDur: 0.45, ai: 'close',
        desc: '5 秒内普攻会在目标周围引发雷霆冲击，溅射伤害。',
        fire(W, h) {
          W.vfx.aura(h, { color: '#ffb347', glow: true, r: 1.5, dur: 5, particles: 12 });
          h.addBuff('malphW', 5, { onHit(W, h, t) {
            for (const u of W.enemiesIn(h.team, t.pos, 3.2)) W.damage(h, u, 45 * h.rk('W'), { type: 'phys', noText: u !== t });
            W.vfx.ring(t.pos, { r1: 3.4, color: '#ffe27a', dur: 0.35 }); W.vfx.spark(t.pos, '#ffe27a', 10, 0.8);
            W.vfx.comic(t.pos, '啪!', { color: '#ffe27a', size: 1.8 });
          } });
        } },
      { key: 'E', name: '巨像重击', icon: '砸', aim: 'self', cd: 7, wind: 0.45, lock: 0.45, anim: 'slam', animDur: 0.8, ai: 'close',
        desc: '猛砸地面，伤害并减速周围敌人。',
        fire(W, h) {
          for (const u of W.enemiesIn(h.team, h.pos, 4.2)) { W.damage(h, u, 125 * h.rk('E'), { type: 'magic' }); W.cc(u, 'slow', 2, { pct: 0.3 }); }
          W.vfx.ring(h.pos, { r1: 5, color: '#c8b090', dur: 0.45 });
          W.vfx.disc(h.pos, { r: 4.2, color: '#8d8174', dur: 0.7, opacity: 0.6 });
          W.vfx.puff(h.pos, { n: 18, color: ['#8d8174', '#b0a090'], cell: 'shard', size: 0.6, speed: 7, grav: 12, up: 1.5, y: 0.3 });
          W.vfx.puff(h.pos, { n: 10, color: '#e8dcc0', cell: 'puff', size: 1.3, speed: 4, y: 0.3 });
          W.vfx.shake(0.35); W.vfx.comic(h.pos, '咚!', { color: '#ffb347' });
        } },
      { key: 'R', name: '势不可挡', icon: '冲', aim: 'point', range: 11, cd: 40, wind: 0.1, lock: 0.6, anim: 'leap', animDur: 0.6, ai: 'hero',
        desc: '化身为不可阻挡的巨石冲向目标区域，击飞范围内所有敌人。',
        fire(W, h, aim) {
          W.dash(h, aim, { dur: 0.45, anim: 'leap', trail: { color: '#b0a090', size: 1.2 }, during: () => { if (Math.random() < 0.6) W.vfx.puff(h.pos, { n: 1, color: '#ffb347', cell: 'shard', size: 0.5, speed: 3, y: 0.3 }); }, onEnd: () => {
            h.rig.play('slam', 0.5);
            for (const u of W.enemiesIn(h.team, h.pos, 3.8)) { W.damage(h, u, 230 * h.rk('R'), { type: 'magic' }); W.cc(u, 'knockup', 1.4, { height: 3 }); }
            W.vfx.ring(h.pos, { r1: 7, color: '#ffb347', dur: 0.6 });
            W.vfx.ring(h.pos, { r0: 1, r1: 4.5, color: '#fff3a0', dur: 0.4, glow: true });
            W.vfx.disc(h.pos, { r: 3.8, color: '#6f655b', dur: 1.5, opacity: 0.7 });
            W.vfx.puff(h.pos, { n: 30, color: ['#8d8174', '#ffb347', '#6f655b'], cell: 'shard', size: 0.8, speed: 9, grav: 14, up: 2, y: 0.3 });
            W.vfx.puff(h.pos, { n: 14, color: '#e8dcc0', cell: 'puff', size: 2, speed: 5, y: 0.3 });
            W.vfx.comic(h.pos, '轰隆!', { color: '#ffb347', size: 3.4 }); W.vfx.shake(1.0);
          } });
        } },
    ],
  },
  // ======================= 索拉卡 =======================
  {
    id: 'soraka', name: '索拉卡', title: '众星之子', role: '辅助', color: '#5fae6e',
    hp: 1060, ad: 50, range: 8.5, atkSpeed: 0.65, speed: 6.9, atkAnim: 'throw', atkProj: 'star', projSpeed: 22,
    projTrail: { color: '#ffe36a', glow: true, size: 0.4, rate: 0.6 }, hitColor: '#ffe36a',
    passive: '救赎：朝濒死的队友移动时获得加速。',
    skills: [
      { key: 'Q', name: '星落', icon: '星', aim: 'point', range: 10, cd: 5, wind: 0.2, anim: 'raise', animDur: 0.5, ai: 'enemy',
        desc: '召唤流星坠落，伤害并减速敌人；命中英雄会治疗自己。',
        fire(W, h, aim) {
          const pos = { x: aim.x, z: aim.z };
          W.vfx.disc(pos, { r: 2.6, color: '#ffe36a', dur: 0.5, opacity: 0.6 });
          const star = projMesh('star'); star.scale.setScalar(1.4);
          dropFromSky(W, pos, star, 0.42, () => {
            let hero = false;
            for (const u of W.enemiesIn(h.team, pos, 2.6)) { W.damage(h, u, 105 * h.rk('Q'), { type: 'magic' }); W.cc(u, 'slow', 2, { pct: 0.3 }); if (u.kind === 'hero' || u.kind === 'dummy') hero = true; }
            if (hero) W.heal(h, 60 * h.rk('Q'));
            W.vfx.ring(pos, { r1: 3.4, color: '#ffe36a', dur: 0.4 });
            W.vfx.puff(pos, { n: 16, color: ['#ffe36a', '#ffffff'], cell: 'star', size: 0.55, speed: 5, y: 0.3 });
            W.vfx.spark(pos, '#fff7b0', 10, 1);
            star.visible = false;
          }, 16);
        } },
      { key: 'W', name: '星之灌注', icon: '愈', aim: 'ally', range: 8, cd: 5, wind: 0.15, anim: 'cast2', animDur: 0.5, ai: 'heal', allowSelf: true,
        desc: '为一名友方英雄回复大量生命（没有队友时治疗自己）。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.heal(t, 210 * h.rk('W'));
          if (t !== h) W.vfx.beam(h.tipPos(), new THREE.Vector3(t.pos.x, 1.3, t.pos.z), { width: 0.6, color: '#7dff9a', dur: 0.5 });
          W.vfx.puff(t.pos, { n: 14, color: ['#7dff9a', '#ffffff'], cell: 'leaf', size: 0.55, speed: 2, up: 1.5 });
          W.vfx.pillar(t.pos, { color: '#9dffa0', r: 1, h: 5, dur: 0.6 });
        } },
      { key: 'E', name: '星体结界', icon: '界', aim: 'point', range: 9, cd: 14, wind: 0.2, anim: 'throw', animDur: 0.5, ai: 'enemy',
        desc: '在目标区域创造结界，沉默其中的敌人；结界消失时禁锢仍在内的敌人。',
        fire(W, h, aim) {
          const pos = { x: aim.x, z: aim.z };
          W.vfx.disc(pos, { r: 3.5, color: '#c8a0ff', dur: 1.6, opacity: 0.8, spin: 2, hold: true });
          W.vfx.ring(pos, { r0: 3.4, r1: 3.6, color: '#ffe36a', dur: 1.6 });
          W.zone({ pos, r: 3.5, dur: 1.5, every: 0.25, team: h.team,
            onTick: () => { for (const u of W.enemiesIn(h.team, pos, 3.5)) W.cc(u, 'silence', 0.35); if (Math.random() < 0.8) W.vfx.puff(pos, { n: 2, color: '#e0c8ff', cell: 'star', size: 0.4, speed: 2, spread: 3 }); },
            onEnd: () => {
              for (const u of W.enemiesIn(h.team, pos, 3.5)) { W.cc(u, 'root', 1.4, { color: '#c8a0ff' }); W.damage(h, u, 80 * h.rk('E'), { type: 'magic' }); }
              W.vfx.ring(pos, { r1: 4.5, color: '#c8a0ff', dur: 0.5 }); W.vfx.spark(pos, '#e0c8ff', 16, 1);
            } });
        } },
      { key: 'R', name: '祈愿', icon: '愿', aim: 'self', cd: 50, wind: 0.4, anim: 'raise', animDur: 1.2, ai: 'team',
        desc: '向群星祈愿，治疗全地图所有友方英雄。',
        fire(W, h) {
          const allies = W.units.filter(u => u.kind === 'hero' && u.team === h.team && !u.dead);
          for (const a of allies) {
            W.heal(a, 260 * h.rk('R'));
            W.vfx.pillar(a.pos, { color: '#fff7b0', r: 1.6, h: 16, dur: 1 });
            W.vfx.puff(a.pos, { n: 16, color: ['#ffe36a', '#ffffff'], cell: 'star', size: 0.6, speed: 3, up: 2 });
          }
          W.vfx.comic(h.pos, '祈愿!', { color: '#ffe36a', size: 3 });
          W.vfx.ring(h.pos, { r1: 8, color: '#ffe36a', dur: 1 });
        } },
    ],
  },
];

function consume(h) {
  if (!h.annieReady) return false;
  h.annieReady = false; h.annieStacks = 0;
  if (h.annieAura) { h.annieAura.kill = true; h.annieAura = null; }
  return true;
}

// 法力与成长：[Q, W, E, R] 的法力消耗；0 表示无消耗。盖伦是无消耗英雄。
const RESOURCE = {
  garen: { mana: 0, cost: [0, 0, 0, 0], order: 'QEW' },
  darius: { mana: 300, cost: [30, 30, 70, 100], order: 'QEW' },
  ashe: { mana: 280, cost: [50, 60, 0, 100], order: 'WQE' },
  caitlyn: { mana: 315, cost: [50, 20, 75, 100], order: 'QWE' },
  ahri: { mana: 420, cost: [55, 40, 60, 100], order: 'QWE' },
  lux: { mana: 480, cost: [50, 60, 70, 100], order: 'EQW' },
  annie: { mana: 420, cost: [60, 70, 40, 100], order: 'QWE' },
  yi: { mana: 250, cost: [50, 50, 0, 0], order: 'QEW' },
  malphite: { mana: 280, cost: [70, 25, 50, 100], order: 'QEW' },
  soraka: { mana: 425, cost: [45, 40, 70, 100], order: 'WQE' },
};
// 施法音效（命中、爆炸等由伤害与震屏自动触发）
const SKILL_SFX = {
  garen: ['whoosh', 'shield', 'swing', 'magic'], darius: ['whoosh', 'swing', 'whoosh', 'whoosh'],
  ashe: ['ice', 'arrow', 'whoosh', 'ice'], caitlyn: ['gun', 'click', 'gun', 'gun'],
  ahri: ['orb', 'magic', 'charm', 'whoosh'], lux: ['magic', 'shield', 'orb', 'laser'],
  annie: ['fire', 'fire', 'shield', 'roar'], yi: ['whoosh', 'heal', 'magic', 'magic'],
  malphite: ['whoosh', 'thunder', 'slam', 'whoosh'], soraka: ['magic', 'heal', 'magic', 'heal'],
};
// 技能指示器形状：line 直线(w 半宽) / cone 扇形(a 半角) / circle 落点范围(r) / self 自身周围(r) / target 指向目标(r 目标周围范围)
const L = (w, max) => ({ type: 'line', w, max }), C = (a) => ({ type: 'cone', a }), A = (r) => ({ type: 'circle', r }), SELF = (r) => ({ type: 'self', r }), T = (r) => ({ type: 'target', r }), NONE = { type: 'none' };
const IND = {
  garen: [NONE, NONE, SELF(3.2), T()], darius: [SELF(4.8), NONE, C(0.6), T()],
  ashe: [NONE, C(0.46), L(0.6, 30), L(1.1, 30)], caitlyn: [L(0.8), A(1), L(1), T()],
  ahri: [L(1), SELF(7), L(0.8), L(0.9)], lux: [L(0.8), L(1.2), A(3.2), L(1.6)],
  annie: [T(), C(0.45), NONE, A(3.5)], yi: [T(6), NONE, NONE, NONE],
  malphite: [T(), NONE, SELF(4.2), A(3.8)], soraka: [A(2.6), T(), A(3.5), NONE],
};
for (const h of HEROES) {
  h.skills.forEach((s, i) => { s.sfx = SKILL_SFX[h.id][i]; s.ind = IND[h.id][i]; });
  const r = RESOURCE[h.id];
  h.mana = r.mana; h.manaG = r.mana ? 45 : 0; h.manaRegen = r.mana ? 1.8 : 0;
  // 基础生命下调到原来的 62% 左右，让对拼能在几轮技能内分出胜负
  h.tank = h.hp >= 1400;
  h.hp = Math.round(h.hp * 0.62 / 10) * 10;
  h.hpG = h.tank ? 68 : 56; h.adG = h.range > 3 ? 2.9 : 3.6;
  h.skillOrder = r.order;
  h.skills.forEach((s, i) => { s.mana = r.cost[i]; });
}

export const MAX_RANK = { Q: 5, W: 5, E: 5, R: 3 };
export const R_LEVELS = [6, 11, 16];
// 升到下一级所需经验
export const xpNeed = (lvl) => 100 + 80 * lvl;

export const HERO_BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));
