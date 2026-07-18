/* ============ UI：HUD / 商店 / 记分板 / 播报 / 音效 ============ */
"use strict";

const $ = s=>document.querySelector(s);
const $$ = s=>[...document.querySelectorAll(s)];

/* ---------- 音效（WebAudio 合成） ---------- */
let audioCtx=null, soundOn=true, lastSfx={};
function ac(){
  if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}
function beep(freq,dur,type='sine',vol=0.08,glide=0){
  if(!soundOn) return;
  try{
    const c=ac(), o=c.createOscillator(), g=c.createGain();
    o.type=type; o.frequency.value=freq;
    if(glide) o.frequency.linearRampToValueAtTime(freq+glide, c.currentTime+dur);
    g.gain.setValueAtTime(vol,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime+dur);
  }catch(e){}
}
function sfx(name){
  const now=performance.now();
  if(lastSfx[name] && now-lastSfx[name]<90) return;
  lastSfx[name]=now;
  switch(name){
    case 'attack': beep(220,0.06,'square',0.025); break;
    case 'spell':  beep(520,0.15,'sawtooth',0.05,200); break;
    case 'kill':   beep(660,0.12,'sine',0.1); setTimeout(()=>beep(880,0.2,'sine',0.1),110); break;
    case 'allyDeath': beep(330,0.25,'sine',0.09,-120); break;
    case 'tower':  beep(120,0.5,'sawtooth',0.12,-40); break;
    case 'gold':   beep(1200,0.07,'sine',0.05); break;
    case 'levelup':beep(523,0.1,'sine',0.09); setTimeout(()=>beep(659,0.1,'sine',0.09),100); setTimeout(()=>beep(784,0.18,'sine',0.09),200); break;
    case 'recall': beep(700,0.6,'sine',0.05,300); break;
    case 'flash':  beep(900,0.15,'sine',0.08,400); break;
    case 'heal':   beep(600,0.2,'sine',0.07,150); break;
    case 'beam':   beep(300,0.4,'sawtooth',0.1,500); break;
    case 'victory': [523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,0.35,'sine',0.12),i*180)); break;
    case 'defeat': [400,350,300,250].forEach((f,i)=>setTimeout(()=>beep(f,0.4,'sine',0.1),i*220)); break;
    case 'click':  beep(1000,0.03,'sine',0.03); break;
    case 'buy':    beep(880,0.08,'sine',0.06); setTimeout(()=>beep(1320,0.1,'sine',0.06),80); break;
    case 'error':  beep(180,0.15,'square',0.06); break;
  }
}
function speak(text){
  if(!soundOn || !window.speechSynthesis) return;
  try{
    const u=new SpeechSynthesisUtterance(text);
    u.lang='zh-CN'; u.rate=1.05; u.volume=0.9;
    speechSynthesis.speak(u);
  }catch(e){}
}

/* ---------- 播报 ---------- */
function announce(g, text, opts={}){
  const box=$('#announce');
  const div=document.createElement('div');
  div.className='announce-item'+(opts.small?' small':'');
  div.style.color=opts.color||'#f0d87a';
  div.textContent=text;
  box.appendChild(div);
  setTimeout(()=>div.classList.add('show'),16);
  setTimeout(()=>{ div.classList.remove('show'); setTimeout(()=>div.remove(),600); }, opts.small?1800:3000);
  if(opts.speech) speak(typeof opts.speech==='string'? opts.speech : text);
}
function killFeed(g, killer, victim, killerName){
  const box=$('#killfeed');
  const div=document.createElement('div');
  div.className='kf-item';
  const kTeam = killer? (killer.team===g.playerTeam?'ally':'enemy') : (victim.team===g.playerTeam?'enemy':'ally');
  const vTeam = victim.team===g.playerTeam?'ally':'enemy';
  div.innerHTML=`<span class="kf-${kTeam}">${killerName}</span> <span class="kf-x">⚔</span> <span class="kf-${vTeam}">${victim.name}</span>`;
  box.appendChild(div);
  while(box.children.length>5) box.firstChild.remove();
  setTimeout(()=>{ div.classList.add('fade'); setTimeout(()=>div.remove(),700); },7000);
}

