import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

/* ====================================================================
 *  Front-facing room section that is finished layer by layer on scroll.
 *  progress p ∈ [0,1]. Stage windows are in STAGES; keep STEP_BOUNDS in
 *  sync with the caption list in Hero.astro.
 * ==================================================================== */

const STAGES = {
  shell: [0.0, 0.1],
  services: [0.1, 0.22],
  ceiling: [0.22, 0.34],
  floor: [0.34, 0.46],
  paint: [0.46, 0.6],
  joinery: [0.6, 0.7],
  furniture: [0.7, 0.9],
  lights: [0.88, 1.0],
} as const;
const STEP_BOUNDS = [0, 0.1, 0.22, 0.34, 0.46, 0.6, 0.7, 0.9, 1.01];

type R = readonly [number, number];
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const win = (r: R, p: number) => clamp((p - r[0]) / (r[1] - r[0]));
const sub = (r: R, a: number, b: number, p: number) => { const w = r[1] - r[0]; return clamp((p - (r[0] + w * a)) / (w * (b - a))); };
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeO = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* room dimensions (metres) */
const HW = 3.5, ZB = -3.2, ZF = 3.2, H = 3.1, T = 0.28, S = 0.3;
const WIN = { z0: -1.2, z1: 1.8, y0: 0.55, y1: 2.65 };

