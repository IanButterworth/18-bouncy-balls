import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PI = Math.PI;
const clamp01 = x => Math.min(1, Math.max(0, x));

// --- textures ------------------------------------------------------------------

function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  return t;
}

const rand = (a, b) => a + Math.random() * (b - a);

function floorTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rand(0, w * 0.5);
      while (x < w) {
        const len = w * rand(0.3, 0.7), hue = rand(24, 33), l = rand(30, 42);
        g.fillStyle = `hsl(${hue},50%,${l}%)`;
        g.fillRect(x, r * rh, len, rh);
        for (let k = 0; k < 9; k++) {
          g.strokeStyle = `hsla(${hue},45%,${l + rand(-12, 8)}%,0.35)`;
          g.lineWidth = rand(0.8, 2.2);
          g.beginPath();
          const y0 = r * rh + rand(4, rh - 4), ph = rand(0, 6);
          g.moveTo(x, y0);
          for (let xx = x; xx < x + len; xx += 16) g.lineTo(xx, y0 + Math.sin(xx * 0.015 + ph) * 3);
          g.stroke();
        }
        g.fillStyle = 'rgba(25,12,5,0.85)';
        g.fillRect(x, r * rh, 3, rh);
        x += len;
      }
      g.fillStyle = 'rgba(25,12,5,0.9)';
      g.fillRect(0, r * rh, w, 3);
    }
  }, [5, 4]);
}

function wallpaperTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1f4a46';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#245450';
    g.fillRect(0, 0, w / 2, h);
    g.fillStyle = 'rgba(236,196,112,0.55)';
    for (const [cx, cy] of [[w / 4, h / 4], [3 * w / 4, 3 * h / 4]]) {
      g.beginPath();
      g.moveTo(cx, cy - 18);
      g.quadraticCurveTo(cx + 5, cy - 3, cx + 12, cy);
      g.quadraticCurveTo(cx + 5, cy + 3, cx, cy + 18);
      g.quadraticCurveTo(cx - 5, cy + 3, cx - 12, cy);
      g.quadraticCurveTo(cx - 5, cy - 3, cx, cy - 18);
      g.fill();
    }
    g.fillStyle = 'rgba(236,196,112,0.25)';
    g.fillRect(w / 2 - 1, 0, 2, h);
  }, [14, 4]);
}

function panelTex(base = '#6a3a1f') {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const pw = w / 2;
    for (let i = 0; i < 2; i++) {
      const x = i * pw + 18, y = 22;
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(x, y, pw - 36, h - 44);
      g.fillStyle = 'rgba(255,220,170,0.12)';
      g.fillRect(x + 6, y + 6, pw - 48, h - 56);
      g.strokeStyle = 'rgba(255,220,170,0.25)';
      g.lineWidth = 2;
      g.strokeRect(x, y, pw - 36, h - 44);
    }
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(30,12,4,${rand(0.05, 0.15)})`;
      g.beginPath();
      const y0 = rand(0, h);
      g.moveTo(0, y0);
      g.bezierCurveTo(w / 3, y0 + rand(-8, 8), 2 * w / 3, y0 + rand(-8, 8), w, y0);
      g.stroke();
    }
  });
}

function ringsTex(inner, outer, n = 60) {
  return canvasTex(8, 256, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const l = 45 + 12 * Math.sin(t * n) + 8 * Math.sin(t * n * 2.7);
      g.fillStyle = `hsl(${inner + (outer - inner) * t},62%,${l}%)`;
      g.fillRect(0, y, w, 1);
    }
  });
}

function gongTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    const grad = g.createRadialGradient(cx, cy, 10, cx, cy, w / 2);
    grad.addColorStop(0, '#6b4a1e');
    grad.addColorStop(0.25, '#c9962f');
    grad.addColorStop(0.55, '#e0b44c');
    grad.addColorStop(0.9, '#b07d27');
    grad.addColorStop(1, '#7a5418');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let r = 20; r < w / 2; r += rand(5, 12)) {
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '60,35,10' : '255,230,160'},${rand(0.08, 0.2)})`;
      g.lineWidth = rand(1, 3);
      g.beginPath();
      g.arc(cx, cy, r, 0, PI * 2);
      g.stroke();
    }
    g.fillStyle = 'rgba(40,20,5,0.6)';
    g.font = 'bold 44px serif';
    g.textAlign = 'center';
    g.fillText('♫', cx, cy + 120);
  });
}

function logoTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#f3ecdc';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c3202e';
    g.lineWidth = 14;
    g.beginPath();
    g.arc(w / 2, h / 2, 190, 0, PI * 2);
    g.stroke();
    g.fillStyle = '#c3202e';
    g.textAlign = 'center';
    g.font = 'bold italic 84px Georgia, serif';
    g.fillText('Ricochet', w / 2, h / 2 - 10);
    g.font = 'bold 44px Georgia, serif';
    g.fillStyle = '#1b1b1b';
    g.fillText('RHAPSODY', w / 2, h / 2 + 60);
  });
}

function grilleTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#2b2622';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(200,180,150,0.25)';
    for (let i = 0; i < w; i += 4) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
    }
  }, [3, 2]);
}

// --- materials ---------------------------------------------------------------------

const std = (color, roughness = 0.5, metalness = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const gloss = (color, roughness = 0.3, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 1, clearcoatRoughness: 0.08, ...extra });

let M;
function materials() {
  if (M) return M;
  M = {
    brass: std(0xe3b04b, 0.26, 1),
    gold: std(0xf2c55c, 0.22, 1),
    chrome: std(0xeeeef2, 0.12, 1),
    copper: std(0xd4784a, 0.3, 1),
    bronze: std(0xc99b3e, 0.36, 1),
    black: gloss(0x0c0c10, 0.15),
    ivory: std(0xf7f2e6, 0.35),
    ebony: std(0x141414, 0.35),
    head: std(0xf2ece0, 0.65),
    darkWood: std(0x4a2814, 0.45),
    wood: std(0x8b5a32, 0.5),
    lightWood: std(0xc99a62, 0.5),
    red: gloss(0xb3202a, 0.3),
    shell: gloss(0xd92f3c, 0.35, { metalness: 0.35 }),
    rope: std(0xcbb68a, 0.9),
    hole: std(0x120a05, 1),
    cream: std(0xf1e4c8, 0.6),
    tolex: std(0x1c1a19, 0.8),
    grille: std(0xffffff, 0.9, 0, { map: grilleTex() }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xd8f0f0, roughness: 0.05, transparent: true, opacity: 0.22 }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd89a, emissiveIntensity: 3 }),
  };
  return M;
}

// --- helpers -------------------------------------------------------------------------

function mesh(geo, mat, parent, pos = [0, 0, 0], rot) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  parent.add(m);
  return m;
}

function group(parent, pos = [0, 0, 0], rot) {
  const g = new THREE.Group();
  g.position.set(...pos);
  if (rot) g.rotation.set(...rot);
  parent.add(g);
  return g;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 3, r);
