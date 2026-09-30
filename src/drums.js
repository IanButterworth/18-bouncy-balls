// The percussion department, along the wall behind the counter: a drum kit, timpani,
// tubular bells, a gong and hand drums on the floor, and a wall hung with cymbals,
// tambourines, triangles, cowbells and blocks. None of it is in the ensemble. It sits
// behind the player, so it only sounds in flight; standing at the counter, a stray
// ball that reaches it bounces off in silence.
import * as THREE from 'three';
import { PI, ROOM, hash, materials, mesh, group, box, rbox, cyl, std, gloss, rod, tripod, canvasTex, doubleSided } from './shop.js';

const WALL_Z = ROOM.D / 2 - 0.1;

function instrument(shop, node, spec) {
  return shop.instrument(node, { arp: false, flightOnly: true, ...spec });
}

// A drum with its head facing up the local y axis.
function drum(parent, r, h, shell, pos, rot) {
  const m = materials();
  const g = group(parent, pos, rot);
  mesh(cyl(r, r, h, 28), shell, g, [0, -h / 2, 0]);
  mesh(cyl(r * 0.98, r * 0.98, 0.006, 28), m.head, g, [0, 0.003, 0]);
  for (const y of [0, -h]) mesh(new THREE.TorusGeometry(r, 0.008, 6, 32), m.chrome, g, [0, y, 0], [PI / 2, 0, 0]);
  return g;
}

function cymbalMesh(parent, r, pos, rot) {
  const m = materials();
  const g = group(parent, pos, rot);
  mesh(cyl(r * 0.2, r, 0.014, 32), m.bronze, g);
  mesh(new THREE.SphereGeometry(r * 0.2, 16, 8, 0, 2 * PI, 0, PI / 2), m.bronze, g, [0, 0, 0]).scale.y = 0.4;
  return g;
}

// --- on the floor --------------------------------------------------------------------------

function kit(shop, x, z) {
  const m = materials();
  const g = group(shop.root, [x, 0, z]);
  const sparkle = gloss(0x8a1020, 0.25);
  const bass = drum(g, 0.28, 0.4, sparkle, [0, 0.3, -0.2], [-PI / 2, 0, 0]);
  shop.cyl(bass, 0.28, 0.4, [0, -0.2, 0], instrument(shop, bass, { voice: 'kick', lo: 33, hi: 33, wobble: 'jiggle', glow: 0xffa080 }), 'drum');
  const heads = [
    { r: 0.17, h: 0.14, at: [-0.48, 0.66, 0.2], lo: 60, hi: 60, voice: 'snare', stand: true },
    { r: 0.13, h: 0.16, at: [-0.16, 0.8, 0.02], lo: 55, hi: 64, voice: 'tom' },
    { r: 0.15, h: 0.18, at: [0.17, 0.82, 0.02], lo: 50, hi: 59, voice: 'tom' },
    { r: 0.2, h: 0.36, at: [0.55, 0.52, 0.25], lo: 40, hi: 50, voice: 'tom', legs: true },
  ];
  for (const d of heads) {
    const node = drum(g, d.r, d.h, d.voice === 'snare' ? m.chrome : sparkle, d.at);
    if (d.stand) tripod(g, d.at[0], d.at[2], d.at[1] - d.h, m.chrome);
    if (d.legs) for (const a of [0.6, 2.7, 4.8]) rod(g, [d.at[0] + Math.cos(a) * d.r, d.at[1] - d.h, d.at[2] + Math.sin(a) * d.r], [d.at[0] + Math.cos(a) * (d.r + 0.06), 0, d.at[2] + Math.sin(a) * (d.r + 0.06)], 0.008, m.chrome);
    const inst = instrument(shop, node, { voice: d.voice, lo: d.lo, hi: d.hi, ostinato: true, wobble: 'bob', glow: 0xffa080 });
    shop.cyl(node, d.r, 0.04, [0, -0.02, 0], inst, 'drum');
  }
  const cymbals = [
    { r: 0.18, at: [-0.85, 0.95, 0.25], tilt: 0, voice: 'hihat', lo: 90, hi: 90 },
    { r: 0.25, at: [-0.5, 1.45, -0.15], tilt: -0.2, voice: 'cymbal', lo: 84, hi: 96 },
    { r: 0.3, at: [0.8, 1.3, -0.05], tilt: 0.15, voice: 'cymbal', lo: 77, hi: 89 },
  ];
  for (const c of cymbals) {
    tripod(g, c.at[0], c.at[2], c.at[1] - 0.02, m.chrome);
    const node = cymbalMesh(g, c.r, c.at, [c.tilt, 0, 0]);
    if (c.voice === 'hihat') cymbalMesh(node, c.r, [0, -0.03, 0], [PI, 0, 0]);
    const inst = instrument(shop, node, { voice: c.voice, lo: c.lo, hi: c.hi, ostinato: true, wobble: 'rock', glow: 0xffe0a0 });
    shop.cyl(node, c.r, 0.03, [0, 0, 0], inst);
  }
  // The drummer's stool.
  tripod(g, 0, 0.6, 0.5, m.chrome);
  mesh(cyl(0.17, 0.17, 0.07, 20), m.velvet, g, [0, 0.53, 0.6]);
  shop.cyl(g, 0.17, 0.07, [0, 0.53, 0.6], shop.silent());
}

