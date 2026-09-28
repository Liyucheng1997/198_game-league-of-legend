// 小兵、防御塔、水晶、野怪、训练假人、树木等场景道具模型。
import * as THREE from 'three';
import { P, G, toon, glowMat, mergeGeometries } from './toon-kit.js';

export const TEAM_COL = { 1: '#4f86d9', 2: '#d9574f', 0: '#9a7ad0' };
export const TEAM_DARK = { 1: '#2c5aa3', 2: '#a3302c', 0: '#5a3a90' };

export function minionModel(team, type) {
  const col = TEAM_COL[team], dark = TEAM_DARK[team];
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  P(G.sphere(), col, { parent: body, pos: [0, 0.55, 0], s: [0.42, 0.44, 0.4] });
  P(G.sphere(), '#f3e6c8', { parent: body, pos: [0, 0.45, 0.2], s: [0.26, 0.24, 0.2], outline: false });
  for (const s of [1, -1]) {
    P(G.sphere(12, 8), '#221a1a', { parent: body, pos: [s * 0.13, 0.66, 0.34], s: [0.06, 0.09, 0.05], ol: 0.01 });
    P(G.sphere(8, 6), '#ffffff', { parent: body, pos: [s * 0.13 - 0.02, 0.69, 0.385], s: 0.022, outline: false, emissive: '#fff' });
  }
  if (type === 'caster') {
    P(G.cone(0.36, 0.7, 12), dark, { parent: body, pos: [0, 1.12, -0.03], rot: [-0.2, 0, 0.15] });
    P(G.cyl(0.4, 0.4, 0.05, 16), dark, { parent: body, pos: [0, 0.84, 0] });
  } else {
    P(G.hemi(), dark, { parent: body, mat: toon(dark, { side: THREE.DoubleSide }), pos: [0, 0.72, -0.02], s: [0.44, 0.34, 0.43] });
    P(G.cone(0.07, 0.25, 6), '#e8c25a', { parent: body, pos: [0, 1.1, 0] });
  }
  const feet = [];
  for (const s of [1, -1]) {
    const f = new THREE.Group(); f.position.set(s * 0.17, 0.08, 0.02); g.add(f);
    P(G.sphere(10, 8), dark, { parent: f, s: [0.12, 0.08, 0.15] });
    feet.push(f);
  }
  const hand = new THREE.Group(); hand.position.set(-0.4, 0.5, 0.1); body.add(hand);
  P(G.sphere(10, 8), col, { parent: hand, s: 0.1 });
  if (type === 'caster') {
    P(G.cyl(0.025, 0.025, 0.6, 6), '#8a5a3c', { parent: hand, pos: [0, 0.15, 0.05] });
    P(G.sphere(12, 8), TEAM_COL[team], { parent: hand, pos: [0, 0.5, 0.05], s: 0.1, emissive: col, ei: 0.8 });
  } else {
    const sw = new THREE.Group(); sw.rotation.x = 1.2; hand.add(sw);
    P(G.box(0.08, 0.5, 0.03), '#dfe6ee', { parent: sw, pos: [0, 0.3, 0] });
    P(G.box(0.2, 0.05, 0.06), '#8a5a3c', { parent: sw, pos: [0, 0.06, 0] });
  }
  return { obj: g, body, feet, hand };
}

