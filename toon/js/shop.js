// 商店与背包界面。
import { ITEMS, ITEM_BY_ID, CATS, BUILDS, fmtStat, sellPrice } from './items.js';

const $ = (s) => document.querySelector(s);
// 老板的台词
const LINES = {
  hello: ['客官里边请！好装备，童叟无欺～', '今天进货的新刀，锋利得很！', '买一件，推一座塔，划算！', '哎呀，又是你！老顾客，看看这边～'],
  buy: ['好眼光！这件保准你一路赢到底。', '谢谢惠顾，常来啊！', '爽快！下次给你留最好的货。', '拿好拿好，别让对面看见了！'],
  sell: ['回收价，童叟无欺。', '行，这件我收了。', '以旧换新，更上一层楼！'],
  gold: ['钱不够？先去补几个兵吧～', '小本生意，概不赊账哦。', '再攒攒，这件给你留着！'],
  far: ['隔着这么远可做不了买卖，回城来找我！', '先回泉水，老板在这儿等你～'],
  full: ['包里塞满啦，先卖掉点东西吧。'],
  boots: ['一个人只能穿一双鞋，贪多嚼不烂！'],
  unique: ['这件你已经有啦，一件就够用。'],
};
const REASON = { far: '需要回到泉水才能购买', gold: '金币不足', boots: '只能拥有一双鞋子', unique: '这件装备只能拥有一件', full: '装备栏已满' };

