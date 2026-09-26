// Set dressing that gives the shop its atmosphere: packed book shelves, lamps that
// throw pools of warm light, daylight shafts through the windows, dust in the air and
// the clutter of a shop that has been open a century.
import * as THREE from 'three';
import {
  PI, rand, canvasTex, materials, mesh, group, box, rbox, cyl, rod, std, makeStringed, ROOM,
} from './shop.js';

// The direction afternoon daylight travels in through the left-hand windows.
export const SUN_DIR = new THREE.Vector3(16, -8, -2).normalize();

const BOOK_COLORS = [
  0x6b1f1f, 0x7d2a18, 0x2f4a3a, 0x1f3550, 0x8a6a2a, 0x4a2c1a, 0xc9b58a,
  0x2a2a2a, 0x5a3d6b, 0xa8552a, 0xe3d7b8, 0x3d5a2a, 0x9a7b4f, 0x5c1a2e,
];

function spineTex() {
  return canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, h * 0.28, w, 3);
    g.fillRect(0, h * 0.7, w, 3);
    g.fillStyle = '#d8b060';
    for (const v of [0.1, 0.15, 0.85, 0.9]) g.fillRect(0, h * v, w, 4);
    g.fillRect(w * 0.25, h * 0.4, w * 0.5, h * 0.2);
  });
}

// Every book in the shop goes into one instanced mesh.
class Books {
  constructor() {
    this.matrices = [];
    this.colors = [];
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
  }

  add(parent, [x, y, z], [w, h, d], [rx, ry, rz] = [0, 0, 0], color) {
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(w, h, d));
    this.matrices.push(parent.matrixWorld.clone().multiply(this.m));
    const c = new THREE.Color(color ?? BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)]);
    c.offsetHSL(0, 0, rand(-0.05, 0.05));
    this.colors.push(c);
  }

  // A shelf's worth of spines standing front-aligned, with gaps and the odd flat stack.
  shelf(parent, x0, x1, y, zFront, depth, maxH) {
    let x = x0 + 0.02;
    while (x < x1 - 0.03) {
      const r = Math.random();
      if (r < 0.05) {
        x += rand(0.05, 0.2);
        continue;
      }
      if (r < 0.11) {
        const sw = rand(0.18, 0.26);
        if (x + sw > x1) break;
        let yy = y;
        const n = 2 + Math.floor(rand(0, 5));
        for (let k = 0; k < n && yy - y < maxH - 0.05; k++) {
          const th = rand(0.02, 0.045);
          this.add(parent, [x + sw / 2 + rand(-0.01, 0.01), yy + th / 2, zFront - 0.12], [sw, th, rand(0.15, 0.22)], [0, rand(-0.08, 0.08), 0]);
          yy += th;
        }
        x += sw + 0.01;
        continue;
      }
      const t = rand(0.018, 0.055), h = Math.min(maxH, rand(0.17, 0.31)), d = Math.min(depth - 0.02, rand(0.13, 0.23));
      this.add(parent, [x + t / 2, y + h / 2, zFront - 0.01 - d / 2], [t, h, d], [0, 0, rand(-0.02, 0.02)]);
      x += t + 0.002;
    }
  }

  // A heap of books on the floor or a counter.
  stack(parent, x, y, z, n) {
    let yy = y;
    for (let k = 0; k < n; k++) {
      const th = rand(0.025, 0.06);
      this.add(parent, [x + rand(-0.03, 0.03), yy + th / 2, z + rand(-0.03, 0.03)], [rand(0.16, 0.3), th, rand(0.22, 0.34)], [0, rand(-0.5, 0.5), 0]);
      yy += th;
    }
    return yy;
  }

  finish(root) {
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std(0xffffff, 0.75, 0, { map: spineTex() }), this.matrices.length);
    this.matrices.forEach((m, i) => {
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, this.colors[i]);
    });
    inst.castShadow = inst.receiveShadow = true;
    root.add(inst);
  }
}

