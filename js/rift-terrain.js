/* Authentic 2024 map grid replaces the procedural fallback geometry.
 * Mapping uses normalized navgrid X/Z; raster is aligned with Nexus anchors.
 * Static transparent walls block movement without blocking vision. */
'use strict';
const GRID_CELLS=Uint8Array.from(RIFT_GRID.flags,c=>Number(c));
const GRID_BRUSH=new Int16Array(GRID_CELLS.length).fill(-1);
let brushComponentCount=0;
for(let i=0;i<GRID_CELLS.length;i++)if(GRID_CELLS[i]===1&&GRID_BRUSH[i]<0){const pending=[i];GRID_BRUSH[i]=brushComponentCount;while(pending.length){const j=pending.pop(),x=j%RIFT_GRID.width,y=Math.floor(j/RIFT_GRID.width);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=yy*RIFT_GRID.width+xx;if(xx>=0&&yy>=0&&xx<RIFT_GRID.width&&yy<RIFT_GRID.height&&GRID_CELLS[k]===1&&GRID_BRUSH[k]<0){GRID_BRUSH[k]=brushComponentCount;pending.push(k);}}}brushComponentCount++;}
function gridIndex(x,y){const xx=Math.floor(x/WORLD*RIFT_GRID.width),yy=Math.floor(y/WORLD*RIFT_GRID.height);return xx<0||yy<0||xx>=RIFT_GRID.width||yy>=RIFT_GRID.height?-1:yy*RIFT_GRID.width+xx;}
function gridWalkable(x,y,team){const i=gridIndex(x,y);if(i<0)return false;const f=GRID_CELLS[i];return f===0||f===1||f===5&&team==='blue'||f===6&&team==='red';}
mapWalkable=function(x,y,r=20,team=null){
  if(!gridWalkable(x,y,team))return false;
  if(r>0)for(let i=0;i<8;i++){const a=i*Math.PI/4;if(!gridWalkable(x+Math.cos(a)*r,y+Math.sin(a)*r,team))return false;}return true;
};
brushAt=function(u){const i=gridIndex(u.x,u.y);return i<0?-1:GRID_BRUSH[i];};
function visionLineClear(a,b){const d=dist(a,b),n=Math.ceil(d/12);for(let i=1;i<n;i++){const k=gridIndex(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n);if(k<0||GRID_CELLS[k]===2)return false;}return true;}
const blueTowerCells=[[469,2075],[720,3847],[553,4987],[2773,3990],[2393,4737],[1735,5267],[4989,6533],[3281,6311],[2029,6421],[827,5943],[1032,6160]];
const redTowerCells=[[2050,455],[3766,674],[4971,556],[4254,2992],[4639,2235],[5280,1715],[6585,4883],[6324,3128],[6466,2022],[6196,1047],[5987,825]];
for(let i=0;i<TOWER_DEFS_BLUE.length;i++)Object.assign(TOWER_DEFS_BLUE[i],{x:blueTowerCells[i][0],y:blueTowerCells[i][1],rx:redTowerCells[i][0],ry:redTowerCells[i][1]});
const blueInhibCells=[[556,5322],[1519,5498],[1642,6428]],redInhibCells=[[5343,553],[5505,1498],[6457,1666]];
for(let i=0;i<INHIB_DEFS_BLUE.length;i++)Object.assign(INHIB_DEFS_BLUE[i],{x:blueInhibCells[i][0],y:blueInhibCells[i][1],rx:redInhibCells[i][0],ry:redInhibCells[i][1]});
Object.assign(NEXUS_POS.blue,{x:736,y:6231});Object.assign(NEXUS_POS.red,{x:6284,y:756});
Object.assign(FOUNTAIN_POS.blue,{x:255,y:6700});Object.assign(FOUNTAIN_POS.red,{x:6760,y:260});
Object.assign(BARON_POS,{x:2380,y:2470});Object.assign(DRAGON_POS,{x:4660,y:4640});
LANE_PATHS_BLUE.mid=[NEXUS_POS.blue,{x:1519,y:5498},{x:1735,y:5267},{x:2393,y:4737},{x:2773,y:3990},{x:3500,y:3500},{x:4254,y:2992},{x:4639,y:2235},{x:5280,y:1715},{x:5505,y:1498},NEXUS_POS.red];
LANE_PATHS_BLUE.top=[NEXUS_POS.blue,{x:556,y:5322},{x:553,y:4987},{x:720,y:3847},{x:469,y:2075},{x:580,y:840},{x:1050,y:560},{x:2050,y:455},{x:3766,y:674},{x:4971,y:556},{x:5343,y:553},NEXUS_POS.red];
LANE_PATHS_BLUE.bot=[NEXUS_POS.blue,{x:1642,y:6428},{x:2029,y:6421},{x:3281,y:6311},{x:4989,y:6533},{x:6100,y:6410},{x:6440,y:5960},{x:6585,y:4883},{x:6324,y:3128},{x:6466,y:2022},{x:6457,y:1666},NEXUS_POS.red];
// Resolve camp points to a nearby valid floor cell, preserving their assigned quadrants.
for(const camp of JUNGLE_CAMPS){const p=terrainLanding({x:camp.x,y:camp.y,radius:32},camp,true);camp.x=p.x;camp.y=p.y;}
// Building centers are solid navgrid cells. Route waves beside the structures.
for(const lane of Object.keys(LANE_PATHS_BLUE))LANE_PATHS_BLUE[lane]=LANE_PATHS_BLUE[lane].map(p=>({...terrainLanding({x:p.x,y:p.y,radius:45},p,true)}));
