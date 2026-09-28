// 十位英雄的 Q 版手绘建模：全部由基础几何体拼装，无任何外部模型文件。
import * as THREE from 'three';
import { P, G, toon, glowMat, canvasTex } from './toon-kit.js';
import { Rig, chain } from './rig.js';

export const SKIN = '#f5cfb4';
const DS = THREE.DoubleSide;

export function held(hand, rx = Math.PI / 2, o = {}) {
  const g = new THREE.Group();
  g.rotation.set(rx, o.ry || 0, o.rz || 0);
  if (o.pos) g.position.set(...o.pos);
  hand.add(g);
  return g;
}
export function tipAt(parent, x, y, z) {
  const t = new THREE.Object3D(); t.position.set(x, y, z); parent.add(t); return t;
}
export function hairCap(r, color, o = {}) {
  const R = r.s.headR;
  return P(G.hemi(), color, {
    parent: r.head, mat: toon(color, { side: DS }),
    s: [R * (o.sx ?? 1.1), R * (o.sy ?? 1.1), R * (o.sz ?? 1.1)],
    rot: [o.tilt ?? -0.5, 0, 0], pos: [0, R * (o.y ?? 0.02), -R * (o.back ?? 0.04)], ol: 0.03,
  });
}
export function blob(r, parent, color, nx, ny, nz, s, lift = 0) {
  const p = r.onHead(nx, ny, nz, lift);
  return P(G.sphere(), color, { parent, pos: p.pos, rot: p.rot, order: 'YXZ', s });
}
export function spikeOnHead(r, color, nx, ny, nz, rad, len, tilt = 0) {
  const p = r.onHead(nx, ny, nz, -rad * 0.4);
  const g = new THREE.Group(); g.position.set(...p.pos); g.rotation.set(p.rot[0], p.rot[1], 0, 'YXZ'); r.head.add(g);
  P(G.cone(rad, len, 8), color, { parent: g, pos: [0, 0, len * 0.4], rot: [Math.PI / 2 + tilt, 0, 0] });
  return g;
}
export function cape(r, color, o = {}) {
  const s = r.s;
  const pivot = new THREE.Group();
  pivot.position.set(0, s.bodyH * (o.y ?? 0.86), -s.bodyW * 0.72);
  r.torso.add(pivot);
  const w = o.w ?? s.bodyW * 2.1, h = o.h ?? 1.0;
  P(G.box(w, h / 2, 0.05), color, { parent: pivot, pos: [0, -h / 4, 0] });
  const lower = new THREE.Group(); lower.position.y = -h / 2; pivot.add(lower);
  P(G.box(w * 1.06, h / 2, 0.05), o.color2 || color, { parent: lower, pos: [0, -h / 4, 0] });
  if (o.trim) P(G.box(w * 1.08, 0.08, 0.07), o.trim, { parent: lower, pos: [0, -h / 2, 0] });
  r.hooks.push((dt, t) => {
    const sp = r.moveBlend;
    pivot.rotation.x = 0.1 + sp * 0.6 + Math.sin(t * 7) * 0.05 * (0.4 + sp);
    lower.rotation.x = 0.08 + sp * 0.35 + Math.sin(t * 7 - 1.2) * 0.09 * (0.4 + sp);
  });
  return pivot;
}
export function sway(r, nodes, amp = 0.15, speed = 3, base = 0.12) {
  r.hooks.push((dt, t) => {
    nodes.forEach((n, j) => {
      n.rotation.x = base * (j + 1) * 0.3 + r.moveBlend * 0.25 + Math.sin(t * speed - j * 0.8) * amp;
      n.rotation.z = Math.sin(t * speed * 0.7 - j) * amp * 0.5;
    });
  });
}

