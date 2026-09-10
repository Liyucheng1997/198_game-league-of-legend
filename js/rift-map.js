/* Shared geometry: terrain rendering, movement collision, fog and jungle AI. */
'use strict';
const RIFT_WALLS_BLUE = [
  [[1000,2100],[1360,1940],[1580,2180],[1510,2680],[1280,2830],[1130,2570]],
  [[1800,2490],[2050,2480],[2180,2720],[2050,3080],[1820,3070],[1670,2870]],
  [[2300,3000],[2500,3050],[2740,3330],[2550,3520],[2230,3370]],
  [[1160,3520],[1420,3450],[1560,3610],[1400,3960],[1150,4200],[1010,3980]],
  [[1900,3680],[2250,3710],[2230,3920],[2100,4160],[1850,4390],[1630,4300],[1720,4060]],
  [[2450,4360],[2670,4190],[2870,4280],[2810,4560],[2570,4720],[2370,4650]],
  [[3110,4740],[3300,4540],[3610,4650],[3740,4900],[3480,4990],[3230,4940]],
  [[2770,5130],[3020,5030],[3320,5290],[3270,5550],[3080,5710],[2850,5530]],
  [[4020,5020],[4260,4880],[4480,5010],[4440,5350],[4190,5530],[4020,5320]],
  [[4050,5890],[4520,5660],[4770,5740],[4700,6050],[4400,6170],[4100,6080]],
  [[1920,5580],[2200,5390],[2440,5460],[2580,5750],[2390,5880],[2060,5840]],
];
const RIFT_WALLS=[...RIFT_WALLS_BLUE,...RIFT_WALLS_BLUE.map(p=>p.map(([x,y])=>[WORLD-x,WORLD-y]))].map(points=>({points,
  minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))}));
const BRUSH_BLUE=[{x:620,y:2770,r:130},{x:590,y:3350,r:150},{x:1080,y:1710,r:140},{x:2370,y:2370,r:170},{x:3180,y:3020,r:150},{x:1400,y:4670,r:130},{x:2650,y:4980,r:130},{x:3610,y:5480,r:145},{x:4960,y:6180,r:130},{x:5570,y:6380,r:150}];
const RIFT_BRUSH=[...BRUSH_BLUE,...BRUSH_BLUE.map(p=>({...reflect(p),r:p.r}))];
const CAMP_BLUE=[
  {kind:'blue',name:'苍蓝雕纹魔像',x:1805,y:3300,hp:2300,ad:66,gold:90,xp:180,buff:'blueBuff'},
  {kind:'gromp',name:'魔沼蛙',x:980,y:3130,hp:2050,ad:70,gold:90,xp:135},
  {kind:'wolves',name:'暗影狼',x:1760,y:3800,hp:1500,ad:45,gold:75,xp:130},
  {kind:'raptors',name:'锋喙鸟',x:3030,y:4450,hp:1300,ad:35,gold:75,xp:130},
  {kind:'red',name:'绯红印记树怪',x:3650,y:5200,hp:2300,ad:66,gold:90,xp:180,buff:'redBuff'},
  {kind:'krugs',name:'远古石甲虫',x:3900,y:5820,hp:1800,ad:55,gold:95,xp:155},
];
const JUNGLE_CAMPS=[...CAMP_BLUE.map(c=>({...c,side:'blue'})),...CAMP_BLUE.map(c=>({...c,...reflect(c),side:'red'})),
  {kind:'scuttle',name:'峡谷迅捷蟹',x:2110,y:2050,hp:1200,ad:0,gold:70,xp:115,side:'neutral'},
  {kind:'scuttle',name:'峡谷迅捷蟹',x:4890,y:4950,hp:1200,ad:0,gold:70,xp:115,side:'neutral'}];
