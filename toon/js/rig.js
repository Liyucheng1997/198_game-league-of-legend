// Q 版角色骨架：由若干层级 Group 组成，动作全部用程序化姿态函数驱动。
import * as THREE from 'three';
import { P, G, toon, onSphere, clamp, lerp, ease } from './toon-kit.js';

const DEF = {
  headR: 0.58, bodyW: 0.42, bodyH: 0.78, legLen: 0.5, hipW: 0.19,
  armLen: 0.34, foreLen: 0.3, armR: 0.12, legR: 0.15, scale: 1,
};

const POSE_KEYS = ['bodyY', 'bodyRX', 'bodyRY', 'bodyRZ', 'torsoRX', 'torsoRY', 'torsoRZ', 'headRX', 'headRY', 'headRZ',
  'aLX', 'aLY', 'aLZ', 'fLX', 'aRX', 'aRY', 'aRZ', 'fRX', 'lLX', 'lRX', 'lLZ', 'lRZ', 'sq'];
export function newPose() { const p = {}; for (const k of POSE_KEYS) p[k] = 0; return p; }
function mixPose(a, b, w) { for (const k of POSE_KEYS) a[k] += (b[k] - a[k]) * w; }

const seg = (k, a, b) => clamp((k - a) / (b - a));

// ---------- 动作库（k ∈ [0,1]）----------
export const ANIMS = {
  slash(k, p) { // 右手过顶劈砍
    const w = ease(seg(k, 0, 0.42)), h = ease(seg(k, 0.42, 0.62));
    p.aRX = -2.9 * w + 2.5 * h; p.fRX = -0.35; p.aRZ = -0.2;
    p.torsoRY = 0.4 * w - 0.8 * h; p.bodyRX = 0.28 * h; p.aLX = -0.4 * w + 0.4 * h; p.aLZ = 0.35;
    p.sq = -0.05 * w + 0.1 * h * (1 - seg(k, 0.62, 1));
  },
  swipe(k, p) { // 横扫
    const w = ease(seg(k, 0, 0.4)), h = ease(seg(k, 0.4, 0.6));
    p.aRX = -1.5; p.aRZ = -1.3 * w + 1.0 * h; p.fRX = -0.2;
    p.torsoRY = 0.9 * w - 1.7 * h; p.aLZ = 0.5; p.aLX = -0.3; p.bodyRX = 0.12;
  },
  // 水平横斩：手臂前伸、手腕翻转让剑身放平，靠转腰从右扫到左
  hslash(k, p) {
    const w = ease(seg(k, 0, 0.32)), h = ease(seg(k, 0.32, 0.55)), back = seg(k, 0.7, 1);
    p.aRX = -1.35 - 0.15 * h; p.aRY = -1.35; p.aRZ = -0.9 * w + 1.3 * h; p.fRX = -0.35 + 0.3 * h;
    p.torsoRY = -1.0 * w + 2.0 * h; p.bodyRY = -0.35 * w + 0.75 * h * (1 - back); p.bodyRX = 0.1 + 0.2 * h;
    p.bodyY = 0.08 * h * (1 - back); p.sq = -0.05 * w + 0.08 * h * (1 - back);
    p.aLX = -0.5; p.aLZ = 0.7 * (1 - h) + 0.2; p.lLX = -0.55 * h; p.lRX = 0.4 * h;
  },
  // 反手横斩：从左扫到右
  hslashBack(k, p) {
    const w = ease(seg(k, 0, 0.32)), h = ease(seg(k, 0.32, 0.55)), back = seg(k, 0.7, 1);
    p.aRX = -1.35 - 0.15 * h; p.aRY = 1.35; p.aRZ = 0.45 * w - 1.5 * h; p.fRX = -0.5 + 0.4 * h;
    p.torsoRY = 1.0 * w - 2.0 * h; p.bodyRY = 0.35 * w - 0.75 * h * (1 - back); p.bodyRX = 0.1 + 0.2 * h;
    p.bodyY = 0.08 * h * (1 - back); p.sq = -0.05 * w + 0.08 * h * (1 - back);
    p.aLX = -0.5; p.aLZ = 0.5; p.lLX = 0.4 * h; p.lRX = -0.55 * h;
  },
  thrust(k, p) {
    const w = ease(seg(k, 0, 0.35)), h = ease(seg(k, 0.35, 0.5));
    p.aRX = -1.2 * w - 0.4 * h; p.fRX = -1.4 * w + 1.4 * h; p.torsoRY = 0.4 * w - 0.6 * h;
    p.bodyRX = 0.3 * h; p.lLX = -0.5 * h; p.lRX = 0.4 * h; p.aLZ = 0.6;
  },
  throw(k, p) { // 单手施法
    const w = ease(seg(k, 0, 0.38)), h = ease(seg(k, 0.38, 0.55));
    p.aRX = -2.5 * w + 1.0 * h; p.fRX = -0.8 * w + 0.7 * h; p.torsoRY = 0.45 * w - 0.8 * h;
    p.aLX = -0.8 * h; p.aLZ = 0.5; p.bodyRX = 0.18 * h; p.headRX = 0.1 * h;
  },
  cast2(k, p) { // 双手向前
    const w = ease(seg(k, 0, 0.35)), h = ease(seg(k, 0.35, 0.5));
    p.aLX = p.aRX = -0.6 * w - 1.0 * h; p.aLZ = 0.6 * w - 0.35 * h; p.aRZ = -0.6 * w + 0.35 * h;
    p.fLX = p.fRX = -0.6 * (1 - h); p.bodyRX = -0.1 * w + 0.25 * h; p.sq = 0.06 * h;
  },
  raise(k, p) { // 双手高举
    const w = ease(seg(k, 0, 0.45));
    p.aLX = p.aRX = -2.8 * w; p.aLZ = 0.35 * w; p.aRZ = -0.35 * w; p.headRX = -0.35 * w;
    p.bodyY = 0.12 * w; p.sq = -0.08 * w;
  },
  spin(k, p) {
    p.aLZ = 1.45; p.aRZ = -1.45; p.aRX = -0.2; p.aLX = -0.2; p.fRX = -0.1;
    p.bodyRY = k * Math.PI * 2 * 5; p.bodyRX = 0.1; p.bodyY = Math.abs(Math.sin(k * 30)) * 0.04;
  },
  whirl(k, p) { // 蓄力后单圈横扫
    const w = ease(seg(k, 0, 0.6)), h = ease(seg(k, 0.6, 0.9));
    p.aRX = -1.4; p.aLX = -1.4; p.aRZ = -0.3; p.aLZ = 0.3; p.fRX = p.fLX = -0.3;
    p.torsoRY = 0.9 * w; p.bodyRY = -h * Math.PI * 2; p.sq = -0.06 * w + 0.08 * h; p.bodyRX = 0.15 * h;
  },
  bow(k, p) {
    const w = ease(seg(k, 0, 0.4)), h = seg(k, 0.4, 0.5);
    p.aLX = -1.55; p.aLZ = -0.15; p.fLX = 0;
    p.aRX = -1.45; p.aRZ = 0.25; p.fRX = -2.2 * w * (1 - h) - 0.3; p.torsoRY = 0.55; p.headRY = -0.45;
    p.bodyRX = -0.05 * h;
  },
  shoot(k, p) {
    const h = seg(k, 0.45, 0.55), r = seg(k, 0.55, 0.9);
    p.aRX = -1.5; p.fRX = -0.2; p.aRZ = 0.1; p.aLX = -1.35; p.aLZ = -0.5; p.fLX = -0.4;
    p.torsoRY = 0.35; p.headRY = -0.3; p.bodyRX = -0.18 * h * (1 - r); p.aRX += 0.35 * h * (1 - r);
  },
  slam(k, p) {
    const w = ease(seg(k, 0, 0.45)), h = ease(seg(k, 0.45, 0.58));
    p.aLX = p.aRX = -2.9 * w + 2.4 * h; p.aLZ = 0.3; p.aRZ = -0.3;
    p.bodyY = 0.35 * w * (1 - h); p.bodyRX = 0.4 * h; p.sq = -0.1 * w + 0.22 * h * (1 - seg(k, 0.58, 1));
  },
  leap(k, p) {
    p.aLX = p.aRX = -2.6; p.aLZ = 0.4; p.aRZ = -0.4; p.lLX = -0.8; p.lRX = 0.5; p.bodyRX = 0.3; p.sq = -0.08;
  },
  channel(k, p) {
    const w = ease(seg(k, 0, 0.2));
    p.aLX = p.aRX = -0.9 * w; p.aLZ = 0.7 * w; p.aRZ = -0.7 * w; p.fLX = p.fRX = -0.9 * w;
    p.headRX = 0.2 * w; p.bodyY = (0.25 + Math.sin(k * 20) * 0.04) * w; p.lLX = -0.9 * w; p.lRX = -0.9 * w;
  },
  flex(k, p) { // 振臂增益
    const w = ease(seg(k, 0, 0.35));
    p.aLZ = 1.3 * w; p.aRZ = -1.3 * w; p.fLX = p.fRX = -2.2 * w; p.aLX = p.aRX = -0.3 * w;
    p.headRX = -0.25 * w; p.sq = 0.1 * w * (1 - seg(k, 0.35, 1)); p.bodyY = 0.05 * w;
  },
  punch(k, p) {
    const w = ease(seg(k, 0, 0.35)), h = ease(seg(k, 0.35, 0.5));
    p.aRX = -0.6 * w - 1.0 * h; p.fRX = -1.8 * w + 1.7 * h; p.torsoRY = 0.5 * w - 0.9 * h; p.bodyRX = 0.2 * h;
    p.aLZ = 0.5; p.aLX = -0.8;
  },
  twirl(k, p) {
    p.bodyRY = ease(k) * Math.PI * 2; p.aLZ = 1.2; p.aRZ = -1.2; p.aRX = -0.5; p.bodyY = Math.sin(k * Math.PI) * 0.35;
  },
  recall(k, p) {
    p.aLX = p.aRX = -0.3; p.aLZ = 0.2; p.aRZ = -0.2; p.fLX = p.fRX = -1.9; p.headRX = 0.35;
    p.bodyY = Math.sin(k * 40) * 0.01;
  },
  hit(k, p) { p.bodyRX = -0.25 * Math.sin(k * Math.PI); p.sq = 0.08 * Math.sin(k * Math.PI); },
};