/* ------------------------- procedural helpers ------------------------ */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function normalFromCanvas(src: HTMLCanvasElement, strength = 2) {
  const w = src.width, h = src.height, g = src.getContext('2d')!, d = g.getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const og = out.getContext('2d')!, o = og.createImageData(w, h);
  const H_ = (x: number, y: number) => d[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H_(x + 1, y) - H_(x - 1, y)) * strength, dy = (H_(x, y + 1) - H_(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    o.data[i] = (-dx / l * 0.5 + 0.5) * 255; o.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; o.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; o.data[i + 3] = 255;
  }
  og.putImageData(o, 0, 0);
  const t = new THREE.CanvasTexture(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function weaveHeight(size: number, seed: number, coarse = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d')!; const r = rng(seed);
  g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
  const step = 4 * coarse;
  for (let y = 0; y < size; y += step) for (let x = 0; x < size; x += step) {
    const v = 110 + ((x / step + y / step) % 2 ? 40 : 0) + r() * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, step - 0.6, step - 0.6);
  }
  for (let i = 0; i < size * 6; i++) { g.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0,0.08)`; g.fillRect(r() * size, r() * size, 1.5, 1.5); }
  return c;
}
/** world-space box projection so any architectural mesh gets uniformly scaled UVs */
function projectUV(g: THREE.BufferGeometry, scale = 0.45) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u: number, v: number;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); } else if (ay >= az) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number, scale = 0.45) => {
  const g = projectUV(new THREE.BoxGeometry(w, h, d), scale); g.translate(x, y, z); return g;
};

/* =================================================================== */
export function initRoomHero() {
  const root = document.querySelector<HTMLElement>('[data-hero]');
  const canvas = root?.querySelector<HTMLCanvasElement>('[data-canvas]');
  if (!root || !canvas) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmall = matchMedia('(max-width: 760px)').matches;
  const qParam = new URLSearchParams(location.search).get('q');

  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch { root.classList.add('no-webgl'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall ? 1.5 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1.6, 0.1, 80);
  const anims: Array<(p: number) => void> = [];
  const loaderEl = root.querySelector<HTMLElement>('[data-loader]');
  const loaderBar = root.querySelector<HTMLElement>('[data-loader-bar]');

  /* --------------------------- loading manager --------------------------- */
  const mgr = new THREE.LoadingManager();
  mgr.onProgress = (_u, loaded, total) => { if (loaderBar) loaderBar.style.transform = `scaleX(${loaded / Math.max(1, total)})`; };
  let ready = false;
  mgr.onLoad = () => { ready = true; loaderEl?.classList.add('is-done'); };
  const texLoader = new THREE.TextureLoader(mgr);
  const gltfLoader = new GLTFLoader(mgr); gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  const BASE = '/hero/';
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const T_ = (file: string, srgb = false) => {
    const t = texLoader.load(BASE + 'tex/' + file); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t;
  };
  const pbr = (set: string, o: { color?: string; map?: boolean; ns?: number; rough?: number; physical?: boolean } = {}) => {
    const params: THREE.MeshPhysicalMaterialParameters = {
      normalMap: T_(`${set}_nor_gl.webp`), normalScale: new THREE.Vector2(o.ns ?? 1, o.ns ?? 1),
      roughnessMap: T_(`${set}_Rough.webp`), roughness: o.rough ?? 1,
    };
    if (o.map !== false) params.map = T_(`${set}_Diffuse.webp`, true);
    if (o.color) params.color = new THREE.Color(o.color);
    return o.physical ? new THREE.MeshPhysicalMaterial(params) : new THREE.MeshStandardMaterial(params);
  };

  /* environment light */
  const pm = new THREE.PMREMGenerator(renderer);
  new HDRLoader(mgr).load(BASE + 'env.hdr', (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pm.fromEquirectangular(hdr).texture; hdr.dispose();
  });
  scene.environmentIntensity = 0.5;

  /* ------------------------------ lights ------------------------------- */
  const sun = new THREE.DirectionalLight('#fff0d8', 3.2);
  sun.position.set(-8, 5.6, 4.6); sun.target.position.set(0, 0.4, -1.2);
  sun.castShadow = true; sun.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#fff4e4', '#d9c8ae', 0.7); scene.add(hemi);
  const bulbLight = new THREE.PointLight('#ffd9a8', 0, 9, 2); bulbLight.position.set(0, 2.55, 0.6); scene.add(bulbLight);
  const coveLights: THREE.PointLight[] = [];
  for (const [x, z] of [[-2.6, -2.2], [2.6, -2.2], [-2.6, 1.8], [2.6, 1.8]] as const) {
    const l = new THREE.PointLight('#ffc888', 0, 6, 2); l.position.set(x, 2.9, z); scene.add(l); coveLights.push(l);
  }
  const pendLights: THREE.PointLight[] = [];
  for (const x of [-0.75, 0, 0.75]) { const l = new THREE.PointLight('#ffcf94', 0, 5, 2); l.position.set(x, 1.95, -0.95); scene.add(l); pendLights.push(l); }
  const panelLight = new THREE.PointLight('#ffb870', 0, 4, 2); panelLight.position.set(0, 2.5, -2.9); scene.add(panelLight);

  /* ========================== ARCHITECTURAL SHELL ========================== */
  const poche = new THREE.MeshBasicMaterial({ color: '#2a241d' });
  const rawWall = pbr('concrete_wall_008', { color: '#f4efe8', ns: 1.2 });
  const rawFloor = pbr('plastered_wall_04', { color: '#d4d0ca', ns: 1.5 });
  const rawCeil = pbr('concrete_wall_008', { color: '#e8e3dc', ns: 1.2 });
  const withPoche = (m: THREE.Material, front = true) => [m, m, m, m, front ? poche : m, m];
  const shell = new THREE.Group(); scene.add(shell);
  const addMesh = (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], parent: THREE.Object3D = shell) => {
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const zc = (ZB - T + ZF) / 2, zd = ZF - (ZB - T);
  addMesh(box(7, S, zd, 0, -S / 2, zc, 0.5), withPoche(rawFloor)); // floor slab (top = raw screed)
  addMesh(box(7, S, zd, 0, H + S / 2, zc, 0.5), withPoche(rawCeil)); // ceiling slab
  addMesh(box(7 + 2 * T, H + 2 * S, T, 0, (H + 2 * S) / 2 - S, ZB - T / 2), rawWall); // back wall
  addMesh(box(T, H + 2 * S, zd, HW + T / 2, (H + 2 * S) / 2 - S, zc), withPoche(rawWall)); // right wall
  // left wall with window opening (4 pieces)
  const lx = -HW - T / 2, zBack = ZB - T;
  addMesh(box(T, WIN.y0 + S, ZF - zBack, lx, (WIN.y0 - S) / 2, (ZF + zBack) / 2), withPoche(rawWall));
  addMesh(box(T, H + S - WIN.y1, ZF - zBack, lx, (WIN.y1 + H + S) / 2, (ZF + zBack) / 2), withPoche(rawWall));
  addMesh(box(T, WIN.y1 - WIN.y0, WIN.z0 - zBack, lx, (WIN.y0 + WIN.y1) / 2, (zBack + WIN.z0) / 2), rawWall);
  addMesh(box(T, WIN.y1 - WIN.y0, ZF - WIN.z1, lx, (WIN.y0 + WIN.y1) / 2, (WIN.z1 + ZF) / 2), withPoche(rawWall));
  // ground shadow catcher
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ color: '#2a221a', opacity: 0.13 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -S - 0.02; ground.receiveShadow = true; scene.add(ground);

  /* sky + garden seen through the window */
  const skyTex = canvasTex(512, 512, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#bcd7f0'); gr.addColorStop(0.55, '#eef5fb'); gr.addColorStop(1, '#f9f6ee');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512); g.filter = 'blur(14px)';
    const r = rng(9); for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${70 + r() * 30},${110 + r() * 40},${60 + r() * 20},0.55)`; g.beginPath(); g.arc(r() * 512, 470 + r() * 40, 30 + r() * 50, 0, 7); g.fill(); }
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshBasicMaterial({ map: skyTex, color: new THREE.Color().setScalar(2.2) }));
  sky.rotation.y = Math.PI / 2; sky.position.set(-7.5, 1.6, 0.4); scene.add(sky);

  /* ---------- painted finishes (reveal with a rising clip plane) ---------- */
  const paintPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const paintMat = pbr('white_plaster_02', { map: false, color: '#f2ebe0', ns: 0.6, rough: 0.92 });
  paintMat.clippingPlanes = [paintPlane]; paintMat.clipShadows = true;
  for (const m of [paintMat]) { (m.normalMap as THREE.Texture).repeat.set(2.2, 1.5); (m.roughnessMap as THREE.Texture).repeat.set(2.2, 1.5); }
  const paintGroup = new THREE.Group(); scene.add(paintGroup);
  const pBack = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, H), paintMat); pBack.position.set(0, H / 2, ZB + 0.003);
  const pRight = new THREE.Mesh(new THREE.PlaneGeometry(ZF - ZB, H), paintMat); pRight.rotation.y = -Math.PI / 2; pRight.position.set(HW - 0.003, H / 2, (ZF + ZB) / 2);
  const shp = new THREE.Shape(); // u = -z so a +90° Y rotation lands on +x facing
  shp.moveTo(-ZF, 0); shp.lineTo(-ZB, 0); shp.lineTo(-ZB, H); shp.lineTo(-ZF, H); shp.lineTo(-ZF, 0);
  const hole = new THREE.Path(); hole.moveTo(-WIN.z1, WIN.y0); hole.lineTo(-WIN.z0, WIN.y0); hole.lineTo(-WIN.z0, WIN.y1); hole.lineTo(-WIN.z1, WIN.y1); hole.lineTo(-WIN.z1, WIN.y0); shp.holes.push(hole);
  const gLeft = new THREE.ShapeGeometry(shp); gLeft.rotateY(Math.PI / 2); gLeft.translate(-HW + 0.003, 0, 0);
  const pLeft = new THREE.Mesh(gLeft, paintMat);
  for (const m of [pBack, pRight, pLeft]) { m.receiveShadow = true; m.castShadow = false; paintGroup.add(m); }
  // window reveals painted
  const revealMat = new THREE.MeshStandardMaterial({ color: '#f2ebe0', roughness: 0.9 });
  const rv = (w: number, h: number, d: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), revealMat); m.position.set(x, y, z); m.receiveShadow = true; paintGroup.add(m); };
  rv(T, 0.012, WIN.z1 - WIN.z0, lx, WIN.y0 + 0.006, (WIN.z0 + WIN.z1) / 2); rv(T, 0.012, WIN.z1 - WIN.z0, lx, WIN.y1 - 0.006, (WIN.z0 + WIN.z1) / 2);
  rv(T, WIN.y1 - WIN.y0, 0.012, lx, (WIN.y0 + WIN.y1) / 2, WIN.z0 + 0.006); rv(T, WIN.y1 - WIN.y0, 0.012, lx, (WIN.y0 + WIN.y1) / 2, WIN.z1 - 0.006);

  /* skirting */
  const skirtMat = new THREE.MeshStandardMaterial({ color: '#f6f1e8', roughness: 0.6 });
  const skirt = new THREE.Group(); scene.add(skirt);
  const sk = (w: number, d: number, x: number, z: number) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, 0.1, d, 2, 0.006), skirtMat); m.position.set(x, 0.056, z); m.castShadow = m.receiveShadow = true; skirt.add(m); };
  sk(2 * HW, 0.02, 0, ZB + 0.011); sk(0.02, ZF - ZB, HW - 0.011, (ZF + ZB) / 2); sk(0.02, ZF - ZB, -HW + 0.011, (ZF + ZB) / 2);

  /* ============================ SERVICES (conduits) ============================ */
  const conduitMat = new THREE.MeshStandardMaterial({ color: '#e07b30', roughness: 0.4, metalness: 0.1, transparent: true });
  const conduitGrey = new THREE.MeshStandardMaterial({ color: '#c9c6c0', roughness: 0.5, transparent: true });
  const boxMat = new THREE.MeshStandardMaterial({ color: '#f1efea', roughness: 0.5, transparent: true });
  const services = new THREE.Group(); scene.add(services);
  const tubes: THREE.Mesh[] = [];
  const tube = (pts: number[][], mat: THREE.Material, r = 0.013) => {
    const c = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.02);
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 90, r, 10, false), mat); m.castShadow = true; services.add(m); tubes.push(m);
  };
  const yc = H - 0.04;
  for (const x of [-2.2, 0, 2.2]) tube([[x, yc, ZB + 0.12], [x, yc, 2.9]], conduitMat);
  for (const z of [-2, 0.2, 2.4]) tube([[-3.35, yc - 0.03, z], [3.35, yc - 0.03, z]], conduitGrey);
  for (const x of [-2.9, 0.4, 2.9]) tube([[x, yc, ZB + 0.06], [x, 1.2, ZB + 0.06]], conduitMat);
  tube([[-3.35, 0.32, ZB + 0.05], [3.35, 0.32, ZB + 0.05]], conduitGrey);
  tube([[HW - 0.05, yc, -1.5], [HW - 0.05, 1.2, -1.5]], conduitMat); tube([[HW - 0.05, 1.2, -1.5], [HW - 0.05, 1.2, 2.2]], conduitGrey);
  tube([[-HW + 0.05, yc, 2.3], [-HW + 0.05, 0.32, 2.3]], conduitMat);
  for (const [x, y, z] of [[-2.9, 1.2, ZB + 0.04], [0.4, 1.2, ZB + 0.04], [2.9, 1.2, ZB + 0.04], [-1, 0.32, ZB + 0.04], [HW - 0.04, 1.2, 2.2]] as const) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.09, 0.035, 2, 0.006), boxMat); m.position.set(x, y, z); if (x > 3) m.rotation.y = -Math.PI / 2; services.add(m);
  }
  // bare bulb on a flex
  const bulbGrp = new THREE.Group(); scene.add(bulbGrp);
  const flex = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.55, 6), new THREE.MeshStandardMaterial({ color: '#111' })); flex.position.set(0, H - 0.27, 0.6);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffd9a0', emissiveIntensity: 3 })); bulb.position.set(0, H - 0.57, 0.6);
  bulbGrp.add(flex, bulb);
  anims.push((p) => {
    const t = win(STAGES.services, p), hide = Math.max(sub(STAGES.ceiling, 0.4, 0.8, p), sub(STAGES.paint, 0.2, 0.7, p) * 0);
    services.visible = t > 0 && hide < 1;
    tubes.forEach((m, i) => {
      const tt = clamp(t * 1.5 - i * 0.045);
      (m.geometry as THREE.TubeGeometry).setDrawRange(0, Math.floor(tt * (m.geometry.index?.count ?? 0)));
    });
    for (const m of [conduitMat, conduitGrey, boxMat]) m.opacity = 1 - hide;
    const bulbOn = 1 - sub(STAGES.ceiling, 0.2, 0.6, p);
    bulbGrp.visible = bulbOn > 0.01; bulbGrp.position.y = (1 - bulbOn) * 0.6; bulbLight.intensity = 5 * bulbOn;
  });

  /* ======================= FALSE CEILING + COVE LIGHT ======================= */
  const gyp = new THREE.MeshStandardMaterial({ color: '#f5efe6', roughness: 0.9, normalMap: T_('white_plaster_02_nor_gl.webp'), normalScale: new THREE.Vector2(0.3, 0.3) });
  const coveMat = new THREE.MeshStandardMaterial({ color: '#fff1d6', emissive: '#ffc479', emissiveIntensity: 0.05, roughness: 0.6 });
  const ceilingGrp = new THREE.Group(); scene.add(ceilingGrp);
  const cb = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = gyp, r = 0.012) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; ceilingGrp.add(mesh); return mesh;
  };
  const bw = 0.55, bh = 0.24, zIn = ZB + bw;
  cb(2 * HW, bh, bw, 0, H - bh / 2, ZB + bw / 2); cb(bw, bh, ZF - ZB - bw, -HW + bw / 2, H - bh / 2, (ZF + zIn) / 2); cb(bw, bh, ZF - ZB - bw, HW - bw / 2, H - bh / 2, (ZF + zIn) / 2);
  cb(2 * HW - 2 * bw - 0.3, 0.05, ZF - zIn - 0.15, 0, H - 0.1, (ZF + zIn) / 2 + 0.075 - 0.075, gyp, 0.01); // recessed centre panel
  const strip = (w: number, d: number, x: number, z: number) => cb(w, 0.02, d, x, H - 0.16, z, coveMat, 0.004);
  strip(2 * HW - 2 * bw - 0.2, 0.05, 0, zIn + 0.055); strip(0.05, ZF - zIn - 0.1, -HW + bw + 0.055, (ZF + zIn) / 2); strip(0.05, ZF - zIn - 0.1, HW - bw - 0.055, (ZF + zIn) / 2);
  const dlMat = new THREE.MeshStandardMaterial({ color: '#fff8ea', emissive: '#ffd9a0', emissiveIntensity: 0.1 });
  const bezel = new THREE.MeshStandardMaterial({ color: '#d8d3c9', roughness: 0.4, metalness: 0.6 });
  for (const x of [-1.6, 0, 1.6]) for (const z of [-1.4, 0.6, 2.4]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.012, 32), bezel); ring.position.set(x, H - 0.128, z);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.014, 32), dlMat); lens.position.set(x, H - 0.131, z); ceilingGrp.add(ring, lens);
  }
  anims.push((p) => {
    const t = easeO(win(STAGES.ceiling, p)); ceilingGrp.visible = t > 0.001; ceilingGrp.position.y = (1 - t) * 1.3;
    const L = easeIO(win(STAGES.lights, p));
    coveMat.emissiveIntensity = 0.05 + L * 3.2; dlMat.emissiveIntensity = 0.1 + L * 2.2;
    coveLights.forEach((l) => (l.intensity = L * 6));
  });

  /* ============================== WOOD FLOOR ============================== */
  const floorClip = new THREE.Plane(new THREE.Vector3(0, 0, 1), -ZF);
  const floorMat = pbr('laminate_floor_02', { physical: true, ns: 0.9, rough: 1, color: '#f4eadc' }) as THREE.MeshPhysicalMaterial;
  floorMat.clearcoat = 0.3; floorMat.clearcoatRoughness = 0.28; floorMat.clippingPlanes = [floorClip]; floorMat.clipShadows = true;
  for (const t of [floorMat.map!, floorMat.normalMap!, floorMat.roughnessMap!]) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; t.repeat.set(2.6, 2.9); }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, ZF - ZB), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.006, (ZF + ZB) / 2); floor.receiveShadow = true; scene.add(floor);
  anims.push((p) => {
    const t = easeIO(win(STAGES.floor, p)); floor.visible = t > 0.001;
    floorClip.constant = -(ZF - t * (ZF - ZB + 0.05));
  });

  /* ======================= FLUTED OAK FEATURE WALL ======================= */
  const oakMat = pbr('oak_veneer_01', { color: '#f2dcc0', ns: 0.8, rough: 0.8 });
  const ribCount = 86, pitch = 0.0625, panelH = 2.78, panelW = ribCount * pitch;
  const ribGeo = new THREE.CylinderGeometry(0.029, 0.029, panelH, 20, 1, false, -Math.PI / 2, Math.PI);
  ribGeo.translate(0, panelH / 2, 0);
  const ribs = new THREE.InstancedMesh(ribGeo, oakMat, ribCount); ribs.castShadow = ribs.receiveShadow = true; scene.add(ribs);
  const rr = rng(4); const tint = new THREE.Color();
  for (let i = 0; i < ribCount; i++) ribs.setColorAt(i, tint.setScalar(0.88 + rr() * 0.16));
  const backing = new THREE.Mesh(new THREE.BoxGeometry(panelW + 0.06, panelH + 0.02, 0.025), new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.8 }));
  backing.position.set(0, panelH / 2, ZB + 0.0125 + 0.004); backing.castShadow = backing.receiveShadow = true; scene.add(backing);
  const capMat = new THREE.MeshStandardMaterial({ color: '#c79a68', roughness: 0.55 });
  const capTop = new THREE.Mesh(new RoundedBoxGeometry(panelW + 0.1, 0.045, 0.09, 2, 0.01), capMat); capTop.position.set(0, panelH + 0.02, ZB + 0.05);
  scene.add(capTop);
  const ledMat = new THREE.MeshStandardMaterial({ color: '#fff0d0', emissive: '#ffbd70', emissiveIntensity: 0.05 });
  const ledTop = new THREE.Mesh(new THREE.BoxGeometry(panelW, 0.014, 0.014), ledMat); ledTop.position.set(0, panelH - 0.01, ZB + 0.075); scene.add(ledTop);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  anims.push((p) => {
    const t = win(STAGES.paint, p);
    const any = sub(STAGES.paint, 0.35, 1, p) > 0; ribs.visible = backing.visible = capTop.visible = ledTop.visible = any;
    for (let i = 0; i < ribCount; i++) {
      const d = Math.abs(i - ribCount / 2) / (ribCount / 2); // centre-out stagger
      const s = easeO(clamp((sub(STAGES.paint, 0.35, 1, p) * 1.8 - d * 0.8)));
      pv.set(-panelW / 2 + pitch * (i + 0.5), 0, ZB + 0.025 + 0.002); sv.set(1, Math.max(0.0001, s), 0.9);
      mtx.compose(pv, q, sv); ribs.setMatrixAt(i, mtx);
    }
    ribs.instanceMatrix.needsUpdate = true;
    backing.scale.y = capTop.scale.x = Math.max(0.0001, easeO(sub(STAGES.paint, 0.35, 0.8, p)));
    backing.position.y = (panelH / 2) * backing.scale.y;
    ledMat.emissiveIntensity = 0.05 + easeIO(win(STAGES.lights, p)) * 3;
    void t;
  });

  /* paint reveal + skirting + exposure/env drift */
  anims.push((p) => {
    const t = easeIO(win(STAGES.paint, p) * 1.05 > 1 ? 1 : sub(STAGES.paint, 0, 0.9, p));
    paintPlane.constant = t * (H + 0.05); paintGroup.visible = t > 0.001;
    const sk_ = easeO(sub(STAGES.paint, 0.55, 1, p)); skirt.visible = sk_ > 0.001; skirt.scale.set(1, sk_, 1); skirt.position.y = -0.05 * (1 - sk_);
    renderer.toneMappingExposure = lerp(0.98, 1.08, easeIO(win([0.1, 0.7] as R, p)));
    scene.environmentIntensity = lerp(0.45, 0.62, easeIO(win([0.1, 0.8] as R, p)));
    sun.intensity = lerp(3.4, 2.6, easeIO(win([0.3, 0.9] as R, p)));
    hemi.intensity = lerp(0.75, 0.55, easeIO(win([0.3, 0.9] as R, p)));
  });

  /* ================================ GLAZING ================================ */
  const bronze = new THREE.MeshStandardMaterial({ color: '#2d2823', roughness: 0.35, metalness: 0.7 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#d7e8f7', transparent: true, opacity: 0.1, roughness: 0.02, metalness: 0, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
  const glazing = new THREE.Group(); scene.add(glazing);
  const wb = (w: number, h: number, d: number, y: number, z: number) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.004), bronze); m.position.set(lx, y, z); m.castShadow = m.receiveShadow = true; glazing.add(m); };
  const wz = (WIN.z0 + WIN.z1) / 2, wl = WIN.z1 - WIN.z0, wh = WIN.y1 - WIN.y0;
  wb(0.1, 0.07, wl, WIN.y0 + 0.035, wz); wb(0.1, 0.07, wl, WIN.y1 - 0.035, wz);
  wb(0.1, wh, 0.07, (WIN.y0 + WIN.y1) / 2, WIN.z0 + 0.035); wb(0.1, wh, 0.07, (WIN.y0 + WIN.y1) / 2, WIN.z1 - 0.035);
  for (const k of [1, 2]) wb(0.07, wh, 0.05, (WIN.y0 + WIN.y1) / 2, WIN.z0 + (wl * k) / 3);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(wl, wh), glassMat); glass.rotation.y = Math.PI / 2; glass.position.set(lx, (WIN.y0 + WIN.y1) / 2, wz); glazing.add(glass);
  // curtains: sheer + two drapes, real folds
  const fold = (w: number, h: number, freq: number, amp: number, mat: THREE.Material, z: number, segs = 140) => {
    const g = new THREE.PlaneGeometry(w, h, segs, 24); const ps = g.attributes.position;
    for (let i = 0; i < ps.count; i++) { const u = ps.getX(i); ps.setZ(i, Math.sin(u * freq) * amp + Math.sin(u * freq * 2.7 + 1.3) * amp * 0.28 + (ps.getY(i) / h) * 0.02); }
    g.computeVertexNormals(); g.rotateY(Math.PI / 2); g.translate(0, -h / 2, 0);
    const m = new THREE.Mesh(g, mat); m.position.set(-HW + 0.16, 2.88, z); m.castShadow = true; m.receiveShadow = true; glazing.add(m); return m;
  };
  const sheerMat = new THREE.MeshPhysicalMaterial({ color: '#f7f3ec', roughness: 1, transparent: true, opacity: 0.5, side: THREE.DoubleSide, sheen: 1, sheenColor: new THREE.Color('#ffffff'), depthWrite: false });
  const drapeMat = new THREE.MeshPhysicalMaterial({ color: '#d6c8b3', roughness: 1, side: THREE.DoubleSide, sheen: 1, sheenColor: new THREE.Color('#fff4e0'), sheenRoughness: 0.5, normalMap: normalFromCanvas(weaveHeight(256, 3), 1.5), normalScale: new THREE.Vector2(0.4, 0.4) });
  const curtains = [fold(3.4, 2.78, 18, 0.025, sheerMat, wz, 200), fold(0.95, 2.78, 22, 0.05, drapeMat, WIN.z0 - 0.38, 90), fold(0.95, 2.78, 22, 0.05, drapeMat, WIN.z1 + 0.38, 90)];
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 4.4, 14), new THREE.MeshStandardMaterial({ color: '#b08d57', metalness: 0.9, roughness: 0.3 }));
  rail.rotation.x = Math.PI / 2; rail.position.set(-HW + 0.14, 2.9, wz); glazing.add(rail);
  anims.push((p) => {
    const a = easeO(sub(STAGES.paint, 0.5, 1, p)), b = easeO(sub(STAGES.joinery, 0.25, 1, p));
    glazing.visible = a > 0.001; glazing.children.forEach((c) => { if (!curtains.includes(c as THREE.Mesh) && c !== rail) c.visible = true; });
    curtains.forEach((c) => { c.scale.y = Math.max(0.0001, b); }); rail.visible = b > 0.01; rail.scale.y = Math.max(0.001, easeO(sub(STAGES.joinery, 0, 0.5, p)));
  });

  /* ======================== FURNITURE & STYLING ======================== */
  type Item = { obj: THREE.Object3D; at: number; baseY: number; contact?: THREE.Mesh; dur?: number };
  const items: Item[] = [];
  const contactTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(20,12,6,0.65)'); gr.addColorStop(0.55, 'rgba(20,12,6,0.25)'); gr.addColorStop(1, 'rgba(20,12,6,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const place = (obj: THREE.Object3D, at: number, contactSize?: [number, number], dur = 0.2) => {
    obj.visible = false; scene.add(obj); const it: Item = { obj, at, baseY: obj.position.y, dur };
    if (contactSize) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(contactSize[0], contactSize[1]), new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, opacity: 0 }));
      c.rotation.x = -Math.PI / 2; c.position.set(obj.position.x, 0.012, obj.position.z); c.renderOrder = 2; c.visible = false; scene.add(c); it.contact = c;
    }
    items.push(it); return it;
  };

  // rug
  const rugH = canvasTex(512, 512, (g) => { g.drawImage(weaveHeight(512, 12, 1), 0, 0); });
  const rugMat = new THREE.MeshStandardMaterial({
    roughness: 1, normalMap: normalFromCanvas(weaveHeight(256, 5, 1), 2.2), normalScale: new THREE.Vector2(0.8, 0.8),
    map: canvasTex(512, 384, (g) => {
      g.fillStyle = '#e4dccd'; g.fillRect(0, 0, 512, 384); const r = rng(8);
      for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(${r() > 0.5 ? 255 : 120},${r() > 0.5 ? 250 : 110},${r() > 0.5 ? 240 : 95},${r() * 0.1})`; g.fillRect(r() * 512, r() * 384, 2, 2); }
      g.strokeStyle = '#c9a36a'; g.lineWidth = 6; g.strokeRect(26, 26, 460, 332); g.strokeStyle = '#a58a63'; g.lineWidth = 2; g.strokeRect(40, 40, 432, 304);
    }),
  });
  void rugH;
  const rug = new THREE.Mesh(new RoundedBoxGeometry(3.7, 0.025, 2.7, 2, 0.008), rugMat); rug.position.set(0, 0.019, -0.8); rug.receiveShadow = true; rug.castShadow = true;
  place(rug, 0.0, undefined, 0.16);

  // sofa (modelled here: subdivided rounded forms, sheen fabric)
  const fabricN = normalFromCanvas(weaveHeight(256, 21, 1), 2.4); fabricN.repeat.set(3, 3);
  const fabric = new THREE.MeshPhysicalMaterial({ color: '#cdbfab', roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#fff2dc'), sheenRoughness: 0.42, normalMap: fabricN, normalScale: new THREE.Vector2(0.55, 0.55) });
  const fabricD = fabric.clone(); fabricD.color = new THREE.Color('#bfae97');
  const sofa = new THREE.Group();
  const rb = (w: number, h: number, d: number, m: THREE.Material, r: number, seg = 8) => { const x = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, r), m); x.castShadow = x.receiveShadow = true; return x; };
  const baseB = rb(2.0, 0.26, 0.98, fabricD, 0.05); baseB.position.set(0, 0.25, 0);
  const armL = rb(0.22, 0.6, 0.98, fabric, 0.09); armL.position.set(-1.09, 0.42, 0); const armR = armL.clone(); armR.position.x = 1.09;
  const backB = rb(2.0, 0.62, 0.18, fabricD, 0.07); backB.position.set(0, 0.55, -0.4);
  sofa.add(baseB, armL, armR, backB);
  for (const x of [-0.67, 0, 0.67]) {
    const s = rb(0.66, 0.2, 0.8, fabric, 0.085, 10); s.position.set(x, 0.48, 0.07);
    const b = rb(0.66, 0.5, 0.2, fabric, 0.09, 10); b.position.set(x, 0.74, -0.27); b.rotation.x = -0.17; sofa.add(s, b);
  }
  const pcols = ['#e8a02e', '#efe6d6', '#b4532f', '#6f7d4f'];
  [[-0.78, -0.07, 0.25], [0.78, -0.05, -0.22], [-0.52, 0.0, -0.1], [0.5, 0.0, 0.12]].forEach(([x, , ry], i) => {
    const pil = rb(0.44, 0.42, 0.13, new THREE.MeshPhysicalMaterial({ color: pcols[i], roughness: 1, sheen: 0.5, sheenColor: new THREE.Color('#ffe2b0'), normalMap: fabricN, normalScale: new THREE.Vector2(0.5, 0.5) }), 0.06, 6);
    pil.position.set(x, 0.82, -0.08); pil.rotation.set(-0.2, ry * 0.8, ((i % 2) - 0.5) * 0.22); sofa.add(pil);
  });
  const legM = new THREE.MeshStandardMaterial({ color: '#8a6a45', roughness: 0.5 });
  for (const [x, z] of [[-0.95, -0.4], [0.95, -0.4], [-0.95, 0.4], [0.95, 0.4]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.12, 14), legM); l.position.set(x, 0.06, z); l.castShadow = true; sofa.add(l); }
  sofa.position.set(0, 0.0, -2.35); sofa.scale.setScalar(1.12);
  place(sofa, 0.06, [3.0, 1.5], 0.2);

  // wall art above right-wall cabinet + abstract art
  const artTex = canvasTex(640, 440, (g) => {
    g.fillStyle = '#efe4d2'; g.fillRect(0, 0, 640, 440);
    g.fillStyle = '#cfa578'; g.beginPath(); g.arc(210, 440, 190, Math.PI, 0); g.fill();
    g.fillStyle = '#a77c58'; g.beginPath(); g.arc(210, 440, 120, Math.PI, 0); g.fill();
    g.fillStyle = '#FDB041'; g.beginPath(); g.arc(440, 130, 70, 0, 7); g.fill();
    g.fillStyle = '#6f7a55'; g.beginPath(); g.arc(520, 440, 130, Math.PI, 0); g.fill();
  });
  const art = new THREE.Group();
  const artFrame = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.04, 0.045, 2, 0.006), new THREE.MeshStandardMaterial({ color: '#241f1a', roughness: 0.5, metalness: 0.3 }));
  const cv = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.92), new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.85 })); cv.position.z = 0.026;
  art.add(artFrame, cv); art.position.set(HW - 0.03, 1.72, 0.95); art.rotation.y = -Math.PI / 2; art.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  place(art, 0.52, undefined, 0.16);

  /* glTF assets (Poly Haven CC0) */
  const cache = new Map<string, Promise<THREE.Group>>();
  const loadGlb = (name: string) => {
    if (!cache.has(name)) cache.set(name, new Promise((res) => gltfLoader.load(`${BASE}models/${name}.glb`, (g) => {
      g.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; const mt = m.material as THREE.MeshStandardMaterial; if (mt.map) mt.map.anisotropy = maxAniso; } });
      res(g.scene);
    })));
    return cache.get(name)!.then((s) => s.clone(true));
  };
  /** normalise: bottom at y=0, centred in xz, scaled uniformly */
  const prep = (obj: THREE.Object3D, scale = 1) => {
    const g = new THREE.Group(); g.add(obj); obj.scale.setScalar(scale); const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3());
    obj.position.set(-c.x, -b.min.y, -c.z); return g;
  };
  const pendantGlows: THREE.MeshStandardMaterial[] = [];
  const addModel = async (name: string, pos: [number, number, number], ry: number, scale: number, at: number, contact?: [number, number], dur?: number) => {
    const g = prep(await loadGlb(name), scale); g.position.set(...pos); g.rotation.y = ry; place(g, at, contact, dur); return g;
  };
  addModel('coffee_table_round_01', [0, 0, -0.95], 0, 1, 0.14, [2.0, 2.0]);
  addModel('modern_arm_chair_01', [-2.35, 0, -0.9], Math.PI / 2 + 0.25, 1.05, 0.24, [1.5, 1.5]);
  addModel('mid_century_lounge_chair', [2.2, 0, -0.95], -Math.PI / 2 - 0.3, 1.0, 0.3, [1.5, 1.5]);
  addModel('modern_wooden_cabinet', [HW - 0.29, 0, 1.0], -Math.PI / 2, 1, 0.42, [0.9, 3.0]);
  addModel('potted_plant_02', [-3.0, 0, -2.7], 0.6, 1.7, 0.36, [1.2, 1.2]);
  addModel('potted_plant_04', [0.12, 0.49, -0.9], 0.3, 1.5, 0.62, undefined, 0.12);
  addModel('wicker_basket_01', [2.15, 0, -2.5], 0.4, 1.5, 0.48, [0.9, 0.9]);
  addModel('ceramic_vase_01', [HW - 0.3, 0.68, 0.1], 0, 1.1, 0.6, undefined, 0.12);
  addModel('brass_vase_03', [HW - 0.3, 0.68, 0.55], 0, 1.4, 0.66, undefined, 0.12);
  addModel('ceramic_vase_02', [HW - 0.3, 0.68, 1.75], 0, 1.0, 0.7, undefined, 0.12);
  for (const [i, x] of [-0.75, 0, 0.75].entries()) {
    loadGlb('modern_ceiling_lamp_01').then((s) => {
      s.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const mt = (m.material as THREE.MeshStandardMaterial).clone(); m.material = mt; if (mt.color && mt.color.getHex() > 0xdddddd) { mt.emissive = new THREE.Color('#ffcf94'); mt.emissiveIntensity = 0; pendantGlows.push(mt); } } });
      const g = prep(s, 1); g.position.set(x, H - 0.1 - 0.95 * 1.0 - (i === 1 ? 0.25 : 0), -0.95); place(g, 0.2 + i * 0.05, undefined, 0.16);
    });
  }
  anims.push((p) => {
    const f = win(STAGES.furniture, p), L = easeIO(win(STAGES.lights, p));
    for (const it of items) {
      const t = clamp((f - it.at) / (it.dur ?? 0.2)), e = easeO(t);
      it.obj.visible = t > 0.001;
      it.obj.position.y = it.baseY + (1 - e) * 1.5;
      if (it.contact) { it.contact.visible = t > 0.001; (it.contact.material as THREE.MeshBasicMaterial).opacity = clamp(t * 1.6) * (0.75 + 0.25 * (1 - L)); }
    }
    pendLights.forEach((l) => (l.intensity = L * 9)); pendantGlows.forEach((m) => (m.emissiveIntensity = L * 2.4)); panelLight.intensity = L * 5;
  });

  /* ============================== dust motes =============================== */
  const dustN = 220, dustPos = new Float32Array(dustN * 3), dustSeed: number[] = []; const dr = rng(77);
  for (let i = 0; i < dustN; i++) { dustPos[i * 3] = -3.3 + dr() * 3.2; dustPos[i * 3 + 1] = 0.3 + dr() * 2.4; dustPos[i * 3 + 2] = -2 + dr() * 4.5; dustSeed.push(dr() * 6.28); }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustSprite = canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,245,225,1)'); gr.addColorStop(1, 'rgba(255,245,225,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: dustSprite, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  scene.add(dust);
  anims.push((p) => {
    const tm = performance.now() / 1000; const a = dustGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dustN; i++) { a.setY(i, dustPos[i * 3 + 1] + Math.sin(tm * 0.25 + dustSeed[i]) * 0.12); a.setX(i, dustPos[i * 3] + Math.cos(tm * 0.18 + dustSeed[i]) * 0.08); }
    a.needsUpdate = true; (dust.material as THREE.PointsMaterial).opacity = 0.55 * (1 - sub(STAGES.furniture, 0, 0.6, p) * 0.7);
  });

  /* ================================ camera ================================ */
  type Key = { p: number; pos: [number, number, number]; look: [number, number, number]; fov: number };
  const KEYS: Key[] = [
    { p: 0, pos: [-0.8, 1.6, 18.5], look: [0, 1.5, -3.2], fov: 26 },
    { p: 0.34, pos: [0.2, 1.55, 13.5], look: [0, 1.45, -3], fov: 32 },
    { p: 0.7, pos: [0.1, 1.5, 8.6], look: [0, 1.3, -2.8], fov: 38 },
    { p: 1, pos: [0.0, 1.38, 4.3], look: [0, 1.1, -2.4], fov: 42 },
  ];
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const tp = new THREE.Vector3(), tl = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  let vw = 1, vh = 1;
  function cam(p: number) {
    let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = easeIO(clamp((p - a.p) / (b.p - a.p)));
    tp.copy(tmpA.set(...a.pos)).lerp(tmpB.set(...b.pos), t); tl.copy(tmpA.set(...a.look)).lerp(tmpB.set(...b.look), t);
    const fv = lerp(a.fov, b.fov, t); if (Math.abs(camera.fov - fv) > 0.01) { camera.fov = fv; camera.updateProjectionMatrix(); }
    const aspect = vw / vh, need = 3.9 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(aspect, 1.9));
    const dir = tp.clone().sub(tl), dist = dir.length(); if (dist < need) { dir.setLength(need); tp.copy(tl).add(dir); }
    tp.x += pointer.sx * 0.35; tp.y += pointer.sy * 0.15; camera.position.copy(tp); camera.lookAt(tl);
    // composition: shift the room away from the intro text, then centre it
    const shift = (1 - easeIO(clamp(p / 0.12))) * (aspect > 1.1 ? 0.21 : 0), shiftY = aspect <= 1.1 ? (1 - easeIO(clamp(p / 0.12))) * 0.2 : 0;
    camera.setViewOffset(vw, vh, -shift * vw, -shiftY * vh, vw, vh);
  }

  /* ============================== post-processing ============================== */
  let composer: EffectComposer | null = null, gtao: GTAOPass | null = null, bloom: UnrealBloomPass | null = null;
  let quality: 'high' | 'med' | 'low' = qParam === 'low' || isSmall || (navigator.hardwareConcurrency ?? 8) <= 4 ? 'low' : 'high';
  if (qParam === 'high') quality = 'high';
  function buildComposer() {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(vw, vh, { type: THREE.HalfFloatType, samples: 4 }));
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(vw, vh);
    const rp = new RenderPass(scene, camera); rp.clearAlpha = 0; composer.addPass(rp);
    gtao = new GTAOPass(scene, camera, vw, vh); gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 0.9;
    gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.2, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 12 });
    composer.addPass(gtao);
    bloom = new UnrealBloomPass(new THREE.Vector2(vw, vh), 0.28, 0.6, 0.92); composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.addPass(new SMAAPass());
  }
  if (quality === 'high') buildComposer();

  /* =============================== DOM wiring =============================== */
  const intro = root.querySelector<HTMLElement>('[data-intro]')!;
  const stepEls = [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const capEl = root.querySelector<HTMLElement>('[data-caption]')!;
  const capNum = root.querySelector<HTMLElement>('[data-cap-num]')!;
  const capTitle = root.querySelector<HTMLElement>('[data-cap-title]')!;
  const capDesc = root.querySelector<HTMLElement>('[data-cap-desc]')!;
  const prog = root.querySelector<HTMLElement>('[data-progress]')!;
  const veil = root.querySelector<HTMLElement>('.hero__veil')!;
  const finale = root.querySelector<HTMLElement>('[data-finale]')!;
  const steps: { n: string; t: string; d: string }[] = JSON.parse(document.getElementById('hero-steps')!.textContent || '[]');
  let activeStep = -1;
  function setStep(i: number) {
    if (i === activeStep) return; activeStep = i;
    stepEls.forEach((el, k) => { el.classList.toggle('is-active', k === i); el.classList.toggle('is-done', k < i); });
    capEl.classList.add('swap');
    setTimeout(() => { capNum.textContent = steps[i].n; capTitle.textContent = steps[i].t; capDesc.textContent = steps[i].d; capEl.classList.remove('swap'); }, 180);
  }
  function ui(p: number) {
    let i = 0; for (let k = 0; k < STEP_BOUNDS.length - 1; k++) if (p >= STEP_BOUNDS[k]) i = k;
    setStep(Math.min(i, steps.length - 1));
    const io = 1 - clamp(p / 0.05); intro.style.opacity = String(io); intro.style.transform = `translateY(calc(-58% - ${(1 - io) * 40}px))`; intro.style.visibility = io <= 0 ? 'hidden' : 'visible';
    capEl.classList.toggle('is-on', p > 0.045 && p < 0.94); finale.classList.toggle('is-on', p >= 0.94); root!.classList.toggle('is-final', p >= 0.94);
    prog.style.transform = `scaleX(${p})`; veil.style.opacity = String(1 - easeIO(clamp(p / 0.12)) * 0.95);
  }

  /* ================================ run loop ================================ */
  let target = 0, current = 0, last = performance.now(), raf = 0, frames = 0, acc = 0;
  const readScroll = () => { const r = root.getBoundingClientRect(); target = clamp(-r.top / (r.height - innerHeight)); if (reduced) current = target; };
  function resize() {
    vw = root!.clientWidth; vh = innerHeight; renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.updateProjectionMatrix();
    composer?.setSize(vw, vh); gtao?.setSize(vw, vh);
  }
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    readScroll(); current += (target - current) * (1 - Math.exp(-dt * 5)); if (Math.abs(target - current) < 0.0003) current = target;
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3)); pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));
    for (const a of anims) a(current); cam(current); ui(current);
    if (composer && quality === 'high') composer.render(dt); else renderer.render(scene, camera);
    // adaptive quality: drop post-processing if the GPU struggles
    if (ready && ++frames > 20) { acc += dt; if (frames > 100) { const avg = acc / 80; if (avg > 0.034 && composer) { composer = null; gtao = null; bloom = null; quality = 'low'; } frames = -99999; } }
  }
  const obs = new IntersectionObserver(([e]) => { cancelAnimationFrame(raf); if (e.isIntersecting) { last = performance.now(); raf = requestAnimationFrame(frame); } });
  obs.observe(root);
  addEventListener('resize', resize);
  if (!reduced) addEventListener('pointermove', (e) => { pointer.x = (e.clientX / innerWidth - 0.5) * 2; pointer.y = -(e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  resize(); readScroll(); current = target;
  raf = requestAnimationFrame(frame);
}
