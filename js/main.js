/* ============ 主程序：英雄选择 / 输入 / 相机 / 主循环 ============ */
"use strict";

let game=null;
let cam={x:1000, y:6000, zoom:1, locked:true};
let mouse={x:0,y:0, sx:0, sy:0};
let canvas, ctx, mmCanvas, mmCtx;
let selectedChamp=null;

/* ---------- 英雄选择界面 ---------- */
function initSelect(){
  const grid=$('#champ-grid');
  CHAMPIONS.forEach(def=>{
    const d=document.createElement('div');
    d.className='champ-card'; d.dataset.id=def.id;
    d.innerHTML=`${portraitHTML(def)}<div class="cc-name">${def.name}</div>`;
    d.addEventListener('click',()=>selectChamp(def));
    grid.appendChild(d);
  });
  $('#btn-lock').addEventListener('click',()=>{ if(selectedChamp) startGame(selectedChamp.id); });
  selectChamp(CHAMPIONS[0]);
}
function selectChamp(def){
  selectedChamp=def;
  $$('.champ-card').forEach(c=>c.classList.toggle('picked', c.dataset.id===def.id));
  $('#sel-portrait').innerHTML=portraitHTML(def,'lg');
  $('#sel-name').textContent=def.name;
  $('#sel-title').textContent=def.title;
  $('#sel-passive').textContent='被动 · '+def.passive;
  $('#sel-skills').innerHTML=def.abilities.map(a=>
    `<div class="sel-skill" title="${a.name}"><span class="ss-icon">${a.icon}</span><span class="ss-key">${a.key}</span><div class="ss-tip"><b>${a.name}</b><br>${a.desc(1)}</div></div>`).join('');
  // 阵容预览：己方 = 玩家 + 其余英雄；敌方 = 全部英雄
  const allyPreview=CHAMPIONS.filter(c=>c.id!==def.id).slice(0,4);
  const enemyPreview=[def,...CHAMPIONS.filter(c=>c.id!==def.id)].slice(0,5);
  $('#team-blue-list').innerHTML =
    `<div class="team-row me">${portraitHTML(def)}<span>你（中路）</span></div>` +
    allyPreview.map(c=>`<div class="team-row">${portraitHTML(c)}<span>电脑·${c.name}</span></div>`).join('');
  $('#team-red-list').innerHTML =
    enemyPreview.map(c=>`<div class="team-row">${portraitHTML(c)}<span>电脑·${c.name}</span></div>`).join('');
  sfx('click');
}

/* ---------- 开始游戏 ---------- */
function startGame(champId){
  $('#select-screen').style.display='none';
  $('#game-screen').style.display='block';
  game=new Game(champId);
  buildTerrain(game);
  buildHUD(game);
  cam.x=game.player.x; cam.y=game.player.y; cam.locked=true;
  resize();
  announce(game,'欢迎来到召唤师峡谷',{color:'#f0d87a',speech:'欢迎来到召唤师峡谷'});
  lastFrame=performance.now();
  requestAnimationFrame(loop);
}

/* ---------- 坐标换算 ---------- */
function screenToWorld(sx,sy){
  return { x: cam.x + (sx-canvas.width/2)/cam.zoom,
           y: cam.y + (sy-canvas.height/2)/cam.zoom };
}
function unitAt(wx,wy,filter){
  let best=null,bd=1e9;
  for(const u of game.units()){
    if(u.dead||u.untargetable) continue;
    if(filter&&!filter(u)) continue;
    const d=Math.hypot(u.x-wx,u.y-wy);
    if(d<u.radius+18 && d<bd){bd=d;best=u;}
  }
  return best;
}
function hostileAt(wx,wy){
  return unitAt(wx,wy,u=>{
    if(u.type==='monster') return true;
    if(!u.team||u.team===game.playerTeam) return false;
    if((u.type==='tower'||u.type==='inhib'||u.type==='nexus') && !u.attackable) return false;
    return u.visibleTo(game.playerTeam);
  });
}