const cyl = (rt, rb, h, s = 24, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);

// A cylinder between two points, for rods, stands and cords.
function rod(parent, a, b, r, mat) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = mesh(cyl(r, r, len, 10), mat, parent);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  return m;
}

function flare(len, r0, rb, power = 3.2, seg = 40) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    pts.push(new THREE.Vector2(r0 + (rb - r0) * Math.pow(t, power), t * len));
  }
  pts.push(new THREE.Vector2(rb * 1.05, len - 0.004));
  return new THREE.LatheGeometry(pts, seg);
}

// --- the shop's registry of sounding things ------------------------------------------------

export class Shop {
  constructor(scene, world, pm) {
    this.scene = scene;
    this.world = world;
    this.pm = pm;
    this.root = group(scene);
    this.instruments = [];
    this.pending = [];
    this.lights = [];
  }

  instrument(node, spec) {
    const inst = {
      node, voice: 'wood', lo: 60, hi: 84, slot: 0.5, arp: true, musical: true,
      wobble: 'jiggle', amp: 1, hits: 0, last: 0, flash: 0, wob: 0, phase: 0, mats: [],
      glow: new THREE.Color(0xffc86a), ...spec,
    };
    if (typeof inst.glow === 'number') inst.glow = new THREE.Color(inst.glow);
    inst.base = { rot: node.rotation.clone(), scale: node.scale.clone(), pos: node.position.clone() };
    if (inst.musical) {
      node.traverse(o => {
        if (o.isMesh && !Array.isArray(o.material) && o.material.emissive) {
          o.material = o.material.clone();
          inst.mats.push(o.material);
        }
      });
    }
    this.instruments.push(inst);
    return inst;
  }

  proxy(parent, pos, rot, shape, inst, mat) {
    const o = new THREE.Object3D();
    o.position.set(...pos);
    if (rot) o.rotation.set(...rot);
    parent.add(o);
    this.pending.push({ o, shape, inst, mat });
  }

