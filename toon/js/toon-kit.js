// 卡通手绘渲染工具：色阶材质、描边、程序化几何与纹理。所有资产都由这里的代码生成。
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from '../../js/vendor/BufferGeometryUtils.js';

export { mergeGeometries };
export const INK = '#2b1b14';

// ---------- 随机与噪声 ----------
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, y * f) * amp; f *= 2.03; amp *= 0.5; }
  return s;
}
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t * t * (3 - 2 * t);
export const easeOut = t => 1 - (1 - t) * (1 - t);

// ---------- 材质 ----------
let gradTex = null;
export function gradientMap() {
  if (!gradTex) {
    gradTex = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
    gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter;
    gradTex.generateMipmaps = false;
    gradTex.needsUpdate = true;
  }
  return gradTex;
}

// 战争迷雾：对局中写入一张覆盖全图的视野贴图（红通道 1 = 看不见），amt 为压暗程度
export const FOG = { tex: { value: null }, amt: { value: 0 } };
function withFog(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFogTex = FOG.tex; sh.uniforms.uFogAmt = FOG.amt;
    sh.vertexShader = 'varying vec2 vFogW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 fogWP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        fogWP = instanceMatrix * fogWP;
      #endif
      vFogW = (modelMatrix * fogWP).xz;`);
    sh.fragmentShader = 'uniform sampler2D uFogTex; uniform float uFogAmt; varying vec2 vFogW;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      if (uFogAmt > 0.0) {
        float fogK = texture2D(uFogTex, vec2(vFogW.x / 220.0 + 0.5, 0.5 - vFogW.y / 220.0)).r;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.42, 0.45, 0.58), uFogAmt * fogK);
      }`);
  };
  return m;
}
const matCache = new Map();
export function toon(color, o = {}) {
  const key = `${color}|${o.emissive || ''}|${o.ei ?? ''}|${o.opacity ?? ''}|${o.map ? o.map.uuid : ''}|${o.side || ''}`;
  if (!o.fresh && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({
    color, gradientMap: gradientMap(),
    emissive: o.emissive || '#000000', emissiveIntensity: o.ei ?? 1,
    transparent: o.opacity !== undefined && o.opacity < 1, opacity: o.opacity ?? 1,
    map: o.map || null, side: o.side || THREE.FrontSide,
  });
  withFog(m);
  if (!o.fresh) matCache.set(key, m);
  return m;
}
export function glowMat(color, opacity = 1, additive = true) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

const OUTLINE_VS = `
uniform float uThick;
void main(){
  vec3 p = position; vec3 n = normal;
  #ifdef USE_INSTANCING
    p = (instanceMatrix * vec4(p, 1.0)).xyz;
    n = mat3(instanceMatrix) * n;
  #endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 vn = normalize(normalMatrix * n);
  float k = uThick * clamp(-mv.z / 26.0, 0.55, 2.2);
  mv.xyz += vn * k;
  gl_Position = projectionMatrix * mv;
}`;
const OUTLINE_FS = `
uniform vec3 uColor; uniform float uAlpha;
void main(){ gl_FragColor = vec4(uColor, uAlpha); }`;

const olCache = new Map();
export function outlineMat(thick = 0.03, color = INK) {
  const key = thick + color;
  if (olCache.has(key)) return olCache.get(key);
  const m = new THREE.ShaderMaterial({
    uniforms: { uThick: { value: thick }, uColor: { value: new THREE.Color(color).convertLinearToSRGB() }, uAlpha: { value: 1 } },
    vertexShader: OUTLINE_VS, fragmentShader: OUTLINE_FS, side: THREE.BackSide,
  });
  olCache.set(key, m);
  return m;
}

const olGeo = new WeakMap();
export function outlineGeo(geo) {
  let g = olGeo.get(geo);
  if (!g) {
    g = new THREE.BufferGeometry();
    g.setAttribute('position', geo.getAttribute('position').clone());
    if (geo.index) g.setIndex(geo.index.clone());
    g = mergeVertices(g, 1e-3);
    g.computeVertexNormals();
    olGeo.set(geo, g);
  }
  return g;
}

export function addOutline(mesh, thick = 0.03, color = INK) {
  let o;
  if (mesh.isInstancedMesh) {
    o = new THREE.InstancedMesh(outlineGeo(mesh.geometry), outlineMat(thick, color), mesh.count);
    o.instanceMatrix = mesh.instanceMatrix;
  } else {
    o = new THREE.Mesh(outlineGeo(mesh.geometry), outlineMat(thick, color));
  }
  o.castShadow = false; o.receiveShadow = false;
  o.raycast = () => {};
  o.userData.outline = true;
  mesh.add(o);
  return o;
}

// P：创建带描边的卡通网格
export function P(geo, color, o = {}) {
  const mat = o.mat || toon(color, o);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = o.shadow !== false;
  m.receiveShadow = !!o.receive;
  if (o.outline !== false) addOutline(m, o.ol ?? 0.028, o.olColor || INK);
  if (o.pos) m.position.set(o.pos[0], o.pos[1], o.pos[2]);
  if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2], o.order || 'XYZ');
  if (o.s !== undefined) Array.isArray(o.s) ? m.scale.set(o.s[0], o.s[1], o.s[2]) : m.scale.setScalar(o.s);
  if (o.parent) o.parent.add(m);
  return m;
}

