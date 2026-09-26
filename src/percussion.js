// Struck instruments: everything here sounds the way it would if a ball bounced off it.
import * as THREE from 'three';
import {
  PI, materials, mesh, group, box, rbox, cyl, rod, std, gloss, flare, doubleSided,
  makeDrum, cymbal, tripod, ROOM,
} from './shop.js';

const clamp01 = x => Math.min(1, Math.max(0, x));
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// Where around a round instrument the ball landed, as 0..1, for pans laid out in a ring of notes.
const angleSlot = node => p => {
  const l = node.worldToLocal(p);
  return (Math.atan2(l.z, l.x) + PI) / (2 * PI);
};

// A row of tuned bars on a frame, one instrument per bar.
function barRow(shop, g, { n, span, lenMax, lenMin, y, width, barMat, voice, lo, hi, resonators, glow }) {
  const m = materials();
  for (let i = 0; i < n; i++) {
    const bx = -span / 2 + (i + 0.5) * span / n;
    const len = lenMax - (lenMax - lenMin) * i / (n - 1);
    const bar = mesh(rbox(width, 0.035, len, 0.01), barMat(i), g, [bx, y, 0]);
    if (resonators) {
      const tube = resonators * (1 - 0.55 * i / (n - 1));
      mesh(cyl(width * 0.28, width * 0.28, tube, 14), m.gold, g, [bx, y - 0.06 - tube / 2, 0]);
    }
    const inst = shop.instrument(bar, { voice, lo, hi, slot: i / (n - 1), arp: false, wobble: 'bob', glow });
    shop.box(bar, [width, 0.05, len], [0, 0, 0], inst);
  }
}

function barFrame(g, span, y, depth, mat) {
  const m = materials();
  for (const s of [-1, 1]) mesh(box(span + 0.2, 0.05, 0.05), mat, g, [0, y, s * depth]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    mesh(cyl(0.022, 0.022, y, 10), mat, g, [sx * (span / 2 + 0.08), y / 2, sz * depth]);
    mesh(new THREE.SphereGeometry(0.03, 10, 8), m.ebony, g, [sx * (span / 2 + 0.08), 0.03, sz * depth]);
  }
  mesh(box(span + 0.1, 0.04, 0.04), mat, g, [0, 0.18, 0]);
}

function vibraphone(shop, x, z, ry) {
  const m = materials();
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  const span = 2.3;
  barFrame(g, span, 0.82, 0.27, m.ebony);
  const alu = std(0xd6dbe0, 0.3, 0.85);
  barRow(shop, g, { n: 13, span, lenMax: 0.5, lenMin: 0.3, y: 0.87, width: 0.15, barMat: () => alu, voice: 'vibe', lo: 60, hi: 89, resonators: 0.45, glow: 0xd8ecff });
  rod(g, [-span / 2, 0.75, 0], [span / 2, 0.75, 0], 0.008, m.chrome);
  mesh(rbox(0.16, 0.1, 0.12, 0.02), m.ebony, g, [span / 2 + 0.16, 0.6, 0]);
}

function xylophone(shop, x, z, ry) {
  const m = materials();
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  const span = 1.4;
  barFrame(g, span, 0.78, 0.18, m.walnut);
  barRow(shop, g, {
    n: 12, span, lenMax: 0.34, lenMin: 0.2, y: 0.82, width: 0.1,
    barMat: i => gloss(new THREE.Color().setHSL(0.06, 0.5, 0.42 + 0.02 * (i % 2)), 0.35),
    voice: 'xylo', lo: 72, hi: 96, resonators: 0.25, glow: 0xffc080,
  });
}

