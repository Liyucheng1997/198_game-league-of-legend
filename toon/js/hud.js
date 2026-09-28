// 抬头显示：手绘血条、伤害数字、技能栏、小地图、击杀播报。
import * as THREE from 'three';
import { HALF } from './map.js';
import { TEAM_COL } from './props.js';

const INK = '#2b1b14';
const v3 = new THREE.Vector3();

function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}

// 技能图标：水彩圆 + 毛笔字
export function skillIcon(color, glyph, size = 96) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size * 0.35, size * 0.3, 4, size / 2, size / 2, size * 0.7);
  gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.35, color); gr.addColorStop(1, shade(color, -0.45));
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  g.globalAlpha = 0.18; g.strokeStyle = '#fff'; g.lineWidth = 3;
  for (let i = -size; i < size * 2; i += 9) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - size, size); g.stroke(); }
  g.globalAlpha = 1;
  g.font = `900 ${size * 0.56}px "KaiTi","STKaiti","Microsoft YaHei",serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = size * 0.1; g.strokeStyle = INK; g.lineJoin = 'round';
  g.strokeText(glyph, size / 2, size * 0.54); g.fillStyle = '#fffaf0'; g.fillText(glyph, size / 2, size * 0.54);
  return c.toDataURL();
}
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (x) => Math.max(0, Math.min(255, Math.round(k < 0 ? x * (1 + k) : x + (255 - x) * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export class Overlay {
  constructor(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.c.width = innerWidth * dpr; this.c.height = innerHeight * dpr;
    this.c.style.width = innerWidth + 'px'; this.c.style.height = innerHeight + 'px';
  }
  clear() { this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.g.clearRect(0, 0, innerWidth, innerHeight); }
  project(camera, x, y, z) {
    v3.set(x, y, z).project(camera);
    if (v3.z > 1) return null;
    return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight };
  }
  draw(world, camera, player, showcase = false) {
    this.clear();
    const g = this.g;
    for (const u of world.units) {
      if (u.dead || u.removed || (u.obj && !u.obj.visible) || u.kind === 'dummy' && false) continue;
      const p = this.project(camera, u.pos.x, u.height + 0.55 + (u.lift || 0), u.pos.z);
      if (!p || p.x < -80 || p.y < -40 || p.x > innerWidth + 80 || p.y > innerHeight + 40) continue;
      const hero = u.kind === 'hero', big = u.isStructure || (u.kind === 'monster' && u.big);
      const w = hero ? 92 : big ? 110 : u.kind === 'pet' ? 70 : u.kind === 'dummy' ? 80 : 42;
      const h = hero ? 11 : big ? 10 : 6;
      const x = p.x - w / 2, y = p.y - h / 2;
      if (showcase && hero) {
        g.font = '900 15px "KaiTi","STKaiti","Microsoft YaHei",serif'; g.textAlign = 'center';
        g.lineWidth = 5; g.strokeStyle = INK; g.strokeText(u.name, p.x, p.y); g.fillStyle = '#fffaf0'; g.fillText(u.name, p.x, p.y);
        continue;
      }
      const ally = player && u.team === player.team;
      const col = u === player ? '#6fd46a' : u.team === 0 ? '#e8b04a' : ally ? '#5aa0ff' : '#ff5a4a';
      g.lineJoin = 'round';
      rrect(g, x - 2, y - 2, w + 4, h + 4, 5); g.fillStyle = INK; g.fill();
      rrect(g, x, y, w, h, 3); g.fillStyle = '#4a3a30'; g.fill();
      const k = Math.max(0, u.hp / u.maxHp);
      if (k > 0) { rrect(g, x, y, w * k, h, 3); g.fillStyle = col; g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 2, y + 1, w * k - 4, h * 0.3); }
      let sh = 0; for (const b of u.buffs) if (b.shield > 0) sh += b.shield;
      if (sh > 0) { const sw = Math.min(w, w * sh / u.maxHp); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(x + Math.min(w * k, w - sw), y, sw, h); }
      if (hero) {
        // 蓝条
        if (!u.manaless) {
          rrect(g, x - 2, y + h + 1, w + 4, 7, 3); g.fillStyle = INK; g.fill();
          g.fillStyle = '#3a3440'; g.fillRect(x, y + h + 3, w, 3);
          g.fillStyle = '#5aa0ff'; g.fillRect(x, y + h + 3, w * Math.max(0, u.mana / u.maxMana), 3);
        }
        // 等级圈
        g.beginPath(); g.arc(x - 11, y + h / 2 + 1, 10, 0, 7); g.fillStyle = INK; g.fill();
        g.beginPath(); g.arc(x - 11, y + h / 2 + 1, 7.5, 0, 7); g.fillStyle = '#f6ecd6'; g.fill();
        g.font = '900 11px "Comic Sans MS",sans-serif'; g.textAlign = 'center'; g.fillStyle = INK;
        g.fillText(u.level, x - 11, y + h / 2 + 5);
        g.strokeStyle = 'rgba(43,27,20,.55)'; g.lineWidth = 1;
        for (let t = 200; t < u.maxHp; t += 200) { const tx = x + w * t / u.maxHp; g.beginPath(); g.moveTo(tx, y); g.lineTo(tx, y + h * 0.6); g.stroke(); }
        g.font = '700 13px "KaiTi","STKaiti","Microsoft YaHei",serif'; g.textAlign = 'center';
        g.lineWidth = 4; g.strokeStyle = INK; g.strokeText(u.name, p.x, y - 6); g.fillStyle = '#fffaf0'; g.fillText(u.name, p.x, y - 6);
        // 控制状态标记
        const cc = u.has('stun') || u.has('knockup') ? '晕' : u.has('root') ? '缚' : u.has('charm') ? '魅' : u.has('silence') ? '默' : '';
        if (cc) { g.font = '900 15px "KaiTi",serif'; g.strokeText(cc, x + w + 12, y + 9); g.fillStyle = '#ffe27a'; g.fillText(cc, x + w + 12, y + 9); }
      } else if (big || u.kind === 'pet') {
        g.font = '700 12px "KaiTi","STKaiti","Microsoft YaHei",serif'; g.textAlign = 'center';
        g.lineWidth = 3; g.strokeStyle = INK;
        const nm = u.name || { tower: '防御塔', inhib: '召唤水晶', nexus: '主水晶' }[u.kind] || '';
        if (nm) { g.strokeText(nm, p.x, y - 5); g.fillStyle = '#fffaf0'; g.fillText(nm, p.x, y - 5); }
      }
    }
    // 伤害数字
    for (const t of world.texts) {
      const p = this.project(camera, t.x, t.y + t.t * 1.6, t.z);
      if (!p) continue;
      const k = t.t / t.dur, pop = k < 0.15 ? 0.6 + k / 0.15 * 0.6 : 1.2 - Math.min(0.2, (k - 0.15));
      const size = (t.big ? 26 : 18) * pop;
      g.globalAlpha = 1 - Math.max(0, (k - 0.6) / 0.4);
      g.font = `900 ${size}px "Comic Sans MS","KaiTi",sans-serif`; g.textAlign = 'center';
      g.lineWidth = 5; g.strokeStyle = INK; g.strokeText(t.text, p.x, p.y); g.fillStyle = t.color; g.fillText(t.text, p.x, p.y);
      g.globalAlpha = 1;
    }
  }
}

// 小地图
export class Minimap {
  constructor(canvas, mapCanvas) {
    this.c = canvas; this.g = canvas.getContext('2d');
    const S = canvas.width;
    this.bg = document.createElement('canvas'); this.bg.width = this.bg.height = S;
    const b = this.bg.getContext('2d');
    b.drawImage(mapCanvas, 0, 0, S, S);
    b.strokeStyle = INK; b.lineWidth = 4; b.strokeRect(2, 2, S - 4, S - 4);
  }
  toMap(x, z) { const S = this.c.width; return { x: (x + HALF) / (HALF * 2) * S, y: (z + HALF) / (HALF * 2) * S }; }
  fromMap(px, py) { const S = this.c.width; return { x: px / S * HALF * 2 - HALF, z: py / S * HALF * 2 - HALF }; }
  draw(world, player, camTarget, heroIcons) {
    const g = this.g, S = this.c.width;
    g.drawImage(this.bg, 0, 0);
    if (this.fog) g.drawImage(this.fog, 0, 0, S, S);
    for (const u of world.units) {
      if (u.dead || u.removed || u.inFog) continue;
      const p = this.toMap(u.pos.x, u.pos.z);
      if (u.isStructure) {
        g.fillStyle = TEAM_COL[u.team]; g.strokeStyle = INK; g.lineWidth = 2;
        const s = u.kind === 'nexus' ? 8 : 5;
        g.beginPath(); g.moveTo(p.x, p.y - s); g.lineTo(p.x + s, p.y); g.lineTo(p.x, p.y + s); g.lineTo(p.x - s, p.y); g.closePath(); g.fill(); g.stroke();
      } else if (u.kind === 'minion') {
        g.fillStyle = TEAM_COL[u.team]; g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      } else if (u.kind === 'monster') {
        g.fillStyle = '#e8b04a'; g.beginPath(); g.arc(p.x, p.y, u.big ? 5 : 3, 0, 7); g.fill();
      }
    }
    for (const u of world.units) {
      if (u.kind !== 'hero' || u.dead || u.inFog) continue;
      const p = this.toMap(u.pos.x, u.pos.z);
      const r = u === player ? 10 : 8;
      g.save(); g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.closePath();
      g.fillStyle = TEAM_COL[u.team]; g.fill();
      const img = heroIcons[u.def.id];
      if (img && img.complete) { g.clip(); g.drawImage(img, p.x - r, p.y - r, r * 2, r * 2); }
      g.restore();
      g.lineWidth = u === player ? 3 : 2.5; g.strokeStyle = u === player ? '#fff27a' : TEAM_COL[u.team];
      g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.stroke();
    }
    // 规划路线：墨线描边的金色虚线 + 终点小旗
    if (this.route) {
      const pts = [this.route.from, ...this.route.pts].map(q => this.toMap(q.x, q.z));
      const path = () => { g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); };
      g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
      path(); g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
      path(); g.strokeStyle = '#ffe27a'; g.lineWidth = 2.5; g.setLineDash([5, 4]); g.lineDashOffset = -performance.now() / 60; g.stroke();
      g.setLineDash([]);
      const d = this.toMap(this.route.dest.x, this.route.dest.z);
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x, d.y - 13); g.stroke();
      g.fillStyle = '#ffe27a'; g.beginPath(); g.moveTo(d.x, d.y - 13); g.lineTo(d.x + 10, d.y - 9.5); g.lineTo(d.x, d.y - 6); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.ellipse(d.x, d.y, 4, 2, 0, 0, 7); g.fill();
      g.restore();
    }
    // 视野框
    const c = this.toMap(camTarget.x, camTarget.z);
    g.strokeStyle = '#fffaf0'; g.lineWidth = 1.5; g.strokeRect(c.x - 26, c.y - 18, 52, 32);
  }
}
