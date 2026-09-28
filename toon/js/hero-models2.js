// 第二批二十位英雄的 Q 版手绘建模：同样全部由基础几何体拼装。
import * as THREE from 'three';
import { P, G, toon, glowMat } from './toon-kit.js';
import { Rig, chain } from './rig.js';
import { SKIN, held, tipAt, hairCap, blob, spikeOnHead, cape, sway } from './hero-models.js';

const DS = THREE.DoubleSide;
// 挂在头上的小部件（相对头表面的朝向）
function onHeadGroup(r, nx, ny, nz, lift = 0) {
  const p = r.onHead(nx, ny, nz, lift);
  const g = new THREE.Group(); g.position.set(...p.pos); g.rotation.set(p.rot[0], p.rot[1], 0, 'YXZ'); r.head.add(g);
  return g;
}
// 一条会摆动的长发 / 辫子 / 飘带
function lock(r, parent, pos, rx, n, color, size, spacing, o = {}) {
  const g = new THREE.Group(); g.position.set(...pos); g.rotation.x = rx; if (o.rz) g.rotation.z = o.rz; parent.add(g);
  const nodes = chain(g, n, (c, j) => P(o.geo ? o.geo() : G.sphere(), j === n - 1 && o.tip ? o.tip : color, { parent: c, pos: [0, spacing * 0.5, 0], s: typeof size === 'function' ? size(j) : size }), spacing);
  sway(r, nodes, o.amp ?? 0.12, o.speed ?? 3, o.base ?? 0.1);
  return nodes;
}
function blade(parent, len, color = '#e4ecf4', w = 0.06) {
  P(G.cyl(w * 0.7, w, len, 4), color, { parent, pos: [0, len / 2 + 0.18, 0], s: [1, 1, 0.3], rot: [0, Math.PI / 4, 0] });
  P(G.cone(w * 0.7, 0.2, 4), color, { parent, pos: [0, len + 0.28, 0], s: [1, 1, 0.3], rot: [0, Math.PI / 4, 0] });
}

