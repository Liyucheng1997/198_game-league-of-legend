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

// 合成路线：基础件 → 中间件（暴风大剑、无用大棒、锁子甲……）→ 传说装备，每一步差价都不超过 1500 左右
export const ITEMS = [
  { id: 'potion', name: '生命药水', cat: 'consume', price: 50, icon: '药', color: '#e05a5a', consumable: true, stack: 5, desc: '按对应数字键使用：10 秒内回复 150 生命值。' },
  // 攻击
  { id: 'longsword', name: '长剑', cat: 'atk', price: 350, icon: '剑', color: '#b8c4d0', stats: { ad: 10 } },
  { id: 'dagger', name: '短剑', cat: 'atk', price: 300, icon: '匕', color: '#d0b070', stats: { as: 0.12 } },
  { id: 'doranblade', name: '多兰之刃', cat: 'atk', price: 450, icon: '刃', color: '#c07a4a', stats: { ad: 8, hp: 80, ls: 0.03 } },
  { id: 'agility', name: '灵巧披风', cat: 'atk', price: 600, icon: '披', color: '#d8c8a0', stats: { crit: 0.15 } },
  { id: 'vamp', name: '吸血鬼节杖', cat: 'atk', price: 900, from: ['longsword'], icon: '吸', color: '#b04050', stats: { ad: 15, ls: 0.08 } },
  { id: 'caulfield', name: '考尔菲德的战锤', cat: 'atk', price: 1100, from: ['longsword', 'longsword'], icon: '锤', color: '#c0a070', stats: { ad: 25, cdr: 0.1 } },
  { id: 'bfsword', name: '暴风大剑', cat: 'atk', price: 1300, icon: '暴', color: '#d0d8e8', stats: { ad: 40 } },
  { id: 'ie', name: '无尽之刃', cat: 'atk', price: 3400, from: ['bfsword', 'agility', 'longsword'], icon: '尽', color: '#e8c25a', stats: { ad: 70, crit: 0.25 }, unique: 'ie', desc: '暴击伤害从 175% 提升到 215%。' },
  { id: 'bloodthirster', name: '饮血剑', cat: 'atk', price: 3400, from: ['bfsword', 'vamp'], icon: '饮', color: '#c03040', stats: { ad: 60, ls: 0.18 } },
  { id: 'botrk', name: '破败王者之刃', cat: 'atk', price: 3200, from: ['vamp', 'dagger', 'dagger'], icon: '破', color: '#3a8a7a', stats: { ad: 40, as: 0.25, ls: 0.1 }, unique: 'botrk', desc: '普攻额外造成目标当前生命值 7% 的物理伤害（对小兵和野怪最多 60）。' },
  { id: 'dominik', name: '多米尼克领主的致意', cat: 'atk', price: 3000, from: ['bfsword', 'longsword'], icon: '致', color: '#a0a8b8', stats: { ad: 45, crit: 0.2 }, unique: 'ldr', desc: '物理伤害无视目标 30% 的护甲。' },
  { id: 'cleaver', name: '黑色切割者', cat: 'atk', price: 3000, from: ['caulfield', 'kindlegem'], icon: '切', color: '#5a4a6a', stats: { ad: 40, hp: 350, cdr: 0.2 }, unique: 'cleaver', desc: '物理伤害使敌方英雄护甲降低 5%，最多叠加 6 层（30%），持续 5 秒。' },
  { id: 'trinity', name: '三相之力', cat: 'atk', price: 3333, from: ['caulfield', 'dagger', 'kindlegem'], icon: '三', color: '#b58aff', stats: { ad: 36, as: 0.3, hp: 300, cdr: 0.2, ms: 0.05 }, unique: 'sheen', desc: '施放技能后，下一次普攻额外造成等同基础攻击力的伤害。' },
  { id: 'sterak', name: '斯特拉克的挑战护手', cat: 'atk', price: 3100, from: ['giantsbelt', 'longsword', 'longsword'], icon: '挑', color: '#d08a4a', stats: { ad: 30, hp: 450 }, unique: 'sterak', desc: '生命值低于 35% 时获得等同 35% 最大生命值的护盾，持续 4 秒（60 秒冷却）。' },
  { id: 'ga', name: '守护天使', cat: 'atk', price: 3000, from: ['bfsword', 'chainvest'], icon: '守', color: '#f0d890', stats: { ad: 45, armor: 40 }, unique: 'ga', desc: '受到致命伤害时进入 2 秒凝滞，随后以 40% 生命值复活（180 秒冷却）。' },
  { id: 'runaan', name: '卢安娜的飓风', cat: 'atk', price: 2600, from: ['dagger', 'agility', 'dagger'], icon: '飓', color: '#5ab89a', stats: { as: 0.4, crit: 0.2, ms: 0.05 }, unique: 'runaan', desc: '远程普攻额外射出两道弩箭，攻击附近的敌人。' },
  { id: 'rapidfire', name: '疾射火炮', cat: 'atk', price: 2700, from: ['dagger', 'agility', 'dagger'], icon: '炮', color: '#e08a40', stats: { as: 0.35, crit: 0.2, ms: 0.07 }, unique: 'rapidfire', desc: '远程英雄的普攻距离 +1.5。' },
  // 法术
  { id: 'tome', name: '增幅典籍', cat: 'ap', price: 400, icon: '典', color: '#7a8ae0', stats: { ap: 20 } },
  { id: 'doranring', name: '多兰之戒', cat: 'ap', price: 400, icon: '戒', color: '#6ab0e0', stats: { ap: 15, hp: 70, mp5: 1 } },
  { id: 'bluecrystal', name: '蓝水晶', cat: 'ap', price: 350, icon: '蓝', color: '#4a8ae0', stats: { mana: 250 } },
  { id: 'wand', name: '无用大棒', cat: 'ap', price: 850, icon: '棒', color: '#8a6ad0', stats: { ap: 40 } },
  { id: 'codex', name: '恶魔法典', cat: 'ap', price: 900, from: ['tome'], icon: '法', color: '#a04a6a', stats: { ap: 25, cdr: 0.1 } },
  { id: 'rabadon', name: '灭世者的死亡之帽', cat: 'ap', price: 3600, from: ['wand', 'wand', 'tome'], icon: '帽', color: '#6a4ab0', stats: { ap: 120 }, unique: 'rabadon', desc: '法术强度额外提升 30%。' },
  { id: 'luden', name: '卢登的回声', cat: 'ap', price: 3000, from: ['codex', 'bluecrystal', 'tome'], icon: '卢', color: '#5a8ae0', stats: { ap: 90, mana: 300, cdr: 0.15 }, unique: 'luden', desc: '技能命中时额外造成 100 + 10% 法术强度的魔法伤害，并弹射到附近两个敌人（6 秒冷却）。' },
  { id: 'voidstaff', name: '虚空之杖', cat: 'ap', price: 2800, from: ['wand', 'tome'], icon: '虚', color: '#9a5ab0', stats: { ap: 70 }, unique: 'void', desc: '魔法伤害无视目标 35% 的魔法抗性。' },
  { id: 'morello', name: '莫雷洛秘典', cat: 'ap', price: 2900, from: ['wand', 'kindlegem'], icon: '莫', color: '#b04a4a', stats: { ap: 75, hp: 300, cdr: 0.1 }, unique: 'morello', desc: '技能伤害使敌方英雄受到的治疗效果减少 40%，持续 3 秒。' },
  { id: 'rylai', name: '瑞莱的冰晶节杖', cat: 'ap', price: 2900, from: ['wand', 'giantsbelt'], icon: '冰', color: '#8ad0ff', stats: { ap: 75, hp: 350 }, unique: 'rylai', desc: '技能伤害使敌人减速 30%，持续 1 秒。' },
  { id: 'archangel', name: '大天使之杖', cat: 'ap', price: 2900, from: ['codex', 'bluecrystal', 'tome'], icon: '天', color: '#5ac0e0', stats: { ap: 70, mana: 600, cdr: 0.15, mp5: 2 } },
  { id: 'nashor', name: '纳什之牙', cat: 'ap', price: 3000, from: ['wand', 'dagger', 'dagger'], icon: '牙', color: '#9a5ad0', stats: { ap: 80, as: 0.4, cdr: 0.1 }, unique: 'nashor', desc: '普攻额外造成 20 + 15% 法术强度的魔法伤害。' },
  { id: 'zhonya', name: '中娅沙漏', cat: 'ap', price: 3000, from: ['wand', 'chainvest'], icon: '沙', color: '#e0c070', stats: { ap: 80, armor: 45, cdr: 0.1 }, active: 'zhonya', activeCd: 90, desc: '主动（按装备所在格子的数字键）：进入 2.5 秒凝滞，无法被选中也无法行动（90 秒冷却）。' },
  // 防御
  { id: 'ruby', name: '红水晶', cat: 'def', price: 400, icon: '红', color: '#e05a5a', stats: { hp: 150 } },
  { id: 'cloth', name: '布甲', cat: 'def', price: 300, icon: '甲', color: '#b0a080', stats: { armor: 15 } },
  { id: 'cloak', name: '抗魔斗篷', cat: 'def', price: 450, icon: '篷', color: '#7aa0c0', stats: { mr: 20 } },
  { id: 'giantsbelt', name: '巨人腰带', cat: 'def', price: 900, from: ['ruby'], icon: '腰', color: '#c08a5a', stats: { hp: 350 } },
  { id: 'kindlegem', name: '燃烧宝石', cat: 'def', price: 800, from: ['ruby'], icon: '燃', color: '#e07a5a', stats: { hp: 200, cdr: 0.1 } },
  { id: 'chainvest', name: '锁子甲', cat: 'def', price: 800, from: ['cloth'], icon: '锁', color: '#9a9a8a', stats: { armor: 40 } },
  { id: 'negatron', name: '负极斗篷', cat: 'def', price: 900, from: ['cloak'], icon: '负', color: '#5a80a8', stats: { mr: 40 } },
  { id: 'warmog', name: '狂徒铠甲', cat: 'def', price: 3000, from: ['giantsbelt', 'giantsbelt'], icon: '狂', color: '#5ab05a', stats: { hp: 800, hp5: 2 }, unique: 'warmog', desc: '5 秒未受伤时，每秒回复 3% 最大生命值。' },
  { id: 'sunfire', name: '日炎圣盾', cat: 'def', price: 2700, from: ['giantsbelt', 'chainvest'], icon: '日', color: '#ff8a30', stats: { hp: 450, armor: 40 }, unique: 'sunfire', desc: '灼烧身边敌人，每秒造成 20 + 1% 最大生命值的魔法伤害。' },
  { id: 'randuin', name: '兰顿之兆', cat: 'def', price: 2700, from: ['giantsbelt', 'chainvest'], icon: '兰', color: '#8a8aa0', stats: { hp: 350, armor: 65 }, unique: 'randuin', desc: '受到的暴击伤害减少 30%。' },
  { id: 'thornmail', name: '荆棘之甲', cat: 'def', price: 2700, from: ['chainvest', 'ruby'], icon: '荆', color: '#6a8a5a', stats: { hp: 350, armor: 70 }, unique: 'thorns', desc: '被普攻命中时，对攻击者造成 20 + 10% 护甲的魔法伤害，并使其受到的治疗减少 40%。' },
  { id: 'frozenheart', name: '冰霜之心', cat: 'def', price: 2700, from: ['chainvest', 'bluecrystal'], icon: '霜', color: '#8ac8f0', stats: { armor: 70, mana: 400, cdr: 0.2 }, unique: 'frozen', desc: '身边 4 码内敌方英雄的攻击速度降低 20%。' },
  { id: 'spirit', name: '振奋盔甲', cat: 'def', price: 2800, from: ['negatron', 'kindlegem'], icon: '振', color: '#5ad0a0', stats: { hp: 400, mr: 60, hp5: 3, cdr: 0.1 }, unique: 'spirit', desc: '受到的治疗与护盾效果提升 25%。' },
  { id: 'fon', name: '自然之力', cat: 'def', price: 2800, from: ['negatron', 'giantsbelt'], icon: '然', color: '#6ab07a', stats: { hp: 350, mr: 65, ms: 0.05, hp5: 4 } },
  // 鞋子（只能拥有一双）
  { id: 'boots', name: '速度之靴', cat: 'boots', price: 300, icon: '靴', color: '#a07050', boots: true, stats: { ms: 0.08 } },
  { id: 'zerker', name: '狂战士胫甲', cat: 'boots', price: 1100, from: ['boots', 'dagger'], icon: '胫', color: '#c09050', boots: true, stats: { ms: 0.13, as: 0.3 } },
  { id: 'lucidity', name: '明朗之靴', cat: 'boots', price: 950, from: ['boots'], icon: '明', color: '#70a0d0', boots: true, stats: { ms: 0.13, cdr: 0.15 } },
  { id: 'mercs', name: '水银之靴', cat: 'boots', price: 1100, from: ['boots', 'cloak'], icon: '银', color: '#a0a8c0', boots: true, stats: { ms: 0.13, mr: 25, tenacity: 0.3 } },
  { id: 'ninja', name: '铁板靴', cat: 'boots', price: 1100, from: ['boots', 'cloth'], icon: '铁', color: '#8a8a8a', boots: true, stats: { ms: 0.13, armor: 20 }, unique: 'ninja', desc: '受到的普攻伤害降低 12%。' },
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// 推荐出装（电脑英雄按这个顺序购买）：出门装、药水、鞋、进阶鞋、四件核心
const B = (start, boots, ...core) => [start, 'potion', 'boots', boots, ...core];
export const BUILDS = {
  garen: B('doranblade', 'ninja', 'cleaver', 'sterak', 'randuin', 'ga'),
  darius: B('doranblade', 'ninja', 'cleaver', 'sterak', 'randuin', 'spirit'),
  ashe: B('doranblade', 'zerker', 'botrk', 'runaan', 'ie', 'dominik'),
  caitlyn: B('doranblade', 'zerker', 'ie', 'rapidfire', 'dominik', 'bloodthirster'),
  ahri: B('doranring', 'lucidity', 'luden', 'rabadon', 'voidstaff', 'zhonya'),
  lux: B('doranring', 'lucidity', 'luden', 'rabadon', 'voidstaff', 'zhonya'),
  annie: B('doranring', 'mercs', 'luden', 'rabadon', 'zhonya', 'voidstaff'),
  yi: B('doranblade', 'zerker', 'botrk', 'ie', 'ga', 'dominik'),
  malphite: B('doranring', 'ninja', 'sunfire', 'frozenheart', 'thornmail', 'fon'),
  soraka: B('doranring', 'lucidity', 'archangel', 'spirit', 'warmog', 'zhonya'),
  yasuo: B('doranblade', 'zerker', 'ie', 'botrk', 'ga', 'dominik'),
  zed: B('doranblade', 'lucidity', 'cleaver', 'dominik', 'ga', 'sterak'),
  jinx: B('doranblade', 'zerker', 'ie', 'runaan', 'dominik', 'ga'),
  ezreal: B('doranblade', 'lucidity', 'trinity', 'ie', 'dominik', 'ga'),
  vayne: B('doranblade', 'zerker', 'botrk', 'runaan', 'ie', 'ga'),
  teemo: B('doranring', 'zerker', 'nashor', 'luden', 'rabadon', 'voidstaff'),
  thresh: B('doranring', 'mercs', 'sunfire', 'frozenheart', 'spirit', 'fon'),
  blitzcrank: B('doranring', 'ninja', 'frozenheart', 'sunfire', 'spirit', 'thornmail'),
  leona: B('doranring', 'ninja', 'sunfire', 'thornmail', 'fon', 'spirit'),
  lulu: B('doranring', 'lucidity', 'archangel', 'rylai', 'spirit', 'zhonya'),
  morgana: B('doranring', 'lucidity', 'rylai', 'zhonya', 'rabadon', 'morello'),
  katarina: B('doranring', 'mercs', 'nashor', 'rabadon', 'zhonya', 'voidstaff'),
  xinzhao: B('doranblade', 'ninja', 'trinity', 'sterak', 'randuin', 'ga'),
  amumu: B('doranring', 'ninja', 'sunfire', 'thornmail', 'fon', 'spirit'),
  brand: B('doranring', 'lucidity', 'morello', 'rylai', 'rabadon', 'voidstaff'),
  veigar: B('doranring', 'lucidity', 'luden', 'rabadon', 'zhonya', 'voidstaff'),
  twistedfate: B('doranring', 'lucidity', 'luden', 'nashor', 'rabadon', 'zhonya'),
  leesin: B('doranblade', 'ninja', 'cleaver', 'sterak', 'spirit', 'ga'),
  mundo: B('doranblade', 'mercs', 'warmog', 'spirit', 'sunfire', 'thornmail'),
  nami: B('doranring', 'lucidity', 'archangel', 'spirit', 'rylai', 'zhonya'),
  riven: B('doranblade', 'lucidity', 'cleaver', 'sterak', 'ga', 'dominik'),
  lucian: B('doranblade', 'zerker', 'ie', 'rapidfire', 'dominik', 'bloodthirster'),
  nasus: B('doranblade', 'ninja', 'trinity', 'sterak', 'frozenheart', 'spirit'),
  xerath: B('doranring', 'lucidity', 'luden', 'rabadon', 'voidstaff', 'morello'),
  vi: B('doranblade', 'ninja', 'trinity', 'sterak', 'randuin', 'ga'),
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
