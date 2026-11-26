import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ------------------------------------------------------------------ *
 *  Scroll-driven "build a home" scene.
 *  progress p ∈ [0,1] is mapped from scroll position of the tall hero.
 *  Every build stage owns a [start,end] window of p (see STAGES).
 * ------------------------------------------------------------------ */

const STAGES = {
  outline: [0.0, 0.1],
  slab: [0.09, 0.18],
  walls: [0.17, 0.34],
  wiring: [0.33, 0.42],
  ceiling: [0.41, 0.5],
  floor: [0.49, 0.58],
  finish: [0.57, 0.69],
  furniture: [0.69, 0.9],
  lights: [0.88, 1.0],
} as const;

/** Caption steps: [from p, to p) */
const STEP_BOUNDS = [0, 0.1, 0.18, 0.34, 0.42, 0.5, 0.58, 0.69, 0.9, 1.01];

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const win = (r: readonly [number, number], p: number) => clamp((p - r[0]) / (r[1] - r[0]));
const sub = (r: readonly [number, number], a: number, b: number, p: number) => {
  const w = r[1] - r[0];
  return clamp((p - (r[0] + w * a)) / (w * (b - a)));
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.2, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ----------------------------- textures ---------------------------- */

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function woodFloorTextures() {
  const planksAcross = 7, S = 1024, ph = S / planksAcross;
  const make = (bump: boolean) => (g: CanvasRenderingContext2D) => {
    const r = rng(7);
    g.fillStyle = bump ? '#8a8a8a' : '#b98a5d';
    g.fillRect(0, 0, S, S);
    for (let row = 0; row < planksAcross; row++) {
      const y = row * ph;
      const joint = r() * S;
      const tint = 0.86 + r() * 0.26;
      for (const [x0, x1] of [[0, joint], [joint, S]] as const) {
        const t = tint + (x0 ? (r() - 0.5) * 0.18 : 0);
        if (bump) g.fillStyle = `rgb(${138 + (r() * 14) | 0},${138},${138})`;
        else g.fillStyle = `rgb(${(190 * t) | 0},${(140 * t) | 0},${(94 * t) | 0})`;
        g.fillRect(x0, y, x1 - x0, ph);
        // grain
        for (let i = 0; i < 70; i++) {
          const gy = y + r() * ph;
          const a = 0.05 + r() * 0.12;
          g.strokeStyle = bump ? `rgba(60,60,60,${a})` : `rgba(80,48,24,${a})`;
          g.lineWidth = 0.6 + r() * 1.4;
          g.beginPath();
          const wob = (r() - 0.5) * 4;
          g.moveTo(x0, gy);
          g.bezierCurveTo(x0 + (x1 - x0) * 0.3, gy + wob, x0 + (x1 - x0) * 0.7, gy - wob, x1, gy + wob * 0.4);
          g.stroke();
        }
        // end joint
        g.fillStyle = bump ? '#3c3c3c' : 'rgba(40,24,10,0.55)';
        g.fillRect(x0, y, 2, ph);
      }
      g.fillStyle = bump ? '#2e2e2e' : 'rgba(40,24,10,0.5)';
      g.fillRect(0, y, S, 2.5);
    }
  };
  return { map: canvasTex(S, S, make(false)), bump: canvasTex(S, S, make(true), false) };
}

function flutedTextures() {
  const W = 512, H = 512, flutes = 32, fw = W / flutes;
  const make = (bump: boolean) => (g: CanvasRenderingContext2D) => {
    const r = rng(11);
    for (let i = 0; i < flutes; i++) {
      const x = i * fw;
      const grad = g.createLinearGradient(x, 0, x + fw, 0);
      if (bump) {
        grad.addColorStop(0, '#202020'); grad.addColorStop(0.5, '#f0f0f0'); grad.addColorStop(1, '#202020');
      } else {
        grad.addColorStop(0, '#6f4a2c'); grad.addColorStop(0.5, '#c79a6c'); grad.addColorStop(1, '#6f4a2c');
      }
      g.fillStyle = grad;
      g.fillRect(x, 0, fw, H);
    }
    if (!bump) {
      for (let i = 0; i < 260; i++) {
        g.strokeStyle = `rgba(60,34,14,${0.04 + r() * 0.07})`;
        g.lineWidth = 0.6;
        const x = r() * W;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 6, H); g.stroke();
      }
    }
  };
  return { map: canvasTex(W, H, make(false)), bump: canvasTex(W, H, make(true), false) };
}

