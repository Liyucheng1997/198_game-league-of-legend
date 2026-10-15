// 第三批五位英雄：锐雯、卢锡安、内瑟斯、泽拉斯、蔚。结构与 heroes2.js 相同，
// 法力表 res、施法音效 sfx、指示器 ind 直接写在各自的定义里；推荐出装在 items.js 的 BUILDS 里。
import * as THREE from 'three';
import { G, glowMat } from './toon-kit.js';
import { projMesh } from './vfx.js';
import { dirOf, at, rot, distXZ, inCone, lineHits, L, C, A, SELF, T, NONE } from './skill-kit.js';

const V3 = (p, y = 1.3) => new THREE.Vector3(p.x, y, p.z);
const bigUnit = (u) => u.kind === 'hero' || u.kind === 'dummy';
const skOf = (h, k) => h.def.skills.find(s => s.key === k);
// 临时改变单位体型，到时恢复
function resize(W, u, k, dur) {
  if (u.sizeT) return;
  const s0 = u.obj.scale.x; u.sizeT = true;
  u.obj.scale.setScalar(s0 * k);
  W.after(dur, () => { u.obj.scale.setScalar(s0); u.sizeT = false; });
}
// 头顶飘字（叠层提示）
const floatText = (W, u, text, color) => W.texts.push({ x: u.pos.x, y: u.height + 0.6, z: u.pos.z, text, color, t: 0, dur: 1.0 });

// ---------- 技能道具模型 ----------
// 锐雯的风之斩：一道向前飞的月牙剑气
function windSlashMesh() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(G.torus(1.8, 0.28, Math.PI * 0.8, 6, 20), glowMat('#9dffc8', 0.65));
  m.rotation.set(Math.PI / 2, 0, Math.PI * 0.1); m.position.z = -1.8; m.scale.set(1, 1, 0.35); g.add(m);
  const f = new THREE.Mesh(G.torus(1.8, 0.1, Math.PI * 0.8, 6, 20), glowMat('#ffffff', 0.85));
  f.rotation.copy(m.rotation); f.position.copy(m.position); g.add(f);
  return g;
}
// 泽拉斯的奥术炮弹
function arcaneBolt(scale = 1) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(G.sphere(14, 10), glowMat('#bff0ff', 0.95)); c.scale.setScalar(0.35 * scale); g.add(c);
  const h = new THREE.Mesh(G.sphere(14, 10), glowMat('#4ab0ff', 0.4)); h.scale.set(0.7 * scale, 1.6 * scale, 0.7 * scale); g.add(h);
  return g;
}

// ---------- 被动小工具 ----------
// 卢锡安：被圣光标记的敌人
const lucMarked = (W, u) => u.lucMark > W.time;
function lucMark(W, u) {
  u.lucMark = W.time + 4;
  W.vfx.disc(u.pos, { r: 1.1, color: '#fff3a0', dur: 4, spin: 3, follow: u.pos, hold: true, opacity: 0.7 });
}
// 蔚：技能命中敌人时获得护盾
function viShield(W, h) {
  if (W.time < (h.viP || 0)) return;
  h.viP = W.time + 12;
  W.shield(h, 40 + h.maxHp * 0.08, 3, '#ff9ad0');
}
// 内瑟斯：吸魂叠层
function nasusStack(W, h, n) {
  h.nasusStacks = (h.nasusStacks || 0) + n;
  floatText(W, h, '+' + n + ' 层', '#c8a0ff');
  W.vfx.puff(h.pos, { n: 6, color: '#b58aff', cell: 'spark', glow: true, size: 0.5, speed: 1.5, up: 2, y: 2 });
}