// A glockenspiel in its open case, on the counter.
function glockenspiel(shop) {
  const m = materials();
  const g = group(shop.root, [-2.7, 1.01, 5.25], [0, 0.35, 0]);
  mesh(rbox(0.62, 0.05, 0.3, 0.01), m.walnut, g, [0, 0.025, 0]);
  mesh(box(0.58, 0.012, 0.26), m.velvet, g, [0, 0.055, 0]);
  const lid = group(g, [0, 0.05, -0.15], [-1.9, 0, 0]);
  mesh(rbox(0.62, 0.3, 0.03, 0.01), m.walnut, lid, [0, 0.15, 0]);
  const steel = std(0xe4e6ea, 0.2, 1);
  barRow(shop, g, { n: 10, span: 0.54, lenMax: 0.2, lenMin: 0.13, y: 0.075, width: 0.045, barMat: () => steel, voice: 'glock', lo: 79, hi: 100, glow: 0xffffff });
}

function steelPan(shop, x, z, ry, r, lo, hi) {
  const m = materials();
  const stand = group(shop.root, [x, 0, z], [0, ry, 0]);
  tripod(stand, 0, 0, 0.85, m.chrome);
  const pan = group(stand, [0, 0.95, 0], [0.45, 0, 0]);
  doubleSided(mesh(lathe([[0, -0.07], [r * 0.5, -0.055], [r * 0.9, -0.012], [r, 0], [r * 1.01, -0.02], [r * 1.01, -0.2]], 48), m.chrome, pan));
  mesh(new THREE.TorusGeometry(r, 0.012, 8, 48), m.chrome, pan, [0, 0, 0], [PI / 2, 0, 0]);
  const field = std(0xb8bcc2, 0.25, 1);
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * PI * 2;
    const d = mesh(new THREE.SphereGeometry(r * 0.16, 16, 8), field, pan, [Math.cos(a) * r * 0.66, -0.035, Math.sin(a) * r * 0.66]);
    d.scale.set(1, 0.12, 0.75);
    d.rotation.y = -a;
  }
  const inst = shop.instrument(pan, { voice: 'steelpan', lo, hi, arp: false, wobble: 'tilt', amp: 0.3, glow: 0xe8f4ff, slotFrom: angleSlot(pan) });
  shop.cyl(pan, r, 0.12, [0, -0.04, 0], inst);
}

// A handpan resting on the café chair.
function handpan(shop, parent) {
  const g = group(parent, [0, 0.54, 0.02], [0.12, 0, 0]);
  const steel = std(0x4a4038, 0.32, 0.85);
  const cap = new THREE.SphereGeometry(0.27, 48, 12, 0, PI * 2, 0, 1.1);
  mesh(cap, steel, g).scale.y = 0.42;
  mesh(cap, steel, g, [0, 0, 0], [PI, 0, 0]).scale.y = 0.42;
  const dimple = std(0x6a5a48, 0.3, 0.85);
  mesh(new THREE.SphereGeometry(0.06, 20, 8), dimple, g, [0, 0.105, 0]).scale.y = 0.35;
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * PI * 2;
    const d = mesh(new THREE.SphereGeometry(0.045, 16, 8), dimple, g, [Math.cos(a) * 0.17, 0.075, Math.sin(a) * 0.17]);
    d.scale.set(1, 0.3, 0.8);
    d.rotation.y = -a;
  }
  const inst = shop.instrument(g, { voice: 'handpan', lo: 50, hi: 74, arp: false, wobble: 'none', glow: 0xffd8a0, slotFrom: angleSlot(g) });
  shop.cyl(g, 0.27, 0.2, [0, 0, 0], inst);
}

function cajon(shop, x, z, ry) {
  const m = materials();
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  mesh(rbox(0.31, 0.48, 0.31, 0.015), m.lightWood, g, [0, 0.24, 0]);
  mesh(box(0.28, 0.44, 0.005), m.walnut, g, [0, 0.24, 0.156]);
  mesh(new THREE.CircleGeometry(0.05, 20), m.hole, g, [0, 0.3, -0.157], [0, PI, 0]);
  const inst = shop.instrument(g, { voice: 'conga', lo: 38, hi: 50, slot: 0.2, arp: false, glow: 0xffc080 });
  shop.box(g, [0.31, 0.48, 0.31], [0, 0.24, 0], inst, 'drum');
}