function timpani(shop, x, z, r, lo, hi) {
  const m = materials();
  const g = group(shop.root, [x, 0, z]);
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const a = i / 16 * PI / 2;
    pts.push(new THREE.Vector2(r * Math.sin(a) + 0.001, 0.8 - 0.42 * Math.cos(a)));
  }
  mesh(new THREE.LatheGeometry(pts, 32), m.copper, g);
  for (const a of [0.4, 2.5, 4.6]) rod(g, [Math.cos(a) * r * 0.7, 0.5, Math.sin(a) * r * 0.7], [Math.cos(a) * r, 0, Math.sin(a) * r], 0.014, m.iron);
  const head = group(g, [0, 0.81, 0]);
  mesh(cyl(r, r, 0.008, 32), m.head, head);
  mesh(new THREE.TorusGeometry(r, 0.012, 6, 36), m.chrome, head, [0, 0, 0], [PI / 2, 0, 0]);
  const inst = instrument(shop, head, { voice: 'timpani', lo, hi, ostinato: true, wobble: 'bob', glow: 0xffb070 });
  shop.cyl(head, r, 0.04, [0, -0.02, 0], inst, 'drum');
  shop.cyl(g, r, 0.4, [0, 0.58, 0], shop.silent());
}

function chimes(shop, x0, x1, z) {
  const m = materials();
  const top = 2.6;
  for (const x of [x0, x1]) {
    mesh(box(0.05, top, 0.05), m.walnut, shop.root, [x, top / 2, z]);
    mesh(box(0.08, 0.04, 0.4), m.walnut, shop.root, [x, 0.02, z]);
  }
  mesh(box(x1 - x0 + 0.1, 0.06, 0.06), m.walnut, shop.root, [(x0 + x1) / 2, top, z]);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.75) * (x1 - x0) / (n + 0.5);
    const len = 1.5 - 0.55 * i / (n - 1);
    const node = group(shop.root, [x, top - 0.05, z]);
    rod(node, [0, 0, 0], [0, -0.1, 0], 0.003, m.rope);
    mesh(cyl(0.024, 0.024, len, 16), m.brass, node, [0, -0.1 - len / 2, 0]);
    mesh(cyl(0.028, 0.028, 0.03, 16), m.brass, node, [0, -0.11, 0]);
    const inst = instrument(shop, node, { voice: 'chimes', lo: 60, hi: 79, slot: 1 - i / (n - 1), wobble: 'swing', glow: 0xffd080 });
    shop.box(node, [0.06, len, 0.06], [0, -0.1 - len / 2, 0], inst);
  }
}

function gong(shop, x, z, ry) {
  const m = materials();
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  const r = 0.6, cy = 1.5, w = 0.75, top = cy + r + 0.25;
  for (const s of [-1, 1]) {
    mesh(box(0.08, top, 0.08), m.darkWood, g, [s * w, top / 2, 0]);
    mesh(box(0.1, 0.05, 0.5), m.darkWood, g, [s * w, 0.025, 0]);
  }
  mesh(box(2 * w + 0.2, 0.1, 0.1), m.darkWood, g, [0, top, 0]);
  const node = group(g, [0, top - 0.05, 0]);
  for (const s of [-1, 1]) rod(node, [s * 0.15, 0, 0], [s * 0.08, -0.2, 0], 0.004, m.rope);
  const disc = group(node, [0, -0.25 - r, 0], [PI / 2, 0, 0]);
  mesh(cyl(r, r, 0.012, 48), m.bronze, disc);
  mesh(new THREE.TorusGeometry(r, 0.02, 8, 48), m.bronze, disc, [0, 0, 0], [PI / 2, 0, 0]);
  mesh(new THREE.TorusGeometry(r * 0.3, 0.012, 8, 32), m.copper, disc, [0, 0.008, 0], [PI / 2, 0, 0]);
  const inst = instrument(shop, node, { voice: 'gong', lo: 36, hi: 43, wobble: 'swing', amp: 0.4, glow: 0xffc070 });
  shop.cyl(disc, r, 0.05, [0, 0, 0], inst);
}