// Shelving fixed to a wall. The group's origin is on the wall at floor level and
// its +z points into the room.
function wallShelves(shop, books, pos, ry, width, ys, top, depth = 0.34) {
  const m = materials();
  const g = group(shop.root, pos, [0, ry, 0]);
  g.updateMatrixWorld(true);
  for (const y of ys) mesh(box(width, 0.035, depth), m.walnut, g, [0, y, depth / 2]);
  mesh(box(width + 0.06, 0.06, depth + 0.04), m.walnut, g, [0, top, depth / 2 + 0.02]);
  const bays = Math.max(1, Math.round(width / 1.3));
  for (let i = 0; i <= bays; i++) {
    mesh(box(0.04, top - ys[0], depth), m.walnut, g, [-width / 2 + i * width / bays, (top + ys[0]) / 2, depth / 2]);
  }
  ys.forEach((y, i) => {
    const gap = (ys[i + 1] ?? top) - y - 0.05;
    for (let b = 0; b < bays; b++) {
      books.shelf(g, -width / 2 + b * width / bays + 0.02, -width / 2 + (b + 1) * width / bays - 0.02, y + 0.018, depth, depth, Math.min(0.33, gap));
    }
  });
  shop.box(g, [width, top - ys[0], depth], [0, (top + ys[0]) / 2, depth / 2], shop.silent());
}

function rugTex() {
  return canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#5a1614';
    g.fillRect(0, 0, w, h);
    const band = (inset, width, color) => {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.strokeRect(inset, inset, w - 2 * inset, h - 2 * inset);
    };
    band(18, 36, '#1d2745');
    band(40, 4, '#b07a2e');
    band(6, 6, '#b07a2e');
    g.fillStyle = '#b07a2e';
    for (let x = 30; x < w - 20; x += 22) {
      for (const y of [18, h - 18]) {
        g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.lineTo(x - 7, y); g.fill();
      }
    }
    const cx = w / 2, cy = h / 2;
    for (const [r, col] of [[110, '#b07a2e'], [100, '#1d2745'], [70, '#7a2420'], [40, '#d9b477'], [18, '#1d2745']]) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(cx, cy - r * 0.8); g.lineTo(cx + r * 1.3, cy); g.lineTo(cx, cy + r * 0.8); g.lineTo(cx - r * 1.3, cy);
      g.fill();
    }
    g.fillStyle = 'rgba(217,180,119,0.5)';
    for (let k = 0; k < 60; k++) {
      const x = 60 + Math.random() * (w - 120), y = 60 + Math.random() * (h - 120);
      if (Math.abs(x - cx) / 1.3 + Math.abs(y - cy) < 130) continue;
      g.fillRect(x, y, 4, 4);
    }
    for (let k = 0; k < 2500; k++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,230,200' : '0,0,0'},${Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

// An opal glass pendant on a long chain, throwing a pool of light below it.
function pendant(shop, x, y, z, shadow) {
  const m = materials();
  const g = group(shop.root, [x, y, z]);
  rod(g, [0, ROOM.H - y - 0.3, 0], [0, 0.2, 0], 0.008, m.iron);
  mesh(new THREE.ConeGeometry(0.09, 0.1, 16), m.brass, g, [0, 0.17, 0]);
  const globe = mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshStandardMaterial({
    color: 0xfff0d8, emissive: 0xffc98a, emissiveIntensity: 2.4, roughness: 0.4,
  }), g);
  globe.userData.noShadow = true;
  const light = new THREE.SpotLight(0xffc88a, 45, 0, 0.95, 0.9, 2);
  light.position.set(x, y - 0.18, z);
  light.target.position.set(x, 0, z);
  if (shadow) {
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0005;
    light.shadow.normalBias = 0.02;
  }
  shop.root.add(light, light.target);
  shop.sphere(g, 0.18, [0, 0, 0], shop.silent());
}

