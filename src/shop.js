import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const PI = Math.PI;
const clamp01 = x => Math.min(1, Math.max(0, x));
export const rand = (a, b) => a + Math.random() * (b - a);
export const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

export const ROOM = { W: 20, D: 16, H: 7 };
// The gallery along the back wall.
export const MEZZ = { y: 3.375, front: -6.4 };

// --- textures ------------------------------------------------------------------

export function canvasTex(w, h, draw, repeat = [1, 1]) {
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

// Black and white marble checkerboard, worn and a little grubby, like the tiles of
// a Paris passage.
function floorTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const n = 8, t = w / n;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const dark = (r + c) % 2 === 1;
      const l = dark ? 8 + 4 * hash(r, c) : 52 + 8 * hash(c, r);
      g.fillStyle = `hsl(${dark ? 20 : 36},${dark ? 8 : 22}%,${l}%)`;
      g.fillRect(c * t, r * t, t, t);
      for (let v = 0; v < 3; v++) {
        let x = c * t + t * hash(r * 3 + v, c), y = r * t + t * hash(c * 5 + v, r);
        g.strokeStyle = dark ? 'rgba(200,200,210,0.12)' : 'rgba(90,80,70,0.18)';
        g.lineWidth = 0.6 + hash(v, r + c);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 8; k++) {
          x += (hash(k, v + r) - 0.3) * 24;
          y += (hash(v + c, k) - 0.5) * 24;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    g.strokeStyle = 'rgba(30,22,16,0.55)';
    g.lineWidth = 3;
    for (let k = 0; k <= n; k++) {
      g.beginPath(); g.moveTo(k * t, 0); g.lineTo(k * t, h); g.stroke();
      g.beginPath(); g.moveTo(0, k * t); g.lineTo(w, k * t); g.stroke();
    }
    const grime = g.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75);
    grime.addColorStop(0, 'rgba(60,40,20,0)');
    grime.addColorStop(1, 'rgba(60,40,20,0.3)');
    g.fillStyle = grime;
    g.fillRect(0, 0, w, h);
  }, [8, 6.4]);
}

function planksTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const n = 6, pw = w / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = `hsl(24,35%,${12 + 6 * hash(i, 1)}%)`;
      g.fillRect(i * pw, 0, pw, h);
      for (let k = 0; k < 10; k++) {
        g.strokeStyle = `rgba(0,0,0,${0.1 + 0.15 * hash(i, k)})`;
        g.beginPath();
        const x0 = i * pw + pw * hash(k, i);
        g.moveTo(x0, 0);
        g.bezierCurveTo(x0 + 6, h / 3, x0 - 6, 2 * h / 3, x0 + 3, h);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(i * pw, 0, 3, h);
    }
  }, [8, 1]);
}

// Rough adzed oak for the ceiling beams.
function beamTex() {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#3a2415';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 70; k++) {
      g.strokeStyle = `rgba(${hash(k, 2) > 0.5 ? '15,8,3' : '110,75,45'},${0.15 + 0.2 * hash(k, 3)})`;
      g.lineWidth = 0.5 + 2 * hash(k, 4);
      const y = h * hash(k, 5);
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(w / 3, y + 10 * (hash(k, 6) - 0.5), 2 * w / 3, y - 10 * (hash(k, 7) - 0.5), w, y);
      g.stroke();
    }
    for (let k = 0; k < 6; k++) {
      g.fillStyle = 'rgba(10,5,2,0.5)';
      g.fillRect(w * hash(k, 8), h * hash(k, 9), 30 + 60 * hash(k, 1), 2);
    }
  }, [6, 1]);
}

function damaskTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3a1116';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(200,150,80,0.3)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w / 2, 0);
    g.bezierCurveTo(w / 2 + 50, h / 8, w - 50, h / 2 - 50, w, h / 2);
    g.bezierCurveTo(w - 50, h / 2 + 50, w / 2 + 50, h - h / 8, w / 2, h);
    g.bezierCurveTo(w / 2 - 50, h - h / 8, 50, h / 2 + 50, 0, h / 2);
    g.bezierCurveTo(50, h / 2 - 50, w / 2 - 50, h / 8, w / 2, 0);
    g.stroke();
    g.fillStyle = 'rgba(200,150,80,0.32)';
    const cx = w / 2, cy = h / 2;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx, cy + 24);
      g.bezierCurveTo(cx + s * 34, cy + 6, cx + s * 30, cy - 26, cx + s * 8, cy - 10);
      g.bezierCurveTo(cx + s * 16, cy - 2, cx + s * 6, cy + 10, cx, cy + 24);
      g.fill();
    }
    g.beginPath();
    g.moveTo(cx, cy - 40);
    g.bezierCurveTo(cx + 14, cy - 18, cx + 8, cy + 2, cx, cy + 12);
    g.bezierCurveTo(cx - 8, cy + 2, cx - 14, cy - 18, cx, cy - 40);
    g.fill();
    g.fillRect(cx - 18, cy + 18, 36, 5);
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      g.beginPath();
      g.arc(x, y, 7, 0, PI * 2);
      g.fill();
    }
  }, [12, 4]);
}

function panelTex(base = '#3d2213') {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const pw = w / 2;
    for (let i = 0; i < 2; i++) {
      const x = i * pw + 18, y = 22;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x, y, pw - 36, h - 44);
      g.fillStyle = 'rgba(255,220,170,0.1)';
      g.fillRect(x + 6, y + 6, pw - 48, h - 56);
      g.strokeStyle = 'rgba(226,180,90,0.55)';
      g.lineWidth = 2;
      g.strokeRect(x + 3, y + 3, pw - 42, h - 50);
    }
    for (let k = 0; k < 40; k++) {
      g.strokeStyle = `rgba(20,8,2,${rand(0.05, 0.15)})`;
      g.beginPath();
      const y0 = rand(0, h);
      g.moveTo(0, y0);
      g.bezierCurveTo(w / 3, y0 + rand(-8, 8), 2 * w / 3, y0 + rand(-8, 8), w, y0);
      g.stroke();
    }
  });
}

function streetTex() {
  return canvasTex(512, 768, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#8fa7c2');
    sky.addColorStop(0.45, '#e8d6b6');
    sky.addColorStop(1, '#f2e2c2');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const building = (x0, x1, top) => {
      g.fillStyle = '#5c6a78';
      g.beginPath();
      g.moveTo(x0, top + 70);
      g.lineTo(x0 + 24, top);
      g.lineTo(x1 - 24, top);
      g.lineTo(x1, top + 70);
      g.fill();
      g.fillStyle = '#8a5a44';
      for (let x = x0 + 40; x < x1 - 40; x += 70) g.fillRect(x, top - 30, 16, 32);
      g.fillStyle = '#d8cbb0';
      g.fillRect(x0, top + 70, x1 - x0, h);
      for (let y = top + 100; y < h - 60; y += 92) {
        for (let x = x0 + 22; x < x1 - 30; x += 62) {
          g.fillStyle = '#3d4756';
          g.fillRect(x, y, 26, 56);
          g.fillStyle = '#e9c98a';
          if (hash(x, y) > 0.8) g.fillRect(x + 3, y + 3, 20, 50);
        }
        g.fillStyle = '#1d1f22';
        g.fillRect(x0 + 8, y + 58, x1 - x0 - 16, 4);
        for (let x = x0 + 10; x < x1 - 10; x += 8) g.fillRect(x, y + 48, 2, 12);
      }
    };
    building(-20, 300, 170);
    building(330, 540, 230);
    g.fillStyle = 'rgba(40,30,25,0.9)';
    g.fillRect(440, 480, 6, 288);
    g.beginPath();
    g.arc(443, 470, 16, 0, PI * 2);
    g.fill();
    g.fillStyle = '#ffe2a0';
    g.beginPath();
    g.arc(443, 470, 9, 0, PI * 2);
    g.fill();
    g.fillStyle = '#6d6d6d';
    g.fillRect(0, h - 40, w, 40);
  });
}