  box(parent, [sx, sy, sz], pos, inst, mat = 'hard', rot) {
    this.proxy(parent, pos, rot, new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)), inst, mat);
  }

  cyl(parent, r, h, pos, inst, mat = 'hard', rot) {
    this.proxy(parent, pos, rot, new CANNON.Cylinder(r, r, h, 14), inst, mat);
  }

  sphere(parent, r, pos, inst, mat = 'hard') {
    this.proxy(parent, pos, null, new CANNON.Sphere(r), inst, mat);
  }

  // Physics bodies are made from each proxy's world transform once the scene is laid out.
  finalize() {
    this.scene.updateMatrixWorld(true);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (const { o, shape, inst, mat } of this.pending) {
      o.matrixWorld.decompose(p, q, s);
      const body = new CANNON.Body({ mass: 0, material: this.pm[mat], type: CANNON.Body.STATIC });
      body.addShape(shape);
      body.position.set(p.x, p.y, p.z);
      body.quaternion.set(q.x, q.y, q.z, q.w);
      body.inst = inst;
      this.world.addBody(body);
      o.removeFromParent();
    }
    this.pending = [];
    this.root.traverse(o => {
      if (o.isMesh && !o.userData.noShadow) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  hit(inst, vel) {
    inst.flash = Math.min(1.2, inst.flash + 0.4 + 0.8 * vel);
    if (inst.wob < 0.05) inst.phase = 0;
    inst.wob = Math.min(1, inst.wob + 0.3 + vel);
  }

  update(dt) {
    for (const inst of this.instruments) {
      if (inst.flash > 0) {
        inst.flash *= Math.exp(-dt * 5);
        if (inst.flash < 0.003) inst.flash = 0;
        for (const m of inst.mats) m.emissive.copy(inst.glow).multiplyScalar(inst.flash * 0.55);
      }
      if (inst.wob <= 0) continue;
      const { node, base } = inst, w = inst.wob * inst.amp, t = (inst.phase += dt);
      let decay = 6;
      switch (inst.wobble) {
        case 'jiggle':
          node.scale.copy(base.scale).multiplyScalar(1 + 0.06 * w * Math.sin(t * 38));
          node.rotation.z = base.rot.z + 0.035 * w * Math.sin(t * 27);
          decay = 7;
          break;
        case 'swing':
          node.rotation.z = base.rot.z + 0.3 * w * Math.sin(t * 5.2);
          node.rotation.x = base.rot.x + 0.16 * w * Math.sin(t * 4.1 + 1);
          decay = 0.9;
          break;
        case 'tilt':
          node.rotation.x = base.rot.x + 0.25 * w * Math.sin(t * 13);
          decay = 2.2;
          break;
        case 'rock':
          node.rotation.z = base.rot.z + 0.06 * w * Math.sin(t * 9);
          node.rotation.x = base.rot.x + 0.03 * w * Math.sin(t * 7);
          decay = 3;
          break;
        case 'flap':
          node.rotation.z = base.rot.z + 0.08 * w * Math.sin(t * 11);
          decay = 4;
          break;
        case 'bob':
          node.position.y = base.pos.y - 0.02 * w * Math.abs(Math.sin(t * 30));
          decay = 9;
          break;
      }
      inst.wob *= Math.exp(-dt * decay);
      if (inst.wob < 0.002) {
        inst.wob = 0;
        node.rotation.copy(base.rot);
        node.scale.copy(base.scale);
        node.position.copy(base.pos);
      }
    }
  }
}

// --- the room ------------------------------------------------------------------------------

export const ROOM = { W: 20, D: 16, H: 6.5 };

function buildRoom(shop) {
  const m = materials(), R = shop.root, { W, D, H } = ROOM;
  const floorMat = std(0xffffff, 0.55, 0, { map: floorTex() });
  const floor = mesh(new THREE.PlaneGeometry(W, D), floorMat, R, [0, 0, 0], [-PI / 2, 0, 0]);
  const floorInst = shop.instrument(floor, { voice: 'boing', lo: 45, hi: 57, musical: false, wobble: 'none' });
  shop.box(R, [W + 4, 1, D + 4], [0, -0.5, 0], floorInst, 'floor');

  const wallMat = std(0xffffff, 0.8, 0, { map: wallpaperTex() });
  const wallInst = shop.instrument(new THREE.Object3D(), { voice: 'thud', lo: 31, hi: 43, musical: false, wobble: 'none' });
  const walls = [
    { size: [W, H], pos: [0, H / 2, -D / 2], rot: [0, 0, 0] },
    { size: [D, H], pos: [-W / 2, H / 2, 0], rot: [0, PI / 2, 0] },
    { size: [D, H], pos: [W / 2, H / 2, 0], rot: [0, -PI / 2, 0] },
    { size: [W, H], pos: [0, H / 2, D / 2], rot: [0, PI, 0] },
  ];
  const panel = panelTex();
  panel.repeat.set(10, 1);
  const panelSide = panelTex();
  panelSide.repeat.set(8, 1);
  const wainMat = std(0xffffff, 0.5, 0, { map: panel });
  const wainSideMat = std(0xffffff, 0.5, 0, { map: panelSide });
  for (const [i, w] of walls.entries()) {
    const g = group(R, w.pos, w.rot);
    mesh(new THREE.PlaneGeometry(...w.size), wallMat, g);
    const wm = i === 0 || i === 3 ? wainMat : wainSideMat;
    mesh(box(w.size[0], 1.25, 0.06), wm, g, [0, -H / 2 + 0.625, 0.03]);
    mesh(box(w.size[0], 0.06, 0.12), m.darkWood, g, [0, -H / 2 + 1.27, 0.06]);
    mesh(box(w.size[0], 0.16, 0.08), m.darkWood, g, [0, -H / 2 + 0.08, 0.05]);
    mesh(box(w.size[0], 0.22, 0.14), m.darkWood, g, [0, H / 2 - 0.11, 0.07]);
    shop.box(g, [w.size[0] + 2, H + 2, 1], [0, 0, -0.5], wallInst, 'wall');
  }

  const ceil = mesh(new THREE.PlaneGeometry(W, D), std(0x2e2119, 0.9), R, [0, H, 0], [PI / 2, 0, 0]);
  ceil.userData.noShadow = true;
  for (let z = -6; z <= 6; z += 3) mesh(box(W, 0.25, 0.3), m.darkWood, R, [0, H - 0.12, z]);
  shop.box(R, [W + 4, 1, D + 4], [0, H + 0.5, 0], wallInst, 'wall');
}

function buildCounter(shop) {
  const m = materials(), R = shop.root;
  const g = group(R, [0, 0, 5.3]);
  const front = panelTex('#7a4524');
  front.repeat.set(4, 1);
  mesh(box(7.2, 0.95, 0.7), std(0xffffff, 0.5, 0, { map: front }), g, [0, 0.475, 0]);
  mesh(rbox(7.4, 0.06, 0.82, 0.02), m.darkWood, g, [0, 0.98, 0]);
  const inst = shop.instrument(g, { voice: 'wood', lo: 67, hi: 79, musical: false, wobble: 'none' });
  shop.box(g, [7.4, 1.02, 0.82], [0, 0.5, 0], inst, 'hard');

  // A service bell, for the customers.
  const bell = group(g, [2.6, 1.01, -0.1]);
  mesh(cyl(0.09, 0.1, 0.03, 32), m.ebony, bell, [0, 0.015, 0]);
  mesh(new THREE.SphereGeometry(0.08, 32, 16, 0, PI * 2, 0, PI / 2), m.chrome, bell, [0, 0.03, 0]);
  mesh(cyl(0.008, 0.008, 0.04), m.chrome, bell, [0, 0.12, 0]);
  mesh(new THREE.SphereGeometry(0.018, 12, 8), m.chrome, bell, [0, 0.14, 0]);
  const binst = shop.instrument(bell, { voice: 'bell', lo: 84, hi: 96, slot: 1, arp: false, wobble: 'jiggle', glow: 0xffffff });
  shop.sphere(bell, 0.1, [0, 0.05, 0], binst);

  // Sheet music and a metronome for set dressing.
  const met = group(g, [-2.7, 1.01, -0.1], [0, 0.4, 0]);
  const tri = new THREE.CylinderGeometry(0.02, 0.09, 0.26, 4);
  mesh(tri, m.darkWood, met, [0, 0.13, 0], [0, PI / 4, 0]);
  mesh(box(0.008, 0.2, 0.008), m.brass, met, [0.02, 0.16, 0.065], [0, 0, 0.3]);
  const minst = shop.instrument(met, { voice: 'wood', lo: 72, hi: 84, slot: 0.5, wobble: 'jiggle' });
  shop.box(met, [0.16, 0.26, 0.16], [0, 0.13, 0], minst);
  for (let i = 0; i < 3; i++) {
    mesh(box(0.22, 0.01, 0.3), m.cream, g, [-1.9 + i * 0.05, 1.02 + i * 0.01, -0.05], [0, 0.2 * i - 0.2, 0]);
  }
}

// --- instruments --------------------------------------------------------------------------

function buildMarimba(shop, x, z) {
  const m = materials(), R = shop.root;
  const g = group(R, [x, 0, z]);
  const n = 13, span = 2.7;
  for (const s of [-1, 1]) mesh(box(span + 0.3, 0.07, 0.07), m.darkWood, g, [0, 0.86, s * 0.3]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(cyl(0.03, 0.035, 0.86, 12), m.darkWood, g, [sx * (span / 2 + 0.1), 0.43, sz * 0.3]);
  for (const sx of [-1, 1]) mesh(box(0.06, 0.06, 0.66), m.darkWood, g, [sx * (span / 2 + 0.1), 0.2, 0]);
  mesh(box(span + 0.2, 0.05, 0.05), m.darkWood, g, [0, 0.2, 0]);
  for (let i = 0; i < n; i++) {
    const bx = -span / 2 + (i + 0.5) * span / n;
    const len = 0.6 - 0.26 * i / (n - 1);
    const color = new THREE.Color().setHSL(i / n * 0.85, 0.7, 0.55);
    const bar = mesh(rbox(0.17, 0.045, len, 0.015), gloss(color, 0.35), g, [bx, 0.92, 0]);
    const tube = 0.5 - 0.3 * i / (n - 1);
    mesh(cyl(0.045, 0.045, tube, 16), m.brass, g, [bx, 0.84 - tube / 2, 0]);
    const inst = shop.instrument(bar, { voice: 'mallet', lo: 62, hi: 93, slot: i / (n - 1), arp: false, wobble: 'bob', glow: color });
    shop.box(bar, [0.17, 0.06, len], [0, 0, 0], inst);
  }
}

function makeDrum(r, h, shellMat, logo) {
  const m = materials();
  const g = new THREE.Group();
  mesh(cyl(r, r, h, 40, true), shellMat, g).material.side = THREE.DoubleSide;
  const headTop = logo ? std(0xffffff, 0.6, 0, { map: logo }) : m.head;
  mesh(new THREE.CircleGeometry(r, 40), headTop, g, [0, h / 2, 0], [-PI / 2, 0, 0]);
  mesh(new THREE.CircleGeometry(r, 40), m.head, g, [0, -h / 2, 0], [PI / 2, 0, 0]);
  for (const y of [-h / 2, h / 2]) mesh(new THREE.TorusGeometry(r + 0.004, 0.012, 8, 48), m.chrome, g, [0, y, 0], [PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * PI * 2;
    mesh(rbox(0.02, h * 0.45, 0.025, 0.008), m.chrome, g, [Math.cos(a) * (r + 0.01), 0, Math.sin(a) * (r + 0.01)], [0, -a, 0]);
  }
  return g;
}

function cymbalGeo(r) {
  const pts = [[0, 0.035], [r * 0.12, 0.034], [r * 0.2, 0.02], [r * 0.25, 0.012], [r * 0.6, 0.006], [r, 0]];
  return new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 48);
}

let cymbalMat;
function cymbal(parent, r, pos, rot) {
  cymbalMat ??= std(0xffffff, 0.32, 1, { map: ringsTex(38, 44), side: THREE.DoubleSide });
  const g = group(parent, pos, rot);
  mesh(cymbalGeo(r), cymbalMat, g);
  return g;
}

function tripod(parent, x, z, top, mat) {
  rod(parent, [x, 0.25, z], [x, top, z], 0.012, mat);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * PI * 2 + 0.5;
    rod(parent, [x, 0.3, z], [x + Math.cos(a) * 0.25, 0.01, z + Math.sin(a) * 0.25], 0.01, mat);
  }
}

function buildDrumKit(shop, x, z, ry) {
  const m = materials(), R = shop.root;
  const g = group(R, [x, 0, z], [0, ry, 0]);

  const bd = group(g, [0, 0.38, 0]);
  const bass = makeDrum(0.36, 0.42, m.shell, logoTex());
  bass.rotation.x = PI / 2;
  bd.add(bass);
  for (const s of [-1, 1]) rod(g, [s * 0.25, 0.1, 0.1], [s * 0.36, 0.0, 0.3], 0.01, m.chrome);
  const kick = shop.instrument(bd, { voice: 'kick', lo: 26, hi: 38, slot: 0, arp: false, glow: 0xff6a5a });
  shop.cyl(bd, 0.36, 0.42, [0, 0, 0], kick, 'drum', [PI / 2, 0, 0]);

  const toms = [
    { pos: [-0.22, 0.98, -0.02], r: 0.17, h: 0.2, rot: [0.45, 0, 0.12], slot: 0.35 },
    { pos: [0.24, 0.98, -0.02], r: 0.18, h: 0.22, rot: [0.45, 0, -0.12], slot: 0.9 },
  ];
  for (const t of toms) {
    const tg = group(g, t.pos, t.rot);
    tg.add(makeDrum(t.r, t.h, m.shell));
    rod(g, [t.pos[0] * 0.3, 0.75, 0], t.pos, 0.012, m.chrome);
    const inst = shop.instrument(tg, { voice: 'tom', lo: 45, hi: 62, slot: t.slot, arp: false, glow: 0xff6a5a });
    shop.cyl(tg, t.r, t.h, [0, 0, 0], inst, 'drum');
  }

  const ft = group(g, [0.78, 0.5, 0.05]);
  ft.add(makeDrum(0.24, 0.4, m.shell));
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * PI * 2;
    rod(g, [0.78 + Math.cos(a) * 0.26, 0.55, 0.05 + Math.sin(a) * 0.26], [0.78 + Math.cos(a) * 0.32, 0, 0.05 + Math.sin(a) * 0.32], 0.01, m.chrome);
  }
  const ftInst = shop.instrument(ft, { voice: 'tom', lo: 40, hi: 52, slot: 0.2, arp: false, glow: 0xff6a5a });
  shop.cyl(ft, 0.24, 0.4, [0, 0, 0], ftInst, 'drum');

  tripod(g, -0.62, 0.35, 0.55, m.chrome);
  const sn = group(g, [-0.62, 0.62, 0.35], [0.15, 0, 0]);
  sn.add(makeDrum(0.2, 0.14, m.chrome));
  const snInst = shop.instrument(sn, { voice: 'snare', lo: 55, hi: 67, slot: 0.5, arp: false, glow: 0xffffff });
  shop.cyl(sn, 0.2, 0.14, [0, 0, 0], snInst, 'drum');

  tripod(g, -1.05, 0.15, 0.95, m.chrome);
  const hh = group(g, [-1.05, 0.97, 0.15]);
  cymbal(hh, 0.18, [0, 0, 0]);
  cymbal(hh, 0.18, [0, -0.02, 0], [PI, 0, 0]);
  const hhInst = shop.instrument(hh, { voice: 'hihat', lo: 80, hi: 92, wobble: 'tilt', glow: 0xfff1b0 });
  shop.cyl(hh, 0.18, 0.07, [0, 0, 0], hhInst);

  const cymbals = [
    { base: [-0.75, -0.35], pos: [-0.7, 1.55, -0.3], r: 0.27, rot: [0.35, 0, 0.25], voice: 'crash' },
    { base: [1.05, -0.3], pos: [0.95, 1.4, -0.28], r: 0.31, rot: [0.3, 0, -0.2], voice: 'ride' },
  ];
  for (const c of cymbals) {
    tripod(g, c.base[0], c.base[1], c.pos[1] - 0.03, m.chrome);
    const cg = cymbal(g, c.r, c.pos, c.rot);
    const inst = shop.instrument(cg, { voice: c.voice, lo: 79, hi: 91, slot: 0.5, wobble: 'tilt', glow: 0xfff1b0 });
    shop.cyl(cg, c.r, 0.07, [0, 0.01, 0], inst);
  }

  const stool = group(g, [0.05, 0, -0.75]);
  mesh(cyl(0.2, 0.2, 0.09, 24), m.red, stool, [0, 0.52, 0]);
  tripod(stool, 0, 0, 0.48, m.chrome);
}

function buildPiano(shop, x, z, ry) {
  const m = materials(), R = shop.root;
  const g = group(R, [x, 0, z], [0, ry, 0]);
  const shape = new THREE.Shape();
  shape.moveTo(-0.75, 0);
  shape.lineTo(0.75, 0);
  shape.lineTo(0.75, 0.8);
  shape.bezierCurveTo(0.75, 1.3, 0.1, 1.2, 0.0, 1.7);
  shape.bezierCurveTo(-0.1, 2.05, -0.5, 2.05, -0.75, 1.95);
  shape.lineTo(-0.75, 0);

  const caseGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 });
  mesh(caseGeo, m.black, g, [0, 0.7, 0], [-PI / 2, 0, 0]);
  const plate = new THREE.ShapeGeometry(shape, 24);
  const pm = mesh(plate, m.gold, g, [0, 1.035, 0], [-PI / 2, 0, 0]);
  pm.scale.set(0.9, 0.92, 1);
  pm.position.z = -0.08;
  for (let i = 0; i < 18; i++) {
    const sx = -0.62 + i * 0.07;
    const len = i < 10 ? 1.7 - i * 0.02 : 1.5 - (i - 10) * 0.13;
    mesh(box(0.004, 0.004, len), m.chrome, g, [sx, 1.045, -0.15 - len / 2]);
  }

  mesh(box(1.5, 0.12, 0.3), m.black, g, [0, 0.78, 0.12]);
  const whites = 36, kw = 1.36 / whites;
  const white = new THREE.InstancedMesh(box(kw * 0.92, 0.025, 0.15), m.ivory, whites);
  const blackIdx = [];
  const d = new THREE.Object3D();
  for (let i = 0; i < whites; i++) {
    d.position.set(-0.68 + (i + 0.5) * kw, 0.85, 0.18);
    d.updateMatrix();
    white.setMatrixAt(i, d.matrix);
    if ([0, 1, 3, 4, 5].includes(i % 7) && i < whites - 1) blackIdx.push(i);
  }
  g.add(white);
  const blacks = new THREE.InstancedMesh(box(kw * 0.55, 0.03, 0.09), m.ebony, blackIdx.length);
  blackIdx.forEach((i, k) => {
    d.position.set(-0.68 + (i + 1) * kw, 0.87, 0.14);
    d.updateMatrix();
    blacks.setMatrixAt(k, d.matrix);
  });
  g.add(blacks);
  for (const s of [-1, 1]) mesh(box(0.07, 0.1, 0.3), m.black, g, [s * 0.715, 0.88, 0.12]);
  mesh(box(0.7, 0.28, 0.02), m.black, g, [0, 1.2, -0.28], [-0.25, 0, 0]);

  for (const [lx, lz] of [[-0.62, -0.12], [0.62, -0.12], [-0.5, -1.8]]) {
    mesh(cyl(0.07, 0.05, 0.7, 16), m.black, g, [lx, 0.35, lz]);
    mesh(new THREE.SphereGeometry(0.04, 12, 8), m.brass, g, [lx, 0.03, lz]);
  }
  mesh(box(0.14, 0.4, 0.04), m.black, g, [0, 0.35, -0.35]);
  for (const px of [-0.04, 0, 0.04]) mesh(box(0.025, 0.012, 0.09), m.brass, g, [px, 0.06, -0.3]);

  const pianoInst = shop.instrument(g, {
    voice: 'piano', lo: 45, hi: 88, arp: false, wobble: 'none', glow: 0xffe2a0,
    slotFrom: p => clamp01((g.worldToLocal(p).x + 0.75) / 1.5),
  });
  shop.box(g, [1.5, 0.34, 1.1], [0, 0.87, -0.55], pianoInst);
  shop.box(g, [1.1, 0.34, 0.9], [-0.15, 0.87, -1.5], pianoInst);
  shop.box(g, [1.5, 0.14, 0.32], [0, 0.82, 0.13], pianoInst);

  const lid = group(g, [-0.75, 1.04, 0], [0, 0, 0.65]);
  const lidGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false, curveSegments: 24 });
  mesh(lidGeo, m.black, lid, [0.75, 0, 0], [-PI / 2, 0, 0]);
  rod(g, [0.35, 1.04, -0.8], [0.35, 1.04 + 0.84, -0.8], 0.012, m.black);
  const lidInst = shop.instrument(lid, {
    voice: 'piano', lo: 57, hi: 93, arp: false, wobble: 'flap', glow: 0xffe2a0,
    slotFrom: p => clamp01(lid.worldToLocal(p).x / 1.5),
  });
  shop.box(lid, [1.5, 0.07, 1.9], [0.75, 0.01, -0.95], lidInst);

  const bench = group(g, [0, 0, 0.75]);
  mesh(rbox(0.9, 0.08, 0.36, 0.02), m.black, bench, [0, 0.5, 0]);
  for (const sx of [-0.4, 0.4]) for (const sz of [-0.14, 0.14]) mesh(cyl(0.025, 0.02, 0.46, 10), m.black, bench, [sx, 0.23, sz]);
  const benchInst = shop.instrument(bench, { voice: 'wood', lo: 60, hi: 72, musical: false, wobble: 'none' });
  shop.box(bench, [0.9, 0.1, 0.36], [0, 0.5, 0], benchInst);
}

