// 选人界面的 3D 展台：展示英雄建模、动作和技能特效。
import * as THREE from 'three';
import { World } from './world.js';
import { Hero, Dummy } from './units.js';
import { HEROES, HERO_BY_ID } from './heroes.js';
import { P, G, toon, canvasTex, rng, INK } from './toon-kit.js';
import { treeGeometries } from './props.js';
import { shopkeeperRig } from './hero-models.js';
import { makeLights } from './game.js';

function stageGround() {
  return canvasTex(1024, 1024, (g) => {
    const r = rng(3);
    g.fillStyle = '#8cc262'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 500; i++) { g.globalAlpha = 0.25; g.fillStyle = ['#9fd174', '#7ab556', '#a9d77f'][i % 3]; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 20 + r() * 60, 15 + r() * 40, r() * 3, 0, 7); g.fill(); }
    g.globalAlpha = 0.5;
    for (let i = 0; i < 6000; i++) {
      const x = r() * 1024, y = r() * 1024; g.strokeStyle = i % 3 ? '#5f9a44' : '#c6e89c'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 3, y - 6, x + 1, y - 12); g.stroke();
    }
    g.globalAlpha = 1;
    // 圆形石台
    g.fillStyle = '#d8cbb0'; g.beginPath(); g.arc(512, 512, 250, 0, 7); g.fill();
    g.strokeStyle = 'rgba(120,100,70,.5)'; g.lineWidth = 3;
    for (let k = 1; k < 5; k++) { g.beginPath(); g.arc(512, 512, k * 55, 0, 7); g.stroke(); }
    for (let a = 0; a < 24; a++) { g.beginPath(); g.moveTo(512 + Math.cos(a / 24 * 6.283) * 55, 512 + Math.sin(a / 24 * 6.283) * 55); g.lineTo(512 + Math.cos(a / 24 * 6.283) * 250, 512 + Math.sin(a / 24 * 6.283) * 250); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.arc(512, 512, 252, 0, 7); g.stroke();
    g.strokeStyle = '#e8c25a'; g.lineWidth = 8; g.beginPath(); g.arc(512, 512, 236, 0, 7); g.stroke();
  }, { aniso: 8 });
}

function skyTexture() {
  return canvasTex(512, 512, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#bfe6f5'); gr.addColorStop(0.6, '#f6ecd2'); gr.addColorStop(1, '#f3dcb0');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    const r = rng(9);
    for (let i = 0; i < 7; i++) {
      const x = r() * 512, y = 40 + r() * 180, s = 20 + r() * 30;
      g.fillStyle = 'rgba(255,255,255,.9)'; g.strokeStyle = 'rgba(43,27,20,.35)'; g.lineWidth = 2;
      for (const [dx, dy, rr] of [[0, 0, 1], [s * 0.9, 4, 0.8], [-s * 0.9, 6, 0.75], [s * 0.4, -s * 0.5, 0.8]]) { g.beginPath(); g.arc(x + dx, y + dy, s * rr, 0, 7); g.fill(); }
    }
  });
}

const HOME = { x: 0.5, z: 1 };

