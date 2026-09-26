import * as THREE from 'three';

const GLYPHS = ['♪', '♫', '♩', '♬'];

function glyphTex(ch) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 96px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(40,20,10,0.8)';
  g.strokeText(ch, 64, 70);
  g.fillStyle = '#fff';
  g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Effects {
  constructor(scene, camera) {
    this.camera = camera;
    this.textures = GLYPHS.map(glyphTex);
    this.notes = [];
    for (let i = 0; i < 90; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.textures[i % 4], transparent: true, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      s.renderOrder = 10;
      scene.add(s);
      this.notes.push({ s, life: 0, max: 1, vel: new THREE.Vector3(), size: 0.2 });
    }
    this.nextNote = 0;

    const N = this.confettiCount = 500;
    this.confetti = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.07, 0.04),
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }),
      N,
    );
    this.confetti.frustumCulled = false;
    this.parts = [];
    const color = new THREE.Color();
    const dummy = this.dummy = new THREE.Object3D();
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < N; i++) {
      this.confetti.setMatrixAt(i, dummy.matrix);
      this.confetti.setColorAt(i, color.setHSL(Math.random(), 0.85, 0.6));
      this.parts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), spin: new THREE.Vector3(), life: 0 });
    }
    scene.add(this.confetti);
    this.nextPart = 0;
    this.popups = document.getElementById('popups');
  }

  note(pos, midi, strength) {
    const n = this.notes[this.nextNote];
    this.nextNote = (this.nextNote + 1) % this.notes.length;
    n.s.visible = true;
    n.s.position.copy(pos);
    n.s.material.color.setHSL(((midi ?? 60) % 12) / 12, 0.85, 0.65);
    n.vel.set((Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3);
    n.life = 0;
    n.max = 1.1 + strength * 0.6;
    n.size = 0.14 + strength * 0.16;
  }

  burst(pos, count = 70) {
    for (let i = 0; i < count; i++) {
      const q = this.parts[this.nextPart];
      this.nextPart = (this.nextPart + 1) % this.parts.length;
      q.p.copy(pos);
      q.v.set((Math.random() - 0.5) * 5, Math.random() * 4 + 1.5, (Math.random() - 0.5) * 5);
      q.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      q.spin.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
      q.life = 2.2 + Math.random();
    }
  }

  popup(pos, text, sub, big) {
    const v = pos.clone().project(this.camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'popup' + (big ? ' big' : '');
    el.style.left = `${(v.x + 1) / 2 * 100}%`;
    el.style.top = `${(1 - v.y) / 2 * 100}%`;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    this.popups.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  update(dt) {
    for (const n of this.notes) {
      if (!n.s.visible) continue;
      n.life += dt;
      const k = n.life / n.max;
      if (k >= 1) { n.s.visible = false; continue; }
      n.s.position.addScaledVector(n.vel, dt);
      n.vel.x += Math.sin(n.life * 6) * dt * 0.8;
      const pop = Math.min(1, n.life * 8);
      n.s.scale.setScalar(n.size * pop * (1 + 0.15 * Math.sin(n.life * 10)));
      n.s.material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    }

    let any = false;
    const d = this.dummy;
    for (let i = 0; i < this.parts.length; i++) {
      const q = this.parts[i];
      if (q.life <= 0) continue;
      any = true;
      q.life -= dt;
      q.v.y -= 6 * dt;
      q.v.multiplyScalar(Math.exp(-dt * 1.8));
      q.p.addScaledVector(q.v, dt);
      if (q.p.y < 0.02) { q.p.y = 0.02; q.v.set(0, 0, 0); q.spin.set(0, 0, 0); }
      q.r.x += q.spin.x * dt;
      q.r.y += q.spin.y * dt;
      q.r.z += q.spin.z * dt;
      d.position.copy(q.p);
      d.rotation.copy(q.r);
      d.scale.setScalar(q.life > 0 ? Math.min(1, q.life * 2) : 0);
      d.updateMatrix();
      this.confetti.setMatrixAt(i, d.matrix);
    }
    if (any || this.wasAny) this.confetti.instanceMatrix.needsUpdate = true;
    this.wasAny = any;
  }
}
