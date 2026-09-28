// 手绘技能与装备图标：水彩底 + 墨线描边的小插画，全部用 Canvas 画出来。
import { INK, rng } from './toon-kit.js';

const S = 128;
let SC = 1; // 当前缩放，用来保持墨线粗细一致

function rgb(h) {
  if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number);
  const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255];
}
// 两色混合，返回 #hex
function blend(a, b, k) { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join(''); }
export function mix(h, k) {
  const [r, g, b] = rgb(h), f = (x) => Math.round(k < 0 ? x * (1 + k) : x + (255 - x) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function at(g, x, y, rot, s, fn) {
  g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s);
  const old = SC; SC *= s; fn(); SC = old; g.restore();
}
// 填色（带明暗渐变）+ 排线阴影 + 墨线描边
function ink(g, path, fill, o = {}) {
  g.save();
  path();
  if (fill) {
    if (o.flat) g.fillStyle = fill;
    else {
      const gr = g.createLinearGradient(-40, -40, 40, 40);
      gr.addColorStop(0, mix(fill, 0.5)); gr.addColorStop(0.45, fill); gr.addColorStop(1, mix(fill, -0.35));
      g.fillStyle = gr;
    }
    g.fill();
  }
  if (o.hatch !== false && fill) {
    g.save(); path(); g.clip();
    g.strokeStyle = 'rgba(43,27,20,.22)'; g.lineWidth = 1.6 / SC;
    for (let i = -60; i < 90; i += 7 / Math.max(SC, 0.5)) { g.beginPath(); g.moveTo(i, 60); g.lineTo(i + 50, 10); g.stroke(); }
    g.restore();
  }
  path();
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = INK; g.lineWidth = (o.lw ?? 4.2) / SC; g.stroke();
  g.restore();
}
// 粗线条（弓臂、锁链、手柄）：先描墨线再描颜色
function line(g, path, color, w) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  path(); g.strokeStyle = INK; g.lineWidth = w + 5 / SC; g.stroke();
  path(); g.strokeStyle = color; g.lineWidth = w; g.stroke();
  g.restore();
}
function glow(g, x, y, r, col, a = 0.8) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.35, col); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.save(); g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore();
}
function hl(g, pts, w = 3) {
  g.save(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = w / SC; g.lineCap = 'round';
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.restore();
}
function speed(g, col, n = 5, x0 = 8, len = 40, y0 = 20, gap = 16) {
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const y = y0 + i * gap, l = len * (0.6 + ((i * 37) % 10) / 20);
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + l, y); g.stroke();
    g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + l, y); g.stroke();
  }
  g.restore();
}

// ---------- 背景 ----------
function background(g, col, seed) {
  const r = rng(seed);
  const gr = g.createRadialGradient(42, 36, 6, 64, 64, 100);
  gr.addColorStop(0, mix(col, 0.5)); gr.addColorStop(0.5, col); gr.addColorStop(1, mix(col, -0.5));
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 16; i++) {
    g.globalAlpha = 0.13; g.fillStyle = r() < 0.5 ? mix(col, 0.55) : mix(col, -0.35);
    g.beginPath(); g.arc(r() * S, r() * S, 10 + r() * 32, 0, 7); g.fill();
  }
  g.globalAlpha = 0.07; g.strokeStyle = '#fff'; g.lineWidth = 2;
  for (let i = -S; i < S * 2; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - S, S); g.stroke(); }
  g.globalAlpha = 1;
}