export class Shop {
  constructor(game) {
    this.g = game; this.app = game.app;
    this.el = $('#shop');
    this.cat = 'rec';
    this.sel = null;
    this.el.innerHTML = `<div class="shop-card paper-panel">
      <div class="shop-boss"><img src="${this.app.portraits.shopkeeper}"><p class="bubble"></p></div>
      <header><h2>商店</h2><span class="shop-gold"></span><span class="shop-where"></span><button class="shop-x" title="关闭 (P)">×</button></header>
      <nav class="shop-tabs">${CATS.map(c => `<button data-c="${c.id}">${c.name}</button>`).join('')}</nav>
      <div class="shop-body"><div class="shop-grid"></div><aside class="shop-detail"></aside></div>
      <footer><span>左键点装备购买 · 背包里右键出售 · 数字键用药水</span><div class="shop-inv"></div></footer></div>`;
    this.el.querySelector('.shop-x').onclick = () => this.close();
    this.el.querySelectorAll('.shop-tabs button').forEach(b => b.onclick = () => { this.cat = b.dataset.c; this.render(); this.app.sound.play('click'); });
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.el.onclick = (e) => { if (e.target === this.el) this.close(); };
    this.sig = '';
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  say(list) {
    const t = Array.isArray(list) ? list[Math.floor(Math.random() * list.length)] : list;
    const b = this.el.querySelector('.bubble');
    b.textContent = t; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  }
  open() {
    this.el.classList.remove('hidden'); this.sig = ''; this.render(); this.app.sound.play('click');
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
    const p = this.g.player, res = p.buy(id);
    if (res === 'ok') { this.say(LINES.buy); this.g.keeperReact(['谢谢惠顾!', '成交!', '常来啊!'][Math.floor(Math.random() * 3)]); }
    else this.say(LINES[res] || LINES.gold);
    if (res === 'ok') { this.app.sound.play('buy'); this.g.world.vfx.puff(p.pos, { n: 10, color: '#ffd23c', cell: 'star', size: 0.45, speed: 2, up: 1.5, y: 1.5 }); }
    else { this.app.sound.play('error'); this.g.hint(REASON[res] || '无法购买'); }
    this.sig = '';
  }
  sell(slot) {
    const p = this.g.player, res = p.sell(slot);
    if (res === 'ok') { this.app.sound.play('sell'); this.say(LINES.sell); }
    else { this.say(LINES[res] || LINES.far); this.app.sound.play('error'); this.g.hint(REASON[res] || '无法出售'); }
    this.sig = '';
  }
  detail(d) {
    const p = this.g.player, { cost, used } = p.costFor(d.id);
    const from = (d.from || []).length ? `<div class="from">合成自：${d.from.map(c => `<img title="${ITEM_BY_ID[c].name} ${ITEM_BY_ID[c].price}" src="${this.app.itemIcons[c]}">`).join('<i>+</i>')}${used.length ? `<small>已有 ${used.length} 件组件，抵扣 ${d.price - cost} 金币</small>` : ''}</div>` : '';
    const stats = Object.entries(d.stats || {}).map(([k, v]) => `<li>${fmtStat(k, v)}</li>`).join('');
    return `<img src="${this.app.itemIcons[d.id]}"><h3>${d.name}</h3><b class="price">${cost < d.price ? `<s>${d.price}</s> ` : ''}${cost} 金币</b>
      <ul>${stats}</ul>${d.desc ? `<p>${d.unique ? '<em>独特：</em>' : ''}${d.desc}</p>` : ''}${from}
      ${d.unique && p.items.some(x => x && x.id === d.id) ? '<button class="buy" disabled>已拥有（独特装备只能有一件）</button>' : `<button class="buy" ${p.gold < cost ? 'disabled' : ''}>${p.gold < cost ? `还差 ${cost - Math.floor(p.gold)} 金币` : '购买'}</button>`}`;
  }
  showDetail() {
    const d = ITEM_BY_ID[this.sel] || this.list()[0];
    const det = this.el.querySelector('.shop-detail');
    det.innerHTML = d ? this.detail(d) : '';
    if (d) det.querySelector('.buy').onclick = () => this.buy(d.id);
    this.el.querySelectorAll('.shop-item').forEach(x => x.classList.toggle('on', x.dataset.id === (d && d.id)));
  }
  // 每帧调用：只有金币/背包/分类变化时才重绘
  render() {
    const p = this.g.player;
    const sig = `${this.cat}|${Math.floor(p.gold / 10)}|${this.sel}|${p.items.map(i => i ? i.id + i.count : '-').join()}|${p.canShop()}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.el.querySelector('.shop-gold').textContent = `💰 ${Math.floor(p.gold)}`;
    const where = this.el.querySelector('.shop-where');
    where.textContent = p.canShop() ? '在泉水中，可以购买' : '离开泉水后只能浏览，回城（B）后才能购买';
    where.classList.toggle('warn', !p.canShop());
    this.el.querySelectorAll('.shop-tabs button').forEach(b => b.classList.toggle('on', b.dataset.c === this.cat));
    const grid = this.el.querySelector('.shop-grid');
    grid.innerHTML = this.list().map(d => { const c = p.costFor(d.id).cost; return `<div class="shop-item ${p.gold >= c ? '' : 'poor'} ${this.sel === d.id ? 'on' : ''}" data-id="${d.id}">
      <img src="${this.app.itemIcons[d.id]}"><span>${d.name}</span><b>${c}</b></div>`; }).join('');
    grid.querySelectorAll('.shop-item').forEach(el => {
      el.onclick = () => { this.sel = el.dataset.id; this.buy(el.dataset.id); };
      el.onmouseenter = () => { if (this.sel !== el.dataset.id) { this.sel = el.dataset.id; this.showDetail(); } };
    });
    this.showDetail();
    const inv = this.el.querySelector('.shop-inv');
    inv.innerHTML = p.items.map((it, i) => it ? `<div class="inv" data-i="${i}" title="${ITEM_BY_ID[it.id].name}（出售 ${sellPrice(ITEM_BY_ID[it.id])} 金币）"><img src="${this.app.itemIcons[it.id]}">${it.count > 1 ? `<b>${it.count}</b>` : ''}</div>` : '<div class="inv empty"></div>').join('');
    inv.querySelectorAll('.inv[data-i]').forEach(el => { el.oncontextmenu = (e) => { e.preventDefault(); this.sell(+el.dataset.i); }; });
  }
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