function conga(shop, x, z, h, rTop, lo, slot) {
  const m = materials();
  const g = group(shop.root, [x, 0, z]);
  const staves = gloss(0x8a4a22, 0.35);
  doubleSided(mesh(lathe([[rTop * 0.8, 0], [rTop * 1.05, h * 0.25], [rTop * 1.2, h * 0.55], [rTop * 1.1, h * 0.85], [rTop, h]], 32), staves, g));
  mesh(new THREE.CircleGeometry(rTop, 32), m.head, g, [0, h, 0], [-PI / 2, 0, 0]);
  mesh(new THREE.TorusGeometry(rTop + 0.005, 0.012, 8, 32), m.chrome, g, [0, h, 0], [PI / 2, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * PI * 2;
    rod(g, [Math.cos(a) * (rTop + 0.01), h, Math.sin(a) * (rTop + 0.01)], [Math.cos(a) * rTop * 1.15, h * 0.75, Math.sin(a) * rTop * 1.15], 0.006, m.chrome);
  }
  const inst = shop.instrument(g, { voice: 'conga', lo, hi: lo + 14, slot, arp: false, glow: 0xffc080 });
  shop.cyl(g, rTop * 1.1, h, [0, h / 2, 0], inst, 'drum');
}

function gobletDrum(shop, parent, pos, scale, mat, voice, lo, hi, ry = 0) {
  const m = materials();
  const g = group(parent, pos, [0, ry, 0]);
  g.scale.setScalar(scale);
  doubleSided(mesh(lathe([[0.1, 0], [0.08, 0.08], [0.065, 0.22], [0.09, 0.33], [0.15, 0.45], [0.16, 0.58]], 32), mat, g));
  mesh(new THREE.CircleGeometry(0.16, 32), m.head, g, [0, 0.58, 0], [-PI / 2, 0, 0]);
  mesh(new THREE.TorusGeometry(0.162, 0.01, 8, 32), m.rope, g, [0, 0.575, 0], [PI / 2, 0, 0]);
  const inst = shop.instrument(g, { voice, lo, hi, slot: 0.5, arp: false, glow: 0xffc080 });
  shop.cyl(g, 0.16, 0.6, [0, 0.3, 0], inst, 'drum');
}

function templeBlocks(shop, x, z, ry) {
  const m = materials();
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  tripod(g, 0, 0, 0.85, m.chrome);
  mesh(box(0.9, 0.03, 0.2), m.walnut, g, [0, 0.87, 0]);
  const lacquer = gloss(0x9e1b1b, 0.3);
  for (let i = 0; i < 5; i++) {
    const r = 0.11 - i * 0.012;
    const b = group(g, [-0.34 + i * 0.17, 0.89 + r * 0.7, 0]);
    mesh(new THREE.SphereGeometry(r, 20, 14), lacquer, b).scale.set(1, 0.75, 1.2);
    mesh(box(r * 1.4, 0.012, 0.02), m.hole, b, [0, 0, r * 1.18]);
    const inst = shop.instrument(b, { voice: 'wood', lo: 67, hi: 86, slot: i / 4, arp: false, glow: 0xffb070 });
    shop.sphere(b, r, [0, 0, 0], inst);
  }
}

function gongRack(shop, x, z, ry) {
  const m = materials(), silent = shop.silent();
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  for (const sx of [-0.85, 0.85]) {
    mesh(cyl(0.035, 0.04, 2.0, 12), m.walnut, g, [sx, 1.0, 0]);
    mesh(rbox(0.1, 0.06, 0.5, 0.02), m.walnut, g, [sx, 0.03, 0]);
    shop.cyl(g, 0.04, 2.0, [sx, 1.0, 0], silent);
  }
  mesh(rbox(1.9, 0.08, 0.08, 0.02), m.walnut, g, [0, 2.0, 0]);
  [0.22, 0.28, 0.34].forEach((r, i) => {
    const px = -0.55 + i * 0.55;
    const pivot = group(g, [px, 1.95, 0]);
    rod(pivot, [0, 0, 0], [0, -0.2, 0], 0.004, m.rope);
    mesh(cyl(r, r, 0.02, 40), m.bronze, pivot, [0, -0.2 - r, 0], [PI / 2, 0, 0]);
    mesh(new THREE.TorusGeometry(r, 0.012, 8, 40), m.bronze, pivot, [0, -0.2 - r, 0]);
    const boss = mesh(new THREE.SphereGeometry(r * 0.25, 16, 12), m.gold, pivot, [0, -0.2 - r, 0.01]);
    boss.scale.z = 0.3;
    const inst = shop.instrument(pivot, { voice: 'gong', lo: 50, hi: 64, slot: 1 - i / 2, arp: false, wobble: 'swing', amp: 0.5, glow: 0xffb040 });
    shop.cyl(pivot, r, 0.06, [0, -0.2 - r, 0], inst, 'hard', [PI / 2, 0, 0]);
  });
}

function suspendedCymbal(shop, x, z, r, voice) {
  const m = materials();
  const g = group(shop.root, [x, 0, z]);
  tripod(g, 0, 0, 1.18, m.chrome);
  const c = cymbal(g, r, [0, 1.2, 0], [0.15, 0, 0]);
  const inst = shop.instrument(c, { voice, lo: 79, hi: 91, slot: 0.5, wobble: 'tilt', glow: 0xfff1b0 });
  shop.cyl(c, r, 0.07, [0, 0.01, 0], inst);
}

// Wine glasses tuned with water, on a round café table.
function glassesTable(shop, x, z) {
  const m = materials(), silent = shop.silent();
  const g = group(shop.root, [x, 0, z]);
  mesh(cyl(0.42, 0.42, 0.03, 40), m.walnut, g, [0, 0.74, 0]);
  mesh(cyl(0.03, 0.04, 0.72, 12), m.iron, g, [0, 0.37, 0]);
  mesh(cyl(0.22, 0.25, 0.03, 24), m.iron, g, [0, 0.015, 0]);
  shop.cyl(g, 0.42, 0.04, [0, 0.74, 0], silent);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xeaf6f6, roughness: 0.05, transparent: true, opacity: 0.32, depthWrite: false });
  const water = new THREE.MeshStandardMaterial({ color: 0x9cc8d8, roughness: 0.1, transparent: true, opacity: 0.5, depthWrite: false });
  const profile = lathe([[0.03, 0], [0.004, 0.01], [0.004, 0.08], [0.02, 0.09], [0.038, 0.12], [0.042, 0.17], [0.036, 0.22]], 24);
  for (let i = 0; i < 8; i++) {
    const a = PI * 0.15 + i / 7 * PI * 0.7;
    const gg = group(g, [Math.cos(a) * 0.3, 0.755, Math.sin(a) * 0.3 - 0.05]);
    const cup = mesh(profile, glass, gg);
    cup.material = glass.clone();
    cup.material.side = THREE.DoubleSide;
    cup.userData.noShadow = true;
    const level = 0.1 + 0.1 * (1 - i / 7);
    mesh(cyl(0.035, 0.028, level - 0.09, 20), water, gg, [0, 0.09 + (level - 0.09) / 2, 0]).userData.noShadow = true;
    const inst = shop.instrument(gg, { voice: 'glass', lo: 76, hi: 96, slot: i / 7, arp: false, wobble: 'none', glow: 0xd8f0ff });
    shop.cyl(gg, 0.045, 0.22, [0, 0.11, 0], inst);
  }
}

