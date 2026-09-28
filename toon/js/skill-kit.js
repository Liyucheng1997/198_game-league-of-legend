// 技能实现共用的小工具：方向、扇形/直线判定、从天而降的物体。
import { clamp } from './toon-kit.js';

export const dirOf = (h, aim) => { const dx = aim.x - h.pos.x, dz = aim.z - h.pos.z, d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d }; };
export const fwd = (h) => ({ x: Math.sin(h.facing), z: Math.cos(h.facing) });
export const at = (p, d, k) => ({ x: p.x + d.x * k, z: p.z + d.z * k });
export const rot = (d, a) => ({ x: d.x * Math.cos(a) + d.z * Math.sin(a), z: -d.x * Math.sin(a) + d.z * Math.cos(a) });
export const distXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function inCone(W, h, dir, range, half, from = h.pos) {
  return W.enemiesIn(h.team, from, range).filter(u => {
    const dx = u.pos.x - from.x, dz = u.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    return (dx * dir.x + dz * dir.z) / d >= Math.cos(half);
  });
}
export function lineHits(W, h, a, b, width, o) {
  return W.enemiesIn(h.team, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, Math.hypot(b.x - a.x, b.z - a.z) / 2 + width, o).filter(u => {
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const t = clamp(((u.pos.x - a.x) * dx + (u.pos.z - a.z) * dz) / L2);
    return Math.hypot(a.x + dx * t - u.pos.x, a.z + dz * t - u.pos.z) <= width + u.radius;
  });
}
export const notMinion = (u) => u.kind !== 'minion';

// 从天而降的物体
export function dropFromSky(W, pos, mesh, dur, onLand, h0 = 14) {
  mesh.position.set(pos.x, h0, pos.z);
  W.vfx.add(mesh, dur + 0.7, (k, dt, e) => {
    const t = e.t / dur;
    if (t <= 1) mesh.position.y = h0 * (1 - t * t);
    else if (!e.landed) { e.landed = true; mesh.position.y = 0; onLand && onLand(); }
    else mesh.scale.multiplyScalar(1 - dt * 1.5);
  });
}

// 技能指示器形状：line 直线(w 半宽) / cone 扇形(a 半角) / circle 落点范围(r) / self 自身周围(r) / target 指向目标(r 目标周围范围)
export const L = (w, max) => ({ type: 'line', w, max }), C = (a) => ({ type: 'cone', a }), A = (r) => ({ type: 'circle', r }),
  SELF = (r) => ({ type: 'self', r }), T = (r) => ({ type: 'target', r }), NONE = { type: 'none' };