export function towerModel(team) {
  const g = new THREE.Group();
  const stone = '#cfc3a9', stone2 = '#a8997f', col = TEAM_COL[team];
  P(G.cyl(1.6, 1.9, 0.7, 10), stone2, { parent: g, pos: [0, 0.35, 0] });
  P(G.cyl(1.05, 1.3, 3.2, 10), stone, { parent: g, pos: [0, 2.3, 0] });
  for (let i = 0; i < 4; i++) P(G.box(0.5, 0.35, 0.15), stone2, { parent: g, pos: [Math.cos(i * 1.57 + 0.4) * 1.18, 1.3 + i * 0.6, Math.sin(i * 1.57 + 0.4) * 1.18], rot: [0, -(i * 1.57 + 0.4) + Math.PI / 2, 0] });
  P(G.cyl(1.12, 1.12, 0.3, 10), col, { parent: g, pos: [0, 3.3, 0] });
  P(G.cyl(1.5, 1.15, 0.6, 10), stone2, { parent: g, pos: [0, 4.1, 0] });
  for (let i = 0; i < 6; i++) P(G.box(0.42, 0.45, 0.42), stone, { parent: g, pos: [Math.cos(i * 1.047) * 1.25, 4.6, Math.sin(i * 1.047) * 1.25] });
  const crystal = new THREE.Group(); crystal.position.y = 5.9; g.add(crystal);
  P(G.octa(0.7), col, { parent: crystal, s: [0.8, 1.4, 0.8], emissive: col, ei: 0.55 });
  const halo = new THREE.Mesh(G.sphere(12, 8), glowMat(col, 0.35)); halo.scale.setScalar(1.3); crystal.add(halo);
  return { obj: g, crystal, top: 5.9 };
}

export function inhibModel(team) {
  const g = new THREE.Group(), col = TEAM_COL[team];
  P(G.cyl(1.6, 1.8, 0.5, 12), '#a8997f', { parent: g, pos: [0, 0.25, 0] });
  const ring = new THREE.Group(); ring.position.y = 2.0; g.add(ring);
  P(G.torus(1.0, 0.18, Math.PI * 2, 8, 24), '#cfc3a9', { parent: ring });
  P(G.octa(0.55), col, { parent: ring, s: [1, 1.3, 1], emissive: col, ei: 0.6 });
  const halo = new THREE.Mesh(G.sphere(12, 8), glowMat(col, 0.3)); halo.scale.setScalar(1.1); ring.add(halo);
  return { obj: g, crystal: ring, top: 2.8 };
}

export function nexusModel(team) {
  const g = new THREE.Group(), col = TEAM_COL[team];
  P(G.cyl(3.4, 3.8, 0.8, 14), '#a8997f', { parent: g, pos: [0, 0.4, 0] });
  P(G.cyl(2.4, 2.9, 1.0, 14), '#cfc3a9', { parent: g, pos: [0, 1.2, 0] });
  const crystal = new THREE.Group(); crystal.position.y = 4; g.add(crystal);
  P(G.octa(1.4), col, { parent: crystal, s: [1, 1.7, 1], emissive: col, ei: 0.55 });
  for (let i = 0; i < 4; i++) P(G.octa(0.6), col, { parent: crystal, pos: [Math.cos(i * 1.57) * 1.6, -1.2, Math.sin(i * 1.57) * 1.6], s: [0.7, 1.4, 0.7], rot: [Math.sin(i * 1.57) * 0.4, 0, -Math.cos(i * 1.57) * 0.4], emissive: col, ei: 0.5 });
  const ring = P(G.torus(2.4, 0.12, Math.PI * 2, 6, 40), '#f0d27a', { parent: crystal, rot: [Math.PI / 2, 0, 0], emissive: '#c09a30', ei: 0.4 });
  const halo = new THREE.Mesh(G.sphere(16, 10), glowMat(col, 0.25)); halo.scale.setScalar(2.6); crystal.add(halo);
  return { obj: g, crystal, ring, top: 6.5 };
}

export function fountainModel(team) {
  const g = new THREE.Group(), col = TEAM_COL[team];
  P(G.cyl(6.5, 6.8, 0.35, 32), '#bfb299', { parent: g, pos: [0, 0.17, 0], receive: true });
  P(G.torus(5.6, 0.18, Math.PI * 2, 6, 48), col, { parent: g, pos: [0, 0.38, 0], rot: [Math.PI / 2, 0, 0], emissive: col, ei: 0.6 });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    P(G.cyl(0.3, 0.4, 2.2, 8), '#cfc3a9', { parent: g, pos: [Math.cos(a) * 6, 1.1, Math.sin(a) * 6] });
    P(G.octa(0.35), col, { parent: g, pos: [Math.cos(a) * 6, 2.6, Math.sin(a) * 6], s: [1, 1.5, 1], emissive: col, ei: 0.7 });
  }
  return { obj: g };
}

