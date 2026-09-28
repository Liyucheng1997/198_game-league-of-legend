// 技能特效：墨线粒子、地面符文圈、刀光、光柱、漫画拟声字，全部程序生成。
import * as THREE from 'three';
import { P, G, toon, glowMat, canvasTex, rng, INK, clamp, ease, easeOut } from './toon-kit.js';

// ---------- 程序生成的贴图 ----------
function star(g, cx, cy, R, r, n = 5, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + i * Math.PI / n, rr = i % 2 ? r : R;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
}
function inked(g, path, lw = 10) {
  path(); g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
  path(); g.fillStyle = '#fff'; g.fill();
}
function makeAtlas() {
  return canvasTex(1024, 512, (g) => {
    const C = 256;
    const cell = (i, fn) => { g.save(); g.translate((i % 4) * C, Math.floor(i / 4) * C); fn(); g.restore(); };
    cell(0, () => {
      const gr = g.createRadialGradient(128, 128, 0, 128, 128, 124);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, C, C);
    });
    cell(1, () => inked(g, () => star(g, 128, 136, 108, 48), 14));
    cell(2, () => inked(g, () => star(g, 128, 128, 116, 26, 4), 8));
    cell(3, () => {
      const cs = [[128, 150, 70], [80, 130, 50], [176, 132, 52], [118, 92, 56], [160, 170, 44]];
      g.fillStyle = INK; cs.forEach(c => { g.beginPath(); g.arc(c[0], c[1], c[2] + 7, 0, 7); g.fill(); });
      g.fillStyle = '#fff'; cs.forEach(c => { g.beginPath(); g.arc(c[0], c[1], c[2], 0, 7); g.fill(); });
      g.strokeStyle = 'rgba(43,27,20,.35)'; g.lineWidth = 5; g.beginPath(); g.arc(120, 150, 40, 0.2, 1.6); g.stroke();
    });
    cell(4, () => inked(g, () => {
      g.beginPath(); g.moveTo(128, 214);
      g.bezierCurveTo(20, 140, 40, 40, 128, 88); g.bezierCurveTo(216, 40, 236, 140, 128, 214); g.closePath();
    }, 12));
    cell(5, () => {
      inked(g, () => { g.beginPath(); g.moveTo(40, 200); g.quadraticCurveTo(40, 50, 216, 40); g.quadraticCurveTo(210, 210, 40, 200); g.closePath(); }, 10);
      g.strokeStyle = 'rgba(43,27,20,.6)'; g.lineWidth = 6; g.beginPath(); g.moveTo(48, 196); g.quadraticCurveTo(110, 120, 200, 52); g.stroke();
    });
    cell(6, () => inked(g, () => {
      g.beginPath(); g.moveTo(128, 20);
      g.bezierCurveTo(180, 100, 215, 140, 200, 180); g.bezierCurveTo(185, 236, 70, 236, 56, 180);
      g.bezierCurveTo(44, 140, 80, 100, 128, 20); g.closePath();
    }, 12));
    cell(7, () => inked(g, () => {
      g.beginPath(); g.moveTo(70, 60); g.lineTo(200, 90); g.lineTo(180, 200); g.lineTo(60, 180); g.closePath();
    }, 12));
  });
}

