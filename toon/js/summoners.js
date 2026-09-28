// 召唤师技能：选人时二选二，冷却时间比英雄技能长得多。
import * as THREE from 'three';

// aim：none 直接施放 / enemy 指向敌方英雄 / unit 指向小兵或野怪 / tp 指向友方建筑或小兵
export const SPELLS = {
  flash: { name: '闪现', cd: 180, aim: 'none', color: '#c89a3a', desc: '向鼠标方向瞬间移动一小段距离，可以穿过墙体。' },
  heal: { name: '治疗术', cd: 150, aim: 'none', color: '#3f8a52', desc: '为自己和身边生命最低的一名友方英雄回复生命，并短暂加速。' },
  barrier: { name: '屏障', cd: 120, aim: 'none', color: '#c8a040', desc: '获得一个持续 2.5 秒的护盾，吸收伤害。' },
  ghost: { name: '疾跑', cd: 150, aim: 'none', color: '#6a5aa8', desc: '8 秒内移动速度大幅提升。' },
  ignite: { name: '引燃', cd: 120, aim: 'enemy', range: 7, color: '#c0402a', desc: '点燃一名敌方英雄，5 秒内造成真实伤害，并使其受到的治疗减少 60%。' },
  exhaust: { name: '虚弱', cd: 150, aim: 'enemy', range: 7, color: '#6a6a80', desc: '使一名敌方英雄减速 30%，造成的伤害降低 35%，持续 3 秒。' },
  cleanse: { name: '净化', cd: 150, aim: 'none', color: '#4aa8c0', desc: '解除身上的眩晕、禁锢、减速、沉默与魅惑，3 秒内所受控制时间大幅缩短。' },
  teleport: { name: '传送', cd: 240, aim: 'tp', color: '#8a4ad0', desc: '引导 4 秒后，传送到鼠标附近的一座友方防御塔或一个友方小兵身边。' },
  smite: { name: '惩戒', cd: 60, aim: 'unit', range: 6, color: '#d08030', desc: '对一只野怪造成 600 点真实伤害，或对一个小兵造成 400 点真实伤害。打野必带。' },
};
export const SPELL_IDS = Object.keys(SPELLS);