export class Rig {
  constructor(spec = {}) {
    const s = this.s = { ...DEF, ...spec };
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.hips = new THREE.Group(); this.hips.position.y = s.legLen + 0.12; this.body.add(this.hips);
    this.torso = new THREE.Group(); this.hips.add(this.torso);
    this.head = new THREE.Group(); this.head.position.y = s.bodyH + s.headR * 0.68; this.torso.add(this.head);
    const mk = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    this.armL = mk(this.torso, s.bodyW * 0.98, s.bodyH * 0.8, 0);
    this.armR = mk(this.torso, -s.bodyW * 0.98, s.bodyH * 0.8, 0);
    this.foreL = mk(this.armL, 0, -s.armLen, 0); this.foreR = mk(this.armR, 0, -s.armLen, 0);
    this.handL = mk(this.foreL, 0, -s.foreLen, 0); this.handR = mk(this.foreR, 0, -s.foreLen, 0);
    this.legL = mk(this.hips, s.hipW, 0, 0); this.legR = mk(this.hips, -s.hipW, 0, 0);
    this.footL = mk(this.legL, 0, -s.legLen, 0); this.footR = mk(this.legR, 0, -s.legLen, 0);
    this.root.scale.setScalar(s.scale);
    this.pose = newPose();
    this.tmp = newPose();
    this.t = Math.random() * 10;
    this.runPhase = 0;
    this.action = null; // {name, t, dur}
    this.hooks = [];    // 角色专属的额外动画（尾巴、披风……）
    this.moveBlend = 0;
    this.deadT = -1;
  }