function ringTexture() {
  return canvasTex(256, 256, (g) => {
    const r = rng(11);
    g.lineCap = 'round';
    g.strokeStyle = '#fff'; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
    g.strokeStyle = INK;
    for (const R of [104, 120]) {
      g.lineWidth = 3.5; g.beginPath();
      for (let a = 0; a <= 6.3; a += 0.12) { const rr = R + (r() - 0.5) * 2; g.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); }
      g.stroke();
    }
    g.lineWidth = 3;
    for (let a = 0; a < 6.28; a += 0.26) {
      g.beginPath(); g.moveTo(128 + Math.cos(a) * 106, 128 + Math.sin(a) * 106); g.lineTo(128 + Math.cos(a + 0.08) * 118, 128 + Math.sin(a + 0.08) * 118); g.stroke();
    }
  });
}
function discTexture() {
  return canvasTex(256, 256, (g) => {
    const r = rng(5);
    g.save(); g.beginPath(); g.arc(128, 128, 118, 0, 7); g.clip();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 4;
    for (let i = -256; i < 256; i += 18) { g.beginPath(); g.moveTo(i + (r() - 0.5) * 4, 0); g.lineTo(i + 256 + (r() - 0.5) * 4, 256); g.stroke(); }
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath();
    for (let a = 0; a <= 6.3; a += 0.1) { const rr = 118 + (r() - 0.5) * 3; g.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); }
    g.stroke();
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
  });
}
function slashTexture() {
  return canvasTex(256, 256, (g) => {
    // 月牙刀光：沿圆弧渐变
    for (let i = 0; i < 60; i++) {
      const a0 = -Math.PI * 0.5 + i * 0.05, k = i / 60;
      g.strokeStyle = `rgba(43,27,20,${0.9 * k})`; g.lineWidth = 6 + 34 * Math.sin(k * Math.PI) + 8;
      g.beginPath(); g.arc(128, 128, 100, a0, a0 + 0.06); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${k})`; g.lineWidth = 4 + 30 * Math.sin(k * Math.PI);
      g.beginPath(); g.arc(128, 128, 100, a0, a0 + 0.06); g.stroke();
    }
  });
}
// 回城法阵：同心圆、六芒星、符文刻痕
function runeTexture() {
  return canvasTex(512, 512, (g) => {
    const c = 256, r = rng(21);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const ringLine = (R, w) => { for (const [lw, col] of [[w + 5, INK], [w, '#ffffff']]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (let a = 0; a <= 6.3; a += 0.05) { const rr = R + (r() - 0.5) * 2; g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); } g.stroke(); } };
    const gr = g.createRadialGradient(c, c, 40, c, c, 240); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,.05)');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, 240, 0, 7); g.fill();
    ringLine(236, 6); ringLine(200, 4); ringLine(96, 4);
    // 六芒星
    for (const off of [0, Math.PI / 3]) {
      const pts = [0, 1, 2].map(i => [c + Math.cos(off + i * 2.094 - Math.PI / 2) * 196, c + Math.sin(off + i * 2.094 - Math.PI / 2) * 196]);
      for (const [lw, col] of [[8, INK], [3.5, '#ffffff']]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke(); }
    }
    // 两圈之间的符文刻痕
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2, x = c + Math.cos(a) * 218, y = c + Math.sin(a) * 218;
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
      for (const [lw, col] of [[6, INK], [2.5, '#ffffff']]) {
        g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
        const k = i % 4;
        if (k === 0) { g.moveTo(-7, -7); g.lineTo(0, 7); g.lineTo(7, -7); }
        else if (k === 1) { g.moveTo(0, -8); g.lineTo(0, 8); g.moveTo(-6, 0); g.lineTo(6, 0); }
        else if (k === 2) { g.arc(0, 0, 6, 0, 7); }
        else { g.moveTo(-7, 6); g.lineTo(0, -8); g.lineTo(7, 6); g.closePath(); }
        g.stroke();
      }
      g.restore();
    }
  });
}
function beamTexture() {
  return canvasTex(64, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 64, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, 'rgba(255,255,255,.9)');
    gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  }, { repeat: true });
}

const PVS = `
attribute float size; attribute float alpha; attribute float cell; attribute float rot; attribute vec3 pcolor;
varying vec3 vC; varying float vA; varying float vCell; varying float vRot;
uniform float uScale;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uScale / -mv.z;
  vC = pcolor; vA = alpha; vCell = cell; vRot = rot;
}`;
const PFS = `
uniform sampler2D uTex;
varying vec3 vC; varying float vA; varying float vCell; varying float vRot;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float s = sin(vRot), co = cos(vRot);
  c = mat2(co, -s, s, co) * c + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0) discard;
  float col = mod(vCell, 4.0), row = floor(vCell / 4.0);
  vec4 t = texture2D(uTex, vec2((col + c.x) / 4.0, 1.0 - (row + c.y) / 2.0));
  gl_FragColor = vec4(t.rgb * vC, t.a * vA);
  if (gl_FragColor.a < 0.02) discard;
}`;

class Particles {
  constructor(scene, tex, additive, max = 4000) {
    this.max = max; this.n = 0;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.cell = new Float32Array(max); this.rot = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('cell', new THREE.BufferAttribute(this.cell, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: tex }, uScale: { value: 500 } },
      vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 19;
    scene.add(this.points);
    this.list = [];
  }
  spawn(o) {
    if (this.list.length >= this.max) this.list.shift();
    const c = new THREE.Color(o.color || '#ffffff').convertLinearToSRGB();
    this.list.push({
      x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      r: c.r, g: c.g, b: c.b, size: o.size || 1, grow: o.grow ?? 0, life: o.life || 0.6, t: 0,
      cell: o.cell ?? 0, rot: o.rot ?? Math.random() * 6.28, spin: o.spin ?? 0,
      grav: o.grav ?? 0, drag: o.drag ?? 1.5, a0: o.alpha ?? 1, fadeIn: o.fadeIn || 0,
    });
  }
  update(dt) {
    const L = this.list;
    let j = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.life) continue;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d; p.vy = p.vy * d - p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.spin * dt;
      L[j++] = p;
    }
    L.length = j;
    for (let i = 0; i < j; i++) {
      const p = L[i], k = p.t / p.life;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.col[i * 3] = p.r; this.col[i * 3 + 1] = p.g; this.col[i * 3 + 2] = p.b;
      this.size[i] = p.size * (1 + p.grow * k) * (k < 0.15 ? 0.5 + k / 0.3 : 1);
      const fi = p.fadeIn ? Math.min(1, p.t / p.fadeIn) : 1;
      this.alpha[i] = p.a0 * fi * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
      this.cell[i] = p.cell; this.rot[i] = p.rot;
    }
    this.geo.setDrawRange(0, j);
    for (const k of ['position', 'pcolor', 'size', 'alpha', 'cell', 'rot']) this.geo.attributes[k].needsUpdate = true;
  }
}

const CELL = { glow: 0, star: 1, spark: 2, puff: 3, heart: 4, leaf: 5, flame: 6, shard: 7 };

export class VFX {
  constructor(scene) {
    this.scene = scene;
    const atlas = makeAtlas();
    atlas.colorSpace = THREE.NoColorSpace;
    this.ink = new Particles(scene, atlas, false, 3000);
    this.glow = new Particles(scene, atlas, true, 3000);
    this.tex = { ring: ringTexture(), disc: discTexture(), slash: slashTexture(), beam: beamTexture(), rune: runeTexture() };
    this.effects = [];
    this.shakeAmt = 0;
    this.comicCache = new Map();
  }
  setScale(s) { this.ink.mat.uniforms.uScale.value = s; this.glow.mat.uniforms.uScale.value = s; }

  update(dt) {
    this.ink.update(dt); this.glow.update(dt);
    const E = this.effects;
    let j = 0;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      e.t += dt;
      const k = Math.min(1, e.t / e.dur);
      if (e.follow && e.obj) e.obj.position.copy(e.follow.pos || e.follow);
      e.upd && e.upd(k, dt, e);
      if (e.t >= e.dur || e.kill) { this.remove(e); continue; }
      E[j++] = e;
    }
    E.length = j;
    this.shakeAmt *= Math.exp(-dt * 7);
  }
  remove(e) {
    if (e.obj) {
      e.obj.parent && e.obj.parent.remove(e.obj);
      e.obj.traverse(o => { if (o.material && o.material.userData.fx) o.material.dispose(); });
    }
    e.onEnd && e.onEnd();
  }
  add(obj, dur, upd, o = {}) {
    if (obj && !obj.parent) this.scene.add(obj);
    const e = { obj, dur, upd, t: 0, ...o };
    this.effects.push(e);
    return e;
  }
  shake(a) {
    this.shakeAmt = Math.min(1.2, this.shakeAmt + a);
    if (this.sfx) this.sfx(a >= 0.45 ? 'boom' : a >= 0.2 ? 'hitHeavy' : 'hit', this.lastPos, Math.min(1, 0.5 + a));
  }

  // ---------- 粒子 ----------
  puff(pos, o = {}) {
    const n = o.n ?? 10, sys = o.glow ? this.glow : this.ink;
    const cell = typeof o.cell === 'string' ? CELL[o.cell] : (o.cell ?? (o.glow ? 0 : 3));
    const cols = Array.isArray(o.color) ? o.color : [o.color || '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.8);
      const up = o.up ?? 1;
      const rr = (o.spread ?? 0.2) * Math.random();
      sys.spawn({
        x: pos.x + Math.cos(a) * rr, y: (pos.y ?? 0) + (o.y ?? 0.8) + (Math.random() - 0.5) * (o.yJit ?? 0.3), z: pos.z + Math.sin(a) * rr,
        vx: Math.cos(a) * sp + (o.vx || 0), vy: up * (0.5 + Math.random()) * (o.upSpeed ?? 2.5), vz: Math.sin(a) * sp + (o.vz || 0),
        color: cols[i % cols.length], size: (o.size ?? 0.8) * (0.6 + Math.random() * 0.8), life: (o.life ?? 0.6) * (0.7 + Math.random() * 0.6),
        cell, spin: (Math.random() - 0.5) * (o.spin ?? 4), grav: o.grav ?? 0, drag: o.drag ?? 2.5, grow: o.grow ?? 0.3,
        alpha: o.alpha ?? 1,
      });
    }
  }
  spark(pos, color, n = 8, size = 0.6) {
    this.puff(pos, { n, color, glow: true, cell: 'spark', size, speed: 5, life: 0.4, up: 1, y: pos.y ?? 1 });
  }
  trail(pos, o = {}) {
    const sys = o.glow ? this.glow : this.ink;
    sys.spawn({
      x: pos.x + (Math.random() - 0.5) * (o.jit ?? 0.2), y: pos.y + (Math.random() - 0.5) * (o.jit ?? 0.2), z: pos.z + (Math.random() - 0.5) * (o.jit ?? 0.2),
      vy: o.vy ?? 0.4, color: o.color || '#fff', size: o.size ?? 0.5, life: o.life ?? 0.35,
      cell: typeof o.cell === 'string' ? CELL[o.cell] : (o.cell ?? (o.glow ? 0 : 3)), grow: o.grow ?? -0.6, spin: 2, alpha: o.alpha ?? 1,
    });
  }

  // ---------- 地面圈 ----------
  ground(pos, tex, o = {}) {
    const mat = new THREE.MeshBasicMaterial({ map: this.tex[tex], color: o.color || '#fff', transparent: true, depthWrite: false, opacity: o.opacity ?? 1, blending: o.glow ? THREE.AdditiveBlending : THREE.NormalBlending });
    mat.userData.fx = true;
    const m = new THREE.Mesh(G.plane(2, 2), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, (o.y ?? 0.06), pos.z);
    m.renderOrder = 5;
    return m;
  }
  ring(pos, o = {}) {
    const m = this.ground(pos, 'ring', o);
    const r0 = o.r0 ?? 0.3, r1 = o.r1 ?? 3, op = o.opacity ?? 1;
    return this.add(m, o.dur ?? 0.5, (k) => {
      const s = r0 + (r1 - r0) * easeOut(k);
      m.scale.set(s, s, 1);
      m.material.opacity = op * (1 - k * k);
    }, { follow: o.follow });
  }
  disc(pos, o = {}) {
    const m = this.ground(pos, 'disc', o);
    const r = o.r ?? 2, op = o.opacity ?? 0.8;
    m.scale.set(r, r, 1);
    return this.add(m, o.dur ?? 1, (k, dt, e) => {
      const fin = Math.min(1, e.t / 0.12), fout = o.hold ? 1 : 1 - clamp((k - 0.7) / 0.3);
      m.material.opacity = op * fin * fout;
      if (o.spin) m.rotation.z += dt * o.spin;
      if (o.pulse) { const s = r * (1 + Math.sin(e.t * 8) * 0.04); m.scale.set(s, s, 1); }
    }, { follow: o.follow });
  }
  // 刀光（水平月牙）
  slash(pos, facing, o = {}) {
    const mat = new THREE.MeshBasicMaterial({ map: this.tex.slash, color: o.color || '#fff', transparent: true, depthWrite: false, side: THREE.DoubleSide });
    mat.userData.fx = true;
    const m = new THREE.Mesh(G.plane(2, 2), mat);
    const g = new THREE.Group(); g.add(m);
    m.rotation.x = -Math.PI / 2;
    g.position.set(pos.x, o.y ?? 1.1, pos.z);
    g.rotation.order = 'YXZ';
    g.rotation.y = facing + (o.flip ? Math.PI : 0);
    g.rotation.z = o.tilt ?? 0;
    const r = o.r ?? 2.2;
    g.scale.set(o.flip ? -r : r, r, r);
    const spin = o.spin ?? 2.5;
    return this.add(g, o.dur ?? 0.3, (k) => {
      m.rotation.z = -1.2 + k * spin;
      mat.opacity = 1 - k * k;
      const s = r * (0.8 + 0.3 * easeOut(k));
      g.scale.set(o.flip ? -s : s, s, s);
    });
  }
  // 光柱
  pillar(pos, o = {}) {
    const mat = glowMat(o.color || '#fff6c0', 0.9); mat.userData.fx = true;
    const m = new THREE.Mesh(G.cyl(1, 1, 1, 20), mat);
    const h = o.h ?? 12, r = o.r ?? 1;
    m.position.set(pos.x, h / 2, pos.z);
    return this.add(m, o.dur ?? 0.7, (k) => {
      const w = r * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8 * 0.9);
      m.scale.set(w, h, w);
      mat.opacity = 0.9 * (1 - k);
    });
  }
  // 光束（两点之间的圆柱）
  beam(a, b, o = {}) {
    const mat = new THREE.MeshBasicMaterial({ map: this.tex.beam, color: o.color || '#fff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    mat.userData.fx = true;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const grp = new THREE.Group();
    // 两片十字交叉的面片沿 +z 延伸，从任意角度都能看到光束
    const m1 = new THREE.Mesh(G.plane(1, 1), mat);
    const m2 = new THREE.Mesh(G.plane(1, 1), mat);
    m1.rotation.set(-Math.PI / 2, 0, 0);
    m2.rotation.set(0, Math.PI / 2, Math.PI / 2);
    grp.add(m1, m2);
    grp.position.set((a.x + b.x) / 2, o.y ?? 1.2, (a.z + b.z) / 2);
    grp.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    const w = o.width ?? 1;
    const core = new THREE.Mesh(G.cyl(1, 1, 1, 12), glowMat('#ffffff', 0.9)); core.material.userData.fx = true;
    core.rotation.x = Math.PI / 2; grp.add(core);
    return this.add(grp, o.dur ?? 0.6, (k) => {
      const ww = w * (k < 0.15 ? k / 0.15 : 1 - ease((k - 0.15) / 0.85));
      m1.scale.set(ww * 2.2, len, 1); m2.scale.set(ww * 2.2, len, 1);
      m1.position.set(0, 0, 0); m2.position.set(0, 0, 0);
      core.scale.set(ww * 0.35, len, ww * 0.35);
      mat.opacity = 1 - k * 0.5;
      m1.material.map.offset.y -= 0.05;
    });
  }
  // 半透明气泡 / 冲击球
  bubble(pos, o = {}) {
    const mat = toon(o.color || '#ffe27a', { opacity: o.opacity ?? 0.35, fresh: true, emissive: o.color || '#ffe27a', ei: 0.4 });
    mat.userData.fx = true; mat.depthWrite = false;
    const m = new THREE.Mesh(G.sphere(24, 16), mat);
    m.position.set(pos.x, o.y ?? 1.2, pos.z);
    const r0 = o.r0 ?? o.r ?? 1.3, r1 = o.r1 ?? r0;
    return this.add(m, o.dur ?? 1, (k, dt, e) => {
      const s = r0 + (r1 - r0) * easeOut(k);
      m.scale.setScalar(s * (1 + Math.sin(e.t * 9) * 0.03));
      mat.opacity = (o.opacity ?? 0.35) * (o.fade === false ? 1 : 1 - k * k);
    }, { follow: o.follow });
  }
  // 漫画拟声字
  comic(pos, text, o = {}) {
    this.lastPos = pos;
    if (this.sfx) this.sfx('pop', pos, 0.6);
    const key = text + (o.color || '');
    let tex = this.comicCache.get(key);
    if (!tex) {
      tex = canvasTex(256, 160, (g) => {
        g.translate(128, 80);
        g.fillStyle = o.bg || '#ffffff';
        star(g, 0, 0, 78, 52, 11, 0.2); g.fill(); g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
        g.font = `900 ${text.length > 2 ? 46 : 58}px "KaiTi","STKaiti","Microsoft YaHei",sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 12; g.strokeStyle = INK; g.lineJoin = 'round'; g.rotate(-0.12);
        g.strokeText(text, 0, 4); g.fillStyle = o.color || '#ffd23c'; g.fillText(text, 0, 4);
      });
      this.comicCache.set(key, tex);
    }
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    mat.userData.fx = true;
    const s = new THREE.Sprite(mat);
    s.renderOrder = 50;
    s.position.set(pos.x + (Math.random() - 0.5), (pos.y ?? 0) + (o.y ?? 3.2), pos.z);
    const sz = o.size ?? 2.4;
    return this.add(s, o.dur ?? 0.8, (k) => {
      const pop = k < 0.15 ? easeOut(k / 0.15) * 1.25 : 1.25 - 0.25 * clamp((k - 0.15) / 0.2);
      s.scale.set(sz * 1.6 * pop, sz * pop, 1);
      s.position.y += 0.01;
      mat.opacity = 1 - clamp((k - 0.7) / 0.3);
    });
  }
  // 回城：法阵、光柱、环绕光点，返回可取消的特效列表
  recall(unit, dur, color = '#9fd8ff') {
    const out = [];
    const runeMat = new THREE.MeshBasicMaterial({ map: this.tex.rune, color, transparent: true, depthWrite: false, opacity: 0 });
    runeMat.userData.fx = true;
    const rune = new THREE.Mesh(G.plane(2, 2), runeMat);
    rune.rotation.x = -Math.PI / 2; rune.renderOrder = 6;
    out.push(this.add(rune, dur, (k, dt, e) => {
      rune.position.set(unit.pos.x, 0.09, unit.pos.z);
      const s = 2.6 * Math.min(1, e.t / 0.35) * (1 + Math.sin(e.t * 5) * 0.02);
      rune.scale.set(s, s, 1);
      rune.rotation.z += dt * (0.6 + k * 2.5);
      runeMat.opacity = 0.5 + 0.5 * k;
    }));
    // 逐渐升高的光柱（外层彩色 + 内层白芯）
    const colMat = glowMat(color, 0), coreMat = glowMat('#ffffff', 0);
    colMat.userData.fx = coreMat.userData.fx = true;
    const colMesh = new THREE.Mesh(G.cyl(1, 1, 1, 24), colMat), core = new THREE.Mesh(G.cyl(1, 1, 1, 16), coreMat);
    const grp = new THREE.Group(); grp.add(colMesh, core);
    out.push(this.add(grp, dur, (k, dt, e) => {
      grp.position.set(unit.pos.x, 0, unit.pos.z);
      const h = 1 + 11 * k * k, w = 1.25 + Math.sin(e.t * 9) * 0.06;
      colMesh.scale.set(w, h, w); colMesh.position.y = h / 2;
      core.scale.set(0.35 + 0.25 * k, h, 0.35 + 0.25 * k); core.position.y = h / 2;
      colMat.opacity = 0.18 + 0.35 * k; coreMat.opacity = 0.1 + 0.5 * k;
      // 环绕上升的光点和星星
      for (let i = 0; i < 3; i++) {
        const a = e.t * 4 + i * 2.094, rr = 1.6 - k * 0.6;
        this.trail({ x: unit.pos.x + Math.cos(a) * rr, y: 0.3 + ((e.t * 1.6 + i * 0.7) % 3), z: unit.pos.z + Math.sin(a) * rr }, { color, glow: true, cell: 'glow', size: 0.7, vy: 1.5, life: 0.5, grow: -0.5 });
      }
      if (Math.random() < dt * (6 + 20 * k)) this.trail({ x: unit.pos.x + (Math.random() - 0.5) * 2.4, y: 0.2, z: unit.pos.z + (Math.random() - 0.5) * 2.4 }, { color: '#ffffff', cell: 'star', size: 0.35, vy: 3 + 3 * k, life: 0.8, grow: -0.3 });
      // 每秒扩散一圈光环
      e.pulse = (e.pulse || 0) - dt;
      if (e.pulse <= 0) { e.pulse = 1 - k * 0.6; this.ring(unit.pos, { r0: 0.5, r1: 3.4, color, dur: 0.7, glow: true }); }
    }));
    return out;
  }
  recallBurst(pos, color = '#9fd8ff') {
    this.pillar(pos, { color, r: 2.2, h: 16, dur: 0.8 });
    this.pillar(pos, { color: '#ffffff', r: 0.9, h: 18, dur: 0.6 });
    this.ring(pos, { r0: 0.5, r1: 6, color, dur: 0.6, glow: true });
    this.ring(pos, { r0: 0.3, r1: 4, color: '#ffffff', dur: 0.45 });
    this.puff(pos, { n: 24, color: [color, '#ffffff'], cell: 'spark', glow: true, size: 1, speed: 6, up: 2.5, y: 1 });
    this.puff(pos, { n: 12, color: '#ffffff', cell: 'star', size: 0.5, speed: 4, up: 2, y: 1 });
  }
  // 挂在单位身上的持续光环
  aura(unit, o = {}) {
    const m = this.ground(unit.pos, o.tex || 'ring', { color: o.color, glow: o.glow, opacity: o.opacity ?? 0.9 });
    const r = o.r ?? 1.4;
    m.scale.set(r, r, 1);
    return this.add(m, o.dur ?? 3, (k, dt, e) => {
      m.position.set(unit.pos.x, 0.07, unit.pos.z);
      m.rotation.z += dt * (o.spin ?? 2);
      if (o.particles && Math.random() < dt * o.particles) {
        this.trail({ x: unit.pos.x + (Math.random() - 0.5) * r * 1.5, y: 0.3 + Math.random(), z: unit.pos.z + (Math.random() - 0.5) * r * 1.5 },
          { color: o.pcolor || o.color, glow: o.pglow ?? true, cell: o.pcell || 'spark', size: 0.5, vy: 1.5, life: 0.6, grow: -0.5 });
      }
      m.material.opacity = (o.opacity ?? 0.9) * (1 - clamp((k - 0.85) / 0.15));
      if (unit.dead) e.kill = true;
    });
  }
}

