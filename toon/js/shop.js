// 商店与背包界面：合成路线、预定、双击购买、钱不够时先买组件。
import { ITEMS, ITEM_BY_ID, CATS, BUILDS, fmtStat, sellPrice } from './items.js';

const $ = (s) => document.querySelector(s);
// 老板的台词
const LINES = {
  hello: ['客官里边请！好装备，童叟无欺～', '今天进货的新刀，锋利得很！', '买一件，推一座塔，划算！', '哎呀，又是你！老顾客，看看这边～'],
  buy: ['好眼光！这件保准你一路赢到底。', '谢谢惠顾，常来啊！', '爽快！下次给你留最好的货。', '拿好拿好，别让对面看见了！'],
  part: ['先拿个小件垫垫底，攒够了再来合成！', '一步一步来，组件先拿走～', '小件先买，大件我给你留着！'],
  reserve: ['好嘞，这件给你留着，钱够了自动送到！', '记下啦！攒够钱回来就是你的。'],
  sell: ['回收价，童叟无欺。', '行，这件我收了。', '以旧换新，更上一层楼！'],
  gold: ['钱不够？先去补几个兵吧～', '小本生意，概不赊账哦。', '再攒攒，这件给你留着！'],
  far: ['隔着这么远可做不了买卖，回城来找我！', '先回泉水，老板在这儿等你～'],
  full: ['包里塞满啦，先卖掉点东西吧。'],
  boots: ['一个人只能穿一双鞋，贪多嚼不烂！'],
  unique: ['这件你已经有啦，一件就够用。'],
};
const REASON = { far: '需要回到泉水才能购买', gold: '金币不足', boots: '只能拥有一双鞋子', unique: '这件装备只能拥有一件', full: '装备栏已满' };
const INTO = {};
for (const it of ITEMS) for (const c of new Set(it.from || [])) (INTO[c] = INTO[c] || []).push(it.id);

// 不花钱地算一下：现在点购买会买到什么？整件 / 某个组件 / 买不起
export function planBuy(h, id) {
  const d = ITEM_BY_ID[id], { cost, missing } = h.costFor(id);
  if (h.gold >= cost) return { type: 'full', id, cost };
  const hasBoots = h.items.some(x => x && ITEM_BY_ID[x.id].boots);
  const comps = missing.map(c => ITEM_BY_ID[c]).filter(c => !(c.boots && hasBoots)).sort((a, b) => b.price - a.price);
  for (const c of comps) {
    const sub = planBuy(h, c.id);
    if (sub) return { type: 'part', id: sub.id, cost: sub.cost, for: d.id };
  }
  return null;
}
// 智能购买：钱够买整件就买整件；只够小件时优先买得起的组件（从贵到便宜），一步步凑齐
export function smartBuy(h, id) {
  const bought = [];
  let res = 'gold';
  for (let guard = 0; guard < 8; guard++) {
    const plan = planBuy(h, id);
    if (!plan) break;
    const r = h.buy(plan.id);
    if (r !== 'ok') { res = r; break; }
    bought.push(plan.id);
    if (plan.type === 'full') return { res: 'ok', bought, done: true };
  }
  if (bought.length) return { res: 'part', bought, done: false };
  const r = h.buy(id); // 拿到真正的失败原因（金币不足、背包满……）
  if (r === 'ok') return { res: 'ok', bought: [id], done: true };
  return { res: r === 'gold' ? res : r, bought, done: false };
}

