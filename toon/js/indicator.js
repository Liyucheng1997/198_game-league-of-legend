// 范围指示器：攻击范围圈与技能瞄准形状（直线、扇形、落点圈、指向目标），手绘墨线风格。
import * as THREE from 'three';
import { canvasTex, INK, rng } from './toon-kit.js';

const OK = '#bfe6ff', BAD = '#ff8a7a', ATK = '#fff0a8';

function sketchArc(g, cx, cy, R, a0, a1, seed, lw, col, dash = 0) {
  const r = rng(seed);
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round';
  const steps = Math.ceil((a1 - a0) * 40);
  for (let i = 0; i < steps; i++) {
    if (dash && i % dash === dash - 1) continue;
    const t0 = a0 + (a1 - a0) * i / steps, t1 = a0 + (a1 - a0) * (i + 1) / steps, j = (r() - 0.5) * 2;
    g.beginPath(); g.arc(cx, cy, R + j, t0, t1 + 0.004); g.stroke();
  }
}
// 射程圈：内部淡淡的填色 + 手绘双线边
function ringTexture() {
  return canvasTex(512, 512, (g) => {
    const gr = g.createRadialGradient(256, 256, 180, 256, 256, 250);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.22)');
    g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
    sketchArc(g, 256, 256, 248, 0, Math.PI * 2, 3, 9, INK);
    sketchArc(g, 256, 256, 248, 0, Math.PI * 2, 4, 5, '#ffffff');
    sketchArc(g, 256, 256, 236, 0, Math.PI * 2, 5, 2.5, 'rgba(255,255,255,.8)', 4);
  });
}
// 落点范围：填色 + 排线 + 墨线边
function areaTexture() {
  return canvasTex(256, 256, (g) => {
    g.save(); g.beginPath(); g.arc(128, 128, 120, 0, 7); g.clip();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
    for (let i = -256; i < 256; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); }
    g.restore();
    sketchArc(g, 128, 128, 120, 0, Math.PI * 2, 7, 7, INK);
    sketchArc(g, 128, 128, 120, 0, Math.PI * 2, 8, 3.5, '#ffffff');
  });
}
// 直线技能：半透明长条 + 两侧墨线 + 末端箭头（纹理顶部 = 前方）
function lineTexture() {
  return canvasTex(128, 512, (g) => {
    const gr = g.createLinearGradient(0, 512, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,.42)');
    g.fillStyle = gr; g.fillRect(10, 30, 108, 482);
    g.beginPath(); g.moveTo(10, 30); g.lineTo(64, 2); g.lineTo(118, 30); g.closePath(); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill();
    g.lineJoin = 'round';
    for (const [w, c] of [[9, INK], [4, '#ffffff']]) {
      g.strokeStyle = c; g.lineWidth = w;
      g.beginPath(); g.moveTo(10, 512); g.lineTo(10, 30); g.lineTo(64, 2); g.lineTo(118, 30); g.lineTo(118, 512); g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 6; g.lineCap = 'round';
    for (const y of [70, 110, 150]) { g.beginPath(); g.moveTo(40, y + 20); g.lineTo(64, y); g.lineTo(88, y + 20); g.stroke(); }
  });
}
// 扇形：按角度缓存
const coneCache = new Map();
function coneTexture(half) {
  const key = half.toFixed(2);
  if (coneCache.has(key)) return coneCache.get(key);
  const t = canvasTex(512, 512, (g) => {
    const path = () => { g.beginPath(); g.moveTo(256, 256); g.arc(256, 256, 246, -half, half); g.closePath(); };
    path(); g.fillStyle = 'rgba(255,255,255,.32)'; g.fill();
    g.save(); path(); g.clip(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3;
    for (let r = 60; r < 250; r += 40) { g.beginPath(); g.arc(256, 256, r, -half, half); g.stroke(); }
    g.restore();
    g.lineJoin = 'round';
    for (const [w, c] of [[9, INK], [4, '#ffffff']]) { path(); g.strokeStyle = c; g.lineWidth = w; g.stroke(); }
  });
  coneCache.set(key, t);
  return t;
}

function flat(tex, order) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: OK });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mat);
  m.renderOrder = order; m.visible = false;
  return m;
}

