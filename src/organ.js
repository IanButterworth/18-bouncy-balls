// The shop's organs. A tonewheel organ and its rotating Leslie cabinet: striking
// either swells a chord through the cabinet, whose rotors spin up and give it a
// growing vibrato. And a chamber pipe organ with reed stops and a strong tremulant.
import * as THREE from 'three';
import { PI, materials, mesh, group, box, rbox, cyl, rod, gloss, std, flare, doubleSided, keyboard } from './shop.js';

function organ(shop, x, z, ry) {
  const m = materials();
  const wood = gloss(0x5a2e16, 0.3);
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  mesh(rbox(1.3, 0.62, 0.62, 0.03), wood, g, [0, 0.62, -0.05]);
  mesh(rbox(1.36, 0.05, 0.68, 0.02), wood, g, [0, 1.12, -0.08]);
  mesh(box(1.3, 0.2, 0.5), wood, g, [0, 1.0, -0.12]);
  for (const sx of [-0.6, 0.6]) for (const sz of [-0.3, 0.2]) mesh(cyl(0.04, 0.03, 0.32, 12), wood, g, [sx, 0.16, sz]);
  keyboard(g, 1.12, 0.93, 0.33, 29);
  keyboard(g, 1.12, 1.03, 0.2, 29);
  const bars = [0x6b3a1c, 0x6b3a1c, 0xf2ece0, 0xf2ece0, 0x141414, 0xf2ece0, 0x141414, 0x141414, 0xf2ece0];
  bars.forEach((c, i) => mesh(box(0.018, 0.012, 0.07 + 0.02 * (i % 3)), std(c, 0.4), g, [-0.3 + i * 0.03, 1.1, 0.1]));
  mesh(box(0.7, 0.26, 0.02), wood, g, [0, 1.28, -0.12], [-0.2, 0, 0]);
  mesh(box(1.0, 0.05, 0.4), m.walnut, g, [0, 0.03, 0.42]);
  for (let i = 0; i < 9; i++) mesh(box(0.05, 0.03, 0.34), i % 3 === 1 ? m.ebony : m.lightWood, g, [-0.4 + i * 0.1, 0.06, 0.44]);
  mesh(rbox(0.12, 0.05, 0.22, 0.01), m.ebony, g, [0.35, 0.3, 0.3], [-0.3, 0, 0]);
  const bench = group(g, [0, 0, 0.85]);
  mesh(rbox(1.0, 0.07, 0.34, 0.02), wood, bench, [0, 0.52, 0]);
  for (const sx of [-0.44, 0.44]) mesh(box(0.05, 0.5, 0.3), wood, bench, [sx, 0.25, 0]);
  shop.box(bench, [1.0, 0.55, 0.34], [0, 0.27, 0], shop.silent());
  const inst = shop.instrument(g, { voice: 'organ', swell: true, wobble: 'none', glow: 0xffc070 });
  shop.box(g, [1.36, 1.2, 0.7], [0, 0.6, -0.05], inst);
}