// ---------- 物件 ----------
const P = {
  sword(g, blade = '#e4ecf4', guard = '#e8c25a', grip = '#6a4a30') {
    ink(g, () => { g.beginPath(); g.moveTo(0, -52); g.lineTo(9, -38); g.lineTo(9, 16); g.lineTo(-9, 16); g.lineTo(-9, -38); g.closePath(); }, blade);
    hl(g, [[-3, -36], [-3, 12]], 2.5);
    ink(g, () => { g.beginPath(); g.roundRect(-24, 15, 48, 9, 4); }, guard);
    ink(g, () => { g.beginPath(); g.rect(-4.5, 24, 9, 18); }, grip, { hatch: false });
    ink(g, () => { g.beginPath(); g.arc(0, 46, 6.5, 0, 7); }, guard);
  },
  axe(g, head = '#b8c2cc', handle = '#5a3a26', accent = '#b3262e') {
    line(g, () => { g.beginPath(); g.moveTo(0, -46); g.lineTo(0, 52); }, handle, 8);
    ink(g, () => { g.beginPath(); g.moveTo(2, -42); g.quadraticCurveTo(30, -56, 46, -42); g.quadraticCurveTo(58, -14, 42, 10); g.quadraticCurveTo(26, -2, 2, -4); g.closePath(); }, head);
    ink(g, () => { g.beginPath(); g.moveTo(-2, -38); g.lineTo(-22, -28); g.lineTo(-2, -14); g.closePath(); }, accent);
    hl(g, [[38, -38], [48, -18], [40, 2]], 2.5);
  },
  bow(g, col = '#9fd8ff') {
    line(g, () => { g.beginPath(); g.arc(-26, 0, 54, -1.05, 1.05); }, col, 8);
    g.save(); g.strokeStyle = INK; g.lineWidth = 1.8 / SC;
    g.beginPath(); g.moveTo(-26 + 54 * Math.cos(-1.05), 54 * Math.sin(-1.05)); g.lineTo(-26 + 54 * Math.cos(1.05), 54 * Math.sin(1.05)); g.stroke(); g.restore();
    ink(g, () => { g.beginPath(); g.roundRect(22, -9, 10, 18, 3); }, '#8a5a3c', { hatch: false });
  },
  arrow(g, head = '#dfe8f0', shaft = '#8a5a3c', feather = '#ffffff') {
    line(g, () => { g.beginPath(); g.moveTo(0, 44); g.lineTo(0, -30); }, shaft, 4);
    ink(g, () => { g.beginPath(); g.moveTo(0, -52); g.lineTo(9, -30); g.lineTo(-9, -30); g.closePath(); }, head);
    ink(g, () => { g.beginPath(); g.moveTo(0, 30); g.lineTo(-10, 46); g.lineTo(-10, 34); g.closePath(); g.moveTo(0, 30); g.lineTo(10, 46); g.lineTo(10, 34); g.closePath(); }, feather, { hatch: false, lw: 3 });
  },
  heater(g, col = '#5a80d0', rim = '#e8c25a') {
    const p = (k) => () => { g.beginPath(); g.moveTo(-38 * k, -40 * k); g.lineTo(38 * k, -40 * k); g.lineTo(38 * k, 0); g.quadraticCurveTo(36 * k, 32 * k, 0, 48 * k); g.quadraticCurveTo(-36 * k, 32 * k, -38 * k, 0); g.closePath(); };
    ink(g, p(1), rim);
    ink(g, p(0.8), col);
  },
  roundShield(g, col = '#8a8aa0', rim = '#c9c9d6') {
    ink(g, () => { g.beginPath(); g.arc(0, 0, 44, 0, 7); }, rim);
    ink(g, () => { g.beginPath(); g.arc(0, 0, 34, 0, 7); }, col);
    ink(g, () => { g.beginPath(); g.arc(0, 0, 10, 0, 7); }, rim);
  },
  orb(g, col, r = 30) {
    glow(g, 0, 0, r * 1.9, col, 0.7);
    ink(g, () => { g.beginPath(); g.arc(0, 0, r, 0, 7); }, col, { hatch: false });
    g.save(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4 / SC; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, r * 0.68, 3.5, 4.5); g.stroke(); g.restore();
    g.save(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-r * 0.35, -r * 0.4, r * 0.14, 0, 7); g.fill(); g.restore();
  },
  flame(g, outer = '#ff7a2a', inner = '#ffd84a') {
    const f = (k, dy) => () => { g.beginPath(); g.moveTo(0, -46 * k + dy); g.bezierCurveTo(22 * k, -18 * k + dy, 34 * k, 4 * k + dy, 26 * k, 24 * k + dy); g.bezierCurveTo(18 * k, 44 * k + dy, -18 * k, 44 * k + dy, -26 * k, 24 * k + dy); g.bezierCurveTo(-34 * k, 4 * k + dy, -22 * k, -18 * k + dy, 0, -46 * k + dy); };
    ink(g, f(1, 0), outer, { hatch: false });
    ink(g, f(0.55, 14), inner, { hatch: false, lw: 3 });
  },
  heart(g, col = '#ff6fa8') {
    ink(g, () => { g.beginPath(); g.moveTo(0, 40); g.bezierCurveTo(-60, 0, -36, -52, 0, -22); g.bezierCurveTo(36, -52, 60, 0, 0, 40); g.closePath(); }, col);
    hl(g, [[-26, -18], [-18, -28]], 4);
  },
  star(g, col = '#ffe36a', R = 46, r = 20, n = 5) {
    ink(g, () => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }, col, { hatch: false });
  },
  sparkle(g, col = '#fff7c0', R = 46) { P.star(g, col, R, R * 0.22, 4); },
  burst(g, col = '#fff3a0', R = 50) {
    ink(g, () => { g.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, rr = i % 2 ? R * 0.62 : R; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }, col, { hatch: false, lw: 3 });
  },
  crescent(g, col = '#f0d27a') {
    ink(g, () => { g.beginPath(); g.arc(0, 0, 40, -1.2, 1.2, true); g.arc(14, 0, 37.3, 1.557, -1.557, false); g.closePath(); }, col);
  },
  bear(g, fire = false) {
    if (fire) for (let i = -1; i <= 1; i++) at(g, i * 20, -40, i * 0.3, 0.45, () => P.flame(g));
    for (const s of [-1, 1]) { ink(g, () => { g.beginPath(); g.arc(s * 28, -26, 13, 0, 7); }, '#6b4a36'); ink(g, () => { g.beginPath(); g.arc(s * 28, -26, 6, 0, 7); }, '#e0a3b0', { hatch: false, lw: 2.5 }); }
    ink(g, () => { g.beginPath(); g.ellipse(0, 4, 38, 34, 0, 0, 7); }, '#6b4a36');
    ink(g, () => { g.beginPath(); g.ellipse(0, 18, 16, 12, 0, 0, 7); }, '#d9b48f', { hatch: false });
    ink(g, () => { g.beginPath(); g.ellipse(0, 12, 6, 4, 0, 0, 7); }, '#2a1a14', { hatch: false, lw: 2 });
    ink(g, () => { g.beginPath(); g.arc(-14, -4, 7, 0, 7); }, '#2a2340', { hatch: false, lw: 2 });
    g.save(); g.strokeStyle = INK; g.lineWidth = 3.5 / SC; g.lineCap = 'round';
    g.beginPath(); g.moveTo(9, -10); g.lineTo(19, 0); g.moveTo(19, -10); g.lineTo(9, 0); g.stroke();
    g.lineWidth = 2 / SC; g.beginPath(); g.moveTo(-8, 28); g.lineTo(8, 28); for (let x = -6; x <= 6; x += 4) { g.moveTo(x, 25); g.lineTo(x, 31); } g.stroke(); g.restore();
  },
  fist(g, col = '#8d8174') {
    ink(g, () => { g.beginPath(); g.roundRect(-30, -14, 60, 50, 14); }, col);
    for (let i = 0; i < 4; i++) ink(g, () => { g.beginPath(); g.ellipse(-22 + i * 15, -16, 9, 12, 0, 0, 7); }, col);
    ink(g, () => { g.beginPath(); g.ellipse(-30, 10, 10, 16, 0.4, 0, 7); }, col);
  },
  rock(g, col = '#8d8174', seed = 3) {
    const r = rng(seed), pts = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = 30 + r() * 16; pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.85]); }
    ink(g, () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }, col);
    g.save(); g.strokeStyle = 'rgba(43,27,20,.6)'; g.lineWidth = 2 / SC; g.beginPath(); g.moveTo(-10, -20); g.lineTo(0, 0); g.lineTo(14, 8); g.moveTo(0, 0); g.lineTo(-6, 18); g.stroke(); g.restore();
  },
  bolt(g, col = '#ffe36a') {
    ink(g, () => { g.beginPath(); g.moveTo(8, -50); g.lineTo(-18, 4); g.lineTo(0, 4); g.lineTo(-10, 50); g.lineTo(22, -10); g.lineTo(4, -10); g.lineTo(18, -50); g.closePath(); }, col, { hatch: false });
  },
  crystal(g, col) {
    ink(g, () => { g.beginPath(); g.moveTo(0, -50); g.lineTo(24, -18); g.lineTo(18, 34); g.lineTo(0, 50); g.lineTo(-18, 34); g.lineTo(-24, -18); g.closePath(); }, col);
    g.save(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2 / SC;
    g.beginPath(); g.moveTo(0, -50); g.lineTo(0, 50); g.moveTo(-24, -18); g.lineTo(0, -6); g.lineTo(24, -18); g.stroke(); g.restore();
    hl(g, [[-14, -18], [-10, 26]], 3);
  },
  bottle(g, col = '#e05a5a') {
    ink(g, () => { g.beginPath(); g.roundRect(-10, -44, 20, 26, 4); }, '#d8e8f0', { hatch: false });
    ink(g, () => { g.beginPath(); g.roundRect(-13, -54, 26, 12, 4); }, '#a0704a', { hatch: false });
    ink(g, () => { g.beginPath(); g.arc(0, 12, 34, 0, 7); }, '#e8f4fa', { hatch: false });
    ink(g, () => { g.beginPath(); g.arc(0, 12, 28, 0.15, Math.PI - 0.15); g.closePath(); }, col, { lw: 2 });
    hl(g, [[-18, -2], [-12, -10]], 4);
  },
  boot(g, col = '#a07050', cuff = '#e8c25a') {
    ink(g, () => { g.beginPath(); g.moveTo(-22, -42); g.lineTo(10, -42); g.lineTo(12, 8); g.quadraticCurveTo(42, 10, 46, 28); g.lineTo(46, 42); g.lineTo(-24, 42); g.closePath(); }, col);
    ink(g, () => { g.beginPath(); g.roundRect(-26, -50, 40, 14, 5); }, cuff);
    ink(g, () => { g.beginPath(); g.rect(-24, 34, 70, 8); }, mix(col, -0.4), { hatch: false, flat: true });
    g.save(); g.strokeStyle = INK; g.lineWidth = 2 / SC; for (let y = -26; y < 4; y += 9) { g.beginPath(); g.moveTo(-4, y); g.lineTo(8, y + 4); g.stroke(); } g.restore();
  },
  book(g, col = '#7a8ae0') {
    ink(g, () => { g.beginPath(); g.moveTo(-34, -38); g.lineTo(30, -44); g.lineTo(36, 38); g.lineTo(-30, 44); g.closePath(); }, '#f6ecd6', { hatch: false });
    ink(g, () => { g.beginPath(); g.moveTo(-38, -44); g.lineTo(26, -50); g.lineTo(32, 32); g.lineTo(-32, 38); g.closePath(); }, col);
    ink(g, () => { g.beginPath(); g.arc(-3, -8, 12, 0, 7); }, '#e8c25a', { lw: 3 });
  },
  ring(g, col = '#e8c25a', gem = '#5ab0ff') {
    line(g, () => { g.beginPath(); g.ellipse(0, 10, 34, 30, 0, 0, 7); }, col, 10);
    at(g, 0, -24, 0, 0.45, () => P.crystal(g, gem));
  },
  hat(g, col = '#6a4ab0') {
    ink(g, () => { g.beginPath(); g.ellipse(0, 34, 52, 13, 0, 0, 7); }, mix(col, -0.2));
    ink(g, () => { g.beginPath(); g.moveTo(-32, 32); g.quadraticCurveTo(-10, -10, 2, -52); g.quadraticCurveTo(20, -30, 42, -40); g.quadraticCurveTo(24, -14, 32, 32); g.closePath(); }, col);
    ink(g, () => { g.beginPath(); g.moveTo(-30, 22); g.quadraticCurveTo(0, 14, 31, 22); g.lineTo(32, 30); g.quadraticCurveTo(0, 22, -31, 30); g.closePath(); }, '#e8c25a', { hatch: false, lw: 3 });
    at(g, 4, -6, 0, 0.22, () => P.star(g, '#fff7c0'));
  },
  hourglass(g) {
    ink(g, () => { g.beginPath(); g.moveTo(-26, -40); g.lineTo(26, -40); g.lineTo(3, 0); g.lineTo(26, 40); g.lineTo(-26, 40); g.lineTo(-3, 0); g.closePath(); }, '#e0f0f8', { hatch: false });
    ink(g, () => { g.beginPath(); g.moveTo(-14, 40); g.lineTo(0, 16); g.lineTo(14, 40); g.closePath(); g.moveTo(-10, -30); g.lineTo(10, -30); g.lineTo(0, -12); g.closePath(); }, '#f0c060', { hatch: false, lw: 2 });
    for (const y of [-46, 46]) ink(g, () => { g.beginPath(); g.roundRect(-34, y - 6, 68, 12, 4); }, '#c9a24a');
    for (const x of [-32, 32]) line(g, () => { g.beginPath(); g.moveTo(x, -40); g.lineTo(x, 40); }, '#c9a24a', 4);
  },
  chest(g, col = '#b0a080') {
    ink(g, () => { g.beginPath(); g.moveTo(-40, -30); g.quadraticCurveTo(-20, -42, -12, -42); g.quadraticCurveTo(0, -30, 12, -42); g.quadraticCurveTo(20, -42, 40, -30); g.lineTo(34, 10); g.quadraticCurveTo(30, 42, 0, 48); g.quadraticCurveTo(-30, 42, -34, 10); g.closePath(); }, col);
    g.save(); g.strokeStyle = 'rgba(43,27,20,.6)'; g.lineWidth = 2.5 / SC; g.beginPath(); g.moveTo(0, -30); g.lineTo(0, 44); g.moveTo(-28, 4); g.quadraticCurveTo(0, 14, 28, 4); g.stroke(); g.restore();
  },
  cloak(g, col = '#7aa0c0') {
    ink(g, () => { g.beginPath(); g.moveTo(-16, -44); g.quadraticCurveTo(0, -36, 16, -44); g.lineTo(40, 40); g.quadraticCurveTo(20, 30, 10, 46); g.quadraticCurveTo(0, 34, -10, 46); g.quadraticCurveTo(-20, 30, -40, 40); g.closePath(); }, col);
    ink(g, () => { g.beginPath(); g.arc(0, -40, 7, 0, 7); }, '#e8c25a', { lw: 3 });
  },
  mask(g, col = '#5ad0a0') {
    ink(g, () => { g.beginPath(); g.moveTo(0, -48); g.bezierCurveTo(44, -44, 40, 20, 0, 48); g.bezierCurveTo(-40, 20, -44, -44, 0, -48); g.closePath(); }, col);
    for (const s of [-1, 1]) ink(g, () => { g.beginPath(); g.ellipse(s * 15, -8, 10, 6, s * 0.3, 0, 7); }, '#2a1a14', { hatch: false, flat: true, lw: 3 });
    g.save(); g.strokeStyle = INK; g.lineWidth = 3 / SC; g.beginPath(); g.moveTo(-10, 22); g.quadraticCurveTo(0, 28, 10, 22); g.stroke(); g.restore();
  },
  fang(g, col = '#f4efe0') {
    ink(g, () => { g.beginPath(); g.moveTo(-26, -40); g.quadraticCurveTo(10, -44, 26, -40); g.quadraticCurveTo(14, 0, -4, 50); g.quadraticCurveTo(-10, 0, -26, -40); g.closePath(); }, col);
    hl(g, [[-12, -30], [-4, 16]], 3);
  },
  claw(g, col = '#6b5a64') {
    ink(g, () => { g.beginPath(); g.roundRect(-18, 6, 40, 36, 10); }, col);
    for (let i = 0; i < 3; i++) ink(g, () => { g.beginPath(); g.moveTo(-12 + i * 14, 8); g.quadraticCurveTo(-20 + i * 14, -24, -28 + i * 16, -46); g.quadraticCurveTo(-8 + i * 14, -26, 2 + i * 14, 8); g.closePath(); }, '#d0d6de');
  },
  net(g) {
    g.save(); g.beginPath(); g.arc(0, 0, 44, 0, 7); g.fillStyle = 'rgba(232,220,180,.35)'; g.fill(); g.clip();
    g.strokeStyle = INK; g.lineWidth = 5 / SC;
    for (let i = -60; i <= 60; i += 15) { g.beginPath(); g.moveTo(i - 40, -50); g.lineTo(i + 40, 50); g.moveTo(i + 40, -50); g.lineTo(i - 40, 50); g.stroke(); }
    g.strokeStyle = '#d8c9a0'; g.lineWidth = 2.5 / SC;
    for (let i = -60; i <= 60; i += 15) { g.beginPath(); g.moveTo(i - 40, -50); g.lineTo(i + 40, 50); g.moveTo(i + 40, -50); g.lineTo(i - 40, 50); g.stroke(); }
    g.restore();
    line(g, () => { g.beginPath(); g.arc(0, 0, 44, 0, 7); }, '#d8c9a0', 5);
    for (let i = 0; i < 6; i++) ink(g, () => { g.beginPath(); g.arc(Math.cos(i * 1.05) * 44, Math.sin(i * 1.05) * 44, 6, 0, 7); }, '#6a5a4a', { hatch: false, lw: 2.5 });
  },
  trap(g) {
    for (const s of [-1, 1]) {
      ink(g, () => { g.beginPath(); g.arc(0, s * 4, 40, s < 0 ? Math.PI : 0, s < 0 ? 2 * Math.PI : Math.PI); g.closePath(); }, '#6a5a7a');
      ink(g, () => { g.beginPath(); for (let i = 0; i < 7; i++) { const x = -34 + i * 11.3; g.lineTo(x, s * 4); g.lineTo(x + 5.6, s * -8 + s * 4); } g.lineTo(40, s * 4); g.closePath(); }, '#e8e8f0', { hatch: false, lw: 2.5 });
    }
    ink(g, () => { g.beginPath(); g.arc(0, 0, 9, 0, 7); }, '#e0b85a');
  },
  crosshair(g, col = '#ff4a4a') {
    line(g, () => { g.beginPath(); g.arc(0, 0, 36, 0, 7); }, col, 6);
    line(g, () => { g.beginPath(); g.arc(0, 0, 16, 0, 7); }, col, 4);
    line(g, () => { g.beginPath(); g.moveTo(0, -52); g.lineTo(0, -22); g.moveTo(0, 22); g.lineTo(0, 52); g.moveTo(-52, 0); g.lineTo(-22, 0); g.moveTo(22, 0); g.lineTo(52, 0); }, col, 5);
    ink(g, () => { g.beginPath(); g.arc(0, 0, 5, 0, 7); }, col, { hatch: false });
  },
  bullet(g) {
    ink(g, () => { g.beginPath(); g.moveTo(-10, 30); g.lineTo(-10, -12); g.quadraticCurveTo(0, -46, 10, -12); g.lineTo(10, 30); g.closePath(); }, '#ffd76a');
    ink(g, () => { g.beginPath(); g.rect(-11, 22, 22, 12); }, '#c9a24a', { hatch: false });
  },
  bird(g, col = '#bfe8ff') {
    ink(g, () => { g.beginPath(); g.moveTo(0, -10); g.quadraticCurveTo(-30, -40, -56, -30); g.quadraticCurveTo(-40, -20, -46, -10); g.quadraticCurveTo(-30, -12, -24, 0); g.quadraticCurveTo(-12, 4, -8, 22); g.lineTo(0, 40); g.lineTo(8, 22); g.quadraticCurveTo(12, 4, 24, 0); g.quadraticCurveTo(30, -12, 46, -10); g.quadraticCurveTo(40, -20, 56, -30); g.quadraticCurveTo(30, -40, 0, -10); g.closePath(); }, col);
    ink(g, () => { g.beginPath(); g.moveTo(0, -24); g.lineTo(6, -12); g.lineTo(-6, -12); g.closePath(); }, '#f0b030', { hatch: false, lw: 2.5 });
    g.save(); g.fillStyle = INK; g.beginPath(); g.arc(0, -8, 2.5, 0, 7); g.fill(); g.restore();
  },
  tails(g, col = '#f7efe6') {
    for (let i = -2; i <= 2; i++) at(g, 0, 36, i * 0.42, 1, () => {
      ink(g, () => { g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(-26, -40, -4, -72); g.quadraticCurveTo(22, -40, 8, 0); g.closePath(); }, col);
      ink(g, () => { g.beginPath(); g.moveTo(-10, -52); g.quadraticCurveTo(-8, -64, -4, -72); g.quadraticCurveTo(6, -62, 10, -50); g.quadraticCurveTo(0, -46, -10, -52); g.closePath(); }, '#ff9ab8', { hatch: false, lw: 3 });
    });
  },
  swirl(g, col = '#ffffff', r = 40) {
    for (let i = 0; i < 3; i++) line(g, () => { g.beginPath(); g.arc(0, 0, r - i * 4, i * 2.1, i * 2.1 + 1.5); }, col, 5 - i);
  },
  cross(g, col = '#6ad06a') {
    ink(g, () => { g.beginPath(); g.moveTo(-12, -42); g.lineTo(12, -42); g.lineTo(12, -12); g.lineTo(42, -12); g.lineTo(42, 12); g.lineTo(12, 12); g.lineTo(12, 42); g.lineTo(-12, 42); g.lineTo(-12, 12); g.lineTo(-42, 12); g.lineTo(-42, -12); g.lineTo(-12, -12); g.closePath(); }, col);
  },
  leaf(g, col = '#6ab356') {
    ink(g, () => { g.beginPath(); g.moveTo(-40, 30); g.quadraticCurveTo(-40, -30, 40, -38); g.quadraticCurveTo(34, 34, -40, 30); g.closePath(); }, col);
    g.save(); g.strokeStyle = 'rgba(43,27,20,.6)'; g.lineWidth = 2.5 / SC; g.beginPath(); g.moveTo(-36, 26); g.quadraticCurveTo(0, 0, 34, -32); g.stroke(); g.restore();
  },
  sun(g, col = '#ffb030') {
    ink(g, () => { g.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, rr = i % 2 ? 36 : 52; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }, '#ff7a2a', { hatch: false });
    ink(g, () => { g.beginPath(); g.arc(0, 0, 28, 0, 7); }, col);
  },
  snowflake(g, col = '#e6f7ff') {
    for (let i = 0; i < 3; i++) at(g, 0, 0, i * Math.PI / 3, 1, () => {
      line(g, () => { g.beginPath(); g.moveTo(0, -44); g.lineTo(0, 44); for (const y of [-26, 26]) { const s = Math.sign(y); g.moveTo(0, y); g.lineTo(-12, y - s * 12); g.moveTo(0, y); g.lineTo(12, y - s * 12); } }, col, 4);
    });
  },
  wing(g, col = '#ffffff') {
    ink(g, () => { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-20, -40, -52, -40); g.quadraticCurveTo(-40, -30, -50, -20); g.quadraticCurveTo(-36, -16, -44, -4); g.quadraticCurveTo(-30, -2, -34, 10); g.quadraticCurveTo(-16, 8, 0, 0); g.closePath(); }, col);
  },
  staff(g, col = '#f4f1ea') {
    line(g, () => { g.beginPath(); g.moveTo(0, 52); g.lineTo(0, -26); }, col, 6);
  },
  meditate(g, col = '#e0ffc0') {
    ink(g, () => { g.beginPath(); g.arc(0, -30, 13, 0, 7); }, col);
    ink(g, () => { g.beginPath(); g.moveTo(0, -16); g.quadraticCurveTo(22, -12, 18, 14); g.quadraticCurveTo(46, 22, 40, 36); g.lineTo(-40, 36); g.quadraticCurveTo(-46, 22, -18, 14); g.quadraticCurveTo(-22, -12, 0, -16); g.closePath(); }, col);
    for (const s of [-1, 1]) line(g, () => { g.beginPath(); g.moveTo(s * 14, -6); g.quadraticCurveTo(s * 32, 6, s * 20, 20); }, col, 5);
  },
  spikes(g, col = '#6a8a5a') {
    for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.95 + i * Math.PI * 0.95 / 3; at(g, Math.cos(a) * 36, Math.sin(a) * 36, a + Math.PI / 2, 1, () => ink(g, () => { g.beginPath(); g.moveTo(-7, 6); g.lineTo(0, -16); g.lineTo(7, 6); g.closePath(); }, '#dfe6ee', { hatch: false, lw: 3 })); }
    P.chest(g, col);
  },
  drop(g, col = '#d02030') {
    ink(g, () => { g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(22, 4, 14, 18); g.quadraticCurveTo(0, 32, -14, 18); g.quadraticCurveTo(-22, 4, 0, -30); g.closePath(); }, col, { hatch: false });
    hl(g, [[-6, 4], [-4, 14]], 3);
  },
  slashArc(g, col = '#ffffff', r = 44, a0 = -2.4, a1 = 0.4) {
    g.save(); g.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const t0 = a0 + (a1 - a0) * i / 12, t1 = a0 + (a1 - a0) * (i + 1) / 12, w = 2 + 12 * Math.sin((i + 0.5) / 12 * Math.PI);
      g.strokeStyle = INK; g.lineWidth = w + 5; g.beginPath(); g.arc(0, 0, r, t0, t1); g.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const t0 = a0 + (a1 - a0) * i / 12, t1 = a0 + (a1 - a0) * (i + 1) / 12, w = 2 + 12 * Math.sin((i + 0.5) / 12 * Math.PI);
      g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, t0 - 0.01, t1 + 0.01); g.stroke();
    }
    g.restore();
  },
  beam(g, col = '#fff38a') {
    glow(g, 0, 0, 70, col, 0.5);
    ink(g, () => { g.beginPath(); g.moveTo(-70, -14); g.lineTo(70, -20); g.lineTo(70, 20); g.lineTo(-70, 14); g.closePath(); }, col, { hatch: false });
    ink(g, () => { g.beginPath(); g.moveTo(-70, -5); g.lineTo(70, -7); g.lineTo(70, 7); g.lineTo(-70, 5); g.closePath(); }, '#ffffff', { hatch: false, lw: 1.5 });
  },
  chainLinks(g, col = '#b8c2cc', n = 4) {
    for (let i = 0; i < n; i++) at(g, 0, -i * 18, i % 2 ? 0 : Math.PI / 2, 1, () => line(g, () => { g.beginPath(); g.ellipse(0, 0, 12, 7, 0, 0, 7); }, col, 4));
  },
};