function buildChimes(shop, x, z) {
  const m = materials(), R = shop.root;
  const g = group(R, [x, 0, z]);
  for (const sx of [-1.45, 1.45]) {
    mesh(cyl(0.035, 0.04, 3.8, 12), m.darkWood, g, [sx, 1.9, 0]);
    mesh(rbox(0.12, 0.08, 0.7, 0.02), m.darkWood, g, [sx, 0.04, 0]);
    mesh(new THREE.SphereGeometry(0.06, 16, 12), m.gold, g, [sx, 3.85, 0]);
  }
  mesh(rbox(3.0, 0.1, 0.1, 0.02), m.darkWood, g, [0, 3.75, 0]);
  const frameInst = shop.instrument(g, { voice: 'wood', lo: 67, hi: 79, musical: false, wobble: 'none' });
  shop.box(g, [3.0, 0.12, 0.12], [0, 3.75, 0], frameInst);
  for (const sx of [-1.45, 1.45]) shop.cyl(g, 0.04, 3.8, [sx, 1.9, 0], frameInst);

  const n = 10;
  for (let i = 0; i < n; i++) {
    const tx = -1.2 + i * 2.4 / (n - 1);
    const L = 1.9 - i * 0.1;
    const pivot = group(g, [tx, 3.66, 0]);
    rod(pivot, [0, 0.04, 0], [0, -0.06, 0], 0.004, m.rope);
    mesh(cyl(0.034, 0.034, 0.06, 16), m.gold, pivot, [0, -0.09, 0]);
    mesh(cyl(0.028, 0.028, L, 20), m.chrome, pivot, [0, -0.12 - L / 2, 0]);
    const inst = shop.instrument(pivot, { voice: 'chime', lo: 69, hi: 93, slot: i / (n - 1), arp: false, wobble: 'swing', glow: 0xd8ecff });
    shop.cyl(pivot, 0.05, L, [0, -0.12 - L / 2, 0], inst);
  }
}