// ---------------- 亚索 ----------------
function yasuo() {
  const r = new Rig({ scale: 1.06, bodyW: 0.42, bodyH: 0.8, headR: 0.56 });
  const navy = '#2f4f86', light = '#cfd8e8', hair = '#3a2a2a';
  r.torsoMesh(light);
  P(G.box(0.14, 0.9, 0.06), navy, { parent: r.torso, pos: [0.12, 0.42, 0.38], rot: [0, 0, 0.55] });
  P(G.torus(0.43, 0.07), '#8a2a2a', { parent: r.torso, pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(navy, 0.4, 1.4, 0.14, 'yasuo');
  r.limbs({ sleeve: light, fore: navy, hand: SKIN, pants: navy, boots: '#3a2a22' });
  // 右肩铠甲
  P(G.sphere(), '#6a7a8a', { parent: r.armR, pos: [-0.06, 0.05, 0], s: [0.3, 0.2, 0.3] });
  P(G.torus(0.26, 0.03), '#c9a24a', { parent: r.armR, pos: [-0.06, -0.02, 0], rot: [Math.PI / 2, 0, 0] });
  r.headBall(SKIN);
  hairCap(r, hair, { tilt: -0.5, sy: 1.15 });
  for (let i = 0; i < 5; i++) spikeOnHead(r, hair, (i - 2) * 0.24, 0.62, 0.45 - Math.abs(i - 2) * 0.08, 0.13, 0.3, -0.7);
  lock(r, r.head, [0, 0.35, -0.5], -2.4, 4, hair, (j) => [0.17 - j * 0.03, 0.24, 0.15 - j * 0.02], 0.26, { amp: 0.16 });
  r.face({ eye: '#3a2a2a', brow: 0.3, mouth: 'line', blush: false, eyeH: 0.13, browCol: hair });
  // 风之围巾
  lock(r, r.torso, [0.25, 0.75, -0.35], -2.2, 4, '#e8eef7', [0.12, 0.2, 0.05], 0.24, { amp: 0.2, speed: 5 });
  // 武士刀
  const w = held(r.handR, Math.PI / 2 - 0.3);
  P(G.cyl(0.035, 0.035, 0.34, 8), '#2a2020', { parent: w, pos: [0, 0.02, 0] });
  P(G.cyl(0.1, 0.1, 0.03, 12), '#c9a24a', { parent: w, pos: [0, 0.19, 0] });
  blade(w, 1.5, '#eef4fa', 0.055);
  r.tip = tipAt(w, 0, 1.8, 0);
  return r;
}

// ---------------- 劫 ----------------
function zed() {
  const r = new Rig({ scale: 1.06, bodyW: 0.42, bodyH: 0.8, headR: 0.54 });
  const black = '#2a2228', red = '#b3262e', steel = '#8a8a96';
  r.torsoMesh(black);
  P(G.octa(0.14), red, { parent: r.torso, pos: [0, 0.5, 0.4], s: [1, 1.4, 0.5], emissive: '#ff2020', ei: 0.6 });
  P(G.torus(0.43, 0.05), red, { parent: r.torso, pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(black, 0.3, 1.3, 0.12, 'zed');
  r.limbs({ sleeve: black, fore: steel, hand: black, pants: '#1a1418', boots: steel });
  for (const [A, s] of [[r.armL, 1], [r.armR, -1]]) {
    P(G.sphere(), steel, { parent: A, pos: [s * 0.06, 0.04, 0], s: [0.3, 0.22, 0.3] });
    for (let i = 0; i < 2; i++) P(G.cone(0.06, 0.32, 5), red, { parent: A, pos: [s * (0.12 + i * 0.08), 0.22, 0], rot: [0, 0, -s * (0.5 + i * 0.3)] });
  }
  // 腕刃
  for (const F of [r.foreL, r.foreR]) {
    const g = new THREE.Group(); g.position.set(0, -0.2, 0.08); g.rotation.x = -0.25; F.add(g);
    for (let i = 0; i < 3; i++) P(G.cone(0.04, 0.55, 4), '#e4ecf4', { parent: g, pos: [(i - 1) * 0.07, -0.1, 0.12], rot: [Math.PI * 0.62, 0, 0], s: [1, 1, 0.3] });
  }
  r.headBall(steel);
  // 头盔与面罩
  P(G.hemi(), black, { parent: r.head, mat: toon(black, { side: DS }), s: [0.6, 0.66, 0.6], rot: [-0.2, 0, 0], pos: [0, 0.05, -0.02] });
  const face = onHeadGroup(r, 0, -0.05, 0.95, 0.01);
  P(G.box(0.62, 0.08, 0.06), red, { parent: face, pos: [0, 0.03, 0], emissive: '#ff2020', ei: 1, outline: false });
  for (const s of [1, -1]) spikeOnHead(r, black, s * 0.45, 0.6, 0.1, 0.1, 0.5, -0.9);
  lock(r, r.torso, [0, 0.85, -0.4], -2.6, 3, red, [0.14, 0.22, 0.04], 0.26, { amp: 0.14 });
  r.tip = tipAt(r.handR, 0, -0.2, 0.2);
  return r;
}

// ---------------- 金克丝 ----------------
function jinx() {
  const r = new Rig({ scale: 1.0, bodyW: 0.36, bodyH: 0.74, headR: 0.58, legLen: 0.54 });
  const blue = '#3f6fd0', pink = '#ff6fb8', black = '#2a2430', pale = '#f4dcd0';
  r.torsoMesh(black);
  P(G.box(0.4, 0.14, 0.05), pink, { parent: r.torso, pos: [0, 0.55, 0.3], rot: [-0.2, 0, 0.1] });
  P(G.torus(0.37, 0.05), '#8a5ad0', { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt('#8a5ad0', 0.2, 1.3, 0.12, 'jinx');
  r.limbs({ sleeve: pale, fore: pale, hand: black, pants: '#e04a8a', boots: black });
  r.headBall(pale);
  hairCap(r, blue, { tilt: -0.4 });
  for (let i = 0; i < 5; i++) blob(r, r.head, blue, (i - 2) * 0.22, 0.38, 0.86, [0.15, 0.2, 0.1], -0.02);
  // 超长双马尾辫
  for (const s of [1, -1]) lock(r, r.head, [s * 0.5, -0.1, -0.2], Math.PI - 0.25, 7, blue, (j) => [0.13 - j * 0.008, 0.16, 0.13 - j * 0.008], 0.22, { rz: s * 0.25, amp: 0.1, tip: '#8a5ad0' });
  r.face({ eye: '#ff5ab8', eyeH: 0.2, blushCol: '#ff7ac0' });
  // 鱼骨头火箭炮（扛在右肩）
  const w = held(r.handR, Math.PI - 0.2, { pos: [0, 0, 0.08] });
  P(G.cyl(0.2, 0.2, 1.2, 12), '#5a8aa0', { parent: w, pos: [0, 0.45, 0] });
  P(G.cone(0.26, 0.5, 12), '#e04a6a', { parent: w, pos: [0, 1.25, 0] });
  for (let i = 0; i < 5; i++) P(G.cone(0.04, 0.12, 4), '#ffffff', { parent: w, pos: [Math.cos(i * 1.2) * 0.22, 1.0, Math.sin(i * 1.2) * 0.22], rot: [0, 0, Math.PI], ol: 0.01 });
  P(G.box(0.05, 0.3, 0.3), '#e04a6a', { parent: w, pos: [0, -0.1, 0.2] });
  r.tip = tipAt(w, 0, 1.45, 0);
  return r;
}

// ---------------- 伊泽瑞尔 ----------------
function ezreal() {
  const r = new Rig({ scale: 1.02, bodyW: 0.4, bodyH: 0.78, headR: 0.57 });
  const jacket = '#6a4a8a', tan = '#c8a070', hair = '#f0cf6a', gold = '#e8c25a';
  r.torsoMesh('#e8e0d0');
  for (const s of [1, -1]) P(G.box(0.26, 0.7, 0.06), jacket, { parent: r.torso, pos: [s * 0.2, 0.45, 0.35], rot: [-0.1, 0, s * 0.12] });
  P(G.torus(0.41, 0.05), '#6a4a30', { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(jacket, 0.3, 1.35, 0.14, 'ez');
  r.limbs({ sleeve: jacket, fore: jacket, hand: tan, pants: '#4a5a8a', boots: '#6a4a30' });
  // 金色护手（右手）
  P(G.cyl(0.16, 0.2, 0.28, 12), gold, { parent: r.foreR, pos: [0, -0.24, 0], emissive: '#c09020', ei: 0.3 });
  const gem = P(G.octa(0.1), '#8ad8ff', { parent: r.handR, pos: [0, 0, 0.14], emissive: '#40b0ff', ei: 1 });
  r.headBall(SKIN);
  hairCap(r, hair, { tilt: -0.4 });
  for (let i = 0; i < 4; i++) spikeOnHead(r, hair, (i - 1.5) * 0.28, 0.55, 0.6, 0.14, 0.28, -0.3 - i * 0.1);
  // 护目镜
  P(G.torus(0.56, 0.05, Math.PI * 2, 6, 28), '#6a4a30', { parent: r.head, pos: [0, 0.22, 0], rot: [Math.PI / 2 + 0.3, 0, 0] });
  for (const s of [1, -1]) { const g = onHeadGroup(r, s * 0.3, 0.42, 0.85, 0.02); P(G.cyl(0.12, 0.12, 0.08, 14), '#e8a040', { parent: g, rot: [Math.PI / 2, 0, 0], emissive: '#c07010', ei: 0.4 }); }
  r.face({ eye: '#3a7ad0', eyeH: 0.18, brow: 0.1, browCol: '#c8a040' });
  r.hooks.push((dt, t) => { gem.rotation.y = t * 3; });
  r.tip = gem;
  return r;
}

// ---------------- 薇恩 ----------------
function vayne() {
  const r = new Rig({ scale: 1.02, bodyW: 0.39, bodyH: 0.78, headR: 0.56, legLen: 0.54 });
  const dark = '#2a2438', purple = '#5a4a8a', red = '#c0303a', silver = '#c8c8d8';
  r.torsoMesh(dark);
  P(G.torus(0.4, 0.05), silver, { parent: r.torso, pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(purple, 0.4, 1.35, 0.12, 'vayne');
  r.limbs({ sleeve: dark, fore: purple, hand: dark, pants: dark, boots: '#3a2a3a' });
  r.headBall(SKIN);
  hairCap(r, '#1f1a24', { tilt: -0.45 });
  P(G.sphere(), '#1f1a24', { parent: r.head, pos: [0, -0.1, -0.35], s: [0.5, 0.45, 0.35] });
  for (let i = 0; i < 3; i++) blob(r, r.head, '#1f1a24', (i - 1) * 0.3, 0.4, 0.86, [0.18, 0.2, 0.1], -0.02);
  r.face({ eye: '#3a2a4a', eyeH: 0.14, brow: 0.2, browCol: '#1f1a24', mouth: 'line', blush: false });
  // 红色墨镜
  const gl = onHeadGroup(r, 0, 0.0, 0.95, 0.03);
  for (const s of [1, -1]) P(G.box(0.26, 0.14, 0.04), red, { parent: gl, pos: [s * 0.2, 0, 0], emissive: '#a01020', ei: 0.4 });
  P(G.box(0.14, 0.03, 0.03), silver, { parent: gl, outline: false });
  cape(r, purple, { trim: silver, h: 1.0, color2: '#3a2e5a' });
  // 臂弩（右臂）
  const w = held(r.handR, Math.PI / 2, { pos: [0, 0.05, 0] });
  P(G.box(0.12, 0.7, 0.12), '#4a3a4a', { parent: w, pos: [0, 0.3, 0] });
  P(G.torus(0.42, 0.04, Math.PI * 0.8, 6, 16), silver, { parent: w, pos: [0, 0.55, 0], rot: [Math.PI / 2, 0, Math.PI * 0.1] });
  P(G.cone(0.05, 0.2, 4), silver, { parent: w, pos: [0, 0.75, 0] });
  r.tip = tipAt(w, 0, 0.8, 0);
  return r;
}

// ---------------- 提莫 ----------------
function teemo() {
  const r = new Rig({ scale: 0.8, bodyW: 0.36, bodyH: 0.58, headR: 0.7, legLen: 0.38, armLen: 0.28, foreLen: 0.24 });
  const fur = '#d8a870', green = '#5fae4a', dark = '#3f7a34';
  r.torsoMesh(green);
  P(G.torus(0.36, 0.05), '#8a5a3c', { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(dark, 0.2, 1.3, 0.12, 'teemo');
  r.limbs({ sleeve: green, fore: fur, hand: fur, pants: fur, boots: '#6a4a30' });
  r.headBall(fur);
  P(G.sphere(), '#f4e0c0', { parent: r.head, pos: [0, -0.25, 0.42], s: [0.35, 0.22, 0.22], outline: false });
  // 圆耳朵
  for (const s of [1, -1]) {
    const e = new THREE.Group(); e.position.set(s * 0.62, 0.1, -0.05); e.rotation.z = -s * 0.9; r.head.add(e);
    P(G.sphere(), fur, { parent: e, pos: [0, 0.25, 0], s: [0.22, 0.34, 0.1] });
    P(G.sphere(), '#f0a0a0', { parent: e, pos: [0, 0.25, 0.05], s: [0.13, 0.22, 0.05], outline: false });
    r.hooks.push((dt, t) => { e.rotation.x = Math.sin(t * 2 + s) * 0.1; });
  }
  // 斥候帽
  const hat = new THREE.Group(); hat.position.set(0, 0.52, -0.02); hat.rotation.set(-0.1, 0, 0.1); r.head.add(hat);
  P(G.cyl(0.62, 0.62, 0.05, 24), green, { parent: hat });
  P(G.sphere(), green, { parent: hat, pos: [0, 0.12, 0], s: [0.45, 0.3, 0.45] });
  P(G.torus(0.44, 0.05), dark, { parent: hat, pos: [0, 0.06, 0], rot: [Math.PI / 2, 0, 0] });
  P(G.box(0.08, 0.55, 0.03), '#e84a4a', { parent: hat, pos: [0.35, 0.3, -0.2], rot: [-0.4, 0, -0.4] });
  r.face({ eye: '#2a2340', eyeH: 0.22, eyeX: 0.32, blushCol: '#ff9a9a' });
  // 吹箭筒
  const w = held(r.handR, Math.PI / 2 - 0.2);
  P(G.cyl(0.04, 0.05, 0.8, 8), '#8a5a3c', { parent: w, pos: [0, 0.3, 0] });
  r.tip = tipAt(w, 0, 0.7, 0);
  return r;
}

// ---------------- 锤石 ----------------
function thresh() {
  const r = new Rig({ scale: 1.16, bodyW: 0.44, bodyH: 0.86, headR: 0.5, legLen: 0.52 });
  const armor = '#3a4a42', green = '#7dffb0', dark = '#1f2a26';
  r.torsoMesh(armor);
  P(G.octa(0.12), green, { parent: r.torso, pos: [0, 0.5, 0.42], s: [1, 1.4, 0.5], emissive: '#40ff90', ei: 0.8 });
  r.skirt(dark, 0.55, 1.5, 0.14, 'thresh');
  r.limbs({ sleeve: armor, fore: dark, hand: '#9ab0a8', pants: dark, boots: armor });
  for (const [A, s] of [[r.armL, 1], [r.armR, -1]]) {
    P(G.sphere(), armor, { parent: A, pos: [s * 0.06, 0.04, 0], s: [0.3, 0.24, 0.3] });
    P(G.cone(0.08, 0.35, 5), '#c8d0c8', { parent: A, pos: [s * 0.15, 0.3, 0], rot: [0, 0, -s * 0.4] });
  }
  // 骷髅头（发光）
  r.headBall('#d8f0e0');
  P(G.hemi(), dark, { parent: r.head, mat: toon(dark, { side: DS }), s: [0.56, 0.6, 0.56], rot: [-0.6, 0, 0], pos: [0, 0.06, -0.04] });
  for (const s of [1, -1]) { const e = onHeadGroup(r, s * 0.34, -0.05, 0.92, 0.01); P(G.sphere(), '#1a2a22', { parent: e, s: [0.13, 0.15, 0.05], outline: false }); P(G.sphere(8, 6), green, { parent: e, pos: [0, 0, 0.03], s: 0.06, emissive: '#40ff90', ei: 1, outline: false }); }
  const m = onHeadGroup(r, 0, -0.45, 0.88, 0.01);
  for (let i = -2; i <= 2; i++) P(G.box(0.05, 0.1, 0.03), '#1a2a22', { parent: m, pos: [i * 0.08, 0, 0], outline: false });
  const halo = new THREE.Mesh(G.sphere(12, 8), glowMat('#7dffb0', 0.25)); halo.scale.setScalar(0.75); r.head.add(halo);
  // 灯笼（左手）
  const lan = new THREE.Group(); lan.position.set(0, -0.35, 0.1); r.handL.add(lan);
  P(G.cyl(0.015, 0.015, 0.25, 4), '#3a3a3a', { parent: lan, pos: [0, 0.12, 0], outline: false });
  P(G.cyl(0.14, 0.18, 0.3, 8), '#2a4a3a', { parent: lan, pos: [0, -0.1, 0] });
  const flame = P(G.sphere(12, 8), green, { parent: lan, pos: [0, -0.1, 0], s: 0.12, emissive: '#40ff90', ei: 1 });
  r.hooks.push((dt, t) => { flame.scale.setScalar(0.11 + Math.sin(t * 8) * 0.02); lan.rotation.z = Math.sin(t * 2) * 0.2; });
  // 镰刀锁链（右手）
  const w = held(r.handR, 0.3);
  for (let i = 0; i < 5; i++) P(G.torus(0.06, 0.02), '#8a8a96', { parent: w, pos: [0, 0.1 + i * 0.1, 0], rot: [0, i % 2 ? Math.PI / 2 : 0, 0], outline: false });
  P(G.cyl(0.03, 0.03, 0.5, 6), '#3a3a3a', { parent: w, pos: [0, 0.85, 0] });
  P(G.torus(0.3, 0.05, Math.PI * 0.8, 6, 12), '#c8d0d8', { parent: w, pos: [0.25, 1.05, 0], rot: [0, 0, 0.2] });
  r.tip = tipAt(w, 0, 1.1, 0);
  return r;
}

// ---------------- 布里茨 ----------------
function blitzcrank() {
  const r = new Rig({ scale: 1.2, bodyW: 0.58, bodyH: 0.8, headR: 0.36, armR: 0.18, legR: 0.17, legLen: 0.42, armLen: 0.42, foreLen: 0.4, hipW: 0.22 });
  const gold = '#d8a830', dark = '#6a5030', steel = '#8a8a96';
  r.torsoMesh(gold, { key: 'blitz', profile: [[0, -0.1], [0.45, -0.08], [0.62, 0.2], [0.62, 0.55], [0.5, 0.8], [0.3, 0.9], [0, 0.92]] });
  for (let i = 0; i < 3; i++) P(G.torus(0.6 - i * 0.02, 0.03), dark, { parent: r.torso, pos: [0, 0.15 + i * 0.25, 0], rot: [Math.PI / 2, 0, 0], outline: false });
  P(G.cyl(0.15, 0.15, 0.05, 16), '#ffe27a', { parent: r.torso, pos: [0, 0.45, 0.6], rot: [Math.PI / 2, 0, 0], emissive: '#ffb020', ei: 0.8 });
  // 背后烟囱
  for (const s of [1, -1]) {
    P(G.cyl(0.1, 0.1, 0.55, 10), steel, { parent: r.torso, pos: [s * 0.25, 1.0, -0.35] });
    const smoke = P(G.sphere(8, 6), '#e0e0e0', { parent: r.torso, pos: [s * 0.25, 1.35, -0.35], s: 0.12, outline: false, opacity: 0.7 });
    r.hooks.push((dt, t) => { const k = (t * 1.5 + (s > 0 ? 0 : 0.5)) % 1; smoke.position.y = 1.3 + k * 0.5; smoke.scale.setScalar(0.08 + k * 0.15); });
  }
  r.limbs({ sleeve: steel, fore: gold, hand: gold, pants: steel, boots: gold });
  for (const H of [r.handL, r.handR]) P(G.sphere(), gold, { parent: H, pos: [0, -0.08, 0], s: [0.3, 0.26, 0.3] });
  r.head.position.y = 0.95;
  P(G.sphere(), gold, { parent: r.head, s: [0.4, 0.34, 0.38] });
  for (const s of [1, -1]) P(G.cyl(0.1, 0.1, 0.05, 14), '#8ae0ff', { parent: r.head, pos: [s * 0.15, 0.04, 0.34], rot: [Math.PI / 2, 0, 0], emissive: '#40c0ff', ei: 1, outline: false });
  P(G.box(0.28, 0.05, 0.05), dark, { parent: r.head, pos: [0, -0.14, 0.34], outline: false });
  P(G.cyl(0.02, 0.02, 0.3, 6), steel, { parent: r.head, pos: [0, 0.45, 0] });
  P(G.sphere(8, 6), '#ff5a5a', { parent: r.head, pos: [0, 0.62, 0], s: 0.06, emissive: '#ff2020', ei: 1 });
  r.tip = tipAt(r.handR, 0, -0.15, 0.2);
  return r;
}

// ---------------- 蕾欧娜 ----------------
function leona() {
  const r = new Rig({ scale: 1.08, bodyW: 0.44, bodyH: 0.8, headR: 0.56 });
  const gold = '#e8b840', orange = '#e0602a', white = '#f4ecd8', hair = '#b8502a';
  r.torsoMesh(gold);
  P(G.sphere(), '#f0cf6a', { parent: r.torso, pos: [0, 0.5, 0.16], s: [0.42, 0.32, 0.32] });
  P(G.torus(0.44, 0.05), orange, { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(white, 0.4, 1.4, 0.12, 'leona');
  r.limbs({ sleeve: gold, fore: gold, hand: gold, pants: white, boots: gold });
  for (const [A, s] of [[r.armL, 1], [r.armR, -1]]) P(G.sphere(), '#f0cf6a', { parent: A, pos: [s * 0.05, 0.03, 0], s: [0.3, 0.24, 0.3] });
  r.headBall(SKIN);
  hairCap(r, hair, { tilt: -0.45 });
  P(G.sphere(), hair, { parent: r.head, pos: [0, -0.35, -0.3], s: [0.58, 0.7, 0.42] });
  lock(r, r.head, [0, -0.55, -0.4], Math.PI - 0.2, 3, hair, (j) => [0.3 - j * 0.06, 0.22, 0.16], 0.24, { amp: 0.08 });
  // 太阳头冠
  const crown = new THREE.Group(); crown.position.set(0, 0.35, -0.1); crown.rotation.x = -0.4; r.head.add(crown);
  P(G.torus(0.52, 0.04, Math.PI, 6, 18), gold, { parent: crown, emissive: '#c09020', ei: 0.4 });
  for (let i = 0; i < 7; i++) { const a = i / 6 * Math.PI; P(G.cone(0.06, 0.28, 4), '#ffd84a', { parent: crown, pos: [Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0], rot: [0, 0, a - Math.PI / 2], emissive: '#ffb020', ei: 0.6 }); }
  r.face({ eye: '#c07a2a', eyeH: 0.17, brow: 0.15, browCol: hair });
  // 太阳盾（左手）
  const sh = new THREE.Group(); sh.position.set(0.05, -0.1, 0.15); sh.rotation.set(0, -0.3, 0); r.handL.add(sh);
  P(G.cyl(0.5, 0.5, 0.08, 20), gold, { parent: sh, rot: [Math.PI / 2, 0, 0] });
  P(G.cyl(0.3, 0.3, 0.1, 20), '#ffd84a', { parent: sh, rot: [Math.PI / 2, 0, 0], emissive: '#ffb020', ei: 0.6 });
  // 剑（右手）
  const w = held(r.handR, Math.PI / 2 - 0.35);
  P(G.cyl(0.035, 0.035, 0.3, 8), '#5a3b26', { parent: w, pos: [0, 0.02, 0] });
  P(G.box(0.4, 0.07, 0.1), gold, { parent: w, pos: [0, 0.18, 0] });
  blade(w, 1.2, '#fff4c0', 0.09);
  r.tip = tipAt(w, 0, 1.5, 0);
  return r;
}

// ---------------- 璐璐 ----------------
function lulu() {
  const r = new Rig({ scale: 0.8, bodyW: 0.36, bodyH: 0.6, headR: 0.68, legLen: 0.4, armLen: 0.28, foreLen: 0.24 });
  const purple = '#8a5ad0', skin = '#b8a8e8', hair = '#5a3a9a', pink = '#ff9ad0';
  r.torsoMesh(purple);
  r.skirt('#6a3ab0', 0.25, 1.5, 0.14, 'lulu');
  r.limbs({ sleeve: purple, fore: skin, hand: skin, pants: '#5a3a9a', boots: pink });
  r.headBall(skin);
  hairCap(r, hair, { tilt: -0.35 });
  for (const s of [1, -1]) P(G.sphere(), hair, { parent: r.head, pos: [s * 0.6, -0.2, -0.05], s: [0.22, 0.35, 0.26] });
  // 精灵耳
  for (const s of [1, -1]) P(G.cone(0.12, 0.5, 6), skin, { parent: r.head, pos: [s * 0.72, 0.05, -0.05], rot: [0, 0, -s * 1.3], s: [1, 1, 0.45] });
  // 巨大女巫帽
  const hat = new THREE.Group(); hat.position.set(0, 0.5, -0.05); hat.rotation.set(-0.15, 0, 0.12); r.head.add(hat);
  P(G.cyl(0.95, 0.95, 0.05, 28), purple, { parent: hat });
  const top = new THREE.Group(); top.position.y = 0.05; hat.add(top);
  const tipN = chain(top, 3, (g, j) => P(G.cone(0.48 - j * 0.14, 0.45, 16), j === 2 ? pink : purple, { parent: g, pos: [0, 0.2, 0] }), 0.38);
  sway(r, tipN, 0.08, 2, -0.15);
  P(G.torus(0.47, 0.05), pink, { parent: hat, pos: [0, 0.08, 0], rot: [Math.PI / 2, 0, 0] });
  r.face({ eye: '#e0a040', eyeH: 0.22, eyeX: 0.32, blushCol: '#ff7ac0' });
  // 仙灵皮克斯
  const pix = new THREE.Group(); r.root.add(pix);
  P(G.sphere(12, 8), '#ffe0f0', { parent: pix, s: 0.14, emissive: '#ff9ad0', ei: 0.6 });
  for (const s of [1, -1]) P(G.sphere(8, 6), '#c8e8ff', { parent: pix, pos: [s * 0.14, 0.05, -0.05], s: [0.12, 0.04, 0.08], opacity: 0.8, outline: false });
  const ph = new THREE.Mesh(G.sphere(10, 8), glowMat('#ff9ad0', 0.4)); ph.scale.setScalar(0.3); pix.add(ph);
  r.hooks.push((dt, t) => { pix.position.set(Math.cos(t * 1.6) * 0.9, 2.2 + Math.sin(t * 3) * 0.15, Math.sin(t * 1.6) * 0.5 - 0.2); });
  // 法杖
  const w = held(r.handR, 0.2);
  P(G.cyl(0.03, 0.035, 1.0, 8), '#8a5a3c', { parent: w, pos: [0, 0.25, 0] });
  const gem = P(G.octa(0.1), pink, { parent: w, pos: [0, 0.82, 0], emissive: '#ff5ab0', ei: 0.9 });
  r.hooks.push((dt, t) => { gem.rotation.y = t * 2.5; });
  r.tip = tipAt(w, 0, 0.82, 0);
  return r;
}

// ---------------- 莫甘娜 ----------------
function morgana() {
  const r = new Rig({ scale: 1.04, bodyW: 0.39, bodyH: 0.78, headR: 0.56, legLen: 0.52 });
  const skin = '#b8a0d8', black = '#2a2038', purple = '#6a3fa0', hair = '#1a1428';
  r.torsoMesh(black);
  P(G.octa(0.1), '#b58aff', { parent: r.torso, pos: [0, 0.55, 0.38], s: [1, 1.4, 0.5], emissive: '#8a4ad0', ei: 0.7 });
  r.skirt(purple, 0.55, 1.5, 0.12, 'morgana');
  r.limbs({ sleeve: skin, fore: black, hand: skin, pants: black, boots: black });
  r.headBall(skin);
  hairCap(r, hair, { tilt: -0.45 });
  P(G.sphere(), hair, { parent: r.head, pos: [0, -0.35, -0.3], s: [0.6, 0.75, 0.42] });
  lock(r, r.head, [0, -0.6, -0.4], Math.PI - 0.15, 3, hair, (j) => [0.34 - j * 0.07, 0.24, 0.16], 0.25, { amp: 0.08 });
  for (const s of [1, -1]) spikeOnHead(r, black, s * 0.35, 0.72, 0.2, 0.07, 0.35, -0.6);
  r.face({ eye: '#c83a3a', eyeH: 0.16, brow: 0.2, browCol: hair, blushCol: '#c88ad8' });
  // 黑暗之翼
  for (const s of [1, -1]) {
    const wg = new THREE.Group(); wg.position.set(s * 0.18, 0.7, -0.35); r.torso.add(wg);
    const shape = () => { const p = new THREE.Shape(); p.moveTo(0, 0); p.quadraticCurveTo(0.6, 0.7, 1.2, 0.8); p.lineTo(1.0, 0.4); p.lineTo(1.1, 0.1); p.lineTo(0.8, -0.1); p.lineTo(0.85, -0.45); p.quadraticCurveTo(0.4, -0.2, 0, 0); return p; };
    P(G.shape('morgWing', shape, 0.03, 0.01), '#3a2a50', { parent: wg, s: [s, 1, 1], rot: [0, s * 0.5, 0] });
    r.hooks.push((dt, t) => { wg.rotation.y = s * (0.35 + Math.sin(t * 2.2) * 0.18); });
  }
  const orb = new THREE.Group(); orb.position.set(0, -0.12, 0.12); r.handR.add(orb);
  P(G.sphere(12, 8), '#8a4ad0', { parent: orb, s: 0.14, emissive: '#6a2ad0', ei: 0.9 });
  const g = new THREE.Mesh(G.sphere(10, 8), glowMat('#b58aff', 0.45)); g.scale.setScalar(0.26); orb.add(g);
  r.tip = orb;
  return r;
}

// ---------------- 卡特琳娜 ----------------
function katarina() {
  const r = new Rig({ scale: 1.02, bodyW: 0.38, bodyH: 0.78, headR: 0.56, legLen: 0.55 });
  const black = '#2a2228', red = '#c0303a', hair = '#d8302a';
  r.torsoMesh(black);
  P(G.box(0.3, 0.4, 0.06), red, { parent: r.torso, pos: [0, 0.4, 0.35], rot: [-0.1, 0, 0] });
  P(G.torus(0.39, 0.05), '#c9a24a', { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(black, 0.25, 1.3, 0.12, 'kata');
  r.limbs({ sleeve: black, fore: black, hand: black, pants: '#3a2a30', boots: black });
  r.headBall(SKIN);
  hairCap(r, hair, { tilt: -0.4 });
  for (let i = 0; i < 4; i++) blob(r, r.head, hair, (i - 1.5) * 0.28, 0.4, 0.86, [0.16, 0.22, 0.1], -0.02);
  P(G.sphere(), hair, { parent: r.head, pos: [0, -0.3, -0.3], s: [0.58, 0.7, 0.4] });
  lock(r, r.head, [0, -0.55, -0.42], Math.PI - 0.2, 4, hair, (j) => [0.3 - j * 0.05, 0.24, 0.15], 0.24, { amp: 0.12 });
  r.face({ eye: '#3a8a4a', eyeH: 0.17, brow: 0.2, browCol: '#a0201a' });
  // 左眼刀疤
  const sc = onHeadGroup(r, 0.36, 0.05, 0.92, 0.02);
  P(G.box(0.03, 0.3, 0.02), '#a04040', { parent: sc, rot: [0, 0, 0.2], outline: false });
  // 双匕首
  for (const [H, s] of [[r.handR, 1], [r.handL, -1]]) {
    const w = held(H, Math.PI / 2 - 0.2 * s);
    P(G.cyl(0.03, 0.03, 0.22, 6), '#3a2020', { parent: w, pos: [0, 0.02, 0] });
    P(G.box(0.24, 0.05, 0.07), red, { parent: w, pos: [0, 0.14, 0] });
    blade(w, 0.6, '#e4ecf4', 0.06);
    if (s > 0) r.tip = tipAt(w, 0, 0.85, 0);
  }
  return r;
}

// ---------------- 赵信 ----------------
function xinzhao() {
  const r = new Rig({ scale: 1.1, bodyW: 0.45, bodyH: 0.8, headR: 0.54 });
  const red = '#b8302a', gold = '#d8a846', steel = '#9aa0aa';
  r.torsoMesh(steel);
  P(G.sphere(), '#b8c0c8', { parent: r.torso, pos: [0, 0.5, 0.16], s: [0.44, 0.32, 0.32] });
  P(G.torus(0.46, 0.06), gold, { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(red, 0.42, 1.35, 0.12, 'xin');
  r.limbs({ sleeve: red, fore: steel, hand: '#6a4a30', pants: '#4a2a2a', boots: steel });
  for (const [A, s] of [[r.armL, 1], [r.armR, -1]]) P(G.sphere(), gold, { parent: A, pos: [s * 0.06, 0.04, 0], s: [0.3, 0.22, 0.3] });
  r.headBall('#e8c29c');
  // 头盔与羽缨
  P(G.hemi(), steel, { parent: r.head, mat: toon(steel, { side: DS }), s: [0.6, 0.62, 0.6], rot: [-0.25, 0, 0], pos: [0, 0.05, -0.02] });
  P(G.torus(0.56, 0.05, Math.PI * 2, 6, 28), gold, { parent: r.head, pos: [0, 0.12, 0.05], rot: [Math.PI / 2 + 0.25, 0, 0] });
  lock(r, r.head, [0, 0.6, -0.1], -2.4, 4, red, (j) => [0.12, 0.2, 0.12], 0.2, { amp: 0.15 });
  blob(r, r.head, '#2a1a14', 0, -0.62, 0.72, [0.26, 0.14, 0.14], -0.05);
  r.face({ eye: '#2a1a14', brow: 0.45, mouth: 'line', blush: false, eyeH: 0.13, browCol: '#2a1a14' });
  cape(r, red, { trim: gold, h: 0.95 });
  // 长枪
  const w = held(r.handR, Math.PI / 2 - 0.2, { pos: [0, 0, 0] });
  P(G.cyl(0.04, 0.04, 2.6, 8), '#5a3b26', { parent: w, pos: [0, 0.5, 0] });
  P(G.cone(0.1, 0.45, 4), '#e4ecf4', { parent: w, pos: [0, 2.0, 0], s: [1, 1, 0.4] });
  P(G.torus(0.08, 0.03), gold, { parent: w, pos: [0, 1.78, 0], rot: [Math.PI / 2, 0, 0] });
  lock(r, w, [0, 1.75, 0], Math.PI, 2, red, [0.08, 0.14, 0.04], 0.14, { amp: 0.2 });
  r.tip = tipAt(w, 0, 2.2, 0);
  return r;
}

// ---------------- 阿木木 ----------------
function amumu() {
  const r = new Rig({ scale: 0.86, bodyW: 0.4, bodyH: 0.6, headR: 0.62, legLen: 0.38, armLen: 0.3, foreLen: 0.26 });
  const wrap = '#d8d0a8', green = '#8ab070', dark = '#6a6a50';
  r.torsoMesh(wrap);
  for (let i = 0; i < 4; i++) P(G.torus(0.41, 0.035), i % 2 ? dark : '#c8c098', { parent: r.torso, pos: [0, 0.1 + i * 0.15, 0], rot: [Math.PI / 2 + (i % 2 ? 0.15 : -0.15), 0, 0], outline: false });
  r.limbs({ sleeve: wrap, fore: wrap, hand: green, pants: wrap, boots: dark });
  for (const F of [r.foreL, r.foreR]) P(G.torus(0.13, 0.03), dark, { parent: F, pos: [0, -0.12, 0], rot: [Math.PI / 2, 0.2, 0], outline: false });
  r.headBall(wrap);
  for (let i = 0; i < 3; i++) P(G.torus(0.6, 0.035, Math.PI * 2, 6, 28), '#c8c098', { parent: r.head, pos: [0, 0.3 - i * 0.28, 0], rot: [Math.PI / 2 + (i - 1) * 0.2, 0, 0], outline: false });
  // 露出的一只大眼睛与绿脸
  const f = onHeadGroup(r, 0.05, -0.12, 0.92, -0.04);
  P(G.sphere(), green, { parent: f, s: [0.34, 0.26, 0.08], outline: false });
  for (const s of [1, -1]) {
    const e = onHeadGroup(r, s * 0.24, -0.08, 0.95, 0.01);
    P(G.sphere(), '#ffe070', { parent: e, s: [0.12, 0.15, 0.05], emissive: '#ffb020', ei: 0.6, ol: 0.01 });
    P(G.sphere(8, 6), '#2a2020', { parent: e, pos: [0, -0.02, 0.03], s: 0.06, outline: false });
  }
  // 眼泪
  const tear = P(G.sphere(8, 6), '#8ad0ff', { parent: r.head, pos: [0.24, -0.35, 0.55], s: [0.05, 0.08, 0.05], emissive: '#40a0ff', ei: 0.5, outline: false });
  r.hooks.push((dt, t) => { const k = (t * 0.8) % 1; tear.position.y = -0.3 - k * 0.4; tear.visible = k < 0.9; });
  // 飘动的绷带
  lock(r, r.handR, [0, -0.1, 0], Math.PI, 3, wrap, [0.06, 0.16, 0.03], 0.18, { amp: 0.25, speed: 4 });
  lock(r, r.head, [0.3, 0.2, -0.4], -2.3, 3, wrap, [0.06, 0.16, 0.03], 0.18, { amp: 0.2, speed: 4 });
  r.tip = tipAt(r.handR, 0, -0.1, 0.1);
  return r;
}

// ---------------- 布兰德 ----------------
function brand() {
  const r = new Rig({ scale: 1.04, bodyW: 0.42, bodyH: 0.8, headR: 0.52 });
  const rock = '#4a2a22', fire = '#ff7a2a', glow = '#ffcf4a';
  r.torsoMesh(rock);
  const crack = (parent, pos, rot, l = 0.4) => P(G.box(0.04, l, 0.03), glow, { parent, pos, rot, emissive: '#ff8a10', ei: 1, outline: false });
  crack(r.torso, [0.1, 0.5, 0.4], [0, 0, 0.4]); crack(r.torso, [-0.12, 0.3, 0.4], [0, 0, -0.3]); crack(r.torso, [0, 0.7, 0.3], [0, 0, 1.2], 0.3);
  P(G.torus(0.43, 0.05), '#2a1a14', { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt('#3a2018', 0.3, 1.3, 0.12, 'brand');
  r.limbs({ sleeve: rock, fore: rock, hand: fire, pants: rock, boots: '#2a1a14' });
  for (const F of [r.foreL, r.foreR]) crack(F, [0, -0.15, 0.1], [0, 0, 0.3], 0.25);
  r.headBall(rock);
  for (const s of [1, -1]) { const e = onHeadGroup(r, s * 0.34, -0.05, 0.92, 0.01); P(G.box(0.18, 0.08, 0.04), glow, { parent: e, rot: [0, 0, s * 0.25], emissive: '#ffb020', ei: 1, outline: false }); }
  crack(r.head, [0.1, -0.3, 0.45], [0, 0, 0.5], 0.25);
  // 头顶火焰
  const flames = [];
  for (let i = 0; i < 6; i++) {
    const g = onHeadGroup(r, (i - 2.5) * 0.2, 0.7, 0.3 - Math.abs(i - 2.5) * 0.12, -0.1);
    flames.push(P(G.cone(0.14, 0.55, 8), i % 2 ? fire : glow, { parent: g, pos: [0, 0, 0.2], rot: [Math.PI / 2 - 0.3, 0, 0], emissive: '#ff5a10', ei: 0.9, outline: false }));
  }
  r.hooks.push((dt, t) => flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 9 + i * 1.7) * 0.25; }));
  const orb = new THREE.Group(); orb.position.set(0, -0.12, 0.1); r.handR.add(orb);
  P(G.sphere(12, 8), glow, { parent: orb, s: 0.13, emissive: '#ff8a10', ei: 1 });
  const h = new THREE.Mesh(G.sphere(10, 8), glowMat('#ff7a2a', 0.5)); h.scale.setScalar(0.28); orb.add(h);
  r.tip = orb;
  return r;
}

// ---------------- 维迦 ----------------
function veigar() {
  const r = new Rig({ scale: 0.78, bodyW: 0.36, bodyH: 0.58, headR: 0.6, legLen: 0.36, armLen: 0.28, foreLen: 0.24 });
  const purple = '#5a3fa0', dark = '#1a1428', gold = '#e8c25a';
  r.torsoMesh(purple);
  r.skirt(purple, 0.4, 1.6, 0.12, 'veigar');
  r.limbs({ sleeve: purple, fore: purple, hand: '#3a2a50', pants: dark, boots: dark });
  r.headBall(dark);
  // 发光的黄眼睛
  for (const s of [1, -1]) { const e = onHeadGroup(r, s * 0.32, -0.08, 0.93, 0.01); P(G.sphere(), '#ffe070', { parent: e, s: [0.12, 0.09, 0.04], emissive: '#ffd020', ei: 1, outline: false }); }
  // 超大巫师帽
  const hat = new THREE.Group(); hat.position.set(0, 0.3, 0); hat.rotation.set(-0.1, 0, -0.1); r.head.add(hat);
  P(G.cyl(0.95, 0.95, 0.06, 28), purple, { parent: hat });
  P(G.torus(0.62, 0.07), gold, { parent: hat, pos: [0, 0.08, 0], rot: [Math.PI / 2, 0, 0] });
  const top = new THREE.Group(); top.position.y = 0.05; hat.add(top);
  const n = chain(top, 4, (g, j) => P(G.cone(0.65 - j * 0.15, 0.5, 18), purple, { parent: g, pos: [0, 0.22, 0] }), 0.42);
  sway(r, n, 0.07, 1.8, -0.18);
  P(G.octa(0.1), gold, { parent: n[3], pos: [0, 0.5, 0], emissive: '#ffb020', ei: 0.6 });
  // 法杖
  const w = held(r.handR, 0.2);
  P(G.cyl(0.03, 0.035, 1.2, 8), '#5a3b26', { parent: w, pos: [0, 0.3, 0] });
  P(G.torus(0.14, 0.03), gold, { parent: w, pos: [0, 0.95, 0] });
  const gem = P(G.octa(0.1), '#b58aff', { parent: w, pos: [0, 0.95, 0], emissive: '#8a4ad0', ei: 1 });
  r.hooks.push((dt, t) => { gem.rotation.y = t * 3; });
  r.tip = tipAt(w, 0, 0.95, 0);
  return r;
}

// ---------------- 崔斯特 ----------------
function twistedfate() {
  const r = new Rig({ scale: 1.04, bodyW: 0.4, bodyH: 0.8, headR: 0.55 });
  const red = '#8a2a2a', brown = '#6a4a30', gold = '#e8c25a', purple = '#7a4ab0';
  r.torsoMesh('#3a2a3a');
  // 斗篷披肩
  P(G.lathe('tfPoncho', [[0.2, 0.9], [0.55, 0.6], [0.6, 0.45], [0.55, 0.42]]), red, { parent: r.torso, mat: toon(red, { side: DS }) });
  P(G.torus(0.41, 0.05), gold, { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(brown, 0.45, 1.3, 0.12, 'tf');
  r.limbs({ sleeve: '#3a2a3a', fore: '#3a2a3a', hand: SKIN, pants: '#3a3040', boots: brown });
  r.headBall(SKIN);
  hairCap(r, '#2a1a14', { tilt: -0.5 });
  blob(r, r.head, '#2a1a14', 0, -0.38, 0.9, [0.3, 0.07, 0.08], 0.0);
  r.face({ eye: '#3a2a4a', eyeH: 0.13, brow: 0.2, mouth: false, blush: false, browCol: '#2a1a14' });
  // 牛仔帽
  const hat = new THREE.Group(); hat.position.set(0, 0.42, -0.02); hat.rotation.set(-0.1, 0, 0.08); r.head.add(hat);
  P(G.cyl(0.85, 0.85, 0.05, 28), brown, { parent: hat, s: [1, 1, 0.9] });
  P(G.cyl(0.42, 0.48, 0.45, 20), brown, { parent: hat, pos: [0, 0.24, 0] });
  P(G.cyl(0.49, 0.49, 0.08, 20), purple, { parent: hat, pos: [0, 0.08, 0] });
  // 手中三张牌
  const fan = new THREE.Group(); fan.position.set(0, -0.12, 0.12); fan.rotation.x = -1.2; r.handR.add(fan);
  ['#4a8ae0', '#e04040', '#e8c25a'].forEach((c, i) => {
    const cd = new THREE.Group(); cd.rotation.z = (i - 1) * 0.35; fan.add(cd);
    P(G.box(0.2, 0.3, 0.015), '#fff8e8', { parent: cd, pos: [0, 0.15, i * 0.01], ol: 0.01 });
    P(G.box(0.14, 0.22, 0.02), c, { parent: cd, pos: [0, 0.15, i * 0.01], emissive: c, ei: 0.4, outline: false });
  });
  r.tip = tipAt(fan, 0, 0.25, 0);
  return r;
}

// ---------------- 李青 ----------------
function leesin() {
  const r = new Rig({ scale: 1.06, bodyW: 0.42, bodyH: 0.8, headR: 0.54 });
  const skin = '#e8c29c', orange = '#e08a2a', red = '#c0302a';
  r.torsoMesh(skin);
  P(G.box(0.12, 0.9, 0.06), orange, { parent: r.torso, pos: [-0.1, 0.42, 0.38], rot: [0, 0, -0.55] });
  P(G.torus(0.43, 0.08), red, { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(orange, 0.35, 1.4, 0.12, 'lee');
  r.limbs({ sleeve: skin, fore: skin, hand: '#f0e0c0', pants: orange, boots: '#6a4a30' });
  for (const F of [r.foreL, r.foreR]) P(G.cyl(0.14, 0.16, 0.2, 10), '#f0e0c0', { parent: F, pos: [0, -0.2, 0] });
  r.headBall(skin);
  hairCap(r, '#2a1a14', { tilt: -0.6, sy: 1.05 });
  const knot = onHeadGroup(r, 0, 0.6, -0.6, -0.05); P(G.sphere(), '#2a1a14', { parent: knot, s: 0.16 });
  // 红色蒙眼布与飘带
  P(G.torus(0.56, 0.07, Math.PI * 2, 6, 28), red, { parent: r.head, pos: [0, 0.02, 0], rot: [Math.PI / 2 + 0.05, 0, 0] });
  for (const s of [1, -1]) lock(r, r.head, [s * 0.1, 0.02, -0.56], -2.2, 3, red, [0.07, 0.16, 0.03], 0.2, { amp: 0.22, speed: 4, rz: s * 0.3 });
  const mo = onHeadGroup(r, 0, -0.4, 0.92, 0.0); // 蒙着眼，只画嘴
  P(G.box(0.12, 0.025, 0.03), '#5a2a22', { parent: mo, outline: false });
  r.tip = tipAt(r.handR, 0, -0.15, 0.15);
  return r;
}

// ---------------- 蒙多 ----------------
function mundo() {
  const r = new Rig({ scale: 1.22, bodyW: 0.54, bodyH: 0.84, headR: 0.44, armR: 0.2, legR: 0.19, legLen: 0.45, armLen: 0.4, foreLen: 0.36, hipW: 0.22 });
  const skin = '#9a7ac0', dark = '#6a4a8a', pants = '#4a3a6a';
  r.torsoMesh(skin);
  P(G.sphere(), '#aa8ad0', { parent: r.torso, pos: [0, 0.5, 0.2], s: [0.46, 0.32, 0.3] });
  for (let i = 0; i < 3; i++) P(G.box(0.3, 0.03, 0.03), '#4a2a4a', { parent: r.torso, pos: [0.1, 0.3 + i * 0.12, 0.52], rot: [0, 0, 0.3], outline: false });
  // 背后的针管
  const syr = new THREE.Group(); syr.position.set(0, 0.75, -0.5); syr.rotation.x = -0.5; r.torso.add(syr);
  P(G.cyl(0.1, 0.1, 0.5, 10), '#e0f0e0', { parent: syr, opacity: 0.8 });
  P(G.cyl(0.08, 0.08, 0.4, 10), '#7dff7a', { parent: syr, emissive: '#40c040', ei: 0.5, outline: false });
  P(G.cyl(0.02, 0.02, 0.3, 6), '#c8c8c8', { parent: syr, pos: [0, 0.38, 0] });
  r.skirt(pants, 0.18, 1.2, 0.08, 'mundo');
  r.limbs({ sleeve: skin, fore: skin, hand: skin, pants, boots: '#3a3a3a' });
  r.head.position.y = r.s.bodyH + 0.3;
  r.headBall(skin, { sx: 1.1, sy: 0.9 });
  for (const s of [1, -1]) { const e = onHeadGroup(r, s * 0.33, 0.0, 0.92, 0.0); P(G.sphere(), '#ffffff', { parent: e, s: [0.12, 0.1, 0.05], ol: 0.01 }); P(G.sphere(8, 6), '#2a1a2a', { parent: e, pos: [s * -0.02, 0, 0.04], s: 0.04, outline: false }); }
  const mo = onHeadGroup(r, 0, -0.45, 0.88, 0.0);
  P(G.box(0.4, 0.1, 0.05), '#3a1a2a', { parent: mo, outline: false });
  for (let i = -2; i <= 2; i++) P(G.box(0.05, 0.05, 0.03), '#fff8e0', { parent: mo, pos: [i * 0.08, 0.03, 0.02], outline: false });
  // 切肉刀
  const w = held(r.handR, Math.PI / 2 - 0.3);
  P(G.cyl(0.05, 0.05, 0.4, 8), '#5a3a26', { parent: w, pos: [0, 0.05, 0] });
  P(G.box(0.55, 0.7, 0.05), '#b8c2cc', { parent: w, pos: [0.15, 0.6, 0] });
  P(G.box(0.06, 0.7, 0.06), '#e4ecf4', { parent: w, pos: [0.42, 0.6, 0], outline: false });
  r.tip = tipAt(w, 0.2, 0.9, 0);
  return r;
}

// ---------------- 娜美 ----------------
function nami() {
  const r = new Rig({ scale: 1.0, bodyW: 0.38, bodyH: 0.76, headR: 0.57, legLen: 0.52 });
  const skin = '#8ac8c8', teal = '#3fa0b0', scale = '#2f7a9a', hair = '#c83a4a', gold = '#e8c25a';
  r.torsoMesh(skin);
  P(G.torus(0.3, 0.07), gold, { parent: r.torso, pos: [0, 0.62, 0.04], rot: [Math.PI / 2 - 0.15, 0, 0] });
  for (const s of [1, -1]) P(G.sphere(), '#e8a0b0', { parent: r.torso, pos: [s * 0.14, 0.5, 0.3], s: [0.15, 0.13, 0.1] });
  P(G.torus(0.39, 0.06), gold, { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(scale, 0.55, 1.35, 0.14, 'nami');
  r.limbs({ sleeve: skin, fore: skin, hand: skin, pants: scale, boots: teal });
  // 鱼尾鳍（脚）
  for (const Fo of [r.footL, r.footR]) P(G.cone(0.2, 0.35, 3), '#6ad0e0', { parent: Fo, pos: [0, 0.02, -0.15], rot: [-Math.PI / 2, 0, 0], s: [1.4, 1, 0.3] });
  r.headBall(skin);
  hairCap(r, hair, { tilt: -0.4 });
  P(G.sphere(), hair, { parent: r.head, pos: [0, -0.35, -0.28], s: [0.6, 0.75, 0.42] });
  lock(r, r.head, [0, -0.6, -0.35], Math.PI - 0.2, 4, hair, (j) => [0.32 - j * 0.06, 0.24, 0.16], 0.24, { amp: 0.1 });
  // 头鳍
  for (const s of [1, -1]) P(G.cone(0.14, 0.5, 3), '#6ad0e0', { parent: r.head, pos: [s * 0.6, 0.1, -0.1], rot: [0, 0, -s * 1.1], s: [1, 1, 0.3], emissive: '#3aa0c0', ei: 0.3 });
  r.face({ eye: '#e8a030', eyeH: 0.2, blushCol: '#ff8ab0' });
  // 珊瑚法杖
  const w = held(r.handR, 0.15);
  P(G.cyl(0.04, 0.045, 1.8, 8), gold, { parent: w, pos: [0, 0.45, 0] });
  const orb = P(G.sphere(12, 8), '#8ae0ff', { parent: w, pos: [0, 1.45, 0], s: 0.14, emissive: '#40c0ff', ei: 0.9 });
  for (let i = 0; i < 3; i++) P(G.cone(0.04, 0.3, 5), '#ff8a8a', { parent: w, pos: [Math.cos(i * 2.1) * 0.12, 1.4, Math.sin(i * 2.1) * 0.12], rot: [Math.cos(i * 2.1) * 0.6, 0, -Math.sin(i * 2.1) * 0.6] });
  r.hooks.push((dt, t) => { orb.scale.setScalar(0.13 + Math.sin(t * 4) * 0.02); });
  r.tip = orb;
  return r;
}

export const HERO_MODELS2 = { yasuo, zed, jinx, ezreal, vayne, teemo, thresh, blitzcrank, leona, lulu, morgana, katarina, xinzhao, amumu, brand, veigar, twistedfate, leesin, mundo, nami };