function armchair(shop, x, z, ry) {
  const m = materials();
  const velvet = new THREE.MeshPhysicalMaterial({ color: 0x1d4a3c, roughness: 0.85, sheen: 1, sheenColor: 0x6fb89a, sheenRoughness: 0.45 });
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  mesh(rbox(0.9, 0.36, 0.82, 0.08), velvet, g, [0, 0.3, 0]);
  mesh(rbox(0.72, 0.14, 0.68, 0.06), velvet, g, [0, 0.52, 0.04]);
  const back = group(g, [0, 0.9, -0.34], [-0.14, 0, 0]);
  mesh(rbox(0.9, 0.8, 0.2, 0.1), velvet, back);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    mesh(new THREE.SphereGeometry(0.018, 8, 6), std(0x10281f, 0.8), back, [-0.27 + c * 0.18 + (r % 2) * 0.09, -0.2 + r * 0.2, 0.1]);
  }
  for (const s of [-1, 1]) {
    mesh(rbox(0.17, 0.34, 0.8, 0.08), velvet, g, [s * 0.4, 0.58, 0]);
    mesh(cyl(0.035, 0.025, 0.14, 10), m.walnut, g, [s * 0.36, 0.07, 0.32]);
    mesh(cyl(0.035, 0.025, 0.14, 10), m.walnut, g, [s * 0.36, 0.07, -0.32]);
  }
  shop.box(g, [0.9, 0.7, 0.85], [0, 0.35, 0], shop.silent());
  shop.box(back, [0.9, 0.8, 0.2], [0, 0, 0], shop.silent());
}

function ladder(shop, x0, x1, y1, z) {
  const m = materials();
  const rails = [z - 0.22, z + 0.22];
  for (const rz of rails) rod(shop.root, [x0, 0, rz], [x1, y1, rz], 0.025, m.lightWood);
  for (let k = 1; k < 20; k++) {
    const t = k / 20;
    rod(shop.root, [x0 + (x1 - x0) * t, y1 * t, rails[0]], [x0 + (x1 - x0) * t, y1 * t, rails[1]], 0.014, m.lightWood);
  }
}

function signBoard(shop, x, y, z, text) {
  const m = materials();
  const g = group(shop.root, [x, y, z]);
  for (const s of [-0.4, 0.4]) rod(g, [s, ROOM.H - y - 0.35, 0], [s, 0.14, 0], 0.005, m.iron);
  mesh(rbox(1.1, 0.3, 0.04, 0.015), m.walnut, g);
  const tex = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#2a1a10';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c9a050';
    c.lineWidth = 4;
    c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = '#e6c27a';
    c.font = 'bold 58px Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, w / 2, h / 2 + 4);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  for (const s of [1, -1]) {
    mesh(new THREE.PlaneGeometry(1.04, 0.26), std(0xffffff, 0.6, 0, { map: tex }), g, [0, 0, s * 0.021], [0, s > 0 ? 0 : PI, 0]);
  }
  shop.box(g, [1.1, 0.3, 0.06], [0, 0, 0], shop.silent());
}

function instrumentCase(shop, pos, rz, size, color) {
  const m = materials();
  const g = group(shop.root, pos, [0, 0, rz]);
  mesh(rbox(...size, Math.min(size[0], size[2]) * 0.45), std(color, 0.55), g);
  for (const dy of [-0.15, 0.15]) mesh(box(0.03, 0.04, 0.02), m.brass, g, [size[0] / 2, dy, 0]);
  shop.box(g, size, [0, 0, 0], shop.silent());
}