// Gilt lettering painted on the inside of the glass, so it reads backwards from here.
function letteringTex(line1, line2) {
  const t = canvasTex(1024, 384, (g, w, h) => {
    g.translate(w, 0);
    g.scale(-1, 1);
    g.textAlign = 'center';
    g.fillStyle = '#e2b858';
    g.strokeStyle = '#5a3a10';
    g.lineWidth = 4;
    g.font = 'bold italic 120px Georgia, serif';
    g.strokeText(line1, w / 2, 150);
    g.fillText(line1, w / 2, 150);
    g.font = 'bold 60px Georgia, serif';
    g.strokeText(line2, w / 2, 260);
    g.fillText(line2, w / 2, 260);
    g.fillRect(w / 2 - 260, 300, 520, 6);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function signTex() {
  const t = canvasTex(4096, 192, (g, w, h) => {
    g.fillStyle = '#15281f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d9b25a';
    g.lineWidth = 6;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#e8c068';
    g.font = 'bold 104px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('MAISON RICOCHET  ✦  INSTRUMENTS DE MUSIQUE  ✦  FONDÉE EN 1889', w / 2, h / 2 + 6);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// --- materials ---------------------------------------------------------------------

export const std = (color, roughness = 0.5, metalness = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
export const gloss = (color, roughness = 0.3, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 1, clearcoatRoughness: 0.08, ...extra });

let M;
export function materials() {
  if (M) return M;
  M = {
    brass: std(0xdcaa48, 0.28, 1),
    gold: std(0xdcb25c, 0.25, 1),
    chrome: std(0xe2ddd0, 0.16, 1),
    copper: std(0xd4784a, 0.3, 1),
    bronze: std(0xc99b3e, 0.36, 1),
    black: gloss(0x0c0c10, 0.15),
    ivory: std(0xf5eedc, 0.35),
    ebony: std(0x141414, 0.35),
    head: std(0xe8d6a8, 0.7),
    darkWood: std(0x3d2213, 0.45),
    walnut: gloss(0x4a2816, 0.35),
    wood: std(0x8b5a32, 0.5),
    lightWood: std(0xc99a62, 0.5),
    red: gloss(0x7d1622, 0.3),
    pearl: gloss(0xf2ead8, 0.25),
    green: gloss(0x1d3a30, 0.35),
    velvet: std(0x6a1320, 1),
    iron: std(0x1d201e, 0.5, 0.6),
    rope: std(0xcbb68a, 0.9),
    hole: std(0x120a05, 1),
    cream: std(0xf1e4c8, 0.6),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdff0ee, roughness: 0.04, transparent: true, opacity: 0.18, depthWrite: false }),
    crystal: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, transparent: true, opacity: 0.6, envMapIntensity: 2.5 }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc870, emissiveIntensity: 4 }),
  };
  M.panel = std(0xffffff, 0.45, 0, { map: panelTex() });
  return M;
}

// --- helpers -------------------------------------------------------------------------

export function mesh(geo, mat, parent, pos = [0, 0, 0], rot) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  parent.add(m);
  return m;
}

export function group(parent, pos = [0, 0, 0], rot) {
  const g = new THREE.Group();
  g.position.set(...pos);
  if (rot) g.rotation.set(...rot);
  parent.add(g);
  return g;
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const rbox = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 3, r);
export const cyl = (rt, rb, h, s = 24, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);

// A cylinder between two points, for rods, stands and cords.
export function rod(parent, a, b, r, mat) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = mesh(cyl(r, r, len, 10), mat, parent);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
  return m;
}

export function flare(len, r0, rb, power = 3.2, seg = 40) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    pts.push(new THREE.Vector2(r0 + (rb - r0) * Math.pow(t, power), t * len));
  }
  pts.push(new THREE.Vector2(rb * 1.05, len - 0.004));
  return new THREE.LatheGeometry(pts, seg);
}