// ---------- 几何缓存 ----------
const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
export const G = {
  sphere: (w = 20, h = 14) => cached(`s${w}_${h}`, () => new THREE.SphereGeometry(1, w, h)),
  hemi: () => cached('hemi', () => new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
  capsule: (r, l, seg = 10) => cached(`c${r}_${l}_${seg}`, () => new THREE.CapsuleGeometry(r, l, 5, seg)),
  cyl: (rt, rb, h, seg = 14) => cached(`y${rt}_${rb}_${h}_${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  cone: (r, h, seg = 12) => cached(`k${r}_${h}_${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  box: (w, h, d) => cached(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d)),
  torus: (R, r, arc = Math.PI * 2, rs = 8, ts = 24) => cached(`t${R}_${r}_${arc}_${rs}_${ts}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc)),
  ico: (r, d = 0) => cached(`i${r}_${d}`, () => new THREE.IcosahedronGeometry(r, d)),
  dodeca: (r) => cached(`d${r}`, () => new THREE.DodecahedronGeometry(r, 0)),
  octa: (r) => cached(`o${r}`, () => new THREE.OctahedronGeometry(r, 0)),
  lathe: (key, pts, seg = 22) => cached(`l${key}`, () => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg)),
  shape: (key, make, depth = 0.06, bevel = 0.02) => cached(`sh${key}`, () => {
    const g = new THREE.ExtrudeGeometry(make(), { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 10 });
    g.center();
    return g;
  }),
  plane: (w, h) => cached(`p${w}_${h}`, () => new THREE.PlaneGeometry(w, h)),
  ring: (a, b, seg = 48) => cached(`r${a}_${b}_${seg}`, () => new THREE.RingGeometry(a, b, seg)),
  circle: (seg = 40) => cached(`ci${seg}`, () => new THREE.CircleGeometry(1, seg)),
};

// ---------- 画布纹理 ----------
export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = o.aniso || 4;
  t.userData.canvas = c;
  return t;
}

// 纸张纹理（覆盖在屏幕上的手绘纸感）
export function paperDataURL(size = 384) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = fbm(x / 22, y / 22, 3) * 0.6 + hash2(x, y) * 0.4;
    const v = 200 + n * 55;
    const i = (y * size + x) * 4;
    img.data[i] = v; img.data[i + 1] = v * 0.97; img.data[i + 2] = v * 0.9; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const r = rng(7);
  g.strokeStyle = 'rgba(120,95,60,0.10)';
  for (let i = 0; i < 160; i++) {
    g.lineWidth = 0.6 + r();
    const x = r() * size, y = r() * size, a = r() * Math.PI, l = 6 + r() * 22;
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r() * 4, y + Math.sin(a) * l * 0.5 + r() * 4, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return c.toDataURL();
}

// 手绘风格的抖动线条
export function wobblyPath(g, pts, jitter = 1.5, seed = 3) {
  const r = rng(seed);
  g.beginPath();
  pts.forEach((p, i) => {
    const x = p[0] + (r() - 0.5) * jitter, y = p[1] + (r() - 0.5) * jitter;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
}

// 对眼睛、嘴巴等贴在球面上的部件计算位置与朝向
export function onSphere(R, nx, ny, nz, lift = 0) {
  const l = Math.hypot(nx, ny, nz);
  nx /= l; ny /= l; nz /= l;
  return {
    pos: [nx * (R + lift), ny * (R + lift), nz * (R + lift)],
    rot: [-Math.asin(ny), Math.atan2(nx, nz), 0],
  };
}

export function disposeTree(obj) {
  obj.traverse(o => {
    if (o.material && o.material.userData?.disposable) o.material.dispose();
  });
}