// A Model 122-style cabinet: louvres top and bottom, a twin horn and a scooped drum
// turning inside at the rotor speeds the audio uses.
function leslie(shop, x, z, ry) {
  const m = materials();
  const wood = gloss(0x5a2e16, 0.3);
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  const W = 0.62, H = 1.1, D = 0.55;
  for (const sx of [-1, 1]) mesh(box(0.03, H, D), wood, g, [sx * (W / 2 - 0.015), H / 2, 0]);
  mesh(rbox(W + 0.04, 0.05, D + 0.04, 0.015), wood, g, [0, H, 0]);
  mesh(box(W, 0.06, D), wood, g, [0, 0.03, 0]);
  mesh(box(W, H, 0.02), std(0x0e0a08, 0.9), g, [0, H / 2, -D / 2 + 0.01]);
  mesh(box(W, 0.2, 0.02), wood, g, [0, 0.58, D / 2 - 0.01]);
  mesh(box(W, 0.06, 0.02), wood, g, [0, H - 0.05, D / 2 - 0.01]);
  mesh(box(W, 0.07, 0.02), wood, g, [0, 0.1, D / 2 - 0.01]);
  for (const [y0, y1] of [[0.7, 1.0], [0.16, 0.46]]) {
    for (let y = y0; y <= y1; y += 0.06) mesh(box(W - 0.05, 0.018, 0.012), wood, g, [0, y, D / 2 - 0.005]);
  }

  // The horn: one flared bell that sounds, balanced by a short capped dummy opposite,
  // spinning on a vertical shaft.
  const horn = group(g, [0, 0.85, 0]);
  mesh(cyl(0.05, 0.05, 0.08, 16), m.ebony, horn);
  const bell = doubleSided(mesh(flare(0.2, 0.025, 0.07, 2.2, 20), m.ebony, horn, [0.04, 0, 0], [0, 0, -PI / 2]));
  bell.scale.z = 0.7;
  mesh(cyl(0.03, 0.03, 0.1, 12), m.ebony, horn, [-0.09, 0, 0], [0, 0, PI / 2]);
  mesh(cyl(0.035, 0.035, 0.015, 12), m.brass, horn, [-0.145, 0, 0], [0, 0, PI / 2]);
  const drum = group(g, [0, 0.31, 0]);
  mesh(cyl(0.18, 0.18, 0.2, 24), std(0x2a2019, 0.7), drum);
  mesh(box(0.2, 0.19, 0.04), std(0x8a6a4a, 0.6), drum, [0.1, 0, 0.16]);
  shop.leslie = { horn, drum, cabinet: g, pos: [x, 0.85, z] };
  const inst = shop.instrument(g, { voice: 'organ', swell: 'leslie', wobble: 'none', glow: 0xffc070 });
  shop.box(g, [W + 0.04, H, D + 0.04], [0, H / 2, 0], inst);
}

// A chamber pipe organ in a pointed gothic case, gilded pipes across its front.
function churchOrgan(shop, x, z, ry) {
  const m = materials();
  const oak = gloss(0x3a2414, 0.4);
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  mesh(rbox(2.2, 1.1, 0.9, 0.03), oak, g, [0, 0.55, 0]);
  keyboard(g, 1.1, 0.9, 0.5, 26);
  keyboard(g, 1.1, 1.0, 0.4, 26);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    mesh(cyl(0.02, 0.02, 0.06, 10), m.ivory, g, [s * (0.66 + 0.06 * (k % 2)), 0.95 + 0.06 * k, 0.47], [PI / 2, 0, 0]);
  }
  mesh(box(2.2, 2.0, 0.6), oak, g, [0, 2.1, -0.1]);
  const arch = new THREE.Shape();
  arch.moveTo(-1.1, 0);
  arch.lineTo(1.1, 0);
  arch.quadraticCurveTo(1.1, 0.6, 0, 1.0);
  arch.quadraticCurveTo(-1.1, 0.6, -1.1, 0);
  mesh(new THREE.ExtrudeGeometry(arch, { depth: 0.6, bevelEnabled: false }), oak, g, [0, 3.1, -0.4]);
  for (const s of [-1, 1]) {
    mesh(box(0.12, 3.2, 0.12), oak, g, [s * 1.12, 1.6, 0.25]);
    mesh(new THREE.ConeGeometry(0.08, 0.4, 8), m.gold, g, [s * 1.12, 3.4, 0.25]);
  }
  mesh(new THREE.ConeGeometry(0.1, 0.45, 8), m.gold, g, [0, 4.3, -0.1]);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const t = 1 - Math.abs(i - 5) / 5;
    const h = 1.1 + 1.3 * t, r = 0.045 + 0.03 * t;
    const px = -0.95 + i * 0.19;
    mesh(cyl(r, 0.012, 0.25, 16), m.gold, g, [px, 1.25, 0.22]);
    mesh(cyl(r, r, h, 20), m.gold, g, [px, 1.375 + h / 2, 0.22]);
    mesh(box(r * 1.1, 0.07, 0.01), m.hole, g, [px, 1.45, 0.22 + r - 0.003]);
  }
  mesh(box(1.4, 0.05, 0.45), oak, g, [0, 0.03, 0.75]);
  for (let i = 0; i < 12; i++) mesh(box(0.06, 0.03, 0.4), i % 3 === 1 ? m.ebony : m.lightWood, g, [-0.6 + i * 0.11, 0.06, 0.77]);
  const bench = group(g, [0, 0, 1.15]);
  mesh(rbox(1.2, 0.07, 0.34, 0.02), oak, bench, [0, 0.55, 0]);
  for (const sx of [-0.52, 0.52]) mesh(box(0.05, 0.53, 0.3), oak, bench, [sx, 0.27, 0]);
  shop.box(bench, [1.2, 0.58, 0.34], [0, 0.29, 0], shop.silent());
  shop.church = { pos: [x, 1.6, z], node: g };
  const inst = shop.instrument(g, { voice: 'church', swell: 'church', wobble: 'none', glow: 0xffc070 });
  shop.box(g, [2.3, 3.2, 1.0], [0, 1.6, 0], inst);
}