// ---------------- 盖伦 ----------------
function garen() {
  const r = new Rig({ scale: 1.1, bodyW: 0.46, bodyH: 0.8, headR: 0.56, armR: 0.14, legR: 0.16 });
  const blue = '#4d6fb8', steel = '#9aa9c2', gold = '#e8c25a';
  r.torsoMesh(blue);
  P(G.sphere(), '#6d8fd6', { parent: r.torso, pos: [0, 0.5, 0.16], s: [0.42, 0.33, 0.32] });
  P(G.octa(0.12), gold, { parent: r.torso, pos: [0, 0.52, 0.47], s: [1, 1.3, 0.5] });
  P(G.torus(0.46, 0.05), gold, { parent: r.torso, pos: [0, 0.1, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt('#34456e', 0.32, 1.3, 0.1, 'garen');
  r.limbs({ sleeve: blue, fore: steel, hand: steel, pants: '#34456e', boots: '#7c8aa6' });
  for (const [A, s] of [[r.armL, 1], [r.armR, -1]]) {
    P(G.sphere(), '#6d8fd6', { parent: A, pos: [s * 0.05, 0.02, 0], s: [0.28, 0.23, 0.28] });
    P(G.torus(0.26, 0.035), gold, { parent: A, pos: [s * 0.05, -0.06, 0], rot: [Math.PI / 2, 0, 0] });
  }
  r.headBall(SKIN);
  hairCap(r, '#6b4a2e', { tilt: -0.75 });
  for (let i = 0; i < 5; i++) spikeOnHead(r, '#6b4a2e', (i - 2) * 0.25, 0.75, 0.25 - Math.abs(i - 2) * 0.05, 0.14, 0.34, -0.5);
  r.face({ eye: '#2e4a7a', brow: 0.35, mouth: 'line', blush: false, eyeH: 0.16 });
  cape(r, '#2f4c92', { trim: gold, h: 1.05 });
  // 大剑
  const w = held(r.handR, Math.PI / 2 - 0.35);
  P(G.cyl(0.035, 0.035, 0.3, 8), '#5a3b26', { parent: w, pos: [0, 0.02, 0] });
  P(G.sphere(), gold, { parent: w, pos: [0, -0.15, 0], s: 0.07 });
  P(G.box(0.52, 0.08, 0.12), gold, { parent: w, pos: [0, 0.2, 0] });
  P(G.cyl(0.1, 0.13, 1.45, 4), '#e4ebf2', { parent: w, pos: [0, 0.96, 0], s: [1, 1, 0.3], rot: [0, Math.PI / 4, 0] });
  P(G.cone(0.1, 0.28, 4), '#e4ebf2', { parent: w, pos: [0, 1.82, 0], s: [1, 1, 0.3], rot: [0, Math.PI / 4, 0] });
  P(G.box(0.04, 1.2, 0.05), '#b8c6d6', { parent: w, pos: [0, 0.9, 0.02], outline: false });
  r.tip = tipAt(w, 0, 1.9, 0);
  return r;
}

// ---------------- 德莱厄斯 ----------------
function darius() {
  const r = new Rig({ scale: 1.14, bodyW: 0.48, bodyH: 0.8, headR: 0.54, armR: 0.15, legR: 0.17 });
  const dark = '#3b3139', red = '#a8232d', gold = '#c9a24a';
  r.torsoMesh(dark);
  P(G.sphere(), '#54444f', { parent: r.torso, pos: [0, 0.5, 0.15], s: [0.44, 0.34, 0.34] });
  P(G.box(0.16, 0.34, 0.06), red, { parent: r.torso, pos: [0, 0.35, 0.44], rot: [-0.2, 0, 0] });
  P(G.torus(0.48, 0.055), gold, { parent: r.torso, pos: [0, 0.1, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(red, 0.36, 1.32, 0.1, 'darius');
  r.limbs({ sleeve: dark, fore: '#6b5a64', hand: '#6b5a64', pants: '#2a2429', boots: '#4a3c44' });
  for (const [A, s] of [[r.armL, 1], [r.armR, -1]]) {
    P(G.sphere(), '#54444f', { parent: A, pos: [s * 0.06, 0.04, 0], s: [0.3, 0.24, 0.3] });
    for (let i = 0; i < 3; i++) P(G.cone(0.07, 0.3, 6), red, { parent: A, pos: [s * (0.12 + i * 0.07), 0.24, (i - 1) * 0.12], rot: [0, 0, -s * (0.5 + i * 0.25)] });
  }
  r.headBall('#dca57f');
  hairCap(r, '#1f1a1f', { tilt: -0.8, sy: 1.05 });
  P(G.box(0.08, 0.1, 0.5), '#b9b3b9', { parent: r.head, pos: [0.18, 0.5, -0.02], rot: [0.2, 0, 0] });
  blob(r, r.head, '#3a2c2c', 0, -0.62, 0.7, [0.3, 0.16, 0.18], -0.06);
  r.face({ eye: '#6a1f22', brow: 0.5, mouth: 'line', blush: false, eyeH: 0.14, browCol: '#1f1a1f' });
  cape(r, red, { trim: dark, h: 1.1, color2: '#8e1c25' });
  // 双刃巨斧
  const w = held(r.handR, 0.35, { rz: 0.25 });
  P(G.cyl(0.05, 0.05, 2.0, 8), '#3a2a22', { parent: w, pos: [0, 0.55, 0] });
  P(G.sphere(), gold, { parent: w, pos: [0, -0.45, 0], s: 0.08 });
  const blade = () => { const s = new THREE.Shape(); s.moveTo(0, 0.26); s.quadraticCurveTo(0.3, 0.3, 0.6, 0.55); s.quadraticCurveTo(0.9, 0, 0.6, -0.55); s.quadraticCurveTo(0.3, -0.3, 0, -0.26); s.closePath(); return s; };
  const bg = G.shape('dariusBlade', blade, 0.05, 0.02);
  const head = new THREE.Group(); head.position.y = 1.4; w.add(head);
  P(bg, '#a3acb6', { parent: head, pos: [-0.4, 0, 0], rot: [0, Math.PI, 0] });
  P(bg, '#a3acb6', { parent: head, pos: [0.4, 0, 0] });
  P(G.box(0.2, 0.5, 0.16), red, { parent: head });
  P(G.cone(0.08, 0.35, 6), red, { parent: head, pos: [0, 0.4, 0] });
  r.tip = tipAt(head, 0.8, 0, 0);
  return r;
}

// ---------------- 艾希 ----------------
function ashe() {
  const r = new Rig({ scale: 1.0, bodyW: 0.4, bodyH: 0.76, headR: 0.58 });
  const blue = '#5d8fcf', deep = '#2f5591', fur = '#f4f1ea';
  r.torsoMesh('#3e6db0');
  P(G.torus(0.41, 0.05), '#c9a24a', { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(deep, 0.34, 1.35, 0.12, 'ashe');
  r.limbs({ sleeve: blue, fore: '#e8eef7', hand: '#8a5a3c', pants: '#e2e0ea', boots: '#8a5a3c' });
  for (const Fo of [r.footL, r.footR]) P(G.torus(0.14, 0.05), fur, { parent: Fo, pos: [0, 0.12, 0.03], rot: [Math.PI / 2, 0, 0] });
  r.headBall(SKIN);
  hairCap(r, '#e9edf5', { tilt: -0.55 });
  blob(r, r.head, '#e9edf5', 0.35, 0.35, 0.82, [0.22, 0.1, 0.1], 0.0);
  blob(r, r.head, '#e9edf5', -0.2, 0.42, 0.85, [0.2, 0.09, 0.1], 0.0);
  // 兜帽
  P(G.hemi(), blue, { parent: r.head, mat: toon(blue, { side: DS }), s: [0.7, 0.72, 0.7], rot: [-0.35, 0, 0], pos: [0, 0.03, -0.06] });
  P(G.torus(0.56, 0.07, Math.PI * 2, 8, 24), fur, { parent: r.head, pos: [0, 0.08, 0.2], rot: [-0.35, 0, 0] });
  // 侧边长发
  for (const s of [1, -1]) {
    const lock = new THREE.Group(); lock.position.set(s * 0.46, -0.1, 0.12); r.head.add(lock);
    const nodes = chain(lock, 3, (g) => P(G.sphere(), '#e9edf5', { parent: g, pos: [0, -0.12, 0], s: [0.11, 0.18, 0.1] }), -0.24);
    sway(r, nodes, 0.08, 2.5, 0.05);
  }
  r.face({ eye: '#3a6fc0', brow: 0.1, browCol: '#c9d0de' });
  cape(r, blue, { trim: fur, h: 0.95, color2: deep });
  // 箭袋
  const q = new THREE.Group(); q.position.set(0.18, 0.55, -0.42); q.rotation.set(0.2, 0, -0.5); r.torso.add(q);
  P(G.cyl(0.12, 0.1, 0.6, 10), '#8a5a3c', { parent: q });
  for (let i = 0; i < 3; i++) P(G.box(0.1, 0.18, 0.02), '#ffffff', { parent: q, pos: [(i - 1) * 0.06, 0.4, 0], ol: 0.01 });
  // 冰弓：左手
  const bow = new THREE.Group(); bow.rotation.set(0, -Math.PI / 2, -Math.PI / 2, 'YXZ'); bow.position.set(0, 0.8, 0); r.handL.add(bow);
  const arc = Math.PI * 0.84;
  P(G.torus(0.8, 0.05, arc, 6, 26), '#9fd8ff', { parent: bow, rot: [0, 0, -arc / 2], emissive: '#4aa8ff', ei: 0.35 });
  for (const s of [1, -1]) P(G.octa(0.12), '#e6f7ff', { parent: bow, pos: [0.8 * Math.cos(arc / 2), s * 0.8 * Math.sin(arc / 2), 0], s: [0.7, 1.6, 0.7], emissive: '#7fd0ff', ei: 0.6 });
  P(G.cyl(0.008, 0.008, 1.6 * Math.sin(arc / 2), 4), '#ffffff', { parent: bow, pos: [0.8 * Math.cos(arc / 2), 0, 0], outline: false, emissive: '#ffffff' });
  P(G.box(0.1, 0.24, 0.1), '#8a5a3c', { parent: bow, pos: [0.8, 0, 0] });
  r.tip = tipAt(bow, 0.8, 0, 0);
  return r;
}

// ---------------- 凯特琳 ----------------
function caitlyn() {
  const r = new Rig({ scale: 1.04, bodyW: 0.4, bodyH: 0.78, headR: 0.57, legLen: 0.56 });
  const purple = '#6a45a8', dark = '#40286e', gold = '#e0b85a';
  r.torsoMesh(purple);
  P(G.box(0.2, 0.5, 0.06), '#f2ecf8', { parent: r.torso, pos: [0, 0.48, 0.38], rot: [-0.1, 0, 0] });
  P(G.torus(0.41, 0.05), dark, { parent: r.torso, pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(dark, 0.3, 1.3, 0.14, 'cait');
  r.limbs({ sleeve: purple, fore: '#f2ecf8', hand: '#f2ecf8', pants: '#35244f', boots: '#35244f' });
  r.headBall(SKIN);
  hairCap(r, '#3b2345', { tilt: -0.45 });
  // 长发
  P(G.sphere(), '#3b2345', { parent: r.head, pos: [0, -0.3, -0.25], s: [0.55, 0.62, 0.4] });
  for (const s of [1, -1]) P(G.capsule(0.13, 0.55), '#3b2345', { parent: r.head, pos: [s * 0.46, -0.45, 0.02], rot: [0, 0, s * 0.08] });
  r.face({ eye: '#3b5aa0', brow: 0.05, browCol: '#3b2345' });
  // 礼帽
  const hat = new THREE.Group(); hat.position.set(0.04, 0.5, -0.02); hat.rotation.set(-0.15, 0, -0.15); r.head.add(hat);
  P(G.cyl(0.66, 0.66, 0.05, 28), purple, { parent: hat });
  P(G.cyl(0.38, 0.42, 0.55, 24), purple, { parent: hat, pos: [0, 0.3, 0] });
  P(G.cyl(0.425, 0.425, 0.1, 24), gold, { parent: hat, pos: [0, 0.1, 0] });
  P(G.box(0.1, 0.12, 0.12), '#7fd7ff', { parent: hat, pos: [0, 0.1, 0.42], emissive: '#40a0ff', ei: 0.5 });
  // 狙击步枪
  const w = held(r.handR, Math.PI - 0.35, { pos: [0, 0, 0.05] });
  P(G.box(0.14, 0.3, 0.2), '#7a4a2a', { parent: w, pos: [0, -0.25, 0] });
  P(G.box(0.16, 0.45, 0.2), purple, { parent: w, pos: [0, 0.2, 0] });
  P(G.cyl(0.055, 0.06, 1.3, 10), '#3a3440', { parent: w, pos: [0, 1.05, 0] });
  P(G.cyl(0.08, 0.08, 0.12, 10), gold, { parent: w, pos: [0, 1.7, 0] });
  P(G.cyl(0.06, 0.06, 0.4, 10), gold, { parent: w, pos: [0, 0.35, -0.15] });
  r.tip = tipAt(w, 0, 1.8, 0);
  return r;
}

// ---------------- 阿狸 ----------------
function ahri() {
  const r = new Rig({ scale: 1.0, bodyW: 0.38, bodyH: 0.76, headR: 0.58 });
  const red = '#c93b4e', cream = '#f7efe6', hair = '#2d1f33';
  r.torsoMesh(cream);
  P(G.box(0.5, 0.12, 0.06), red, { parent: r.torso, pos: [0, 0.62, 0.3], rot: [-0.3, 0, 0.5] });
  P(G.torus(0.39, 0.06), red, { parent: r.torso, pos: [0, 0.15, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(red, 0.3, 1.45, 0.15, 'ahri1');
  r.skirt(cream, 0.2, 1.25, 0.16, 'ahri2');
  r.limbs({ sleeve: cream, fore: cream, hand: SKIN, pants: '#f3dcd2', boots: red });
  for (const F of [r.foreL, r.foreR]) P(G.cyl(0.13, 0.2, 0.2, 12), red, { parent: F, pos: [0, -0.25, 0] });
  r.headBall(SKIN);
  hairCap(r, hair, { tilt: -0.4 });
  for (let i = 0; i < 4; i++) blob(r, r.head, hair, (i - 1.5) * 0.28, 0.42, 0.85, [0.16, 0.2, 0.1], -0.02);
  P(G.sphere(), hair, { parent: r.head, pos: [0, -0.35, -0.22], s: [0.58, 0.7, 0.42] });
  // 狐耳
  for (const s of [1, -1]) {
    const e = new THREE.Group(); e.position.set(s * 0.32, 0.5, -0.05); e.rotation.set(-0.1, 0, -s * 0.35); r.head.add(e);
    P(G.cone(0.17, 0.42, 4), hair, { parent: e, pos: [0, 0.18, 0], rot: [0, Math.PI / 4, 0], s: [1, 1, 0.55] });
    P(G.cone(0.1, 0.28, 4), '#ff9ab8', { parent: e, pos: [0, 0.15, 0.05], rot: [0, Math.PI / 4, 0], s: [1, 1, 0.4], outline: false });
    r.hooks.push((dt, t) => { e.rotation.x = -0.1 + Math.max(0, Math.sin(t * 1.7) - 0.9) * 3; });
  }
  r.face({ eye: '#d9a441', eyeH: 0.2, blushCol: '#ff7aa2' });
  // 九尾
  const base = new THREE.Group(); base.position.set(0, 0.12, -0.32); r.hips.add(base);
  for (let i = 0; i < 9; i++) {
    const a = (i - 4) / 4;
    const root = new THREE.Group(); root.rotation.set(-1.0 + Math.abs(a) * 0.25, 0, a * 1.15); base.add(root);
    const nodes = chain(root, 4, (g, j) => {
      const sz = [0.13, 0.17, 0.18, 0.14][j];
      P(G.sphere(), j === 3 ? '#ffffff' : cream, { parent: g, pos: [0, 0.14, 0], s: [sz, sz * 1.5, sz] });
    }, 0.27);
    r.hooks.push((dt, t) => {
      nodes.forEach((n, j) => {
        n.rotation.x = -0.12 + Math.sin(t * 2.6 + i * 0.7 - j * 0.9) * 0.2 - r.moveBlend * 0.18;
        n.rotation.z = Math.sin(t * 1.9 + i - j * 0.6) * 0.12;
      });
    });
  }
  // 宝珠
  const orb = new THREE.Group(); orb.position.set(0, -0.12, 0.12); r.handR.add(orb);
  P(G.sphere(16, 12), '#7fb7ff', { parent: orb, s: 0.17, emissive: '#6aa0ff', ei: 0.8 });
  const glow = new THREE.Mesh(G.sphere(12, 8), glowMat('#b58aff', 0.5)); glow.scale.setScalar(0.3); orb.add(glow);
  r.hooks.push((dt, t) => { glow.scale.setScalar(0.28 + Math.sin(t * 6) * 0.04); });
  r.tip = orb;
  return r;
}

// ---------------- 拉克丝 ----------------
function lux() {
  const r = new Rig({ scale: 1.0, bodyW: 0.39, bodyH: 0.76, headR: 0.58 });
  const white = '#eef2f8', blue = '#4a78cf', gold = '#e8c25a', hair = '#f3cf57';
  r.torsoMesh(white);
  P(G.sphere(), blue, { parent: r.torso, pos: [0, 0.4, 0.16], s: [0.34, 0.3, 0.26] });
  P(G.octa(0.09), gold, { parent: r.torso, pos: [0, 0.5, 0.42], s: [1, 1.4, 0.5] });
  P(G.torus(0.4, 0.05), gold, { parent: r.torso, pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(blue, 0.32, 1.4, 0.14, 'lux');
  r.limbs({ sleeve: white, fore: blue, hand: white, pants: '#f4f4fa', boots: blue });
  for (const [A, s] of [[r.armL, 1], [r.armR, -1]]) P(G.sphere(), white, { parent: A, pos: [s * 0.04, 0.02, 0], s: [0.2, 0.16, 0.2] });
  r.headBall(SKIN);
  hairCap(r, hair, { tilt: -0.45 });
  for (let i = 0; i < 4; i++) blob(r, r.head, hair, (i - 1.2) * 0.3, 0.4, 0.86, [0.17, 0.2, 0.1], -0.02);
  for (const s of [1, -1]) P(G.capsule(0.12, 0.35), hair, { parent: r.head, pos: [s * 0.5, -0.3, 0.12] });
  const pony = new THREE.Group(); pony.position.set(0, 0.2, -0.55); pony.rotation.x = -2.5; r.head.add(pony);
  const nodes = chain(pony, 3, (g, j) => P(G.sphere(), hair, { parent: g, pos: [0, 0.14, 0], s: [0.18 - j * 0.03, 0.26, 0.16 - j * 0.03] }), 0.26);
  sway(r, nodes, 0.12, 3, -0.2);
  P(G.box(0.3, 0.06, 0.06), blue, { parent: r.head, pos: [0, 0.2, -0.56] });
  r.face({ eye: '#3d7de0', eyeH: 0.2 });
  // 魔杖
  const w = held(r.handR, 0.2);
  P(G.cyl(0.04, 0.045, 1.4, 8), white, { parent: w, pos: [0, 0.35, 0] });
  P(G.torus(0.16, 0.035), gold, { parent: w, pos: [0, 1.1, 0] });
  const gem = P(G.octa(0.13), '#fff38a', { parent: w, pos: [0, 1.1, 0], s: [1, 1.4, 1], emissive: '#ffe040', ei: 0.9 });
  const halo = new THREE.Mesh(G.sphere(12, 8), glowMat('#fff2a0', 0.45)); halo.scale.setScalar(0.3); gem.add(halo);
  r.hooks.push((dt, t) => { gem.rotation.y = t * 2; });
  r.tip = tipAt(w, 0, 1.1, 0);
  return r;
}

// ---------------- 小熊提伯斯（安妮手中 / 召唤体） ----------------
export function teddy(scale = 1, fiery = false) {
  const g = new THREE.Group();
  const fur = fiery ? '#4a3228' : '#6b4a36';
  P(G.sphere(), fur, { parent: g, pos: [0, 0.3, 0], s: [0.3, 0.34, 0.26] });
  P(G.sphere(), fur, { parent: g, pos: [0, 0.78, 0], s: 0.27 });
  for (const s of [1, -1]) {
    P(G.sphere(), fur, { parent: g, pos: [s * 0.2, 1.0, 0], s: 0.1 });
    P(G.sphere(), '#e0a3b0', { parent: g, pos: [s * 0.2, 1.0, 0.05], s: 0.05, outline: false });
    P(G.capsule(0.08, 0.14), fur, { parent: g, pos: [s * 0.3, 0.38, 0.05], rot: [0, 0, s * 0.8] });
    P(G.capsule(0.09, 0.1), fur, { parent: g, pos: [s * 0.14, 0.02, 0.06] });
  }
  P(G.sphere(), '#d9b48f', { parent: g, pos: [0, 0.72, 0.22], s: [0.12, 0.09, 0.08] });
  P(G.cyl(0.05, 0.05, 0.02, 10), '#2a2340', { parent: g, pos: [0.1, 0.84, 0.24], rot: [Math.PI / 2, 0, 0], ol: 0.01 });
  P(G.box(0.08, 0.02, 0.02), '#2a2340', { parent: g, pos: [-0.1, 0.84, 0.25], rot: [0, 0, 0.7], outline: false });
  P(G.box(0.08, 0.02, 0.02), '#2a2340', { parent: g, pos: [-0.1, 0.84, 0.25], rot: [0, 0, -0.7], outline: false });
  P(G.box(0.02, 0.2, 0.02), '#e0d0a0', { parent: g, pos: [0, 0.35, 0.26], outline: false });
  if (fiery) for (let i = 0; i < 4; i++) P(G.cone(0.1, 0.3, 6), '#ff7a2a', { parent: g, pos: [(i - 1.5) * 0.12, 0.62, -0.2], rot: [-0.5, 0, 0], emissive: '#ff5a10', ei: 0.8 });
  g.scale.setScalar(scale);
  return g;
}

// ---------------- 安妮 ----------------
function annie() {
  const r = new Rig({ scale: 0.84, bodyW: 0.38, bodyH: 0.62, headR: 0.66, legLen: 0.42, armLen: 0.3, foreLen: 0.26 });
  const pink = '#e8739b', hair = '#e0523e';
  r.torsoMesh(pink);
  P(G.torus(0.3, 0.06), '#ffffff', { parent: r.torso, pos: [0, 0.6, 0.02], rot: [Math.PI / 2 - 0.2, 0, 0] });
  r.skirt(pink, 0.28, 1.5, 0.14, 'annie');
  r.skirt('#ffffff', 0.05, 1.52, -0.1, 'annie2');
  r.limbs({ sleeve: pink, fore: SKIN, hand: SKIN, pants: '#ffffff', boots: '#7a3b5e' });
  r.headBall(SKIN);
  hairCap(r, hair, { tilt: -0.35, sy: 1.12 });
  for (let i = 0; i < 5; i++) blob(r, r.head, hair, (i - 2) * 0.22, 0.38, 0.88, [0.16, 0.17, 0.1], -0.02);
  for (const s of [1, -1]) P(G.sphere(), hair, { parent: r.head, pos: [s * 0.55, -0.25, -0.05], s: [0.2, 0.3, 0.26] });
  // 小熊耳发箍
  for (const s of [1, -1]) {
    const e = r.onHead(s * 0.5, 0.8, -0.05, 0.02);
    P(G.sphere(), '#8a5a3c', { parent: r.head, pos: e.pos, s: [0.16, 0.16, 0.08], rot: e.rot, order: 'YXZ' });
  }
  r.face({ eye: '#3f8a4a', eyeH: 0.21, eyeX: 0.34 });
  const bear = teddy(0.55); bear.position.set(0, -0.3, 0.12); bear.rotation.set(-0.2, 0.3, 0); r.handL.add(bear);
  r.tip = tipAt(r.handR, 0, -0.1, 0.1);
  return r;
}

// ---------------- 易 ----------------
function yi() {
  const r = new Rig({ scale: 1.02, bodyW: 0.4, bodyH: 0.78, headR: 0.55 });
  const gold = '#d6a646', green = '#3f6b3d', olive = '#4a5a34';
  r.torsoMesh(gold);
  P(G.box(0.12, 0.8, 0.06), green, { parent: r.torso, pos: [0.1, 0.42, 0.38], rot: [0, 0, 0.5] });
  P(G.torus(0.41, 0.07), green, { parent: r.torso, pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(gold, 0.38, 1.35, 0.14, 'yi');
  r.limbs({ sleeve: gold, fore: green, hand: '#5a4030', pants: '#3a4a33', boots: '#5a4030' });
  r.headBall('#e8c29c');
  P(G.hemi(), olive, { parent: r.head, mat: toon(olive, { side: DS }), s: [0.6, 0.62, 0.6], rot: [0.12, 0, 0], pos: [0, 0.02, 0] });
  P(G.torus(0.58, 0.05, Math.PI * 2, 6, 28), '#c9a24a', { parent: r.head, pos: [0, 0.03, 0], rot: [Math.PI / 2 + 0.12, 0, 0] });
  // 三目镜
  const lens = (nx, ny, nz, rad) => {
    const p = r.onHead(nx, ny, nz, 0.02);
    const g = new THREE.Group(); g.position.set(...p.pos); g.rotation.set(p.rot[0], p.rot[1], 0, 'YXZ'); r.head.add(g);
    P(G.cyl(rad * 1.2, rad * 1.2, 0.1, 16), '#2a2a22', { parent: g, rot: [Math.PI / 2, 0, 0] });
    P(G.cyl(rad, rad, 0.12, 16), '#8dff6a', { parent: g, rot: [Math.PI / 2, 0, 0], emissive: '#40ff30', ei: 0.7, outline: false });
    P(G.sphere(8, 6), '#ffffff', { parent: g, pos: [-rad * 0.35, rad * 0.35, 0.07], s: rad * 0.25, outline: false, emissive: '#fff' });
  };
  lens(0.36, -0.02, 0.9, 0.14); lens(-0.36, -0.02, 0.9, 0.14); lens(0, 0.42, 0.9, 0.1);
  const pony = new THREE.Group(); pony.position.set(0, 0.5, -0.2); pony.rotation.x = -2.2; r.head.add(pony);
  const nodes = chain(pony, 3, (g, j) => P(G.sphere(), '#1f1a1a', { parent: g, pos: [0, 0.12, 0], s: [0.12 - j * 0.02, 0.2, 0.12 - j * 0.02] }), 0.22);
  sway(r, nodes, 0.14, 3.2, -0.1);
  r.face({ mouth: 'line', blush: false, eye: '#1f1a1a', eyeH: 0.01 });
  // 长剑
  const w = held(r.handR, Math.PI / 2 - 0.25);
  P(G.cyl(0.035, 0.035, 0.32, 8), '#2a2020', { parent: w, pos: [0, 0.02, 0] });
  P(G.torus(0.1, 0.03), '#c9a24a', { parent: w, pos: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0] });
  P(G.cyl(0.045, 0.06, 1.55, 4), '#e8f0f4', { parent: w, pos: [0, 1.0, 0], s: [1, 1, 0.3], rot: [0, Math.PI / 4, 0] });
  P(G.cone(0.045, 0.22, 4), '#e8f0f4', { parent: w, pos: [0, 1.88, 0], s: [1, 1, 0.3], rot: [0, Math.PI / 4, 0] });
  r.tip = tipAt(w, 0, 1.9, 0);
  r.blade = w;
  return r;
}

// ---------------- 墨菲特 ----------------
function malphite() {
  const r = new Rig({ scale: 1.2, bodyW: 0.56, bodyH: 0.82, headR: 0.36, armR: 0.2, legR: 0.21, legLen: 0.45, armLen: 0.4, foreLen: 0.36, hipW: 0.25 });
  const rock = '#8d8174', rock2 = '#6f655b', amber = '#ffb347';
  const R = (parent, pos, s, col = rock, rot) => P(G.dodeca(1), col, { parent, pos, s, rot, ol: 0.035 });
  R(r.torso, [0, 0.42, 0], [0.66, 0.58, 0.52]);
  R(r.torso, [0, 0.72, -0.25], [0.52, 0.42, 0.38], rock2, [0.4, 0.3, 0]);
  R(r.torso, [0, 0.05, 0], [0.45, 0.28, 0.4], rock2);
  const crystal = (parent, pos, s, rot) => P(G.octa(1), amber, { parent, pos, s, rot, emissive: '#ff8a10', ei: 0.55, ol: 0.025 });
  crystal(r.torso, [0.2, 1.0, -0.35], [0.12, 0.35, 0.12], [0.5, 0, -0.4]);
  crystal(r.torso, [-0.15, 1.05, -0.4], [0.1, 0.3, 0.1], [0.6, 0, 0.3]);
  crystal(r.torso, [0.02, 0.5, 0.48], [0.1, 0.16, 0.06]);
  for (const [A, F, H, s] of [[r.armL, r.foreL, r.handL, 1], [r.armR, r.foreR, r.handR, -1]]) {
    R(A, [s * 0.08, 0.06, 0], [0.38, 0.34, 0.36], rock2, [0.3, 0, 0.4]);
    crystal(A, [s * 0.18, 0.4, -0.05], [0.09, 0.28, 0.09], [0, 0, -s * 0.5]);
    R(A, [0, -0.22, 0], [0.22, 0.28, 0.22]);
    R(F, [0, -0.18, 0], [0.22, 0.26, 0.22]);
    R(H, [0, -0.05, 0], [0.3, 0.28, 0.3], rock2);
  }
  for (const [L, Fo] of [[r.legL, r.footL], [r.legR, r.footR]]) {
    R(L, [0, -0.2, 0], [0.24, 0.3, 0.24]);
    R(Fo, [0, 0.04, 0.08], [0.25, 0.14, 0.32], rock2);
  }
  r.head.position.y = 0.95;
  R(r.head, [0, 0, 0], [0.4, 0.34, 0.36]);
  P(G.box(0.62, 0.12, 0.2), rock2, { parent: r.head, pos: [0, 0.12, 0.24], rot: [0.3, 0, 0] });
  for (const s of [1, -1]) P(G.box(0.14, 0.06, 0.05), '#ffe070', { parent: r.head, pos: [s * 0.13, 0.02, 0.33], rot: [0, 0, s * 0.25], emissive: '#ffb020', ei: 1, outline: false });
  r.tip = tipAt(r.handR, 0, -0.1, 0.2);
  return r;
}

// ---------------- 索拉卡 ----------------
function soraka() {
  const r = new Rig({ scale: 1.02, bodyW: 0.38, bodyH: 0.78, headR: 0.57, legLen: 0.52 });
  const skin = '#98a8e8', green = '#5fae6e', leaf = '#3f8a52', gold = '#f0cf6a', hair = '#f2eeff';
  r.torsoMesh(green);
  P(G.torus(0.39, 0.05), gold, { parent: r.torso, pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] });
  P(G.torus(0.28, 0.04), gold, { parent: r.torso, pos: [0, 0.66, 0], rot: [Math.PI / 2 - 0.2, 0, 0] });
  r.skirt(leaf, 0.5, 1.55, 0.14, 'soraka');
  r.skirt(green, 0.3, 1.4, 0.16, 'soraka2');
  r.limbs({ sleeve: skin, fore: skin, hand: skin, pants: skin, boots: gold });
  r.headBall(skin);
  hairCap(r, hair, { tilt: -0.45 });
  P(G.sphere(), hair, { parent: r.head, pos: [0, -0.35, -0.28], s: [0.56, 0.7, 0.4] });
  const flow = new THREE.Group(); flow.position.set(0, -0.6, -0.35); flow.rotation.x = Math.PI - 0.2; r.head.add(flow);
  const nodes = chain(flow, 3, (g, j) => P(G.sphere(), hair, { parent: g, pos: [0, 0.14, 0], s: [0.3 - j * 0.06, 0.24, 0.16] }), 0.26);
  sway(r, nodes, 0.1, 2.2, 0.1);
  for (let i = 0; i < 3; i++) blob(r, r.head, hair, (i - 1) * 0.35, 0.44, 0.85, [0.2, 0.18, 0.1], -0.02);
  // 独角
  const hp = r.onHead(0, 0.5, 0.86, -0.05);
  const horn = new THREE.Group(); horn.position.set(...hp.pos); horn.rotation.set(hp.rot[0] - 0.5, hp.rot[1], 0, 'YXZ'); r.head.add(horn);
  P(G.cone(0.1, 0.5, 10), gold, { parent: horn, pos: [0, 0, 0.2], rot: [Math.PI / 2, 0, 0], emissive: '#c89a20', ei: 0.3 });
  // 精灵耳
  for (const s of [1, -1]) P(G.cone(0.1, 0.4, 6), skin, { parent: r.head, pos: [s * 0.6, 0.02, -0.02], rot: [0, 0, -s * 1.2], s: [1, 1, 0.45] });
  r.face({ eye: '#6a3fa0', eyeH: 0.19, blushCol: '#d98ad9' });
  // 新月法杖
  const w = held(r.handR, 0.12);
  P(G.cyl(0.04, 0.045, 2.0, 8), '#9a6a3a', { parent: w, pos: [0, 0.5, 0] });
  P(G.torus(0.28, 0.05, Math.PI * 1.3, 6, 18), gold, { parent: w, pos: [0, 1.62, 0], rot: [0, Math.PI / 2, Math.PI * 0.85] });
  const st = P(G.octa(0.1), '#fff7b0', { parent: w, pos: [0, 1.62, 0], emissive: '#ffe060', ei: 1 });
  r.hooks.push((dt, t) => { st.rotation.y = t * 3; });
  r.tip = st;
  return r;
}

// ---------------- 提伯斯（召唤） ----------------
export function tibbersRig() {
  const r = new Rig({ scale: 1.9, bodyW: 0.52, bodyH: 0.75, headR: 0.5, armR: 0.18, legR: 0.2, legLen: 0.4, armLen: 0.36, foreLen: 0.34 });
  const fur = '#4a3228', patch = '#8a6a4a';
  r.torsoMesh(fur);
  P(G.sphere(), patch, { parent: r.torso, pos: [0, 0.4, 0.28], s: [0.3, 0.32, 0.2] });
  P(G.box(0.03, 0.4, 0.03), '#e0d0a0', { parent: r.torso, pos: [0, 0.4, 0.49], outline: false });
  r.limbs({ sleeve: fur, fore: fur, hand: '#2a1a14', pants: fur, boots: '#2a1a14' });
  for (const H of [r.handL, r.handR]) for (let i = 0; i < 3; i++) P(G.cone(0.04, 0.16, 5), '#f0e8d8', { parent: H, pos: [(i - 1) * 0.08, -0.15, 0.1], rot: [Math.PI, 0, 0] });
  r.headBall(fur);
  for (const s of [1, -1]) {
    P(G.sphere(), fur, { parent: r.head, pos: [s * 0.38, 0.38, 0], s: 0.18 });
    P(G.sphere(), '#c07a8a', { parent: r.head, pos: [s * 0.38, 0.38, 0.08], s: 0.09, outline: false });
  }
  P(G.sphere(), patch, { parent: r.head, pos: [0, -0.12, 0.38], s: [0.22, 0.16, 0.16] });
  P(G.cyl(0.09, 0.09, 0.04, 12), '#1a1414', { parent: r.head, pos: [0.18, 0.08, 0.45], rot: [Math.PI / 2, 0, 0] });
  P(G.box(0.14, 0.03, 0.03), '#1a1414', { parent: r.head, pos: [-0.18, 0.08, 0.46], rot: [0, 0, 0.7], outline: false });
  P(G.box(0.14, 0.03, 0.03), '#1a1414', { parent: r.head, pos: [-0.18, 0.08, 0.46], rot: [0, 0, -0.7], outline: false });
  for (let i = 0; i < 5; i++) P(G.cone(0.1, 0.4, 6), '#ff7a2a', { parent: r.torso, pos: [(i - 2) * 0.17, 0.85, -0.3], rot: [-0.6, 0, (i - 2) * 0.2], emissive: '#ff5010', ei: 0.9, outline: false });
  r.tip = tipAt(r.handR, 0, -0.1, 0);
  return r;
}


// ---------------- 商店老板（原创的富商大老板形象） ----------------
export function shopkeeperRig() {
  const r = new Rig({ scale: 1.25, bodyW: 0.56, bodyH: 0.74, headR: 0.6, armR: 0.14, legR: 0.17, legLen: 0.42, hipW: 0.2 });
  const suit = '#2c3550', shirt = '#f4f1ea', tie = '#c0302a', gold = '#e8c25a';
  // 圆滚滚的肚子
  const w = r.s.bodyW, h = r.s.bodyH;
  r.torsoMesh(suit, { key: 'boss', profile: [[0, -0.1], [w * 0.85, -0.08], [w * 1.12, h * 0.25], [w * 1.08, h * 0.55], [w * 0.86, h * 0.82], [w * 0.5, h * 0.98], [0, h * 1.02]] });
  P(G.sphere(), shirt, { parent: r.torso, pos: [0, 0.45, 0.33], s: [0.26, 0.36, 0.26], outline: false });
  P(G.box(0.1, 0.34, 0.05), tie, { parent: r.torso, pos: [0, 0.48, 0.58], rot: [-0.25, 0, 0] });
  P(G.octa(0.08), tie, { parent: r.torso, pos: [0, 0.3, 0.62], s: [1, 1.4, 0.5] });
  for (const s of [1, -1]) P(G.box(0.2, 0.36, 0.05), suit, { parent: r.torso, pos: [s * 0.2, 0.5, 0.5], rot: [-0.3, 0, s * 0.35] });
  P(G.torus(0.6, 0.045), '#1a1a1a', { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0], s: [1.05, 1, 1] });
  P(G.box(0.14, 0.1, 0.05), gold, { parent: r.torso, pos: [0, 0.12, 0.64] });
  r.limbs({ sleeve: suit, fore: suit, hand: '#f2c9a8', pants: suit, boots: '#1a1a1a' });
  P(G.torus(0.13, 0.04), gold, { parent: r.foreL, pos: [0, -0.26, 0], rot: [Math.PI / 2, 0, 0] }); // 金表
  // 头：油头、笑眯眼、红润脸颊
  r.headBall('#f2c9a8', { sx: 1.08, sy: 0.98 });
  P(G.hemi(), '#1a1418', { parent: r.head, mat: toon('#1a1418', { side: DS }), s: [0.64, 0.5, 0.64], rot: [-0.55, 0, 0], pos: [0, 0.08, -0.04] });
  P(G.sphere(), '#1a1418', { parent: r.head, pos: [0.22, 0.44, 0.22], s: [0.32, 0.12, 0.26], rot: [0, 0, -0.3] });
  for (const s of [1, -1]) {
    const e = r.onHead(s * 0.34, 0.02, 0.92, 0.0);
    P(G.torus(0.07, 0.022, Math.PI, 6, 10), '#2a1a14', { parent: r.head, pos: e.pos, rot: e.rot, order: 'YXZ', outline: false });
    const b = r.onHead(s * 0.55, -0.28, 0.78, -0.02);
    P(G.sphere(12, 8), '#ff8c8c', { parent: r.head, pos: b.pos, rot: b.rot, order: 'YXZ', s: [0.09, 0.05, 0.03], outline: false, opacity: 0.8 });
    const br = r.onHead(s * 0.34, 0.24, 0.92, 0.0);
    const m = P(G.box(0.18, 0.04, 0.04), '#1a1418', { parent: r.head, pos: br.pos, rot: br.rot, order: 'YXZ', outline: false });
    m.rotation.z = s * 0.25;
  }
  const mo = r.onHead(0, -0.36, 0.93, -0.01);
  const mouth = P(G.torus(0.13, 0.03, Math.PI, 6, 12), '#6a2c24', { parent: r.head, pos: mo.pos, rot: mo.rot, order: 'YXZ', outline: false });
  mouth.rotateZ(Math.PI);
  // 金算盘（左手）
  const ab = new THREE.Group(); ab.position.set(0.05, -0.12, 0.2); ab.rotation.set(-1.1, 0, 0.1); r.handL.add(ab);
  P(G.box(0.56, 0.34, 0.05), '#8a4a2a', { parent: ab });
  P(G.box(0.48, 0.26, 0.03), '#f3e6c8', { parent: ab, pos: [0, 0, 0.02], outline: false });
  const beads = [];
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) beads.push(P(G.sphere(8, 6), gold, { parent: ab, pos: [-0.18 + i * 0.09, -0.08 + row * 0.08, 0.05], s: [0.035, 0.03, 0.03], outline: false, emissive: '#806010', ei: 0.3 }));
  r.hooks.push((dt, t) => { beads.forEach((b, i) => { b.position.x = -0.18 + (i % 5) * 0.09 + Math.max(0, Math.sin(t * 3 + i)) * 0.03; }); });
  return r;
}

// 小摊：木桌、招牌、金币堆
export function shopStall() {
  const g = new THREE.Group();
  P(G.box(3.2, 1.0, 1.2), '#a0683a', { parent: g, pos: [0, 0.5, 0] });
  P(G.box(3.4, 0.12, 1.4), '#c8904a', { parent: g, pos: [0, 1.05, 0] });
  for (const s of [1, -1]) P(G.cyl(0.08, 0.08, 3.9, 8), '#8a5a3c', { parent: g, pos: [s * 1.55, 1.95, -0.55] });
  P(G.box(3.3, 0.1, 0.1), '#8a5a3c', { parent: g, pos: [0, 3.85, -0.55] });
  // 两侧小彩旗（不遮挡老板）
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) P(G.cone(0.14, 0.3, 3), i % 2 ? '#fff3dc' : '#d9574f', { parent: g, pos: [s * 1.55, 3.55 - i * 0.28, -0.4], rot: [Math.PI, 0, 0], ol: 0.015 });
  // 招牌（程序绘制的手写字）
  const tex = canvasTex(256, 96, (c) => {
    c.fillStyle = '#f6ecd6'; c.fillRect(0, 0, 256, 96);
    c.strokeStyle = '#2b1b14'; c.lineWidth = 8; c.strokeRect(4, 4, 248, 88);
    c.font = '900 56px "KaiTi","STKaiti",serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#c0302a'; c.fillText('商 店', 128, 52);
  });
  const sign = new THREE.Mesh(G.plane(1.6, 0.6), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0, 3.45, -0.5); g.add(sign);
  const back = P(G.box(1.7, 0.7, 0.06), '#8a5a3c', { parent: g, pos: [0, 3.45, -0.54] }); void back;
  // 金币堆与元宝
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3 + i % 2; k++) P(G.cyl(0.14, 0.14, 0.05, 12), '#f0c840', { parent: g, pos: [-1.1 + i * 0.28, 1.14 + k * 0.055, 0.35], emissive: '#806010', ei: 0.25, ol: 0.012 });
  for (const x of [0.7, 1.15]) {
    P(G.sphere(), '#f0c840', { parent: g, pos: [x, 1.2, 0.3], s: [0.2, 0.1, 0.13], emissive: '#806010', ei: 0.3 });
    P(G.sphere(), '#f0c840', { parent: g, pos: [x, 1.25, 0.3], s: [0.1, 0.1, 0.08], emissive: '#806010', ei: 0.3 });
  }
  return g;
}

export const HERO_MODELS = { garen, darius, ashe, caitlyn, ahri, lux, annie, yi, malphite, soraka };