  // ---- 通用部件 ----
  torsoMesh(color, o = {}) {
    const s = this.s, w = s.bodyW, h = s.bodyH;
    const pts = o.profile || [[0, -0.1], [w * 0.82, -0.08], [w * 1.0, h * 0.2], [w * 0.98, h * 0.5], [w * 0.86, h * 0.8], [w * 0.5, h * 0.98], [0, h * 1.02]];
    return P(G.lathe(`torso${w}_${h}_${o.key || ''}`, pts), color, { parent: this.torso, ol: o.ol });
  }
  skirt(color, len = 0.4, flare = 1.35, y = 0.18, key = '') {
    const w = this.s.bodyW;
    const pts = [[w * 1.02, y], [w * flare * 0.98, y - len * 0.8], [w * flare, y - len], [w * flare * 0.9, y - len - 0.02]];
    const g = G.lathe(`skirt${w}_${len}_${flare}_${y}_${key}`, pts);
    const m = P(g, color, { parent: this.torso, mat: toon(color, { side: THREE.DoubleSide }) });
    return m;
  }
  limbs(o) {
    const s = this.s;
    const arm = (side) => {
      const A = side > 0 ? this.armL : this.armR, F = side > 0 ? this.foreL : this.foreR, H = side > 0 ? this.handL : this.handR;
      P(G.capsule(s.armR, s.armLen * 0.7), o.sleeve, { parent: A, pos: [0, -s.armLen * 0.5, 0] });
      P(G.capsule(s.armR * 0.92, s.foreLen * 0.7), o.fore || o.sleeve, { parent: F, pos: [0, -s.foreLen * 0.5, 0] });
      P(G.sphere(), o.hand, { parent: H, s: s.armR * 1.35 });
    };
    arm(1); arm(-1);
    const leg = (side) => {
      const L = side > 0 ? this.legL : this.legR, Fo = side > 0 ? this.footL : this.footR;
      P(G.capsule(s.legR, s.legLen * 0.75), o.pants, { parent: L, pos: [0, -s.legLen * 0.45, 0] });
      P(G.sphere(), o.boots, { parent: Fo, pos: [0, -0.01, 0.07], s: [s.legR * 1.2, 0.12, s.legR * 1.75] });
    };
    leg(1); leg(-1);
  }
  headBall(color, o = {}) {
    const R = this.s.headR;
    return P(G.sphere(28, 20), color, { parent: this.head, s: [R * (o.sx || 1.04), R * (o.sy || 0.96), R * (o.sz || 1)], ol: 0.032 });
  }
  // 眼睛、腮红、嘴巴、眉毛
  face(o = {}) {
    const R = this.s.headR, H = this.head;
    const eyeCol = o.eye || '#2a2340';
    for (const sx of [1, -1]) {
      const e = onSphere(R, sx * (o.eyeX || 0.36), o.eyeY ?? -0.08, 0.9, -0.02);
      const eye = P(G.sphere(), eyeCol, { parent: H, pos: e.pos, rot: e.rot, order: 'YXZ', s: [R * 0.13, R * (o.eyeH || 0.19), R * 0.07], ol: 0.012 });
      P(G.sphere(10, 8), '#ffffff', { parent: eye, pos: [-0.3 * sx, 0.35, 0.75], s: 0.36, outline: false, emissive: '#ffffff', ei: 0.6 });
      P(G.sphere(10, 8), '#ffffff', { parent: eye, pos: [0.25 * sx, -0.35, 0.8], s: 0.18, outline: false, emissive: '#ffffff', ei: 0.6 });
      if (o.blush !== false) {
        const b = onSphere(R, sx * 0.55, -0.32, 0.78, -0.03);
        P(G.sphere(12, 8), o.blushCol || '#ff8c8c', { parent: H, pos: b.pos, rot: b.rot, order: 'YXZ', s: [R * 0.12, R * 0.06, R * 0.04], outline: false, opacity: 0.75 });
      }
      if (o.brow) {
        const b = onSphere(R, sx * 0.36, 0.2, 0.9, 0.0);
        const m = P(G.box(R * 0.32, R * 0.06, R * 0.06), o.browCol || '#3a2418', { parent: H, pos: b.pos, rot: b.rot, order: 'YXZ', ol: 0.008 });
        m.rotation.z = -sx * o.brow;
      }
    }
    const m = onSphere(R, 0, -0.38, 0.92, -0.01);
    if (o.mouth === 'line') {
      P(G.box(R * 0.18, R * 0.035, R * 0.04), '#5a2a22', { parent: H, pos: m.pos, rot: m.rot, order: 'YXZ', outline: false });
    } else if (o.mouth !== false) {
      const mm = P(G.torus(R * 0.08, R * 0.022, Math.PI, 6, 10), '#6a2c24', { parent: H, pos: m.pos, rot: m.rot, order: 'YXZ', outline: false });
      mm.rotateZ(Math.PI);
    }
  }
  // 头顶附着点
  onHead(nx, ny, nz, lift = 0) { return onSphere(this.s.headR, nx, ny, nz, lift); }