export function doubleSided(m) {
  m.material = m.material.clone();
  m.material.side = THREE.DoubleSide;
  return m;
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
      node, voice: null, lo: 60, hi: 84, slot: 0.5, arp: true, musical: true, gliss: 1,
      wobble: 'jiggle', amp: 1, hits: 0, last: 0, flash: 0, wob: 0, phase: 0, mats: [],
      glow: new THREE.Color(0xffc86a), ...spec,
    };
    if (typeof inst.glow === 'number') inst.glow = new THREE.Color(inst.glow);
    inst.base = { rot: node.rotation.clone(), scale: node.scale.clone(), pos: node.position.clone() };
    if (inst.musical) {
      node.traverse(o => {
        if (o.isMesh && !o.userData.noFlash && !Array.isArray(o.material) && o.material.emissive) {
          o.material = o.material.clone();
          inst.mats.push(o.material);
        }
      });
    }
    this.instruments.push(inst);
    return inst;
  }

  // Shared by every surface that is not an instrument: balls bounce off it in silence.
  silent() {
    this.silentInst ??= this.instrument(new THREE.Object3D(), { musical: false, wobble: 'none' });
    return this.silentInst;
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

function buildRoom(shop) {
  const m = materials(), R = shop.root, { W, D, H } = ROOM, silent = shop.silent();
  mesh(new THREE.PlaneGeometry(W, D), std(0xffffff, 0.22, 0, { map: floorTex() }), R, [0, 0, 0], [-PI / 2, 0, 0]);
  shop.box(R, [W + 4, 1, D + 4], [0, -0.5, 0], silent, 'floor');

  const wallMat = std(0xffffff, 0.85, 0, { map: damaskTex() });
  const walls = [
    { size: [W, H], pos: [0, H / 2, -D / 2], rot: [0, 0, 0] },
    { size: [D, H], pos: [-W / 2, H / 2, 0], rot: [0, PI / 2, 0] },
    { size: [D, H], pos: [W / 2, H / 2, 0], rot: [0, -PI / 2, 0] },
    { size: [W, H], pos: [0, H / 2, D / 2], rot: [0, PI, 0] },
  ];
  for (const w of walls) {
    const g = group(R, w.pos, w.rot);
    mesh(new THREE.PlaneGeometry(...w.size), wallMat, g);
    const tex = panelTex();
    tex.repeat.set(w.size[0] / 2, 1);
    mesh(box(w.size[0], 1.2, 0.06), std(0xffffff, 0.4, 0, { map: tex }), g, [0, -H / 2 + 0.6, 0.03]);
    mesh(box(w.size[0], 0.06, 0.12), m.walnut, g, [0, -H / 2 + 1.22, 0.06]);
    mesh(box(w.size[0], 0.02, 0.13), m.gold, g, [0, -H / 2 + 1.19, 0.06]);
    mesh(box(w.size[0], 0.16, 0.08), m.walnut, g, [0, -H / 2 + 0.08, 0.05]);
    mesh(box(w.size[0], 0.3, 0.16), m.walnut, g, [0, H / 2 - 0.15, 0.08]);
    shop.box(g, [w.size[0] + 2, H + 2, 1], [0, 0, -0.5], silent, 'wall');
  }

  const ceil = mesh(new THREE.PlaneGeometry(W, D), std(0xffffff, 0.8, 0, { map: planksTex() }), R, [0, H, 0], [PI / 2, 0, 0]);
  ceil.userData.noShadow = true;
  const beam = std(0xffffff, 0.75, 0, { map: beamTex() });
  for (let z = -5.6; z < D / 2; z += 1.9) mesh(box(W, 0.34, 0.3), beam, R, [0, H - 0.17, z]);
  for (const x of [-4.2, 4.2]) mesh(box(0.38, 0.44, D), beam, R, [x, H - 0.22, 0]);
  shop.box(R, [W + 4, 1, D + 4], [0, H + 0.5, 0], silent, 'wall');
}

function archShape(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.absarc(0, h, w / 2, 0, PI, false);
  s.lineTo(-w / 2, 0);
  return s;
}

let streetMat;
function buildWindow(shop, z, line1, line2) {
  const m = materials();
  const w = 2.4, h = 3.0, top = h + w / 2;
  const g = group(shop.root, [-9.92, 0.95, z], [0, PI / 2, 0]);
  const outer = archShape(w + 0.36, h);
  outer.holes.push(archShape(w, h));
  mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.14, bevelEnabled: false, curveSegments: 32 }), m.walnut, g);

  // Brighter than white so daylight outside blooms against the dim shop.
  streetMat ??= new THREE.MeshBasicMaterial({ map: streetTex(), color: new THREE.Color(2.2, 2.2, 2.3), fog: false });
  const paneGeo = new THREE.ShapeGeometry(archShape(w, h), 32);
  const pos = paneGeo.attributes.position, uv = paneGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, pos.getY(i) / top);
  const pane = mesh(paneGeo, streetMat, g, [0, 0, 0.01]);
  pane.userData.noShadow = true;
  const letters = mesh(
    new THREE.PlaneGeometry(w * 0.92, w * 0.92 * 384 / 1024),
    new THREE.MeshStandardMaterial({ map: letteringTex(line1, line2), transparent: true, metalness: 0.6, roughness: 0.3 }),
    g, [0, 2.2, 0.04],
  );
  letters.userData.noShadow = true;

  mesh(box(0.05, top, 0.08), m.brass, g, [0, top / 2, 0.07]);
  mesh(box(w, 0.05, 0.08), m.brass, g, [0, h, 0.07]);
  mesh(box(w, 0.05, 0.08), m.brass, g, [0, 0.9, 0.07]);
  for (const a of [PI / 4, 3 * PI / 4]) rod(g, [0, h, 0.07], [Math.cos(a) * w / 2, h + Math.sin(a) * w / 2, 0.07], 0.022, m.brass);
  mesh(rbox(w + 0.6, 0.08, 0.32, 0.02), m.walnut, g, [0, 0, 0.14]);

  rod(g, [-w / 2 - 0.7, top + 0.25, 0.2], [w / 2 + 0.7, top + 0.25, 0.2], 0.025, m.brass);
  for (const s of [-1, 1]) {
    mesh(box(0.42, top + 0.95, 0.08), m.velvet, g, [s * (w / 2 + 0.38), (top + 0.95) / 2 - 0.95, 0.22]);
    mesh(cyl(0.03, 0.03, 0.46, 8), m.gold, g, [s * (w / 2 + 0.38), 1.1, 0.27], [0, 0, PI / 2]);
  }
}

function buildMezzanine(shop) {
  const m = materials(), R = shop.root, silent = shop.silent();
  const { y, front } = MEZZ;
  const depth = ROOM.D / 2 + front, zc = (-ROOM.D / 2 + front) / 2;
  mesh(box(ROOM.W, 0.25, depth), m.walnut, R, [0, y - 0.125, zc]);
  mesh(box(ROOM.W, 0.5, 0.1), m.green, R, [0, y - 0.2, front + 0.05]);
  for (const dy of [0.04, -0.45]) mesh(box(ROOM.W, 0.03, 0.12), m.gold, R, [0, y + dy, front + 0.05]);
  const sign = mesh(new THREE.PlaneGeometry(8.5, 0.4), std(0xffffff, 0.4, 0.3, { map: signTex() }), R, [0, y - 0.2, front + 0.102]);
  sign.userData.noShadow = true;
  shop.box(R, [ROOM.W, 0.5, depth + 0.1], [0, y - 0.2, zc], silent);

  for (const x of [-6.6, -2.8, 2.8, 6.6]) {
    const h = y - 0.45;
    mesh(cyl(0.07, 0.09, h, 16), m.iron, R, [x, h / 2, front + 0.12]);
    mesh(rbox(0.28, 0.14, 0.28, 0.02), m.iron, R, [x, 0.07, front + 0.12]);
    mesh(cyl(0.16, 0.07, 0.22, 16), m.gold, R, [x, h - 0.11, front + 0.12]);
    shop.cyl(R, 0.1, h, [x, h / 2, front + 0.12], silent);
  }

  const ry = y + 0.95, rz = front + 0.06;
  mesh(cyl(0.035, 0.035, ROOM.W, 12), m.brass, R, [0, ry, rz], [0, 0, PI / 2]);
  mesh(box(ROOM.W, 0.04, 0.04), m.iron, R, [0, y + 0.1, rz]);
  const n = Math.floor(ROOM.W / 0.14);
  const bars = new THREE.InstancedMesh(cyl(0.011, 0.011, 0.85, 6), m.iron, n);
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    d.position.set(-ROOM.W / 2 + 0.07 + i * 0.14, y + 0.52, rz);
    d.updateMatrix();
    bars.setMatrixAt(i, d.matrix);
  }
  R.add(bars);
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(0.2, 0.014, 8, 32), m.gold, 10);
  for (let i = 0; i < 10; i++) {
    d.position.set(-9 + i * 2, y + 0.52, rz);
    d.updateMatrix();
    rings.setMatrixAt(i, d.matrix);
  }
  R.add(rings);
  shop.box(R, [ROOM.W, 0.95, 0.06], [0, y + 0.5, rz], silent);
}

function shelfUnit(shop, x0, x1) {
  const m = materials(), R = shop.root, silent = shop.silent();
  const z = -7.75, d = 0.45, cx = (x0 + x1) / 2, w = x1 - x0;
  mesh(box(w, 3.0, 0.03), m.walnut, R, [cx, 1.5, -7.97]);
  mesh(box(w, 0.9, d), m.panel, R, [cx, 0.45, z]);
  shop.box(R, [w, 0.9, d], [cx, 0.45, z], silent);
  for (const y of [0.9, 1.75, 2.6]) {
    mesh(box(w, 0.05, d), m.walnut, R, [cx, y, z]);
    mesh(box(w, 0.02, 0.01), m.gold, R, [cx, y, z + d / 2]);
    shop.box(R, [w, 0.05, d], [cx, y, z], silent);
  }
  for (const x of [x0, cx, x1]) {
    mesh(box(0.06, 3.0, d), m.walnut, R, [x, 1.5, z]);
    shop.box(R, [0.06, 3.0, d], [x, 1.5, z], silent);
  }
}

