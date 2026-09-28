// 手绘风召唤师峡谷：布局、地面水彩贴图、寻路网格与植被装饰全部程序生成。
import * as THREE from 'three';
import { P, G, toon, addOutline, canvasTex, rng, fbm, INK, FOG } from './toon-kit.js';
import { treeGeometries, towerModel, inhibModel, nexusModel, fountainModel, TEAM_COL } from './props.js';

export const HALF = 110;
const LIMIT = 105;
export const LANE_W = 6.5;
const RIVER_W = 7;
export const BASE = { 1: { x: -92, z: 92 }, 2: { x: 92, z: -92 } };
export const FOUNTAIN = { 1: { x: -100, z: 100 }, 2: { x: 100, z: -100 } };
export const NEXUS = { 1: { x: -88, z: 88 }, 2: { x: 88, z: -88 } };
// 大龙坑、小龙坑：凹进河道两侧的岩壁里，只在靠河一侧有入口
export const PITS = { baron: { x: -33, z: -47, r: 8.5 }, dragon: { x: 33, z: 47, r: 8.5 } };
const INNER = 88; // 兵线围成的野区范围

const LANE_PTS = {
  top: [[-84, 84], [-94, 60], [-94, -80], [-80, -94], [60, -94], [84, -84]],
  mid: [[-84, 84], [84, -84]],
  bot: [[-84, 84], [-60, 94], [80, 94], [94, 80], [94, -60], [84, -84]],
};
const RIVER = [[-104, -104], [104, 104]];

// 野区：以蓝色方上半野区为模板，其余三块通过对称变换生成
// 营地 [x, z, 类型]；下半野区对应把蓝 buff/蛤蟆/三狼换成红 buff/石头人/F4
const CAMPS_Q = [[-60, 2, 'blue'], [-78, -18, 'gromp'], [-52, 30, 'wolves']];
const KMAP = { blue: 'red', gromp: 'krugs', wolves: 'raptors' };
// 墙体（胶囊）[ax, az, bx, bz, 半径]：沿兵线和河道留出入口，中间几块岩石/树丛岛
const WALLS_Q = [
  // 贴着兵线、河道、中路的边墙（留出入口）
  [-83, -75, -83, -42, 3], [-83, -28, -83, 6, 3], [-83, 24, -83, 56, 3],
  [-64, 52, -50, 38, 3], [-40, 28, -22, 10, 3],
  [-86, -70, -66, -50, 3], [-52, -36, -34, -18, 3],
  // 野区中的大块岩壁 / 树丛岛
  [-78, -60, -72, -52, 8.5], [-62, -24, -60, -20, 8.5], [-44, -20, -40, -18, 7.5],
  [-72, 16, -70, 20, 8.5], [-66, 50, -64, 48, 8], [-40, 12, -38, 10, 7.5], [-22, -2, -22, -2, 5.5],
];
const mirror = ([x, z]) => [-z, -x];
const flip = ([x, z]) => [-x, -z];
const TRANSFORMS = [(p) => p, mirror, flip, (p) => flip(mirror(p))];
export const CAMPS = [];
TRANSFORMS.forEach((T, qi) => CAMPS_Q.forEach(([x, z, k]) => { const [tx, tz] = T([x, z]); CAMPS.push({ x: tx, z: tz, kind: qi % 2 ? KMAP[k] : k }); }));
// 河蟹在河道里
export const CRABS = [{ x: -50, z: -50 }, { x: 50, z: 50 }];
const WALLS = TRANSFORMS.flatMap(T => WALLS_Q.map(([ax, az, bx, bz, r]) => { const a = T([ax, az]), b = T([bx, bz]); return [a[0], a[1], b[0], b[1], r]; }));