function buildTimpani(shop, x, z, R0, slot) {
  const m = materials();
  const g = group(shop.root, [x, 0, z]);
  const pts = [];
  for (let k = 0; k <= 18; k++) {
    const a = k / 18 * PI / 2;
    pts.push(new THREE.Vector2(R0 * Math.sin(a), 0.8 - 0.55 * Math.cos(a)));
  }
  const bowl = mesh(new THREE.LatheGeometry(pts, 48), m.copper, g);
  bowl.material = bowl.material.clone();
  bowl.material.side = THREE.DoubleSide;
  mesh(cyl(R0 + 0.015, R0 + 0.015, 0.03, 48), m.head, g, [0, 0.815, 0]);
  mesh(new THREE.TorusGeometry(R0 + 0.02, 0.018, 8, 48), m.chrome, g, [0, 0.8, 0], [PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * PI * 2;
    rod(g, [Math.cos(a) * (R0 + 0.03), 0.82, Math.sin(a) * (R0 + 0.03)], [Math.cos(a) * (R0 * 0.9), 0.55, Math.sin(a) * (R0 * 0.9)], 0.008, m.chrome);
  }
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * PI * 2 + 0.3;
    rod(g, [Math.cos(a) * R0 * 0.5, 0.35, Math.sin(a) * R0 * 0.5], [Math.cos(a) * R0 * 0.8, 0.04, Math.sin(a) * R0 * 0.8], 0.02, m.chrome);
    mesh(new THREE.SphereGeometry(0.04, 10, 8), m.ebony, g, [Math.cos(a) * R0 * 0.8, 0.04, Math.sin(a) * R0 * 0.8]);
  }
  mesh(rbox(0.12, 0.04, 0.25, 0.01), m.ebony, g, [0, 0.03, R0 * 0.8]);
  const inst = shop.instrument(g, { voice: 'timpani', lo: 36, hi: 52, slot, arp: false, amp: 0.5, glow: 0xffa060 });
  shop.cyl(g, R0, 0.06, [0, 0.82, 0], inst, 'drum');
  shop.cyl(g, R0 * 0.75, 0.55, [0, 0.5, 0], inst);
}