export function dummyModel() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  P(G.cyl(0.08, 0.1, 1.9, 8), '#8a5a3c', { parent: g, pos: [0, 0.95, 0] });
  P(G.cyl(0.6, 0.7, 0.12, 16), '#8a5a3c', { parent: g, pos: [0, 0.06, 0] });
  P(G.sphere(), '#d9b77a', { parent: body, pos: [0, 1.25, 0], s: [0.48, 0.55, 0.42] });
  for (const [r, c] of [[0.32, '#d94a3a'], [0.22, '#ffffff'], [0.11, '#d94a3a']]) P(G.cyl(r, r, 0.03, 20), c, { parent: body, pos: [0, 1.25, 0.41 + (0.32 - r) * 0.1], rot: [Math.PI / 2, 0, 0], outline: r === 0.32 });
  P(G.sphere(), '#e6c88e', { parent: body, pos: [0, 2.1, 0], s: 0.36 });
  for (const s of [1, -1]) {
    P(G.box(0.14, 0.03, 0.03), '#2a1a14', { parent: body, pos: [s * 0.13, 2.15, 0.33], rot: [0, 0, 0.8], outline: false });
    P(G.box(0.14, 0.03, 0.03), '#2a1a14', { parent: body, pos: [s * 0.13, 2.15, 0.33], rot: [0, 0, -0.8], outline: false });
  }
  P(G.cyl(0.05, 0.05, 1.8, 6), '#8a5a3c', { parent: body, pos: [0, 1.55, 0], rot: [0, 0, Math.PI / 2] });
  P(G.cone(0.42, 0.4, 12), '#c9a24a', { parent: body, pos: [0, 2.48, 0] });
  return { obj: g, body };
}

// 小龙：胖乎乎的喷火龙
export function dragonModel() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const org = '#e8743a', belly = '#f5d08a', horn = '#f4efe0';
  P(G.sphere(), org, { parent: body, pos: [0, 1.6, 0], s: [1.4, 1.2, 1.6] });
  P(G.sphere(), belly, { parent: body, pos: [0, 1.4, 0.55], s: [1.0, 0.9, 1.0], outline: false });
  const head = new THREE.Group(); head.position.set(0, 3.0, 1.2); body.add(head);
  P(G.sphere(), org, { parent: head, s: [0.9, 0.8, 0.9] });
  P(G.sphere(), org, { parent: head, pos: [0, -0.2, 0.7], s: [0.6, 0.45, 0.55] });
  for (const s of [1, -1]) {
    P(G.sphere(), '#ffffff', { parent: head, pos: [s * 0.38, 0.2, 0.62], s: [0.22, 0.26, 0.15] });
    P(G.sphere(), '#2a1a14', { parent: head, pos: [s * 0.38, 0.18, 0.74], s: [0.1, 0.15, 0.06], outline: false });
    P(G.cone(0.14, 0.6, 8), horn, { parent: head, pos: [s * 0.45, 0.75, -0.2], rot: [-0.6, 0, -s * 0.4] });
    P(G.sphere(8, 6), '#2a1a14', { parent: head, pos: [s * 0.15, -0.05, 1.22], s: 0.05, outline: false });
    const wing = new THREE.Group(); wing.position.set(s * 0.9, 2.4, -0.2); body.add(wing);
    const wshape = () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(1.2, 1.4, 2.4, 1.2); sh.lineTo(2.0, 0.5); sh.lineTo(1.6, 0.7); sh.lineTo(1.2, 0.1); sh.lineTo(0.8, 0.3); sh.closePath(); return sh; };
    P(G.shape('dragonWing', wshape, 0.05, 0.02), '#c94f2a', { parent: wing, pos: [s * 1.2, 0.5, 0], rot: [0, s > 0 ? 0 : Math.PI, 0] });
    wing.userData.side = s;
    g.userData['wing' + s] = wing;
    P(G.capsule(0.28, 0.4), org, { parent: body, pos: [s * 0.8, 0.45, 0.4] });
  }
  const tail = new THREE.Group(); tail.position.set(0, 1.3, -1.4); body.add(tail);
  for (let i = 0; i < 4; i++) P(G.sphere(), org, { parent: tail, pos: [0, -i * 0.1, -i * 0.5], s: 0.5 - i * 0.1 });
  P(G.cone(0.3, 0.5, 4), belly, { parent: tail, pos: [0, -0.4, -2.1], rot: [-Math.PI / 2, 0, 0] });
  for (let i = 0; i < 4; i++) P(G.cone(0.18, 0.4, 6), horn, { parent: body, pos: [0, 2.8 - i * 0.05, 0.2 - i * 0.6], rot: [-0.3, 0, 0] });
  g.userData.head = head;
  return { obj: g, body, head };
}