export class Stage {
  constructor(app) {
    this.app = app;
    const scene = this.scene = new THREE.Scene();
    scene.background = skyTexture();
    this.lights = makeLights(scene, 2048, 20);
    this.lights.follow({ x: 0, z: 0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), toon('#ffffff', { map: stageGround() }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), toon('#7ab556'));
    far.rotation.x = -Math.PI / 2; far.position.y = -0.03; scene.add(far);
    this.decorate();
    this.world = new World(scene, { boundR: 13.5 });
    this.world.respawnPoint = () => ({ x: 0, z: 0 });
    this.world.cdMul = 3;
    this.dummies = [
      this.world.add(new Dummy(this.world, -2.8, -4)),
      this.world.add(new Dummy(this.world, 0.8, -5)),
      this.world.add(new Dummy(this.world, 3.8, -3.2)),
    ];
    for (const d of this.dummies) d.facing = Math.atan2(HOME.x - d.pos.x, HOME.z - d.pos.z);
    this.camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.5, 500);
    this.hero = null; this.lineup = [];
    this.angle = 0; this.drag = null;
    this.camMode = 'hero';
    this.idleT = 0;
    const cv = app.renderer.domElement;
    this.onDown = (e) => { if (e.button === 0 && !this.app.game) this.drag = { x: e.clientX, a: this.angle }; };
    this.onMove = (e) => { if (this.drag) this.angle = this.drag.a + (e.clientX - this.drag.x) * 0.01; };
    this.onUp = () => { this.drag = null; };
    cv.addEventListener('mousedown', this.onDown);
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mouseup', this.onUp);
  }
  decorate() {
    const geos = treeGeometries(), r = rng(12);
    const place = (type, x, z, s, col) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = r() * 6;
      P(geos[type].canopy, col, { parent: g, ol: 0.04 });
      if (geos[type].trunk) P(geos[type].trunk, '#7a5236', { parent: g, ol: 0.04 });
      this.scene.add(g);
    };
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2, d = 18 + r() * 16;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (z > 6 && Math.abs(x) < 30) continue;
      place(r() < 0.4 ? 'pine' : 'round', x, z, 1.4 + r() * 1.2, ['#5aa04a', '#6ab356', '#3f8a44', '#78b85a'][i % 4]);
    }
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = 12 + r() * 5;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (z > 4) continue;
      place(r() < 0.3 ? 'rock' : 'bush', x, z, 0.8 + r() * 0.6, r() < 0.3 ? '#a89c8a' : '#6ab356');
    }
    // 旗帜
    for (const [x, z, c] of [[-10, -10, '#4f86d9'], [10, -10, '#d9574f']]) {
      P(G.cyl(0.1, 0.12, 5, 8), '#8a5a3c', { parent: this.scene, pos: [x, 2.5, z] });
      P(G.box(1.4, 2, 0.05), c, { parent: this.scene, pos: [x + 0.72, 3.8, z] });
    }
  }
  show(id) {
    this.clearLineup();
    if (this.hero) { this.world.remove(this.hero); if (this.hero.tibbers) this.world.remove(this.hero.tibbers); }
    const h = this.hero = this.world.add(new Hero(this.world, HERO_BY_ID[id], 1, HOME.x, HOME.z));
    h.facing = 0.35; this.idleT = 0;
    // 展台上直接给中期等级和已学技能，法力不限
    h.setLevel(9); h.ranks = { Q: 5, W: 2, E: 2, R: 1 }; h.points = 0; h.freeMana = true;
    this.world.vfx.puff(h.pos, { n: 18, color: '#ffffff', cell: 'puff', size: 1.3, speed: 3, y: 0.3 });
    this.world.vfx.ring(h.pos, { r1: 3.5, color: HERO_BY_ID[id].color });
    h.rig.play('flex', 0.7);
    this.camMode = 'hero';
  }
  clearLineup() {
    for (const u of this.lineup) this.world.remove(u);
    this.lineup = [];
  }
  showLineup() {
    this.clearLineup();
    if (this.hero) this.hero.obj.visible = false;
    HEROES.forEach((d, i) => {
      const row = Math.floor(i / 10), col = i % 10;
      const u = new Hero(this.world, d, 1, (col - 4.5) * 2.3 + (row % 2) * 1.15 + 1.4, 3.6 - row * 3.4);
      u.facing = 0;
      this.world.add(u);
      this.lineup.push(u);
      this.world.after(0.06 * i, () => { u.rig.play(['flex', 'raise', 'twirl', 'slash'][i % 4], 0.8); this.world.vfx.puff(u.pos, { n: 10, color: '#ffffff', cell: 'puff', size: 1, y: 0.3 }); });
    });
    this.camMode = 'lineup';
  }
  preview(key, forced) {
    const h = this.hero;
    if (!h || h.dead) return;
    if (this.camMode === 'lineup') { this.clearLineup(); h.obj.visible = true; this.camMode = 'hero'; }
    h.cds[key] = 0; h.castLock = 0;
    this.idleT = 0;
    const d = forced || this.dummies[Math.floor(Math.random() * 2)];
    if (key === 'A') { h.orderAttack(d); this.attackT = 2.5; return; }
    if (key === 'RUN') { this.runT = 3; return; }
    const sk = h.def.skills.find(s => s.key === key);
    let aim = { x: d.pos.x, z: d.pos.z };
    // 自我增益、位移类技能在原地展示
    if (sk.id === 'escape' || (h.def.id === 'caitlyn' && key === 'E')) aim = { x: d.pos.x, z: d.pos.z };
    if (h.def.id === 'malphite' && key === 'R') aim = { x: d.pos.x, z: d.pos.z + 1.5 };
    if (h.def.id === 'ahri' && key === 'R') { h.ahriR = null; }
    if (h.def.id === 'yasuo' && key === 'R') this.world.cc(d, 'knockup', 1); // 狂风绝息斩需要被击飞的目标
    if (h.def.id === 'leesin' && key === 'Q') h.leeQ = null;
    // 近身范围技能：先走到假人身边再放
    if (sk.aim === 'self' && sk.ai === 'close' && Math.hypot(h.pos.x - d.pos.x, h.pos.z - d.pos.z) > 3) {
      const dx = h.pos.x - d.pos.x, dz = h.pos.z - d.pos.z, l = Math.hypot(dx, dz);
      h.orderMove(d.pos.x + dx / l * 2, d.pos.z + dz / l * 2);
      this.pending = { key, d, t: 2 };
      return;
    }
    const res = h.cast(key, aim, d);
    if (res === 'ok' && sk.aim === 'self' && h.def.id !== 'garen') {
      // 自身增益后打一下假人，展示强化普攻
      this.world.after((sk.wind || 0) + 0.5, () => { if (this.hero === h) { h.orderAttack(d); this.attackT = 2.2; } });
    }
    if (h.def.id === 'garen' && key === 'Q') this.world.after(0.4, () => { if (this.hero === h) { h.orderAttack(d); this.attackT = 2; } });
    if (h.def.id === 'garen' && key === 'E') { h.orderMove(-1.2, -3.2); this.world.after(1.4, () => { if (this.hero === h) h.orderMove(2.4, -2.8); }); }
  }
  update(dt) {
    const W = this.world, h = this.hero;
    W.update(dt);
    if (h && !h.dead) {
      this.idleT += dt;
      if (this.pending) {
        const p = this.pending;
        p.t -= dt;
        if (!h.path || p.t <= 0) { this.pending = null; h.stop(); h.face(p.d.pos.x, p.d.pos.z); h.facing = h.faceTarget; this.preview(p.key, p.d); }
      }
      if (this.attackT > 0) { this.attackT -= dt; if (this.attackT <= 0) { h.stop(); } }
      if (this.runT > 0) {
        this.runT -= dt;
        const a = W.time * 1.2;
        if (!h.path || h.path.length === 0) h.orderMove(Math.cos(a) * 5, Math.sin(a) * 5);
        if (this.runT <= 0) h.orderMove(HOME.x, HOME.z);
      }
      // 空闲时回到展台中间并面向镜头
      if (this.idleT > 3 && !h.path && !h.order && h.castLock <= 0) {
        if (Math.hypot(h.pos.x - HOME.x, h.pos.z - HOME.z) > 0.5) h.orderMove(HOME.x, HOME.z);
        else { h.faceTarget = Math.atan2(this.camera.position.x - h.pos.x, this.camera.position.z - h.pos.z); }
      }
      if (h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.2 * dt);
    }
    for (const u of this.lineup) { if (!u.rig.action && Math.random() < dt * 0.15) u.rig.play(['flex', 'raise', 'twirl', 'slash', 'throw'][Math.floor(Math.random() * 5)], 0.8); }
    // 镜头
    const lineup = this.camMode === 'lineup';
    const R = lineup ? 33 : 15.5, ht = lineup ? 14 : 6;
    const a = this.angle + (lineup ? 0 : 0.25);
    const cx = Math.sin(a) * R, cz = Math.cos(a) * R;
    this.camera.position.lerp(new THREE.Vector3(cx, ht, cz), Math.min(1, dt * 4));
    if (lineup) this.camera.lookAt(1.4, 1.2, 0);
    else this.camera.lookAt(1.5, 1.2, -1.8);
  }
  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
  render(renderer) {
    renderer.render(this.scene, this.camera);
    this.app.overlay.draw(this.world, this.camera, this.hero, true);
  }
  dispose() {
    const cv = this.app.renderer.domElement;
    cv.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
  }
}