export class Shop {
  constructor(game) {
    this.g = game; this.app = game.app;
    this.el = $('#shop');
    this.cat = 'rec';
    this.sel = null;
    this.el.innerHTML = `<div class="shop-card paper-panel">
      <div class="shop-boss"><img src="${this.app.portraits.shopkeeper}"><p class="bubble"></p></div>
      <header><h2>商店</h2><span class="shop-gold"></span><span class="shop-where"></span><span class="shop-res hidden"></span><button class="shop-x" title="关闭 (P)">×</button></header>
      <nav class="shop-tabs">${CATS.map(c => `<button data-c="${c.id}">${c.name}</button>`).join('')}</nav>
      <div class="shop-body"><div class="shop-grid"></div><aside class="shop-detail"></aside></div>
      <footer><span>单击查看 · 双击或右键购买（钱不够时先买组件） · 📌 预定后攒够钱自动购买 · 背包里右键出售</span><div class="shop-inv"></div></footer></div>`;
    this.el.querySelector('.shop-x').onclick = () => this.close();
    this.el.querySelectorAll('.shop-tabs button').forEach(b => b.onclick = () => { this.cat = b.dataset.c; this.sig = ''; this.render(); this.app.sound.play('click'); });
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.el.onclick = (e) => { if (e.target === this.el) this.close(); };
    // 装备格与合成树节点：单击选中、快速点两下购买（自己判断双击，界面重绘也不会丢）、右键购买
    this.lastClick = { id: null, t: 0 };
    const body = this.el.querySelector('.shop-body');
    body.addEventListener('click', (e) => {
      const el = e.target.closest('[data-id]');
      if (!el) return;
      const id = el.dataset.id, now = performance.now();
      if (this.lastClick.id === id && now - this.lastClick.t < 400) { this.lastClick.id = null; this.buy(id); return; }
      this.lastClick = { id, t: now };
      if (this.sel !== id) { this.sel = id; this.showDetail(); this.app.sound.play('click'); }
    });
    body.addEventListener('contextmenu', (e) => {
      const el = e.target.closest('[data-id]');
      if (el) { this.sel = el.dataset.id; this.buy(el.dataset.id); }
    });
    this.el.querySelector('.shop-res').onclick = () => { const p = this.g.player; if (p.reserve) { this.sel = p.reserve; this.showDetail(); } };
    this.sig = '';
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  say(list) {
    const t = Array.isArray(list) ? list[Math.floor(Math.random() * list.length)] : list;
    const b = this.el.querySelector('.bubble');
    b.textContent = t; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }
  open(sel) {
    if (sel) this.sel = sel;
    this.el.classList.remove('hidden'); this.sig = ''; this.gridSig = ''; this.render(); this.app.sound.play('click');
    const p = this.g.player;
    this.say(p.canShop() ? LINES.hello : LINES.far);
  }
  close() { this.el.classList.add('hidden'); }
  toggle() { this.isOpen ? this.close() : this.open(); }
  list() {
    if (this.cat === 'rec') return BUILDS[this.g.player.def.id].filter((id, i, a) => a.indexOf(id) === i).map(id => ITEM_BY_ID[id]);
    return ITEMS.filter(i => i.cat === this.cat);
  }
  buy(id) {
    const p = this.g.player, r = smartBuy(p, id);
    if (r.res === 'ok' || r.res === 'part') {
      this.say(r.res === 'ok' ? LINES.buy : LINES.part);
      this.g.keeperReact(['谢谢惠顾!', '成交!', '常来啊!'][Math.floor(Math.random() * 3)]);
      this.app.sound.play('buy');
      this.g.world.vfx.puff(p.pos, { n: 10, color: '#ffd23c', cell: 'star', size: 0.45, speed: 2, up: 1.5, y: 1.5 });
      if (r.res === 'part') this.g.hint(`金币只够小件，先买了：${r.bought.map(x => ITEM_BY_ID[x].name).join('、')}`);
      if (r.done && p.reserve === id) { p.reserve = null; this.g.hint(`预定的「${ITEM_BY_ID[id].name}」已买到`); }
    } else {
      this.say(LINES[r.res] || LINES.gold);
      this.app.sound.play('error'); this.g.hint(REASON[r.res] || '无法购买');
    }
    this.sig = '';
  }
  toggleReserve(id) {
    const p = this.g.player;
    if (p.reserve === id) { p.reserve = null; this.app.sound.play('click'); }
    else { p.reserve = id; this.say(LINES.reserve); this.app.sound.play('pop'); }
    this.sig = ''; this.render();
  }
  sell(slot) {
    const p = this.g.player, res = p.sell(slot);
    if (res === 'ok') { this.app.sound.play('sell'); this.say(LINES.sell); }
    else { this.say(LINES[res] || LINES.far); this.app.sound.play('error'); this.g.hint(REASON[res] || '无法出售'); }
    this.sig = '';
  }
  // 合成树：已拥有的组件打勾，点节点可查看、双击可购买
  tree(id, owned, root = false) {
    const d = ITEM_BY_ID[id];
    let have = false;
    const k = root ? -1 : owned.indexOf(id);
    if (k >= 0) { owned.splice(k, 1); have = true; }
    const kids = have ? [] : (d.from || []).map(c => this.tree(c, owned));
    return `<li><div class="node ${have ? 'have' : ''} ${this.sel === id ? 'cur' : ''}" data-id="${id}" title="${d.name} ${d.price}${have ? '（已拥有）' : ''}"><img src="${this.app.itemIcons[id]}"><b>${d.price}</b>${have ? '<i>✓</i>' : ''}</div>${kids.length ? `<ul>${kids.join('')}</ul>` : ''}</li>`;
  }
  detail(d) {
    const p = this.g.player, { cost, used } = p.costFor(d.id);
    const owned = p.items.filter(Boolean).map(x => x.id);
    const tree = (d.from || []).length ? `<div class="recipe"><h4>合成路线</h4><ul class="tree">${this.tree(d.id, owned, true)}</ul>${used.length ? `<small>已有 ${used.length} 件组件，抵扣 ${d.price - cost} 金币</small>` : ''}</div>` : '';
    const into = (INTO[d.id] || []).length ? `<div class="into"><h4>可合成为</h4>${INTO[d.id].map(x => `<span class="node" data-id="${x}" title="${ITEM_BY_ID[x].name} ${ITEM_BY_ID[x].price}"><img src="${this.app.itemIcons[x]}"></span>`).join('')}</div>` : '';
    const stats = Object.entries(d.stats || {}).map(([k, v]) => `<li>${fmtStat(k, v)}</li>`).join('');
    const plan = planBuy(p, d.id);
    const ownedUnique = d.unique && p.items.some(x => x && x.id === d.id);
    let btn;
    if (ownedUnique) btn = '<button class="buy" disabled>已拥有（独特）</button>';
    else if (plan && plan.type === 'full') btn = '<button class="buy">购买</button>';
    else if (plan) btn = `<button class="buy part">先买组件：${ITEM_BY_ID[plan.id].name}（${plan.cost}）</button>`;
    else btn = `<button class="buy" disabled>还差 ${cost - Math.floor(p.gold)} 金币</button>`;
    const reserved = p.reserve === d.id;
    const canReserve = !d.consumable && !ownedUnique;
    return `<img src="${this.app.itemIcons[d.id]}"><h3>${d.name}</h3><b class="price">${cost < d.price ? `<s>${d.price}</s> ` : ''}${cost} 金币</b>
      <ul>${stats}</ul>${d.desc ? `<p>${d.unique ? '<em>独特：</em>' : ''}${d.desc}</p>` : ''}${tree}${into}
      <div class="btns">${btn}${canReserve ? `<button class="reserve ${reserved ? 'on' : ''}" title="预定后，只要在泉水附近且金币足够就自动购买；钱只够小件时先买组件">${reserved ? '📌 取消预定' : '📌 预定'}</button>` : ''}</div>`;
  }
  showDetail() {
    const d = ITEM_BY_ID[this.sel] || this.list()[0];
    const det = this.el.querySelector('.shop-detail');
    det.innerHTML = d ? this.detail(d) : '';
    if (d) {
      const b = det.querySelector('.buy'); if (b) b.onclick = () => this.buy(d.id);
      const r = det.querySelector('.reserve'); if (r) r.onclick = () => this.toggleReserve(d.id);
    }
    this.el.querySelectorAll('.shop-item').forEach(x => x.classList.toggle('on', x.dataset.id === (d && d.id)));
  }
  // 每帧调用：只有金币/背包/分类变化时才重绘
  render() {
    const p = this.g.player;
    const base = `${this.cat}|${Math.floor(p.gold / 10)}|${p.reserve}|${p.items.map(i => i ? i.id + i.count : '-').join()}|${p.canShop()}`;
    const sig = base + '|' + this.sel;
    if (sig === this.sig) return;
    this.sig = sig;
    this.el.querySelector('.shop-gold').textContent = `💰 ${Math.floor(p.gold)}`;
    const where = this.el.querySelector('.shop-where');
    where.textContent = p.canShop() ? '在泉水中，可以购买' : '离开泉水后只能浏览，回城（B）后才能购买';
    where.classList.toggle('warn', !p.canShop());
    const res = this.el.querySelector('.shop-res');
    if (p.reserve) {
      const r = ITEM_BY_ID[p.reserve], c = p.costFor(r.id).cost;
      res.innerHTML = `📌 <img src="${this.app.itemIcons[r.id]}">${r.name} <small>${Math.min(Math.floor(p.gold), c)}/${c}</small>`;
      res.classList.remove('hidden');
    } else res.classList.add('hidden');
    this.el.querySelectorAll('.shop-tabs button').forEach(b => b.classList.toggle('on', b.dataset.c === this.cat));
    // 装备格只在金币/背包变化时重建，选中状态单独切换，避免双击时元素被替换
    if (base !== this.gridSig) {
      this.gridSig = base;
      const grid = this.el.querySelector('.shop-grid');
      grid.innerHTML = this.list().map(d => {
        const c = p.costFor(d.id).cost, plan = planBuy(p, d.id);
        return `<div class="shop-item ${p.gold >= c ? '' : plan ? 'part' : 'poor'} ${this.sel === d.id ? 'on' : ''} ${p.reserve === d.id ? 'reserved' : ''}" data-id="${d.id}">
        <img src="${this.app.itemIcons[d.id]}"><span>${d.name}</span><b>${c}</b></div>`;
      }).join('');
      const inv = this.el.querySelector('.shop-inv');
      inv.innerHTML = p.items.map((it, i) => it ? `<div class="inv" data-i="${i}" title="${ITEM_BY_ID[it.id].name}（出售 ${sellPrice(ITEM_BY_ID[it.id])} 金币）"><img src="${this.app.itemIcons[it.id]}">${it.count > 1 ? `<b>${it.count}</b>` : ''}</div>` : '<div class="inv empty"></div>').join('');
      inv.querySelectorAll('.inv[data-i]').forEach(el => { el.oncontextmenu = (e) => { e.preventDefault(); this.sell(+el.dataset.i); }; });
    }
    this.showDetail();
  }
}

// 预定的装备：在泉水附近时自动购买（整件或先买组件），返回是否有成交
export function autoBuyReserve(g) {
  const p = g.player;
  if (!p.reserve || !p.canShop()) return false;
  const d = ITEM_BY_ID[p.reserve];
  if (d.unique && p.items.some(x => x && x.id === d.id)) { p.reserve = null; return false; }
  if (!planBuy(p, p.reserve)) return false;
  const r = smartBuy(p, p.reserve);
  if (r.res !== 'ok' && r.res !== 'part') return false;
  g.app.sound.play('buy');
  g.keeperReact('预定到货!');
  g.world.vfx.puff(p.pos, { n: 10, color: '#ffd23c', cell: 'star', size: 0.45, speed: 2, up: 1.5, y: 1.5 });
  if (r.done) { g.hint(`📌 预定的「${d.name}」已自动购买`); p.reserve = null; }
  else g.hint(`📌 为「${d.name}」先买了组件：${r.bought.map(x => ITEM_BY_ID[x].name).join('、')}`);
  if (g.shop.isOpen) g.shop.sig = '';
  return true;
}

// HUD 上的预定栏
export function renderReserve(g, box) {
  const p = g.player;
  const r = p.reserve && ITEM_BY_ID[p.reserve];
  const c = r ? p.costFor(r.id).cost : 0;
  const sig = r ? `${r.id}|${Math.floor(Math.min(p.gold, c) / 10)}|${c}|${p.canShop()}` : '';
  if (sig === g.resSig) return;
  g.resSig = sig;
  if (!r) { box.innerHTML = ''; box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const k = Math.min(1, p.gold / Math.max(1, c));
  box.innerHTML = `<img src="${g.app.itemIcons[r.id]}"><div><i style="width:${k * 100}%"></i></div><span>${k >= 1 ? (p.canShop() ? '可购买' : '回城购买') : '差 ' + Math.ceil(c - p.gold)}</span>`;
  box.title = `预定：${r.name}（${c} 金币）· 左键打开商店 · 右键取消预定`;
  box.onmousedown = (e) => { e.stopPropagation(); if (e.button === 0) g.shop.open(r.id); };
  box.oncontextmenu = (e) => { e.preventDefault(); p.reserve = null; g.resSig = null; };
}

// HUD 上的 6 格背包
export function renderInventory(g, box) {
  const p = g.player;
  const sig = p.items.map(i => i ? i.id + i.count : '-').join();
  if (sig === g.invSig) return;
  g.invSig = sig;
  box.innerHTML = p.items.map((it, i) => {
    if (!it) return `<div class="inv empty"><u>${i + 1}</u></div>`;
    const d = ITEM_BY_ID[it.id];
    const stats = Object.entries(d.stats || {}).map(([k, v]) => fmtStat(k, v)).join('<br>');
    return `<div class="inv" data-i="${i}"><img src="${g.app.itemIcons[it.id]}">${it.count > 1 ? `<b>${it.count}</b>` : ''}<u>${i + 1}</u>
      <div class="tip"><h4>${d.name}</h4><p>${stats}${d.desc ? '<br>' + d.desc : ''}</p><small>${d.consumable ? `左键或按 ${i + 1} 使用 · ` : ''}右键出售（${sellPrice(d)} 金币，需在泉水）</small></div></div>`;
  }).join('');
  box.querySelectorAll('.inv[data-i]').forEach(el => {
    const i = +el.dataset.i;
    el.onmousedown = (e) => { e.stopPropagation(); if (e.button === 0) g.useItem(i); };
    el.oncontextmenu = (e) => { e.preventDefault(); g.shop.sell(i); };
  });
}