/* ---------- 输入 ---------- */
function initInput(){
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('mousemove',e=>{ mouse.sx=e.clientX; mouse.sy=e.clientY; });
  canvas.addEventListener('mousedown',e=>{
    if(!game||game.over) return;
    if(e.button===2){ // 右键：移动 / 攻击
      const w=screenToWorld(e.clientX,e.clientY);
      const p=game.player;
      if(p.dead) return;
      const t=hostileAt(w.x,w.y);
      if(t){ p.order={type:'attack',unit:t}; p.atkTarget=null;
        addEffect(game,{kind:'click',x:t.x,y:t.y,color:'#ff5b5b',dur:0.5}); }
      else { p.order={type:'move',x:clampW(w.x),y:clampW(w.y)}; p.atkTarget=null;
        addEffect(game,{kind:'click',x:w.x,y:w.y,color:'#3fb950',dur:0.5}); }
      sfx('click');
    }
  });
  // 小地图
  const mmClick=e=>{
    const r=mmCanvas.getBoundingClientRect();
    const wx=(e.clientX-r.left)/r.width*WORLD, wy=(e.clientY-r.top)/r.height*WORLD;
    if(e.buttons&1 || e.type==='mousedown'&&e.button===0){ cam.locked=false; cam.x=wx; cam.y=wy; }
    if(e.type==='mousedown'&&e.button===2){ const p=game.player; if(!p.dead){ p.order={type:'move',x:clampW(wx),y:clampW(wy)}; p.atkTarget=null; } }
  };
  mmCanvas.addEventListener('mousedown',mmClick);
  mmCanvas.addEventListener('mousemove',e=>{ if(e.buttons&1) mmClick(e); });
  mmCanvas.addEventListener('contextmenu',e=>e.preventDefault());

  window.addEventListener('keydown',e=>{
    if(!game) return;
    const k=e.key.toLowerCase();
    if(k==='tab'){ e.preventDefault(); renderScoreboard(game); $('#scoreboard').style.display='flex'; return; }
    if(game.over) return;
    const p=game.player;
    switch(k){
      case 'q': case 'w': case 'e': case 'r': {
        const i={q:0,w:1,e:2,r:3}[k];
        if(e.ctrlKey){ p.levelUp(i); break; }
        tryCastAbility(game,i); break;
      }
      case 'd': { const w=screenToWorld(mouse.sx,mouse.sy); p.castSumm(game,0,w); break; }
      case 'f': p.castSumm(game,1,null); break;
      case 'b': if(!p.dead && p.order.type!=='recall') game.startRecall(p); break;
      case 's': if(!p.dead){ p.order={type:'hold'}; p.atkTarget=null; } break;
      case 'p': toggleShop(game); break;
      case 'y': cam.locked=!cam.locked; announce(game,cam.locked?'视角已锁定':'视角已解锁',{small:true,color:'#9fd8ef'}); break;
      case 'm': soundOn=!soundOn; announce(game,soundOn?'声音开启':'声音关闭',{small:true,color:'#9fd8ef'}); break;
      case ' ': cam.locked=true; cam.x=p.x; cam.y=p.y; e.preventDefault(); break;
      case 'escape':
        if(shopOpen){ toggleShop(game,false); break; }
        game.paused=!game.paused;
        $('#pause-overlay').style.display=game.paused?'flex':'none';
        break;
    }
  });
  window.addEventListener('keyup',e=>{
    if(e.key==='Tab') $('#scoreboard').style.display='none';
  });
  // 出售装备（右键）
  $('#hud-items').addEventListener('contextmenu',e=>{
    e.preventDefault();
    const slot=e.target.closest('.item-slot');
    if(slot) sellItem(game,+slot.dataset.slot);
  });
  $('#btn-shop').addEventListener('click',()=>toggleShop(game));
  $('#btn-resume').addEventListener('click',()=>{ game.paused=false; $('#pause-overlay').style.display='none'; });
  $('#btn-surrender').addEventListener('click',()=>{ game.over={winner:enemyTeam(game.playerTeam)}; $('#pause-overlay').style.display='none'; });
  $('#btn-again').addEventListener('click',()=>location.reload());
  window.addEventListener('resize',resize);
}

function tryCastAbility(g,i){
  const p=g.player;
  if(p.dead) return;
  const a=p.abilities[i];
  if(a.lvl===0){ if(p.canLevel(i)){ p.levelUp(i); sfx('click'); } return; }
  const w=screenToWorld(mouse.sx,mouse.sy);
  let aim={x:w.x,y:w.y};
  if(a.def.aim==='unit'){
    // 取鼠标附近射程内最近敌人
    let best=null,bd=1e9;
    for(const u of g.units()){
      if(u.dead||u.untargetable||!u.team&&u.type!=='monster') continue;
      if(u.type==='monster'){} else if(u.team===p.team) continue;
      if(u.type==='tower'||u.type==='inhib'||u.type==='nexus') continue;
      if(u.team && !u.visibleTo(p.team)) continue;
      if(dist(p,u)>a.def.range+u.radius) continue;
      const d=Math.hypot(u.x-w.x,u.y-w.y);
      if(d<200 && d<bd){bd=d;best=u;}
    }
    if(!best){ announce(g,'没有有效目标',{small:true,color:'#e88'}); sfx('error'); return; }
    aim.unit=best;
  }
  const before=p.mp;
  if(!p.castAbility(g,i,aim)){
    if(g.t<a.readyAt) {} // 冷却中，静默
    else if(p.mp<lvlv(a.def.mana,a.lvl)){ announce(g,'法力不足',{small:true,color:'#6f9fe8'}); sfx('error'); }
  }
}

/* ---------- 相机 ---------- */
function updateCamera(dt){
  const p=game.player;
  if(cam.locked){ cam.x=p.x; cam.y=p.y; }
  else {
    const m=22, spd=1400/cam.zoom*dt;
    if(mouse.sx<m) cam.x-=spd;
    if(mouse.sx>window.innerWidth-m) cam.x+=spd;
    if(mouse.sy<m) cam.y-=spd;
    if(mouse.sy>window.innerHeight-m) cam.y+=spd;
  }
  cam.x=Math.max(300,Math.min(WORLD-300,cam.x));
  cam.y=Math.max(200,Math.min(WORLD-200,cam.y));
}

function resize(){
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  cam.zoom=Math.max(canvas.width/1750, canvas.height/1100);
}

/* ---------- 主循环 ---------- */
let lastFrame=0, hudTick=0;
function loop(now){
  const dt=Math.min(0.05,(now-lastFrame)/1000); lastFrame=now;
  if(game){
    if(!game.paused && !game.over) game.update(dt);
    updateCamera(dt);
    renderWorld(game,ctx,cam);
    renderMinimap(game,mmCtx,cam,canvas);
    updateHUD(game);
    if(shopOpen && (hudTick++%20===0)) $('#shop-gold').textContent=Math.floor(game.player.gold);
    if(game.over && !game._endShown){ game._endShown=true; showEndScreen(game); }
  }
  requestAnimationFrame(loop);
}

/* ---------- 启动 ---------- */
window.addEventListener('DOMContentLoaded',()=>{
  canvas=$('#game-canvas'); ctx=canvas.getContext('2d');
  mmCanvas=$('#minimap'); mmCtx=mmCanvas.getContext('2d');
  initSelect();
  initInput();
});
