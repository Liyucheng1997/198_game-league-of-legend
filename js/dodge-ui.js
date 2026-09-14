'use strict';
window.startDodge=function(hero){
  document.getElementById('select-screen').style.display='none';
  let panel=document.getElementById('dodge-screen');
  if(!panel){panel=document.createElement('main');panel.id='dodge-screen';panel.innerHTML=`
    <canvas id="dodge-canvas" aria-label="走位挑战场地，右键点击移动"></canvas>
    <header class="dodge-top"><a href="index.html">◈ 返回选人</a><div><small>MOVEMENT LAB / 走位实验室</small><h1>让每一步，都恰到好处。</h1></div><button id="dodge-settings">设置</button><button id="dodge-pause">暂停 · Esc</button></header>
    <aside class="dodge-config"><span class="dodge-eyebrow">90 秒 · 十英雄挑战</span><h2 id="dodge-hero"></h2><p>右键点击或按住移动<br>S 停止 · D 闪现（15 秒）</p>
      <label>训练强度<select id="dodge-difficulty"><option value="beginner">入门 · 延长预警</option><option value="standard" selected>标准 · 连续躲避</option><option value="expert">进阶 · 多重交叉</option></select></label>
      <label>对手<select id="dodge-opponent"><option value="all">全部十位 · 依次轮换</option>${DODGE_KITS.map(k=>`<option value="${k.id}">${CHAMP_BY_ID[k.id].name} · ${k.name}</option>`).join('')}</select></label>
      <label class="dodge-check"><input id="dodge-guide" type="checkbox" checked>显示辅助预警与碰撞圈</label>
      <button id="dodge-restart">应用设置 / 重新开始</button><p class="dodge-note">按英雄基础移速训练。预警与部分时间为训练参数；易练习拉开距离，盖伦练习脱离范围。</p><div id="dodge-models"></div>
    </aside>
    <section class="dodge-score"><div><small>本局得分</small><strong id="dodge-points">0</strong></div><div><small>连续躲避</small><strong id="dodge-combo">0</strong></div><div><small>命中 / 10</small><strong id="dodge-hits">0</strong></div><div><small>剩余时间</small><strong id="dodge-time">90</strong></div></section>
    <div id="dodge-feedback" role="status"></div><footer class="dodge-bottom"><span id="dodge-flash">D · 闪现就绪</span><span>躲避 +100 · 连击加成最高 +200 · 擦边 +50</span><span id="dodge-best"></span></footer>
    <div id="dodge-modal" class="dodge-modal" hidden><div><small>MOVEMENT LAB</small><h2 id="dodge-modal-title"></h2><p id="dodge-result"></p><button id="dodge-continue">继续训练</button><button id="dodge-again">再练一局</button><a href="index.html">返回选人</a></div></div>`;document.body.appendChild(panel);}
  const $d=id=>document.getElementById(id),cv=$d('dodge-canvas'),cx=cv.getContext('2d');let session,previous=performance.now(),view={scale:1,x:0,y:0},held=false,pointer={x:0,y:0},best=0;
  try{best=Number(localStorage.getItem('rift-dodge-best-v1'))||0;}catch{}
  function restart(){session=new DodgeSession({hero,speed:CHAMP_BY_ID[hero].base.ms*2,difficulty:$d('dodge-difficulty').value,opponent:$d('dodge-opponent').value});session.player.def=CHAMP_BY_ID[hero];window.dodgeSession=session;window.RiftModels?.clear();$d('dodge-modal').hidden=true;$d('dodge-hero').textContent=CHAMP_BY_ID[hero].name+' · '+session.speed+' 移速';previous=performance.now();held=false;panel.classList.remove('settings-open');}
  function aim(e){const r=cv.getBoundingClientRect();pointer={x:(e.clientX-r.left-view.x)/view.scale,y:(e.clientY-r.top-view.y)/view.scale};}
  cv.addEventListener('contextmenu',e=>e.preventDefault());cv.addEventListener('pointerdown',e=>{if(e.button!==2||session.over||session.paused)return;aim(e);held=true;cv.setPointerCapture(e.pointerId);session.move(pointer.x,pointer.y);});cv.addEventListener('pointermove',e=>{aim(e);if(held&&!session.paused&&!session.over)session.move(pointer.x,pointer.y);});cv.addEventListener('pointerup',()=>held=false);cv.addEventListener('pointercancel',()=>held=false);
  function pause(){if(session.over)return;session.paused=!session.paused;held=false;$d('dodge-modal').hidden=!session.paused;$d('dodge-modal-title').textContent='训练已暂停';$d('dodge-result').textContent='休息一下，继续保持节奏。';$d('dodge-continue').hidden=false;}
  window.addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(e.target.tagName))return;if(e.key==='Escape'){e.preventDefault();pause();}if(e.repeat||session.paused||session.over)return;if(e.key.toLowerCase()==='s'){session.target=null;session.player.order={type:'stop'};held=false;}if(e.key.toLowerCase()==='d')session.flash(pointer.x,pointer.y);});
  window.addEventListener('blur',()=>{held=false;if(!session.paused&&!session.over)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&!session.paused&&!session.over)pause();});
  $d('dodge-settings').onclick=()=>panel.classList.toggle('settings-open');$d('dodge-pause').onclick=pause;$d('dodge-continue').onclick=pause;$d('dodge-restart').onclick=restart;$d('dodge-again').onclick=restart;
  function circle(x,y,r,fill,stroke){cx.beginPath();cx.arc(x,y,r,0,Math.PI*2);if(fill){cx.fillStyle=fill;cx.fill();}if(stroke){cx.strokeStyle=stroke;cx.lineWidth=3;cx.stroke();}}
  function shape(c,filled){const k=c.kit,a=c.actor;cx.save();cx.strokeStyle=k.color;cx.fillStyle=k.color+'25';cx.lineWidth=3;
    if(['shot','fan'].includes(k.kind)){cx.translate(a.x,a.y);cx.rotate(c.angle);if(k.kind==='fan'){cx.beginPath();cx.moveTo(0,0);cx.arc(0,0,k.range,-.4,.4);cx.closePath();}else{cx.beginPath();cx.rect(0,-k.r,k.range,k.r*2);}cx.fill();cx.setLineDash([12,14]);cx.stroke();}
    else if(k.kind==='cone'){cx.beginPath();cx.moveTo(a.x,a.y);cx.arc(a.x,a.y,k.range,c.angle-k.spread,c.angle+k.spread);cx.closePath();cx.fill();cx.stroke();}
    else{const pos=['circle','dash'].includes(k.kind)?c.aim:a;circle(pos.x,pos.y,k.r,k.color+(filled?'60':'18'),k.color);if(k.inner)circle(pos.x,pos.y,k.inner,null,k.color+'80');if(!filled){const progress=Math.min(1,(session.t-c.start)/(c.fire-c.start));cx.beginPath();cx.arc(pos.x,pos.y,k.r,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);cx.lineWidth=8;cx.stroke();}}
    cx.restore();
  }
  function actor(a,player=false){const def=CHAMP_BY_ID[a.def.id];a.def=def;cx.save();circle(a.x,a.y,player?50:42,'#06101577',player?'#91f4d1':'#e39889');
    // Existing model renderer uses half-size map units; local scale restores game units.
    cx.translate(a.x,a.y);cx.scale(2,2);const proxy={...a,x:0,y:0,stat:()=>0};if(!window.RiftModels?.draw(cx,session,proxy)){circle(0,-25,25,def.color,'#ecdfb0');cx.fillStyle='#fff';cx.font='bold 12px sans-serif';cx.textAlign='center';cx.fillText(def.name,0,-22);}cx.restore();
    cx.fillStyle=player?'#b6ffe7':'#e8cab8';cx.font='20px "Microsoft YaHei"';cx.textAlign='center';cx.fillText(player?'你':def.name,a.x,a.y+80);
    if(player&&$d('dodge-guide').checked){circle(a.x,a.y,a.radius,null,'#acffe5');circle(a.x,a.y,5,'#fff');}
  }
  function frame(now){const dt=(now-previous)/1000;previous=now;session.update(dt);const w=innerWidth,h=innerHeight,dpr=Math.min(2,devicePixelRatio||1);if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
    cx.setTransform(dpr,0,0,dpr,0,0);cx.fillStyle='#091a20';cx.fillRect(0,0,w,h);const left=w>1000?270:15;view={scale:Math.min((w-left-35)/2350,(h-210)/2000),x:left+(w-left)/2,y:115+(h-210)/2};view.scale=Math.max(.1,view.scale);cx.translate(view.x,view.y);cx.scale(view.scale,view.scale);
    const bg=cx.createRadialGradient(0,0,100,0,0,1200);bg.addColorStop(0,'#284743');bg.addColorStop(1,'#0c2028');circle(0,0,1120,bg);cx.save();circle(0,0,session.limit);cx.clip();cx.strokeStyle='#97c6ba10';cx.lineWidth=2;for(let n=-1000;n<=1000;n+=100){cx.beginPath();cx.moveTo(n,-1000);cx.lineTo(n,1000);cx.moveTo(-1000,n);cx.lineTo(1000,n);cx.stroke();}cx.restore();circle(0,0,session.limit,null,'#77988a');circle(0,0,session.limit+25,null,'#a58b5340');circle(0,0,250,null,'#9bb9aa16');
    if(session.target){cx.setLineDash([8,12]);cx.strokeStyle='#88dfb66a';cx.beginPath();cx.moveTo(session.player.x,session.player.y);cx.lineTo(session.target.x,session.target.y);cx.stroke();cx.setLineDash([]);circle(session.target.x,session.target.y,18,null,'#9ff7cd');}
    for(const c of session.casts)if(!c.done){if(!c.fired){if($d('dodge-guide').checked)shape(c,false);}else if(!['shot','fan'].includes(c.kit.kind))shape(c,true);}
    const actors=[...session.casts.filter(c=>!c.done).map(c=>c.actor),session.player].sort((a,b)=>a.y-b.y);for(const a of actors)actor(a,a===session.player);
    for(const s of session.shots){const k=s.c.kit;cx.save();cx.translate(s.x,s.y);cx.rotate(Math.atan2(s.dy,s.dx));cx.shadowColor=k.color;cx.shadowBlur=16;cx.fillStyle=k.color;cx.beginPath();cx.ellipse(0,0,k.r*1.5,k.r,0,0,Math.PI*2);cx.fill();cx.shadowBlur=0;cx.strokeStyle='#fff';cx.lineWidth=4;cx.beginPath();cx.moveTo(-k.r,0);cx.lineTo(k.r,0);cx.stroke();cx.restore();}
    if(session.t<session.hitUntil){cx.setTransform(dpr,0,0,dpr,0,0);cx.fillStyle='#ff354522';cx.fillRect(0,0,w,h);}
    $d('dodge-points').textContent=session.score.toLocaleString();$d('dodge-combo').textContent=session.combo+' 连躲';$d('dodge-hits').textContent=session.hits;$d('dodge-time').textContent=Math.max(0,Math.ceil(session.duration-session.t))+'s';$d('dodge-feedback').textContent=session.t<session.feedbackUntil?session.feedback:'保持移动 · 看施法动作，避开技能路径';$d('dodge-flash').textContent=session.t>=session.flashReady?'D · 闪现就绪':'D · '+Math.ceil(session.flashReady-session.t)+'s';$d('dodge-best').textContent='本机最高 '+best.toLocaleString();$d('dodge-models').textContent='经典模型 '+(window.RiftModels?.loaded||0)+'/10'+(window.RiftModels?.errors.length?' · 部分使用备用形象':'');
    if(session.over&&!session.shown){session.shown=true;best=Math.max(best,session.score);try{localStorage.setItem('rift-dodge-best-v1',String(best));}catch{}$d('dodge-modal').hidden=false;$d('dodge-continue').hidden=true;$d('dodge-modal-title').textContent=session.hits>=10?'调整节奏，再来一次':'挑战完成';const total=session.dodged+session.hits;$d('dodge-result').textContent=`${session.score.toLocaleString()} 分 · 成功躲避 ${session.dodged} 次 · 命中 ${session.hits} 次 · 躲避率 ${total?Math.round(session.dodged/total*100):0}% · 最高 ${session.bestCombo} 连躲`;}requestAnimationFrame(frame);
  }
  restart();requestAnimationFrame(frame);
};