// Metal wind chimes: a knock sets off a random cascade.
function windChimes(shop, x, z) {
  const m = materials();
  const hangY = 5.5;
  const pivot = group(shop.root, [x, hangY, z]);
  rod(pivot, [0, ROOM.H - hangY - 0.3, 0], [0, 0, 0], 0.004, m.rope);
  mesh(cyl(0.13, 0.13, 0.025, 24), m.walnut, pivot, [0, -0.02, 0]);
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * PI * 2, len = 0.3 + 0.04 * k;
    rod(pivot, [Math.cos(a) * 0.09, -0.03, Math.sin(a) * 0.09], [Math.cos(a) * 0.09, -0.1, Math.sin(a) * 0.09], 0.002, m.rope);
    mesh(cyl(0.012, 0.012, len, 10), m.chrome, pivot, [Math.cos(a) * 0.09, -0.1 - len / 2, Math.sin(a) * 0.09]);
  }
  mesh(cyl(0.04, 0.04, 0.02, 16), m.walnut, pivot, [0, -0.35, 0]);
  const inst = shop.instrument(pivot, { voice: 'chime', lo: 76, hi: 98, gliss: 4, arp: false, wobble: 'swing', amp: 0.6, glow: 0xe8f4ff, slotFrom: () => Math.random() });
  shop.cyl(pivot, 0.15, 0.6, [0, -0.3, 0], inst);
}

