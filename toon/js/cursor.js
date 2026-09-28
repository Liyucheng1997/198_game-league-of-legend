// 鼠标指针：用 Canvas 画一只手绘风的金色护手，指尖是点击点。
import { INK } from './toon-kit.js';

function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// 返回 CSS cursor 值
function drawHand(light, dark, grab = false) {
  const S = 48, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(24, 24); g.rotate(-0.44); g.scale(0.84, 0.84); g.translate(-24, -24);
  const grad = g.createLinearGradient(8, 4, 40, 46);
  grad.addColorStop(0, light); grad.addColorStop(1, dark);
  // 各部件：食指、三根弯曲的手指、拇指、手掌、护腕
  const parts = [
    () => grab ? rr(g, 14, 12, 9, 14, 4.5) : rr(g, 14, 1, 9, 25, 4.5),
    () => rr(g, 22, 13, 8, 12, 4),
    () => rr(g, 29, 15, 7, 12, 3.5),
    () => rr(g, 35, 18, 6, 11, 3),
    () => { g.beginPath(); g.ellipse(12, 30, 5, 8, -0.6, 0, Math.PI * 2); },
    () => rr(g, 13, 20, 28, 20, 8),
    () => rr(g, 16, 38, 23, 9, 3),
  ];
  g.lineJoin = 'round';
  // 先整体描粗墨线，再上色，得到只有外轮廓的描边
  g.strokeStyle = INK; g.lineWidth = 4.5;
  for (const p of parts) { p(); g.stroke(); }
  for (const p of parts) { p(); g.fillStyle = grad; g.fill(); }
  // 关节纹路与高光
  g.strokeStyle = 'rgba(43,27,20,.55)'; g.lineWidth = 1.4;
  for (const [x, y, w] of [[22, 22, 7], [29, 24, 6], [35, 26, 5]]) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + w, y); g.stroke(); }
  g.beginPath(); g.moveTo(16, 42.5); g.lineTo(38, 42.5); g.stroke();
  if (!grab) { g.beginPath(); g.moveTo(15.5, 11); g.lineTo(22, 11); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(16.5, grab ? 15 : 5); g.lineTo(16.5, grab ? 20 : 17); g.stroke();
  g.beginPath(); g.moveTo(17, 25); g.quadraticCurveTo(22, 23, 27, 25); g.stroke();
  // 护腕宝石
  g.fillStyle = '#5ab0ff'; g.strokeStyle = INK; g.lineWidth = 1.5;
  g.beginPath(); g.arc(27.5, 42.5, 2.6, 0, Math.PI * 2); g.fill(); g.stroke();
  // 指尖（食指顶端）在画布上的位置：绕中心旋转、缩放后的坐标
  return `url(${c.toDataURL()}) 11 8, auto`;
}

let CUR = null, current = '';
export function initCursors() {
  CUR = {
    normal: drawHand('#fbe6a0', '#c8923a'),
    attack: drawHand('#ffb0a0', '#c0302a'),
    ally: drawHand('#c8f0b0', '#4a9a4a'),
    grab: drawHand('#fbe6a0', '#c8923a', true),
  };
  setCursor('normal');
  // 按下鼠标时手指收拢成“抓握”
  addEventListener('mousedown', () => { if (current === 'normal') apply(CUR.grab); });
  addEventListener('mouseup', () => apply(CUR[current]));
}
function apply(v) { document.documentElement.style.setProperty('--cur', v); }
export function setCursor(kind) {
  if (!CUR || kind === current) return;
  current = kind;
  apply(CUR[kind]);
}