// 纳什男爵：紫色大虫
export function baronModel() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const pur = '#7a4fb8', light = '#b89ae8', spike = '#f0e0ff';
  P(G.torus(3.2, 0.6, Math.PI * 2, 8, 30), '#5a4a6a', { parent: g, pos: [0, 0.3, 0], rot: [Math.PI / 2, 0, 0] });
  const segs = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Group(); s.position.y = i === 0 ? 0.6 : 1.0; (segs[i - 1] || body).add(s);
    P(G.sphere(), i % 2 ? light : pur, { parent: s, s: [1.5 - i * 0.12, 0.8, 1.4 - i * 0.12] });
    P(G.cone(0.2, 0.7, 6), spike, { parent: s, pos: [0, 0.4, -1.1 + i * 0.1], rot: [-0.9, 0, 0] });
    segs.push(s);
  }
  const head = new THREE.Group(); head.position.set(0, 1.2, 0.3); segs[4].add(head);
  P(G.sphere(), pur, { parent: head, s: [1.5, 1.1, 1.4] });
  P(G.sphere(), '#3a1a4a', { parent: head, pos: [0, -0.35, 1.0], s: [0.9, 0.35, 0.4], outline: false });
  for (const s of [1, -1]) {
    P(G.sphere(), '#ffe45a', { parent: head, pos: [s * 0.55, 0.3, 1.05], s: [0.22, 0.3, 0.14], emissive: '#ffb000', ei: 0.7 });
    P(G.cone(0.3, 1.4, 8), spike, { parent: head, pos: [s * 0.9, 0.9, -0.2], rot: [-0.5, 0, -s * 0.6] });
    for (let k = 0; k < 3; k++) P(G.cone(0.07, 0.25, 5), '#ffffff', { parent: head, pos: [s * (0.2 + k * 0.2), -0.25, 1.22], rot: [Math.PI, 0, 0], outline: false });
  }
  return { obj: g, body, head, segs };
}