function singingBowl(shop, parent, pos, r, slot) {
  const m = materials();
  const g = group(parent, pos);
  mesh(new THREE.TorusGeometry(r * 0.55, r * 0.18, 10, 24), m.velvet, g, [0, r * 0.12, 0], [PI / 2, 0, 0]);
  doubleSided(mesh(lathe([[0, 0], [r * 0.7, 0.005], [r * 0.95, r * 0.35], [r, r * 0.62], [r * 0.97, r * 0.64]], 40), m.bronze, g, [0, r * 0.2, 0]));
  const inst = shop.instrument(g, { voice: 'bowl', lo: 55, hi: 84, slot, arp: false, wobble: 'none', glow: 0xffd070 });
  shop.cyl(g, r, r * 0.9, [0, r * 0.5, 0], inst);
}

function kalimba(shop, parent, pos, ry) {
  const m = materials();
  const g = group(parent, pos, [-1.15, ry, 0]);
  mesh(rbox(0.15, 0.2, 0.035, 0.01), m.lightWood, g);
  mesh(new THREE.CircleGeometry(0.02, 16), m.hole, g, [0, -0.04, 0.018]);
  mesh(box(0.13, 0.008, 0.01), m.chrome, g, [0, 0.03, 0.022]);
  for (let k = 0; k < 9; k++) {
    const len = 0.07 + 0.045 * (1 - Math.abs(k - 4) / 4);
    mesh(box(0.008, len, 0.003), m.chrome, g, [-0.056 + k * 0.014, 0.03 + len / 2 - 0.02, 0.025]);
  }
  const inst = shop.instrument(g, {
    voice: 'kalimba', lo: 67, hi: 91, arp: false, glow: 0xfff0c0,
    slotFrom: p => clamp01((g.worldToLocal(p).x + 0.07) / 0.14),
  });
  shop.box(g, [0.15, 0.2, 0.06], [0, 0, 0], inst);
}

function cowbell(shop, parent, pos, s, slot) {
  const m = materials();
  const g = group(parent, pos, [0, PI / 4, 0]);
  mesh(cyl(0.035 * s, 0.065 * s, 0.15 * s, 4), std(0x2a2622, 0.45, 0.6), g, [0, 0.075 * s, 0]);
  mesh(cyl(0.008, 0.008, 0.06, 8), m.chrome, g, [0, 0.17 * s, 0]);
  const inst = shop.instrument(g, { voice: 'cowbell', lo: 72, hi: 86, slot, arp: false, glow: 0xfff0c0 });
  shop.box(g, [0.1 * s, 0.16 * s, 0.1 * s], [0, 0.08 * s, 0], inst);
}

