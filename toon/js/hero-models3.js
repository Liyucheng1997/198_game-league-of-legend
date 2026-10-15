// 第三批五位英雄的 Q 版手绘建模：锐雯、卢锡安、内瑟斯、泽拉斯、蔚。同样全部由基础几何体拼装。
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
// 一条会摆动的长发 / 飘带
function lock(r, parent, pos, rx, n, color, size, spacing, o = {}) {
  const g = new THREE.Group(); g.position.set(...pos); g.rotation.x = rx; if (o.rz) g.rotation.z = o.rz; parent.add(g);
  const nodes = chain(g, n, (c, j) => P(G.sphere(), j === n - 1 && o.tip ? o.tip : color, { parent: c, pos: [0, spacing * 0.5, 0], s: typeof size === 'function' ? size(j) : size }), spacing);
  sway(r, nodes, o.amp ?? 0.12, o.speed ?? 3, o.base ?? 0.1);
  return nodes;
}

// ---------------- 锐雯 ----------------
function riven() {
  const r = new Rig({ scale: 1.04, bodyW: 0.4, bodyH: 0.78, headR: 0.56, legLen: 0.52 });
  const dark = '#3a4448', teal = '#4f6a6a', brown = '#7a5236', hair = '#eef0f4', rune = '#7dffb0';
  r.torsoMesh(dark);
  // 交叉绑带与腰带
  P(G.box(0.12, 0.85, 0.06), brown, { parent: r.torso, pos: [-0.08, 0.42, 0.38], rot: [0, 0, -0.55] });
  P(G.torus(0.41, 0.07), brown, { parent: r.torso, pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(teal, 0.36, 1.4, 0.14, 'riven');
  r.limbs({ sleeve: dark, fore: '#e8dcc8', hand: brown, pants: '#2a3034', boots: brown });
  // 左肩大护甲（诺克萨斯式）
  P(G.sphere(), '#6a7478', { parent: r.armL, pos: [0.08, 0.06, 0], s: [0.34, 0.24, 0.34] });
  P(G.torus(0.3, 0.035), '#c9a24a', { parent: r.armL, pos: [0.08, 0.0, 0], rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 2; i++) P(G.cone(0.06, 0.26, 5), '#8a9498', { parent: r.armL, pos: [0.2 + i * 0.07, 0.22, (i - 0.5) * 0.15], rot: [0, 0, -0.6 - i * 0.3] });
  r.headBall(SKIN);
  // 白色短发：头顶 + 刘海尖刺 + 脑后两缕
  hairCap(r, hair, { tilt: -0.45, sy: 1.12 });
  for (let i = 0; i < 5; i++) spikeOnHead(r, hair, (i - 2) * 0.25, 0.42, 0.78 - Math.abs(i - 2) * 0.1, 0.13, 0.26, 0.9);
  for (const s of [1, -1]) P(G.capsule(0.12, 0.32), hair, { parent: r.head, pos: [s * 0.5, -0.22, 0.05], rot: [0, 0, s * 0.12] });
  lock(r, r.head, [0, 0.0, -0.5], -2.6, 3, hair, (j) => [0.18 - j * 0.04, 0.2, 0.12], 0.22, { amp: 0.14 });
  r.face({ eye: '#8a3a2a', brow: 0.25, browCol: '#c8c8d0', eyeH: 0.15, mouth: 'line', blush: false });
  // 断剑：宽大剑身、剑尖缺了一块，剑身刻着发光符文
  const w = held(r.handR, Math.PI / 2 - 0.3);
  P(G.cyl(0.045, 0.045, 0.36, 8), '#3a2a22', { parent: w, pos: [0, 0.02, 0] });
  P(G.box(0.5, 0.1, 0.16), '#5a6064', { parent: w, pos: [0, 0.22, 0] });
  P(G.box(0.36, 1.25, 0.07), '#c8d0d4', { parent: w, pos: [0, 0.9, 0] });
  P(G.box(0.08, 1.15, 0.075), '#e8eef0', { parent: w, pos: [0.13, 0.88, 0], outline: false });
  // 断口：锯齿状剑尖
  P(G.cone(0.12, 0.3, 3), '#c8d0d4', { parent: w, pos: [-0.1, 1.64, 0], s: [1, 1, 0.35] });
  P(G.cone(0.08, 0.18, 3), '#c8d0d4', { parent: w, pos: [0.1, 1.58, 0], rot: [0, 0, -0.3], s: [1, 1, 0.35] });
  for (let i = 0; i < 4; i++) P(G.box(0.12, 0.05, 0.08), rune, { parent: w, pos: [-0.04, 0.45 + i * 0.28, 0.005], rot: [0, 0, (i % 2 ? 0.5 : -0.5)], emissive: '#30ff80', ei: 0.9, outline: false });
  // 漂浮的剑身碎片
  const frag = new THREE.Group(); frag.position.set(0, 1.95, 0); w.add(frag);
  const f1 = P(G.cone(0.1, 0.32, 3), '#c8d0d4', { parent: frag, s: [1, 1, 0.35], emissive: '#30ff80', ei: 0.15 });
  const halo = new THREE.Mesh(G.sphere(12, 8), glowMat(rune, 0.15)); halo.scale.set(0.2, 0.8, 0.12); halo.position.y = 0.9; w.add(halo);
  r.hooks.push((dt, t) => { f1.position.y = Math.sin(t * 3) * 0.06; f1.rotation.y = t * 1.5; halo.material.opacity = 0.12 + Math.sin(t * 4) * 0.05; });
  r.tip = tipAt(w, 0, 1.7, 0);
  return r;
}

// ---------------- 卢锡安 ----------------
function lucian() {
  const r = new Rig({ scale: 1.06, bodyW: 0.41, bodyH: 0.8, headR: 0.54, legLen: 0.54 });
  const coat = '#26262e', trim = '#e8e0c8', gold = '#d8b050', skin = '#8a5a3c', light = '#bfe8ff';
  r.torsoMesh('#3a3a44');
  // 长风衣：前襟 + 拖到小腿的长下摆
  for (const s of [1, -1]) P(G.box(0.22, 0.8, 0.06), coat, { parent: r.torso, pos: [s * 0.22, 0.42, 0.34], rot: [-0.08, 0, s * 0.1] });
  P(G.box(0.06, 0.7, 0.07), trim, { parent: r.torso, pos: [0, 0.42, 0.38], outline: false });
  P(G.torus(0.42, 0.05), gold, { parent: r.torso, pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(coat, 0.75, 1.55, 0.14, 'lucian');
  // 高立领
  P(G.cyl(0.32, 0.36, 0.2, 14, 1), coat, { parent: r.torso, pos: [0, 0.86, -0.04], mat: toon(coat, { side: DS }) });
  r.limbs({ sleeve: coat, fore: coat, hand: skin, pants: '#1f1f26', boots: '#3a2a22' });
  for (const F of [r.foreL, r.foreR]) P(G.torus(0.13, 0.035), trim, { parent: F, pos: [0, -0.26, 0], rot: [Math.PI / 2, 0, 0], outline: false });
  r.headBall(skin);
  // 短寸头 + 胡茬
  hairCap(r, '#1a1414', { tilt: -0.75, sy: 1.02, sx: 1.06, sz: 1.06 });
  blob(r, r.head, '#2a1e1a', 0, -0.62, 0.72, [0.22, 0.1, 0.12], -0.06);
  r.face({ eye: '#2a1a14', brow: 0.3, browCol: '#1a1414', eyeH: 0.14, mouth: 'line', blush: false });
  // 背后飘带
  lock(r, r.torso, [0, 0.7, -0.4], -2.7, 3, trim, [0.14, 0.22, 0.04], 0.26, { amp: 0.15, tip: gold });
  // 双枪：右手金色圣枪、左手银色圣枪
  const gun = (hand, col, glowCol) => {
    const w = held(hand, Math.PI / 2, { pos: [0, -0.04, 0.02] });
    P(G.box(0.12, 0.24, 0.16), '#3a2a22', { parent: w, pos: [0, -0.02, -0.08], rot: [0.4, 0, 0] });
    P(G.box(0.16, 0.5, 0.18), col, { parent: w, pos: [0, 0.22, 0] });
    P(G.cyl(0.06, 0.07, 0.3, 10), '#4a4a52', { parent: w, pos: [0, 0.55, 0.02] });
    const c = P(G.octa(0.07), glowCol, { parent: w, pos: [0, 0.22, 0.1], emissive: glowCol, ei: 1, outline: false });
    const halo = new THREE.Mesh(G.sphere(10, 8), glowMat(glowCol, 0.35)); halo.scale.setScalar(0.16); halo.position.set(0, 0.7, 0.02); w.add(halo);
    r.hooks.push((dt, t) => { c.rotation.y = t * 3; halo.scale.setScalar(0.14 + Math.sin(t * 6) * 0.03); });
    return w;
  };
  const wr = gun(r.handR, gold, '#fff3a0');
  gun(r.handL, '#c8ccd8', light);
  r.tip = tipAt(wr, 0, 0.72, 0.02);
  return r;
}

// ---------------- 内瑟斯 ----------------
function nasus() {
  const r = new Rig({ scale: 1.18, bodyW: 0.48, bodyH: 0.82, headR: 0.48, armR: 0.15, legR: 0.17, legLen: 0.5 });
  const fur = '#8a6440', furD = '#5a4028', purple = '#5a3a8a', gold = '#e0b040', cream = '#e8d8b8';
  r.torsoMesh(fur);
  // 金色项圈与紫色胸甲
  P(G.torus(0.34, 0.09, Math.PI * 2, 8, 24), gold, { parent: r.torso, pos: [0, 0.78, 0.02], rot: [Math.PI / 2 - 0.15, 0, 0], emissive: '#a07010', ei: 0.25 });
  P(G.sphere(), purple, { parent: r.torso, pos: [0, 0.45, 0.16], s: [0.44, 0.32, 0.34] });
  P(G.octa(0.12), '#b58aff', { parent: r.torso, pos: [0, 0.48, 0.48], s: [1, 1.4, 0.5], emissive: '#8a4ad0', ei: 0.7 });
  P(G.torus(0.48, 0.06), gold, { parent: r.torso, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt(purple, 0.42, 1.38, 0.12, 'nasus');
  P(G.box(0.3, 0.5, 0.05), gold, { parent: r.torso, pos: [0, -0.15, 0.48], rot: [-0.1, 0, 0] });
  r.limbs({ sleeve: fur, fore: furD, hand: furD, pants: furD, boots: gold });
  for (const [A, s] of [[r.armL, 1], [r.armR, -1]]) {
    P(G.sphere(), gold, { parent: A, pos: [s * 0.06, 0.05, 0], s: [0.3, 0.22, 0.3], emissive: '#a07010', ei: 0.2 });
    P(G.cone(0.08, 0.3, 4), purple, { parent: A, pos: [s * 0.16, 0.25, 0], rot: [0, 0, -s * 0.5] });
  }
  for (const F of [r.foreL, r.foreR]) P(G.cyl(0.15, 0.17, 0.18, 10), gold, { parent: F, pos: [0, -0.22, 0] });
  // 豺狼头：圆头 + 长吻 + 黑鼻头 + 高耸尖耳 + 金色头饰
  r.headBall(fur, { sy: 1.0 });
  const snout = new THREE.Group(); snout.position.set(0, -0.12, 0.3); r.head.add(snout);
  P(G.capsule(0.16, 0.42, 10), fur, { parent: snout, pos: [0, 0, 0.22], rot: [Math.PI / 2 - 0.12, 0, 0] });
  P(G.capsule(0.12, 0.3, 8), cream, { parent: snout, pos: [0, -0.1, 0.2], rot: [Math.PI / 2 - 0.05, 0, 0] });
  P(G.sphere(10, 8), '#1a1414', { parent: snout, pos: [0, 0.04, 0.55], s: [0.09, 0.07, 0.07] });
  for (const s of [1, -1]) {
    const e = new THREE.Group(); e.position.set(s * 0.28, 0.35, -0.05); e.rotation.set(-0.15, 0, -s * 0.2); r.head.add(e);
    P(G.cone(0.15, 0.62, 4), fur, { parent: e, pos: [0, 0.3, 0], rot: [0, Math.PI / 4, 0], s: [1, 1, 0.5] });
    P(G.cone(0.09, 0.44, 4), '#3a2418', { parent: e, pos: [0, 0.26, 0.05], rot: [0, Math.PI / 4, 0], s: [1, 1, 0.35], outline: false });
    P(G.torus(0.1, 0.03), gold, { parent: e, pos: [0, 0.08, 0], rot: [Math.PI / 2, 0, 0], outline: false });
    r.hooks.push((dt, t) => { e.rotation.z = -s * (0.2 + Math.max(0, Math.sin(t * 1.3 + s) - 0.92) * 2); });
  }
  // 头饰：额前金片 + 两侧垂下的紫色头巾
  const crown = onHeadGroup(r, 0, 0.42, 0.88, 0.0);
  P(G.box(0.36, 0.14, 0.05), gold, { parent: crown, emissive: '#a07010', ei: 0.3 });
  P(G.octa(0.06), '#8ad8ff', { parent: crown, pos: [0, 0, 0.04], emissive: '#40b0ff', ei: 1, outline: false });
  for (const s of [1, -1]) P(G.box(0.18, 0.55, 0.05), purple, { parent: r.head, pos: [s * 0.42, -0.35, -0.12], rot: [0.15, 0, s * 0.12] });
  for (const s of [1, -1]) {
    const eg = onHeadGroup(r, s * 0.32, 0.05, 0.92, 0.01);
    P(G.sphere(), '#ffd84a', { parent: eg, s: [0.07, 0.05, 0.03], emissive: '#ffb020', ei: 0.8, outline: false });
  }
  cape(r, purple, { trim: gold, h: 1.0, color2: '#3f2766' });
  // 巨大的权杖斧
  const w = held(r.handR, 0.25);
  P(G.cyl(0.05, 0.05, 2.6, 8), '#4a3020', { parent: w, pos: [0, 0.55, 0] });
  for (const y of [-0.6, 0.2, 1.4]) P(G.cyl(0.07, 0.07, 0.1, 8), gold, { parent: w, pos: [0, y, 0] });
  const head = new THREE.Group(); head.position.y = 1.85; w.add(head);
  P(G.torus(0.42, 0.11, Math.PI * 0.9, 6, 16), gold, { parent: head, pos: [0.08, 0, 0], rot: [0, Math.PI / 2, -Math.PI * 0.45], s: [1, 1, 0.4], emissive: '#a07010', ei: 0.3 });
  P(G.cone(0.08, 0.5, 6), gold, { parent: head, pos: [0, 0.4, 0] });
  P(G.octa(0.12), '#b58aff', { parent: head, pos: [0, 0, 0], emissive: '#8a4ad0', ei: 0.9 });
  const halo = new THREE.Mesh(G.sphere(12, 8), glowMat('#b58aff', 0.3)); halo.scale.setScalar(0.35); head.add(halo);
  r.hooks.push((dt, t) => { halo.scale.setScalar(0.32 + Math.sin(t * 3) * 0.05); });
  r.tip = tipAt(head, 0, 0.3, 0.4);
  return r;
}

// ---------------- 泽拉斯 ----------------
function xerath() {
  const r = new Rig({ scale: 1.12, bodyW: 0.42, bodyH: 0.8, headR: 0.42, armR: 0.13, legLen: 0.5 });
  const stone = '#5a544a', stone2 = '#7a7264', blue = '#5ad0ff', core = '#bff0ff', gold = '#c9a24a';
  // 发光的能量躯干 + 漂浮的石板
  const body = new THREE.Mesh(G.sphere(20, 14), glowMat(blue, 0.55)); body.scale.set(0.36, 0.5, 0.3); body.position.y = 0.45; r.torso.add(body);
  const heart = P(G.sphere(16, 12), core, { parent: r.torso, pos: [0, 0.48, 0.05], s: 0.17, emissive: '#7fe0ff', ei: 1, outline: false });
  const plates = [];
  const plate = (pos, s, rot, col = stone) => { const m = P(G.dodeca(1), col, { parent: r.torso, pos, s, rot, ol: 0.03 }); plates.push([m, pos[1]]); return m; };
  plate([0, 0.72, 0.12], [0.36, 0.16, 0.22], [0.2, 0, 0]);
  plate([0.24, 0.42, 0.16], [0.13, 0.26, 0.12], [0, 0, -0.2], stone2);
  plate([-0.24, 0.42, 0.16], [0.13, 0.26, 0.12], [0, 0, 0.2], stone2);
  plate([0, 0.12, 0.1], [0.3, 0.12, 0.2], [0, 0.3, 0]);
  plate([0, 0.55, -0.25], [0.32, 0.3, 0.12], [-0.2, 0, 0]);
  P(G.torus(0.4, 0.04), gold, { parent: r.torso, pos: [0, 0.82, 0], rot: [Math.PI / 2, 0, 0], emissive: '#a07010', ei: 0.3 });
  // 肩上的石块与金色锁链
  for (const [A, s] of [[r.armL, 1], [r.armR, -1]]) {
    P(G.dodeca(1), stone, { parent: A, pos: [s * 0.08, 0.08, 0], s: [0.26, 0.22, 0.24], rot: [0.3, 0, s * 0.4], ol: 0.03 });
    P(G.capsule(0.11, 0.2), blue, { parent: A, pos: [0, -0.17, 0], mat: glowMat(blue, 0.7), outline: false });
    const F = s > 0 ? r.foreL : r.foreR, H = s > 0 ? r.handL : r.handR;
    P(G.dodeca(1), stone2, { parent: F, pos: [0, -0.15, 0], s: [0.16, 0.2, 0.16], ol: 0.025 });
    P(G.torus(0.14, 0.03), gold, { parent: F, pos: [0, -0.26, 0], rot: [Math.PI / 2, 0, 0], outline: false });
    P(G.sphere(12, 8), core, { parent: H, s: 0.13, emissive: '#7fe0ff', ei: 1, outline: false });
  }
  // 没有腿：腰下拖着一条能量尾巴
  r.legL.visible = r.legR.visible = false;
  const tail = new THREE.Group(); tail.position.set(0, -0.05, 0); tail.rotation.x = Math.PI; r.hips.add(tail);
  const nodes = chain(tail, 5, (g, j) => {
    const m = new THREE.Mesh(G.sphere(14, 10), glowMat(j % 2 ? blue : core, 0.6 - j * 0.08));
    const k = 0.28 - j * 0.045; m.scale.set(k, k * 1.3, k); m.position.y = 0.12; g.add(m);
  }, 0.22);
  sway(r, nodes, 0.18, 3.5, 0.05);
  // 石面具头：发光双眼 + 头顶石冠
  r.head.position.y = r.s.bodyH + 0.36;
  const hb = new THREE.Mesh(G.sphere(16, 12), glowMat(blue, 0.22)); hb.scale.setScalar(0.4); r.head.add(hb);
  P(G.dodeca(1), stone2, { parent: r.head, pos: [0, 0.02, 0.1], s: [0.34, 0.36, 0.3], ol: 0.03 });
  for (const s of [1, -1]) P(G.box(0.12, 0.05, 0.05), '#e8fbff', { parent: r.head, pos: [s * 0.12, 0.04, 0.39], rot: [0, 0, s * 0.25], emissive: '#9ff0ff', ei: 1, outline: false });
  P(G.cone(0.14, 0.5, 4), stone, { parent: r.head, pos: [0, 0.48, -0.05], rot: [-0.2, Math.PI / 4, 0] });
  for (const s of [1, -1]) P(G.cone(0.08, 0.38, 4), stone, { parent: r.head, pos: [s * 0.24, 0.36, -0.05], rot: [-0.1, 0, -s * 0.5] });
  P(G.box(0.3, 0.06, 0.06), gold, { parent: r.head, pos: [0, 0.26, 0.32], rot: [0.3, 0, 0], emissive: '#a07010', ei: 0.3 });
  // 漂浮：整个身体上下起伏，石板轻轻错位
  r.hooks.push((dt, t) => {
    r.body.position.y += 0.35 + Math.sin(t * 2) * 0.08;
    body.material.opacity = 0.5 + Math.sin(t * 5) * 0.08;
    heart.scale.setScalar(0.16 + Math.sin(t * 6) * 0.025);
    plates.forEach(([m, y0], i) => { m.position.y = y0 + Math.sin(t * 2.5 + i) * 0.03; });
  });
  r.tip = r.handR;
  return r;
}

// ---------------- 蔚 ----------------
function vi() {
  const r = new Rig({ scale: 1.06, bodyW: 0.42, bodyH: 0.78, headR: 0.55, armR: 0.13, legLen: 0.52 });
  const red = '#b8303a', jacket = '#6a2a3a', pink = '#ff6fa8', steel = '#8a929e', gold = '#e0b040', tan = '#5a4a40';
  r.torsoMesh('#2f2a34');
  // 短夹克
  for (const s of [1, -1]) P(G.box(0.24, 0.55, 0.06), jacket, { parent: r.torso, pos: [s * 0.21, 0.55, 0.33], rot: [-0.12, 0, s * 0.1] });
  P(G.torus(0.42, 0.06), tan, { parent: r.torso, pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] });
  r.skirt('#3a3040', 0.18, 1.3, 0.14, 'vi');
  r.limbs({ sleeve: jacket, fore: jacket, hand: steel, pants: '#3a3a4a', boots: '#2a2228' });
  r.headBall(SKIN);
  // 粉色短发：一侧剃短、一侧刘海
  hairCap(r, pink, { tilt: -0.4, sy: 1.1 });
  for (let i = 0; i < 4; i++) blob(r, r.head, pink, 0.35 - i * 0.24, 0.42, 0.84, [0.18, 0.22, 0.1], -0.02);
  P(G.capsule(0.13, 0.3), pink, { parent: r.head, pos: [0.47, -0.2, 0.12], rot: [0, 0, 0.12] });
  P(G.sphere(), '#e04a8a', { parent: r.head, pos: [0, -0.25, -0.3], s: [0.48, 0.4, 0.34] });
  r.face({ eye: '#3a6ad0', eyeH: 0.17, brow: 0.2, browCol: '#e04a8a', blushCol: '#ff8aa0' });
  // 脸颊上的 "VI" 纹身（两道小斜线）
  const tat = onHeadGroup(r, -0.55, -0.3, 0.78, 0.005);
  for (const s of [1, -1]) P(G.box(0.03, 0.11, 0.02), '#3a3a5a', { parent: tat, rot: [0, 0, s * 0.3], pos: [s * 0.03, 0, 0], outline: false });
  // 头顶护目镜
  P(G.torus(0.55, 0.05, Math.PI * 2, 6, 28), '#3a2a22', { parent: r.head, pos: [0, 0.18, 0], rot: [Math.PI / 2 + 0.35, 0, 0] });
  for (const s of [1, -1]) { const g = onHeadGroup(r, s * 0.28, 0.5, 0.8, 0.03); P(G.cyl(0.11, 0.11, 0.08, 14), steel, { parent: g, rot: [Math.PI / 2, 0, 0] }); P(G.cyl(0.08, 0.08, 0.09, 14), '#ffb0d8', { parent: g, rot: [Math.PI / 2, 0, 0], emissive: '#ff6fa8', ei: 0.5, outline: false }); }
  // 海克斯巨型拳套
  let tip = null;
  for (const [F, s] of [[r.foreL, 1], [r.foreR, -1]]) {
    const g = new THREE.Group(); g.position.set(0, -0.32, 0.04); F.add(g);
    P(G.cyl(0.24, 0.2, 0.32, 12), red, { parent: g, pos: [0, 0.18, 0] });
    P(G.torus(0.24, 0.04), gold, { parent: g, pos: [0, 0.3, 0], rot: [Math.PI / 2, 0, 0] });
    P(G.sphere(), steel, { parent: g, pos: [0, -0.12, 0.02], s: [0.36, 0.3, 0.34] });
    for (let i = 0; i < 4; i++) P(G.box(0.12, 0.1, 0.14), '#c8ccd4', { parent: g, pos: [(i - 1.5) * 0.15, -0.28, 0.14], rot: [0.3, 0, 0], ol: 0.02 });
    P(G.cyl(0.12, 0.12, 0.06, 12), pink, { parent: g, pos: [s * 0.3, -0.05, 0], rot: [0, 0, Math.PI / 2], emissive: '#ff4a90', ei: 0.9, outline: false });
    for (let i = 0; i < 2; i++) P(G.cyl(0.05, 0.06, 0.32, 8), steel, { parent: g, pos: [(i - 0.5) * 0.18, 0.4, -0.18], rot: [-0.5, 0, 0] });
    const halo = new THREE.Mesh(G.sphere(10, 8), glowMat(pink, 0.3)); halo.scale.setScalar(0.42); halo.position.y = -0.1; g.add(halo);
    r.hooks.push((dt, t) => { halo.scale.setScalar(0.38 + Math.sin(t * 5 + s) * 0.05); });
    if (s < 0) tip = tipAt(g, 0, -0.38, 0.15);
  }
  r.tip = tip;
  return r;
}

export const HERO_MODELS3 = { riven, lucian, nasus, xerath, vi };