function buildGong(shop, x, z, ry) {
  const m = materials();
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  for (const sx of [-1.2, 1.2]) {
    mesh(cyl(0.06, 0.07, 2.9, 16), m.red, g, [sx, 1.45, 0]);
    mesh(rbox(0.16, 0.12, 0.8, 0.03), m.red, g, [sx, 0.06, 0]);
    mesh(new THREE.ConeGeometry(0.08, 0.2, 16), m.gold, g, [sx, 3.0, 0]);
  }
  mesh(rbox(2.7, 0.16, 0.16, 0.04), m.red, g, [0, 2.85, 0]);
  mesh(box(2.4, 0.03, 0.17), m.gold, g, [0, 2.78, 0]);
  const frameInst = shop.instrument(g, { voice: 'wood', lo: 60, hi: 72, musical: false, wobble: 'none' });
  shop.box(g, [2.7, 0.16, 0.16], [0, 2.85, 0], frameInst);
  for (const sx of [-1.2, 1.2]) shop.cyl(g, 0.07, 2.9, [sx, 1.45, 0], frameInst);

  const pivot = group(g, [0, 2.77, 0]);
  for (const sx of [-0.3, 0.3]) rod(pivot, [sx, 0, 0], [sx * 0.5, -0.36, 0], 0.008, m.rope);
  const tex = gongTex();
  const face = std(0xffffff, 0.35, 1, { map: tex });
  mesh(cyl(0.95, 0.95, 0.05, 64), [m.bronze, face, face], pivot, [0, -1.3, 0], [PI / 2, 0, 0]);
  mesh(new THREE.TorusGeometry(0.95, 0.035, 12, 64), m.bronze, pivot, [0, -1.3, 0]);
  const boss = mesh(new THREE.SphereGeometry(0.22, 24, 16), face, pivot, [0, -1.3, 0.02]);
  boss.scale.z = 0.3;
  const inst = shop.instrument(pivot, { voice: 'gong', lo: 38, hi: 50, slot: 0, arp: false, wobble: 'swing', amp: 0.35, glow: 0xffb040 });
  shop.cyl(pivot, 0.95, 0.12, [0, -1.3, 0], inst, 'hard', [PI / 2, 0, 0]);

  const mallet = group(g, [1.05, 0, 0.35], [0.1, 0, 0.25]);
  mesh(cyl(0.015, 0.015, 0.9, 8), m.lightWood, mallet, [0, 0.45, 0]);
  mesh(new THREE.SphereGeometry(0.08, 16, 12), m.cream, mallet, [0, 0.92, 0]);
}

function buildOrgan(shop) {
  const m = materials(), R = shop.root;
  const g = group(R, [0, 0, -7.45]);
  const front = panelTex('#5a2f18');
  front.repeat.set(3, 1);
  mesh(box(5.0, 2.3, 1.0), std(0xffffff, 0.5, 0, { map: front }), g, [0, 1.15, 0]);
  mesh(rbox(5.3, 0.14, 1.1, 0.04), m.darkWood, g, [0, 2.32, 0]);
  mesh(box(5.0, 0.04, 0.02), m.gold, g, [0, 2.2, 0.51]);
  mesh(box(1.4, 0.08, 0.35), m.ebony, g, [0, 1.05, 0.62]);
  mesh(box(1.3, 0.02, 0.12), m.ivory, g, [0, 1.1, 0.72]);
  const caseInst = shop.instrument(g, { voice: 'wood', lo: 72, hi: 84, wobble: 'none', glow: 0xffb070 });
  shop.box(g, [5.3, 2.4, 1.1], [0, 1.2, 0], caseInst);

  const n = 17;
  for (let i = 0; i < n; i++) {
    const t = 1 - Math.abs(i - 8) / 8;
    const h = 1.0 + 2.4 * Math.pow(t, 1.2);
    const r = 0.06 + 0.03 * t;
    const px = -2.25 + i * 4.5 / (n - 1);
    const pipe = group(g, [px, 2.39, 0.15 + (i % 2) * 0.12]);
    mesh(cyl(r, 0.018, 0.35, 20), m.gold, pipe, [0, 0.175, 0]);
    mesh(cyl(r, r, h, 24), m.gold, pipe, [0, 0.35 + h / 2, 0]);
    mesh(box(r * 1.1, 0.08, 0.02), m.hole, pipe, [0, 0.43, r - 0.004]);
    const inst = shop.instrument(pipe, { voice: 'organ', lo: 50, hi: 81, slot: 1 - (h - 1) / 2.4, arp: false, wobble: 'rock', amp: 0.4, glow: 0xfff0b0 });
    shop.cyl(pipe, r + 0.01, h + 0.35, [0, (h + 0.35) / 2, 0], inst);
  }
}

function bodyShape(w1, w2, L) {
  const uc = L - w2;
  const hw = y => {
    const lower = y < 2 * w1 ? w1 * Math.sqrt(Math.max(0, 1 - ((y - w1) / w1) ** 2)) : 0;
    const upper = y > L - 2 * w2 ? w2 * Math.sqrt(Math.max(0, 1 - ((y - uc) / w2) ** 2)) : 0;
    const waist = y > w1 && y < uc ? w2 * 0.74 : 0;
    return Math.max(lower, upper, waist);
  };
  const N = 48, pts = [];
  for (let k = 0; k <= N; k++) {
    const y = L * (1 - Math.cos(PI * k / N)) / 2;
    pts.push(new THREE.Vector2(hw(y), y));
  }
  for (let k = N - 1; k > 0; k--) {
    const y = L * (1 - Math.cos(PI * k / N)) / 2;
    pts.push(new THREE.Vector2(-hw(y), y));
  }
  return new THREE.Shape(pts);
}

