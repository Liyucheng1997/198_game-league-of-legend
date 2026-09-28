// 入口：渲染器、加载流程、选人界面与对局切换。
import * as THREE from 'three';
import { HEROES, HERO_BY_ID } from './heroes.js';
import { Stage, renderPortraits } from './stage.js';
import { Game } from './game.js';
import { Overlay, skillIcon } from './hud.js';
import { paperDataURL } from './toon-kit.js';
import { Sound } from './audio.js';
import { ITEMS } from './items.js';
import { initCursors } from './cursor.js';
import { skillArt, itemArt } from './icons.js';
import { SPELLS, SPELL_IDS } from './summoners.js';

const $ = (s) => document.querySelector(s);
// 让出一帧给浏览器刷新加载进度；页面在后台时 rAF 不触发，用定时器兜底
const frame = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 60); });

class App {
  async init() {
    const renderer = this.renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.overlay = new Overlay($('#overlay'));
    initCursors();
    this.sound = new Sound();
    // 浏览器要求用户操作后才能播放声音
    const unlock = () => this.sound.ensure();
    addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button, .card, .skills li')) this.sound.play('click'); }, true);
    document.querySelectorAll('.btn-sound').forEach(b => b.onclick = () => this.toggleSound());
    document.querySelectorAll('.btn-music').forEach(b => b.onclick = () => this.toggleMusic());
    this.syncSoundBtns();
    this.sound.startMusic('select');
    $('#paper').style.backgroundImage = `url(${paperDataURL()})`;
    const step = async (msg, pct) => { $('#load-msg').textContent = msg; $('#load-bar').style.width = pct + '%'; await frame(); };

    await step('正在削铅笔……', 10);
    await step('正在给十位英雄画像……', 25);
    this.portraits = renderPortraits(renderer);
    await step('正在手绘技能与装备图标……', 55);
    this.icons = { D: skillArt('D', '#c89a3a') || skillIcon('#e8c25a', '闪'), F: skillArt('F', '#3f8a52') || skillIcon('#5fae6e', '愈') };
    for (const h of HEROES) for (const s of h.skills) this.icons[h.id + s.key] = skillArt(h.id + s.key, h.color) || skillIcon(h.color, s.icon);
    for (const id of SPELL_IDS) this.icons['S_' + id] = skillArt('S_' + id, SPELLS[id].color) || skillIcon(SPELLS[id].color, SPELLS[id].name[0]);
    this.itemIcons = {};
    for (const it of ITEMS) this.itemIcons[it.id] = itemArt(it.id, it.color) || skillIcon(it.color, it.icon, 96);
    await step('正在搭建展台……', 75);
    this.stage = new Stage(this);
    this.stage.world.sfx = (n, p, v) => this.sound.play(n, p, v);
    this.buildSelect();
    await step('完成！', 100);
    $('#loading').classList.add('hidden');
    $('#select').classList.remove('hidden');
    this.pick('garen');

    addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      this.overlay.resize();
      this.stage.resize();
      if (this.game) this.game.resize();
    });
    addEventListener('keydown', (e) => {
      if (this.game || $('#select').classList.contains('hidden')) return;
      const k = e.key.toUpperCase();
      if ('QWER'.includes(k) && k.length === 1) this.stage.preview(k);
      if (k === 'A') this.stage.preview('A');
    });
    this.last = performance.now();
    const loop = () => {
      requestAnimationFrame(loop);
      const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.tick(dt);
    };
    loop();
  }
  tick(dt) {
    const r = this.renderer;
    const view = this.game || this.stage;
    const fov = view.camera.fov * Math.PI / 180;
    view.world.vfx.setScale(r.domElement.height / (2 * Math.tan(fov / 2)));
    view.update(dt);
    view.render(r);
    this.fps = this.fps ? this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05 : 60;
  }

  buildSelect() {
    const roster = $('#roster');
    roster.innerHTML = '';
    for (const h of HEROES) {
      const el = document.createElement('button');
      el.className = 'card';
      el.dataset.id = h.id;
      el.style.setProperty('--c', h.color);
      el.innerHTML = `<img src="${this.portraits[h.id]}"><span>${h.name}</span><small>${h.role}</small>`;
      el.onclick = () => this.pick(h.id);
      roster.appendChild(el);
    }
    document.querySelectorAll('#stage-ctrl [data-k]').forEach(b => b.onclick = () => this.stage.preview(b.dataset.k));
    $('#btn-lineup').onclick = () => this.stage.showLineup();
    $('#start').onclick = () => this.start();
    // 召唤师技能：二选二，记在本地
    this.spells = ['flash', 'heal'];
    try { const s = JSON.parse(localStorage.getItem('toon-spells') || 'null'); if (Array.isArray(s) && s.length === 2 && s.every(x => SPELLS[x])) this.spells = s; } catch (e) { /* 忽略 */ }
    this.renderSpells();
  }
  renderSpells() {
    const box = $('#spell-pick');
    box.innerHTML = `<b>召唤师技能</b>${this.spells.map((id, i) => `<button class="sp" data-i="${i}" title="${SPELLS[id].name}：${SPELLS[id].desc}（冷却 ${SPELLS[id].cd} 秒）"><img src="${this.icons['S_' + id]}"><span>${'DF'[i]}</span></button>`).join('')}<div class="sp-grid hidden"></div>`;
    const grid = box.querySelector('.sp-grid');
    box.querySelectorAll('.sp').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const slot = +b.dataset.i;
      grid.innerHTML = `<p>选择 ${'DF'[slot]} 键召唤师技能</p>` + SPELL_IDS.map(id => `<button data-id="${id}" class="${this.spells.includes(id) ? 'on' : ''}"><img src="${this.icons['S_' + id]}"><span>${SPELLS[id].name}</span><small>${SPELLS[id].cd}s</small><em>${SPELLS[id].desc}</em></button>`).join('');
      grid.classList.remove('hidden');
      grid.querySelectorAll('button').forEach(o => o.onclick = (ev) => {
        ev.stopPropagation();
        const id = o.dataset.id, other = this.spells[1 - slot];
        if (id === other) this.spells[1 - slot] = this.spells[slot]; // 选了另一格的技能就互换
        this.spells[slot] = id;
        try { localStorage.setItem('toon-spells', JSON.stringify(this.spells)); } catch (err) { /* 忽略 */ }
        this.renderSpells();
      });
    });
    document.addEventListener('click', () => grid.classList.add('hidden'), { once: true });
  }
  toggleSound() { this.sound.ensure(); this.sound.toggle(); this.syncSoundBtns(); }
  toggleMusic() { this.sound.ensure(); this.sound.toggleMusic(); this.syncSoundBtns(); }
  syncSoundBtns() {
    const inGame = !!this.game;
    document.querySelectorAll('.btn-sound').forEach(b => b.textContent = `音效：${this.sound.enabled ? '开' : '关'}${inGame ? ' (M)' : ''}`);
    document.querySelectorAll('.btn-music').forEach(b => b.textContent = `音乐：${this.sound.musicOn ? '开' : '关'}${inGame ? ' (N)' : ''}`);
  }
  pick(id) {
    if (this.sel !== id && this.sound) this.sound.play('pop');
    this.sel = id;
    const h = HERO_BY_ID[id];
    document.querySelectorAll('#roster .card').forEach(c => c.classList.toggle('on', c.dataset.id === id));
    this.stage.show(id);
    const bar = (label, v, max) => `<div class="stat"><span>${label}</span><i><b style="width:${Math.min(100, v / max * 100)}%"></b></i></div>`;
    $('#info').style.setProperty('--c', h.color);
    $('#info').innerHTML = `
      <div class="info-head"><img src="${this.portraits[id]}"><div><small>${h.title}</small><h2>${h.name}</h2><em>${h.role}</em></div></div>
      <div class="stats">${bar('生命', h.hp, 1100)}${bar('法力', h.mana, 500)}${bar('攻击', h.ad, 80)}${bar('射程', h.range, 12)}${bar('移速', h.speed, 7.5)}<div class="stat"><span>资源</span><em>${h.mana ? '法力 ' + h.mana : '无消耗'}</em></div></div>
      <p class="passive"><b>被动</b>${h.passive}</p>
      <ul class="skills">${h.skills.map(s => `<li data-k="${s.key}"><img src="${this.icons[id + s.key]}"><div><h4><kbd>${s.key}</kbd>${s.name}<small>冷却 ${s.cd}s · ${s.mana ? '法力 ' + s.mana : '无消耗'} · 最高 ${s.key === 'R' ? 3 : 5} 级</small></h4><p>${s.desc}</p></div></li>`).join('')}</ul>
      <p class="tip">点击技能或按 Q W E R 在展台上预览，按住左键拖动旋转视角。对局中从 1 级开始，击杀小兵/野怪/英雄获得经验，每级 1 个技能点；大招在 6 / 11 / 16 级解锁。</p>`;
    document.querySelectorAll('#info .skills li').forEach(li => li.onclick = () => this.stage.preview(li.dataset.k));
    document.querySelectorAll('#stage-ctrl [data-k]').forEach(b => {
      const s = h.skills.find(x => x.key === b.dataset.k);
      if (s) b.innerHTML = `<img src="${this.icons[id + s.key]}"><span>${s.key}</span>`;
    });
  }
  async start() {
    $('#select').classList.add('hidden');
    $('#loading').classList.remove('hidden');
    $('#load-msg').textContent = '正在绘制召唤师峡谷……';
    $('#load-bar').style.width = '40%';
    await frame(); await frame();
    this.sound.play('start');
    this.game = new Game(this, this.sel);
    document.body.classList.add('in-game');
    this.syncSoundBtns();
    $('#load-bar').style.width = '100%';
    await frame();
    $('#loading').classList.add('hidden');
  }
  backToSelect() {
    if (this.game) this.game.dispose();
    this.game = null;
    document.body.classList.remove('in-game');
    this.syncSoundBtns();
    $('#select').classList.remove('hidden');
    this.pick(this.sel);
  }
}

const app = new App();
window.toonApp = app;
app.init().catch(err => {
  console.error(err);
  $('#load-msg').textContent = '加载失败：' + err.message;
});