export class Lane {
  constructor(pts) {
    this.pts = pts.map(([x, z]) => ({ x, z }));
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].z - this.pts[i - 1].z));
    this.len = this.cum[this.cum.length - 1];
  }
  pointAt(d) {
    d = Math.max(0, Math.min(this.len, d));
    for (let i = 1; i < this.pts.length; i++) {
      if (d <= this.cum[i]) {
        const a = this.pts[i - 1], b = this.pts[i], k = (d - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1]);
        return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
      }
    }
    return { ...this.pts[this.pts.length - 1] };
  }
  progressOf(p) {
    let best = 1e9, bd = 0;
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i];
      const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L2));
      const d = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
      if (d < best) { best = d; bd = this.cum[i - 1] + Math.sqrt(L2) * t; }
    }
    return bd;
  }
}
export const LANES = { top: new Lane(LANE_PTS.top), mid: new Lane(LANE_PTS.mid), bot: new Lane(LANE_PTS.bot) };

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
}
function polyDist(px, pz, pts) {
  let d = 1e9;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(px, pz, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return d;
}
export function openArea(x, z) {
  if (Math.abs(x) > LIMIT || Math.abs(z) > LIMIT) return false;
  for (const k in LANE_PTS) if (polyDist(x, z, LANE_PTS[k]) < LANE_W) return true;
  if (polyDist(x, z, RIVER) < RIVER_W) return true;
  for (const t of [1, 2]) if (Math.hypot(x - BASE[t].x, z - BASE[t].z) < 30) return true;
  for (const c of CAMPS) if (Math.hypot(x - c.x, z - c.z) < 6) return true;
  for (const k in PITS) if (Math.hypot(x - PITS[k].x, z - PITS[k].z) < PITS[k].r) return true;
  if (Math.abs(x) >= INNER || Math.abs(z) >= INNER) return false;
  for (const w of WALLS) if (segDist(x, z, w[0], w[1], w[2], w[3]) < w[4]) return false;
  return true;
}

// 防御建筑布局
export function structureLayout() {
  const list = [];
  const td = { top: [36, 80, 130], mid: [24, 44, 70], bot: [36, 80, 130] };
  const idist = { top: 22, mid: 14, bot: 22 };
  for (const lane of ['top', 'mid', 'bot']) {
    const L = LANES[lane];
    // 建筑放在兵线一侧，给小兵留出通道
    const edge = (d, i) => {
      const a = L.pointAt(d - 1), b = L.pointAt(d + 1), p = L.pointAt(d);
      let nx = -(b.z - a.z), nz = b.x - a.x; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      let sgn = lane === 'mid' ? (i % 2 ? 1 : -1) : (nx * p.x + nz * p.z > 0 ? 1 : -1);
      return { x: p.x + nx * 3.6 * sgn, z: p.z + nz * 3.6 * sgn };
    };
    td[lane].forEach((d, i) => {
      const tier = ['inhibTower', 'inner', 'outer'][i];
      const b = edge(d, i), r = edge(L.len - d, i);
      list.push({ kind: 'tower', team: 1, lane, tier, x: b.x, z: b.z, d });
      list.push({ kind: 'tower', team: 2, lane, tier, x: r.x, z: r.z, d: L.len - d });
    });
    const b = edge(idist[lane], 1), r = edge(L.len - idist[lane], 1);
    list.push({ kind: 'inhib', team: 1, lane, x: b.x, z: b.z, d: idist[lane] });
    list.push({ kind: 'inhib', team: 2, lane, x: r.x, z: r.z, d: L.len - idist[lane] });
  }
  for (const t of [1, 2]) {
    const s = t === 1 ? 1 : -1;
    list.push({ kind: 'tower', team: t, lane: 'nexus', tier: 'nexus', x: NEXUS[t].x + 6 * s, z: NEXUS[t].z + 2 * s });
    list.push({ kind: 'tower', team: t, lane: 'nexus', tier: 'nexus', x: NEXUS[t].x - 2 * s, z: NEXUS[t].z - 6 * s });
    list.push({ kind: 'nexus', team: t, x: NEXUS[t].x, z: NEXUS[t].z });
  }
  return list;
}

// ---------- 导航网格 ----------
export class NavGrid {
  constructor() {
    this.N = HALF * 2;
    this.walk = new Uint8Array(this.N * this.N);
    for (let j = 0; j < this.N; j++) for (let i = 0; i < this.N; i++) this.walk[j * this.N + i] = openArea(i - HALF + 0.5, j - HALF + 0.5) ? 1 : 0;
  }
  block(x, z, r) {
    for (let j = Math.floor(z - r + HALF); j <= Math.ceil(z + r + HALF); j++)
      for (let i = Math.floor(x - r + HALF); i <= Math.ceil(x + r + HALF); i++)
        if (i >= 0 && j >= 0 && i < this.N && j < this.N && Math.hypot(i - HALF + 0.5 - x, j - HALF + 0.5 - z) < r) this.walk[j * this.N + i] = 0;
  }
  ok(x, z) {
    const i = Math.floor(x + HALF), j = Math.floor(z + HALF);
    return i >= 0 && j >= 0 && i < this.N && j < this.N && this.walk[j * this.N + i] === 1;
  }
  los(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.35);
    for (let k = 1; k <= n; k++) { const t = k / n; if (!this.ok(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  nearestOpen(x, z) {
    if (this.ok(x, z)) return { x, z };
    for (let r = 1; r < 30; r++) {
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos(a / 16 * Math.PI * 2) * r, pz = z + Math.sin(a / 16 * Math.PI * 2) * r;
        if (this.ok(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }
  // 沿直线走到最远的可通行点（用于位移技能）
  lastOpen(ax, az, bx, bz, through = false) {
    if (through) { const p = this.nearestOpen(bx, bz); return p; }
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.3);
    let lx = ax, lz = az;
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (!this.ok(x, z)) break;
      lx = x; lz = z;
    }
    return { x: lx, z: lz };
  }
  path(sx, sz, tx, tz) {
    const t = this.nearestOpen(tx, tz);
    tx = t.x; tz = t.z;
    if (this.los(sx, sz, tx, tz)) return [{ x: tx, z: tz }];
    const N = this.N, W = this.walk;
    const si = Math.floor(sx + HALF), sj = Math.floor(sz + HALF), ti = Math.floor(tx + HALF), tj = Math.floor(tz + HALF);
    if (si < 0 || sj < 0 || si >= N || sj >= N) return [{ x: tx, z: tz }];
    const start = sj * N + si, goal = tj * N + ti;
    const g = this._g || (this._g = new Float32Array(N * N));
    const from = this._f || (this._f = new Int32Array(N * N));
    const stamp = this._s || (this._s = new Uint32Array(N * N));
    const closed = this._c || (this._c = new Uint32Array(N * N));
    this._stamp = (this._stamp || 0) + 1;
    const S = this._stamp;
    const heap = [];
    const push = (node, f) => { heap.push([f, node]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const h = (i, j) => { const dx = Math.abs(i - ti), dy = Math.abs(j - tj); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    stamp[start] = S; g[start] = 0; from[start] = -1;
    push(start, h(si, sj));
    let found = false, iter = 0;
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length && iter++ < 60000) {
      const [, cur] = pop();
      if (closed[cur] === S) continue;
      closed[cur] = S;
      if (cur === goal) { found = true; break; }
      const ci = cur % N, cj = (cur / N) | 0;
      for (const [di, dj, c] of DIRS) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nn = nj * N + ni;
        if (!W[nn] || closed[nn] === S) continue;
        if (di && dj && (!W[cj * N + ni] || !W[nj * N + ci])) continue;
        const ng = g[cur] + c;
        if (stamp[nn] !== S || ng < g[nn]) { stamp[nn] = S; g[nn] = ng; from[nn] = cur; push(nn, ng + h(ni, nj)); }
      }
    }
    if (!found) return [{ x: tx, z: tz }];
    const raw = [];
    for (let c = goal; c !== -1 && c !== start; c = from[c]) raw.push({ x: (c % N) - HALF + 0.5, z: ((c / N) | 0) - HALF + 0.5 });
    raw.reverse();
    raw[raw.length - 1] = { x: tx, z: tz };
    // 视线平滑
    const out = [];
    let cx = sx, cz = sz, i = 0;
    while (i < raw.length) {
      let j = raw.length - 1;
      while (j > i && !this.los(cx, cz, raw[j].x, raw[j].z)) j--;
      out.push(raw[j]); cx = raw[j].x; cz = raw[j].z; i = j + 1;
    }
    return out;
  }
}

// ---------- 地面水彩贴图 ----------
function paintGround(size = 4096) {
  const S = size / (HALF * 2);
  const X = (x) => (x + HALF) * S;
  const r = rng(2024);
  // 在画布上画出可通行区域（extra > 0 时整体外扩，用来做描边和暗边）
  const M = document.createElement('canvas'); M.width = M.height = size;
  const openShape = (g, extra, col) => {
    g.save();
    g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
    const I = INNER + extra;
    g.fillRect(X(-I), X(-I), (I * 2) * S, (I * 2) * S);
    g.globalCompositeOperation = 'destination-out';
    for (const w of WALLS) { g.lineWidth = Math.max(0.5, w[4] - extra) * 2 * S; g.beginPath(); g.moveTo(X(w[0]), X(w[1])); g.lineTo(X(w[2]) + 0.1, X(w[3])); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    for (const k in LANE_PTS) { g.lineWidth = (LANE_W + extra) * 2 * S; g.beginPath(); LANE_PTS[k].forEach(([x, z], i) => i ? g.lineTo(X(x), X(z)) : g.moveTo(X(x), X(z))); g.stroke(); }
    g.lineWidth = (RIVER_W + extra) * 2 * S; g.beginPath(); g.moveTo(X(RIVER[0][0]), X(RIVER[0][1])); g.lineTo(X(RIVER[1][0]), X(RIVER[1][1])); g.stroke();
    for (const t of [1, 2]) { g.beginPath(); g.arc(X(BASE[t].x), X(BASE[t].z), (30 + extra) * S, 0, 7); g.fill(); }
    for (const c of CAMPS) { g.beginPath(); g.arc(X(c.x), X(c.z), (6 + extra) * S, 0, 7); g.fill(); }
    for (const k in PITS) { g.beginPath(); g.arc(X(PITS[k].x), X(PITS[k].z), (PITS[k].r + extra) * S, 0, 7); g.fill(); }
    // 地图边界
    g.globalCompositeOperation = 'destination-in';
    g.fillRect(X(-LIMIT - extra), X(-LIMIT - extra), (LIMIT + extra) * 2 * S, (LIMIT + extra) * 2 * S);
    g.restore();
  };
  const strokeShapes = (g, extra, col) => {
    const m = M.getContext('2d');
    m.save(); m.clearRect(0, 0, size, size);
    openShape(m, extra, '#000');
    m.globalCompositeOperation = 'source-in'; m.fillStyle = col; m.fillRect(0, 0, size, size);
    m.restore();
    g.drawImage(M, 0, 0);
  };
  const tex = canvasTex(size, size, (g) => {
    // 1) 森林底色
    g.fillStyle = '#4b7a3e'; g.fillRect(0, 0, size, size);
    const forest = ['#5a8a48', '#426f38', '#62924f', '#3d6835'];
    for (let i = 0; i < 2600; i++) {
      g.globalAlpha = 0.18 + r() * 0.15; g.fillStyle = forest[i % 4];
      g.beginPath(); g.arc(r() * size, r() * size, 20 + r() * 90, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    // 2) 空地的暗边与墨线
    strokeShapes(g, 2.6, 'rgba(30,50,25,0.55)');
    strokeShapes(g, 0.45, INK);
    // 3) 草地层（离屏）
    const L = document.createElement('canvas'); L.width = L.height = size;
    const l = L.getContext('2d');
    strokeShapes(l, 0, '#8cc262');
    l.globalCompositeOperation = 'source-atop';
    const greens = ['#9fd174', '#7ab556', '#a9d77f', '#86bf5c'];
    for (let i = 0; i < 3500; i++) {
      l.globalAlpha = 0.2 + r() * 0.2; l.fillStyle = greens[i % 4];
      l.beginPath(); l.ellipse(r() * size, r() * size, 20 + r() * 70, 14 + r() * 50, r() * 3, 0, 7); l.fill();
    }
    l.lineCap = 'round';
    for (let i = 0; i < 60000; i++) {
      const x = r() * size, y = r() * size, len = 8 + r() * 12, a = -Math.PI / 2 + (r() - 0.5) * 0.9;
      l.globalAlpha = 0.35 + r() * 0.35;
      l.strokeStyle = i % 3 ? '#5f9a44' : '#c6e89c'; l.lineWidth = 1.4 + r() * 1.6;
      l.beginPath(); l.moveTo(x, y); l.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 3, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len); l.stroke();
    }
    const flowers = ['#ffffff', '#ffd84a', '#ff9ac0', '#b8a0ff'];
    for (let i = 0; i < 5000; i++) {
      l.globalAlpha = 0.9; l.fillStyle = flowers[i % 4];
      const x = r() * size, y = r() * size;
      l.beginPath(); l.arc(x, y, 2.5 + r() * 2.5, 0, 7); l.fill();
    }
    l.globalAlpha = 1;
    l.globalCompositeOperation = 'source-over';
    g.drawImage(L, 0, 0);
    // 4) 河岸沙地与河床
    g.lineCap = 'round';
    const river = (w, col) => { g.strokeStyle = col; g.lineWidth = w * 2 * S; g.beginPath(); g.moveTo(X(RIVER[0][0]), X(RIVER[0][1])); g.lineTo(X(RIVER[1][0]), X(RIVER[1][1])); g.stroke(); };
    river(RIVER_W - 0.2, '#e3cf95'); river(RIVER_W - 1.2, '#3f8fb8'); river(RIVER_W - 1.6, '#5ab0d6');
    // 5) 龙坑、男爵坑
    for (const k in PITS) {
      const p = PITS[k];
      g.fillStyle = k === 'baron' ? '#7d6f98' : '#b38a5c';
      g.beginPath(); g.arc(X(p.x), X(p.z), (p.r - 0.8) * S, 0, 7); g.fill();
      g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
      for (let i = 0; i < 40; i++) {
        const a = r() * 7, d = r() * (p.r - 1.5);
        g.fillStyle = 'rgba(40,25,20,.18)'; g.beginPath(); g.ellipse(X(p.x + Math.cos(a) * d), X(p.z + Math.sin(a) * d), 10 + r() * 20, 6 + r() * 12, r() * 3, 0, 7); g.fill();
      }
    }
    // 6) 兵线土路
    const lanes = (w, col, dash) => {
      for (const k in LANE_PTS) {
        g.strokeStyle = col; g.lineWidth = w * 2 * S; g.setLineDash(dash || []);
        g.beginPath(); LANE_PTS[k].forEach(([x, z], i) => i ? g.lineTo(X(x), X(z)) : g.moveTo(X(x), X(z))); g.stroke();
      }
      g.setLineDash([]);
    };
    lanes(4.9, '#a9844d'); lanes(4.4, '#d8b877');
    for (const k in LANE_PTS) {
      const lane = LANES[k];
      for (let d = 0; d < lane.len; d += 0.25) {
        const p = lane.pointAt(d), a = r() * 7, rr = r() * 4.2;
        const x = X(p.x + Math.cos(a) * rr), y = X(p.z + Math.sin(a) * rr);
        g.fillStyle = r() < 0.5 ? 'rgba(160,120,70,.45)' : 'rgba(245,225,175,.55)';
        g.beginPath(); g.ellipse(x, y, 3 + r() * 7, 2 + r() * 4, r() * 3, 0, 7); g.fill();
        if (r() < 0.05) { g.strokeStyle = 'rgba(43,27,20,.5)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 5 + r() * 5, 4 + r() * 3, r() * 3, 0, 7); g.stroke(); }
      }
    }
    // 7) 基地石砖广场
    for (const t of [1, 2]) {
      const b = BASE[t];
      g.save(); g.beginPath(); g.arc(X(b.x), X(b.z), 24 * S, 0, 7); g.clip();
      g.fillStyle = '#d8cbb0'; g.fillRect(0, 0, size, size);
      g.strokeStyle = 'rgba(120,100,70,.55)'; g.lineWidth = 3;
      for (let i = -40; i < 40; i++) {
        g.beginPath(); g.moveTo(X(b.x + i * 2.2), X(b.z - 30)); g.lineTo(X(b.x + i * 2.2 + (r() - 0.5)), X(b.z + 30)); g.stroke();
        g.beginPath(); g.moveTo(X(b.x - 30), X(b.z + i * 2.2)); g.lineTo(X(b.x + 30), X(b.z + i * 2.2 + (r() - 0.5))); g.stroke();
      }
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,245,220' : '140,115,80'},.35)`; g.fillRect(X(b.x - 30 + r() * 60), X(b.z - 30 + r() * 60), 2.2 * S, 2.2 * S); }
      g.restore();
      g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.arc(X(b.x), X(b.z), 24 * S, 0, 7); g.stroke();
      g.strokeStyle = TEAM_COL[t]; g.lineWidth = 10; g.beginPath(); g.arc(X(b.x), X(b.z), 22.5 * S, 0, 7); g.stroke();
    }
    // 8) 野怪营地
    for (const c of CAMPS) {
      g.strokeStyle = 'rgba(60,90,40,.6)'; g.lineWidth = 5; g.setLineDash([12, 10]);
      g.beginPath(); g.arc(X(c.x), X(c.z), 3.6 * S, 0, 7); g.stroke(); g.setLineDash([]);
    }
  }, { aniso: 8 });
  return tex;
}

// 河流：程序化水面着色器（流动的手绘波纹）
function riverMesh() {
  const len = Math.hypot(RIVER[1][0] - RIVER[0][0], RIVER[1][1] - RIVER[0][1]);
  const geo = new THREE.PlaneGeometry(len, (RIVER_W - 1.2) * 2, 1, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFogTex: FOG.tex, uFogAmt: FOG.amt }, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; varying vec3 vW; uniform float uTime; uniform sampler2D uFogTex; uniform float uFogAmt;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){
        float e = min(vUv.y, 1.0 - vUv.y);
        vec3 c = mix(vec3(0.30,0.62,0.80), vec3(0.42,0.76,0.90), smoothstep(0.0, 0.35, e));
        vec2 p = vec2(vUv.x * 140.0 - uTime * 0.7, vUv.y * 6.0);
        vec2 id = floor(p); vec2 f = fract(p) - 0.5;
        float r = h(id);
        if (r > 0.5) {
          float y = f.y + 0.12 * sin(f.x * 6.283 + r * 6.0);
          float line = smoothstep(0.07, 0.025, abs(y)) * smoothstep(0.42, 0.25, abs(f.x));
          c = mix(c, vec3(1.0), line * 0.85);
        }
        float sparkle = step(0.985, h(floor(vec2(vUv.x * 400.0, vUv.y * 30.0) + floor(uTime * 3.0))));
        c += sparkle * 0.25;
        // 龙坑与男爵坑是干燥的石地，不画水面
        float pit = min(length(vW.xz - vec2(${PITS.baron.x.toFixed(1)}, ${PITS.baron.z.toFixed(1)})), length(vW.xz - vec2(${PITS.dragon.x.toFixed(1)}, ${PITS.dragon.z.toFixed(1)})));
        float dry = smoothstep(${(PITS.dragon.r - 1.4).toFixed(1)}, ${(PITS.dragon.r - 0.6).toFixed(1)}, pit);
        if (uFogAmt > 0.0) c = mix(c, c * vec3(0.42, 0.45, 0.58), uFogAmt * texture2D(uFogTex, vec2(vW.x / 220.0 + 0.5, 0.5 - vW.z / 220.0)).r);
        gl_FragColor = vec4(c, smoothstep(0.0, 0.1, e) * 0.82 * dry);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = -Math.PI / 4;
  m.position.y = 0.03;
  m.renderOrder = 2;
  return m;
}

// ---------- 植被（分块实例化） ----------
function buildForest(scene, grid) {
  const geos = treeGeometries();
  const r = rng(99);
  const CH = 8, SPAN = 320, CS = SPAN / CH;
  const buckets = new Map();
  const put = (type, x, z, s, rot, col) => {
    const cx = Math.floor((x + SPAN / 2) / CS), cz = Math.floor((z + SPAN / 2) / CS);
    const key = `${type}|${cx}|${cz}`;
    if (!buckets.has(key)) buckets.set(key, { type, items: [] });
    buckets.get(key).items.push({ x, z, s, rot, col });
  };
  const nearOpen = (x, z, d) => grid.ok(x + d, z) || grid.ok(x - d, z) || grid.ok(x, z + d) || grid.ok(x, z - d) || grid.ok(x + d * 0.7, z + d * 0.7) || grid.ok(x - d * 0.7, z - d * 0.7) || grid.ok(x + d * 0.7, z - d * 0.7) || grid.ok(x - d * 0.7, z + d * 0.7);
  const greens = ['#5aa04a', '#4f9444', '#6ab356', '#3f8a44', '#78b85a', '#8fc25a'];
  const pines = ['#3f7f4a', '#356e44', '#4a8f55'];
  for (let z = -158; z < 158; z += 2.3) {
    for (let x = -158; x < 158; x += 2.3) {
      const px = x + (r() - 0.5) * 1.6, pz = z + (r() - 0.5) * 1.6;
      const inside = Math.abs(px) < HALF && Math.abs(pz) < HALF;
      if (inside && grid.ok(px, pz)) continue;
      if (inside && nearOpen(px, pz, 0.9)) continue;
      const outer = Math.max(Math.abs(px), Math.abs(pz));
      if (outer > HALF && r() < (outer - HALF) / 60) continue;
      const edge = inside && nearOpen(px, pz, 2.4);
      const n = fbm(px * 0.05, pz * 0.05, 2);
      const q = r();
      if (edge && q < 0.22) put('rock', px, pz, 0.5 + r() * 0.6, r() * 6, ['#a89c8a', '#948875', '#b8ad98'][Math.floor(r() * 3)]);
      else if (edge && q < 0.62) put('bush', px, pz, 0.9 + r() * 0.5, r() * 6, greens[Math.floor(r() * greens.length)]);
      else if (n > 0.5 ? q < 0.7 : q < 0.3) put('pine', px, pz, 1.2 + r() * 0.9, r() * 6, pines[Math.floor(r() * 3)]);
      else put('round', px, pz, 1.1 + r() * 0.8, r() * 6, greens[Math.floor(r() * greens.length)]);
    }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  const whiteMat = toon('#ffffff');
  const trunkMat = toon('#7a5236');
  let count = 0;
  for (const { type, items } of buckets.values()) {
    const G2 = geos[type];
    const mk = (geo, mat, colored) => {
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach((it, i) => {
        e.set((r() - 0.5) * 0.1, it.rot, (r() - 0.5) * 0.1); q.setFromEuler(e);
        v.set(it.x, 0, it.z); sc.set(it.s, it.s * (0.9 + r() * 0.25), it.s);
        m4.compose(v, q, sc); im.setMatrixAt(i, m4);
        if (colored) im.setColorAt(i, col.set(it.col));
      });
      im.castShadow = true; im.receiveShadow = false;
      im.computeBoundingSphere();
      const ol = addOutline(im, type === 'rock' ? 0.035 : 0.045);
      ol.boundingSphere = im.boundingSphere;
      scene.add(im);
      return im;
    };
    mk(G2.canopy, whiteMat, true);
    if (G2.trunk) mk(G2.trunk, trunkMat, false);
    count += items.length;
  }
  return count;
}

// 草丛与花（可通行区域的小装饰）
function buildGrass(scene, grid) {
  const r = rng(7);
  const blade = new THREE.ConeGeometry(0.08, 0.6, 3);
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const b = blade.clone(); b.rotateZ((i - 1.5) * 0.3); b.translate((i - 1.5) * 0.08, 0.3, (i % 2) * 0.06); parts.push(b.toNonIndexed());
  }
  parts.forEach(p => p.deleteAttribute('uv'));
  const tuft = mergeGeos(parts);
  const pts = [];
  for (let i = 0; i < 9000 && pts.length < 3200; i++) {
    const x = (r() - 0.5) * 210, z = (r() - 0.5) * 210;
    if (!grid.ok(x, z)) continue;
    let lane = false;
    for (const k in LANE_PTS) if (polyDist(x, z, LANE_PTS[k]) < 5) lane = true;
    if (lane || polyDist(x, z, RIVER) < 6.5) continue;
    if (Math.hypot(x - BASE[1].x, z - BASE[1].z) < 25 || Math.hypot(x - BASE[2].x, z - BASE[2].z) < 25) continue;
    pts.push([x, z]);
  }
  const mat = toon('#ffffff');
  const im = new THREE.InstancedMesh(tuft, mat, pts.length);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  const cols = ['#7ab94e', '#8fcc5a', '#6aa844', '#a4d86a'];
  pts.forEach(([x, z], i) => {
    m4.makeRotationY(r() * 6); m4.scale(new THREE.Vector3(1.2, 0.8 + r() * 0.8, 1.2)); m4.setPosition(x, 0, z);
    im.setMatrixAt(i, m4); im.setColorAt(i, c.set(cols[i % 4]));
  });
  im.computeBoundingSphere();
  scene.add(im);
  // 花
  const fgeo = new THREE.SphereGeometry(0.16, 6, 4);
  const fl = [];
  for (let i = 0; i < 4000 && fl.length < 700; i++) {
    const x = (r() - 0.5) * 210, z = (r() - 0.5) * 210;
    if (!grid.ok(x, z)) continue;
    let lane = false;
    for (const k in LANE_PTS) if (polyDist(x, z, LANE_PTS[k]) < 5) lane = true;
    if (lane || polyDist(x, z, RIVER) < 6.5) continue;
    fl.push([x, z]);
  }
  const fm = new THREE.InstancedMesh(fgeo, toon('#ffffff'), fl.length);
  const fc = ['#ffffff', '#ffd84a', '#ff8ab8', '#b8a0ff', '#ff7a5a'];
  fl.forEach(([x, z], i) => { m4.makeScale(1, 0.7, 1); m4.setPosition(x, 0.18, z); fm.setMatrixAt(i, m4); fm.setColorAt(i, c.set(fc[i % 5])); });
  fm.computeBoundingSphere();
  scene.add(fm);
}
function mergeGeos(list) {
  let n = 0; list.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

// 小装饰：基地旗帜、营地蘑菇、坑边石头
function buildDecor(scene) {
  const r = rng(5);
  for (const t of [1, 2]) {
    const b = BASE[t];
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const x = b.x + Math.cos(a) * 25, z = b.z + Math.sin(a) * 25;
      if (Math.abs(x) > 104 || Math.abs(z) > 104) continue;
      const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
      P(G.cyl(0.08, 0.1, 3.4, 6), '#8a5a3c', { parent: g, pos: [0, 1.7, 0] });
      const flag = P(G.box(0.9, 1.3, 0.04), TEAM_COL[t], { parent: g, pos: [0.47, 2.7, 0] });
      P(G.sphere(8, 6), '#e8c25a', { parent: g, pos: [0, 3.45, 0], s: 0.14 });
      flag.userData.flag = true;
    }
  }
  for (const c of CAMPS) {
    for (let i = 0; i < 4; i++) {
      const a = r() * 7, d = 4.2 + r() * 1;
      const g = new THREE.Group(); g.position.set(c.x + Math.cos(a) * d, 0, c.z + Math.sin(a) * d); scene.add(g);
      const cap = ['#e8584a', '#b87ae8', '#f0b040'][i % 3];
      P(G.cyl(0.08, 0.1, 0.4, 6), '#f3e6c8', { parent: g, pos: [0, 0.2, 0] });
      P(G.hemi(), cap, { parent: g, pos: [0, 0.35, 0], s: [0.3, 0.22, 0.3], mat: toon(cap, { side: THREE.DoubleSide }) });
    }
  }
  for (const k in PITS) {
    const p = PITS[k];
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + r() * 0.2;
      P(G.dodeca(1), k === 'baron' ? '#8a7aa6' : '#b0906a', { parent: scene, pos: [p.x + Math.cos(a) * (p.r + 0.3), 0.3, p.z + Math.sin(a) * (p.r + 0.3)], s: [0.6 + r() * 0.4, 0.5 + r() * 0.5, 0.6 + r() * 0.4], rot: [r(), r() * 6, r()] });
    }
  }
}

export function buildMap(scene) {
  const grid = new NavGrid();
  const groundTex = paintGround(4096);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), toon('#ffffff', { map: groundTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), toon('#4b7a3e'));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; outer.receiveShadow = true;
  scene.add(outer);
  const river = riverMesh();
  scene.add(river);
  const trees = buildForest(scene, grid);
  buildGrass(scene, grid);
  buildDecor(scene);
  for (const t of [1, 2]) {
    const f = fountainModel(t); f.obj.position.set(FOUNTAIN[t].x, 0, FOUNTAIN[t].z); scene.add(f.obj);
  }
  return {
    grid, ground, river, trees,
    minimap: groundTex.userData.canvas,
    update(dt, t) { river.material.uniforms.uTime.value = t; },
  };
}

export { towerModel, inhibModel, nexusModel };