// Congas stand on the floor; bongos sit on a stand between them and the counter's end.
function handDrums(shop, x, z, sizes, stand) {
  const m = materials();
  const g = group(shop.root, [x, 0, z]);
  const shell = std(0x9a5a2a, 0.45);
  sizes.forEach(([dx, dz, r, h, lo, hi]) => {
    const y = stand ? 0.78 : h;
    const node = drum(g, r, stand ? 0.12 : h, shell, [dx, y, dz]);
    const inst = instrument(shop, node, { voice: 'tom', lo, hi, ostinato: true, wobble: 'bob', glow: 0xffa060 });
    shop.cyl(node, r, 0.04, [0, -0.02, 0], inst, 'drum');
    if (!stand) shop.cyl(g, r, h - 0.04, [dx, (h - 0.04) / 2, dz], shop.silent());
  });
  if (stand) {
    tripod(g, 0, 0, 0.66, m.chrome);
    mesh(box(0.3, 0.04, 0.06), m.chrome, g, [0, 0.66, 0]);
  }
}

// --- on the wall ---------------------------------------------------------------------------

// Each thing on the wall hangs from a brass peg; `node` is the peg, facing the room.
const hung = {
  cymbal(shop, node, k) {
    const r = 0.2 + 0.03 * (k % 3);
    rod(node, [0, 0, 0.02], [0, -0.06, 0.02], 0.003, materials().rope);
    cymbalMesh(node, r, [0, -0.08 - r, 0.03], [PI / 2, 0, 0]);
    shop.box(node, [2 * r, 2 * r, 0.05], [0, -0.08 - r, 0.03], instrument(shop, node, { voice: 'cymbal', lo: 76 + k % 4 * 4, hi: 96, wobble: 'swing', amp: 0.5, glow: 0xffe0a0 }));
  },
  frame(shop, node, k) {
    const m = materials(), r = 0.24 + 0.03 * (k % 2);
    drum(node, r, 0.06, m.lightWood, [0, -0.05 - r, 0.07], [PI / 2, 0, 0]);
    shop.box(node, [2 * r, 2 * r, 0.07], [0, -0.05 - r, 0.04], instrument(shop, node, { voice: 'tom', lo: 43, hi: 55, slot: (k % 5) / 4, wobble: 'jiggle', glow: 0xffa060 }));
  },
  tambourine(shop, node) {
    const m = materials(), r = 0.13;
    const d = drum(node, r, 0.05, m.lightWood, [0, -0.04 - r, 0.06], [PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * 2 * PI;
      mesh(cyl(0.022, 0.022, 0.006, 12), m.chrome, d, [Math.cos(a) * r, -0.025, Math.sin(a) * r], [0, 0, PI / 2]);
    }
    shop.box(node, [2 * r, 2 * r, 0.06], [0, -0.04 - r, 0.04], instrument(shop, node, { voice: 'tambourine', lo: 72, hi: 72, wobble: 'swing', glow: 0xffe0a0 }));
  },
  triangle(shop, node, k) {
    const m = materials(), s = 0.26 - 0.03 * (k % 2), y = -0.12;
    rod(node, [0, 0, 0.02], [0, y, 0.02], 0.002, m.rope);
    const p = [[0, y, 0.02], [s / 2, y - s * 0.87, 0.02], [-s / 2, y - s * 0.87, 0.02]];
    for (let i = 0; i < 3; i++) rod(node, p[i], p[(i + 1) % 3], 0.006, m.chrome);
    shop.box(node, [s, s * 0.87, 0.04], [0, y - s * 0.43, 0.02], instrument(shop, node, { voice: 'triangle', lo: 93, hi: 105, wobble: 'swing', glow: 0xffffff }));
  },
  cowbell(shop, node, k) {
    const m = materials();
    mesh(new THREE.CylinderGeometry(0.045, 0.075, 0.17, 4, 1), m.iron, node, [0, -0.12, 0.06], [0, PI / 4, 0]);
    mesh(box(0.02, 0.05, 0.02), m.chrome, node, [0, -0.02, 0.06]);
    shop.box(node, [0.14, 0.2, 0.12], [0, -0.12, 0.06], instrument(shop, node, { voice: 'cowbell', lo: 72 + 5 * (k % 2), hi: 86, wobble: 'swing', glow: 0xffe0a0 }));
  },
  steelpan(shop, node) {
    const m = materials(), r = 0.28;
    const g = group(node, [0, -0.05 - r, 0.1], [PI / 2, 0, 0]);
    doubleSided(mesh(cyl(r, r, 0.14, 36, true), m.chrome, g, [0, -0.07, 0]));
    mesh(new THREE.SphereGeometry(r * 1.6, 36, 6, 0, 2 * PI, 0, 0.64), m.chrome, g, [0, -r * 1.6 + 0.02, 0]);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * 2 * PI;
      mesh(new THREE.TorusGeometry(0.06, 0.005, 6, 20), m.brass, g, [Math.cos(a) * r * 0.62, 0.012, Math.sin(a) * r * 0.62], [PI / 2, 0, 0]);
    }
    shop.box(node, [2 * r, 2 * r, 0.14], [0, -0.05 - r, 0.05], instrument(shop, node, { voice: 'steelpan', lo: 60, hi: 84, arp: true, wobble: 'rock', glow: 0xe0f0ff }));
  },
  woodblock(shop, node, k) {
    const m = materials();
    mesh(rbox(0.24, 0.09, 0.09, 0.02), m.wood, node, [0, -0.08, 0.07]);
    mesh(box(0.2, 0.012, 0.02), m.hole, node, [0, -0.1, 0.115]);
    shop.box(node, [0.24, 0.09, 0.09], [0, -0.08, 0.07], instrument(shop, node, { voice: 'block', lo: 60 + 3 * (k % 3), hi: 72, wobble: 'swing', glow: 0xffc080 }));
  },
  // Temple blocks on a little bracket, largest and lowest first, each a note of its own.
  temple(shop, node) {
    const m = materials();
    mesh(box(0.7, 0.03, 0.2), m.walnut, node, [0, -0.3, 0.1]);
    for (const s of [-1, 1]) mesh(box(0.03, 0.2, 0.18), m.walnut, node, [s * 0.3, -0.39, 0.1]);
    const red = gloss(0x9a1a14, 0.3);
    for (let i = 0; i < 5; i++) {
      const sc = 0.1 - 0.012 * i;
      const b = group(node, [-0.26 + i * 0.13, -0.285 + sc * 0.6, 0.1]);
      mesh(new THREE.SphereGeometry(1, 20, 12), red, b).scale.set(sc * 0.6, sc * 0.6, sc * 0.75);
      mesh(box(sc * 0.8, 0.006, 0.02), m.hole, b, [0, 0, sc * 0.72]);
      shop.box(b, [sc * 1.2, sc * 1.2, sc * 1.5], [0, 0, 0], instrument(shop, b, { voice: 'block', lo: 64, hi: 84, slot: i / 4, ostinato: true, wobble: 'jiggle', glow: 0xffb080 }));
    }
  },
  // A glockenspiel in its case, hung like a picture, each bar a note of its own.
  glock(shop, node) {
    const m = materials();
    mesh(rbox(0.62, 0.36, 0.05, 0.015), m.walnut, node, [0, -0.25, 0.03]);
    mesh(box(0.56, 0.3, 0.01), m.velvet, node, [0, -0.25, 0.058]);
    for (let i = 0; i < 9; i++) {
      const len = 0.28 - 0.1 * i / 8;
      const bar = mesh(box(0.045, len, 0.012), m.chrome, node, [-0.24 + i * 0.06, -0.25, 0.07]);
      shop.box(bar, [0.05, len, 0.03], [0, 0, 0], instrument(shop, bar, { voice: 'glock', lo: 79, hi: 101, slot: i / 8, wobble: 'none', glow: 0xe8f4ff }));
    }
  },
};