export class RangeIndicator {
  constructor(scene) {
    this.ring = flat(ringTexture(), 6);
    this.atk = flat(this.ring.material.map, 6);
    this.atk.material.color.set(ATK);
    this.area = flat(areaTexture(), 7);
    this.tgt = flat(this.ring.material.map, 7);
    this.cone = flat(coneTexture(0.5), 7);
    const lg = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(-Math.PI / 2);
    this.line = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ map: lineTexture(), transparent: true, depthWrite: false, color: OK }));
    this.line.renderOrder = 7; this.line.visible = false;
    for (const m of [this.ring, this.atk, this.area, this.tgt, this.cone, this.line]) scene.add(m);
  }
  hideSkill() { for (const m of [this.ring, this.area, this.tgt, this.cone, this.line]) m.visible = false; }
  // 普攻范围
  showAttack(h, on) {
    const m = this.atk;
    m.visible = !!on && !h.dead;
    if (!m.visible) return;
    const r = h.range + h.radius * 0.5 + 0.6;
    m.position.set(h.pos.x, 0.07, h.pos.z); m.scale.set(r, 1, r);
  }
  // 技能指示：aim 为鼠标地面点，target 为当前会被选中的单位
  showSkill(h, sk, aim, target, valid = true) {
    this.hideSkill();
    if (!sk || h.dead) return;
    const ind = sk.ind || { type: 'none' };
    const col = valid ? OK : BAD;
    for (const m of [this.ring, this.area, this.tgt, this.cone, this.line]) m.material.color.set(col);
    const y = 0.08, hx = h.pos.x, hz = h.pos.z;
    let dx = aim.x - hx, dz = aim.z - hz;
    const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const R = sk.range || ind.r || 0;
    // 射程圈（全图技能或超远距离不画）
    if (R > 0 && R <= 30 && ind.type !== 'self') {
      this.ring.visible = true; this.ring.position.set(hx, y - 0.01, hz); this.ring.scale.set(R, 1, R);
    }
    if (ind.type === 'line') {
      const L = Math.min(R, ind.max || R);
      this.line.visible = true;
      this.line.position.set(hx, y, hz);
      this.line.rotation.y = Math.atan2(-dx, -dz);
      this.line.scale.set(ind.w * 2, 1, L);
    } else if (ind.type === 'cone') {
      this.cone.material.map = coneTexture(ind.a);
      this.cone.visible = true;
      this.cone.position.set(hx, y, hz);
      this.cone.rotation.y = Math.atan2(-dz, dx);
      this.cone.scale.set(R, 1, R);
    } else if (ind.type === 'circle') {
      const k = Math.min(d, R);
      this.area.visible = true;
      this.area.position.set(hx + dx * k, y + 0.01, hz + dz * k);
      this.area.scale.set(ind.r, 1, ind.r);
    } else if (ind.type === 'self') {
      this.area.visible = true; this.area.position.set(hx, y, hz); this.area.scale.set(ind.r, 1, ind.r);
    } else if (ind.type === 'target') {
      if (target) {
        const tr = (target.radius || 0.6) + 0.5;
        this.tgt.visible = true; this.tgt.position.set(target.pos.x, y + 0.01, target.pos.z); this.tgt.scale.set(tr, 1, tr);
        if (ind.r) { this.area.visible = true; this.area.position.set(target.pos.x, y, target.pos.z); this.area.scale.set(ind.r, 1, ind.r); }
      }
    }
  }
  dispose() { for (const m of [this.ring, this.atk, this.area, this.tgt, this.cone, this.line]) m.parent && m.parent.remove(m); }
}
