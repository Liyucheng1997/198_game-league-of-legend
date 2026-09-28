// 装备：属性、价格、独特被动与推荐出装。图标同样由代码绘制。
export const STAT_NAMES = {
  ad: '攻击力', ap: '法术强度', hp: '生命值', mana: '法力值', armor: '护甲', mr: '魔法抗性',
  as: '攻击速度', ms: '移动速度', crit: '暴击几率', ls: '生命偷取', cdr: '技能急速', hp5: '每秒回血', mp5: '每秒回蓝', tenacity: '韧性',
};
const PCT = new Set(['as', 'ms', 'crit', 'ls', 'cdr', 'tenacity']);
export function fmtStat(k, v) { return PCT.has(k) ? `+${Math.round(v * 100)}% ${STAT_NAMES[k]}` : `+${v} ${STAT_NAMES[k]}`; }

export const CATS = [
  { id: 'rec', name: '推荐' }, { id: 'atk', name: '攻击' }, { id: 'ap', name: '法术' },
  { id: 'def', name: '防御' }, { id: 'boots', name: '鞋子' }, { id: 'consume', name: '消耗品' },
];

export const ITEMS = [
  { id: 'potion', name: '生命药水', cat: 'consume', price: 50, icon: '药', color: '#e05a5a', consumable: true, stack: 5, desc: '按对应数字键使用：10 秒内回复 150 生命值。' },
  // 攻击
  { id: 'longsword', name: '长剑', cat: 'atk', price: 350, icon: '剑', color: '#b8c4d0', stats: { ad: 10 } },
  { id: 'dagger', name: '短剑', cat: 'atk', price: 300, icon: '匕', color: '#d0b070', stats: { as: 0.12 } },
  { id: 'doranblade', name: '多兰之刃', cat: 'atk', price: 450, icon: '刃', color: '#c07a4a', stats: { ad: 8, hp: 80, ls: 0.03 } },
  { id: 'ie', name: '无尽之刃', cat: 'atk', price: 3400, from: ['longsword', 'longsword'], icon: '尽', color: '#e8c25a', stats: { ad: 65, crit: 0.25 }, unique: 'ie', desc: '暴击伤害从 175% 提升到 215%。' },
  { id: 'bloodthirster', name: '饮血剑', cat: 'atk', price: 3400, from: ['longsword', 'longsword'], icon: '饮', color: '#c03040', stats: { ad: 55, ls: 0.18 } },
  { id: 'trinity', name: '三相之力', cat: 'atk', price: 3333, from: ['longsword', 'dagger', 'ruby'], icon: '三', color: '#b58aff', stats: { ad: 36, as: 0.3, hp: 300, cdr: 0.15, ms: 0.05 }, unique: 'sheen', desc: '施放技能后，下一次普攻额外造成等同基础攻击力的伤害。' },
  { id: 'runaan', name: '卢安娜的飓风', cat: 'atk', price: 2600, from: ['dagger', 'dagger'], icon: '飓', color: '#5ab89a', stats: { as: 0.4, crit: 0.2, ms: 0.05 }, unique: 'runaan', desc: '远程普攻额外射出两道弩箭，攻击附近的敌人。' },
  // 法术
  { id: 'tome', name: '增幅典籍', cat: 'ap', price: 400, icon: '典', color: '#7a8ae0', stats: { ap: 20 } },
  { id: 'doranring', name: '多兰之戒', cat: 'ap', price: 400, icon: '戒', color: '#6ab0e0', stats: { ap: 15, hp: 70, mp5: 1 } },
  { id: 'bluecrystal', name: '蓝水晶', cat: 'ap', price: 350, icon: '蓝', color: '#4a8ae0', stats: { mana: 250 } },
  { id: 'rabadon', name: '灭世者的死亡之帽', cat: 'ap', price: 3600, from: ['tome', 'tome'], icon: '帽', color: '#6a4ab0', stats: { ap: 120 }, unique: 'rabadon', desc: '法术强度额外提升 30%。' },
  { id: 'rylai', name: '瑞莱的冰晶节杖', cat: 'ap', price: 3000, from: ['tome', 'ruby'], icon: '冰', color: '#8ad0ff', stats: { ap: 75, hp: 350 }, unique: 'rylai', desc: '技能伤害使敌人减速 30%，持续 1 秒。' },
  { id: 'archangel', name: '大天使之杖', cat: 'ap', price: 2900, from: ['tome', 'bluecrystal'], icon: '天', color: '#5ac0e0', stats: { ap: 70, mana: 600, cdr: 0.15, mp5: 2 } },
  { id: 'nashor', name: '纳什之牙', cat: 'ap', price: 3000, from: ['tome', 'dagger'], icon: '牙', color: '#9a5ad0', stats: { ap: 80, as: 0.4 }, unique: 'nashor', desc: '普攻额外造成 20 + 15% 法术强度的魔法伤害。' },
  { id: 'zhonya', name: '中娅沙漏', cat: 'ap', price: 3000, from: ['tome', 'cloth'], icon: '沙', color: '#e0c070', stats: { ap: 80, armor: 45, cdr: 0.1 } },
  // 防御
  { id: 'ruby', name: '红水晶', cat: 'def', price: 400, icon: '红', color: '#e05a5a', stats: { hp: 150 } },
  { id: 'cloth', name: '布甲', cat: 'def', price: 300, icon: '甲', color: '#b0a080', stats: { armor: 15 } },
  { id: 'cloak', name: '抗魔斗篷', cat: 'def', price: 450, icon: '篷', color: '#7aa0c0', stats: { mr: 20 } },
  { id: 'warmog', name: '狂徒铠甲', cat: 'def', price: 3000, from: ['ruby', 'ruby'], icon: '狂', color: '#5ab05a', stats: { hp: 800 }, unique: 'warmog', desc: '5 秒未受伤时，每秒回复 3% 最大生命值。' },
  { id: 'sunfire', name: '日炎圣盾', cat: 'def', price: 2700, from: ['ruby', 'cloth'], icon: '日', color: '#ff8a30', stats: { hp: 450, armor: 40 }, unique: 'sunfire', desc: '灼烧身边敌人，每秒造成 20 + 1% 最大生命值的魔法伤害。' },
  { id: 'randuin', name: '兰顿之兆', cat: 'def', price: 2700, from: ['ruby', 'cloth'], icon: '兰', color: '#8a8aa0', stats: { hp: 350, armor: 70 }, unique: 'randuin', desc: '受到的暴击伤害减少 30%。' },
  { id: 'spirit', name: '振奋盔甲', cat: 'def', price: 2800, from: ['ruby', 'cloak'], icon: '振', color: '#5ad0a0', stats: { hp: 400, mr: 60, hp5: 3 }, unique: 'spirit', desc: '受到的治疗与护盾效果提升 25%。' },
  { id: 'thornmail', name: '荆棘之甲', cat: 'def', price: 2700, from: ['cloth', 'cloth'], icon: '荆', color: '#6a8a5a', stats: { hp: 350, armor: 70 }, unique: 'thorns', desc: '被普攻命中时，对攻击者造成 20 + 10% 护甲的魔法伤害。' },
  // 鞋子（只能拥有一双）
  { id: 'boots', name: '速度之靴', cat: 'boots', price: 300, icon: '靴', color: '#a07050', boots: true, stats: { ms: 0.08 } },
  { id: 'zerker', name: '狂战士胫甲', cat: 'boots', price: 1100, from: ['boots', 'dagger'], icon: '胫', color: '#c09050', boots: true, stats: { ms: 0.13, as: 0.3 } },
  { id: 'lucidity', name: '明朗之靴', cat: 'boots', price: 950, from: ['boots'], icon: '明', color: '#70a0d0', boots: true, stats: { ms: 0.13, cdr: 0.15 } },
  { id: 'mercs', name: '水银之靴', cat: 'boots', price: 1100, from: ['boots', 'cloak'], icon: '银', color: '#a0a8c0', boots: true, stats: { ms: 0.13, mr: 25, tenacity: 0.3 } },
  { id: 'ninja', name: '铁板靴', cat: 'boots', price: 1100, from: ['boots', 'cloth'], icon: '铁', color: '#8a8a8a', boots: true, stats: { ms: 0.13, armor: 20 } },
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// 推荐出装（电脑英雄按这个顺序购买）
export const BUILDS = {
  garen: ['doranblade', 'potion', 'boots', 'ninja', 'trinity', 'sunfire', 'warmog', 'thornmail'],
  darius: ['doranblade', 'potion', 'boots', 'ninja', 'trinity', 'sunfire', 'spirit', 'bloodthirster'],
  ashe: ['doranblade', 'potion', 'boots', 'zerker', 'ie', 'runaan', 'bloodthirster', 'randuin'],
  caitlyn: ['doranblade', 'potion', 'boots', 'zerker', 'ie', 'runaan', 'bloodthirster', 'randuin'],
  ahri: ['doranring', 'potion', 'boots', 'lucidity', 'archangel', 'rabadon', 'zhonya', 'rylai'],
  lux: ['doranring', 'potion', 'boots', 'lucidity', 'archangel', 'rabadon', 'zhonya', 'rylai'],
  annie: ['doranring', 'potion', 'boots', 'mercs', 'rylai', 'rabadon', 'zhonya', 'archangel'],
  yi: ['doranblade', 'potion', 'boots', 'zerker', 'ie', 'bloodthirster', 'trinity', 'randuin'],
  malphite: ['doranring', 'potion', 'boots', 'ninja', 'sunfire', 'thornmail', 'zhonya', 'rabadon'],
  soraka: ['doranring', 'potion', 'boots', 'lucidity', 'archangel', 'spirit', 'warmog', 'zhonya'],
};

export function sumStats(items) {
  const st = {}, uniques = new Set();
  for (const it of items) {
    if (!it) continue;
    const d = ITEM_BY_ID[it.id];
    for (const k in d.stats || {}) st[k] = (st[k] || 0) + d.stats[k];
    if (d.unique) uniques.add(d.unique);
  }
  return { st, uniques };
}
export const sellPrice = (d) => Math.floor(d.price * (d.consumable ? 0.4 : 0.7));