// 返回 'ok' 或失败原因
export function castSpell(h, id, aim, target) {
  const W = h.world, sp = SPELLS[id];
  const lvl = h.level;
  if (id === 'flash') return h.flash(aim);
  if (id === 'heal') {
    const amt = 90 + 18 * lvl;
    const ally = W.alliesIn(h.team, h.pos, 8, true).filter(u => u !== h).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    for (const u of [h, ally]) {
      if (!u) continue;
      W.heal(u, amt); u.addBuff('healHaste', 1.5, { haste: 0.3 });
      W.vfx.pillar(u.pos, { color: '#9dffa0', r: 1.2, h: 5, dur: 0.6 });
      W.vfx.puff(u.pos, { n: 14, color: '#8fff9a', cell: 'leaf', size: 0.6, speed: 2, up: 1.5 });
    }
    W.sfx('heal', h.pos);
    return 'ok';
  }
  if (id === 'barrier') {
    W.shield(h, 95 + 25 * lvl, 2.5, '#ffd76a');
    W.vfx.ring(h.pos, { r1: 3, color: '#ffe27a' });
    W.vfx.puff(h.pos, { n: 12, color: '#fff3a0', cell: 'spark', glow: true, size: 0.7, speed: 3 });
    W.sfx('shield', h.pos);
    return 'ok';
  }
  if (id === 'ghost') {
    h.addBuff('ghost', 8, { haste: 0.45 });
    const e = W.vfx.aura(h, { color: '#b58aff', glow: true, r: 1.1, dur: 8, particles: 10, pcolor: '#d8c0ff' });
    W.vfx.add(null, 8, () => { if (h.moving && Math.random() < 0.6) W.vfx.trail({ x: h.pos.x, y: 1.2, z: h.pos.z }, { color: '#c8a8ff', glow: true, cell: 'glow', size: 1.2, life: 0.4, vy: 0 }); if (h.dead) e.kill = true; });
    W.vfx.comic(h.pos, '冲!', { color: '#c8a8ff', size: 1.8 });
    W.sfx('whoosh', h.pos);
    return 'ok';
  }
  if (id === 'cleanse') {
    h.buffs = h.buffs.filter(b => !['stun', 'root', 'charm', 'silence', 'knockup'].includes(b.id) && !b.slow);
    h.path = null;
    h.addBuff('cleanse', 3, {});
    h.tenacityBuff = W.time + 3;
    W.vfx.bubble(h.pos, { color: '#bff0ff', r0: 0.5, r1: 2.2, dur: 0.5, opacity: 0.5, y: 1.2 });
    W.vfx.puff(h.pos, { n: 16, color: ['#bff0ff', '#ffffff'], cell: 'spark', glow: true, size: 0.7, speed: 3, up: 2 });
    W.sfx('ice', h.pos);
    return 'ok';
  }
  if (id === 'ignite' || id === 'exhaust') {
    const t = pickEnemyHero(h, aim, target, sp.range);
    if (!t) return 'notarget';
    h.face(t.pos.x, t.pos.z); h.facing = h.faceTarget;
    if (id === 'ignite') {
      const total = 50 + 20 * lvl;
      t.addBuff('ignite', 5, { grievous: 0.6, every: 0.5, tick: (u) => {
        W.damage(h, u, total / 10, { type: 'true', noText: true, item: true });
        W.vfx.puff(u.pos, { n: 2, color: ['#ffb030', '#ff5a20'], cell: 'flame', size: 0.5, y: 1.2, speed: 1.5 });
      } });
      W.vfx.comic(t.pos, '燃!', { color: '#ff7a3a', size: 1.8 });
      W.sfx('fire', t.pos);
    } else {
      t.addBuff('exhaust', 3, { slow: 0.3, weaken: 0.35 });
      W.vfx.aura(t, { color: '#8a8aa8', r: 1.2, dur: 3, particles: 6, pcolor: '#c8c8e0', pglow: false, pcell: 'puff' });
      W.vfx.comic(t.pos, '虚!', { color: '#c8c8e0', size: 1.8 });
      W.sfx('stun', t.pos);
    }
    return 'ok';
  }
  if (id === 'smite') {
    let t = target && !t0(target, h) ? target : null;
    if (!t) t = W.enemiesIn(h.team, aim, 4).filter(u => (u.kind === 'monster' || u.kind === 'minion') && h.dist(u) <= sp.range + u.radius)
      .sort((a, b) => Math.hypot(a.pos.x - aim.x, a.pos.z - aim.z) - Math.hypot(b.pos.x - aim.x, b.pos.z - aim.z))[0];
    if (!t) return 'notarget';
    W.damage(h, t, t.kind === 'monster' ? 600 : 400, { type: 'true', color: '#ffb040' });
    W.vfx.beam(new THREE.Vector3(t.pos.x, 14, t.pos.z), new THREE.Vector3(t.pos.x, 0, t.pos.z), { width: 1.2, color: '#ffb040', dur: 0.4 });
    W.vfx.pillar(t.pos, { color: '#ffb040', r: 1.2, h: 12, dur: 0.4 });
    W.vfx.puff(t.pos, { n: 14, color: '#ffd060', cell: 'spark', glow: true, size: 0.8, speed: 5, y: 1 });
    W.vfx.comic(t.pos, '惩戒!', { color: '#ffb040', size: 2 });
    W.sfx('thunder', t.pos);
    if (t.kind === 'monster') W.heal(h, 60 + 5 * lvl);
    return 'ok';
  }
  if (id === 'teleport') {
    const dest = pickTeleport(h, aim);
    if (!dest) return 'notarget';
    h.stop(); h.cancelRecall();
    h.tpT = 4; h.tpDest = dest;
    h.addBuff('channel', 4);
    h.rig.play('channel', 4);
    const col = '#b58aff';
    h.tpFx = [W.vfx.recall(h, 4, col), W.vfx.recall({ pos: new THREE.Vector3(dest.x, 0, dest.z), dead: false }, 4, col)].flat();
    W.sfx('recall', h.pos);
    return 'ok';
  }
  return 'none';
}
function t0(u, h) { return !(u.kind === 'monster' || u.kind === 'minion') || u.team === h.team || !u.targetable || h.dist(u) > SPELLS.smite.range + u.radius; }
function pickEnemyHero(h, aim, target, range) {
  if (target && target.kind === 'hero' && target.team !== h.team && target.targetable && !target.inFog && h.dist(target) <= range + 1) return target;
  return h.world.enemiesIn(h.team, aim, 4, { heroOnly: true }).filter(u => !u.inFog && h.dist(u) <= range + 1)
    .sort((a, b) => Math.hypot(a.pos.x - aim.x, a.pos.z - aim.z) - Math.hypot(b.pos.x - aim.x, b.pos.z - aim.z))[0] || null;
}
// 传送目标：鼠标附近的友方防御塔或小兵
function pickTeleport(h, aim) {
  let best = null, bd = 16;
  for (const u of h.world.units) {
    if (u.dead || u.removed || u.team !== h.team || !(u.kind === 'tower' || u.kind === 'minion')) continue;
    const d = Math.hypot(u.pos.x - aim.x, u.pos.z - aim.z);
    if (d < bd) { bd = d; best = u; }
  }
  if (!best) return null;
  const off = best.kind === 'tower' ? 2.5 : 1.2;
  return { x: best.pos.x + off, z: best.pos.z + off, unit: best };
}
// 引导传送：每帧由英雄调用
export function updateTeleport(h, dt) {
  if (!(h.tpT > 0)) return;
  const W = h.world;
  const cancel = h.dead || h.stunned || (h.tpDest.unit && h.tpDest.unit.dead && h.tpDest.unit.kind === 'tower');
  if (cancel) { endTeleport(h); return; }
  if (h.tpDest.unit && h.tpDest.unit.kind === 'minion' && !h.tpDest.unit.dead) { h.tpDest.x = h.tpDest.unit.pos.x + 1.2; h.tpDest.z = h.tpDest.unit.pos.z + 1.2; }
  h.tpT -= dt;
  if (h.tpT <= 0) {
    const p = W.clampDash(h.tpDest, h.tpDest, true);
    W.vfx.recallBurst(h.pos, '#b58aff');
    h.pos.set(p.x, 0, p.z); h.path = null;
    W.vfx.recallBurst(h.pos, '#b58aff');
    W.sfx('recallDone', h.pos);
    endTeleport(h, true);
    W.onTeleported && W.onTeleported(h);
  }
}
function endTeleport(h, done = false) {
  h.tpT = 0; h.removeBuff('channel');
  for (const e of h.tpFx || []) e.kill = true;
  h.tpFx = null;
  if (!done) h.rig.action = null;
}