function buildCounter(shop) {
  const m = materials(), R = shop.root;
  const g = group(R, [0, 0, 5.3]);
  const front = panelTex();
  front.repeat.set(4, 1);
  mesh(box(7.2, 0.95, 0.7), std(0xffffff, 0.4, 0, { map: front }), g, [0, 0.475, 0]);
  mesh(rbox(7.4, 0.06, 0.84, 0.02), m.walnut, g, [0, 0.98, 0]);
  mesh(box(7.4, 0.02, 0.02), m.brass, g, [0, 1.0, 0.42]);
  mesh(box(7.3, 0.03, 0.02), m.gold, g, [0, 0.9, 0.36]);
  shop.box(g, [7.4, 1.02, 0.84], [0, 0.5, 0], shop.silent());

  // A metronome that swings in time with the shop's pulse.
  const met = group(g, [-2.0, 1.01, -0.1], [0, 0.4, 0]);
  mesh(new THREE.CylinderGeometry(0.02, 0.09, 0.26, 4), m.walnut, met, [0, 0.13, 0], [0, PI / 4, 0]);
  shop.metronome = group(met, [0, 0.03, 0.066]);
  mesh(box(0.008, 0.22, 0.008), m.brass, shop.metronome, [0, 0.11, 0]);
  mesh(box(0.03, 0.02, 0.012), m.brass, shop.metronome, [0, 0.16, 0]);
  shop.box(met, [0.16, 0.26, 0.16], [0, 0.13, 0], shop.silent());

  // A brass cash register, silent apart from the balls rattling off it.
  const reg = group(g, [3.3, 1.01, -0.1], [0, -0.35, 0]);
  mesh(rbox(0.46, 0.3, 0.38, 0.03), m.brass, reg, [0, 0.15, 0]);
  mesh(rbox(0.34, 0.14, 0.03, 0.01), m.brass, reg, [0, 0.36, -0.08]);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    mesh(cyl(0.015, 0.015, 0.02, 10), m.ivory, reg, [-0.15 + c * 0.06, 0.24 + r * 0.03, 0.14 + r * 0.03], [PI / 2 - 0.5, 0, 0]);
  }
  shop.box(reg, [0.46, 0.44, 0.38], [0, 0.22, 0], shop.silent());
}

// --- floor instruments -------------------------------------------------------------------

function buildMarimba(shop, x, z, ry = 0) {
  const m = materials(), R = shop.root;
  const g = group(R, [x, 0, z], [0, ry, 0]);
  const n = 13, span = 2.7;
  for (const s of [-1, 1]) mesh(box(span + 0.3, 0.07, 0.07), m.walnut, g, [0, 0.86, s * 0.3]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(cyl(0.03, 0.035, 0.86, 12), m.walnut, g, [sx * (span / 2 + 0.1), 0.43, sz * 0.3]);
  for (const sx of [-1, 1]) mesh(box(0.06, 0.06, 0.66), m.walnut, g, [sx * (span / 2 + 0.1), 0.2, 0]);
  mesh(box(span + 0.2, 0.05, 0.05), m.walnut, g, [0, 0.2, 0]);
  for (let i = 0; i < n; i++) {
    const bx = -span / 2 + (i + 0.5) * span / n;
    const len = 0.6 - 0.26 * i / (n - 1);
    const color = new THREE.Color().setHSL(0.03 + 0.025 * hash(i, 3), 0.55, 0.3 + 0.06 * hash(i, 5));
    const bar = mesh(rbox(0.17, 0.045, len, 0.015), gloss(color, 0.4), g, [bx, 0.92, 0]);
    const tube = 0.5 - 0.3 * i / (n - 1);
    mesh(cyl(0.045, 0.045, tube, 16), m.brass, g, [bx, 0.84 - tube / 2, 0]);
    const inst = shop.instrument(bar, { voice: 'mallet', lo: 57, hi: 88, slot: i / (n - 1), arp: false, ostinato: true, wobble: 'bob', glow: 0xffb070 });
    shop.box(bar, [0.17, 0.06, len], [0, 0, 0], inst);
  }
}

export function tripod(parent, x, z, top, mat) {
  rod(parent, [x, 0.25, z], [x, top, z], 0.012, mat);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * PI * 2 + 0.5;
    rod(parent, [x, 0.3, z], [x + Math.cos(a) * 0.25, 0.01, z + Math.sin(a) * 0.25], 0.01, mat);
  }
}

function pianoShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.75, 0);
  shape.lineTo(0.75, 0);
  shape.lineTo(0.75, 0.8);
  shape.bezierCurveTo(0.75, 1.3, 0.1, 1.2, 0.0, 1.7);
  shape.bezierCurveTo(-0.1, 2.05, -0.5, 2.05, -0.75, 1.95);
  shape.lineTo(-0.75, 0);
  return shape;
}

export function keyboard(parent, width, y, z, whites, naturals, sharps) {
  const m = materials();
  const kw = width / whites;
  const white = new THREE.InstancedMesh(box(kw * 0.92, 0.025, 0.15), naturals ?? m.ivory, whites);
  const blackIdx = [];
  const d = new THREE.Object3D();
  for (let i = 0; i < whites; i++) {
    d.position.set(-width / 2 + (i + 0.5) * kw, y, z);
    d.updateMatrix();
    white.setMatrixAt(i, d.matrix);
    if ([0, 1, 3, 4, 5].includes(i % 7) && i < whites - 1) blackIdx.push(i);
  }
  parent.add(white);
  const blacks = new THREE.InstancedMesh(box(kw * 0.55, 0.03, 0.09), sharps ?? m.ebony, blackIdx.length);
  blackIdx.forEach((i, k) => {
    d.position.set(-width / 2 + (i + 1) * kw, y + 0.02, z - 0.04);
    d.updateMatrix();
    blacks.setMatrixAt(k, d.matrix);
  });
  parent.add(blacks);
}

