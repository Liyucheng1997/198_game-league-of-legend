import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone} from './vendor/SkeletonUtils.js';

// One shared WebGL surface is composited into the existing 2D world. This keeps
// collision, camera/input and all game mechanics independent of model loading.
const templates=new Map(),instances=new Map(),errors=[];
const canvas=document.createElement('canvas');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;}
catch(error){errors.push(error.message);}
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-80,80,80,-80,.1,1500);
camera.position.set(0,215,260);camera.lookAt(0,40,0);
const loader=new GLTFLoader();
const ids=['garen','darius','ashe','caitlyn','ahri','lux','annie','yi','malphite','soraka'];
function updateStatus(){const el=document.getElementById('model-status');if(el)el.textContent=renderer?`经典 3D 模型 ${templates.size}/10${errors.length?' · 部分加载失败':''}`:'WebGL 不可用 · 使用 2D 角色';}
function matchClip(clips,type){
  const patterns={idle:[/^idle1$/, /^idle$/, /^idle/],run:[/^run$/, /^run1$/, /^run/,/^walk/],attack:[/^attack1$/, /^attack/,/^spell1/],q:[/^spell1$/, /^spell1/,/^attack/],w:[/^spell2$/, /^spell2/,/^idle/],e:[/^spell3$/, /^spell3/,/^attack/],r:[/^spell4$/, /^spell4/,/^attack/],recall:[/^recall$/, /^recall/,/^idle/]};
  for(const pattern of patterns[type]||patterns.idle){const clip=clips.find(c=>pattern.test(c.name));if(clip)return clip;}return clips[0];
}
function instance(c){
  if(instances.has(c.id))return instances.get(c.id);
  const gltf=templates.get(c.def.id);if(!gltf)return null;
  const root=clone(gltf.scene),mixer=new THREE.AnimationMixer(root),idle=matchClip(gltf.animations,'idle');
  if(idle)mixer.clipAction(idle).play();mixer.update(.01);root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root,true),h=Math.max(20,box.max.y-box.min.y),scale=80/h;
  root.scale.setScalar(scale);root.position.y=-box.min.y*scale;
  // Center the actor's bind-pose body while retaining animated tails/weapons.
  root.position.x=-(box.min.x+box.max.x)*.5*scale;root.position.z=-(box.min.z+box.max.z)*.5*scale;
  const group=new THREE.Group();group.add(root);root.traverse(o=>{if(o.isMesh){o.frustumCulled=false;}});
  const value={group,root,mixer,clips:gltf.animations,action:idle?mixer.clipAction(idle):null,key:'idle',lastTime:0};instances.set(c.id,value);return value;
}
window.RiftModels={
  get loaded(){return templates.size;},get errors(){return errors.slice();},
  draw(ctx,g,c){
    if(!renderer)return false;const actor=instance(c);if(!actor)return false;
    const anim=c.heroAnim,active=anim&&g.t<anim.start+anim.dur;
    const moving=c.order?.type==='move'||c.order?.type==='attackmove'||c.order?.type==='attack'&&c.order.unit&&Math.hypot(c.x-c.order.unit.x,c.y-c.order.unit.y)>c.stat('range')+40;
    const key=active?anim.type:c.order?.type==='recall'?'recall':moving?'run':'idle';
    const clip=matchClip(actor.clips,key),stamp=active?anim.start:0;
    if(clip&&(actor.key!==key||actor.stamp!==stamp)){
      const next=actor.mixer.clipAction(clip);next.reset();next.enabled=true;next.setEffectiveWeight(1);
      next.setLoop(active?THREE.LoopOnce:THREE.LoopRepeat,active?1:Infinity);next.clampWhenFinished=!!active;next.setEffectiveTimeScale(active?clip.duration/Math.max(.2,anim.dur):1);
      if(actor.action&&actor.action!==next)actor.action.fadeOut(.08);next.fadeIn(.08).play();actor.action=next;actor.key=key;actor.stamp=stamp;
    }
    actor.mixer.update(Math.max(0,Math.min(.08,g.t-actor.lastTime)));actor.lastTime=g.t;
    actor.group.rotation.y=-c.faceAngle+Math.PI/2;
    scene.add(actor.group);renderer.render(scene,camera);scene.remove(actor.group);
    ctx.save();ctx.globalAlpha=c.untargetable?.35:1;ctx.drawImage(canvas,c.x-75,c.y-110,150,150);ctx.restore();return true;
  },
};
if(renderer)Promise.all(ids.map(async id=>{
  try{const gltf=await loader.loadAsync(`assets/models/${id}.glb`);templates.set(id,gltf);}
  catch(error){errors.push(id+': '+error.message);console.warn('Model fallback:',id,error.message);}
  updateStatus();
}));
updateStatus();