// 野怪：蛤蟆与小鸟
export function critterModel(kind) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  if (kind === 'frog') {
    P(G.sphere(), '#5aa4a0', { parent: body, pos: [0, 0.8, 0], s: [1.0, 0.8, 0.9] });
    P(G.sphere(), '#d9e8a0', { parent: body, pos: [0, 0.65, 0.4], s: [0.7, 0.5, 0.5], outline: false });
    for (const s of [1, -1]) {
      P(G.sphere(), '#5aa4a0', { parent: body, pos: [s * 0.45, 1.5, 0.3], s: 0.3 });
      P(G.sphere(), '#ffffff', { parent: body, pos: [s * 0.45, 1.55, 0.52], s: [0.18, 0.2, 0.1] });
      P(G.sphere(8, 6), '#1a1414', { parent: body, pos: [s * 0.45, 1.53, 0.6], s: [0.08, 0.12, 0.04], outline: false });
      P(G.sphere(), '#4a8a86', { parent: body, pos: [s * 0.7, 0.25, 0.3], s: [0.35, 0.18, 0.45] });
    }
    P(G.torus(0.35, 0.04, Math.PI, 6, 10), '#2a1a14', { parent: body, pos: [0, 0.9, 0.84], rot: [0, 0, Math.PI], outline: false });
    for (let i = 0; i < 5; i++) P(G.sphere(8, 6), '#e87a4a', { parent: body, pos: [Math.cos(i * 1.3) * 0.6, 1.2 + (i % 2) * 0.2, -0.2 - (i % 3) * 0.2], s: 0.1, outline: false });
  } else {
    P(G.sphere(), '#e0604a', { parent: body, pos: [0, 0.8, 0], s: [0.7, 0.7, 0.75] });
    P(G.sphere(), '#f5d08a', { parent: body, pos: [0, 0.7, 0.35], s: [0.45, 0.45, 0.4], outline: false });
    P(G.cone(0.16, 0.4, 4), '#f0b030', { parent: body, pos: [0, 0.95, 0.8], rot: [Math.PI / 2, 0, 0] });
    for (const s of [1, -1]) {
      P(G.sphere(8, 6), '#1a1414', { parent: body, pos: [s * 0.25, 1.1, 0.58], s: [0.08, 0.11, 0.05] });
      P(G.cone(0.08, 0.5, 5), '#8a3a2a', { parent: body, pos: [s * 0.1, 1.55, -0.1], rot: [-0.5, 0, s * 0.3] });
      P(G.cyl(0.04, 0.04, 0.4, 5), '#f0b030', { parent: body, pos: [s * 0.2, 0.2, 0], outline: false });
    }
  }
  return { obj: g, body };
}

// 树木几何（用于 InstancedMesh）
function prep(geo, s, t) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  if (s) g.scale(s[0], s[1], s[2]);
  if (t) g.translate(t[0], t[1], t[2]);
  return g;
}
export function treeGeometries() {
  const sp = new THREE.SphereGeometry(1, 10, 8), cone = new THREE.ConeGeometry(1, 1, 9), cyl = new THREE.CylinderGeometry(0.18, 0.26, 1, 7);
  return {
    round: {
      canopy: mergeGeometries([prep(sp, [1.2, 1.0, 1.2], [0, 2.5, 0]), prep(sp, [0.85, 0.8, 0.85], [0.7, 2.1, 0.3]), prep(sp, [0.8, 0.75, 0.8], [-0.6, 2.2, -0.35]), prep(sp, [0.7, 0.7, 0.7], [0.1, 3.2, -0.1])]),
      trunk: prep(cyl, [1, 1.8, 1], [0, 0.9, 0]),
    },
    pine: {
      canopy: mergeGeometries([prep(cone, [1.3, 1.4, 1.3], [0, 1.9, 0]), prep(cone, [1.0, 1.2, 1.0], [0, 2.7, 0]), prep(cone, [0.7, 1.0, 0.7], [0, 3.4, 0])]),
      trunk: prep(cyl, [0.8, 1.4, 0.8], [0, 0.7, 0]),
    },
    bush: {
      canopy: mergeGeometries([prep(sp, [0.9, 0.7, 0.9], [0, 0.55, 0]), prep(sp, [0.7, 0.55, 0.7], [0.65, 0.4, 0.2]), prep(sp, [0.65, 0.5, 0.65], [-0.55, 0.4, -0.25])]),
      trunk: null,
    },
    rock: {
      canopy: prep(new THREE.DodecahedronGeometry(1, 0), [1, 0.7, 1], [0, 0.35, 0]),
      trunk: null,
    },
  };
}

