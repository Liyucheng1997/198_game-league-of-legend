const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let seed=241;const seeded=Object.create(Math);seeded.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const ctx=vm.createContext({console,Math:seeded,assert,sfx(){},announce(){},killFeed(){},speak(){}});
for(const file of ['riot-data','data','champions','rift-map','rift-grid','engine','rift-terrain','rift-game'])vm.runInContext(fs.readFileSync(`js/${file}.js`,'utf8'),ctx);
vm.runInContext(`const g=new Game('ahri',{lane:'mid'});g.player.isBot=true;g.damageNumbers=false;for(let i=0;i<32400&&!g.over;i++){g.update(1/6);if(i%3600===3599)console.log('Match',Math.round(g.t/60),'minutes, towers destroyed',g.towers.filter(t=>t.dead).length,'kills',g.teamKills('blue')+g.teamKills('red'),'minions',g.minions.length);}
console.log('Final',JSON.stringify({t:g.t,winner:g.over,structures:g.towers.map(t=>[t.team,t.lane,t.tier,Math.round(t.hp)]),champs:g.champs.map(c=>[c.def.id,c.role,Math.round(c.x),Math.round(c.y),c.kills,c.cs])}));
assert(g.over,'A 90 minute seeded bot match should reach a Nexus victory');console.log('PASS full bot match reaches victory');`,ctx,{timeout:720000});
