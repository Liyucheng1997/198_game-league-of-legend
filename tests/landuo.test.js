const fs = require('fs');
const vm = require('vm');

const context = vm.createContext({
  console,
  Math,
  sfx() {},
  announce() {},
  killFeed() {},
  speak() {},
});

for (const file of ['js/data.js', 'js/engine.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

vm.runInContext(`
  const testDef = CHAMP_BY_ID.landuo;
  const testHero = new Champion(testDef, TEAM_BLUE, { displayName:'test', lane:'mid' });
  testHero.level = 18;
  testHero.skillPoints = 20;
  testHero.abilities.forEach((ability, index) => { ability.lvl = index === 3 ? 3 : 5; });
  testHero.x = 1000;
  testHero.y = 1000;
  testHero.maxHp = testHero.stat('maxHp');
  testHero.hp = testHero.maxHp;
  testHero.maxMp = testHero.stat('maxMp');
  testHero.mp = testHero.maxMp;

  const dummy = new Unit({
    type:'champ', team:TEAM_RED, x:1120, y:1000, radius:20,
    maxHp:99999, hp:99999, armor:0, mr:0,
    order:{type:'hold'}, buffs:[], shields:[],
  });
  const testGame = {
    t:10, effects:[], zones:[], delayed:[], projectiles:[],
    champs:[testHero,dummy], towers:[], player:testHero, playerTeam:TEAM_BLUE,
    units() { return [testHero,dummy]; },
  };
  gameRef = testGame;

  testHero.forgeStacks = 3;
  testHero.castAbility(testGame, 0, {x:1200,y:1000});
  if (!dummy.hasBuff('landuoQstun')) throw new Error('Q empowered stun missing');

  testHero.abilities[1].readyAt = 0;
  testHero.mp = testHero.maxMp;
  testHero.forgeStacks = 3;
  testHero.castAbility(testGame, 1, {x:testHero.x,y:testHero.y});
  if (testHero.shields.length === 0) throw new Error('W shield missing');
  const wCallback = testGame.delayed.shift();
  testGame.t = wCallback.t;
  wCallback.fn();
  if (!dummy.hasBuff('landuoWslow')) throw new Error('W empowered slow missing');

  dummy.x = 1250;
  dummy.y = 1000;
  testHero.x = 1000;
  testHero.y = 1000;
  testHero.abilities[2].readyAt = 0;
  testHero.mp = testHero.maxMp;
  testHero.forgeStacks = 3;
  testHero.castAbility(testGame, 2, {x:1350,y:1000});
  if (testGame.zones.length === 0 || testHero.x <= 1000) throw new Error('E dash/zone missing');

  testHero.abilities[3].readyAt = 0;
  testHero.mp = testHero.maxMp;
  testHero.x = 1000;
  testHero.y = 1000;
  testHero.castAbility(testGame, 3, {x:1450,y:1000});
  if (!testHero.untargetable) throw new Error('R leap state missing');
  const rCallback = testGame.delayed.pop();
  testGame.t = rCallback.t;
  rCallback.fn();
  if (testHero.untargetable || testHero.forgeStacks !== 3) throw new Error('R landing/reset missing');

  globalThis.testResult = {
    qStun:true, wShield:true, wSlow:true, eZone:true, rLanding:true,
    effects:testGame.effects.map(effect => effect.kind),
  };
`, context);

console.log(JSON.stringify(context.testResult));