// ---------------- 野区营地怪 ----------------
const glowOcta = (parent, pos, s, col, rot) => P(G.octa(1), col, { parent, pos, s, rot, emissive: col, ei: 0.7, ol: 0.02 });

// 蓝色哨兵：背上长着蓝水晶的石像
function blueSentinel() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const stone = '#5a74b0', dark = '#3e5288', cyan = '#7fe0ff';
  P(G.sphere(), stone, { parent: body, pos: [0, 1.9, 0], s: [1.15, 1.2, 0.95] });
  P(G.sphere(), dark, { parent: body, pos: [0, 1.2, 0.1], s: [0.9, 0.6, 0.8] });
  glowOcta(body, [0, 2.1, 0.88], [0.22, 0.3, 0.1], cyan);
  for (const s of [1, -1]) {
    P(G.dodeca(1), dark, { parent: body, pos: [s * 1.15, 2.6, 0], s: [0.55, 0.45, 0.5] });
    glowOcta(body, [s * 1.2, 3.15, -0.1], [0.14, 0.42, 0.14], cyan, [0, 0, -s * 0.4]);
    P(G.capsule(0.28, 0.9), stone, { parent: body, pos: [s * 1.35, 1.7, 0.2], rot: [0.3, 0, s * 0.25] });
    P(G.dodeca(1), dark, { parent: body, pos: [s * 1.5, 0.95, 0.45], s: 0.42 });
    P(G.capsule(0.3, 0.5), dark, { parent: g, pos: [s * 0.55, 0.45, 0] });
  }
  for (let i = 0; i < 4; i++) glowOcta(body, [(i - 1.5) * 0.4, 2.9 + (i % 2) * 0.3, -0.6], [0.14, 0.5, 0.14], cyan, [-0.5, 0, (i - 1.5) * 0.3]);
  const head = new THREE.Group(); head.position.set(0, 3.15, 0.35); body.add(head);
  P(G.sphere(), stone, { parent: head, s: [0.45, 0.38, 0.42] });
  for (const s of [1, -1]) P(G.box(0.16, 0.06, 0.05), cyan, { parent: head, pos: [s * 0.16, 0.02, 0.4], rot: [0, 0, s * 0.2], emissive: cyan, ei: 1, outline: false });
  glowOcta(head, [0, 0.45, 0], [0.12, 0.3, 0.12], cyan);
  return { obj: g, body };
}
// 红色树精：背上长满荆棘的大块头
function redBrambleback() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const red = '#c04a32', belly = '#eaa870', thorn = '#5a3a2a';
  P(G.sphere(), red, { parent: body, pos: [0, 1.7, 0], s: [1.2, 1.1, 1.05] });
  P(G.sphere(), belly, { parent: body, pos: [0, 1.45, 0.45], s: [0.85, 0.75, 0.7], outline: false });
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * 2.4;
    P(G.cone(0.13, 0.7, 6), thorn, { parent: body, pos: [Math.sin(a) * 0.9, 2.3 + Math.cos(a) * 0.3, -0.55], rot: [-0.7, 0, -a * 0.6] });
    if (i % 2) P(G.sphere(8, 6), '#ffd060', { parent: body, pos: [Math.sin(a) * 0.9, 2.62 + Math.cos(a) * 0.3, -0.85], s: 0.07, outline: false, emissive: '#ff9020', ei: 0.8 });
  }
  const head = new THREE.Group(); head.position.set(0, 2.2, 0.85); body.add(head);
  P(G.sphere(), red, { parent: head, s: [0.6, 0.48, 0.55] });
  P(G.box(0.7, 0.14, 0.3), '#3a1a14', { parent: head, pos: [0, -0.2, 0.35] });
  for (let i = 0; i < 4; i++) P(G.cone(0.05, 0.14, 4), '#fffaf0', { parent: head, pos: [-0.24 + i * 0.16, -0.14, 0.48], rot: [Math.PI, 0, 0], outline: false });
  for (const s of [1, -1]) {
    P(G.cone(0.12, 0.6, 8), '#f4efe0', { parent: head, pos: [s * 0.45, 0.35, -0.05], rot: [-0.3, 0, -s * 0.8] });
    P(G.sphere(10, 8), '#ffd24a', { parent: head, pos: [s * 0.24, 0.12, 0.46], s: [0.1, 0.08, 0.05], emissive: '#ffa020', ei: 1, outline: false });
    P(G.capsule(0.3, 0.6), red, { parent: body, pos: [s * 1.2, 1.4, 0.3], rot: [0.4, 0, s * 0.3] });
    P(G.sphere(), belly, { parent: body, pos: [s * 1.35, 0.95, 0.6], s: 0.34 });
    P(G.capsule(0.32, 0.45), red, { parent: g, pos: [s * 0.55, 0.42, 0] });
  }
  return { obj: g, body, fire: true };
}
function wolf(scale = 1) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const fur = '#4a4f6a', dark = '#2e3248', eye = '#9fe0ff';
  P(G.sphere(), fur, { parent: body, pos: [0, 0.95, 0], s: [0.55, 0.55, 0.95] });
  P(G.sphere(), dark, { parent: body, pos: [0, 1.2, -0.1], s: [0.45, 0.35, 0.75] });
  const head = new THREE.Group(); head.position.set(0, 1.35, 0.95); body.add(head);
  P(G.sphere(), fur, { parent: head, s: [0.38, 0.36, 0.42] });
  P(G.cone(0.2, 0.5, 8), fur, { parent: head, pos: [0, -0.08, 0.45], rot: [Math.PI / 2, 0, 0] });
  P(G.sphere(8, 6), '#1a1a22', { parent: head, pos: [0, -0.04, 0.72], s: 0.07, outline: false });
  for (const s of [1, -1]) {
    P(G.cone(0.12, 0.35, 5), dark, { parent: head, pos: [s * 0.22, 0.38, -0.05], rot: [0, 0, -s * 0.3] });
    P(G.sphere(8, 6), eye, { parent: head, pos: [s * 0.16, 0.08, 0.33], s: [0.07, 0.05, 0.04], emissive: eye, ei: 1, outline: false });
    for (const z of [0.55, -0.55]) P(G.capsule(0.1, 0.5), dark, { parent: g, pos: [s * 0.3, 0.35, z] });
  }
  P(G.cone(0.14, 0.8, 6), dark, { parent: body, pos: [0, 1.3, -1.1], rot: [-2.3, 0, 0] });
  g.scale.setScalar(scale);
  return { obj: g, body };
}
function raptor(scale = 1) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const red = '#c83048', crest = '#ff8a30', beak = '#f0b030';
  P(G.sphere(), red, { parent: body, pos: [0, 1.0, 0], s: [0.5, 0.48, 0.6] });
  P(G.capsule(0.13, 0.5), red, { parent: body, pos: [0, 1.5, 0.35], rot: [0.5, 0, 0] });
  const head = new THREE.Group(); head.position.set(0, 1.95, 0.55); body.add(head);
  P(G.sphere(), red, { parent: head, s: [0.22, 0.2, 0.26] });
  P(G.cone(0.1, 0.35, 6), beak, { parent: head, pos: [0, -0.04, 0.35], rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 3; i++) P(G.cone(0.05, 0.35, 5), crest, { parent: head, pos: [0, 0.2, -0.05 - i * 0.1], rot: [-0.8 - i * 0.2, 0, 0] });
  for (const s of [1, -1]) {
    P(G.sphere(8, 6), '#1a1414', { parent: head, pos: [s * 0.14, 0.05, 0.14], s: 0.045, outline: false });
    P(G.capsule(0.05, 0.6), beak, { parent: g, pos: [s * 0.2, 0.4, 0] });
    P(G.box(0.2, 0.04, 0.24), beak, { parent: g, pos: [s * 0.2, 0.03, 0.08], outline: false });
  }
  for (let i = -1; i <= 1; i++) P(G.cone(0.08, 0.6, 5), i ? crest : red, { parent: body, pos: [i * 0.12, 1.1, -0.65], rot: [-2.0, i * 0.3, 0] });
  g.scale.setScalar(scale);
  return { obj: g, body };
}
function krug(scale = 1) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const rock = '#8a7a6a', rock2 = '#6f655b', lava = '#ff9a30';
  P(G.dodeca(1), rock, { parent: body, pos: [0, 1.0, 0], s: [0.9, 0.8, 0.85] });
  P(G.dodeca(1), rock2, { parent: body, pos: [0, 1.5, -0.3], s: [0.55, 0.45, 0.5], rot: [0.4, 0.3, 0] });
  for (let i = 0; i < 4; i++) glowOcta(body, [Math.cos(i * 1.6) * 0.6, 1.1 + (i % 2) * 0.3, Math.sin(i * 1.6) * 0.5 - 0.2], [0.07, 0.18, 0.07], lava, [i, i * 0.5, 0]);
  for (const s of [1, -1]) {
    P(G.box(0.16, 0.08, 0.05), '#ffd060', { parent: body, pos: [s * 0.25, 1.2, 0.8], rot: [0, 0, s * 0.3], emissive: lava, ei: 1, outline: false });
    P(G.dodeca(1), rock2, { parent: g, pos: [s * 0.45, 0.25, 0.1], s: [0.3, 0.25, 0.35] });
    P(G.dodeca(1), rock, { parent: body, pos: [s * 0.95, 0.8, 0.2], s: 0.3 });
  }
  P(G.box(0.4, 0.1, 0.05), '#2a1a14', { parent: body, pos: [0, 0.95, 0.8], outline: false });
  g.scale.setScalar(scale);
  return { obj: g, body };
}
function crab() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const shell = '#5ab0a0', under = '#e8d0a0';
  P(G.sphere(), under, { parent: body, pos: [0, 0.55, 0], s: [0.9, 0.35, 0.7] });
  P(G.hemi(), shell, { parent: body, mat: toon(shell, { side: THREE.DoubleSide }), pos: [0, 0.6, 0], s: [1.0, 0.6, 0.8] });
  for (let i = 0; i < 5; i++) P(G.sphere(8, 6), '#8ad8c8', { parent: body, pos: [Math.cos(i * 1.26) * 0.5, 1.05, Math.sin(i * 1.26) * 0.35], s: 0.12, outline: false });
  for (const s of [1, -1]) {
    for (let i = 0; i < 3; i++) P(G.cone(0.06, 0.6, 5), under, { parent: g, pos: [s * 0.85, 0.3, -0.3 + i * 0.3], rot: [0, 0, s * 2.3] });
    P(G.capsule(0.05, 0.3), under, { parent: body, pos: [s * 0.25, 1.1, 0.45] });
    P(G.sphere(8, 6), '#1a1414', { parent: body, pos: [s * 0.25, 1.35, 0.45], s: 0.08 });
    P(G.sphere(), shell, { parent: body, pos: [s * 0.95, 0.7, 0.55], s: [0.25, 0.18, 0.3] });
  }
  return { obj: g, body };
}
export function jungleModel(kind) {
  switch (kind) {
    case 'blue': return blueSentinel();
    case 'red': return redBrambleback();
    case 'gromp': { const m = critterModel('frog'); m.obj.scale.setScalar(1.35); return m; }
    case 'wolf': return wolf(1.25);
    case 'wolfS': return wolf(0.75);
    case 'raptor': return raptor(1.2);
    case 'raptorS': return raptor(0.7);
    case 'krug': return krug(1.3);
    case 'krugS': return krug(0.75);
    case 'crab': return crab();
    default: return critterModel(kind);
  }
}