// Small stringed instruments hung from the beams on cords; they swing when struck.
function hangingInstruments(shop) {
  const kinds = [
    { dims: { w1: 0.1, w2: 0.08, L: 0.3, d: 0.07, neck: 0.2, head: 0.08, strings: 4 }, color: 0xd9a05b, lo: 60, hi: 81, gliss: 1 },
    { dims: { w1: 0.11, w2: 0.075, L: 0.3, d: 0.08, neck: 0.2, head: 0.08, strings: 8 }, color: 0x8a3a1c, lo: 67, hi: 88, gliss: 2 },
    { dims: { w1: 0.15, w2: 0.1, L: 0.38, d: 0.12, neck: 0.2, head: 0.12, strings: 8 }, color: 0xb57a3c, lo: 55, hi: 76, gliss: 3 },
  ];
  const spots = [[-7.6, -1.8], [-6.5, -1.8], [6.5, -1.8], [7.6, -1.8], [-7.4, 0.1], [7.4, 0.1], [-2.6, -3.7], [2.6, -3.7]];
  spots.forEach(([x, z], i) => {
    const k = kinds[i % kinds.length];
    const hookY = 5.9 - 0.15 * (i % 3);
    const pivot = group(shop.root, [x, hookY, z], [0, rand(-0.4, 0.4), 0]);
    rod(pivot, [0, ROOM.H - hookY - 0.3, 0], [0, 0, 0], 0.004, materials().rope);
    const { g, bodyY } = makeStringed(k.color, k.dims);
    pivot.add(g);
    const inst = shop.instrument(pivot, { voice: 'pluck', lo: k.lo, hi: k.hi, slot: (i % 4) / 3, gliss: k.gliss, wobble: 'swing', amp: 0.5, glow: 0xffc070 });
    shop.box(pivot, [k.dims.w1 * 2 + 0.04, k.dims.L, k.dims.d + 0.05], [0, bodyY, 0], inst);
  });
}