  // ---- 动画 ----
  play(name, dur) {
    if (!ANIMS[name]) name = 'slash'; // 找不到的动作退回默认劈砍，保证总有出手动作
    this.action = { name, t: 0, dur: Math.max(0.1, dur) };
  }
  hitReact() { if (!this.action) this.action = { name: 'hit', t: 0, dur: 0.25 }; }

  update(dt, st) {
    this.t += dt;
    const p = this.pose, t = this.t;
    for (const k in p) p[k] = 0;
    const mv = st.moving ? 1 : 0;
    this.moveBlend += (mv - this.moveBlend) * Math.min(1, dt * 10);
    const mb = this.moveBlend;
    // 待机
    const br = Math.sin(t * 2.4);
    p.bodyY = br * 0.025; p.aLZ = 0.16 + br * 0.03; p.aRZ = -0.16 - br * 0.03; p.fLX = p.fRX = -0.2;
    p.headRZ = Math.sin(t * 0.9) * 0.04; p.headRX = Math.sin(t * 1.3) * 0.03;
    // 跑动
    if (mb > 0.01) {
      this.runPhase += dt * (st.speedMul || 1) * 11;
      const s = Math.sin(this.runPhase), c = Math.cos(this.runPhase);
      const r = this.tmp; for (const k in r) r[k] = 0;
      r.lLX = s * 0.95; r.lRX = -s * 0.95; r.aLX = -s * 0.85; r.aRX = s * 0.85; r.aLZ = 0.2; r.aRZ = -0.2;
      r.fLX = r.fRX = -1.0; r.bodyY = Math.abs(c) * 0.13; r.bodyRX = 0.2; r.torsoRY = s * 0.12; r.headRX = -0.1;
      r.sq = Math.abs(c) * -0.04;
      mixPose(p, r, mb);
    }
    // 技能 / 攻击动作
    const a = this.action;
    if (a) {
      a.t += dt;
      const k = a.t / a.dur;
      if (k >= 1) this.action = null;
      else {
        const r = this.tmp; for (const kk in r) r[kk] = p[kk];
        ANIMS[a.name](k, r);
        const w = Math.min(1, k / 0.1, (1 - k) / 0.15);
        // 腿部保持跑动
        const keepLegs = mb > 0.5 && a.name !== 'leap' && a.name !== 'channel';
        const lL = p.lLX, lR = p.lRX;
        mixPose(p, r, clamp(w));
        if (keepLegs) { p.lLX = lL; p.lRX = lR; }
      }
    }
    // 死亡
    if (st.dead) {
      if (this.deadT < 0) this.deadT = 0;
      this.deadT += dt;
      const k = ease(clamp(this.deadT / 0.6));
      p.bodyRX = -1.45 * k; p.bodyY = -0.1 * k; p.aLZ = 1.2 * k; p.aRZ = -1.2 * k; p.headRX = 0.3 * k;
    } else this.deadT = -1;
    this.apply(p);
    for (const h of this.hooks) h(dt, t, st, p);
  }

  apply(p) {
    const b = this.body;
    b.position.y = p.bodyY;
    b.rotation.set(p.bodyRX, p.bodyRY, p.bodyRZ);
    const sq = p.sq;
    b.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    this.torso.rotation.set(p.torsoRX, p.torsoRY, p.torsoRZ);
    this.head.rotation.set(p.headRX, p.headRY, p.headRZ);
    this.armL.rotation.set(p.aLX, p.aLY, p.aLZ);
    this.armR.rotation.set(p.aRX, p.aRY, p.aRZ);
    this.foreL.rotation.x = p.fLX; this.foreR.rotation.x = p.fRX;
    this.legL.rotation.set(p.lLX, 0, p.lLZ); this.legR.rotation.set(p.lRX, 0, p.lRZ);
    this.footL.rotation.x = -p.lLX * 0.5; this.footR.rotation.x = -p.lRX * 0.5;
  }
}

// 链式摆动（尾巴、辫子、披风飘带）
export function chain(parent, n, make, spacing) {
  const nodes = [];
  let cur = parent;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    if (i > 0) g.position.y = spacing;
    cur.add(g);
    make(g, i);
    nodes.push(g);
    cur = g;
  }
  return nodes;
}

export { lerp };