// ---------- 技能图标 ----------
const SKILL = {
  garenQ(g) { speed(g, '#ffe27a', 4, 8, 36, 64, 14); at(g, 66, 62, 0.78, 0.9, () => P.sword(g)); at(g, 100, 24, 0, 0.32, () => P.burst(g, '#fff3a0')); },
  garenW(g) { glow(g, 64, 64, 60, '#ffe27a', 0.7); at(g, 64, 66, 0, 0.9, () => P.heater(g)); at(g, 64, 58, 0, 0.3, () => P.star(g, '#e8c25a')); },
  garenE(g) { at(g, 64, 64, 0, 1, () => P.swirl(g, '#eaf2ff', 50)); at(g, 64, 64, Math.PI / 2 + 0.3, 0.72, () => P.sword(g)); at(g, 64, 64, 2.4, 0.9, () => P.slashArc(g, '#dfe8ff', 40, -1, 1)); },
  garenR(g) {
    g.save(); g.globalAlpha = 0.5; g.fillStyle = '#fff7c0';
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(64 + i * 8, 0); g.lineTo(64 + i * 30 - 12, 128); g.lineTo(64 + i * 30 + 12, 128); g.closePath(); g.fill(); }
    g.restore();
    at(g, 64, 110, 0, 0.5, () => P.burst(g, '#ffe27a'));
    at(g, 64, 58, Math.PI, 1.0, () => P.sword(g, '#fff4c0', '#e8c25a'));
  },
  dariusQ(g) { at(g, 64, 64, 0, 1, () => P.slashArc(g, '#ff5a5a', 48, -0.5, 4.8)); at(g, 64, 66, -0.5, 0.8, () => P.axe(g)); },
  dariusW(g) { at(g, 60, 60, 0.6, 0.9, () => P.axe(g)); at(g, 30, 96, 0, 0.5, () => P.drop(g)); at(g, 50, 110, 0, 0.35, () => P.drop(g)); },
  dariusE(g) { at(g, 96, 90, 0.5, 0.9, () => P.chainLinks(g, '#9aa3ad', 4)); at(g, 54, 54, -0.7, 0.85, () => P.claw(g)); },
  dariusR(g) { glow(g, 64, 64, 64, '#ff3a3a', 0.7); at(g, 64, 64, 0, 0.62, () => P.burst(g, '#b3262e', 52)); at(g, 62, 62, -0.2, 0.95, () => P.axe(g, '#c8d0d8', '#3a2a22', '#d02030')); },
  asheQ(g) { at(g, 58, 64, 0, 0.85, () => P.bow(g)); for (let i = 0; i < 3; i++) { const a = i * 2.1 - 0.6; at(g, 64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40, a + Math.PI, 0.35, () => P.arrow(g, '#9fdcff')); } },
  asheW(g) { for (let i = -3; i <= 3; i++) at(g, 64 + i * 3, 108, i * 0.22, 0.75, () => at(g, 0, -40, 0, 1, () => P.arrow(g, '#bfe8ff'))); },
  asheE(g) { glow(g, 64, 60, 60, '#9fdcff', 0.6); at(g, 64, 60, 0, 1.05, () => P.bird(g)); },
  asheR(g) { glow(g, 64, 64, 64, '#7fd0ff', 0.7); at(g, 64, 64, 0.8, 1.1, () => P.arrow(g, '#e6f7ff', '#9fdcff', '#7fd0ff')); for (const [x, y] of [[30, 30], [98, 96], [100, 30]]) at(g, x, y, 0.3, 0.28, () => P.crystal(g, '#bfe8ff')); },
  caitlynQ(g) { at(g, 64, 64, -0.7, 1, () => { glow(g, 0, 0, 50, '#ffe27a', 0.5); line(g, () => { g.beginPath(); g.moveTo(0, 60); g.lineTo(0, -10); }, '#fff3a0', 10); at(g, 0, -26, 0, 0.9, () => P.bullet(g)); }); },
  caitlynW(g) { at(g, 64, 66, 0, 1, () => P.trap(g)); },
  caitlynE(g) { at(g, 64, 64, 0.3, 1, () => P.net(g)); },
  caitlynR(g) { at(g, 64, 64, 0, 1.05, () => P.crosshair(g)); },
  ahriQ(g) { at(g, 64, 64, 0, 1, () => P.swirl(g, '#ffb0e0', 50)); at(g, 64, 64, 0, 1, () => P.orb(g, '#7fb7ff', 28)); },
  ahriW(g) { for (const [x, y] of [[64, 30], [32, 88], [96, 88]]) at(g, x, y, 0, 0.5, () => { glow(g, 0, 0, 50, '#6ab0ff', 0.6); P.flame(g, '#4a90ff', '#c8e8ff'); }); },
  ahriE(g) { glow(g, 64, 64, 60, '#ff8ac0', 0.6); at(g, 64, 66, -0.15, 1, () => P.heart(g)); at(g, 100, 28, 0, 0.3, () => P.sparkle(g)); at(g, 26, 34, 0, 0.2, () => P.sparkle(g)); },
  ahriR(g) { speed(g, '#ffb0e0', 3, 6, 30, 90, 12); at(g, 64, 70, 0, 0.85, () => P.tails(g)); },
  luxQ(g) { at(g, 64, 64, 0, 1, () => P.orb(g, '#fff38a', 26)); for (const r of [0.4, -0.5]) at(g, 64, 64, r, 1, () => line(g, () => { g.beginPath(); g.ellipse(0, 0, 50, 16, 0, 0, 7); }, '#fffbd0', 4)); },
  luxW(g) { glow(g, 64, 64, 60, '#bfe0ff', 0.6); at(g, 64, 64, 0, 1, () => line(g, () => { g.beginPath(); g.arc(0, 0, 46, 3.6, 5.8); }, '#e0f0ff', 7)); at(g, 64, 70, 0.7, 0.85, () => { P.staff(g); at(g, 0, -34, 0, 0.35, () => P.crystal(g, '#fff38a')); }); },
  luxE(g) { glow(g, 64, 64, 64, '#fff38a', 0.8); at(g, 64, 64, 0, 1, () => line(g, () => { g.beginPath(); g.arc(0, 0, 40, 0, 7); }, '#fffbd0', 4)); at(g, 64, 64, 0.4, 0.8, () => P.sparkle(g, '#fffbd0', 44)); },
  luxR(g) { at(g, 64, 64, -0.4, 1, () => P.beam(g)); at(g, 22, 84, 0, 0.35, () => P.sparkle(g)); },
  annieQ(g) { speed(g, '#ffb040', 3, 10, 30, 76, 12); at(g, 70, 56, -0.8, 1, () => { glow(g, 0, 0, 50, '#ff8a30', 0.6); P.flame(g); }); },
  annieW(g) { for (let i = -1; i <= 1; i++) at(g, 64 + i * 30, 70 - Math.abs(i) * 6, i * 0.4, 0.62 - Math.abs(i) * 0.1, () => P.flame(g)); },
  annieE(g) { for (let i = 0; i < 6; i++) { const a = i * 1.05; at(g, 64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44, a + Math.PI / 2, 0.32, () => P.flame(g)); } at(g, 64, 64, 0, 0.8, () => P.roundShield(g, '#ff9a40', '#c86a20')); },
  annieR(g) { glow(g, 64, 64, 60, '#ff8a30', 0.6); at(g, 64, 70, 0, 1, () => P.bear(g, true)); },
  yiQ(g) { for (let i = 0; i < 3; i++) at(g, 44 + i * 20, 64 + (i % 2 ? -12 : 12), 0.5 + i * 0.6, 0.75, () => P.slashArc(g, '#c8ff8a', 40, -2, 0)); },
  yiW(g) { glow(g, 64, 70, 60, '#c8ff8a', 0.7); at(g, 64, 72, 0, 1, () => P.meditate(g)); },
  yiE(g) { glow(g, 64, 64, 60, '#ffe27a', 0.8); at(g, 64, 64, 0.6, 0.95, () => P.sword(g, '#fff4c0', '#c9a24a', '#2a2020')); },
  yiR(g) { glow(g, 64, 64, 64, '#c88aff', 0.7); speed(g, '#e0c0ff', 5, 6, 40, 20, 20); at(g, 70, 64, 0.8, 0.85, () => P.sword(g, '#f0e0ff', '#9a5ad0', '#2a2020')); },
  malphiteQ(g) { speed(g, '#ffb347', 4, 6, 36, 34, 18); at(g, 80, 60, 0.3, 0.8, () => P.rock(g, '#8d8174', 5)); },
  malphiteW(g) { at(g, 64, 70, 0, 0.9, () => P.fist(g)); at(g, 30, 36, 0.2, 0.45, () => P.bolt(g)); at(g, 100, 34, -0.2, 0.4, () => P.bolt(g)); },
  malphiteE(g) {
    g.save(); g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(8, 108); g.lineTo(120, 108); g.stroke();
    g.lineWidth = 3; for (const d of [-1, 1]) { g.beginPath(); g.moveTo(64, 108); g.lineTo(64 + d * 20, 118); g.lineTo(64 + d * 36, 114); g.moveTo(64, 108); g.lineTo(64 + d * 30, 124); g.stroke(); } g.restore();
    at(g, 64, 64, Math.PI, 0.85, () => P.fist(g)); for (const [x, y] of [[20, 90], [108, 86], [30, 70]]) at(g, x, y, x, 0.18, () => P.rock(g, '#b0a090', x));
  },
  malphiteR(g) { speed(g, '#ffb347', 5, 4, 40, 24, 18); at(g, 78, 64, 0, 1, () => { P.burst(g, '#ffb347', 50); P.rock(g, '#8d8174', 9); }); },
  sorakaQ(g) { speed(g, '#fff7b0', 4, 10, 30, 20, 12); at(g, 72, 72, 0, 0.9, () => { glow(g, 0, 0, 50, '#ffe36a', 0.7); P.star(g); }); },
  sorakaW(g) { glow(g, 64, 64, 60, '#7dff9a', 0.7); at(g, 64, 64, 0, 0.8, () => P.cross(g, '#6ad06a')); at(g, 98, 30, 0, 0.3, () => P.sparkle(g)); },
  sorakaE(g) { at(g, 64, 64, 0, 1, () => { line(g, () => { g.beginPath(); g.arc(0, 0, 46, 0, 7); }, '#c8a0ff', 6); line(g, () => { g.beginPath(); g.arc(0, 0, 34, 0, 7); }, '#ffe36a', 3); }); at(g, 64, 64, 0, 0.55, () => P.star(g, '#e0c8ff')); },
  sorakaR(g) { glow(g, 64, 64, 64, '#fff7b0', 0.8); at(g, 60, 64, 0, 1, () => P.crescent(g)); for (const [x, y, s] of [[96, 34, 0.25], [100, 88, 0.2], [30, 24, 0.18]]) at(g, x, y, 0, s, () => P.star(g)); },
  D(g) { glow(g, 64, 64, 64, '#fff7b0', 0.9); at(g, 64, 64, 0.3, 1, () => P.sparkle(g, '#fff7c0', 50)); at(g, 100, 30, 0, 0.25, () => P.sparkle(g)); at(g, 28, 98, 0, 0.2, () => P.sparkle(g)); },
  F(g) { at(g, 40, 88, -0.4, 0.5, () => P.leaf(g)); at(g, 90, 90, 0.8, 0.45, () => P.leaf(g)); at(g, 64, 56, 0, 0.75, () => P.cross(g, '#8fe87a')); },
  // ---------- 召唤师技能 ----------
  S_flash(g) { SKILL.D(g); },
  S_heal(g) { SKILL.F(g); },
  S_barrier(g) { glow(g, 64, 64, 60, '#ffe27a', 0.8); at(g, 64, 64, 0, 1, () => { line(g, () => { g.beginPath(); g.arc(0, 0, 42, 0, 7); }, '#fff3b0', 6); line(g, () => { g.beginPath(); g.arc(0, 0, 32, 3.6, 5.9); }, '#ffffff', 3); }); at(g, 64, 66, 0, 0.55, () => P.heater(g, '#ffd76a', '#c8963a')); },
  S_ghost(g) {
    speed(g, '#d8c0ff', 4, 6, 34, 34, 18);
    at(g, 76, 62, 0, 1, () => ink(g, () => { g.beginPath(); g.moveTo(-24, 40); g.lineTo(-24, -10); g.bezierCurveTo(-24, -46, 24, -46, 24, -10); g.lineTo(24, 40); g.lineTo(14, 30); g.lineTo(4, 40); g.lineTo(-6, 30); g.lineTo(-14, 40); g.closePath(); }, '#f4efff'));
    for (const s of [-1, 1]) { g.save(); g.fillStyle = INK; g.beginPath(); g.ellipse(76 + s * 9, 54, 4, 6, 0, 0, 7); g.fill(); g.restore(); }
  },
  S_ignite(g) { glow(g, 64, 70, 60, '#ff6a2a', 0.8); at(g, 64, 68, 0, 1.05, () => P.flame(g, '#ff4a1a', '#ffd84a')); for (const [x, y] of [[26, 30], [100, 36], [96, 100]]) at(g, x, y, 0, 0.16, () => P.sparkle(g, '#ffd060')); },
  S_exhaust(g) {
    at(g, 64, 64, 0, 1, () => P.swirl(g, '#d0d0e8', 46));
    at(g, 64, 64, 0, 1, () => ink(g, () => { g.beginPath(); g.moveTo(-8, -30); g.lineTo(8, -30); g.lineTo(8, 8); g.lineTo(22, 8); g.lineTo(0, 36); g.lineTo(-22, 8); g.lineTo(-8, 8); g.closePath(); }, '#a8a8c8'));
  },
  S_cleanse(g) { glow(g, 64, 64, 60, '#bff0ff', 0.8); at(g, 64, 64, 0.785, 0.7, () => P.cross(g, '#e6fbff')); for (const [x, y, r] of [[30, 34, 8], [98, 30, 6], [96, 96, 9], [34, 98, 5]]) { g.save(); g.strokeStyle = INK; g.lineWidth = 2.5; g.fillStyle = 'rgba(230,251,255,.8)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); g.restore(); } },
  S_teleport(g) {
    glow(g, 64, 84, 60, '#b58aff', 0.8);
    at(g, 64, 92, 0, 1, () => { for (const [r, c] of [[46, '#8a4ad0'], [32, '#c8a0ff'], [18, '#ffffff']]) line(g, () => { g.beginPath(); g.ellipse(0, 0, r, r * 0.34, 0, 0, 7); }, c, 5); });
    at(g, 64, 50, 0, 0.9, () => ink(g, () => { g.beginPath(); g.moveTo(0, -36); g.lineTo(24, -6); g.lineTo(9, -6); g.lineTo(9, 30); g.lineTo(-9, 30); g.lineTo(-9, -6); g.lineTo(-24, -6); g.closePath(); }, '#e0c8ff'));
  },
  S_smite(g) { glow(g, 64, 64, 64, '#ffb040', 0.8); at(g, 64, 64, 0, 0.55, () => P.burst(g, '#ffd060', 52)); at(g, 64, 62, 0.15, 1.05, () => P.bolt(g, '#fff3a0')); },
};

// ---------- 装备图标 ----------
const ITEM = {
  potion(g) { at(g, 64, 66, 0, 0.95, () => P.bottle(g)); },
  longsword(g) { at(g, 64, 64, 0.78, 0.95, () => P.sword(g)); },
  dagger(g) { at(g, 64, 64, 0.78, 0.7, () => P.sword(g, '#e4ecf4', '#8a5a3c', '#3a2a22')); },
  doranblade(g) { at(g, 70, 58, 0.78, 0.85, () => P.sword(g, '#e4ecf4', '#c07a4a')); at(g, 36, 92, 0, 0.42, () => P.roundShield(g, '#c07a4a', '#e8c25a')); },
  ie(g) { glow(g, 64, 64, 64, '#ffe27a', 0.6); at(g, 64, 64, 0.78, 1.0, () => P.sword(g, '#fff4c0', '#e8c25a', '#7a3a20')); at(g, 64, 64, 0, 0.2, () => P.crystal(g, '#ff5a5a')); },
  bloodthirster(g) { at(g, 64, 60, 0.78, 0.95, () => P.sword(g, '#f0a0a0', '#8a1a20', '#2a1a14')); at(g, 30, 100, 0, 0.5, () => P.drop(g)); },
  trinity(g) { at(g, 64, 64, 0, 1, () => line(g, () => { g.beginPath(); g.moveTo(0, -40); g.lineTo(36, 26); g.lineTo(-36, 26); g.closePath(); }, '#e8c25a', 6)); for (const [x, y, c] of [[64, 24, '#ff5a5a'], [100, 90, '#5ab0ff'], [28, 90, '#b58aff']]) at(g, x, y, 0, 0.36, () => P.crystal(g, c)); },
  runaan(g) { at(g, 64, 64, 0, 1, () => P.swirl(g, '#bff0dc', 50)); at(g, 60, 64, 0.2, 0.8, () => P.bow(g, '#5ab89a')); },
  tome(g) { at(g, 64, 64, 0, 0.95, () => P.book(g, '#7a8ae0')); },
  doranring(g) { at(g, 64, 70, 0, 0.9, () => P.ring(g)); },
  bluecrystal(g) { glow(g, 64, 64, 56, '#5ab0ff', 0.6); at(g, 64, 64, 0.2, 0.95, () => P.crystal(g, '#4a8ae0')); },
  rabadon(g) { at(g, 64, 66, 0, 0.95, () => P.hat(g)); },
  rylai(g) { at(g, 64, 70, 0.4, 1, () => { P.staff(g, '#dfe8f0'); at(g, 0, -34, 0, 0.5, () => P.snowflake(g)); }); },
  archangel(g) { glow(g, 64, 50, 50, '#bfe8ff', 0.6); at(g, 64, 50, 0, 0.8, () => { P.wing(g); g.scale(-1, 1); P.wing(g); }); at(g, 64, 76, 0, 0.85, () => { P.staff(g, '#e8c25a'); at(g, 0, -30, 0, 0.35, () => P.crystal(g, '#5ac0e0')); }); },
  nashor(g) { glow(g, 64, 64, 60, '#b58aff', 0.6); at(g, 64, 64, 0.2, 0.95, () => P.fang(g)); },
  zhonya(g) { glow(g, 64, 64, 60, '#ffe27a', 0.5); at(g, 64, 64, 0, 0.95, () => P.hourglass(g)); },
  ruby(g) { glow(g, 64, 64, 56, '#ff5a5a', 0.6); at(g, 64, 64, -0.2, 0.95, () => P.crystal(g, '#e04040')); },
  cloth(g) { at(g, 64, 64, 0, 0.95, () => P.chest(g)); },
  cloak(g) { at(g, 64, 64, 0, 0.95, () => P.cloak(g)); },
  warmog(g) { glow(g, 64, 64, 60, '#7dff7a', 0.6); at(g, 64, 66, 0, 1, () => P.heart(g, '#5ab05a')); at(g, 64, 60, 0, 0.35, () => P.cross(g, '#e8ffe0')); },
  sunfire(g) { at(g, 64, 64, 0, 1, () => P.sun(g)); },
  randuin(g) { at(g, 64, 64, 0, 0.95, () => P.roundShield(g, '#8a8aa0', '#b8b8c8')); at(g, 64, 40, 0, 0.4, () => P.crescent(g, '#f4efe0')); },
  spirit(g) { glow(g, 64, 64, 60, '#7dffd0', 0.5); at(g, 30, 50, -0.9, 0.5, () => P.leaf(g, '#3f8a52')); at(g, 98, 50, Math.PI + 0.9, 0.5, () => P.leaf(g, '#3f8a52')); at(g, 64, 66, 0, 0.85, () => P.mask(g, '#e8d8a0')); at(g, 64, 38, 0, 0.26, () => P.crystal(g, '#5ad0a0')); },
  thornmail(g) { at(g, 64, 70, 0, 0.85, () => P.spikes(g)); },
  boots(g) { at(g, 60, 64, 0, 0.9, () => P.boot(g)); },
  zerker(g) { at(g, 56, 66, 0, 0.85, () => P.boot(g, '#b85a40', '#e8c25a')); at(g, 98, 36, 0.8, 0.45, () => P.sword(g)); },
  lucidity(g) { glow(g, 64, 64, 56, '#bfe0ff', 0.5); at(g, 60, 66, 0, 0.85, () => P.boot(g, '#5a80c0', '#fff7c0')); at(g, 100, 30, 0, 0.28, () => P.sparkle(g)); },
  mercs(g) { at(g, 60, 70, 0, 0.8, () => P.boot(g, '#a0a8c0', '#c9c9d6')); at(g, 42, 40, 0.3, 0.55, () => P.wing(g)); },
  ninja(g) { at(g, 60, 66, 0, 0.88, () => P.boot(g, '#7a7a80', '#b8b8c0')); for (const [x, y] of [[48, 44], [48, 60], [48, 76]]) { g.save(); g.fillStyle = '#e0e0e8'; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); g.stroke(); g.restore(); } },
};

function paint(draw, bg, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  background(g, bg, seed);
  SC = 1;
  draw(g);
  // 内描边 + 纸边
  g.strokeStyle = 'rgba(43,27,20,.55)'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, S - 5, S - 5);
  return c.toDataURL();
}
let seedN = 11;
export function skillArt(key, bg) { const f = SKILL[key]; return f ? paint(f, bg, seedN++) : null; }
export function itemArt(id, color) { const f = ITEM[id]; return f ? paint(f, blend(color, '#4a3a4a', 0.45), seedN++) : null; }