// Shafts of window light: stacked soft planes sheared along the light's direction.
function lightShafts(shop, zc) {
  const L = 9, h = 2.9, w = 2.2, n = 10;
  const base = new THREE.Vector3(-9.85, 0.95 + 0.9 + h / 2, zc);
  for (let i = 0; i < n; i++) {
    const zOff = -w / 2 + (i + 0.5) * w / n;
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
    const p = geo.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const t = p.getX(v) + 0.5, s = p.getY(v);
      const q = base.clone().add(new THREE.Vector3(0, s * h, zOff)).addScaledVector(SUN_DIR, t * L);
      p.setXYZ(v, q.x, q.y, q.z);
    }
    const edge = 1 - Math.abs(zOff) / (w / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { color: { value: new THREE.Color(0xfff0d8) }, strength: { value: 0.035 * (0.4 + 0.6 * edge) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 color; uniform float strength; varying vec2 vUv;
        void main() {
          float a = strength * pow(1.0 - vUv.x, 1.6) * smoothstep(0.0, 0.06, vUv.x)
                  * smoothstep(0.0, 0.3, vUv.y) * smoothstep(0.0, 0.3, 1.0 - vUv.y);
          gl_FragColor = vec4(color * a, 1.0);
        }`,
    });
    const shaft = new THREE.Mesh(geo, mat);
    shaft.userData.noShadow = true;
    shaft.renderOrder = 5;
    // Kept out of the shop group so the crosshair's aim ray passes straight through.
    shop.scene.add(shaft);
  }
}

function dust(shop) {
  const N = 900;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rand(-9.5, 9.5);
    pos[i * 3 + 1] = rand(0.3, 6.6);
    pos[i * 3 + 2] = rand(-7.8, 5.5);
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = canvasTex(32, 32, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.03, map: dot, color: 0xffe2b8, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  pts.frustumCulled = false;
  shop.scene.add(pts);
  let t = 0;
  return dt => {
    t += dt;
    for (let i = 0; i < N; i++) {
      const s = seed[i];
      pos[i * 3] += Math.sin(t * 0.2 + s) * 0.0015;
      pos[i * 3 + 1] += Math.sin(t * 0.13 + s * 1.7) * 0.001 - 0.0004;
      pos[i * 3 + 2] += Math.cos(t * 0.17 + s) * 0.0015;
      if (pos[i * 3 + 1] < 0.2) pos[i * 3 + 1] = 6.6;
    }
    geo.attributes.position.needsUpdate = true;
  };
}

export function buildDecor(shop) {
  const books = new Books();
  const top = ROOM.H - 0.25;

  // Floor-to-ceiling books behind the gallery, above the brass and round the windows.
  wallShelves(shop, books, [0, 0, -ROOM.D / 2], 0, ROOM.W, [4.25, 5.1, 5.95], top);
  wallShelves(shop, books, [ROOM.W / 2, 0, -1.2], -PI / 2, 10, [4.6, 5.4, 6.1], top);
  wallShelves(shop, books, [-ROOM.W / 2, 0, 0], PI / 2, ROOM.D, [5.75], top);
  wallShelves(shop, books, [-ROOM.W / 2, 0, -0.55], PI / 2, 2.2, [0.12, 0.55, 0.98, 1.41, 1.84], 2.3);
  wallShelves(shop, books, [-ROOM.W / 2, 0, -5.85], PI / 2, 1.0, [0.12, 0.62, 1.12, 1.62, 2.12, 2.62, 3.12, 3.62, 4.12, 4.62, 5.12], 5.6);

  // The shelves under the gallery and in the right-hand cabinet.
  for (const [x0, x1] of [[-9.6, -3.4], [3.4, 9.6]]) {
    const cx = (x0 + x1) / 2;
    for (const y of [0.925, 2.625]) {
      books.shelf(shop.root, x0 + 0.03, cx - 0.03, y, -7.525, 0.45, 0.32);
      books.shelf(shop.root, cx + 0.03, x1 - 0.03, y, -7.525, 0.45, 0.3);
    }
  }
  const cabinet = group(shop.root, [9.97, 0, -1.2], [0, -PI / 2, 0]);
  cabinet.updateMatrixWorld(true);
  const bays = [[-4.95, -1.75], [-1.65, 1.65], [1.75, 4.95]];
  for (const [a, b] of [[-4.95, -3.1], [-2.5, -0.6], [0, 2.1], [2.7, 4.95]]) books.shelf(cabinet, a, b, 1.025, 0.6, 0.55, 0.33);
  for (const y of [2.125, 3.225]) for (const [a, b] of bays) books.shelf(cabinet, a, b, y, 0.6, 0.55, 0.33);

  for (const [x, z, n] of [[-2.3, -5.7, 12], [2.4, -5.8, 9], [-8.9, -0.3, 14], [4.6, 3.5, 8], [-4.6, 3.7, 11], [8.8, -1.0, 10], [-1.5, 1.3, 6]]) {
    const hgt = books.stack(shop.root, x, 0, z, n);
    shop.box(shop.root, [0.3, hgt, 0.34], [x, hgt / 2, z], shop.silent());
  }
  books.finish(shop.root);

  mesh(new THREE.PlaneGeometry(4.6, 3.4), std(0xffffff, 0.95, 0, { map: rugTex() }), shop.root, [0, 0.006, 1.3], [-PI / 2, 0, 0]);

  pendant(shop, -2.8, 4.3, 1.8, true);
  pendant(shop, 2.8, 4.3, 1.8, true);
  pendant(shop, -6.0, 4.2, -2.6, false);
  pendant(shop, 6.0, 4.2, -2.6, false);
  pendant(shop, 0, 4.5, -5.0, false);

  armchair(shop, -8.1, -1.2, 0.9);
  ladder(shop, 9.0, 9.72, 6.6, -3.3);
  signBoard(shop, -3.2, 5.0, -1.8, 'PARTITIONS  ⟵');
  instrumentCase(shop, [-2.5, 0.53, -6.05], -0.22, [0.4, 1.05, 0.14], 0x2a1a12);
  instrumentCase(shop, [2.52, 0.67, -6.05], 0.18, [0.48, 1.32, 0.28], 0x4a1418);
  hangingInstruments(shop);

  lightShafts(shop, -3.5);
  lightShafts(shop, 2.4);
  return { update: dust(shop) };
}