/* ---------- 头像绘制 ---------- */
function portraitHTML(def, cls=''){
  const content=def.portrait
    ? `<img src="${def.portrait}" alt="${def.name}" style="object-position:${def.portraitPos||'50% 50%'}">`
    : `<span>${def.char}</span>`;
  return `<div class="portrait ${cls} ${def.portrait?'hero-art':''}" style="--pc:${def.color}">${content}</div>`;
}

/* ---------- HUD 构建 ---------- */
function buildHUD(g){
  const p=g.player;
  $('#hud-portrait').innerHTML=portraitHTML(p.def);
  // 技能格
  const sk=$('#hud-skills'); sk.innerHTML='';
  p.abilities.forEach((a,i)=>{
    const d=document.createElement('div');
    d.className='skill'; d.dataset.idx=i;
    d.innerHTML=`<div class="skill-up" data-up="${i}">+</div>
      <div class="skill-icon">${a.def.icon}</div>
      <div class="skill-cd"></div>
      <div class="skill-key">${a.def.key}</div>
      <div class="skill-pips">${'<i></i>'.repeat(a.def.maxLvl)}</div>`;
    d.addEventListener('mouseenter',e=>showTip(e, abilityTip(p,i)));
    d.addEventListener('mouseleave',hideTip);
    sk.appendChild(d);
  });
  p.summs.forEach((s,i)=>{
    const d=document.createElement('div');
    d.className='skill summ'; d.dataset.summ=i;
    d.innerHTML=`<div class="skill-icon">${s.def.icon}</div><div class="skill-cd"></div><div class="skill-key">${s.def.key}</div>`;
    d.addEventListener('mouseenter',e=>showTip(e,`<b>${s.def.name}</b><br>${s.def.desc}<br><span class="tip-dim">冷却 ${s.def.cd} 秒</span>`));
    d.addEventListener('mouseleave',hideTip);
    sk.appendChild(d);
  });
  // 加点按钮
  sk.addEventListener('click',e=>{
    const up=e.target.closest('.skill-up');
    if(up){ if(g.player.levelUp(+up.dataset.up)) sfx('click'); return; }
    const skill=e.target.closest('.skill');
    if(skill && skill.dataset.idx!==undefined) tryCastAbility(g,+skill.dataset.idx);
  });
  // 物品格
  const it=$('#hud-items'); it.innerHTML='';
  for(let i=0;i<6;i++){ const d=document.createElement('div'); d.className='item-slot'; d.dataset.slot=i; it.appendChild(d); }
  buildShop(g);
}

function abilityTip(p,i){
  const a=p.abilities[i], lvl=Math.max(1,a.lvl);
  const cost=lvlv(a.def.mana,lvl), cd=lvlv(a.def.cd,lvl);
  return `<b>${a.def.name}</b> <span class="tip-dim">[${a.def.key}] 等级 ${a.lvl}/${a.def.maxLvl}</span><br>${a.def.desc(lvl)}<br><span class="tip-dim">${cost>0? '消耗 '+cost+' 法力 · ':''}冷却 ${cd} 秒</span>`;
}

const tipEl=()=>$('#tooltip');
function showTip(e, html){
  const t=tipEl(); t.innerHTML=html; t.style.display='block';
  const r=e.target.closest('.skill,.item-slot,.shop-item').getBoundingClientRect();
  t.style.left=Math.min(window.innerWidth-320, r.left)+'px';
  t.style.bottom=(window.innerHeight-r.top+8)+'px';
}
function hideTip(){ tipEl().style.display='none'; }