// A guitar-family body hanging from its headstock: the group origin is the top.
function makeStringed(color, { w1 = 0.19, w2 = 0.15, L = 0.5, d = 0.1, neck = 0.46, head = 0.17, strings = 6, bowed = false }) {
  const m = materials();
  const g = new THREE.Group();
  const bodyY = -(head + neck + L / 2 - 0.02);
  const geo = new THREE.ExtrudeGeometry(bodyShape(w1, w2, L), { depth: d, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 12 });
  geo.translate(0, -L / 2, -d / 2);
  mesh(geo, gloss(color, 0.3), g, [0, bodyY, 0]);
  const front = d / 2 + 0.013;
  if (bowed) {
    for (const s of [-1, 1]) mesh(box(w1 * 0.06, L * 0.3, 0.004), m.hole, g, [s * w2 * 0.55, bodyY, front], [0, 0, s * 0.12]);
    mesh(box(w2 * 0.6, 0.02, 0.03), m.lightWood, g, [0, bodyY - L * 0.05, front + 0.015]);
    mesh(box(w2 * 0.5, L * 0.35, 0.01), m.ebony, g, [0, bodyY - L * 0.32, front + 0.01]);
  } else {
    mesh(new THREE.CircleGeometry(w2 * 0.38, 32), m.hole, g, [0, bodyY + L * 0.12, front]);
    mesh(new THREE.RingGeometry(w2 * 0.38, w2 * 0.46, 32), m.ivory, g, [0, bodyY + L * 0.12, front + 0.001]);
    mesh(box(w1 * 0.6, 0.025, 0.015), m.darkWood, g, [0, bodyY - L * 0.24, front + 0.007]);
  }
  mesh(box(w2 * 0.36, neck, 0.035), bowed ? m.darkWood : m.lightWood, g, [0, -head - neck / 2, 0]);
  mesh(box(w2 * 0.34, neck + (bowed ? L * 0.3 : 0.05), 0.008), m.ebony, g, [0, -head - neck / 2 - (bowed ? L * 0.15 : 0), 0.021]);
  if (bowed) {
    mesh(new THREE.TorusGeometry(head * 0.3, head * 0.12, 8, 20), m.darkWood, g, [0, -head * 0.3, 0], [0, PI / 2, 0]);
    mesh(box(w2 * 0.28, head * 0.7, 0.04), m.darkWood, g, [0, -head * 0.6, 0]);
  } else {
    mesh(rbox(w2 * 0.55, head, 0.025, 0.008), m.ebony, g, [0, -head / 2, 0]);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      mesh(cyl(0.008, 0.008, 0.03, 8), m.chrome, g, [s * w2 * 0.33, -0.035 - i * 0.045, 0], [0, 0, PI / 2]);
    }
  }
  const top = -head + 0.01, bottom = bodyY - L * (bowed ? 0.47 : 0.24);
  const sw = (strings - 1) * 0.008;
  for (let s = 0; s < strings; s++) {
    const sx = -sw / 2 + s * 0.008;
    mesh(box(0.0015, top - bottom, 0.0015), m.chrome, g, [sx, (top + bottom) / 2, 0.04]).userData.noShadow = true;
  }
  return { g, bodyY };
}

const GUITAR_COLORS = [0xd98b2b, 0xa3262f, 0x2b6cb0, 0xe9c46a, 0x3aa38f, 0x1d1d1d];

function buildGuitars(shop) {
  const m = materials(), R = shop.root;
  const xs = [-7.2, -5.8, -4.4, 4.4, 5.8, 7.2];
  xs.forEach((x, i) => {
    const hook = group(R, [x, 3.9, -7.82], [0, 0, rand(-0.06, 0.06)]);
    mesh(cyl(0.012, 0.012, 0.1, 8), m.brass, hook, [0, 0.03, -0.05], [PI / 2, 0, 0]);
    const { g, bodyY } = makeStringed(GUITAR_COLORS[i], {});
    hook.add(g);
    const inst = shop.instrument(hook, { voice: 'pluck', lo: 40, hi: 67, slot: i / 5, wobble: 'swing', amp: 0.35, glow: GUITAR_COLORS[i] === 0x1d1d1d ? 0xffffff : GUITAR_COLORS[i] });
    shop.box(hook, [0.42, 0.52, 0.16], [0, bodyY, 0], inst);
    shop.box(hook, [0.08, 0.62, 0.06], [0, -0.4, 0], inst);

    const amp = group(R, [x, 0, -7.55], [0, rand(-0.1, 0.1), 0]);
    mesh(rbox(0.7, 0.55, 0.32, 0.03), m.tolex, amp, [0, 0.275, 0]);
    mesh(box(0.6, 0.38, 0.01), m.grille, amp, [0, 0.24, 0.161]);
    mesh(box(0.6, 0.06, 0.01), m.brass, amp, [0, 0.49, 0.161]);
    const ampInst = shop.instrument(amp, { voice: 'tom', lo: 40, hi: 52, slot: 0.5, arp: false, amp: 0.5, glow: 0xffc86a });
    shop.box(amp, [0.7, 0.55, 0.32], [0, 0.275, 0], ampInst, 'drum');
  });
}

function buildStrings(shop) {
  const m = materials(), R = shop.root;
  const cellos = [-5.4, -4.1, -2.8];
  cellos.forEach((z, i) => {
    const stand = group(R, [-9.3, 0, z], [0, PI / 2 - 0.35, 0]);
    const dims = { w1: 0.23, w2: 0.19, L: 0.76, d: 0.2, neck: 0.5, head: 0.17, strings: 4, bowed: true };
    const { g, bodyY } = makeStringed(0x9e4318, dims);
    const topY = 0.25 - (bodyY - dims.L / 2);
    g.position.y = topY;
    stand.add(g);
    stand.rotation.z = -0.08;
    rod(stand, [0, 0, 0], [0, 0.26, 0], 0.006, m.chrome);
    const inst = shop.instrument(stand, { voice: 'bowed', lo: 38, hi: 62, slot: i / 2, wobble: 'rock', glow: 0xffa060 });
    shop.box(stand, [0.5, 0.8, 0.26], [0, topY + bodyY, 0], inst);
    shop.box(stand, [0.08, 0.7, 0.08], [0, topY - 0.35, 0], inst);
  });
  const violins = [-1.6, -0.6, 0.4, 1.4];
  violins.forEach((z, i) => {
    const hook = group(R, [-9.9, 3.7 + (i % 2) * 0.25, z], [0, PI / 2, rand(-0.08, 0.08)]);
    const { g, bodyY } = makeStringed(0xb65a1f, { w1: 0.1, w2: 0.085, L: 0.36, d: 0.06, neck: 0.22, head: 0.09, strings: 4, bowed: true });
    g.position.z = 0.08;
    hook.add(g);
    const inst = shop.instrument(hook, { voice: 'bowed', lo: 67, hi: 88, slot: i / 3, wobble: 'swing', amp: 0.4, glow: 0xffa060 });
    shop.box(hook, [0.24, 0.4, 0.1], [0, bodyY, 0.08], inst);
  });
}

function makeTrumpet() {
  const m = materials();
  const g = new THREE.Group();
  const bell = mesh(flare(0.28, 0.01, 0.06), m.brass, g, [0.02, 0, 0], [0, 0, -PI / 2]);
  bell.material = m.brass.clone();
  bell.material.side = THREE.DoubleSide;
  rod(g, [-0.3, 0.04, 0], [0.04, 0.04, 0], 0.009, m.brass);
  rod(g, [-0.2, -0.03, 0], [0.02, -0.03, 0], 0.009, m.brass);
  for (let i = 0; i < 3; i++) mesh(cyl(0.013, 0.013, 0.12, 12), m.brass, g, [-0.1 + i * 0.035, 0.0, 0]);
  mesh(new THREE.TorusGeometry(0.035, 0.009, 8, 16, PI), m.brass, g, [-0.2, 0.005, 0], [0, 0, PI / 2]);
  mesh(new THREE.ConeGeometry(0.012, 0.04, 12), m.chrome, g, [-0.32, 0.04, 0], [0, 0, PI / 2]);
  return g;
}