function buildPiano(shop, x, z, ry) {
  const m = materials(), R = shop.root;
  const g = group(R, [x, 0, z], [0, ry, 0]);
  const shape = pianoShape();
  const caseGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 });
  mesh(caseGeo, m.black, g, [0, 0.7, 0], [-PI / 2, 0, 0]);
  const pm = mesh(new THREE.ShapeGeometry(shape, 24), m.gold, g, [0, 1.035, -0.08], [-PI / 2, 0, 0]);
  pm.scale.set(0.9, 0.92, 1);
  for (let i = 0; i < 18; i++) {
    const sx = -0.62 + i * 0.07;
    const len = i < 10 ? 1.7 - i * 0.02 : 1.5 - (i - 10) * 0.13;
    mesh(box(0.004, 0.004, len), m.chrome, g, [sx, 1.045, -0.15 - len / 2]).userData.noShadow = true;
  }
  mesh(box(1.5, 0.12, 0.3), m.black, g, [0, 0.78, 0.12]);
  keyboard(g, 1.36, 0.85, 0.18, 36);
  for (const s of [-1, 1]) mesh(box(0.07, 0.1, 0.3), m.black, g, [s * 0.715, 0.88, 0.12]);
  mesh(box(0.7, 0.28, 0.02), m.black, g, [0, 1.2, -0.28], [-0.25, 0, 0]);
  for (const [lx, lz] of [[-0.62, -0.12], [0.62, -0.12], [-0.5, -1.8]]) {
    mesh(cyl(0.07, 0.05, 0.7, 16), m.black, g, [lx, 0.35, lz]);
    mesh(new THREE.SphereGeometry(0.04, 12, 8), m.brass, g, [lx, 0.03, lz]);
  }
  mesh(box(0.14, 0.4, 0.04), m.black, g, [0, 0.35, -0.35]);
  for (const px of [-0.04, 0, 0.04]) mesh(box(0.025, 0.012, 0.09), m.brass, g, [px, 0.06, -0.3]);

  const pianoInst = shop.instrument(g, {
    voice: 'piano', lo: 45, hi: 88, arp: false, ostinato: true, wobble: 'none', glow: 0xffe2a0,
    slotFrom: p => clamp01((g.worldToLocal(p).x + 0.75) / 1.5),
  });
  shop.box(g, [1.5, 0.34, 1.1], [0, 0.87, -0.55], pianoInst);
  shop.box(g, [1.1, 0.34, 0.9], [-0.15, 0.87, -1.5], pianoInst);
  shop.box(g, [1.5, 0.14, 0.32], [0, 0.82, 0.13], pianoInst);

  const lid = group(g, [-0.75, 1.04, 0], [0, 0, 0.65]);
  mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false, curveSegments: 24 }), m.black, lid, [0.75, 0, 0], [-PI / 2, 0, 0]);
  rod(g, [0.35, 1.04, -0.8], [0.35, 1.04 + 0.84, -0.8], 0.012, m.black);
  const lidInst = shop.instrument(lid, {
    voice: 'piano', lo: 57, hi: 93, arp: false, ostinato: true, wobble: 'flap', glow: 0xffe2a0,
    slotFrom: p => clamp01(lid.worldToLocal(p).x / 1.5),
  });
  shop.box(lid, [1.5, 0.07, 1.9], [0.75, 0.01, -0.95], lidInst);

  const bench = group(g, [0, 0, 0.75]);
  mesh(rbox(0.9, 0.08, 0.36, 0.02), m.velvet, bench, [0, 0.5, 0]);
  for (const sx of [-0.4, 0.4]) for (const sz of [-0.14, 0.14]) mesh(cyl(0.025, 0.02, 0.46, 10), m.black, bench, [sx, 0.23, sz]);
  shop.box(bench, [0.9, 0.1, 0.36], [0, 0.5, 0], shop.silent());
}

function harpsichordShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.45, 0);
  s.lineTo(0.45, 0);
  s.lineTo(0.45, 0.3);
  s.bezierCurveTo(0.45, 1.1, -0.05, 1.6, -0.25, 2.3);
  s.lineTo(-0.45, 2.3);
  s.lineTo(-0.45, 0);
  return s;
}

// Maps a shape's own coordinates onto 0..1 texture space, for painted surfaces.
function fitUVs(geo, [x0, x1], [y0, y1]) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x0) / (x1 - x0), (pos.getY(i) - y0) / (y1 - y0));
  return geo;
}

function pastoralTex() {
  const t = canvasTex(256, 640, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#8fb0c8');
    sky.addColorStop(0.6, '#f0dcb0');
    sky.addColorStop(1, '#d8c090');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.ellipse(40 + (k * 53) % 200, 60 + k * 50, 36, 12, 0, 0, PI * 2);
      g.fill();
    }
    g.fillStyle = '#5d7040';
    g.beginPath();
    g.moveTo(0, h * 0.72);
    g.bezierCurveTo(w * 0.3, h * 0.66, w * 0.6, h * 0.76, w, h * 0.7);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    g.fillStyle = '#34462a';
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      g.arc(20 + k * 38, h * 0.7 - 10 - (k % 3) * 12, 18 + (k % 2) * 8, 0, PI * 2);
      g.fill();
    }
    g.strokeStyle = '#c9a050';
    g.lineWidth = 10;
    g.strokeRect(5, 5, w - 10, h - 10);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function soundboardTex() {
  const t = canvasTex(256, 640, (g, w, h) => {
    g.fillStyle = '#e8d8b0';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) {
      g.fillStyle = ['#b8403a', '#3a6aa0', '#d8a030', '#5a8a4a'][k % 4];
      g.beginPath();
      g.arc(hash(k, 1) * w, hash(k, 2) * h, 4 + 4 * hash(k, 3), 0, PI * 2);
      g.fill();
    }
    g.strokeStyle = '#b08a3a';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(w * 0.6, h * 0.35, 28, 0, PI * 2);
    g.stroke();
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// A French double-manual harpsichord: painted case, reversed keyboards and a
// landscape inside the lid, on a gilded stand.
function buildHarpsichord(shop, x, z, ry) {
  const m = materials(), R = shop.root;
  const g = group(R, [x, 0, z], [0, ry, 0]);
  const shape = harpsichordShape();
  const paint = gloss(0x24483a, 0.35);
  mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 24 }), paint, g, [0, 0.74, 0], [-PI / 2, 0, 0]);
  const band = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false, curveSegments: 24 }), m.gold, g, [0, 0.95, 0], [-PI / 2, 0, 0]);
  band.scale.set(1.012, 1.004, 1);
  const board = new THREE.ShapeGeometry(shape, 24);
  fitUVs(board, [-0.45, 0.45], [0, 2.3]);
  const sb = mesh(board, std(0xffffff, 0.6, 0, { map: soundboardTex() }), g, [0, 1.005, -0.12], [-PI / 2, 0, 0]);
  sb.scale.set(0.9, 0.93, 1);
  for (let i = 0; i < 14; i++) {
    const sx = -0.38 + i * 0.058;
    const len = Math.max(0.3, 2.0 - i * 0.13);
    mesh(box(0.003, 0.003, len), m.brass, g, [sx, 1.012, -0.2 - len / 2]).userData.noShadow = true;
  }
  mesh(box(0.9, 0.1, 0.3), paint, g, [0, 0.82, 0.12]);
  keyboard(g, 0.78, 0.88, 0.2, 28, m.ebony, m.ivory);
  keyboard(g, 0.78, 0.95, 0.1, 28, m.ebony, m.ivory);
  for (const s of [-1, 1]) mesh(box(0.06, 0.12, 0.3), paint, g, [s * 0.42, 0.9, 0.12]);
  for (const [lx, lz] of [[-0.38, 0.05], [0.38, 0.05], [0.38, -0.85], [-0.38, -0.85], [-0.38, -2.05], [-0.1, -1.75]]) {
    mesh(cyl(0.035, 0.025, 0.66, 12), m.gold, g, [lx, 0.37, lz]);
    mesh(new THREE.SphereGeometry(0.05, 12, 8), m.gold, g, [lx, 0.5, lz]);
  }
  mesh(box(0.8, 0.04, 0.04), m.gold, g, [0, 0.12, -0.4]);

  const inst = shop.instrument(g, {
    voice: 'harpsichord', lo: 45, hi: 81, arp: false, ostinato: true, wobble: 'none', glow: 0xffe2a0,
    slotFrom: p => clamp01((g.worldToLocal(p).x + 0.45) / 0.9),
  });
  shop.box(g, [0.9, 0.3, 1.2], [0, 0.87, -0.6], inst);
  shop.box(g, [0.5, 0.3, 1.1], [-0.2, 0.87, -1.75], inst);
  shop.box(g, [0.9, 0.16, 0.32], [0, 0.86, 0.13], inst);

  // The lid is hinged along the straight side and painted inside with a landscape.
  const lid = group(g, [-0.45, 1.005, 0], [0, 0, 0.75]);
  mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false, curveSegments: 24 }), paint, lid, [0.45, 0, 0], [-PI / 2, 0, 0]);
  const art = fitUVs(new THREE.ShapeGeometry(shape, 24), [-0.45, 0.45], [0, 2.3]);
  mesh(art, std(0xffffff, 0.7, 0, { map: pastoralTex(), side: THREE.DoubleSide }), lid, [0.45, -0.003, 0], [-PI / 2, 0, 0]).scale.set(0.94, 0.96, 1);
  rod(g, [0.2, 1.0, -0.8], [0.2, 1.0 + 0.58, -0.8], 0.01, m.gold);
  const lidInst = shop.instrument(lid, {
    voice: 'harpsichord', lo: 57, hi: 88, arp: false, ostinato: true, wobble: 'flap', glow: 0xffe2a0,
    slotFrom: p => clamp01(lid.worldToLocal(p).x / 0.9),
  });
  shop.box(lid, [0.9, 0.06, 2.2], [0.45, 0.01, -1.1], lidInst);

  const stool = group(g, [0, 0, 0.72]);
  mesh(rbox(0.5, 0.07, 0.34, 0.02), m.velvet, stool, [0, 0.5, 0]);
  for (const sx of [-0.2, 0.2]) for (const sz of [-0.13, 0.13]) mesh(cyl(0.02, 0.016, 0.47, 10), m.gold, stool, [sx, 0.24, sz]);
  shop.box(stool, [0.5, 0.1, 0.34], [0, 0.5, 0], shop.silent());
}

