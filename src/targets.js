import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ROOM, MEZZ } from './shop.js';

const PI = Math.PI;
const RADIUS = 0.3;

const SPAWNS = [
  { p: [-1.8, 1.45, 1.1], type: 'post' },
  { p: [2.5, 1.7, 3.0], type: 'post' },
  { p: [-5.2, 2.2, -2.2], type: 'post' },
  { p: [5.6, 2.3, -2.6], type: 'post' },
  { p: [0, 1.3, -5.9], type: 'post' },
  { p: [-8.2, 1.5, 3.2], type: 'post' },
  { p: [8.4, 1.6, -1.2], type: 'post' },
  { p: [-6.9, MEZZ.y + 1.5, -7.1], type: 'post', floor: MEZZ.y },
  { p: [3.6, MEZZ.y + 1.5, -7.1], type: 'post', floor: MEZZ.y },
  { p: [-3.3, 3.0, -1.5], type: 'hang' },
  { p: [3.1, 3.4, -2.7], type: 'hang' },
  { p: [-6.6, 3.8, -4.6], type: 'hang' },
  { p: [6.7, 4.4, 0.0], type: 'hang' },
  { p: [-2.2, 3.7, -0.4], type: 'hang' },
  { p: [0, 1.55, -1.3], type: 'slide', range: 2.0, speed: 0.9 },
  { p: [0, 3.3, -0.5], type: 'slide', range: 3.2, speed: 0.6 },
  { p: [-4.2, 4.6, -5.9], type: 'slide', range: 2.2, speed: 1.1 },
  { p: [4.8, 4.4, -5.6], type: 'slide', range: 1.8, speed: 1.3 },
];

function bullseyeTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const rings = ['#f4efe2', '#d7263d', '#f4efe2', '#d7263d', '#f4efe2', '#ffcf3f'];
  rings.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(128, 128, 128 * (1 - i / rings.length), 0, PI * 2);
    g.fill();
  });
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 3;
  for (let i = 0; i < rings.length; i++) {
    g.beginPath();
    g.arc(128, 128, 128 * (1 - i / rings.length) - 1.5, 0, PI * 2);
    g.stroke();
  }
  g.fillStyle = '#7a1020';
  g.font = 'bold 40px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('♪', 128, 131);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const easeOutBack = t => { const s = 1.9; t -= 1; return t * t * ((s + 1) * t + s) + 1; };