export const HEROES3 = [
  // ======================= 锐雯 =======================
  {
    id: 'riven', name: '锐雯', title: '放逐之刃', role: '战士', color: '#4f8a7a',
    hp: 1320, ad: 70, range: 1.7, atkSpeed: 0.74, speed: 7.2, atkAnim: ['hslash', 'hslashBack'], hSlash: true, slashColor: '#b8ffd8', hitColor: '#9dffc8',
    passive: '符文之刃：每施放一个技能获得 1 层符文（最多 3 层），普攻会消耗 1 层，额外造成 35% 攻击力的物理伤害。',
    onCast(W, h) { const b = h.buff('rivenP'); h.addBuff('rivenP', 6, { n: Math.min(3, (b ? b.n : 0) + 1) }); },
    onHit(W, h, t) {
      const b = h.buff('rivenP');
      if (!b || b.n <= 0) return;
      W.damage(h, t, h.ad * 0.35, { type: 'phys', color: '#9dffc8' }); W.vfx.spark(t.pos, '#9dffc8', 6, 0.6);
      if (--b.n <= 0) h.removeBuff('rivenP');
    },
    tick(W, h) { if (h.range !== h.def.range && !h.has('rivenR')) h.range = h.def.range; }, // 阵亡时 buff 不走 onEnd，这里兜底恢复射程
    res: { mana: 0, cost: [0, 0, 0, 0], order: 'QEW' }, sfx: ['swing', 'roar', 'whoosh', 'swing'], ind: [L(1.2), SELF(3), A(0.8), C(0.45)],
    skills: [
      { key: 'Q', name: '折翼之舞', icon: '舞', aim: 'dir', range: 2.6, aiRange: 4.6, cd: 9, wind: 0, lock: 0.3, anim: 'hslash', animDur: 0.4, ai: 'enemy',
        desc: '向前突进斩击，4 秒内可连续施放三次；第三段跃起砸地，击飞周围的敌人。放逐之锋期间范围和伤害更大。',
        fire(W, h, aim) {
          const st = h.rivQ && W.time < h.rivQ.until ? h.rivQ.n : 0, third = st >= 2;
          const d = dirOf(h, aim), R = h.has('rivenR'), amp = R ? 1.2 : 1, rad = (third ? 2.8 : 2.2) + (R ? 0.6 : 0);
          if (!third) {
            const mark = h.rivQ = { n: st + 1, until: W.time + 4 };
            h.cds.Q = 0.45;
            W.after(4.05, () => { if (h.rivQ === mark) { h.rivQ = null; h.cds.Q = Math.max(h.cds.Q, h.cdOf(skOf(h, 'Q')) * 0.5); } });
          } else h.rivQ = null;
          h.atkCd = 0;
          if (st === 1) h.rig.play('hslashBack', 0.4);
          W.dash(h, at(h.pos, d, 2.6), { dur: third ? 0.3 : 0.18, arc: third ? 1.6 : 0, anim: third ? 'leap' : null, trail: { color: '#9dffc8', glow: true, size: 0.7 }, onEnd: (end) => {
            if (h.dead) return;
            const c = at(end, d, 0.6);
            for (const u of W.enemiesIn(h.team, c, rad)) {
              W.damage(h, u, (40 * h.rk('Q') + h.ad * 0.4) * amp, { type: 'phys' });
              if (third) W.cc(u, 'knockup', 0.75, { height: 2.2 });
            }
            if (third) {
              h.rig.play('slam', 0.4);
              W.vfx.ring(c, { r1: rad + 0.8, color: '#9dffc8', dur: 0.4 }); W.vfx.puff(c, { n: 16, color: ['#9dffc8', '#e8dcc0'], cell: 'shard', size: 0.6, speed: 6, y: 0.3 });
              W.vfx.comic(c, '起!', { color: '#9dffc8' }); W.vfx.shake(0.3);
            } else W.vfx.slash(end, h.facing, { color: '#b8ffd8', r: rad, flip: st === 1, dur: 0.25 });
          } });
        } },
      { key: 'W', name: '震魂怒吼', icon: '吼', aim: 'self', cd: 10, wind: 0.1, anim: 'slam', animDur: 0.45, ai: 'close',
        desc: '释放剑身的符文能量，对周围敌人造成物理伤害并晕眩 0.75 秒。',
        fire(W, h) {
          const r = h.has('rivenR') ? 3.6 : 3;
          for (const u of W.enemiesIn(h.team, h.pos, r)) { W.damage(h, u, 60 * h.rk('W') + h.ad * 0.6, { type: 'phys' }); W.cc(u, 'stun', 0.75); }
          W.vfx.ring(h.pos, { r1: r + 1, color: '#7dffb0', dur: 0.4 }); W.vfx.disc(h.pos, { r, color: '#4f8a7a', dur: 0.5, opacity: 0.6 });
          W.vfx.puff(h.pos, { n: 18, color: ['#9dffc8', '#ffffff'], cell: 'spark', glow: true, size: 0.7, speed: 7, y: 0.6 });
          W.vfx.comic(h.pos, '吼!', { color: '#9dffc8' }); W.vfx.shake(0.25);
        } },
      { key: 'E', name: '勇往直前', icon: '勇', aim: 'point', range: 4, cd: 9, wind: 0, lock: 0.2, anim: 'thrust', animDur: 0.3, ai: 'escape',
        desc: '向前冲刺一小段距离，并获得一个吸收伤害的护盾。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), dist = Math.max(2.2, Math.min(3.5, distXZ(h.pos, aim)));
          W.dash(h, at(h.pos, d, dist), { dur: 0.2, trail: { color: '#9dffc8', size: 0.6 } });
          W.shield(h, 80 * h.rk('E') + h.ad * 0.8, 1.5, '#9dffc8');
        } },
      { key: 'R', name: '放逐之锋', icon: '锋', aim: 'dir', range: 9, aiRange: 9, cd: 60, wind: 0.15, lock: 0.4, anim: 'hslash', animDur: 0.6, ai: 'hero',
        desc: '重铸断剑 12 秒：攻击距离和普攻伤害提升，折翼之舞与震魂怒吼的范围变大。施放时立即挥出一道扇形风之斩，敌人生命越低伤害越高（最多 2.5 倍）。',
        fire(W, h, aim) {
          const d = dirOf(h, aim);
          h.range = h.def.range + 0.8;
          h.addBuff('rivenR', 12, {
            onHit(W, h, t) { W.damage(h, t, h.ad * 0.2, { type: 'phys', noText: true }); },
            onEnd: (u) => { u.range = u.def.range; },
          });
          W.vfx.aura(h, { color: '#7dffb0', glow: true, r: 1.4, dur: 12, particles: 18, pcolor: '#c8ffe0' });
          // 风之斩：扇形内的敌人按距离依次被斩中
          W.projectile({ from: V3(h.pos, 1.2), dir: d, speed: 30, range: 9, team: h.team, owner: h, mesh: windSlashMesh(), trail: { color: '#9dffc8', glow: true, size: 1.2, rate: 0.8 } });
          for (const u of inCone(W, h, d, 9, 0.45)) {
            W.after(h.dist(u) / 30, () => {
              if (!u.targetable) return;
              const miss = 1 - u.hp / u.maxHp;
              W.damage(h, u, (110 * h.rk('R') + h.ad * 0.6) * (1 + 1.5 * miss), { type: 'phys', color: '#9dffc8' });
              W.vfx.spark(u.pos, '#9dffc8', 10, 0.8);
            });
          }
          W.vfx.comic(h.pos, '放逐!', { color: '#7dffb0', size: 3 }); W.vfx.shake(0.3);
        } },
    ],
  },
  // ======================= 卢锡安 =======================
  {
    id: 'lucian', name: '卢锡安', title: '圣枪游侠', role: '射手', color: '#4a5a7a',
    hp: 1040, ad: 63, range: 9.5, atkSpeed: 0.72, speed: 7.0, atkAnim: 'shoot', atkProj: 'bullet', projColor: '#fff3a0', projSpeed: 44,
    projTrail: { color: '#fff7c0', glow: true, size: 0.3, rate: 0.5 }, hitColor: '#fff7c0',
    passive: '圣光银弹：每次施放技能后，下一次普攻会连开两枪（第二枪造成 60% 攻击力的伤害）。普攻命中被炽热子弹标记的敌人时获得加速。',
    onCast(W, h) {
      h.addBuff('lucP', 4, { onHit(W, h, t) {
        h.removeBuff('lucP');
        W.after(0.12, () => {
          if (h.dead || !t.targetable) return;
          W.projectile({ from: h.tipPos(), target: t, speed: 46, team: h.team, owner: h, mesh: projMesh('bullet', '#bfe8ff'), trail: { color: '#bfe8ff', glow: true, size: 0.3, rate: 0.5 },
            onHit: (u) => { W.damage(h, u, h.ad * 0.6, { type: 'phys', auto: true }); if (lucMarked(W, u)) h.addBuff('lucHaste', 1, { haste: 0.4 }); } });
        });
      } });
    },
    onHit(W, h, t) { if (lucMarked(W, t)) h.addBuff('lucHaste', 1, { haste: 0.4 }); },
    res: { mana: 320, cost: [50, 50, 40, 100], order: 'QEW' }, sfx: ['laser', 'gun', 'whoosh', 'gun'], ind: [L(0.9), L(0.7), A(0.8), L(0.6)],
    skills: [
      { key: 'Q', name: '透体圣光', icon: '透', aim: 'dir', range: 11, cd: 7, wind: 0.3, lock: 0.35, anim: 'shoot', animDur: 0.55, ai: 'enemy',
        desc: '短暂瞄准后射出一道贯穿直线的圣光，对路径上所有敌人造成物理伤害。',
        start(W, h, aim) { W.vfx.puff(h.tipPos(), { n: 8, color: '#fff3a0', cell: 'spark', glow: true, size: 0.5, speed: -2, spread: 1.2, y: 0 }); },
        fire(W, h, aim) {
          const d = dirOf(h, aim), a = { x: h.pos.x, z: h.pos.z }, b = at(a, d, 11), from = h.tipPos();
          for (const u of lineHits(W, h, a, b, 0.9)) { W.damage(h, u, 80 * h.rk('Q') + h.ad * 0.8, { type: 'phys' }); W.vfx.spark(u.pos, '#fff3a0', 8); }
          W.vfx.beam(from, at(from, d, 11), { width: 0.8, color: '#fff3a0', dur: 0.35 });
          W.vfx.puff(from, { n: 8, color: '#ffffff', cell: 'puff', size: 0.6, y: 0, speed: 2 });
        } },
      { key: 'W', name: '炽热子弹', icon: '炽', aim: 'dir', range: 10, cd: 12, wind: 0.15, anim: 'shoot', animDur: 0.4, ai: 'enemy',
        desc: '射出一颗子弹，命中敌人或飞到尽头时呈十字形爆炸，伤害并标记附近敌人 4 秒；普攻或技能命中被标记的敌人时获得加速。',
        fire(W, h, aim) {
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 32, range: 10, radius: 0.7, team: h.team, owner: h, mesh: projMesh('orb', '#ffd84a'), scale: 1.3,
            trail: { color: '#fff3a0', glow: true, size: 0.6 },
            onHit: () => {},
            onEnd: (p) => {
              const pos = { x: p.x, z: p.z };
              for (const u of W.enemiesIn(h.team, pos, 2.5)) { W.damage(h, u, 70 * h.rk('W'), { type: 'magic' }); lucMark(W, u); }
              for (let i = 0; i < 4; i++) W.vfx.beam(V3(pos, 1), at(pos, { x: Math.cos(i * Math.PI / 2), z: Math.sin(i * Math.PI / 2) }, 2.5), { width: 0.45, color: '#ffe27a', dur: 0.3 });
              W.vfx.ring(pos, { r1: 3, color: '#ffe27a', dur: 0.35 }); W.vfx.spark(pos, '#fff3a0', 12, 0.8);
            } });
        } },
      { key: 'E', name: '冷酷追击', icon: '追', aim: 'point', range: 4.5, cd: 10, wind: 0, lock: 0.2, anim: 'twirl', animDur: 0.3, ai: 'fightFar',
        desc: '向目标方向快速冲刺一小段距离，并重置普攻。',
        fire(W, h, aim) {
          const d = dirOf(h, aim), dist = Math.max(2.5, Math.min(4.5, distXZ(h.pos, aim)));
          W.dash(h, at(h.pos, d, dist), { dur: 0.2, trail: { color: '#e0e8ff', glow: true, size: 0.6 } });
          h.atkCd = 0;
          W.vfx.puff(h.pos, { n: 8, color: '#ffffff', cell: 'puff', size: 0.8, speed: 3, y: 0.3 });
        } },
      { key: 'R', name: '圣枪洗礼', icon: '洗', aim: 'dir', range: 14, cd: 55, wind: 0.1, lock: 0.2, anim: 'shoot', animDur: 2.6, ai: 'hero',
        desc: '朝一个方向持续扫射 2.5 秒，射出 18 发圣光子弹，每发命中第一个敌人。扫射时可以移动，但不能普攻。',
        fire(W, h, aim) {
          const d = dirOf(h, aim);
          h.addBuff('noAttack', 2.5); h.addBuff('lucR', 2.5);
          let n = 0;
          const shot = () => {
            if (h.dead || h.stunned || h.has('charm') || n >= 18) { h.removeBuff('noAttack'); h.removeBuff('lucR'); return; }
            const dd = rot(d, (n % 2 ? 1 : -1) * 0.05);
            W.projectile({ from: V3(at(h.pos, { x: -dd.z, z: dd.x }, (n % 2 ? 0.3 : -0.3)), 1.4), dir: dd, speed: 42, range: 14, radius: 0.6, team: h.team, owner: h,
              mesh: projMesh('bullet', n % 2 ? '#bfe8ff' : '#fff3a0'), trail: { color: n % 2 ? '#bfe8ff' : '#fff7c0', glow: true, size: 0.35, rate: 0.6 },
              onHit: (u) => { W.damage(h, u, 14 * h.rk('R') + h.ad * 0.15, { type: 'phys' }); if (lucMarked(W, u)) h.addBuff('lucHaste', 1, { haste: 0.4 }); } });
            if (n % 4 === 0) h.rig.play('shoot', 0.5);
            n++;
            W.after(0.135, shot);
          };
          shot();
          W.vfx.comic(h.pos, '洗礼!', { color: '#fff3a0', size: 3 });
        } },
    ],
  },
  // ======================= 内瑟斯 =======================
  {
    id: 'nasus', name: '内瑟斯', title: '沙漠死神', role: '坦克', color: '#7a5aa0', radius: 0.8,
    hp: 1560, ad: 68, range: 1.8, atkSpeed: 0.68, speed: 6.9, atkAnim: 'slash', slashColor: '#d8b8ff', hitColor: '#d8b0ff',
    passive: '灵魂掠食：普攻回复 12% 攻击力的生命值。汲魂痛击击杀单位会永久叠加伤害。',
    onHit(W, h) { W.heal(h, h.ad * 0.12); },
    tick(W, h) { if (h.nasusBonus && !h.has('nasusR')) { h.nasusBonus = 0; h.recalc(); } }, // 死神降临结束（含阵亡）后恢复生命上限
    res: { mana: 320, cost: [20, 60, 70, 100], order: 'QEW' }, sfx: ['hitHeavy', 'magic', 'fire', 'roar'], ind: [NONE, T(), A(3), SELF(3.5)],
    skills: [
      { key: 'Q', name: '汲魂痛击', icon: '汲', aim: 'self', cd: 6, wind: 0, anim: 'flex', animDur: 0.35, ai: 'close',
        desc: '下一次普攻造成额外物理伤害，并附加已叠加的层数。用它击杀单位会永久叠加伤害：小兵 +3，英雄与大型野怪 +6。',
        fire(W, h) {
          h.atkCd = 0;
          if (h.has('nasusR')) h.cds.Q *= 0.5;
          const aura = W.vfx.aura(h, { color: '#b58aff', glow: true, r: 1.3, dur: 5, particles: 14 });
          h.addBuff('nasusQ', 5, { onHit(W, h, t) {
            h.removeBuff('nasusQ'); aura.kill = true;
            W.damage(h, t, 40 * h.rk('Q') + (h.nasusStacks || 0), { type: 'phys', color: '#d8b0ff' });
            W.vfx.slash(t.pos, h.facing, { color: '#b58aff', r: 2.4, tilt: 1.3 }); W.vfx.puff(t.pos, { n: 8, color: '#b58aff', cell: 'spark', glow: true, size: 0.6, speed: 4 });
            if (t.dead) nasusStack(W, h, t.kind === 'hero' || t.big ? 6 : 3);
          } });
        } },
      { key: 'W', name: '枯萎', icon: '枯', aim: 'unit', range: 7, cd: 14, wind: 0.15, anim: 'cast2', animDur: 0.45, ai: 'hero',
        desc: '让目标迅速衰老 5 秒：减速从 35% 逐渐加深到 75%，攻击速度也降低 30%。',
        fire(W, h, aim, t) {
          if (!t) return;
          W.cc(t, 'slow', 5, { pct: 0.35, id: 'nasusW' }); t.addBuff('nasusWas', 5, { as: -0.3 });
          for (let i = 1; i <= 4; i++) W.after(i, () => { if (t.has('slownasusW')) W.cc(t, 'slow', 5 - i, { pct: 0.35 + 0.1 * i, id: 'nasusW' }); });
          W.vfx.beam(h.tipPos(), V3(t.pos, 1.3), { width: 0.4, color: '#b58aff', dur: 0.4 });
          W.vfx.disc(t.pos, { r: 1.2, color: '#6a3fa0', dur: 5, spin: -2, follow: t.pos, hold: true, opacity: 0.7 });
          W.vfx.add(null, 5, () => { if (Math.random() < 0.2) W.vfx.trail({ x: t.pos.x + (Math.random() - 0.5), y: 0.5 + Math.random() * 1.5, z: t.pos.z + (Math.random() - 0.5) }, { color: '#8a6aa0', cell: 'puff', size: 0.5, vy: -0.5, life: 0.6 }); });
          W.vfx.comic(t.pos, '枯!', { color: '#b58aff' });
        } },
      { key: 'E', name: '灵魂烈焰', icon: '焰', aim: 'point', range: 8, cd: 10, wind: 0.2, anim: 'raise', animDur: 0.5, ai: 'enemy',
        desc: '在目标区域点燃灵魂之火：立即造成魔法伤害，之后 4 秒持续灼烧；区域内的敌人被破甲，受到的伤害提高 15%。',
        fire(W, h, aim) {
          const pos = { x: aim.x, z: aim.z };
          for (const u of W.enemiesIn(h.team, pos, 3)) W.damage(h, u, 80 * h.rk('E'), { type: 'magic' });
          W.vfx.disc(pos, { r: 3, color: '#8a4ad0', dur: 4, opacity: 0.7, spin: 1, hold: true, pulse: true });
          W.vfx.ring(pos, { r1: 3.6, color: '#b58aff', dur: 0.4 });
          W.vfx.puff(pos, { n: 20, color: ['#b58aff', '#6a3fa0', '#e0c8ff'], cell: 'flame', size: 1, speed: 4, y: 0.3 });
          W.zone({ pos, r: 3, dur: 4, every: 0.5, team: h.team, onTick: () => {
            for (const u of W.enemiesIn(h.team, pos, 3)) { W.damage(h, u, 9 * h.rk('E'), { type: 'magic', noText: true }); u.addBuff('nasusE', 0.6, { dr: -0.15 }); }
            W.vfx.puff(pos, { n: 5, color: ['#b58aff', '#6a3fa0'], cell: 'flame', size: 0.8, speed: 1, spread: 2.6, up: 1.5, y: 0.2 });
          } });
        } },
      { key: 'R', name: '死神降临', icon: '神', aim: 'self', cd: 60, wind: 0.2, anim: 'raise', animDur: 0.8, ai: 'fight',
        desc: '化身沙漠死神 12 秒：体型变大、获得额外生命值和 15% 减伤，每秒灼烧周围敌人（附带其最大生命值 2% 的魔法伤害），汲魂痛击冷却减半。',
        fire(W, h) {
          const bonus = Math.round(200 * h.rk('R'));
          if (!h.nasusBonus) { h.nasusBonus = bonus; h.maxHp += bonus; h.hp += bonus; }
          resize(W, h, 1.35, 12);
          h.addBuff('nasusR', 12, { dr: 0.15, every: 1, tick: (me) => {
            for (const u of W.enemiesIn(me.team, me.pos, 3.5)) W.damage(me, u, 12 * h.rk('R') + u.maxHp * 0.02, { type: 'magic', noText: true });
            W.vfx.ring(me.pos, { r0: 1.5, r1: 4, color: '#b58aff', dur: 0.5 });
          }, onEnd: (u) => { if (u.nasusBonus) { u.nasusBonus = 0; u.recalc(); } } });
          W.vfx.aura(h, { color: '#8a4ad0', glow: true, r: 3.5, dur: 12, particles: 26, pcolor: '#d8b8ff', pcell: 'flame' });
          W.vfx.pillar(h.pos, { color: '#b58aff', r: 2.2, h: 14, dur: 0.8 });
          W.vfx.puff(h.pos, { n: 24, color: ['#b58aff', '#ffd84a'], cell: 'spark', glow: true, size: 0.9, speed: 6, up: 2 });
          W.vfx.comic(h.pos, '死神!', { color: '#b58aff', size: 3.2 }); W.vfx.shake(0.5);
        } },
    ],
  },
  // ======================= 泽拉斯 =======================
  {
    id: 'xerath', name: '泽拉斯', title: '远古巫灵', role: '法师', color: '#3a7ac0',
    hp: 980, ad: 52, range: 10, atkSpeed: 0.65, speed: 6.8, atkAnim: 'throw', atkProj: 'orb', projColor: '#8ae0ff', projSpeed: 26,
    projTrail: { color: '#bff0ff', glow: true, size: 0.4, rate: 0.7 }, hitColor: '#bff0ff',
    passive: '法力涌动：每 12 秒，下一次普攻回复 30 点法力并额外造成魔法伤害。',
    onHit(W, h, t) {
      if (W.time < (h.xerP || 0)) return;
      h.xerP = W.time + 12;
      if (!h.manaless) h.mana = Math.min(h.maxMana, h.mana + 30);
      W.damage(h, t, 20 + 5 * h.level, { type: 'magic' }); W.vfx.spark(t.pos, '#8ae0ff', 10, 0.8);
    },
    res: { mana: 400, cost: [70, 70, 60, 100], order: 'QWE' }, sfx: ['laser', 'magic', 'orb', 'thunder'], ind: [L(0.9), A(2.6), L(0.7), A(2.2)],
    skills: [
      { key: 'Q', name: '奥能脉冲', icon: '脉', aim: 'dir', range: 15, cd: 8, wind: 0.7, lock: 0.7, anim: 'channel', animDur: 0.9, ai: 'enemy',
        desc: '凝聚奥术能量后射出一道超长的能量光束，对直线上所有敌人造成魔法伤害。',
        start(W, h, aim) {
          const d = dirOf(h, aim), from = new THREE.Vector3(h.pos.x, 0.2, h.pos.z);
          W.vfx.beam(from, at(from, d, 15), { width: 0.25, color: '#bff0ff', dur: 0.7, y: 0.15 });
          W.vfx.puff(h.pos, { n: 14, color: '#8ae0ff', cell: 'spark', glow: true, size: 0.7, speed: -2, spread: 2.5 });
        },
        fire(W, h, aim) {
          const d = dirOf(h, aim), a = { x: h.pos.x, z: h.pos.z }, b = at(a, d, 15), from = h.tipPos();
          for (const u of lineHits(W, h, a, b, 0.9)) { W.damage(h, u, 115 * h.rk('Q'), { type: 'magic' }); W.vfx.spark(u.pos, '#bff0ff', 8); }
          W.vfx.beam(from, at(from, d, 15), { width: 1.1, color: '#5ad0ff', dur: 0.5 });
          for (let i = 0; i < 15; i += 2) W.vfx.puff(at(a, d, i), { n: 2, color: '#bff0ff', cell: 'spark', glow: true, size: 0.7, speed: 2 });
        } },
      { key: 'W', name: '毁灭之眼', icon: '眼', aim: 'point', range: 11, cd: 10, wind: 0.2, anim: 'raise', animDur: 0.5, ai: 'enemy',
        desc: '0.6 秒后，奥术能量轰击目标区域并减速敌人；正中心的敌人受到 50% 额外伤害，并被大幅减速。',
        fire(W, h, aim) {
          const pos = { x: aim.x, z: aim.z };
          W.vfx.disc(pos, { r: 2.6, color: '#5ad0ff', dur: 0.65, opacity: 0.6, spin: 2 });
          W.vfx.disc(pos, { r: 1, color: '#ffffff', dur: 0.65, opacity: 0.7, spin: -3 });
          W.after(0.6, () => {
            for (const u of W.enemiesIn(h.team, pos, 2.6)) {
              const center = distXZ(u.pos, pos) < 1 + u.radius;
              W.damage(h, u, 95 * h.rk('W') * (center ? 1.5 : 1), { type: 'magic', color: center ? '#bff0ff' : undefined });
              W.cc(u, 'slow', 2, { pct: center ? 0.6 : 0.25, id: 'xerW' });
            }
            W.vfx.pillar(pos, { color: '#8ae0ff', r: 2.4, h: 10, dur: 0.6 });
            W.vfx.pillar(pos, { color: '#ffffff', r: 0.9, h: 12, dur: 0.5 });
            W.vfx.ring(pos, { r1: 3.4, color: '#5ad0ff', dur: 0.4 });
            W.vfx.puff(pos, { n: 18, color: ['#8ae0ff', '#ffffff'], cell: 'spark', glow: true, size: 0.8, speed: 5 });
          });
        } },
      { key: 'E', name: '法术异常', icon: '异', aim: 'dir', range: 11, cd: 12, wind: 0.2, anim: 'cast2', animDur: 0.45, ai: 'hero',
        desc: '射出一颗奥术能量球，晕眩第一个命中的敌人；飞得越远，晕眩越久（0.75～2 秒）。',
        fire(W, h, aim) {
          W.projectile({ from: h.tipPos(), dir: dirOf(h, aim), speed: 24, range: 11, radius: 0.7, team: h.team, owner: h, mesh: projMesh('bigOrb', '#5ad0ff'),
            trail: { color: '#bff0ff', glow: true, size: 0.8, cell: 'spark' },
            onHit: (u, p) => {
              W.damage(h, u, 90 * h.rk('E'), { type: 'magic' }); W.cc(u, 'stun', 0.75 + 1.25 * Math.min(1, p.traveled / 11));
              W.vfx.ring(u.pos, { r1: 2.4, color: '#8ae0ff', dur: 0.35 }); W.vfx.comic(u.pos, '晕!', { color: '#8ae0ff' });
            } });
        } },
      { key: 'R', name: '奥术仪式', icon: '仪', aim: 'point', range: 30, cd: 80, wind: 0.3, lock: 0.4, anim: 'channel', animDur: 2.0, ai: 'executeFar',
        desc: '升空引导奥术仪式，向目标区域连续降下 3 次奥术炮击，每次自动锁定目标点附近最近的敌方英雄，造成大量魔法伤害。引导期间无法移动。',
        start(W, h) { W.vfx.aura(h, { color: '#5ad0ff', glow: true, r: 1.8, dur: 2.3, particles: 26, pcolor: '#bff0ff' }); W.vfx.pillar(h.pos, { color: '#8ae0ff', r: 0.8, h: 12, dur: 1 }); },
        fire(W, h, aim) {
          const c = { x: aim.x, z: aim.z };
          h.addBuff('channel', 1.9); h.addBuff('noAttack', 1.9);
          W.vfx.comic(h.pos, '仪式!', { color: '#5ad0ff', size: 3 });
          for (let i = 0; i < 3; i++) W.after(0.1 + i * 0.6, () => {
            if (h.dead || !h.canAct()) { h.removeBuff('channel'); h.removeBuff('noAttack'); return; }
            const foe = W.nearestEnemy(h.team, c, 30, bigUnit);
            const p = foe ? { x: foe.pos.x, z: foe.pos.z } : { x: c.x + (Math.random() - 0.5) * 3, z: c.z + (Math.random() - 0.5) * 3 };
            W.vfx.disc(p, { r: 2.2, color: '#5ad0ff', dur: 0.55, opacity: 0.75, spin: 3 });
            W.vfx.ring(p, { r0: 3.4, r1: 2.2, color: '#bff0ff', dur: 0.5 });
            const bolt = arcaneBolt(1.5);
            W.vfx.add(bolt, 0.5, (k) => { bolt.position.set(p.x, 0.5 + 14 * (1 - k), p.z); W.vfx.trail(bolt.position, { color: '#8ae0ff', glow: true, size: 0.9, vy: 2 }); });
            W.after(0.5, () => {
              for (const u of W.enemiesIn(h.team, p, 2.2)) W.damage(h, u, 130 * h.rk('R'), { type: 'magic', color: '#bff0ff' });
              W.vfx.pillar(p, { color: '#5ad0ff', r: 1.8, h: 14, dur: 0.5 });
              W.vfx.ring(p, { r1: 3.6, color: '#8ae0ff', dur: 0.4 });
              W.vfx.puff(p, { n: 20, color: ['#5ad0ff', '#ffffff'], cell: 'spark', glow: true, size: 0.9, speed: 6 });
              W.vfx.shake(0.3);
            });
          });
        } },
    ],
  },
  // ======================= 蔚 =======================
  {
    id: 'vi', name: '蔚', title: '皮城执法官', role: '战士', color: '#d8508a',
    hp: 1380, ad: 70, range: 1.7, atkSpeed: 0.7, speed: 7.1, atkAnim: 'punch', hitColor: '#ff9ad0',
    passive: '爆裂护盾：技能命中敌人时获得一个护盾（12 秒冷却）。',
    // 爆裂护手（W 被动）：对同一目标每第三次普攻造成最大生命值伤害并获得护盾
    onHit(W, h, t) {
      if (!h.ranks.W) return;
      if (h.viWT !== t) { h.viWT = t; h.viWN = 0; }
      if (++h.viWN < 3) { W.vfx.ring(t.pos, { r1: 0.8 + h.viWN * 0.4, color: '#ff9ad0', dur: 0.3 }); return; }
      h.viWN = 0;
      W.damage(h, t, Math.min(t.kind === 'hero' ? 9999 : 300, t.maxHp * (0.03 + 0.01 * h.ranks.W)), { type: 'phys', color: '#ff9ad0' });
      W.shield(h, 30 + h.maxHp * 0.03, 2.5, '#ff9ad0');
      W.vfx.ring(t.pos, { r1: 3, color: '#ff6fa8', dur: 0.4 }); W.vfx.comic(t.pos, '爆!', { color: '#ff6fa8', size: 1.8 });
    },
    res: { mana: 300, cost: [50, 40, 30, 100], order: 'QEW' }, sfx: ['whoosh', 'shield', 'hitHeavy', 'roar'], ind: [L(1, 6), NONE, NONE, T()],
    skills: [
      { key: 'Q', name: '强能冲拳', icon: '拳', aim: 'dir', range: 6, aiRange: 6.5, cd: 10, wind: 0.3, lock: 0.6, anim: 'punch', animDur: 0.6, ai: 'hero',
        desc: '蓄力后向前冲拳，伤害沿途所有敌人；撞上的第一个敌方英雄会被击退并短暂击飞。',
        start(W, h) { W.vfx.puff(h.pos, { n: 12, color: '#ff9ad0', cell: 'spark', glow: true, size: 0.6, speed: -2, spread: 2 }); },
        fire(W, h, aim) {
          const d = dirOf(h, aim), a = { x: h.pos.x, z: h.pos.z }, b = at(a, d, 6);
          const proj = (u) => (u.pos.x - a.x) * d.x + (u.pos.z - a.z) * d.z;
          const first = lineHits(W, h, a, b, 1).filter(u => bigUnit(u) && proj(u) > 0).sort((x, y) => proj(x) - proj(y))[0];
          const end = first ? at(first.pos, d, -1.2) : b;
          W.dash(h, end, { dur: 0.25, trail: { color: '#ff9ad0', glow: true, size: 0.9 }, onEnd: (e) => {
            if (h.dead) return;
            const hits = lineHits(W, h, a, at(e, d, 1.2), 1.2);
            for (const u of hits) W.damage(h, u, 75 * h.rk('Q') + h.ad * 0.8, { type: 'phys' });
            if (hits.length) viShield(W, h);
            h.atkCd = 0;
            if (first && first.targetable) {
              W.displace(first, at(first.pos, d, 2.5), 0.25);
              W.after(0.25, () => W.cc(first, 'knockup', 0.5, { height: 1.6 }));
              W.vfx.comic(first.pos, '砰!', { color: '#ff6fa8' }); W.vfx.shake(0.35);
            }
            W.vfx.ring(e, { r1: 2.5, color: '#ff9ad0', dur: 0.3 }); W.vfx.puff(e, { n: 10, color: ['#ff9ad0', '#ffffff'], cell: 'spark', glow: true, size: 0.7, speed: 5 });
          } });
        } },
      { key: 'W', name: '爆裂护手', icon: '护', aim: 'self', cd: 12, wind: 0, anim: 'flex', animDur: 0.4, ai: 'fight',
        desc: '被动：对同一目标每第三次普攻，额外造成其最大生命值 4%～8% 的物理伤害并获得护盾。主动：5 秒内攻速提升 40%，并立即重置普攻。',
        fire(W, h) {
          h.atkCd = 0;
          h.addBuff('viW', 5, { as: 0.4 });
          W.vfx.aura(h, { color: '#ff6fa8', glow: true, r: 1.2, dur: 5, particles: 16 });
          W.vfx.comic(h.pos, '来!', { color: '#ff6fa8' });
        } },
      { key: 'E', name: '透体冲击', icon: '冲', aim: 'self', cd: 7, wind: 0, anim: 'flex', animDur: 0.3, ai: 'close',
        desc: '下一次普攻打出冲击波，对目标及其身后扇形区域内的敌人造成物理伤害。',
        fire(W, h) {
          h.atkCd = 0;
          const aura = W.vfx.aura(h, { color: '#ff9ad0', glow: true, r: 1.2, dur: 5, particles: 12 });
          h.addBuff('viE', 5, { onHit(W, h, t) {
            h.removeBuff('viE'); aura.kill = true;
            const d = dirOf(h, t.pos), dmg = 45 * h.rk('E') + h.ad * 0.6;
            W.damage(h, t, dmg, { type: 'phys' });
            for (const u of inCone(W, h, d, 4.5, 0.5, t.pos)) if (u !== t) W.damage(h, u, dmg, { type: 'phys' });
            viShield(W, h);
            W.vfx.beam(V3(t.pos), at(t.pos, d, 4.5), { width: 1.2, color: '#ff9ad0', dur: 0.3 });
            W.vfx.puff(at(t.pos, d, 1.5), { n: 14, color: ['#ff9ad0', '#ffffff'], cell: 'spark', glow: true, size: 0.7, speed: 6, vx: d.x * 6, vz: d.z * 6 });
          } });
        } },
      { key: 'R', name: '天霸横空碎', icon: '碎', aim: 'unit', range: 9, cd: 60, wind: 0.1, lock: 0.6, anim: 'leap', animDur: 0.6, ai: 'hero',
        desc: '锁定一名敌人，以不可阻挡之势冲到它面前（冲刺期间免疫并清除控制），把它击飞 1.25 秒并造成大量物理伤害，沿途其他敌人被撞开。',
        fire(W, h, aim, t) {
          if (!t) return;
          h.buffs = h.buffs.filter(b => !(b.slow || ['stun', 'root', 'charm', 'silence', 'knockup'].includes(b.id)));
          h.tenacityBuff = W.time + 1;
          const hitAside = new Set([t]), dist = h.dist(t);
          W.vfx.comic(h.pos, '让开!', { color: '#ff6fa8' });
          W.dash(h, at(t.pos, dirOf(t, h.pos), 1.2), { dur: Math.max(0.25, dist / 24), through: true, trail: { color: '#ff6fa8', glow: true, size: 1.1 },
            during: () => {
              for (const u of W.enemiesIn(h.team, h.pos, 1.6)) {
                if (hitAside.has(u)) continue;
                hitAside.add(u);
                const s = dirOf(h, u.pos);
                W.damage(h, u, 60 * h.rk('R'), { type: 'phys' }); W.displace(u, at(u.pos, s, 2), 0.25);
              }
            },
            onEnd: () => {
              if (h.dead || !t.targetable) return;
              W.damage(h, t, 180 * h.rk('R') + h.ad * 0.7, { type: 'phys' }); W.cc(t, 'knockup', 1.25, { height: 3 });
              viShield(W, h);
              h.rig.play('punch', 0.4);
              W.vfx.ring(t.pos, { r1: 4, color: '#ff6fa8', dur: 0.45 }); W.vfx.puff(t.pos, { n: 22, color: ['#ff6fa8', '#ffffff', '#ffd84a'], cell: 'spark', glow: true, size: 0.9, speed: 7 });
              W.vfx.comic(t.pos, '碎!', { color: '#ff6fa8', size: 3.2 }); W.vfx.shake(0.6);
            } });
        } },
    ],
  },
];