// What can hang on the wall: how often it is picked, how many at most, and how far it
// reaches either side of its peg and down below it, at life size.
const KINDS = {
  cymbal: { weight: 6, half: 0.26, drop: 0.6 },
  frame: { weight: 3, half: 0.27, drop: 0.59 },
  tambourine: { weight: 4, most: 12, half: 0.14, drop: 0.31 },
  triangle: { weight: 3, most: 9, half: 0.13, drop: 0.35 },
  cowbell: { weight: 3, most: 9, half: 0.08, drop: 0.22 },
  woodblock: { weight: 2, most: 7, half: 0.12, drop: 0.14 },
  steelpan: { weight: 1, most: 2, half: 0.28, drop: 0.62 },
  temple: { weight: 1, most: 2, half: 0.35, drop: 0.5 },
  glock: { weight: 1, most: 2, half: 0.31, drop: 0.44 },
};
const WALL = { x0: -9.6, x1: 9.6, bottom: 1.45, top: 6.55, gap: 0.07, tries: 2500 };
// The sign across the top of the middle, which nothing may cover.
const SIGN = { half: 3.95, bottom: 5.9 };

// Packs the wall like a shop that has hung up whatever came in: pegs at uneven heights,
// things of mixed sizes, each put wherever it fits. The choices come from a fixed hash,
// so the wall is the same every time.
function wallLayout() {
  const kinds = Object.entries(KINDS), total = kinds.reduce((a, [, k]) => a + k.weight, 0);
  const placed = [], count = {};
  for (let i = 0; i < WALL.tries; i++) {
    let pick = hash(i, 1) * total, kind;
    for (const [name, k] of kinds) if ((pick -= k.weight) < 0) { kind = name; break; }
    const k = KINDS[kind];
    if (count[kind] >= (k.most ?? Infinity)) continue;
    // Big things fit early, while the wall is empty; later tries are smaller.
    const scale = 1.1 + 0.7 * hash(i, 2) * (1 - 0.5 * i / WALL.tries);
    const half = k.half * scale, drop = (k.drop + 0.03) * scale;
    const x = WALL.x0 + half + hash(i, 3) * (WALL.x1 - WALL.x0 - 2 * half);
    const y = WALL.bottom + drop + hash(i, 4) * (WALL.top - WALL.bottom - drop);
    const box = { l: x - half, r: x + half, b: y - drop, t: y + 0.05 };
    if (Math.abs(x) < SIGN.half + half && box.t > SIGN.bottom) continue;
    const g = WALL.gap;
    if (placed.some(p => box.l < p.r + g && box.r > p.l - g && box.b < p.t + g && box.t > p.b - g)) continue;
    count[kind] = (count[kind] ?? 0) + 1;
    placed.push({ ...box, x, y, kind, scale, k: i });
  }
  return placed;
}