function plasterTextures() {
  const S = 512;
  const make = (bump: boolean) => (g: CanvasRenderingContext2D) => {
    const r = rng(3);
    g.fillStyle = bump ? '#808080' : '#e9e6e0';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) {
      const v = r();
      const s = 0.6 + r() * 2.2;
      g.fillStyle = bump
        ? `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${0.04 + r() * 0.08})`
        : `rgba(${v > 0.5 ? 255 : 90},${v > 0.5 ? 255 : 86},${v > 0.5 ? 255 : 80},${0.03 + r() * 0.06})`;
      g.fillRect(r() * S, r() * S, s, s);
    }
  };
  return { map: canvasTex(S, S, make(false)), bump: canvasTex(S, S, make(true), false) };
}

/* ------------------------------ scene ------------------------------ */

export function initHero() {
  const root = document.querySelector<HTMLElement>('[data-hero]');
  const canvas = root?.querySelector<HTMLCanvasElement>('[data-canvas]');
  if (!root || !canvas) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    root.classList.add('no-webgl');
    return;
  }
  const isSmall = matchMedia('(max-width: 760px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;

  const BG = new THREE.Color('#efebe3');
  const scene = new THREE.Scene();
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 28, 60);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  /* lights */
  scene.add(new THREE.HemisphereLight('#fff6e8', '#cfc6b6', 0.55));
  const sun = new THREE.DirectionalLight('#fff1da', 3.2);
  sun.position.set(-10, 8.5, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun);

  const warm: THREE.PointLight[] = [];
  for (const [x, z] of [[-3.2, -2.4], [3.2, -2.4], [3.2, 2.4], [-3.2, 2.4]] as const) {
    const l = new THREE.PointLight('#ffc98f', 0, 7, 1.6);
    l.position.set(x, 2.85, z);
    scene.add(l);
    warm.push(l);
  }
  const lampLight = new THREE.PointLight('#ffb878', 0, 6, 1.7);
  lampLight.position.set(-3.1, 1.75, -2.25);
  scene.add(lampLight);

  /* animation registry */
  const anims: Array<(p: number) => void> = [];

  /* textures */
  const wood = woodFloorTextures();
  wood.map.repeat.set(1, 0.75); wood.bump.repeat.set(1, 0.75);
  const fluted = flutedTextures();
  const plaster = plasterTextures();
  plaster.map.repeat.set(3, 1.6); plaster.bump.repeat.set(3, 1.6);

  /* ground */
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(60, 64),
    new THREE.MeshStandardMaterial({ color: '#e8e3d9', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.31;
  ground.receiveShadow = true;
  scene.add(ground);

  /* blueprint grid + plot outline (draws itself) */
  const grid = new THREE.GridHelper(40, 80, '#8a8174', '#b9b1a3');
  grid.position.y = -0.3;
  const gm = grid.material as THREE.LineBasicMaterial;
  gm.transparent = true; gm.opacity = 0;
  scene.add(grid);

  const plotPts: THREE.Vector3[] = [];
  const plotW = 5.2, plotD = 4.1;
  const corners = [[-plotW, -plotD], [plotW, -plotD], [plotW, plotD], [-plotW, plotD], [-plotW, -plotD]];
  const N = 160;
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < N / 4; k++) {
      const t = k / (N / 4);
      plotPts.push(new THREE.Vector3(
        corners[i][0] + (corners[i + 1][0] - corners[i][0]) * t, -0.29,
        corners[i][1] + (corners[i + 1][1] - corners[i][1]) * t));
    }
  }
  plotPts.push(new THREE.Vector3(corners[0][0], -0.29, corners[0][1]));
  const plotGeo = new THREE.BufferGeometry().setFromPoints(plotPts);
  const plotLine = new THREE.Line(plotGeo, new THREE.LineBasicMaterial({ color: '#1f1d1a' }));
  scene.add(plotLine);
  // internal layout lines (room plan) drawn after the boundary
  const planPts = [
    [-4, -3, 4, -3], [4, -3, 4, 3], [4, 3, -4, 3], [-4, 3, -4, -3],
    [-4, 1.3, -3.6, 1.3], [-4, -1.3, -3.6, -1.3],
  ];
  const planGeo = new THREE.BufferGeometry().setFromPoints(
    planPts.flatMap(([a, b, c, d]) => [new THREE.Vector3(a, -0.28, b), new THREE.Vector3(c, -0.28, d)]),
  );
  const planLines = new THREE.LineSegments(planGeo, new THREE.LineBasicMaterial({ color: '#a8764a', transparent: true, opacity: 0 }));
  scene.add(planLines);
  // corner pegs
  const pegMat = new THREE.MeshStandardMaterial({ color: '#a8764a', roughness: 0.6 });
  const pegs = corners.slice(0, 4).map(([x, z]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 12), pegMat);
    m.position.set(x, 0.15, z);
    m.castShadow = true;
    scene.add(m);
    return m;
  });
  anims.push((p) => {
    const t = win(STAGES.outline, p);
    plotGeo.setDrawRange(0, Math.floor(easeInOut(t) * plotPts.length));
    gm.opacity = 0.42 * easeOut(clamp(t * 2)) * (1 - win(STAGES.slab, p) * 0.9);
    (planLines.material as THREE.LineBasicMaterial).opacity = sub(STAGES.outline, 0.6, 1, p) * (1 - sub(STAGES.walls, 0.5, 1, p));
    pegs.forEach((m, i) => {
      const s = easeOutBack(clamp((t - 0.15 * i - 0.1) * 4));
      m.scale.setScalar(Math.max(0.0001, s));
      m.visible = p < STAGES.walls[1];
    });
    plotLine.visible = p < STAGES.walls[1];
  });

  /* slab */
  const slabMat = new THREE.MeshStandardMaterial({
    color: '#9c9890', map: plaster.map, bumpMap: plaster.bump, bumpScale: 2, roughness: 0.95,
  });
  const slabGeo = new THREE.BoxGeometry(8.8, 0.3, 6.8);
  slabGeo.translate(0, 0.15, 0);
  const slab = new THREE.Mesh(slabGeo, slabMat);
  slab.position.set(0, -0.3, 0);
  slab.receiveShadow = true; slab.castShadow = true;
  scene.add(slab);
  anims.push((p) => {
    const t = easeInOut(win(STAGES.slab, p));
    slab.visible = t > 0.001;
    slab.scale.set(1, Math.max(0.0001, t), 1);
  });

  /* walls (solid boxes that grow from their base; window pieces chain by height) */
  const wallMat = new THREE.MeshStandardMaterial({
    color: '#8a8782', map: plaster.map, bumpMap: plaster.bump, bumpScale: 1.5, roughness: 0.92,
  });
  const WALL_H = 3.2;
  type Piece = { mesh: THREE.Mesh; y0: number; y1: number };
  const pieces: Piece[] = [];
  const addPiece = (w: number, y0: number, y1: number, d: number, x: number, z: number) => {
    const g = new THREE.BoxGeometry(w, y1 - y0, d);
    g.translate(0, (y1 - y0) / 2, 0);
    const m = new THREE.Mesh(g, wallMat);
    m.position.set(x, y0, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    pieces.push({ mesh: m, y0, y1 });
  };
  addPiece(8.4, 0, WALL_H, 0.2, 0.1, -3.1); // back wall (full)
  // left wall with a window opening: z∈[-1.3,1.3], y∈[0.9,2.5]
  addPiece(0.2, 0, 0.9, 6.0, -4.1, 0);
  addPiece(0.2, 2.5, WALL_H, 6.0, -4.1, 0);
  addPiece(0.2, 0.9, 2.5, 1.7, -4.1, -2.15);
  addPiece(0.2, 0.9, 2.5, 1.7, -4.1, 2.15);
  // right stub wall (short return) for depth
  addPiece(0.2, 0, WALL_H, 1.6, 4.1, -2.2);
  anims.push((p) => {
    const h = easeInOut(win(STAGES.walls, p)) * WALL_H;
    for (const { mesh, y0, y1 } of pieces) {
      const k = clamp((h - y0) / (y1 - y0));
      mesh.visible = k > 0.001;
      mesh.scale.y = Math.max(0.0001, k);
    }
    // raw concrete -> warm plaster paint
    const paint = easeInOut(sub(STAGES.finish, 0, 0.45, p));
    wallMat.color.set('#8a8782').lerp(new THREE.Color('#f6f1e8'), paint);
    wallMat.roughness = 0.92 - paint * 0.2;
    slabMat.color.set('#9c9890').lerp(new THREE.Color('#9c9890'), 0);
  });

  /* services rough-in (conduits) */
  const copper = new THREE.MeshStandardMaterial({ color: '#d98a4e', roughness: 0.35, metalness: 0.7, transparent: true });
  const blue = new THREE.MeshStandardMaterial({ color: '#4f86b5', roughness: 0.45, metalness: 0.2, transparent: true });
  const conduits = new THREE.Group();
  const tube = (pts: number[][], mat: THREE.Material, r = 0.022) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.02);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, r, 8, false), mat);
    m.castShadow = true;
    conduits.add(m);
    return m;
  };
  tube([[-3.9, 0.3, -2.9], [-3.9, 0.3, 2.9]], copper);
  tube([[-3.9, 0.3, -1.4], [-3.9, 2.9, -1.4], [-3.9, 2.9, 1.4], [-3.9, 0.3, 1.4]], copper);
  tube([[-3.9, 2.9, -2.9], [-3.9, 2.9, 2.9]], copper);
  tube([[-3.9, 1.1, -2.9], [3.9, 1.1, -2.9]], copper);
  tube([[3.9, 0.3, -2.9], [3.9, 2.8, -2.9]], copper);
  tube([[0.8, 0.3, -2.9], [0.8, 1.1, -2.9]], copper);
  tube([[-3.9, 0.55, -2.9], [-3.0, 0.55, -2.9], [-3.0, 0.2, -2.9]], blue, 0.03);
  scene.add(conduits);
  anims.push((p) => {
    const t = win(STAGES.wiring, p);
    const hide = sub(STAGES.finish, 0, 0.3, p);
    conduits.visible = t > 0 && hide < 1;
    const op = easeOut(t) * (1 - hide);
    conduits.children.forEach((c, i) => {
      const m = (c as THREE.Mesh);
      (m.material as THREE.MeshStandardMaterial).opacity = op;
      (m.geometry as THREE.TubeGeometry).setDrawRange(0, Math.floor(clamp(t * 1.4 - i * 0.04) * (m.geometry.index?.count ?? 0)));
    });
  });

  /* ceiling soffit with LED cove */
  const soffitMat = new THREE.MeshStandardMaterial({ color: '#f1ece3', roughness: 0.85 });
  const coveMat = new THREE.MeshStandardMaterial({ color: '#fff0d6', emissive: '#ffc98a', emissiveIntensity: 0.0, roughness: 0.5 });
  const ceiling = new THREE.Group();
  const bar = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), soffitMat);
    m.position.set(x, 3.09, z); m.castShadow = true; m.receiveShadow = true;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w - (w > d ? 0 : 0.0), 0.03, d > w ? d : 0.06), coveMat);
    ceiling.add(m);
    return { m, strip };
  };
  const bBack = bar(8.2, 0.7, 0, -2.75);
  const bLeft = bar(0.7, 5.2, -3.65, 0.0);
  // cove LED strips on the inner lower edge
  const stripBack = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.03, 0.05), coveMat);
  stripBack.position.set(0, 2.97, -2.38);
  const stripLeft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 5.0), coveMat);
  stripLeft.position.set(-3.28, 2.97, 0);
  ceiling.add(stripBack, stripLeft);
  void bBack; void bLeft;
  scene.add(ceiling);
  anims.push((p) => {
    const t = easeOut(win(STAGES.ceiling, p));
    ceiling.visible = t > 0.001;
    ceiling.position.y = (1 - t) * 3.2;
    coveMat.emissiveIntensity = 0.15 + easeInOut(win(STAGES.lights, p)) * 2.4;
    warm.forEach((l) => (l.intensity = easeInOut(win(STAGES.lights, p)) * 5));
  });

  /* timber flooring (sweeps in) */
  const floorClip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -4);
  const floorMat = new THREE.MeshStandardMaterial({
    map: wood.map, bumpMap: wood.bump, bumpScale: 1.4, roughness: 0.52, metalness: 0,
    clippingPlanes: [floorClip], clipShadows: true,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.012;
  floor.receiveShadow = true;
  scene.add(floor);
  anims.push((p) => {
    const t = easeInOut(win(STAGES.floor, p));
    floor.visible = t > 0.001;
    floorClip.constant = -4 + t * 8.05;
  });

  /* fluted wood feature wall + TV console + art + window dressing */
  const finishes = new THREE.Group();
  const flutedMat = new THREE.MeshStandardMaterial({ map: fluted.map, bumpMap: fluted.bump, bumpScale: 3, roughness: 0.55 });
  const panelGeo = new THREE.BoxGeometry(4.2, 2.7, 0.1);
  panelGeo.translate(0, 1.35, 0);
  const panel = new THREE.Mesh(panelGeo, flutedMat);
  panel.position.set(-0.4, 0, -2.95);
  panel.castShadow = panel.receiveShadow = true;
  scene.add(panel);

  const darkMat = new THREE.MeshStandardMaterial({ color: '#232220', roughness: 0.35, metalness: 0.2 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#2a2927', roughness: 0.5, metalness: 0.4 });
  const tv = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 0.05), darkMat);
  tv.position.set(-0.4, 1.55, -2.87); tv.castShadow = true;
  const console_ = new THREE.Mesh(new RoundedBoxGeometry(2.8, 0.42, 0.42, 3, 0.03),
    new THREE.MeshStandardMaterial({ color: '#efe9de', roughness: 0.6 }));
  console_.position.set(-0.4, 0.62, -2.7); console_.castShadow = console_.receiveShadow = true;
  const consoleLegs = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 0.3), darkMat);
  consoleLegs.position.set(-0.4, 0.2, -2.7);
  const art = new THREE.Group();
  const artFrame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.35, 0.05), frameMat);
  const artCanvas = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 1.23), new THREE.MeshStandardMaterial({
    map: canvasTex(256, 360, (g) => {
      g.fillStyle = '#e8dccb'; g.fillRect(0, 0, 256, 360);
      g.fillStyle = '#c9a07a'; g.beginPath(); g.arc(128, 150, 70, 0, 7); g.fill();
      g.fillStyle = '#8a6d52'; g.beginPath(); g.arc(128, 330, 150, Math.PI, 0); g.fill();
      g.fillStyle = '#efe6d6'; g.beginPath(); g.arc(160, 120, 38, 0, 7); g.fill();
    }), roughness: 0.9 }));
  artCanvas.position.z = 0.03;
  art.add(artFrame, artCanvas);
  art.position.set(2.9, 1.7, -2.93);
  art.castShadow = true;
  // window frame + glass + curtains on left wall
  const winFrame = new THREE.Group();
  const fb = (w: number, h: number, d: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    m.position.set(-4.05, y, z); m.castShadow = true; winFrame.add(m);
  };
  fb(0.08, 0.08, 2.7, 0.9, 0); fb(0.08, 0.08, 2.7, 2.5, 0);
  fb(0.08, 1.7, 0.08, 1.7, -1.3); fb(0.08, 1.7, 0.08, 1.7, 1.3);
  fb(0.06, 1.6, 0.05, 1.7, 0);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6),
    new THREE.MeshPhysicalMaterial({ color: '#dff0ff', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, transmission: 0, side: THREE.DoubleSide }));
  glass.rotation.y = Math.PI / 2; glass.position.set(-4.08, 1.7, 0);
  winFrame.add(glass);
  const curtainMat = new THREE.MeshStandardMaterial({ color: '#ebe3d5', roughness: 1, side: THREE.DoubleSide });
  const curtains: THREE.Mesh[] = [];
  for (const z of [-1.75, 1.75]) {
    const g = new THREE.BoxGeometry(0.07, 2.65, 0.8, 1, 1, 16);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + Math.sin(pos.getZ(i) * 22) * 0.04);
    g.translate(0, 1.325, 0);
    const c = new THREE.Mesh(g, curtainMat);
    c.position.set(-3.9, 0.02, z); c.castShadow = true;
    curtains.push(c); winFrame.add(c);
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3.8, 10), frameMat);
  rail.rotation.x = Math.PI / 2; rail.position.set(-3.88, 2.78, 0);
  winFrame.add(rail);
  // skirting
  const skirtMat = new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 0.7 });
  const skirtBack = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.03), skirtMat);
  skirtBack.position.set(0, 0.07, -2.89);
  const skirtLeft = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 5.8), skirtMat);
  skirtLeft.position.set(-3.89, 0.07, 0);
  finishes.add(tv, console_, consoleLegs, art, winFrame, skirtBack, skirtLeft);
  scene.add(finishes);
  anims.push((p) => {
    const tp = easeInOut(sub(STAGES.finish, 0.1, 0.55, p));
    panel.visible = tp > 0.001;
    panel.scale.y = Math.max(0.0001, tp);
    const tw = easeOut(sub(STAGES.finish, 0.4, 0.85, p));
    winFrame.visible = skirtBack.visible = skirtLeft.visible = tw > 0.001;
    glass.visible = true;
    curtains.forEach((c) => { c.scale.y = Math.max(0.0001, easeOut(sub(STAGES.finish, 0.6, 1, p))); });
    const ti = easeOut(sub(STAGES.finish, 0.55, 1, p));
    tv.visible = console_.visible = consoleLegs.visible = art.visible = ti > 0.001;
    [tv, console_, consoleLegs, art].forEach((o, i) => {
      o.scale.setScalar(Math.max(0.0001, 0.92 + 0.08 * ti));
      o.position.z += 0; void i;
    });
    skirtBack.scale.x = skirtLeft.scale.z = Math.max(0.0001, tw);
  });

  /* ------------------------------ furniture ------------------------------ */
  const boucle = new THREE.MeshStandardMaterial({ color: '#c8b8a2', roughness: 1 });
  const cushion = new THREE.MeshStandardMaterial({ color: '#b9a48b', roughness: 1 });
  const oak = new THREE.MeshStandardMaterial({ color: '#a8794a', roughness: 0.55 });
  const travertine = new THREE.MeshStandardMaterial({ color: '#e0d5c3', roughness: 0.45 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#5b7a4f', roughness: 0.8 });
  const rugMat = new THREE.MeshStandardMaterial({
    color: '#ddd3c2', roughness: 1,
    map: canvasTex(256, 256, (g) => {
      const r = rng(5); g.fillStyle = '#ddd3c2'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(120,100,80,${r() * 0.12})`; g.fillRect(r() * 256, r() * 256, 2, 2); }
      g.strokeStyle = 'rgba(120,100,80,0.35)'; g.lineWidth = 6; g.strokeRect(14, 14, 228, 228);
    }),
  });

  const rb = (w: number, h: number, d: number, m: THREE.Material, r = 0.06) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), m);
    mesh.castShadow = mesh.receiveShadow = true; return mesh;
  };
  type Item = { obj: THREE.Object3D; at: number; baseY: number };
  const items: Item[] = [];
  const place = (obj: THREE.Object3D, at: number) => {
    obj.visible = false; scene.add(obj); items.push({ obj, at, baseY: obj.position.y });
  };

  // rug
  const rug = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.03, 3.4), rugMat);
  rug.position.set(-1.7, 0.03, 0); rug.receiveShadow = true;
  place(rug, 0);

  // sofa (back toward the window wall, faces +x)
  const sofa = new THREE.Group();
  const seat = rb(2.7, 0.4, 1.0, boucle, 0.12); seat.position.set(0, 0.34, 0.05);
  const back = rb(2.7, 0.62, 0.28, boucle, 0.12); back.position.set(0, 0.7, -0.4);
  const armL = rb(0.28, 0.58, 1.0, boucle, 0.1); armL.position.set(-1.28, 0.5, 0.05);
  const armR = rb(0.28, 0.58, 1.0, boucle, 0.1); armR.position.set(1.28, 0.5, 0.05);
  const c1 = rb(1.15, 0.2, 0.85, cushion, 0.09); c1.position.set(-0.6, 0.62, 0.12);
  const c2 = c1.clone(); c2.position.x = 0.6;
  const pillow = rb(0.5, 0.45, 0.14, new THREE.MeshStandardMaterial({ color: '#a8764a', roughness: 1 }), 0.06);
  pillow.position.set(-0.95, 0.88, -0.1); pillow.rotation.set(-0.2, 0.2, 0.1);
  const legs = [[-1.2, -0.35], [1.2, -0.35], [-1.2, 0.45], [1.2, 0.45]].map(([x, z]) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.14, 10), oak);
    l.position.set(x, 0.07, z); l.castShadow = true; return l;
  });
  sofa.add(seat, back, armL, armR, c1, c2, pillow, ...legs);
  sofa.position.set(-3.25, 0, 0); sofa.rotation.y = Math.PI / 2;
  place(sofa, 0.12);

  // coffee table
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 48), travertine);
  top.position.y = 0.38; top.castShadow = top.receiveShadow = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.34, 32), oak);
  base.position.y = 0.17; base.castShadow = true;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6b5a48', roughness: 0.5, side: THREE.DoubleSide }));
  bowl.rotation.x = Math.PI; bowl.position.set(0.12, 0.5, -0.05);
  table.add(top, base, bowl);
  table.position.set(-1.9, 0, 0);
  place(table, 0.26);

  // armchairs
  const armchair = (rotY: number, x: number, z: number, at: number) => {
    const g = new THREE.Group();
    const s = rb(0.95, 0.32, 0.9, cushion, 0.1); s.position.set(0, 0.36, 0);
    const b = rb(0.95, 0.6, 0.2, boucle, 0.1); b.position.set(0, 0.62, -0.38);
    const a1 = rb(0.16, 0.34, 0.8, boucle, 0.06); a1.position.set(-0.5, 0.52, 0.0);
    const a2 = a1.clone(); a2.position.x = 0.5;
    const frame = [[-0.38, -0.34], [0.38, -0.34], [-0.38, 0.34], [0.38, 0.34]].map(([lx, lz]) => {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.2, 8), oak);
      l.position.set(lx, 0.1, lz); l.castShadow = true; return l;
    });
    g.add(s, b, a1, a2, ...frame);
    g.position.set(x, 0, z); g.rotation.y = rotY;
    place(g, at);
  };
  armchair(Math.PI * 0.12, -1.0, -2.0, 0.4);
  armchair(Math.PI - Math.PI * 0.12, -1.0, 2.0, 0.46);

  // floor lamp
  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.6, 8), frameMat);
  pole.position.y = 0.8;
  const lbase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 24), frameMat);
  lbase.position.y = 0.015;
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#f6ead6', emissive: '#ffbf80', emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.34, 28, 1, true), shadeMat);
  shade.position.y = 1.72;
  lamp.add(pole, lbase, shade);
  lamp.position.set(-3.2, 0, -2.3);
  place(lamp, 0.55);

  // plant
  const plant = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.19, 0.45, 24), new THREE.MeshStandardMaterial({ color: '#e5ded1', roughness: 0.8 }));
  pot.position.y = 0.225; pot.castShadow = true;
  plant.add(pot);
  const rr = rng(21);
  for (let i = 0; i < 16; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), leafMat);
    leaf.scale.set(0.6, 1.5, 0.12);
    const a = (i / 16) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.14, 0.95 + rr() * 0.5, Math.sin(a) * 0.14);
    leaf.rotation.set((rr() - 0.5) * 0.7, a, Math.cos(a) * 0.5);
    leaf.castShadow = true;
    plant.add(leaf);
  }
  plant.position.set(3.2, 0, -2.4);
  place(plant, 0.62);

  // side table + books near sofa
  const side = new THREE.Group();
  const stop = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 32), oak); stop.position.y = 0.52;
  const sleg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), frameMat); sleg.position.y = 0.26;
  const books = rb(0.3, 0.08, 0.22, new THREE.MeshStandardMaterial({ color: '#7a8a7a', roughness: 0.8 }), 0.01); books.position.set(0, 0.58, 0);
  stop.castShadow = true; sleg.castShadow = true;
  side.add(stop, sleg, books);
  side.position.set(-3.3, 0, 1.75);
  place(side, 0.72);

  anims.push((p) => {
    const f = win(STAGES.furniture, p);
    for (const it of items) {
      const t = clamp((f - it.at) / 0.22);
      it.obj.visible = t > 0.001;
      const e = easeOutBack(t);
      it.obj.position.y = it.baseY + (1 - e) * 2.4;
      if (it.obj === rug) it.obj.scale.set(easeOut(t), 1, easeOut(t));
    }
    const glow = easeInOut(win(STAGES.lights, p));
    shadeMat.emissiveIntensity = glow * 2.2;
    lampLight.intensity = glow * 4.5;
  });

  /* make every standard mesh in the finished list shadow-capable */
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material && !(m.material as THREE.Material).transparent) m.receiveShadow = true;
  });

  /* ------------------------------ camera ------------------------------ */
  type Key = { p: number; pos: [number, number, number]; look: [number, number, number] };
  const KEYS: Key[] = [
    { p: 0.0, pos: [11, 14, 12.5], look: [0, -0.3, 0] },
    { p: 0.18, pos: [10.5, 11.5, 11.5], look: [0, 0, 0] },
    { p: 0.4, pos: [10.2, 8.2, 10.2], look: [-0.2, 1.0, 0] },
    { p: 0.7, pos: [8.2, 6.0, 9.2], look: [-0.9, 1.0, 0] },
    { p: 1.0, pos: [6.6, 4.1, 8.0], look: [-1.1, 1.15, -0.2] },
  ];
  const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  function cam(p: number, aspect: number) {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = easeInOut(clamp((p - a.p) / (b.p - a.p)));
    tmpPos.set(...a.pos).lerp(new THREE.Vector3(...b.pos), t);
    tmpLook.set(...a.look).lerp(new THREE.Vector3(...b.look), t);
    // portrait screens: pull back and shift look target so the room stays framed
    const pull = aspect < 1.3 ? 1 + (1.3 - aspect) * 0.95 : 1;
    const dir = tmpPos.clone().sub(tmpLook).multiplyScalar(pull);
    tmpPos.copy(tmpLook).add(dir);
    // subtle pointer parallax
    tmpPos.x += pointer.sx * 0.5; tmpPos.y += pointer.sy * 0.3;
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);
  }

  /* ---------------------------- DOM wiring ---------------------------- */
  const intro = root.querySelector<HTMLElement>('[data-intro]')!;
  const stepEls = [...root.querySelectorAll<HTMLElement>('[data-step]')];
  const capEl = root.querySelector<HTMLElement>('[data-caption]')!;
  const capNum = root.querySelector<HTMLElement>('[data-cap-num]')!;
  const capTitle = root.querySelector<HTMLElement>('[data-cap-title]')!;
  const capDesc = root.querySelector<HTMLElement>('[data-cap-desc]')!;
  const prog = root.querySelector<HTMLElement>('[data-progress]')!;
  const finale = root.querySelector<HTMLElement>('[data-finale]')!;
  const steps: { n: string; t: string; d: string }[] = JSON.parse(document.getElementById('hero-steps')!.textContent || '[]');
  let activeStep = -1;

  function setStep(i: number) {
    if (i === activeStep) return;
    activeStep = i;
    stepEls.forEach((el, k) => {
      el.classList.toggle('is-active', k === i);
      el.classList.toggle('is-done', k < i);
    });
    capEl.classList.add('swap');
    window.setTimeout(() => {
      capNum.textContent = steps[i].n;
      capTitle.textContent = steps[i].t;
      capDesc.textContent = steps[i].d;
      capEl.classList.remove('swap');
    }, 180);
  }

  function ui(p: number) {
    let i = 0;
    for (let k = 0; k < STEP_BOUNDS.length - 1; k++) if (p >= STEP_BOUNDS[k]) i = k;
    setStep(Math.min(i, steps.length - 1));
    const introOp = 1 - clamp(p / 0.045);
    intro.style.opacity = String(introOp);
    intro.style.transform = `translateY(calc(-62% - ${(1 - introOp) * 40}px))`;
    intro.style.visibility = introOp <= 0 ? 'hidden' : 'visible';
    capEl.classList.toggle('is-on', p > 0.03 && p < 0.94);
    finale.classList.toggle('is-on', p >= 0.94);
    root!.classList.toggle('is-final', p >= 0.94);
    prog.style.transform = `scaleX(${p})`;
  }

  /* ----------------------------- run loop ----------------------------- */
  let target = 0, current = reduced ? 0 : 0, visible = true, raf = 0, last = performance.now();
  function readScroll() {
    const r = root!.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    target = clamp(-r.top / total);
    if (reduced) current = target;
  }
  function resize() {
    const w = root!.clientWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    readScroll();
    current += (target - current) * (1 - Math.exp(-dt * 5.5));
    if (Math.abs(target - current) < 0.0002) current = target;
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));
    for (const a of anims) a(current);
    cam(current, camera.aspect);
    ui(current);
    renderer.render(scene, camera);
  }
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  io.observe(root);
  addEventListener('resize', resize);
  if (!reduced) addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / innerWidth - 0.5) * 2;
    pointer.y = -(e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });
  resize();
  readScroll();
  current = target;
  raf = requestAnimationFrame(frame);
}
