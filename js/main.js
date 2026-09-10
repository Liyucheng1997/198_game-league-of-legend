/* ============ 主程序：英雄选择 / 输入 / 相机 / 主循环 ============ */
"use strict";

let game=null;
let cam={x:1000, y:6000, zoom:1, locked:true};
let mouse={x:0,y:0, sx:0, sy:0};
let canvas, ctx, mmCanvas, mmCtx;
let selectedChamp=null;
let selectedMode='classic',selectedRole='top',attackMoveArmed=false;

/* ---------- 英雄选择界面 ---------- */
function initSelect(){
  const grid=$('#champ-grid');
  CHAMPIONS.forEach(def=>{
    const d=document.createElement('button');
    d.className='champ-card'; d.dataset.id=def.id;
    d.innerHTML=`${portraitHTML(def)}<div class="cc-name">${def.name}</div><div class="cc-role">${ROLE_NAMES[def.role]}</div>`;
    d.addEventListener('click',()=>selectChamp(def));
    grid.appendChild(d);
  });
  $('#btn-lock').addEventListener('click',()=>{ if(selectedChamp) startGame(selectedChamp.id); });
  $('#role-select').addEventListener('change',e=>{selectedRole=e.target.value;updateDraftPreview();});
  $$('.mode-picker button').forEach(b=>b.addEventListener('click',()=>{selectedMode=b.dataset.mode;$$('.mode-picker button').forEach(x=>x.classList.toggle('on',x===b));$('#btn-lock').innerHTML=(selectedMode==='practice'?'进入训练模式':'锁定 · 进入峡谷')+' <span>→</span>';}));
  $('#btn-sources').addEventListener('click',()=>$('#sources-dialog').showModal());
  $('#close-sources').addEventListener('click',()=>$('#sources-dialog').close());
  selectChamp(CHAMP_BY_ID.ahri||CHAMPIONS[0]);
}
function selectChamp(def){
  selectedChamp=def;
  selectedRole=def.role||'mid';$('#role-select').value=selectedRole;
  $('#select-screen').style.backgroundImage=`url("${def.splash}")`;
  $$('.champ-card').forEach(c=>c.classList.toggle('picked', c.dataset.id===def.id));
  $('#sel-portrait').innerHTML=portraitHTML(def,'lg');
  $('#sel-name').textContent=def.name;
  $('#sel-title').textContent=def.title;
  $('#sel-passive').textContent='被动 · '+def.passive;
  $('#sel-skills').innerHTML=def.abilities.map(a=>
    `<div class="sel-skill" tabindex="0" title="${a.name}"><span class="ss-icon">${iconHTML(a)}</span><span class="ss-key">${a.key}</span><div class="ss-tip"><b>${a.name}</b><br>${a.desc(1)}<br><span class="tip-dim">冷却 ${a.cd.join('/')} 秒</span></div></div>`).join('');
  // 阵容预览：己方 = 玩家 + 其余英雄；敌方 = 全部英雄
  updateDraftPreview();
  sfx('click');
}
function updateDraftPreview(){const draft=createDraft(selectedChamp.id,selectedRole);for(const team of ['blue','red'])$('#team-'+team+'-list').innerHTML=draft[team].map(({def,role})=>`<div class="team-row ${team==='blue'&&def===selectedChamp?'me':''}">${portraitHTML(def)}<div><strong>${def.name}</strong><span>${ROLE_NAMES[role]} · ${team==='blue'&&def===selectedChamp?'你':'电脑'}</span></div></div>`).join('');}