function buildCafeChair(shop, x, z, ry) {
  const m = materials();
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  mesh(cyl(0.21, 0.21, 0.035, 32), m.walnut, g, [0, 0.46, 0]);
  mesh(new THREE.TorusGeometry(0.21, 0.018, 8, 32), m.walnut, g, [0, 0.46, 0], [PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * PI * 2 + PI / 4;
    rod(g, [Math.cos(a) * 0.17, 0.45, Math.sin(a) * 0.17], [Math.cos(a) * 0.23, 0, Math.sin(a) * 0.23], 0.016, m.walnut);
  }
  mesh(new THREE.TorusGeometry(0.19, 0.012, 8, 32), m.walnut, g, [0, 0.2, 0], [PI / 2, 0, 0]);
  mesh(new THREE.TorusGeometry(0.17, 0.016, 8, 24, PI), m.walnut, g, [0, 0.82, -0.18]);
  for (const s of [-1, 1]) rod(g, [s * 0.17, 0.82, -0.18], [s * 0.15, 0.46, -0.19], 0.016, m.walnut);
  shop.box(g, [0.44, 0.06, 0.44], [0, 0.46, 0], shop.silent());
  return g;
}

// --- strings -----------------------------------------------------------------------------

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
export function makeStringed(color, { w1 = 0.19, w2 = 0.15, L = 0.5, d = 0.1, neck = 0.46, head = 0.17, strings = 6, bowed = false }) {
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

// A cello or bass standing on its endpin; the node origin is on the floor.
function standingString(shop, x, y, z, ry, color, dims, spec) {
  const m = materials();
  const stand = group(shop.root, [x, y, z], [0, ry, -0.08]);
  const { g, bodyY } = makeStringed(color, { ...dims, bowed: true });
  const topY = 0.25 - (bodyY - dims.L / 2);
  g.position.y = topY;
  stand.add(g);
  rod(stand, [0, 0, 0], [0, 0.26, 0], 0.006, m.chrome);
  const inst = shop.instrument(stand, { wobble: 'rock', glow: 0xffa060, ...spec });
  shop.box(stand, [dims.w1 * 2 + 0.05, dims.L + 0.04, dims.d + 0.06], [0, topY + bodyY, 0], inst);
  shop.box(stand, [0.08, dims.neck + dims.head, 0.08], [0, topY - (dims.neck + dims.head) / 2, 0], inst);
}

const GUITAR_COLORS = [0xc98a3c, 0x8a3a1c, 0x2f4a3a, 0xd9b27c, 0x5a1d24, 0x1d1d1d];

function buildGuitars(shop) {
  const m = materials(), R = shop.root;
  const xs = [-9.0, -7.6, -6.2, 6.2, 7.6, 9.0];
  xs.forEach((x, i) => {
    const hook = group(R, [x, 6.3, -7.45], [0, 0, rand(-0.06, 0.06)]);
    mesh(cyl(0.012, 0.012, 0.1, 8), m.brass, hook, [0, 0.03, -0.05], [PI / 2, 0, 0]);
    const { g, bodyY } = makeStringed(GUITAR_COLORS[i], {});
    hook.add(g);
    const inst = shop.instrument(hook, { voice: 'pluck', lo: 40, hi: 67, slot: i / 5, wobble: 'swing', amp: 0.35, glow: 0xffc070 });
    shop.box(hook, [0.42, 0.52, 0.16], [0, bodyY, 0], inst);
    shop.box(hook, [0.08, 0.62, 0.06], [0, -0.4, 0], inst);
  });
}

function buildViolins(shop) {
  const violins = [[-1.35, 3.1], [-0.6, 3.6], [0.15, 3.1], [-0.6, 4.4]];
  violins.forEach(([z, y], i) => {
    const hook = group(shop.root, [-9.9, y + 0.3, z], [0, PI / 2, rand(-0.08, 0.08)]);
    const { g, bodyY } = makeStringed(0xb65a1f, { w1: 0.1, w2: 0.085, L: 0.36, d: 0.06, neck: 0.22, head: 0.09, strings: 4, bowed: true });
    g.position.z = 0.08;
    hook.add(g);
    const inst = shop.instrument(hook, { voice: 'pluck', lo: 67, hi: 88, slot: i / 3, wobble: 'swing', amp: 0.4, glow: 0xffa060 });
    shop.box(hook, [0.24, 0.4, 0.1], [0, bodyY, 0.08], inst);
  });
}

function buildHarp(shop, x, z, ry) {
  const m = materials();
  const g = group(shop.root, [x, MEZZ.y, z], [0, ry, 0]);
  const frame = gloss(0x8a4a1c, 0.3);
  mesh(rbox(0.55, 0.1, 0.32, 0.02), m.gold, g, [0.32, 0.05, 0]);
  mesh(cyl(0.035, 0.045, 1.6, 16), m.gold, g, [0, 0.9, 0]);
  mesh(new THREE.SphereGeometry(0.07, 16, 12), m.gold, g, [0, 1.74, 0]);
  mesh(new THREE.ConeGeometry(0.06, 0.12, 16), m.gold, g, [0, 1.85, 0]);
  const A = new THREE.Vector2(0.1, 0.12), B = new THREE.Vector2(0.8, 1.44);
  const len = A.distanceTo(B);
  mesh(cyl(0.04, 0.12, len, 12), frame, g, [(A.x + B.x) / 2, (A.y + B.y) / 2, 0], [0, 0, -Math.atan2(B.x - A.x, B.y - A.y)]);
  const neck = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.7, 0), new THREE.Vector3(0.25, 1.56, 0), new THREE.Vector3(0.52, 1.62, 0), new THREE.Vector3(0.82, 1.46, 0),
  ]);
  mesh(new THREE.TubeGeometry(neck, 32, 0.032, 8), frame, g);
  const samples = neck.getPoints(80);
  const neckY = sx => samples.reduce((a, b) => (Math.abs(b.x - sx) < Math.abs(a.x - sx) ? b : a)).y;
  for (let k = 0; k < 22; k++) {
    const t = 0.03 + k / 21 * 0.9;
    const sx = A.x + (B.x - A.x) * t, sy = A.y + (B.y - A.y) * t;
    const top = neckY(sx) - 0.02;
    mesh(box(0.003, top - sy, 0.003), k % 7 === 0 ? m.red : m.chrome, g, [sx, (top + sy) / 2, 0]).userData.noShadow = true;
  }
  const inst = shop.instrument(g, {
    voice: 'harp', lo: 43, hi: 91, arp: false, gliss: 4, wobble: 'rock', amp: 0.4, glow: 0xffe0a0,
    slotFrom: p => clamp01((g.worldToLocal(p).x - 0.05) / 0.75),
  });
  shop.box(g, [0.95, 1.75, 0.16], [0.4, 0.92, 0], inst);
}