// ---------- 弹道模型 ----------
export function projMesh(kind, color = '#ffffff') {
  const g = new THREE.Group();
  const add = (m) => { g.add(m); return m; };
  switch (kind) {
    case 'arrow': {
      const shaft = add(P(G.cyl(0.03, 0.03, 1.1, 6), '#8a5a3c', { rot: [Math.PI / 2, 0, 0], ol: 0.015 }));
      add(P(G.cone(0.09, 0.25, 6), color, { pos: [0, 0, 0.62], rot: [Math.PI / 2, 0, 0], emissive: color, ei: 0.5, ol: 0.015 }));
      add(P(G.box(0.18, 0.02, 0.2), '#ffffff', { pos: [0, 0, -0.5], ol: 0.012 }));
      return g;
    }
    case 'bigArrow': {
      add(P(G.cyl(0.12, 0.12, 3.2, 6), '#bfe9ff', { rot: [Math.PI / 2, 0, 0], emissive: '#5fb6ff', ei: 0.6 }));
      add(P(G.cone(0.45, 1.1, 6), '#e6f7ff', { pos: [0, 0, 2.0], rot: [Math.PI / 2, 0, 0], emissive: '#7fd0ff', ei: 0.8 }));
      for (const s of [1, -1]) add(P(G.octa(0.4), '#9fdcff', { pos: [s * 0.3, 0, -1.4], s: [0.5, 0.2, 1.6], emissive: '#5fb6ff', ei: 0.6 }));
      const halo = new THREE.Mesh(G.sphere(12, 8), glowMat('#7fd0ff', 0.5)); halo.scale.set(1.1, 1.1, 2.8); add(halo);
      return g;
    }
    case 'bullet': {
      add(P(G.capsule(0.09, 0.3, 6), '#ffd76a', { rot: [Math.PI / 2, 0, 0], emissive: '#ffb030', ei: 0.7, ol: 0.015 }));
      const h = new THREE.Mesh(G.sphere(10, 8), glowMat(color, 0.6)); h.scale.set(0.3, 0.3, 0.8); add(h);
      return g;
    }
    case 'orb': {
      add(P(G.sphere(16, 12), color, { s: 0.3, emissive: color, ei: 0.8, ol: 0.02 }));
      const h = new THREE.Mesh(G.sphere(12, 8), glowMat(color, 0.45)); h.scale.setScalar(0.6); add(h);
      return g;
    }
    case 'bigOrb': {
      add(P(G.sphere(20, 14), color, { s: 0.55, emissive: color, ei: 0.9, ol: 0.03 }));
      add(P(G.sphere(12, 8), '#ffffff', { s: 0.2, pos: [0.15, 0.2, 0.2], outline: false, emissive: '#ffffff' }));
      const h = new THREE.Mesh(G.sphere(12, 8), glowMat(color, 0.4)); h.scale.setScalar(1.0); add(h);
      return g;
    }
    case 'fire': {
      add(P(G.sphere(14, 10), '#ffcf4a', { s: [0.42, 0.42, 0.55], emissive: '#ff9a20', ei: 0.9, ol: 0.025 }));
      add(P(G.cone(0.32, 0.8, 8), '#ff6a2a', { pos: [0, 0, -0.45], rot: [-Math.PI / 2, 0, 0], emissive: '#ff4a10', ei: 0.7 }));
      const h = new THREE.Mesh(G.sphere(12, 8), glowMat('#ff8a30', 0.5)); h.scale.setScalar(0.9); add(h);
      return g;
    }
    case 'rock': {
      add(P(G.dodeca(0.5), '#8a7b6a', { s: [1, 0.8, 1.2] }));
      add(P(G.octa(0.3), '#f0a040', { pos: [0.2, 0.3, 0], emissive: '#ff9a20', ei: 0.6 }));
      return g;
    }
    case 'heart': {
      const heart = new THREE.Group();
      for (const s of [1, -1]) heart.add(P(G.sphere(14, 10), '#ff6fa8', { pos: [s * 0.16, 0.08, 0], s: 0.22, emissive: '#ff3f8a', ei: 0.6 }));
      heart.add(P(G.cone(0.3, 0.4, 12), '#ff6fa8', { pos: [0, -0.18, 0], rot: [Math.PI, 0, 0], emissive: '#ff3f8a', ei: 0.6 }));
      add(heart);
      const h = new THREE.Mesh(G.sphere(12, 8), glowMat('#ff8ac0', 0.4)); h.scale.setScalar(0.7); add(h);
      return g;
    }
    case 'net': {
      const n = add(P(G.torus(0.6, 0.05, Math.PI * 2, 6, 18), '#d8c9a0', { rot: [Math.PI / 2, 0, 0] }));
      for (let i = 0; i < 4; i++) add(P(G.box(1.2, 0.04, 0.04), '#d8c9a0', { rot: [0, i * Math.PI / 4, 0], outline: false }));
      for (let i = 0; i < 6; i++) add(P(G.sphere(8, 6), '#6a5a4a', { pos: [Math.cos(i) * 0.6, 0, Math.sin(i) * 0.6], s: 0.08 }));
      return g;
    }
    case 'star': {
      add(P(G.octa(0.5), '#ffe36a', { s: [1, 1, 0.5], emissive: '#ffcf30', ei: 0.9 }));
      add(P(G.octa(0.4), '#fff4b0', { rot: [0, 0, Math.PI / 4], s: [1, 1, 0.5], emissive: '#ffcf30', ei: 0.9 }));
      const h = new THREE.Mesh(G.sphere(12, 8), glowMat('#ffe36a', 0.5)); h.scale.setScalar(1.1); add(h);
      return g;
    }
    case 'wand': {
      add(P(G.cyl(0.05, 0.05, 1.2, 8), '#f4f1ea', { rot: [Math.PI / 2, 0, 0] }));
      add(P(G.octa(0.22), '#fff38a', { pos: [0, 0, 0.7], emissive: '#ffe040', ei: 0.9 }));
      return g;
    }
    case 'shard': {
      add(P(G.octa(0.3), color, { s: [0.6, 0.6, 1.4], emissive: color, ei: 0.6 }));
      return g;
    }
    default:
      add(P(G.sphere(12, 8), color, { s: 0.3, emissive: color, ei: 0.7 }));
      return g;
  }
}