/* ---------- 开始游戏 ---------- */
async function startGame(champId){
  const button=$('#btn-lock');button.disabled=true;button.textContent='正在准备峡谷…';
  try{await RIFT_MAP_READY;}catch(error){button.textContent='地图加载失败 · 点击重试';button.disabled=false;return;}
  $('#select-screen').style.display='none';
  $('#game-screen').style.display='block';
  game=new Game(champId,{mode:selectedMode,lane:selectedRole});
  $('#match-mode').textContent=game.training?'训练模式 · 自由练习':'5V5 人机 · 召唤师峡谷';
  $('#practice-controls').style.display=game.training?'flex':'none';
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
    if(u.type==='monster') return u.visibleTo(game.playerTeam);
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
    if(!game||game.over||game.paused) return;
    if(e.button===0&&attackMoveArmed){const w=screenToWorld(e.clientX,e.clientY);game.player.order={type:'attackmove',x:clampW(w.x),y:clampW(w.y)};attackMoveArmed=false;addEffect(game,{kind:'click',x:w.x,y:w.y,color:'#e6af63',dur:.5});return;}
    if(e.button===2){ // 右键：移动 / 攻击
      const w=screenToWorld(e.clientX,e.clientY);
      const p=game.player;
      if(p.dead||p.untargetable) return;
      attackMoveArmed=false;p.buffs=p.buffs.filter(b=>!b.channel);p._nav=null;
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
    if(!game||game.over||game.paused)return;
    const r=mmCanvas.getBoundingClientRect();
    const wx=(e.clientX-r.left)/r.width*WORLD, wy=(e.clientY-r.top)/r.height*WORLD;
    if(e.buttons&1 || e.type==='mousedown'&&e.button===0){ cam.locked=false; cam.x=wx; cam.y=wy; }
    if(e.type==='mousedown'&&e.button===2){ const p=game.player; if(!p.dead&&!p.untargetable){ p.order={type:'move',x:clampW(wx),y:clampW(wy)};p.buffs=p.buffs.filter(b=>!b.channel);p._nav=null; p.atkTarget=null; } }
  };
  mmCanvas.addEventListener('mousedown',mmClick);
  mmCanvas.addEventListener('mousemove',e=>{ if(e.buttons&1) mmClick(e); });
  mmCanvas.addEventListener('contextmenu',e=>e.preventDefault());

  window.addEventListener('keydown',e=>{
    if(!game) return;
    const k=e.key.toLowerCase();
    if(k==='tab'){ e.preventDefault(); renderScoreboard(game); $('#scoreboard').style.display='flex'; return; }
    if(game.over) return;
    if(game.paused&&!['escape','m','tab'].includes(k))return;
    if(e.repeat&&['q','w','e','r','d','f','4'].includes(k))return;
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
      case 's': if(!p.dead&&!p.untargetable){ p.order={type:'stop'}; p.atkTarget=null;p.buffs=p.buffs.filter(b=>!b.channel); } break;
      case 'a':attackMoveArmed=true;break;
      case '4':placeWard(game,screenToWorld(mouse.sx,mouse.sy));break;
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
  $('#btn-select').addEventListener('click',()=>location.reload());
  $('#practice-reset').addEventListener('click',()=>{if(game?.training&&!game.paused)refreshPractice(game);});
  $('#practice-cooldowns').addEventListener('click',e=>{if(!game?.training)return;game.freeCooldowns=!game.freeCooldowns;e.target.textContent='无限冷却：'+(game.freeCooldowns?'开':'关');});
  $('#practice-wave').addEventListener('click',()=>{if(game?.training&&!game.paused)game.spawnWave();});
  $('#practice-reveal').addEventListener('click',e=>{if(!game?.training)return;game.practiceReveal=!game.practiceReveal;game.nextVisionAt=0;e.target.textContent='全图视野：'+(game.practiceReveal?'开':'关');});
  $('#btn-surrender').addEventListener('click',()=>{ game.over={winner:enemyTeam(game.playerTeam)}; $('#pause-overlay').style.display='none'; });
  $('#btn-again').addEventListener('click',()=>location.reload());
  window.addEventListener('resize',resize);
}

function tryCastAbility(g,i){
  const p=g.player;
  if(p.dead||g.paused||g.over) return;
  const a=p.abilities[i];
  if(a.lvl===0){ if(p.canLevel(i)){ p.levelUp(i); sfx('click'); } return; }
  const w=screenToWorld(mouse.sx,mouse.sy);
  let aim={x:w.x,y:w.y};
  if(a.def.aim==='unit'||a.def.aim==='ally'){
    // 取鼠标附近射程内最近敌人
    let best=null,bd=1e9;
    for(const u of g.units()){
      if(u.dead||u.untargetable||!u.team&&u.type!=='monster') continue;
      if(a.def.aim==='ally'){if(u.type!=='champ'||u.team!==p.team||(!a.def.allowSelf&&u===p))continue;}
      else if(u.type==='monster'){} else if(u.team===p.team) continue;
      if(a.def.champOnly&&u.type!=='champ')continue;
      if(u.type==='tower'||u.type==='inhib'||u.type==='nexus') continue;
      if(u.team && !u.visibleTo(p.team)) continue;
      if(dist(p,u)>a.def.range+u.radius) continue;
      const d=Math.hypot(u.x-w.x,u.y-w.y);
      if(d<200 && d<bd){bd=d;best=u;}
    }
    if(!best&&a.def.aim==='ally'&&a.def.allowSelf)best=p;
    if(!best){ announce(g,a.def.aim==='ally'?'请将鼠标指向范围内的友方英雄':'没有有效目标',{small:true,color:'#e88'}); sfx('error'); return; }
    aim.unit=best;
  }
  const before=p.mp;
  if(!p.castAbility(g,i,aim)){
    if(p.isSilenced())announce(g,'沉默中，无法施法',{small:true,color:'#bc9ace'});
    else if(a.def.canCast&&!a.def.canCast(g,p))announce(g,p.def.id==='ashe'?'需要 4 层专注':'技能暂不可用',{small:true,color:'#e6c08c'});
    else if(g.t<a.readyAt) {} // 冷却中，静默
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