function inPolygon(x,y,pts){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function mapWalkable(x,y,r=20){
  if(x<40+r||y<40+r||x>WORLD-40-r||y>WORLD-40-r)return false;
  for(const w of RIFT_WALLS){if(x<w.minX-r||x>w.maxX+r||y<w.minY-r||y>w.maxY+r)continue;if(inPolygon(x,y,w.points))return false;
    for(let i=0;i<w.points.length;i++){const a=w.points[i],b=w.points[(i+1)%w.points.length];if(distToSeg(x,y,...a,...b)<r)return false;}}
  return true;
}
function brushAt(u){return RIFT_BRUSH.findIndex(b=>Math.hypot(u.x-b.x,u.y-b.y)<b.r);}
function mapLineClear(a,b,r=20){const d=dist(a,b),n=Math.max(1,Math.ceil(d/30));for(let i=1;i<=n;i++)if(!mapWalkable(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,r))return false;return true;}
function terrainLanding(c,p,throughWalls){
  if(!throughWalls){const n=Math.max(1,Math.ceil(dist(c,p)/12));let last={x:c.x,y:c.y};for(let i=1;i<=n;i++){const q={x:c.x+(p.x-c.x)*i/n,y:c.y+(p.y-c.y)*i/n};if(!mapWalkable(q.x,q.y,c.radius))break;last=q;}return last;}
  if(mapWalkable(p.x,p.y,c.radius))return p;
  for(let r=20;r<480;r+=20)for(let i=0;i<16;i++){const a=i*Math.PI/8,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;if(mapWalkable(x,y,c.radius))return {x,y};}
  return {x:c.x,y:c.y};
}
class RiftNavigation {
  constructor(){this.cell=35;this.n=WORLD/this.cell;this.open=new Uint8Array(this.n*this.n);for(let y=0;y<this.n;y++)for(let x=0;x<this.n;x++)this.open[y*this.n+x]=mapWalkable((x+.5)*this.cell,(y+.5)*this.cell,26)?1:0;}
  point(i){return {x:(i%this.n+.5)*this.cell,y:(Math.floor(i/this.n)+.5)*this.cell};}
  nearest(p){const x=Math.max(0,Math.min(this.n-1,Math.floor(p.x/this.cell))),y=Math.max(0,Math.min(this.n-1,Math.floor(p.y/this.cell)));for(let r=0;r<15;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const xx=x+dx,yy=y+dy,i=yy*this.n+xx;if(xx>=0&&yy>=0&&xx<this.n&&yy<this.n&&this.open[i])return i;}return -1;}
  path(a,b){
    if(mapLineClear(a,b,26))return [{x:b.x,y:b.y}];
    const start=this.nearest(a),end=this.nearest(b);if(start<0||end<0)return [];
    const cost=new Float32Array(this.open.length).fill(Infinity),prev=new Int32Array(this.open.length).fill(-1),closed=new Uint8Array(this.open.length),heap=[];
    const h=i=>dist(this.point(i),this.point(end))/this.cell;
    const push=(i,f)=>{heap.push({i,f});let k=heap.length-1;while(k>0){const p=(k-1)>>1;if(heap[p].f<=f)break;[heap[k],heap[p]]=[heap[p],heap[k]];k=p;}};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;while(true){let j=2*i+1;if(j>=heap.length)break;if(j+1<heap.length&&heap[j+1].f<heap[j].f)j++;if(heap[i].f<=heap[j].f)break;[heap[i],heap[j]]=[heap[j],heap[i]];i=j;}}return top.i;};
    cost[start]=0;push(start,h(start));let found=false;
    while(heap.length){const i=pop();if(closed[i])continue;if(i===end){found=true;break;}closed[i]=1;const x=i%this.n,y=Math.floor(i/this.n);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const xx=x+dx,yy=y+dy,j=yy*this.n+xx;if(xx<0||yy<0||xx>=this.n||yy>=this.n||!this.open[j]||closed[j])continue;if(dx&&dy&&(!this.open[y*this.n+xx]||!this.open[yy*this.n+x]))continue;const n=cost[i]+(dx&&dy?1.4142:1);if(n<cost[j]){cost[j]=n;prev[j]=i;push(j,n+h(j));}}}
    if(!found)return [];
    const raw=[];for(let i=end;i!==start&&i>=0;i=prev[i])raw.push(this.point(i));raw.reverse();
    const out=[];let p=a;for(let i=0;i<raw.length;){let j=i;while(j+1<raw.length&&mapLineClear(p,raw[j+1],26))j++;out.push(raw[j]);p=raw[j];i=j+1;}
    if(mapWalkable(b.x,b.y,26)&&mapLineClear(p,b,26))out.push({x:b.x,y:b.y});return out;
  }
}
function navigateStep(u,x,y,step){
  const g=gameRef;if(!g?.nav)return false;
  if(!u._nav||dist(u._nav.goal,{x,y})>110||g.t>u._nav.until){u._nav={goal:{x,y},points:g.nav.path(u,{x,y}),until:g.t+2};}
  const path=u._nav.points;
  if(!path.length)return true;
  const p=path[0],d=dist(u,p),s=Math.min(step,d),nx=u.x+(p.x-u.x)/(d||1)*s,ny=u.y+(p.y-u.y)/(d||1)*s;
  if(mapWalkable(nx,ny,u.radius)){u.faceAngle=Math.atan2(p.y-u.y,p.x-u.x);u.x=nx;u.y=ny;}else{u._nav=null;return false;}
  if(d<=step+1)path.shift();return path.length===0;
}

// Minion waypoints must reach the Nexus; stopping at the inhibitor made games stall.
for(const lane of ['top','mid','bot']){LANE_PATHS_BLUE[lane].unshift({...NEXUS_POS.blue});LANE_PATHS_BLUE[lane].push({...NEXUS_POS.red});}
Object.assign(CFG,{firstWave:65,inhibRespawn:300,dragonRespawn:300,baronRespawn:360,towerHp:[0,5000,4000,3500,3000],inhibHp:4000,nexusHp:5500,visionRadius:675});