// A Farfisa-style combo organ, the kind heard in Reich's Four Organs: a red-orange
// lacquered two-tier case with chrome trim and rocker tabs, on a chrome Z-stand, lit
// by its own small lamp so it stands out against the window.
function comboOrgan(shop, x, z, ry) {
  const m = materials();
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  for (const s of [-1, 1]) {
    const sx = s * 0.45;
    rod(g, [sx, 0.02, 0.22], [sx, 0.02, -0.22], 0.018, m.chrome);
    rod(g, [sx, 0.02, 0.22], [sx, 0.86, -0.16], 0.018, m.chrome);
    rod(g, [sx, 0.86, -0.16], [sx, 0.86, 0.16], 0.018, m.chrome);
  }
  const lacquer = gloss(0xd9481f, 0.25);
  mesh(rbox(1.1, 0.12, 0.46, 0.03), lacquer, g, [0, 0.93, 0]);
  mesh(box(1.12, 0.02, 0.48), m.chrome, g, [0, 0.99, 0]);
  keyboard(g, 0.94, 1.01, 0.12, 31);
  mesh(rbox(1.1, 0.1, 0.24, 0.02), lacquer, g, [0, 1.08, -0.12]);
  keyboard(g, 0.94, 1.14, 0.0, 31);
  const tabs = [0xf2ece0, 0xf2ece0, 0x141414, 0xd8a030, 0xf2ece0, 0x141414, 0x2e86c1, 0xf2ece0, 0xd8a030];
  tabs.forEach((c, i) => mesh(rbox(0.04, 0.014, 0.05, 0.004), std(c, 0.4), g, [-0.3 + i * 0.075, 1.14, -0.19]));
  mesh(box(0.6, 0.24, 0.015), m.chrome, g, [0, 1.3, -0.23], [-0.25, 0, 0]);
  mesh(box(0.34, 0.01, 0.34), m.walnut, g, [0.1, 0.06, 0.38]);
  mesh(rbox(0.1, 0.04, 0.2, 0.01), m.ebony, g, [0.1, 0.09, 0.38], [-0.25, 0, 0]);
  const lamp = new THREE.SpotLight(0xffcf95, 14, 0, 0.6, 0.8, 2);
  lamp.position.set(x, 2.8, z);
  lamp.target.position.set(x, 1, z);
  shop.root.add(lamp, lamp.target);
  shop.combo = { pos: [x, 1.05, z], node: g };
  const inst = shop.instrument(g, { voice: 'combo', swell: 'combo', wobble: 'none', glow: 0xffc070 });
  shop.box(g, [1.12, 0.3, 0.48], [0, 1.02, -0.02], inst);
}

export function buildOrgan(shop) {
  churchOrgan(shop, 6.6, -4.6, -0.5);
  organ(shop, -6.0, -5.0, 0.45);
  leslie(shop, -7.6, -5.6, 0.5);
  comboOrgan(shop, -8.3, -2.8, 0.75);
}