function maracas(shop, parent, pos, color) {
  const m = materials();
  const g = group(parent, pos);
  const paint = gloss(color, 0.4);
  for (const [dx, rz] of [[-0.05, 0.5], [0.05, -0.3]]) {
    const one = group(g, [dx, 0.03, 0], [PI / 2 - 0.1, 0, rz]);
    mesh(new THREE.SphereGeometry(0.05, 16, 12), paint, one, [0, 0.12, 0]).scale.y = 1.2;
    mesh(cyl(0.012, 0.015, 0.12, 8), m.lightWood, one, [0, 0.03, 0]);
  }
  const inst = shop.instrument(g, { voice: 'shaker', lo: 60, hi: 60, arp: false, glow: 0xffe0a0 });
  shop.box(g, [0.24, 0.1, 0.2], [0, 0.05, 0], inst);
}

export function buildPercussion(shop, chair) {
  const m = materials();
  vibraphone(shop, 5.9, 2.3, -0.45);
  xylophone(shop, -2.7, 3.4, 0.35);
  glockenspiel(shop);
  steelPan(shop, -6.9, -3.8, 0.5, 0.3, 60, 84);
  steelPan(shop, -6.0, -3.4, 0.2, 0.34, 55, 76);
  handpan(shop, chair);
  cajon(shop, 1.3, 0.6, -0.3);
  conga(shop, 8.2, 0.1, 0.75, 0.13, 55, 0.8);
  conga(shop, 8.65, 0.75, 0.75, 0.145, 50, 0.4);
  conga(shop, 8.25, 1.4, 0.75, 0.155, 46, 0.1);
  gobletDrum(shop, shop.root, [7.6, 0, 2.3], 1.1, std(0x5a3418, 0.6), 'tom', 43, 55, 0.4);
  templeBlocks(shop, -2.4, -2.4, 0.3);
  gongRack(shop, 4.7, -4.2, -0.2);
  suspendedCymbal(shop, -5.3, -1.3, 0.32, 'crash');
  suspendedCymbal(shop, 5.5, -1.7, 0.36, 'ride');
  glassesTable(shop, -4.5, 1.3);
  windChimes(shop, 1.6, -1.8);
  windChimes(shop, 4.0, 0.1);
  windChimes(shop, -1.4, -5.6);

  // Under the gallery: singing bowls where the accordions were.
  for (const [x0, x1] of [[-9.6, -3.4], [3.4, 9.6]]) {
    for (let i = 0; i < 6; i++) {
      const r = 0.16 - 0.015 * i;
      singingBowl(shop, shop.root, [x0 + (x1 - x0) * (0.08 + i * 0.168), 0.925, -7.7], r, i / 5);
    }
  }

  // The cabinet on the right wall, restocked with hand percussion.
  const cx = 9.62;
  [-5.5, -4.6, -3.7].forEach((z, i) => gobletDrum(shop, shop.root, [cx, 1.025, z], 0.6, i === 1 ? m.copper : m.brass, 'conga', 57, 69, i));
  [-1.9, -0.7].forEach((z, i) => maracas(shop, shop.root, [cx, 1.025, z], [0xc0392b, 0x2e86c1][i]));
  [1.2, 2.4].forEach((z, i) => gobletDrum(shop, shop.root, [cx, 1.025, z], 0.7, std(0x6a3a1c, 0.55), 'tom', 50, 62, i));
  [-5.6, -4.8, -4.0, -3.3].forEach(z => kalimba(shop, shop.root, [cx + 0.1, 2.24, z], -PI / 2));
  [-2.3, -1.6, -0.9, -0.2].forEach((z, i) => cowbell(shop, shop.root, [cx, 2.125, z], 1.3 - i * 0.12, i / 3));
  [1.3, 2.3, 3.2].forEach((z, i) => singingBowl(shop, shop.root, [cx, 2.125, z], 0.18 - i * 0.02, 0.2 + i * 0.3));
  [-5.0, -3.6, -1.4, 0.0, 1.6, 2.9].forEach((z, i) => singingBowl(shop, shop.root, [cx, 3.225, z], 0.13 + 0.05 * (i % 3), i / 5));
}