// 头像：在主画布左下角渲染英雄头部，再拷贝到 2D 画布（颜色与游戏画面完全一致）
export function renderPortraits(renderer) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff6e6', '#9a8a70', 1.4));
  const sun = new THREE.DirectionalLight('#fff0d8', 2.2); sun.position.set(-2, 4, 5); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const S = 256, cv = renderer.domElement, dpr = renderer.getPixelRatio();
  const out = {};
  const fake = { walkable: () => true, findPath: () => [] };
  renderer.setScissorTest(true);
  renderer.setViewport(0, 0, S, S); renderer.setScissor(0, 0, S, S);
  const list = [...HEROES.map(d => ({ id: d.id, color: d.color, rig: () => new Hero(fake, d, 1, 0, 0).rig })), { id: 'shopkeeper', color: '#e8b84a', rig: shopkeeperRig }];
  for (const d of list) {
    const rig = d.rig(), hero = { rig, obj: rig.root };
    hero.rig.update(0.016, { moving: false });
    scene.add(hero.obj);
    hero.obj.updateMatrixWorld(true);
    const hp = new THREE.Vector3(); hero.rig.head.getWorldPosition(hp);
    const R = hero.rig.s.headR * hero.rig.s.scale;
    cam.position.set(hp.x + R * 1.6, hp.y + R * 0.3, hp.z + R * 5.2);
    cam.lookAt(hp.x, hp.y - R * 0.35, hp.z);
    scene.background = new THREE.Color(d.color).lerp(new THREE.Color('#f3e6c8'), 0.55);
    renderer.render(scene, cam);
    scene.remove(hero.obj);
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.drawImage(cv, 0, cv.height - S * dpr, S * dpr, S * dpr, 0, 0, S, S);
    g.strokeStyle = INK; g.lineWidth = 10; g.strokeRect(0, 0, S, S);
    out[d.id] = c.toDataURL();
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, cv.width / dpr, cv.height / dpr);
  return out;
}
