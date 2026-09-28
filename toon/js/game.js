// 5V5 峡谷对局：地图、双方英雄、兵线、野怪、镜头与操作。
import * as THREE from 'three';
import { World } from './world.js';
import { buildMap, structureLayout, LANES, CAMPS, CRABS, PITS, FOUNTAIN, HALF } from './map.js';
import { Hero, Minion, Structure, Monster } from './units.js';
import { HEROES, HERO_BY_ID, xpNeed, MAX_RANK } from './heroes.js';
import { HeroBot } from './ai.js';
import { Minimap } from './hud.js';
import { Shop, renderInventory } from './shop.js';
import { BUILDS, ITEM_BY_ID } from './items.js';
import { TEAM_COL as TCOL } from './props.js';
import { FOG } from './toon-kit.js';
import { SPELLS } from './summoners.js';
import { setCursor } from './cursor.js';
import { RangeIndicator } from './indicator.js';
import { shopkeeperRig, shopStall } from './hero-models.js';
import { TEAM_COL } from './props.js';

const $ = (s) => document.querySelector(s);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function makeLights(scene, shadowSize = 2048, span = 42) {
  const hemi = new THREE.HemisphereLight('#fff6e6', '#7a9a6a', 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d8', 2.1);
  sun.position.set(-25, 60, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const c = sun.shadow.camera;
  c.left = -span; c.right = span; c.top = span; c.bottom = -span; c.near = 1; c.far = 160;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  return { hemi, sun, follow(p) { sun.position.set(p.x - 25, 60, p.z + 30); sun.target.position.set(p.x, 0, p.z); } };
}

export class Game {
  constructor(app, heroId) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#9fcfb0');
    this.lights = makeLights(this.scene, 2048, 44);
    this.map = buildMap(this.scene);
    const W = this.world = new World(this.scene, { grid: this.map.grid });
    this.time = 0; this.over = false; this.paused = false;
    this.score = { 1: 0, 2: 0 }; this.firstBlood = false;

    // 防御建筑
    for (const s of structureLayout()) {
      const u = W.add(new Structure(W, s));
      this.map.grid.block(s.x, s.z, s.kind === 'nexus' ? 3.2 : 1.5);
      if (s.kind === 'nexus') this['nexus' + s.team] = u;
    }
    // 双方泉水旁的商店老板
    this.keepers = [1, 2].map(team => {
      const s = team === 1 ? 1 : -1;
      const f = FOUNTAIN[team], pos = { x: f.x + 6.6 * s, z: f.z - 3.4 * s }, face = Math.atan2(f.x - pos.x, f.z - pos.z);
      const stall = shopStall(); stall.position.set(pos.x, 0, pos.z); stall.rotation.y = face; this.scene.add(stall);
      const rig = shopkeeperRig();
      rig.root.position.set(pos.x - Math.sin(face) * 1.1, 0, pos.z - Math.cos(face) * 1.1); rig.root.rotation.y = face;
      this.scene.add(rig.root);
      this.map.grid.block(pos.x, pos.z, 2.2);
      const front = { x: pos.x + Math.sin(face) * 2.4, z: pos.z + Math.cos(face) * 2.4 };
      return { team, rig, stall, pos, face, front, greetT: 0 };
    });
    // 野怪
    // 营地：一大带几小（面朝野区中心摆放）
    const GROUPS = { blue: [['blue', 0, 0]], red: [['red', 0, 0]], gromp: [['gromp', 0, 0]],
      wolves: [['wolf', 0, 0], ['wolfS', 1.9, 1.3], ['wolfS', -1.9, 1.3]],
      raptors: [['raptor', 0, 0], ['raptorS', 1.7, 1.2], ['raptorS', -1.7, 1.2], ['raptorS', 0, 2.2]],
      krugs: [['krug', 0, 0], ['krugS', 2.1, 1.1]] };
    CAMPS.forEach((c, ci) => {
      const a = Math.atan2(-c.x, -c.z);
      for (const [kind, ox, oz] of GROUPS[c.kind]) {
        const x = c.x + ox * Math.cos(a) + oz * Math.sin(a), z = c.z - ox * Math.sin(a) + oz * Math.cos(a);
        W.add(new Monster(W, kind, x, z, 'camp' + ci));
      }
    });
    for (const c of CRABS) W.add(new Monster(W, 'crab', c.x, c.z));
    W.add(new Monster(W, 'dragon', PITS.dragon.x, PITS.dragon.z));
    W.add(new Monster(W, 'baron', PITS.baron.x, PITS.baron.z));

    // 英雄
    const others = shuffle(HEROES.filter(h => h.id !== heroId).map(h => h.id));
    const blue = [heroId, ...others.slice(0, 4)], red = others.slice(4);
    this.bots = [];
    const spawn = (id, team, i) => {
      const f = FOUNTAIN[team], a = i / 5 * Math.PI * 2;
      const h = W.add(new Hero(W, HERO_BY_ID[id], team, f.x + Math.cos(a) * 3, f.z + Math.sin(a) * 3));
      h.facing = team === 1 ? Math.PI * 0.75 : -Math.PI * 0.25;
      return h;
    };
    this.player = spawn(heroId, 1, 0);
    const blueRoles = shuffle(['top', 'mid', 'bot', 'jungle']);
    blue.slice(1).forEach((id, i) => this.bots.push(new HeroBot(spawn(id, 1, i + 1), this, blueRoles[i])));
    const redRoles = shuffle(['top', 'mid', 'bot', 'bot', 'jungle']);
    red.forEach((id, i) => this.bots.push(new HeroBot(spawn(id, 2, i), this, redRoles[i])));
    for (const b of this.bots) { b.h.isBot = true; b.h.autoLearn(); }
    // 召唤师技能：玩家用选人界面选的；电脑打野带惩戒，其余随机
    this.player.spells = { D: app.spells[0], F: app.spells[1] };
    const pool = ['heal', 'ignite', 'barrier', 'teleport', 'exhaust', 'ghost', 'cleanse'];
    for (const b of this.bots) b.h.spells = { D: 'flash', F: b.role === 'jungle' ? 'smite' : pool[Math.floor(Math.random() * pool.length)] };
    // 音效与金币
    const snd = app.sound;
    W.sfx = (n, p, v) => snd.play(n, p, v);
    W.isPlayer = (u) => u === this.player;
    snd.listener = () => this.camTarget;
    snd.startMusic('game');
    for (const u of W.units) if (u.kind === 'hero') u.gold = 500;
    for (const b of this.bots) this.botShop(b.h);
    W.onTeleported = (h) => { if (h === this.player) this.camTarget.set(h.pos.x, 0, h.pos.z); };
    W.onRecalled = (h) => {
      if (h !== this.player) return;
      this.camTarget.set(h.pos.x, 0, h.pos.z); // 镜头直接切到泉水
      this.hint('已回到泉水');
    };
    W.onLevelUp = (h) => {
      if (h.isBot) h.autoLearn();
      else if (h === this.player) {
        W.vfx.comic(h.pos, '升级!', { color: '#ffe27a', y: 4 });
        if (h.level === 6 || h.level === 11 || h.level === 16) this.hint(`${h.level} 级！可以学习大招了（Shift+R）`);
      }
    };

    W.respawnPoint = (team) => { const f = FOUNTAIN[team]; return { x: f.x + (Math.random() - 0.5) * 4, z: f.z + (Math.random() - 0.5) * 4 }; };
    W.nearShop = (u) => { const k = this.keepers.find(k => k.team === u.team); return k && Math.hypot(u.pos.x - k.front.x, u.pos.z - k.front.z) < 4.5; };
    W.fountainHeal = (u) => Math.hypot(u.pos.x - FOUNTAIN[u.team].x, u.pos.z - FOUNTAIN[u.team].z) < 7;
    W.respawnTime = (h) => 5 + h.level * 1.4;
    W.onStructureDown = (s) => {
      if (s.kind === 'nexus') this.finish(s.team === 1 ? 2 : 1);
      else this.toast(`${s.team === 1 ? '我方' : '敌方'}${s.kind === 'tower' ? '防御塔' : '召唤水晶'}被摧毁！`, TEAM_COL[s.team]);
    };
    W.onMonsterDown = (m, k) => {
      if (k && k.kind === 'pet') k = k.owner;
      if ((m.mkind === 'blue' || m.mkind === 'red') && k && k.kind === 'hero') { this.giveJungleBuff(k, m.mkind); return; }
      if (!m.big || !k) return;
      const team = k.team;
      const heroes = W.units.filter(u => u.kind === 'hero' && u.team === team && !u.dead);
      for (const h of heroes) {
        h.addBuff(m.mkind, 60, { as: 0.2, haste: 0.08, keepOnDeath: false });
        W.vfx.aura(h, { color: m.mkind === 'dragon' ? '#ff8a30' : '#b58aff', glow: true, r: 1.4, dur: 60, particles: 4 });
      }
      this.toast(`${team === 1 ? '我方' : '敌方'}击败了${m.name}！`, m.mkind === 'dragon' ? '#ff8a30' : '#b58aff');
    };

    // 镜头
    this.camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 1, 700);
    this.camTarget = new THREE.Vector3(this.player.pos.x, 0, this.player.pos.z);
    this.zoom = 1.1; this.locked = true;
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, ground: new THREE.Vector3() };
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.waveT = 3; this.waveN = 0;

    this.setupHUD();
    this.bind();
    // 战争迷雾贴图：128×128 覆盖整张地图
    this.fogCanvas = document.createElement('canvas'); this.fogCanvas.width = this.fogCanvas.height = 128;
    this.fogTex = new THREE.CanvasTexture(this.fogCanvas);
    this.fogTex.colorSpace = THREE.NoColorSpace;
    FOG.tex.value = this.fogTex; FOG.amt.value = 0.62;
    this.fogT = 0;
    this.shop = new Shop(this);
    this.ind = new RangeIndicator(this.scene);
    this.aiming = null; this.hoverKey = null; this.aHeld = false; this.showAtk = false;
    this.shop.open();
    this.hint('先买出门装！商店随时按 P 打开');
    this.toast('欢迎来到手绘峡谷！', '#ffe27a');
  }

  // ---------------- 输入 ----------------
  bind() {
    const cv = this.app.renderer.domElement;
    this.handlers = {
      contextmenu: (e) => e.preventDefault(),
      mousemove: (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; },
      mousedown: (e) => {
        if (e.target !== cv && e.target !== this.app.overlay.c) return;
        this.mouse.x = e.clientX; this.mouse.y = e.clientY;
        if (e.button === 2 && this.aiming) { this.aiming = null; return; }
        if (e.button === 0 && this.aHeld) { this.attackMove(); return; }
        if (e.button === 0 && !this.over) { const k = this.keeperAt(this.mouse.x, this.mouse.y); if (k) { this.visitShop(k); return; } }
        if (e.button === 2) { this.rightDown = true; this.rightClick(true); }
      },
      mouseup: (e) => { if (e.button === 2) this.rightDown = false; },
      wheel: (e) => { this.zoom = Math.max(0.65, Math.min(1.5, this.zoom + Math.sign(e.deltaY) * 0.08)); },
      keydown: (e) => this.key(e, true),
      keyup: (e) => this.key(e, false),
      resize: () => this.resize(),
    };
    for (const k of ['contextmenu', 'mousemove', 'mousedown', 'mouseup', 'keydown', 'keyup', 'resize']) window.addEventListener(k, this.handlers[k]);
    window.addEventListener('wheel', this.handlers.wheel, { passive: true });
    const mm = $('#minimap');
    this.mmHandler = (e) => {
      e.preventDefault();
      const r = mm.getBoundingClientRect();
      const p = this.minimap.fromMap((e.clientX - r.left) / r.width * mm.width, (e.clientY - r.top) / r.height * mm.height);
      if (e.button === 2) {
        // 右键小地图：寻路并在小地图上画出规划路线
        this.player.orderMove(p.x, p.z);
        const last = this.player.path && this.player.path[this.player.path.length - 1];
        this.mmDest = last ? { x: last.x, z: last.z } : p;
        this.world.vfx.ring(this.mmDest, { r0: 2.5, r1: 0.4, color: '#ffe27a', dur: 0.6 });
        this.app.sound.play('click');
      } else { this.locked = false; this.camTarget.set(p.x, 0, p.z); this.updateLockBtn(); }
    };
    mm.addEventListener('mousedown', this.mmHandler);
    mm.addEventListener('contextmenu', this.handlers.contextmenu);
  }
  unbind() {
    for (const k in this.handlers) window.removeEventListener(k, this.handlers[k]);
    $('#minimap').removeEventListener('mousedown', this.mmHandler);
  }
  key(e, down) {
    const k = e.key.toLowerCase();
    if (k === 'tab') { e.preventDefault(); $('#tabboard').classList.toggle('hidden', !down); if (down) this.fillTab(); return; }
    if (k === 'a') { this.aHeld = down; if (down) return; }
    if (!down) {
      if (this.aiming && k === this.aiming.toLowerCase()) { const key = this.aiming; this.aiming = null; this.castNow(key); }
      return;
    }
    if (k === 'escape' && this.aiming) { this.aiming = null; return; }
    if (k === 'escape') { if (this.shop.isOpen) this.shop.close(); else this.togglePause(); return; }
    if (k === 'm') { this.app.toggleSound(); return; }
    if (k === 'n') { this.app.toggleMusic(); return; }
    if (this.paused || this.over) return;
    const p = this.player;
    if (e.shiftKey && 'qwer'.includes(k) && k.length === 1) { e.preventDefault(); this.learn(k.toUpperCase()); return; }
    if ('qwer'.includes(k) && k.length === 1) {
      if (e.repeat) return;
      const sk = p.def.skills.find(s => s.key === k.toUpperCase());
      // 需要瞄准的技能：按住显示范围，松开施放；纯增益技能按下即放
      if (sk.ind && sk.ind.type !== 'none') { this.aiming = sk.key; return; }
      this.castNow(sk.key);
    } else if ('df'.includes(k) && k.length === 1) this.castNow(k.toUpperCase());
    else if (k === 'p') this.shop.toggle();
    else if (k >= '1' && k <= '6') this.useItem(+k - 1);
    else if (k === 'b') p.recall();
    else if (k === 's') p.stop();
    else if (k === ' ') { const t = this.player.pos; this.camTarget.set(t.x, 0, t.z); }
    else if (k === 'y') { this.locked = !this.locked; this.updateLockBtn(); }
  }
  castNow(key) {
    if (this.paused || this.over) return;
    const p = this.player;
    const aim = this.groundAt(this.mouse.x, this.mouse.y);
    const res = p.cast(key, aim, this.pickUnit(this.mouse.x, this.mouse.y));
    if (res === 'notarget') this.hint('附近没有可选目标');
    else if (res === 'cd') this.hint('技能冷却中');
    else if (res === 'cc') this.hint('被控制，无法施法');
    else if (res === 'mana') this.hint('法力不足');
    else if (res === 'unlearned') this.hint(p.points > 0 ? '还没学这个技能：按 Shift+' + key + ' 或点技能上方的 +' : '还没学这个技能');
    if (res !== 'ok' && res !== 'dead') this.app.sound.play('error', null, 0.5);
  }
  attackMove() {
    const p = this.player, gp = this.groundAt(this.mouse.x, this.mouse.y);
    // 攻击移动：攻击点击位置附近最近的敌人，没有就走过去
    const u = this.pickUnit(this.mouse.x, this.mouse.y) || this.world.nearestEnemy(p.team, gp, 6);
    if (u && u.team !== p.team) { p.orderAttack(u); this.world.vfx.ring(u.pos, { r0: 2, r1: 0.8, color: '#ff5a4a', dur: 0.3 }); }
    else { p.orderMove(gp.x, gp.z); this.world.vfx.ring(gp, { r0: 1.2, r1: 0.3, color: '#ff9a7a', dur: 0.35 }); }
  }
  groundAt(x, y) {
    const v = new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const out = new THREE.Vector3();
    this.ray.ray.intersectPlane(this.plane, out);
    return { x: out.x, z: out.z };
  }
  pickUnit(mx, my) {
    let best = null, bd = 1e9;
    const v = new THREE.Vector3();
    for (const u of this.world.units) {
      if (!u.targetable || u === this.player || u.inFog) continue;
      v.set(u.pos.x, u.height * 0.5 + (u.lift || 0), u.pos.z).project(this.camera);
      const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
      const r = (u.isStructure ? 70 : u.kind === 'hero' ? 42 : u.big ? 80 : 30) / this.zoom;
      const d = Math.hypot(sx - mx, sy - my);
      if (d < r && d - (u.kind === 'hero' ? 15 : 0) < bd) { bd = d; best = u; }
    }
    return best;
  }
  visitShop(k) {
    const p = this.player;
    if (p.canShop()) this.shop.open();
    else { p.orderMove(k.front.x, k.front.z); this.pendingShop = true; this.world.vfx.ring(k.front, { r0: 1.2, r1: 0.3, color: '#ffe27a', dur: 0.35 }); }
  }
  keeperAt(mx, my) {
    const k = this.keepers.find(k => k.team === this.player.team);
    const v = new THREE.Vector3(k.rig.root.position.x, 2.4, k.rig.root.position.z).project(this.camera);
    const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight;
    return v.z < 1 && Math.hypot(sx - mx, sy - my) < 70 / this.zoom ? k : null;
  }
  rightClick(first) {
    if (this.paused || this.over) return;
    const p = this.player;
    if (first) { this.pendingShop = false; this.mmDest = null; }
    const u = this.pickUnit(this.mouse.x, this.mouse.y);
    if (u && u.team !== p.team) {
      p.orderAttack(u);
      if (first) this.world.vfx.ring(u.pos, { r0: 2, r1: 0.8, color: '#ff5a4a', dur: 0.3 });
    } else {
      const g = this.groundAt(this.mouse.x, this.mouse.y);
      p.orderMove(g.x, g.z);
      if (first) {
        this.world.vfx.ring(g, { r0: 1.2, r1: 0.3, color: '#7dff7a', dur: 0.35 });
        this.world.vfx.puff(g, { n: 3, color: '#ffffff', cell: 'puff', size: 0.35, y: 0.1, speed: 1.5, up: 0.2 });
      }
    }
  }

  // ---------------- HUD ----------------
  setupHUD() {
    const p = this.player, icons = this.app.icons;
    $('#hud').classList.remove('hidden');
    $('#hud-portrait').src = this.app.portraits[p.def.id];
    $('#hud-name').textContent = `${p.def.title} · ${p.def.name}`;
    const slots = $('#hud-skills');
    slots.innerHTML = '';
    const list = [...p.def.skills.map(s => ({ key: s.key, name: s.name, desc: s.desc, icon: icons[p.def.id + s.key], cd: s.cd })),
      ...['D', 'F'].map(key => { const sp = SPELLS[p.spells[key]]; return { key, name: sp.name, desc: sp.desc, icon: icons['S_' + p.spells[key]], cd: sp.cd }; })];
    this.slotEls = {};
    for (const s of list) {
      const el = document.createElement('div');
      el.className = 'slot' + (s.key === 'D' || s.key === 'F' ? ' small' : '');
      const skill = 'QWER'.includes(s.key);
      el.innerHTML = `<img src="${s.icon}"><div class="cd"></div><span class="cdt"></span><b>${s.key}</b>${skill ? '<div class="learn" title="学习技能（Shift+' + s.key + '）">+</div><div class="pips"></div><i class="cost"></i>' : ''}<div class="tip"><h4>${s.name} <small class="meta">${s.key} · 冷却 ${s.cd}s</small></h4><p>${s.desc}</p></div>`;
      el.addEventListener('mousedown', (e) => e.stopPropagation());
      if (skill) el.querySelector('.learn').addEventListener('click', () => this.learn(s.key));
      if (skill) { el.addEventListener('mouseenter', () => { this.hoverKey = s.key; }); el.addEventListener('mouseleave', () => { if (this.hoverKey === s.key) this.hoverKey = null; }); }
      slots.appendChild(el);
      this.slotEls[s.key] = el;
    }
    $('#hud-passive').textContent = p.def.passive;
    this.minimap = new Minimap($('#minimap'), this.map.minimap);
    this.heroImgs = {};
    for (const h of HEROES) { const img = new Image(); img.src = this.app.portraits[h.id]; this.heroImgs[h.id] = img; }
    $('#killfeed').innerHTML = '';
    $('#btn-lock').onclick = () => { this.locked = !this.locked; this.updateLockBtn(); };
    $('#btn-pause').onclick = () => this.togglePause();
    $('#resume').onclick = () => this.togglePause();
    $('#quit').onclick = () => this.app.backToSelect();
    $('#btn-shop').onclick = () => this.shop.toggle();
    const atkBtn = $('#btn-atk');
    const syncAtk = () => { atkBtn.textContent = `攻击范围：${this.showAtk ? '常显' : '自动'}`; };
    atkBtn.onclick = () => { this.showAtk = !this.showAtk; syncAtk(); };
    syncAtk();
    // 属性栏：用装备插画当小图标
    const ic = this.app.itemIcons;
    this.statDefs = [
      ['ad', '攻击力', ic.longsword], ['ap', '法术强度', ic.tome], ['armor', '护甲', ic.cloth], ['mr', '魔法抗性', ic.cloak],
      ['as', '攻击速度', ic.dagger], ['crit', '暴击几率', ic.ie], ['ms', '移动速度', ic.boots], ['cdr', '技能急速', ic.zhonya],
    ];
    $('#hud-stats').innerHTML = this.statDefs.map(([k, n, src]) => `<div title="${n}"><img src="${src}"><span data-s="${k}">0</span></div>`).join('');
    this.statEls = Object.fromEntries([...document.querySelectorAll('#hud-stats span')].map(el => [el.dataset.s, el]));
    this.invSig = '';
    this.updateLockBtn();
  }
  updateLockBtn() { $('#btn-lock').textContent = this.locked ? '镜头：锁定 (Y)' : '镜头：自由 (Y)'; }
  togglePause() {
    if (this.over) return;
    this.paused = !this.paused;
    $('#pause').classList.toggle('hidden', !this.paused);
  }
  learn(key) {
    const p = this.player;
    if (p.learn(key)) { this.hudKey = ''; return; }
    if (p.points <= 0) this.hint('没有技能点，升级后获得');
    else if (p.ranks[key] >= MAX_RANK[key]) this.hint('这个技能已经满级');
    else if (key === 'R') this.hint('大招需要 6 / 11 / 16 级才能学习');
    else this.hint(`技能等级不能超过英雄等级的一半（当前 ${p.level} 级）`);
  }
  hint(t) {
    const el = $('#hint'); el.textContent = t; el.classList.add('show');
    clearTimeout(this.hintT); this.hintT = setTimeout(() => el.classList.remove('show'), 900);
  }
  toast(t, color = '#ffe27a') {
    const el = $('#toast');
    el.innerHTML = `<span style="color:${color}">${t}</span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  feed(killer, victim) {
    const el = document.createElement('div');
    const img = (u) => u && u.kind === 'hero' ? `<img src="${this.app.portraits[u.def.id]}" style="border-color:${TEAM_COL[u.team]}">` : `<i style="background:${TEAM_COL[u?.team] || '#9a7ad0'}">${u ? ({ tower: '塔', minion: '兵', monster: '怪', pet: '熊' }[u.kind] || '?') : '?'}</i>`;
    el.innerHTML = `${img(killer)}<span>⚔</span>${img(victim)}`;
    $('#killfeed').prepend(el);
    setTimeout(() => el.remove(), 6000);
  }
  fillTab() {
    const rows = (team) => this.world.units.filter(u => u.kind === 'hero' && u.team === team).map(u =>
      `<tr class="${u === this.player ? 'me' : ''}"><td><img src="${this.app.portraits[u.def.id]}"></td><td>${u.def.name} <small>Lv${u.level}</small></td><td>${u.kills} / ${u.deaths} / ${u.assists}</td><td>${u.dead ? '复活 ' + Math.ceil(u.respawnT) + 's' : Math.round(u.hp) + ' HP'}</td></tr>`).join('');
    $('#tabboard').innerHTML = `<h3>战绩 <small>${fmt(this.time)}</small></h3><div class="cols"><table class="blue"><tr><th colspan="4">蓝色方 · ${this.score[1]} 杀</th></tr>${rows(1)}</table><table class="red"><tr><th colspan="4">红色方 · ${this.score[2]} 杀</th></tr>${rows(2)}</table></div>`;
  }
  updateHUD() {
    const p = this.player;
    $('#score-blue').textContent = this.score[1];
    $('#score-red').textContent = this.score[2];
    $('#clock').textContent = fmt(this.time);
    $('#hud-gold').textContent = `💰 ${Math.floor(p.gold)}`;
    const sv = {
      ad: Math.round(p.ad), ap: Math.round(p.ap), armor: Math.round(p.armor), mr: Math.round(p.mr),
      as: (p.atkSpeed * p.atkMul).toFixed(2), crit: Math.round(p.crit * 100) + '%',
      ms: Math.round(p.speed * 50), cdr: Math.round(p.cdr * 100) + '%',
    };
    for (const k in sv) if (this.statEls[k].textContent !== String(sv[k])) this.statEls[k].textContent = sv[k];
    const k = Math.max(0, p.hp / p.maxHp);
    $('#hud-hp i').style.width = (k * 100) + '%';
    $('#hud-hp span').textContent = `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
    if (p.manaless) { $('#hud-mp i').style.width = '0%'; $('#hud-mp span').textContent = '无消耗英雄 · 不使用法力'; }
    else { $('#hud-mp i').style.width = (p.mana / p.maxMana * 100) + '%'; $('#hud-mp span').textContent = `${Math.floor(p.mana)} / ${Math.round(p.maxMana)}`; }
    $('#hud-level').textContent = p.level;
    $('#hud-face').style.setProperty('--xp', p.level >= 18 ? 1 : p.xp / xpNeed(p.level));
    const pts = $('#hud-points');
    pts.textContent = p.points > 0 ? `技能点 ×${p.points}  (Shift+Q/W/E/R)` : '';
    pts.classList.toggle('hidden', p.points <= 0);
    // 技能等级与加点按钮只在变化时重绘
    const sig = `${p.level}|${p.points}|${p.ranks.Q}${p.ranks.W}${p.ranks.E}${p.ranks.R}`;
    if (sig !== this.hudKey) {
      this.hudKey = sig;
      for (const sk of p.def.skills) {
        const el = this.slotEls[sk.key], r = p.ranks[sk.key];
        el.querySelector('.pips').innerHTML = Array.from({ length: MAX_RANK[sk.key] }, (_, i) => `<u class="${i < r ? 'on' : ''}"></u>`).join('');
        el.querySelector('.learn').classList.toggle('show', p.canLearn(sk.key));
        el.classList.toggle('unlearned', r === 0);
        const cost = p.costOf(sk);
        el.querySelector('.cost').textContent = cost ? cost : '';
        el.querySelector('.meta').textContent = `${sk.key} · 等级 ${r}/${MAX_RANK[sk.key]} · 冷却 ${p.cdOf(sk).toFixed(1)}s · ${cost ? '法力 ' + cost : '无消耗'}`;
      }
    }
    for (const key in this.slotEls) {
      const el = this.slotEls[key], cd = p.cds[key] || 0;
      const sk = p.def.skills.find(s => s.key === key);
      const max = sk ? (key === 'R' && p.def.id === 'ahri' ? Math.max(cd, 1) : sk.cd) : SPELLS[p.spells[key]].cd;
      el.style.setProperty('--cd', cd > 0 ? Math.min(1, cd / Math.max(max, cd)) : 0);
      el.querySelector('.cdt').textContent = cd > 0 ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd)) : '';
      el.classList.toggle('locked', !p.canCast() && !p.dead);
      if (sk) el.classList.toggle('nomana', p.ranks[key] > 0 && p.mana < p.costOf(sk));
    }
    $('#dead-banner').classList.toggle('hidden', !p.dead);
    document.body.classList.toggle('dead', p.dead);
    const ch = $('#channel'), chT = p.recallT > 0 ? p.recallT : p.tpT > 0 ? p.tpT : 0;
    ch.classList.toggle('hidden', !chT);
    if (chT) { ch.querySelector('i').style.width = ((4 - chT) / 4 * 100) + '%'; ch.querySelector('span').textContent = `${p.recallT > 0 ? '回城' : '传送'}中… ${chT.toFixed(1)}s`; }
    if (p.dead) $('#dead-banner').textContent = `你倒下了……${Math.ceil(p.respawnT)} 秒后复活`;
    const buffs = p.buffs.filter(b => b.id === 'dragon' || b.id === 'baron' || b.id === 'blueBuff' || b.id === 'redBuff' || b.haste || b.as || b.shield || b.dr).slice(0, 6);
    $('#hud-buffs').innerHTML = buffs.map(b => `<i title="${b.id}">${{ dragon: '龙', baron: '爵', blueBuff: '蓝', redBuff: '红' }[b.id] || (b.shield ? '盾' : b.dr ? '御' : b.as ? '速' : '疾')}</i>`).join('');
  }

  // ---------------- 流程 ----------------
  spawnWave() {
    const W = this.world;
    this.waveN++;
    const types = ['melee', 'melee', 'caster', 'caster'];
    types.forEach((type, i) => W.after(i * 0.9, () => {
      if (this.over) return;
      for (const lane of Object.values(LANES)) {
        for (const team of [1, 2]) {
          const p = lane.pointAt(team === 1 ? 9 : lane.len - 9);
          W.add(new Minion(W, team, type, lane, p.x + (Math.random() - 0.5), p.z + (Math.random() - 0.5)));
        }
      }
    }));
    if (this.waveN === 1) this.toast('全军出击！', '#ffe27a');
  }
  giveXp(v, killer) {
    const W = this.world;
    const heroes = W.units.filter(u => u.kind === 'hero' && !u.dead);
    const hk = killer && killer.kind === 'hero' ? killer : null;
    // 金币：补刀归击杀者，野怪大龙与推塔全队分
    if (v.kind === 'minion' && hk) hk.addGold(v.type === 'caster' ? 17 : 24);
    if (v.kind === 'monster') {
      if (v.big) { for (const u of W.units) if (u.kind === 'hero' && killer && u.team === killer.team) u.addGold(v.mkind === 'baron' ? 300 : 150); }
      else if (hk) hk.addGold({ blue: 100, red: 100, gromp: 80, wolf: 55, wolfS: 16, raptor: 45, raptorS: 12, krug: 60, krugS: 20, crab: 70 }[v.mkind] || 40);
    }
    if (v.isStructure) for (const u of W.units) if (u.kind === 'hero' && u.team !== v.team) u.addGold(v.kind === 'tower' ? 150 : 50);
    if (v.kind === 'hero') {
      if (!hk && v.lastHeroHit && W.time - v.lastHeroHit.t < 8) killer = v.lastHeroHit.src;
      const val = 140 + 35 * v.level;
      if (killer && killer.kind === 'hero') { killer.gainXp(val); killer.addGold(300); }
      for (const u of heroes) if (u !== killer && u.team !== v.team && u.dist(v) < 16) { u.gainXp(val * 0.4); u.addGold(120); }
      return;
    }
    const val = v.kind === 'minion' ? (v.type === 'caster' ? 32 : 58) : v.kind === 'monster' ? (v.big ? 320 : { blue: 130, red: 130, gromp: 100, crab: 90 }[v.mkind] || (v.mkind.endsWith('S') ? 25 : 70)) : v.isStructure ? 150 : 0;
    if (!val) return;
    if (v.isStructure) { for (const u of heroes) if (u.team !== v.team) u.gainXp(val); return; }
    const team = v.team === 0 ? (killer && killer.team) : 3 - v.team;
    const near = heroes.filter(u => u.team === team && u.dist(v) < 15);
    // 单人吃经验更多，多人平分并略有加成
    for (const u of near) u.gainXp(val * (near.length > 1 ? 1.25 / near.length : 1));
  }
  processEvents() {
    const W = this.world;
    for (const ev of W.events) {
      const v = ev.victim;
      this.giveXp(v, ev.killer && ev.killer.kind === 'pet' ? ev.killer.owner : ev.killer);
      if (v.kind !== 'hero') continue;
      let killer = ev.killer;
      if ((!killer || killer.kind !== 'hero') && v.lastHeroHit && W.time - v.lastHeroHit.t < 8) killer = v.lastHeroHit.src;
      if (killer && killer.kind === 'pet') killer = killer.owner;
      const team = killer && killer.team ? killer.team : 3 - v.team;
      this.score[team]++;
      if (killer && killer.kind === 'hero') {
        for (const kind of ['blue', 'red']) { const b = v.buff && v.buff(kind + 'Buff'); if (b) { if (b.fx) b.fx.kill = true; this.giveJungleBuff(killer, kind, Math.max(20, b.t)); } }
        killer.kills++;
        W.units.filter(u => u.kind === 'hero' && u.team === killer.team && u !== killer && !u.dead && u.dist(v) < 15).forEach(u => u.assists++);
      }
      this.feed(killer, v);
      if (killer === this.player) this.app.sound.play('kill');
      if (!this.firstBlood) { this.firstBlood = true; this.toast('第一滴血！', '#ff5a4a'); }
      else if (killer === this.player) this.toast(`你击杀了 ${v.def.name}！`, '#ffe27a');
      else if (v === this.player) this.toast(`你被 ${killer?.def?.name || '防御塔'} 击杀了`, '#ff5a4a');
    }
    W.events.length = 0;
  }
  finish(winner) {
    if (this.over) return;
    this.over = true;
    const win = winner === this.player.team;
    this.app.sound.play(win ? 'victory' : 'defeat');
    const el = $('#endscreen');
    el.classList.remove('hidden');
    el.innerHTML = `<div class="end-card ${win ? 'win' : 'lose'}"><h1>${win ? '胜利!' : '失败'}</h1><p>${win ? '敌方主水晶被你们一锤敲碎啦！' : '我方主水晶碎了……再来一局吧。'}</p>
      <div class="end-stats">用时 ${fmt(this.time)} · 比分 ${this.score[1]} : ${this.score[2]} · 你的战绩 ${this.player.kills}/${this.player.deaths}/${this.player.assists}</div>
      <button id="again">回到选人界面</button></div>`;
    $('#again').onclick = () => this.app.backToSelect();
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (this.paused) return;
    const W = this.world;
    if (!this.over) {
      this.time += dt;
      this.waveT -= dt;
      if (this.waveT <= 0) { this.waveT = 30; this.spawnWave(); }
      for (const b of this.bots) b.update(dt);
      if (this.time > 20) for (const u of W.units) if (u.kind === 'hero') { if (!u.dead) u.gainXp(2 * dt); u.gold += 2.6 * dt; }
      this.shopT = (this.shopT || 0) - dt;
      if (this.shopT <= 0) { this.shopT = 1; for (const b of this.bots) if (b.h.canShop() && !b.h.isPlayerBot) this.botShop(b.h); }
    }
    if (this.rightDown && !this.over) { this.rdT = (this.rdT || 0) - dt; if (this.rdT <= 0) { this.rdT = 0.15; this.rightClick(false); } }
    W.update(this.over ? dt * 0.3 : dt);
    // 泉水激光
    for (const u of W.units) {
      if (u.kind !== 'hero' || u.dead) continue;
      const ef = FOUNTAIN[3 - u.team];
      if (Math.hypot(u.pos.x - ef.x, u.pos.z - ef.z) < 9) {
        W.damage(null, u, 400 * dt, { type: 'true', noText: true });
        if (Math.random() < dt * 8) W.vfx.beam(new THREE.Vector3(ef.x, 4, ef.z), new THREE.Vector3(u.pos.x, 1.2, u.pos.z), { width: 0.5, color: TEAM_COL[3 - u.team], dur: 0.2 });
      }
    }
    this.processEvents();
    this.map.update(dt, W.time);
    // 镜头
    const p = this.player;
    if (this.locked) this.camTarget.lerp(new THREE.Vector3(p.pos.x, 0, p.pos.z), Math.min(1, dt * 8));
    else {
      const m = 24, sp = 55 * dt * this.zoom;
      if (this.mouse.x < m) this.camTarget.x -= sp; if (this.mouse.x > innerWidth - m) this.camTarget.x += sp;
      if (this.mouse.y < m) this.camTarget.z -= sp; if (this.mouse.y > innerHeight - m) this.camTarget.z += sp;
    }
    this.camTarget.x = Math.max(-HALF + 8, Math.min(HALF - 8, this.camTarget.x));
    this.camTarget.z = Math.max(-HALF + 4, Math.min(HALF - 2, this.camTarget.z));
    const sh = W.vfx.shakeAmt;
    const z = this.zoom;
    this.camera.position.set(this.camTarget.x + (Math.random() - 0.5) * sh, 31 * z, this.camTarget.z + 20 * z + (Math.random() - 0.5) * sh);
    this.camera.lookAt(this.camTarget.x, 0, this.camTarget.z - 1);
    this.lights.follow(this.camTarget);
    this.updateHUD();
    if (this.shop.isOpen) this.shop.render();
    renderInventory(this, $('#hud-items'));
    // 悬停在敌人身上时鼠标变成红色攻击手势
    this.curT = (this.curT || 0) - dt;
    if (this.curT <= 0) {
      this.curT = 0.08;
      const u = this.hoverUnit = this.pickUnit(this.mouse.x, this.mouse.y);
      setCursor(u ? (u.team === this.player.team ? 'ally' : 'attack') : this.keeperAt(this.mouse.x, this.mouse.y) ? 'ally' : 'normal');
    }
    this.fogT -= dt;
    if (this.fogT <= 0) { this.fogT = 0.1; this.updateFog(); }
    this.updateIndicator();
    this.updateKeepers(dt);
    this.updateTargetPanel();
  }
  render(renderer) {
    renderer.render(this.scene, this.camera);
    this.app.overlay.draw(this.world, this.camera, this.player);
    const p = this.player;
    if (this.mmDest && (p.dead || !p.path || !p.path.length || p.order?.type !== 'move')) this.mmDest = null;
    this.minimap.route = this.mmDest ? { from: p.pos, pts: p.path, dest: this.mmDest } : null;
    this.minimap.draw(this.world, this.player, this.camTarget, this.heroImgs);
  }
  // 技能瞄准 / 悬停技能图标时显示范围；普攻范围在指向敌人、按住 A 或常显时显示
  updateIndicator() {
    const p = this.player, key = this.aiming || this.hoverKey;
    const sk = key && p.def.skills.find(s => s.key === key);
    if (sk && !p.dead) {
      const aim = this.groundAt(this.mouse.x, this.mouse.y);
      const needTarget = sk.aim === 'unit' || sk.aim === 'ally';
      const tgt = needTarget ? p.findTarget(sk, aim, this.hoverUnit) : null;
      const valid = p.ranks[key] > 0 && p.cds[key] <= 0 && p.mana >= p.costOf(sk) && (!needTarget || !!tgt);
      this.ind.showSkill(p, sk, aim, tgt, valid);
    } else this.ind.hideSkill();
    const enemyHover = this.hoverUnit && this.hoverUnit.team !== p.team;
    this.ind.showAttack(p, this.showAtk || this.aHeld || enemyHover);
  }
  // 右上角目标面板：正在攻击 > 鼠标指着 > 最近 4 秒内打过的敌人
  currentTarget() {
    const p = this.player, W = this.world;
    const o = p.order;
    if (o && o.type === 'attack' && o.target && o.target.targetable && o.target.team !== p.team) return o.target;
    if (this.hoverUnit && this.hoverUnit.team !== p.team && this.hoverUnit.targetable) return this.hoverUnit;
    const t = W.playerTarget;
    if (t && !t.dead && !t.removed && !t.inFog && W.time - W.playerTargetT < 4) return t;
    return null;
  }
  updateTargetPanel() {
    const el = $('#target-panel'), t = this.currentTarget();
    if (!t) { if (!el.classList.contains('hidden')) { el.classList.add('hidden'); this.tpId = null; } return; }
    el.classList.remove('hidden');
    const hero = t.kind === 'hero';
    const KIND = { minion: t.type === 'caster' ? '远程小兵' : '近战小兵', tower: '防御塔', inhib: '召唤水晶', nexus: '主水晶', dummy: '训练假人', pet: '提伯斯' };
    const team = t.team === 0 ? '中立' : t.team === this.player.team ? '友方' : '敌方';
    if (this.tpId !== t.id) {
      this.tpId = t.id;
      const pic = hero ? `<img src="${this.app.portraits[t.def.id]}">` : `<i style="background:${TCOL[t.team] || '#9a7ad0'}">${{ minion: '兵', tower: '塔', inhib: '晶', nexus: '核', monster: '怪', pet: '熊' }[t.kind] || '?'}</i>`;
      const stat = (k, n, src) => `<div title="${n}"><img src="${src}"><span data-t="${k}"></span></div>`;
      const ic = this.app.itemIcons;
      el.innerHTML = `<div class="tp-head">${pic}<div class="tp-name"><b>${hero ? t.def.name : (t.name || KIND[t.kind] || t.kind)}</b><small>${hero ? t.def.title + ' · ' : ''}${team}</small></div>${hero ? '<em data-t="lvl"></em>' : ''}</div>
        <div class="tp-bar hp"><i></i><span></span></div>${hero && !t.manaless ? '<div class="tp-bar mp"><i></i><span></span></div>' : ''}
        <div class="tp-stats">${stat('ad', '攻击力', ic.longsword)}${hero ? stat('ap', '法术强度', ic.tome) + stat('armor', '护甲', ic.cloth) + stat('mr', '魔法抗性', ic.cloak) + stat('as', '攻击速度', ic.dagger) + stat('ms', '移动速度', ic.boots) : stat('range', '攻击距离', ic.runaan)}</div>
        ${hero ? '<div class="tp-items"></div><div class="tp-kda"></div>' : ''}`;
      this.tpSig = '';
    }
    const q = (s) => el.querySelector(s);
    q('.tp-bar.hp i').style.width = Math.max(0, t.hp / t.maxHp * 100) + '%';
    q('.tp-bar.hp span').textContent = `${Math.ceil(t.hp)} / ${Math.round(t.maxHp)}`;
    const set = (k, v) => { const s = q(`[data-t="${k}"]`); if (s && s.textContent !== String(v)) s.textContent = v; };
    set('ad', Math.round(t.kind === 'tower' ? 150 : t.ad));
    if (hero) {
      if (!t.manaless) { q('.tp-bar.mp i').style.width = (t.mana / t.maxMana * 100) + '%'; q('.tp-bar.mp span').textContent = `${Math.floor(t.mana)} / ${Math.round(t.maxMana)}`; }
      set('lvl', t.level); set('ap', Math.round(t.ap)); set('armor', Math.round(t.armor)); set('mr', Math.round(t.mr));
      set('as', (t.atkSpeed * t.atkMul).toFixed(2)); set('ms', Math.round(t.speed * 50));
      const sig = t.items.map(i => i ? i.id : '-').join() + '|' + t.kills + t.deaths + t.assists;
      if (sig !== this.tpSig) {
        this.tpSig = sig;
        q('.tp-items').innerHTML = t.items.map(i => i ? `<img title="${ITEM_BY_ID[i.id].name}" src="${this.app.itemIcons[i.id]}">` : '<u></u>').join('');
        q('.tp-kda').textContent = `战绩 ${t.kills} / ${t.deaths} / ${t.assists}`;
      }
    } else set('range', t.range ? t.range.toFixed(1) : '-');
  }
  // 老板：平时拨算盘，玩家走近时转身招手
  updateKeepers(dt) {
    const p = this.player;
    for (const k of this.keepers) {
      const near = !p.dead && k.team === p.team && Math.hypot(p.pos.x - k.pos.x, p.pos.z - k.pos.z) < 10;
      const target = near ? Math.atan2(p.pos.x - k.rig.root.position.x, p.pos.z - k.rig.root.position.z) : k.face;
      let d = Math.atan2(Math.sin(target - k.rig.root.rotation.y), Math.cos(target - k.rig.root.rotation.y));
      k.rig.root.rotation.y += d * Math.min(1, dt * 4);
      if (near && !k.wasNear) { k.rig.play('raise', 0.9); this.world.vfx.comic({ x: k.rig.root.position.x, z: k.rig.root.position.z }, '欢迎光临!', { color: '#ffe27a', size: 2, y: 4.2 }); }
      k.wasNear = near;
      k.rig.update(dt, { moving: false });
    }
    if (this.pendingShop && p.canShop()) { this.pendingShop = false; p.stop(); this.shop.open(); }
  }
  keeperReact(text, happy = true) {
    const k = this.keepers.find(k => k.team === this.player.team);
    if (!k) return;
    k.rig.play(happy ? 'flex' : 'hit', happy ? 0.7 : 0.4);
    const pos = { x: k.rig.root.position.x, z: k.rig.root.position.z };
    this.world.vfx.comic(pos, text, { color: happy ? '#ffe27a' : '#ff8a7a', size: 1.8, y: 4.2 });
    if (happy) this.world.vfx.puff(pos, { n: 10, color: '#f0c840', cell: 'star', size: 0.4, speed: 3, up: 2, y: 2.2 });
  }
  // 红蓝 buff：持续 90 秒，击杀持有者可以抢走
  giveJungleBuff(h, kind, dur = 90) {
    const W = this.world, id = kind + 'Buff';
    h.addBuff(id, dur, kind === 'blue' ? { cdrBuff: 0.1, mpRegen: 6 } : { hpRegenPct: 0.01, onHit: (W, hh, t) => {
      W.damage(hh, t, 8 + hh.level * 2, { type: 'true', noText: true, item: true }); W.cc(t, 'slow', 1.5, { pct: 0.15, id: 'redBuff' });
      if (Math.random() < 0.5) W.vfx.puff(t.pos, { n: 3, color: ['#ffb030', '#ff5a20'], cell: 'flame', size: 0.4, y: 1 });
    } });
    const b = h.buff(id);
    if (b.fx) b.fx.kill = true;
    b.fx = W.vfx.aura(h, { color: kind === 'blue' ? '#7fe0ff' : '#ff6a3a', glow: true, r: 1.2, dur, particles: 5, pcolor: kind === 'blue' ? '#bff0ff' : '#ffb070' });
    b.keepOnDeath = false;
    if (h === this.player) this.toast(kind === 'blue' ? '获得蓝 buff：冷却缩减、快速回蓝' : '获得红 buff：普攻灼烧减速、回血', kind === 'blue' ? '#7fe0ff' : '#ff8a5a');
  }
  // 视野来源：友方英雄、小兵、召唤物、防御建筑和泉水
  visionSources() {
    const team = this.player.team, out = [{ x: FOUNTAIN[team].x, z: FOUNTAIN[team].z, r: 20 }];
    for (const u of this.world.units) {
      if (u.dead || u.removed || u.team !== team) continue;
      const r = u.kind === 'hero' ? 14 : u.kind === 'minion' ? 8 : u.kind === 'pet' ? 8 : u.kind === 'tower' ? 13 : u.isStructure ? 10 : 0;
      if (r) out.push({ x: u.pos.x, z: u.pos.z, r });
    }
    return out;
  }
  updateFog() {
    const src = this.visionSources(), c = this.fogCanvas.getContext('2d'), N = 128, k = N / 220;
    c.globalCompositeOperation = 'source-over'; c.fillStyle = '#fff'; c.fillRect(0, 0, N, N);
    c.globalCompositeOperation = 'darken';
    for (const s of src) {
      const x = (s.x + 110) * k, y = (s.z + 110) * k, r = s.r * k;
      const gr = c.createRadialGradient(x, y, r * 0.7, x, y, r);
      gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
    this.fogTex.needsUpdate = true;
    // 小地图迷雾：没有视野的地方盖一层暗色
    const mm = this.fogMini || (this.fogMini = Object.assign(document.createElement('canvas'), { width: 220, height: 220 }));
    const m = mm.getContext('2d'), mk = 220 / 220;
    m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, 220, 220);
    m.fillStyle = 'rgba(20,18,40,0.5)'; m.fillRect(0, 0, 220, 220);
    m.globalCompositeOperation = 'destination-out';
    for (const s of src) { m.beginPath(); m.arc((s.x + 110) * mk, (s.z + 110) * mk, s.r * mk, 0, 7); m.fill(); }
    this.minimap.fog = mm;
    // 视野外的敌方单位与野怪看不见（防御建筑除外）
    for (const u of this.world.units) {
      if (u.team === this.player.team || u.removed) continue;
      if (u.isStructure) { u.inFog = false; continue; }
      let vis = false;
      for (const s of src) if (Math.hypot(u.pos.x - s.x, u.pos.z - s.z) < s.r + (u.radius || 0.5) * 0.5) { vis = true; break; }
      u.inFog = !vis;
      if (!u.dead) u.obj.visible = vis && !(u.kind === 'hero' && u.has('untargetable'));
    }
    const o = this.player.order;
    if (o && o.type === 'attack' && o.target && o.target.inFog) this.player.stop();
  }
  useItem(i) {
    const r = this.player.useItem(i);
    if (r === 'active') this.hint('药水效果还在持续中');
    else if (r === 'passive') this.hint('这件装备是被动效果，不需要使用');
  }
  // 推荐出装里下一件要买的东西（整件或其中一个组件）
  nextBuy(h) {
    for (const id of BUILDS[h.def.id]) {
      const d = ITEM_BY_ID[id];
      if (d.consumable || h.items.some(x => x && x.id === id)) continue;
      const c = h.costFor(id);
      if (d.boots && h.items.some((x, i) => x && ITEM_BY_ID[x.id].boots && !c.used.includes(i))) continue;
      if (h.gold >= c.cost || !c.missing.length) return { id, price: c.cost };
      const comp = c.missing.slice().sort((a, b) => ITEM_BY_ID[a].price - ITEM_BY_ID[b].price)[0];
      return { id: comp, price: ITEM_BY_ID[comp].price, forItem: id };
    }
    return null;
  }
  nextPrice(h) { const n = this.nextBuy(h); return n ? n.price : 0; }
  // 电脑英雄在泉水时按推荐出装购买
  botShop(h) {
    for (let guard = 0; guard < 6; guard++) {
      // 出门药水最多 2 瓶
      const pot = h.items.find(x => x && x.id === 'potion');
      if (h.level < 6 && (pot ? pot.count : 0) < 2 && h.gold >= 50 && h.gold < 500 && h.items.indexOf(null) >= 0 && guard === 0) h.buy('potion');
      const n = this.nextBuy(h);
      if (!n || h.gold < n.price) return;
      if (h.items.indexOf(null) < 0 && !n.forItem && !h.costFor(n.id).used.length) {
        // 背包满了：卖掉药水或最便宜的装备腾位置
        let cheap = -1;
        h.items.forEach((x, i) => { if (x && (cheap < 0 || ITEM_BY_ID[x.id].price < ITEM_BY_ID[h.items[cheap].id].price)) cheap = i; });
        if (cheap < 0 || ITEM_BY_ID[h.items[cheap].id].price >= ITEM_BY_ID[n.id].price) return;
        h.sell(cheap);
      }
      if (h.buy(n.id) !== 'ok') return;
    }
  }
  dispose() {
    FOG.amt.value = 0; FOG.tex.value = null;
    document.body.classList.remove('dead');
    this.shop.close();
    this.ind.dispose();
    for (const k of this.keepers) { this.scene.remove(k.rig.root); this.scene.remove(k.stall); }
    setCursor('normal');
    this.app.sound.listener = null;
    this.app.sound.startMusic('select');
    this.unbind();
    $('#hud').classList.add('hidden');
    $('#endscreen').classList.add('hidden');
    $('#pause').classList.add('hidden');
    this.scene.traverse(o => { if (o.geometry && o.isInstancedMesh) o.dispose && o.dispose(); });
  }
}