function wall(shop) {
  const m = materials();
  for (const { x, y, kind, scale, k } of wallLayout()) {
    // Turned to face into the room, and larger than life to hold their own across it.
    const node = group(shop.root, [x, y, WALL_Z], [0, PI, 0]);
    node.scale.setScalar(scale);
    // Physics shapes take no scale from their parents, so size them up here.
    const scaled = Object.create(shop);
    scaled.box = (parent, size, ...rest) => shop.box(parent, size.map(v => v * scale), ...rest);
    mesh(cyl(0.015, 0.02, 0.1, 10), m.brass, node, [0, 0, 0.05], [PI / 2, 0, 0]);
    hung[kind](scaled, node, k);
    // Flat against a wall the sun never reaches, their shadows would cost more than they show.
    node.traverse(o => { o.userData.noShadow = true; });
  }
  const sign = canvasTex(2048, 160, (g, w, h) => {
    g.fillStyle = '#15281f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d9b25a';
    g.lineWidth = 6;
    g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#e8c068';
    g.font = 'bold 84px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('BATTERIE  ✦  PERCUSSIONS  ✦  CYMBALES & GONGS', w / 2, h / 2 + 6);
  });
  sign.wrapS = sign.wrapT = THREE.ClampToEdgeWrapping;
  const board = group(shop.root, [0, 6.25, WALL_Z + 0.04], [0, PI, 0]);
  mesh(box(7.7, 0.6, 0.04), m.walnut, board);
  const face = mesh(new THREE.PlaneGeometry(7.5, 0.58), std(0xffffff, 0.4, 0.3, { map: sign }), board, [0, 0, 0.021]);
  face.userData.noShadow = true;
  // No lamp hangs near this wall, so two lights on the beams wash it.
  for (const x of [-4.5, 4.5]) {
    const light = new THREE.SpotLight(0xffd4a0, 40, 0, 1.0, 0.8, 2);
    light.position.set(x, ROOM.H - 0.4, WALL_Z - 2.6);
    light.target.position.set(x, 3.2, WALL_Z);
    shop.root.add(light, light.target);
  }
}

export function buildDrums(shop) {
  wall(shop);
  kit(shop, -5.8, 6.9);
  [[4.4, 0.4, 38, 45], [5.3, 0.37, 43, 50], [6.2, 0.34, 47, 55], [7.05, 0.3, 50, 57]]
    .forEach(([x, r, lo, hi]) => timpani(shop, x, 7.0, r, lo, hi));
  chimes(shop, 8.3, 9.6, 7.45);
  gong(shop, -8.6, 7.1, -0.52);
  handDrums(shop, -3.1, 7.3, [[-0.16, 0, 0.15, 0.76, 55, 64], [0.16, 0.04, 0.13, 0.72, 59, 69]], false);
  handDrums(shop, 3.1, 7.3, [[-0.09, 0, 0.1, 0, 67, 76], [0.1, 0, 0.12, 0, 62, 72]], true);
}