function buildUpright(shop, x, y, z, ry = 0) {
  const m = materials();
  const g = group(shop.root, [x, y, z], [0, ry, 0]);
  const wood = gloss(0x4a2414, 0.28);
  mesh(rbox(1.5, 1.3, 0.45, 0.03), wood, g, [0, 0.65, -0.05]);
  mesh(box(1.52, 0.05, 0.5), wood, g, [0, 1.32, -0.05]);
  mesh(box(1.5, 0.08, 0.26), wood, g, [0, 0.72, 0.28]);
  keyboard(g, 1.3, 0.78, 0.3, 30);
  mesh(box(1.3, 0.3, 0.02), m.panel, g, [0, 1.05, 0.18]);
  for (const s of [-1, 1]) {
    mesh(box(0.08, 0.72, 0.08), wood, g, [s * 0.7, 0.36, 0.33]);
    mesh(new THREE.SphereGeometry(0.035, 10, 8), m.gold, g, [s * 0.55, 1.1, 0.23]);
    mesh(cyl(0.012, 0.012, 0.1, 8), m.ivory, g, [s * 0.55, 1.18, 0.23]);
    const flame = mesh(new THREE.SphereGeometry(0.012, 8, 6), m.bulb, g, [s * 0.55, 1.24, 0.23]);
    flame.userData.noFlash = true;
    flame.userData.noShadow = true;
  }
  const inst = shop.instrument(g, {
    voice: 'piano', lo: 48, hi: 84, arp: false, ostinato: true, wobble: 'none', glow: 0xffe2a0,
    slotFrom: p => clamp01((g.worldToLocal(p).x + 0.75) / 1.5),
  });
  shop.box(g, [1.5, 1.35, 0.7], [0, 0.67, 0.05], inst);
}

// --- brass -------------------------------------------------------------------------------

// Open cabinetry along the right wall, stocked with hand percussion.
function buildCabinet(shop) {
  const m = materials(), R = shop.root, silent = shop.silent();
  const x = 9.68, d = 0.6, z0 = -6.2, z1 = 3.8, zc = (z0 + z1) / 2, len = z1 - z0;
  mesh(box(0.03, 4.3, len), m.walnut, R, [9.97, 2.15, zc]);
  mesh(box(d, 1.0, len), m.panel, R, [x, 0.5, zc]);
  shop.box(R, [d, 1.0, len], [x, 0.5, zc], silent);
  for (const y of [2.1, 3.2]) {
    mesh(box(d, 0.05, len), m.walnut, R, [x, y, zc]);
    mesh(box(0.01, 0.02, len), m.gold, R, [x - d / 2, y, zc]);
    shop.box(R, [d, 0.05, len], [x, y, zc], silent);
  }
  mesh(rbox(d + 0.12, 0.14, len + 0.12, 0.03), m.walnut, R, [x, 4.35, zc]);
  mesh(box(0.01, 0.03, len + 0.1), m.gold, R, [x - d / 2 - 0.065, 4.3, zc]);
  shop.box(R, [d + 0.12, 0.14, len + 0.12], [x, 4.35, zc], silent);
  for (const z of [z0, -2.9, 0.5, z1]) {
    mesh(box(d, 3.3, 0.06), m.walnut, R, [x, 2.65, z]);
    shop.box(R, [d, 3.3, 0.06], [x, 2.65, z], silent);
  }
}

// --- shelves under the gallery -------------------------------------------------------------

function buildShelfInstruments(shop, x0, x1, flip) {
  const m = materials(), R = shop.root, z = -7.75;
  const at = t => x0 + (x1 - x0) * (flip ? 1 - t : t);
  [0.3, 0.7].forEach((t, i) => {
    const g = group(R, [at(t), 1.775 + 0.62, z + 0.05], [0, 0, 0.12 * (i ? -1 : 1)]);
    const { g: body, bodyY } = makeStringed(i ? 0x8a3a1c : 0xc98a3c, { w1: 0.11, w2: 0.075, L: 0.3, d: 0.08, neck: 0.2, head: 0.08, strings: 8 });
    g.add(body);
    const inst = shop.instrument(g, { voice: 'pluck', lo: 67, hi: 86, slot: i, gliss: 2, wobble: 'rock', glow: 0xffc070 });
    shop.box(g, [0.24, 0.32, 0.1], [0, bodyY, 0], inst);
  });
}

