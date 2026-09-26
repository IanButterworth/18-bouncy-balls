// The rest of the ensemble from Music for 18 Musicians: xylophones, the metallophone
// and maracas. Bars and maracas keep a ball bouncing in place, so each one it lands
// on becomes a repeating pattern.
import * as THREE from 'three';
import { PI, materials, mesh, group, box, rbox, cyl, std, gloss, tripod } from './shop.js';

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
    const inst = shop.instrument(bar, { voice, lo, hi, slot: i / (n - 1), arp: false, ostinato: true, wobble: 'bob', glow });
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

function metallophone(shop, x, z, ry) {
  const m = materials();
  const g = group(shop.root, [x, 0, z], [0, ry, 0]);
  const span = 2.3;
  barFrame(g, span, 0.82, 0.27, m.ebony);
  const alu = std(0xd6dbe0, 0.3, 0.85);
  barRow(shop, g, { n: 13, span, lenMax: 0.5, lenMin: 0.3, y: 0.87, width: 0.15, barMat: () => alu, voice: 'metallophone', lo: 62, hi: 91, resonators: 0.45, glow: 0xd8ecff });
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

function maracas(shop, parent, pos, color) {
  const m = materials();
  const g = group(parent, pos);
  const paint = gloss(color, 0.4);
  for (const [dx, rz] of [[-0.05, 0.5], [0.05, -0.3]]) {
    const one = group(g, [dx, 0.03, 0], [PI / 2 - 0.1, 0, rz]);
    mesh(new THREE.SphereGeometry(0.05, 16, 12), paint, one, [0, 0.12, 0]).scale.y = 1.2;
    mesh(cyl(0.012, 0.015, 0.12, 8), m.lightWood, one, [0, 0.03, 0]);
  }
  const inst = shop.instrument(g, { voice: 'shaker', lo: 60, hi: 60, arp: false, ostinato: true, glow: 0xffe0a0 });
  shop.box(g, [0.24, 0.1, 0.2], [0, 0.05, 0], inst);
}

// A round stool for a pair of maracas.
function maracasStool(shop, x, z, color) {
  const m = materials();
  const g = group(shop.root, [x, 0, z]);
  tripod(g, 0, 0, 0.62, m.chrome);
  mesh(cyl(0.2, 0.2, 0.05, 24), m.velvet, g, [0, 0.64, 0]);
  shop.cyl(g, 0.2, 0.05, [0, 0.64, 0], shop.silent());
  maracas(shop, g, [0, 0.665, 0], color);
}

export function buildPercussion(shop, chair) {
  xylophone(shop, -5.2, 1.4, 0.75);
  xylophone(shop, 5.2, 1.4, -0.75);
  metallophone(shop, 6.5, -1.4, -1.15);
  maracasStool(shop, 0, -2.4, 0xc0392b);
  maracasStool(shop, -6.2, -1.6, 0x2e86c1);
  maracas(shop, chair, [0, 0.49, 0.02], 0xd4a017);
  [-4.0, -1.5, 1.2].forEach((z, i) => maracas(shop, shop.root, [9.62, 1.025, z], [0xc0392b, 0x2e86c1, 0x27ae60][i]));
}