/* ---------- HUD 刷新（每帧） ---------- */
function updateHUD(g){
  const p=g.player;
  // 血蓝条
  $('#hp-fill').style.width=(100*Math.max(0,p.hp)/p.maxHp)+'%';
  $('#hp-text').textContent=`${Math.ceil(Math.max(0,p.hp))} / ${Math.ceil(p.maxHp)}`;
  const sh=p.shieldTotal();
  $('#hp-shield').style.width=sh>0? Math.min(100,100*sh/p.maxHp)+'%':'0%';
  if(p.maxMp>0){
    $('#mp-bar').style.display='';
    $('#mp-fill').style.width=(100*Math.max(0,p.mp)/p.maxMp)+'%';
    $('#mp-text').textContent=`${Math.ceil(Math.max(0,p.mp))} / ${Math.ceil(p.maxMp)}`;
  } else $('#mp-bar').style.display='none';
  // 等级 & 经验
  $('#hud-level').textContent=p.level;
  $('#xp-fill').style.height=(p.level>=18?100:100*p.xp/xpToLevel(p.level))+'%';
  // 技能
  $$('#hud-skills .skill').forEach(el=>{
    if(el.dataset.idx!==undefined){
      const i=+el.dataset.idx, a=p.abilities[i];
      const cdEl=el.querySelector('.skill-cd');
      const remain=a.readyAt-g.t;
      el.classList.toggle('locked', a.lvl===0);
      el.classList.toggle('nomana', a.lvl>0 && p.mp<lvlv(a.def.mana,Math.max(1,a.lvl)));
      if(a.lvl>0 && remain>0){ cdEl.style.display='flex'; cdEl.textContent=remain>1?Math.ceil(remain):remain.toFixed(1); }
      else cdEl.style.display='none';
      el.querySelector('.skill-up').style.display = p.canLevel(i)? 'flex':'none';
      [...el.querySelectorAll('.skill-pips i')].forEach((pip,j)=>pip.classList.toggle('on',j<a.lvl));
    } else {
      const s=p.summs[+el.dataset.summ];
      const cdEl=el.querySelector('.skill-cd');
      const remain=s.readyAt-g.t;
      if(remain>0){ cdEl.style.display='flex'; cdEl.textContent=Math.ceil(remain); } else cdEl.style.display='none';
    }
  });
  // 物品
  $$('#hud-items .item-slot').forEach((el,i)=>{
    const it=p.items[i];
    if(it){ el.textContent=it.icon; el.classList.add('filled'); el.title=it.name; }
    else { el.textContent=''; el.classList.remove('filled'); }
  });
  // 金币 / KDA / CS
  $('#hud-gold').textContent=Math.floor(p.gold);
  $('#hud-kda').textContent=`${p.kills} / ${p.deaths} / ${p.assists}`;
  $('#hud-cs').textContent=p.cs;
  // 属性
  $('#stat-ad').textContent=Math.round(p.stat('ad'));
  $('#stat-ap').textContent=Math.round(p.stat('ap'));
  $('#stat-armor').textContent=Math.round(p.stat('armor'));
  $('#stat-mr').textContent=Math.round(p.stat('mr'));
  $('#stat-as').textContent=p.stat('as').toFixed(2);
  $('#stat-ms').textContent=Math.round(p.stat('ms'));
  // 计时 & 比分
  const t=Math.floor(g.t);
  $('#game-timer').textContent=`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;
  $('#score-blue').textContent=g.teamKills(TEAM_BLUE);
  $('#score-red').textContent=g.teamKills(TEAM_RED);
  // 死亡遮罩
  const dead=$('#death-overlay');
  if(p.dead){ dead.style.display='flex'; $('#death-timer').textContent=Math.ceil(p.respawnAt-g.t); }
  else dead.style.display='none';
  // 回城条
  const rc=$('#recall-bar');
  if(p.order.type==='recall'){ rc.style.display='block';
    $('#recall-fill').style.width=(100*(1-(p.order.doneAt-g.t)/8))+'%'; }
  else rc.style.display='none';
}

/* ---------- 商店 ---------- */
let shopOpen=false;
function buildShop(g){
  const tabs=['攻击','法术','防御','移动'];
  $('#shop-tabs').innerHTML=tabs.map((t,i)=>`<div class="shop-tab ${i===0?'on':''}" data-tab="${t}">${t}</div>`).join('');
  renderShopTab(g,'攻击');
  $('#shop-tabs').addEventListener('click',e=>{
    const t=e.target.closest('.shop-tab'); if(!t) return;
    $$('.shop-tab').forEach(x=>x.classList.toggle('on',x===t));
    renderShopTab(g,t.dataset.tab);
  });
  $('#shop-close').addEventListener('click',()=>toggleShop(g,false));
}
function renderShopTab(g,tab){
  const box=$('#shop-grid'); box.innerHTML='';
  for(const it of ITEMS.filter(i=>i.tab===tab)){
    const d=document.createElement('div');
    d.className='shop-item'; d.dataset.id=it.id;
    d.innerHTML=`<div class="si-icon">${it.icon}</div><div class="si-body"><div class="si-name">${it.name}</div><div class="si-stats">${itemDesc(it)}</div></div><div class="si-price">${it.price}</div>`;
    d.addEventListener('click',()=>buyItem(g,it));
    d.addEventListener('mouseenter',e=>showTip(e,`<b>${it.name}</b><br>${itemDesc(it)}<br><span class="tip-dim">价格 ${it.price} 金币（右键装备栏出售 70%）</span>`));
    d.addEventListener('mouseleave',hideTip);
    box.appendChild(d);
  }
}
function nearShop(g){ return dist(g.player, FOUNTAIN_POS[g.playerTeam])<600; }
function buyItem(g,it){
  const p=g.player;
  if(!nearShop(g) && !p.dead){ announce(g,'离商店太远了',{small:true,color:'#e88'}); sfx('error'); return; }
  if(p.items.length>=6){ announce(g,'装备栏已满',{small:true,color:'#e88'}); sfx('error'); return; }
  if(it.boots && p.items.some(x=>x.boots)){ announce(g,'只能购买一双鞋子',{small:true,color:'#e88'}); sfx('error'); return; }
  if(p.gold<it.price){ announce(g,'金币不足',{small:true,color:'#e88'}); sfx('error'); return; }
  p.gold-=it.price; p.items.push(it); sfx('buy');
}
function sellItem(g,slot){
  const p=g.player, it=p.items[slot];
  if(!it) return;
  if(!nearShop(g) && !p.dead){ announce(g,'离商店太远了',{small:true,color:'#e88'}); return; }
  p.items.splice(slot,1); p.gold+=Math.floor(it.price*0.7); sfx('gold');
}
function toggleShop(g,force){
  shopOpen = force!==undefined? force : !shopOpen;
  $('#shop').style.display=shopOpen?'flex':'none';
  $('#shop-gold').textContent=Math.floor(g.player.gold);
}

/* ---------- 记分板 ---------- */
function renderScoreboard(g){
  const mk=(team)=>{
    const rows=g.champs.filter(c=>c.team===team).map(c=>`
      <tr class="${c===g.player?'me':''}">
        <td>${portraitHTML(c.def,'sm')}</td>
        <td class="sb-name">${c.name}<span class="sb-lvl">Lv.${c.level}</span></td>
        <td>${c.kills}/${c.deaths}/${c.assists}</td>
        <td>${c.cs}</td>
        <td class="sb-gold">${Math.floor(c.gold+c.items.reduce((s,i)=>s+i.price,0))}</td>
        <td class="sb-items">${c.items.map(i=>`<span title="${i.name}">${i.icon}</span>`).join('')}</td>
      </tr>`).join('');
    return `<table class="sb-table"><thead><tr><th></th><th>英雄</th><th>K/D/A</th><th>补刀</th><th>经济</th><th>装备</th></tr></thead><tbody>${rows}</tbody></table>`;
  };
  $('#sb-blue').innerHTML=mk(TEAM_BLUE);
  $('#sb-red').innerHTML=mk(TEAM_RED);
}

/* ---------- 结束画面 ---------- */
function showEndScreen(g){
  const win = g.over.winner===g.playerTeam;
  $('#end-title').textContent= win? '胜利':'失败';
  $('#end-title').className= win? 'win':'lose';
  const p=g.player;
  $('#end-stats').innerHTML=`${p.def.name} · ${p.kills} / ${p.deaths} / ${p.assists} · 补刀 ${p.cs} · 用时 ${Math.floor(g.t/60)} 分 ${Math.floor(g.t%60)} 秒`;
  $('#end-screen').style.display='flex';
  sfx(win?'victory':'defeat');
  speak(win?'胜利':'失败');
}