// A glass display case of woodwinds, for looking at.
function buildVitrine(shop) {
  const m = materials(), R = shop.root;
  const W = 4.4, D = 0.7, H1 = 0.55, H2 = 2.6;
  const g = group(R, [0, 0, -7.55]);
  mesh(box(W, H1, D), m.panel, g, [0, H1 / 2, 0]);
  mesh(rbox(W + 0.12, 0.12, D + 0.1, 0.02), m.walnut, g, [0, H2 + 0.06, 0]);
  mesh(box(W + 0.12, 0.02, 0.01), m.gold, g, [0, H2, D / 2 + 0.05]);
  mesh(box(W, H2 - H1, 0.02), m.velvet, g, [0, (H1 + H2) / 2, -D / 2 + 0.01]);
  for (const px of [-W / 2, -W / 6, W / 6, W / 2]) mesh(box(0.04, H2 - H1, 0.04), m.brass, g, [px, (H1 + H2) / 2, D / 2]);
  for (const s of [-1, 1]) mesh(box(0.01, H2 - H1, D), m.glass, g, [s * W / 2, (H1 + H2) / 2, 0]).userData.noShadow = true;
  for (const y of [1.2, 1.9]) mesh(box(W - 0.1, 0.012, D - 0.1), m.glass, g, [0, y, 0]).userData.noShadow = true;
  for (const [row, y] of [0.55, 1.2, 1.9].entries()) {
    for (let k = 0; k < 4; k++) {
      const px = -1.6 + k * 1.07, pz = -0.1 + 0.12 * ((k + row) % 2);
      if ((k + row) % 2) {
        mesh(cyl(0.012, 0.012, 0.66, 12), m.chrome, g, [px, y + 0.03, pz], [0, 0.1, PI / 2]);
        for (let q = 0; q < 5; q++) mesh(cyl(0.006, 0.006, 0.01, 8), m.chrome, g, [px - 0.2 + q * 0.08, y + 0.045, pz]);
      } else {
        mesh(cyl(0.015, 0.02, 0.58, 12), m.ebony, g, [px, y + 0.035, pz], [0, -0.1, PI / 2]);
        mesh(flare(0.07, 0.02, 0.04, 2), m.ebony, g, [px + 0.29, y + 0.035, pz], [0, 0, -PI / 2]);
      }
    }
  }
  const front = mesh(box(W - 0.04, H2 - H1, 0.012), m.glass, g, [0, (H1 + H2) / 2, D / 2]);
  front.userData.noShadow = true;
  shop.box(g, [W + 0.12, H2 + 0.12, D + 0.04], [0, (H2 + 0.12) / 2, 0.01], shop.silent());
}

// --- hanging things ------------------------------------------------------------------------

// Crystal chandeliers.
function buildChandelier(shop, x, z, y) {
  const m = materials(), R = shop.root, H = ROOM.H;
  mesh(cyl(0.08, 0.1, 0.06, 16), m.iron, R, [x, H - 0.03, z]);
  const pivot = group(R, [x, H, z]);
  const drop = H - y;
  rod(pivot, [0, 0, 0], [0, -drop + 0.3, 0], 0.012, m.gold);
  const body = group(pivot, [0, -drop, 0]);
  const urn = [[0, 0.32], [0.05, 0.28], [0.04, 0.18], [0.1, 0.08], [0.13, 0], [0.09, -0.1], [0.03, -0.18], [0.06, -0.26], [0, -0.3]];
  mesh(new THREE.LatheGeometry(urn.map(([a, b]) => new THREE.Vector2(a, b)), 24), m.gold, body);
  const arms = 6;
  for (let i = 0; i < arms; i++) {
    const a = i / arms * PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(ca * 0.1, 0, sa * 0.1), new THREE.Vector3(ca * 0.3, -0.18, sa * 0.3), new THREE.Vector3(ca * 0.44, 0.06, sa * 0.44));
    mesh(new THREE.TubeGeometry(curve, 16, 0.012, 6), m.gold, body);
    mesh(cyl(0.035, 0.02, 0.04, 12), m.gold, body, [ca * 0.44, 0.08, sa * 0.44]);
    mesh(cyl(0.012, 0.012, 0.09, 8), m.ivory, body, [ca * 0.44, 0.145, sa * 0.44]);
    const flame = mesh(new THREE.SphereGeometry(0.014, 8, 6), m.bulb, body, [ca * 0.44, 0.2, sa * 0.44]);
    flame.scale.y = 1.7;
    flame.userData.noFlash = flame.userData.noShadow = true;
    const drop1 = mesh(new THREE.OctahedronGeometry(0.03), m.crystal, body, [ca * 0.3, -0.24, sa * 0.3]);
    drop1.scale.y = 1.8;
    drop1.userData.noShadow = true;
  }
  for (let i = 0; i < 12; i++) {
    const a = (i + 0.5) / 12 * PI * 2;
    const c = mesh(new THREE.OctahedronGeometry(0.022), m.crystal, body, [Math.cos(a) * 0.2, -0.14, Math.sin(a) * 0.2]);
    c.scale.y = 1.8;
    c.userData.noShadow = true;
  }
  const big = mesh(new THREE.OctahedronGeometry(0.05), m.crystal, body, [0, -0.4, 0]);
  big.scale.y = 1.6;
  const light = new THREE.PointLight(0xffc27a, 3.5, 0, 2);
  light.position.set(x, y + 0.1, z);
  R.add(light);
  shop.lights.push(light);
  shop.cyl(pivot, 0.48, 0.5, [0, -drop, 0], shop.silent());
}

export function buildShop(shop) {
  buildRoom(shop);
  buildWindow(shop, -3.5, 'Maison Ricochet', 'INSTRUMENTS DE MUSIQUE');
  buildWindow(shop, 2.4, 'Luthier', 'PIANOS · PERCUSSIONS');
  buildMezzanine(shop);
  shelfUnit(shop, -9.6, -3.4);
  shelfUnit(shop, 3.4, 9.6);
  buildShelfInstruments(shop, -9.6, -3.4, false);
  buildShelfInstruments(shop, 3.4, 9.6, true);
  buildVitrine(shop);
  buildCounter(shop);

  // The ensemble of Music for 18 Musicians, in an arc facing the counter: three
  // marimbas in front, keyboards behind, one of them a harpsichord. Xylophones, metallophone and maracas are
  // added with the rest of the percussion.
  buildMarimba(shop, -2.9, 2.3, 0.35);
  buildMarimba(shop, 0, 2.7, 0);
  buildMarimba(shop, 2.9, 2.3, -0.35);
  buildHarpsichord(shop, -3.0, -2.0, 0.3);
  buildPiano(shop, 3.6, -2.2, -0.3);
  buildUpright(shop, 0, 0, -5.0);
  const chair = buildCafeChair(shop, 1.3, 0.6, -0.5);

  buildHarp(shop, -4.3, -7.3, 0.2);
  standingString(shop, -2.0, MEZZ.y, -7.35, 0.25, 0x7a3312,
    { w1: 0.34, w2: 0.27, L: 1.1, d: 0.26, neck: 0.8, head: 0.22, strings: 4 },
    { voice: 'pluck', lo: 28, hi: 50, slot: 0.3 });
  standingString(shop, 0.3, MEZZ.y, -7.4, -0.2, 0x9e4318,
    { w1: 0.23, w2: 0.19, L: 0.76, d: 0.2, neck: 0.5, head: 0.17, strings: 4 },
    { voice: 'pluck', lo: 36, hi: 60, slot: 0.2 });
  standingString(shop, 1.5, MEZZ.y, -7.4, 0.2, 0xa54a1c,
    { w1: 0.23, w2: 0.19, L: 0.76, d: 0.2, neck: 0.5, head: 0.17, strings: 4 },
    { voice: 'pluck', lo: 36, hi: 60, slot: 0.8 });
  buildUpright(shop, 5.4, MEZZ.y, -7.3);
  buildGuitars(shop);
  buildViolins(shop);
  buildCabinet(shop);

  buildChandelier(shop, -5, 0.4, 5.0);
  buildChandelier(shop, 5, 0.4, 5.0);
  buildChandelier(shop, 0, -1.2, 5.2);
  return { chair };
}