function makeHorn() {
  const m = materials();
  const g = new THREE.Group();
  mesh(new THREE.TorusGeometry(0.16, 0.013, 10, 48), m.brass, g);
  mesh(new THREE.TorusGeometry(0.12, 0.011, 10, 48), m.brass, g, [0.02, 0, 0.02]);
  const bell = mesh(flare(0.28, 0.015, 0.14, 3.5), m.brass, g, [0.13, -0.08, 0.02], [0, 0, -0.9]);
  bell.material = m.brass.clone();
  bell.material.side = THREE.DoubleSide;
  for (let i = 0; i < 3; i++) mesh(cyl(0.014, 0.014, 0.09, 12), m.brass, g, [-0.05 + i * 0.035, 0.08, 0.03]);
  return g;
}

function makeTuba() {
  const m = materials();
  const g = new THREE.Group();
  mesh(cyl(0.1, 0.12, 0.6, 24), m.brass, g, [0, 0.45, 0]);
  mesh(new THREE.TorusGeometry(0.16, 0.08, 16, 32, PI), m.brass, g, [0.16, 0.18, 0], [0, 0, PI]);
  mesh(cyl(0.08, 0.08, 0.5, 20), m.brass, g, [0.32, 0.43, 0]);
  const bell = mesh(flare(0.55, 0.08, 0.3, 2.6), m.brass, g, [0.32, 0.66, 0]);
  bell.material = m.brass.clone();
  bell.material.side = THREE.DoubleSide;
  for (let i = 0; i < 4; i++) mesh(cyl(0.022, 0.022, 0.2, 12), m.brass, g, [0.1 + i * 0.05, 0.6, 0.12]);
  mesh(new THREE.TorusGeometry(0.1, 0.02, 10, 24), m.brass, g, [0.05, 0.85, 0.05], [0, PI / 2, 0]);
  return g;
}

function buildBrass(shop) {
  const m = materials(), R = shop.root;
  const tuba = group(R, [7.8, 0, 1.8], [0, -0.9, 0]);
  tuba.add(makeTuba());
  const tInst = shop.instrument(tuba, { voice: 'brass', lo: 33, hi: 50, slot: 0.3, glow: 0xffd070 });
  shop.cyl(tuba, 0.2, 0.8, [0.15, 0.4, 0], tInst);
  shop.cyl(tuba, 0.3, 0.55, [0.32, 0.95, 0], tInst);

  for (const [i, z] of [-5.2, -2.4, 0.4, 3.0].entries()) {
    const hook = group(R, [9.85, 2.6, z], [0, -PI / 2 + 0.2, 0]);
    const t = makeTrumpet();
    t.rotation.z = 0.25;
    t.position.z = 0.1;
    hook.add(t);
    const inst = shop.instrument(hook, { voice: 'brass', lo: 60, hi: 79, slot: i / 3, wobble: 'swing', amp: 0.5, glow: 0xffd070 });
    shop.box(hook, [0.66, 0.16, 0.16], [0, 0, 0.1], inst, 'hard', [0, 0, 0.25]);
  }
  for (const [i, z] of [-3.8, -1.0, 1.8].entries()) {
    const hook = group(R, [9.8, 3.9, z], [0, -PI / 2, 0]);
    const h = makeHorn();
    h.position.z = 0.1;
    hook.add(h);
    mesh(cyl(0.01, 0.01, 0.12, 8), m.brass, hook, [0, 0.16, 0.04], [PI / 2, 0, 0]);
    const inst = shop.instrument(hook, { voice: 'brass', lo: 50, hi: 69, slot: i / 2, wobble: 'swing', amp: 0.5, glow: 0xffd070 });
    shop.cyl(hook, 0.2, 0.12, [0, 0, 0.1], inst, 'hard', [PI / 2, 0, 0]);
  }
}

function buildBells(shop) {
  const m = materials(), R = shop.root, H = ROOM.H;
  const xs = [-2.6, -1.3, 0, 1.3, 2.6];
  xs.forEach((x, i) => {
    const bellY = 4.3 + Math.abs(i - 2) * 0.18;
    const pivot = group(R, [x, H, 0.9]);
    const drop = H - bellY;
    rod(pivot, [0, 0, 0], [0, -drop + 0.12, 0], 0.006, m.rope);
    mesh(cyl(0.018, 0.022, 0.1, 12), m.darkWood, pivot, [0, -drop + 0.08, 0]);
    const bell = mesh(flare(0.16, 0.035, 0.1, 2.2, 32), m.gold, pivot, [0, -drop + 0.03, 0], [PI, 0, 0]);
    bell.material = m.gold.clone();
    bell.material.side = THREE.DoubleSide;
    mesh(new THREE.SphereGeometry(0.02, 10, 8), m.ebony, pivot, [0, -drop - 0.12, 0]);
    const inst = shop.instrument(pivot, { voice: 'bell', lo: 72, hi: 96, slot: i / 4, arp: false, wobble: 'swing', amp: 0.35, glow: 0xfff0a0 });
    shop.sphere(pivot, 0.12, [0, -drop - 0.05, 0], inst);
  });
}

function buildLamps(shop) {
  const m = materials(), R = shop.root, H = ROOM.H;
  const shade = std(0x1f5d4f, 0.5, 0.2, { side: THREE.DoubleSide });
  for (const [x, z] of [[-5, -2], [0, -1.8], [5, -2], [-5, 3.2], [5, 3.2]]) {
    const g = group(R, [x, H, z]);
    rod(g, [0, 0, 0], [0, -0.8, 0], 0.008, m.ebony);
    mesh(new THREE.ConeGeometry(0.28, 0.24, 32, 1, true), shade, g, [0, -0.9, 0]);
    const b = mesh(new THREE.SphereGeometry(0.07, 16, 12), m.bulb, g, [0, -0.98, 0]);
    b.userData.noShadow = true;
    const light = new THREE.PointLight(0xffd29a, 5, 0, 2);
    light.position.set(0, -1.05, 0);
    g.add(light);
    shop.lights.push(light);
  }
}

export function buildShop(shop) {
  buildRoom(shop);
  buildCounter(shop);
  buildMarimba(shop, 0, 2.3);
  buildDrumKit(shop, -3.4, -0.6, 0.35);
  buildPiano(shop, 3.5, -0.2, -0.45);
  buildChimes(shop, 0, -3.3);
  buildTimpani(shop, -6.6, 1.7, 0.46, 0.5);
  buildTimpani(shop, -7.9, 0.2, 0.52, 0);
  buildGong(shop, 6.9, -4.9, -0.35);
  buildOrgan(shop);
  buildGuitars(shop);
  buildStrings(shop);
  buildBrass(shop);
  buildBells(shop);
  buildLamps(shop);
  shop.finalize();
}
