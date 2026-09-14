const assert=require('node:assert/strict');
const {DodgeSession,DODGE_KITS,dodgeSegment}=require('../js/dodge-core.js');
let count=0;function test(name,fn){fn();console.log('PASS',name);count++;}
function run(s,seconds,dt=1/60){for(let t=0;t<seconds-1e-8&&!s.over;t+=dt)s.update(dt);}
test('all ten opponents appear in rotation',()=>{const s=new DodgeSession();for(let i=0;i<10;i++)s.spawn();assert.equal(new Set(s.casts.map(c=>c.kit.id)).size,10);});
test('right click stops exactly and arena clamps target',()=>{const s=new DodgeSession({speed:330});s.nextCast=999;s.move(100,0);run(s,1);assert.equal(s.player.x,100);assert.equal(s.player.order.type,'stop');s.move(99999,99999);assert(Math.hypot(s.target.x,s.target.y)<=730.00001);});
test('pause freezes time, movement and flash',()=>{const s=new DodgeSession();s.move(500,0);s.paused=true;s.update(.2);assert.equal(s.t,0);assert.equal(s.player.x,0);assert.equal(s.flash(400,0),false);});
test('flash has range, boundary and cooldown',()=>{const s=new DodgeSession();assert(s.flash(1000,0));assert.equal(s.player.x,400);assert(!s.flash(1000,0));s.t=15;assert(s.flash(1000,0));assert.equal(s.player.x,730);});
test('stationary target is hit once by a multi-arrow volley',()=>{const s=new DodgeSession({opponent:'ashe',random:()=>0});s.spawn();s.nextCast=999;run(s,2);assert.equal(s.hits,1);assert.equal(s.score,0);assert.equal(s.combo,0);});
test('sidestep earns exactly one score per cast',()=>{const s=new DodgeSession({opponent:'lux',random:()=>0});s.spawn();s.nextCast=999;s.move(0,650);run(s,3);assert.equal(s.hits,0);assert.equal(s.dodged,1);assert(s.score>=100);});
test('collision results agree at 20fps and 120fps',()=>{const results=[1/20,1/120].map(dt=>{const s=new DodgeSession({opponent:'caitlyn',random:()=>0});s.spawn();s.nextCast=999;run(s,2,dt);return [s.hits,s.score];});assert.deepEqual(results[0],results[1]);assert.equal(results[0][0],1);});
test('swept segment catches a projectile crossing between endpoints',()=>assert.equal(dodgeSegment(0,0,-200,0,200,0),0));
test('Darius inner handle is not falsely counted as a full dodge',()=>{const s=new DodgeSession({opponent:'darius',random:()=>0});s.spawn();s.nextCast=999;s.player.x=300;run(s,1.5);assert.equal(s.hits,1);});
test('all skill shapes finish without invalid coordinates',()=>{for(const k of DODGE_KITS){const s=new DodgeSession({opponent:k.id,random:()=>0});s.spawn();s.nextCast=999;run(s,5);assert.equal(s.hits+s.dodged,1,k.id);assert(s.casts.every(c=>Number.isFinite(c.actor.x)));}});
test('time limit ends and freezes session',()=>{const s=new DodgeSession();s.nextCast=999;run(s,91);assert(s.over);const t=s.t;s.update(.1);assert.equal(s.t,t);});
test('ten hits end challenge',()=>{const s=new DodgeSession();for(let i=0;i<10;i++)s.hit({kit:DODGE_KITS[0]});s.update(.01);assert(s.over);});
console.log(count+' dodge tests passed');