export class Targets {
  constructor(scene, world, pm) {
    this.scene = scene;
    this.world = world;
    this.pm = pm;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.list = [];
    this.queue = [];
    this.count = 5;
    const face = new THREE.MeshStandardMaterial({ map: bullseyeTex(), roughness: 0.45 });
    this.mats = {
      face,
      rim: new THREE.MeshStandardMaterial({ color: 0x5a3216, roughness: 0.5 }),
      post: new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.6 }),
      rope: new THREE.MeshStandardMaterial({ color: 0xcbb68a, roughness: 0.9 }),
      rail: new THREE.MeshStandardMaterial({ color: 0xe3b04b, roughness: 0.25, metalness: 1 }),
    };
    this.discGeo = new THREE.CylinderGeometry(RADIUS, RADIUS, 0.06, 48);
  }

  reset() {
    for (const t of this.list) this.remove(t);
    this.list = [];
    this.queue = [];
    for (let i = 0; i < this.count; i++) this.spawn(i * 0.15);
  }

  remove(t) {
    t.root.removeFromParent();
    if (t.body.world) this.world.removeBody(t.body);
  }

  spawn(delay = 0) {
    const used = new Set(this.list.map(t => t.spawn));
    const free = SPAWNS.filter(s => !used.has(s));
    const s = free[Math.floor(Math.random() * free.length)];
    const m = this.mats;
    const root = new THREE.Group();
    root.position.set(...s.p);
    this.root.add(root);

    const holder = new THREE.Group();
    root.add(holder);
    const disc = new THREE.Mesh(this.discGeo, [m.rim, m.face, m.rim]);
    disc.rotation.x = PI / 2;
    disc.castShadow = true;
    holder.add(disc);

    if (s.type === 'post') {
      const h = s.p[1] - (s.floor ?? 0);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h - RADIUS), m.post);
      post.position.y = -(h + RADIUS) / 2;
      post.castShadow = true;
      root.add(post);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 24), m.rim);
      base.position.y = -h + 0.025;
      root.add(base);
    } else if (s.type === 'hang') {
      // Hung from the ceiling on two cords, so it swings about the ceiling, not its own centre.
      const L = ROOM.H - s.p[1];
      holder.position.y = L;
      disc.position.y = -L;
      const cord = L - RADIUS * 0.6;
      for (const sx of [-0.18, 0.18]) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, cord), m.rope);
        rope.position.set(sx, -cord / 2, 0);
        holder.add(rope);
      }
    } else {
      const top = 0.5;
      for (const sx of [-0.18, 0.18]) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, top), m.rope);
        rope.position.set(sx, top / 2 + RADIUS * 0.6, 0);
        holder.add(rope);
      }
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, s.range * 2 + 1), m.rail);
      rail.rotation.z = PI / 2;
      rail.position.y = top + RADIUS * 0.6;
      root.add(rail);
      for (const sx of [-1, 1]) {
        const h = ROOM.H - (s.p[1] + rail.position.y);
        const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, h), m.rope);
        drop.position.set(sx * (s.range + 0.5), rail.position.y + h / 2, 0);
        root.add(drop);
      }
    }

    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: this.pm.hard });
    body.addShape(new CANNON.Cylinder(RADIUS, RADIUS, 0.12, 16));
    const t = {
      spawn: s, root, holder, disc, body, state: 'popping', age: -delay,
      phase: Math.random() * 10, dying: 0,
      // A simple pendulum swings at sqrt(g / L) whatever its amplitude.
      omega: s.type === 'hang' ? Math.sqrt(9.81 / (ROOM.H - s.p[1])) : 0,
      swing: 0.09 + Math.random() * 0.07,
    };
    body.target = t;
    root.scale.setScalar(0.001);
    this.list.push(t);
    this.sync(t);
    this.world.addBody(body);
    return t;
  }

  sync(t) {
    this.root.updateMatrixWorld(true);
    const p = new THREE.Vector3(), q = new THREE.Quaternion();
    t.disc.getWorldPosition(p);
    t.disc.getWorldQuaternion(q);
    t.body.position.set(p.x, p.y, p.z);
    t.body.quaternion.set(q.x, q.y, q.z, q.w);
  }

  // Returns true the first time a target is struck.
  strike(t) {
    if (t.state !== 'up' && t.state !== 'popping') return false;
    t.state = 'dying';
    t.dying = 0;
    t.body.collisionResponse = false;
    return true;
  }

  update(dt) {
    for (const t of [...this.list]) {
      t.age += dt;
      t.phase += dt;
      const s = t.spawn;
      if (t.age < 0) continue;
      if (t.state === 'popping') {
        const k = Math.min(1, t.age / 0.5);
        t.root.scale.setScalar(Math.max(0.001, easeOutBack(k)));
        if (k >= 1) t.state = 'up';
      }
      if (s.type === 'slide') t.holder.position.x = s.range * Math.sin(t.phase * s.speed);
      if (s.type === 'hang') {
        t.holder.rotation.z = t.swing * Math.sin(t.omega * t.phase);
        t.holder.rotation.x = t.swing * 0.3 * Math.sin(t.omega * t.phase + 1.3);
      }
      if (t.state === 'dying') {
        t.dying += dt;
        t.holder.rotation.y += dt * 22;
        t.holder.position.y -= dt * t.dying * 6;
        t.root.scale.setScalar(Math.max(0.001, 1 - t.dying / 0.7));
        if (t.dying > 0.7) {
          this.remove(t);
          this.list.splice(this.list.indexOf(t), 1);
          this.spawn(0.6);
        }
        continue;
      }
      this.sync(t);
    }
  }
}
