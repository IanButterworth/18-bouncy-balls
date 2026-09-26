// All sound is synthesised with Web Audio and only ever comes from a ball striking
// an instrument. Every pitched note is taken from the chord of the moment, so a pile
// of simultaneous hits adds up to a fuller chord rather than a clash.

// Impressionist harmony in the spirit of Debussy and Ravel: extended, modal chords
// that drift from one to another by shared notes, with no set progression.
// Each chord lists root, fifth, third, then the colour tones, so low registers can
// keep to the plainer notes and leave the colour to the higher instruments.
const CHORDS = [
  { name: 'Dmaj9', pcs: [2, 9, 6, 1, 4] },
  { name: 'Bm11', pcs: [11, 6, 2, 9, 1, 4] },
  { name: 'Gmaj7♯11', pcs: [7, 2, 11, 6, 9, 1] },
  { name: 'Em9', pcs: [4, 11, 7, 2, 6] },
  { name: 'F♯m11', pcs: [6, 1, 9, 4, 11] },
  { name: 'Cmaj7♯11', pcs: [0, 7, 4, 11, 6, 2] },
  { name: 'B♭maj7♯11', pcs: [10, 5, 2, 9, 4, 0] },
  { name: 'A13sus', pcs: [9, 4, 2, 7, 11, 6] },
  { name: 'D lydian', pcs: [2, 9, 6, 4, 11, 8] },
  { name: 'whole-tone', pcs: [2, 8, 6, 0, 4, 10] },
];

// Chords that share more notes are likelier to follow each other, which keeps the drift smooth.
const NEXT = CHORDS.map((a, i) => CHORDS.map((b, j) => {
  if (i === j) return 0;
  const shared = a.pcs.filter(p => b.pcs.includes(p)).length;
  return shared * shared * (b.name === 'whole-tone' ? 0.3 : 1);
}));

// Energy needed to reach each symphony level.
const THRESHOLDS = [0, 1.5, 4.5, 9, 15, 22];
export const LEVEL_NAMES = ['Tuning up', 'Solo', 'Duet', 'Quartet', 'Orchestra', 'Symphony!'];


// Every voice is something struck, plucked or knocked, since that is all a ball can do.
const LEVEL = {
  mallet: 0.55, glock: 0.3, chime: 0.28, bell: 0.3, pluck: 0.75, piano: 0.42,
  kick: 0.9, tom: 0.6, timpani: 0.7, snare: 0.32, hihat: 0.16, crash: 0.18,
  ride: 0.22, gong: 0.5, wood: 0.3, harp: 0.6, glass: 0.22, jingle: 0.22,
  triangle: 0.2, crystal: 0.16, vibe: 0.4, xylo: 0.4, steelpan: 0.4, handpan: 0.5,
  conga: 0.55, bowl: 0.3, cowbell: 0.18, kalimba: 0.45, shaker: 0.2,
  target: 0.3, pop: 0.1, bounce: 0.35,
};

// The acoustics of the shop, in the same metres as the scene.
const SPEED_OF_SOUND = 343;
const REF_DISTANCE = 1.5;
const RT60 = 1.1;
// The distance at which the reverb would match the direct sound. A real room this size
// would put it near 3 m; it is pushed out so the direct sound stays a little louder
// than the reverb even from the gallery at the back of the shop.
const CRITICAL_DISTANCE = 20;
// First-order reflections off the room's six surfaces: which axis the surface is
// across, where it is, and how much of the sound it sends back. Shelving, drapes
// and instruments along the walls scatter more than the bare floor and ceiling.
const SURFACES = [
  { axis: 0, at: -10, keep: 0.72 },
  { axis: 0, at: 10, keep: 0.68 },
  { axis: 1, at: 0, keep: 0.8 },
  { axis: 1, at: 7, keep: 0.85 },
  { axis: 2, at: -8, keep: 0.65 },
  { axis: 2, at: 8, keep: 0.75 },
];

export const mtof = m => 440 * 2 ** ((m - 69) / 12);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;

export class Music {
  constructor() {
    this.ctx = null;
    this.energy = 0;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state !== 'running' && !this.hidden) this.ctx.resume();
      return;
    }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.out = ctx.createGain();
    this.out.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    // Only a safety net for pile-ups; any harder and it would flatten near against far.
    comp.threshold.value = -8;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    this.bus = ctx.createGain();
    this.bus.gain.value = 2.2;
    // Every voice feeds the late reverb at the same level wherever it is: the
    // diffuse field fills the room evenly while the direct sound falls away.
    this.reverbIn = ctx.createGain();
    this.reverbIn.gain.value = REF_DISTANCE / CRITICAL_DISTANCE;
    const reverb = ctx.createConvolver();
    reverb.normalize = false;
    reverb.buffer = this.impulse();
    this.bus.connect(comp);
    this.reverbIn.connect(reverb).connect(this.bus);
    this.listener = { pos: [0, 1.8, 6.7], fwd: [0, 0, -1], right: [1, 0, 0] };
    comp.connect(this.out);
    this.out.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;

    this.ks = new Map();
    this.active = 0;
    this.current = 0;
    this.nextChange = ctx.currentTime + 5;
  }

  // Silences everything while the page is in the background and picks up again on return.
  setBackground(hidden) {
    this.hidden = hidden;
    if (!this.ctx) return;
    if (hidden) this.ctx.suspend();
    else this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.out.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  // The shop's late reverberation: decorrelated noise decaying at the room's RT60,
  // darkening as it goes, starting after the early reflections and scaled to unit energy.
  impulse() {
    const ctx = this.ctx, sr = ctx.sampleRate, len = Math.floor(sr * RT60 * 1.6);
    const buf = ctx.createBuffer(2, len, sr);
    const onset = Math.floor(sr * 0.018), ramp = sr * 0.03;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let y = 0, energy = 0;
      for (let i = onset; i < len; i++) {
        const t = i / sr;
        const a = 0.85 - 0.6 * (t / (RT60 * 1.6));
        y += a * ((Math.random() * 2 - 1) - y);
        d[i] = y * Math.exp(-6.91 * t / RT60) * Math.min(1, (i - onset) / ramp);
        energy += d[i] * d[i];
      }
      const k = 1 / Math.sqrt(energy);
      for (let i = 0; i < len; i++) d[i] *= k;
    }
    return buf;
  }

  // Follows the camera: position plus the forward and up directions it faces.
  setListener(pos, fwd, up) {
    const right = [fwd[1] * up[2] - fwd[2] * up[1], fwd[2] * up[0] - fwd[0] * up[2], fwd[0] * up[1] - fwd[1] * up[0]];
    this.listener = { pos, fwd, right };
    if (!this.ctx) return;
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = pos[0]; L.positionY.value = pos[1]; L.positionZ.value = pos[2];
      L.forwardX.value = fwd[0]; L.forwardY.value = fwd[1]; L.forwardZ.value = fwd[2];
      L.upX.value = up[0]; L.upY.value = up[1]; L.upZ.value = up[2];
    } else {
      L.setPosition(...pos);
      L.setOrientation(...fwd, ...up);
    }
  }

  // The harmony moves on every few seconds, silently; only hits make it audible.
  chord() {
    if (!this.ctx) return CHORDS[0];
    const now = this.ctx.currentTime;
    if (now >= this.nextChange) {
      const w = NEXT[this.current];
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      let k = 0;
      while ((r -= w[k]) > 0) k++;
      this.current = k;
      this.nextChange = now + 3.5 + Math.random() * 4.5;
    }
    return CHORDS[this.current];
  }

  // Bass notes keep to root and fifth and the middle adds the third and seventh,
  // so the colour tones only sound up high where they ring rather than muddy.
  notesIn(lo, hi, chord) {
    const out = [];
    for (let m = lo; m <= hi; m++) {
      const pcs = m < 48 ? chord.pcs.slice(0, 2) : m < 60 ? chord.pcs.slice(0, 4) : chord.pcs;
      if (pcs.includes(m % 12)) out.push(m);
    }
    return out;
  }

  pick(lo, hi, slot, step, chord = this.chord()) {
    const notes = this.notesIn(lo, hi, chord);
    if (!notes.length) return lo;
    const i = Math.round(clamp(slot, 0, 1) * (notes.length - 1)) + step;
    return notes[mod(i, notes.length)];
  }

  get level() {
    let l = 0;
    for (let i = 1; i < THRESHOLDS.length; i++) if (this.energy >= THRESHOLDS[i]) l = i;
    return l;
  }

  get levelProgress() {
    const l = this.level;
    if (l === THRESHOLDS.length - 1) return 1;
    return (this.energy - THRESHOLDS[l]) / (THRESHOLDS[l + 1] - THRESHOLDS[l]);
  }

  addEnergy(v) {
    this.energy = Math.min(this.energy + 0.25 + 0.6 * v, 30);
  }

  ready() {
    return this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  // Plays a chord tone in [lo, hi]; slot picks how high in that range, step walks from there.
  // A gliss above one runs up the following chord tones, like a strummed harp.
  // `pos` is where in the room the instrument was struck, in scene metres.
  hit(voice, lo, hi, slot, step, vel, pos, gliss = 1) {
    if (!this.ready()) return null;
    if (this.active > 110) return null;
    if (this.active > 70 && vel < 0.35) return null;
    const midi = this.pick(lo, hi, slot, step);
    this.play(voice, midi, vel, pos);
    for (let k = 1; k < gliss; k++) {
      this.play(voice, this.pick(lo, hi, slot, step + k), vel * (1 - 0.12 * k), pos, k * 0.055);
    }
    return midi;
  }

  play(voice, midi, vel, pos, delay = 0) {
    const ctx = this.ctx, lp = this.listener.pos;
    const dist = Math.max(0.3, Math.hypot(pos[0] - lp[0], pos[1] - lp[1], pos[2] - lp[2]));
    // The voice starts once its sound has had time to cross the room.
    const t = ctx.currentTime + 0.004 + delay + dist / SPEED_OF_SOUND;
    const out = ctx.createGain();
    out.gain.value = (LEVEL[voice] ?? 0.3) * (0.12 + 0.88 * vel);
    const nodes = [out];

    // Direct path: air soaks up the highs over distance, then an HRTF panner places it.
    const air = ctx.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = 20000 / (1 + dist * 0.07);
    const pan = ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = REF_DISTANCE;
    pan.rolloffFactor = 1;
    if (pan.positionX) {
      pan.positionX.value = pos[0]; pan.positionY.value = pos[1]; pan.positionZ.value = pos[2];
    } else {
      pan.setPosition(...pos);
    }
    out.connect(air).connect(pan).connect(this.bus);
    out.connect(this.reverbIn);
    nodes.push(air, pan);

    if (this.active < 60) nodes.push(...this.reflections(out, pos, dist));

    const end = this['v_' + voice](mtof(midi), t, vel, out, midi);
    this.active++;
    setTimeout(() => {
      this.active--;
      for (const n of nodes) n.disconnect();
    }, (end - ctx.currentTime + 0.12) * 1000 + 250);
  }

  // Image sources: each surface reflects the source to a mirrored position, heard
  // later, quieter and from that direction.
  reflections(out, pos, dist) {
    const ctx = this.ctx, { pos: lp, right } = this.listener;
    const nodes = [];
    for (const { axis, at, keep } of SURFACES) {
      const img = [...pos];
      img[axis] = 2 * at - pos[axis];
      const d = Math.hypot(img[0] - lp[0], img[1] - lp[1], img[2] - lp[2]);
      const delay = ctx.createDelay(0.2);
      delay.delayTime.value = Math.min(0.2, (d - dist) / SPEED_OF_SOUND);
      const g = ctx.createGain();
      g.gain.value = keep * REF_DISTANCE / Math.max(d, REF_DISTANCE);
      const sp = ctx.createStereoPanner();
      const side = ((img[0] - lp[0]) * right[0] + (img[1] - lp[1]) * right[1] + (img[2] - lp[2]) * right[2]) / d;
      sp.pan.value = clamp(side, -1, 1);
      out.connect(delay).connect(g).connect(sp).connect(this.bus);
      nodes.push(delay, g, sp);
    }
    return nodes;
  }

  // A pleasing chime for a struck target: a quick run up the chord, brighter for a better shot.
  targetChime(pos, power) {
    if (!this.ready()) return;
    const notes = this.notesIn(79, 100, this.chord());
    const n = Math.min(notes.length, 3 + Math.min(power, 3));
    for (let k = 0; k < n; k++) this.play('target', notes[k], 0.9 - 0.08 * k, pos, k * 0.07);
  }

  // Unpitched sounds of the balls themselves.
  effect(voice, midi, vel, pos) {
    if (!this.ready() || this.active > 90) return;
    this.play(voice, midi, vel, pos);
  }

  update(dt) {
    this.energy *= Math.exp(-dt / 4.2);
  }

  // --- building blocks -------------------------------------------------------

  // Sine partials: [ratio, amplitude, decay seconds, attack seconds].
  partials(f, t, list, out, slide = 1, slideTime = 0.1) {
    const ctx = this.ctx;
    let end = t;
    for (const [ratio, amp, decay, att = 0.002] of list) {
      const fr = f * ratio;
      if (fr > 16000 || amp <= 0) continue;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(amp, 0.0002), t + att);
      g.gain.exponentialRampToValueAtTime(0.0001, t + att + decay);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(fr * slide, t);
      if (slide !== 1) o.frequency.exponentialRampToValueAtTime(fr, t + slideTime);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + att + decay + 0.02);
      end = Math.max(end, t + att + decay);
    }
    return end;
  }

  noise(t, decay, out, { type = 'highpass', freq = 1000, q = 0.7, amp = 1, attack = 0.001 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = Math.min(freq, 18000);
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(amp, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(filt).connect(g).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.02);
    return t + attack + decay;
  }

  // Karplus-Strong plucked string, cached per note.
  ksBuffer(midi) {
    let buf = this.ks.get(midi);
    if (buf) return buf;
    const ctx = this.ctx, sr = ctx.sampleRate;
    const N = Math.max(2, Math.round(sr / mtof(midi) - 0.5));
    const len = Math.floor(sr * 2.4);
    buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < N; i++) {
      prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55;
      d[i] = prev;
    }
    const loss = midi < 50 ? 0.998 : 0.996;
    for (let i = N; i < len; i++) d[i] = loss * 0.5 * (d[i - N] + d[i - N - 1 < 0 ? 0 : i - N - 1]);
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    for (let i = 0; i < len; i++) d[i] /= peak || 1;
    this.ks.set(midi, buf);
    return buf;
  }

  // --- voices ------------------------------------------------------------------

  v_mallet(f, t, v, out) {
    const d = clamp(1.4 * Math.sqrt(300 / f), 0.3, 1.8);
    this.noise(t, 0.012, out, { type: 'bandpass', freq: f * 6, q: 1, amp: 0.25 * v });
    return this.partials(f, t, [[1, 1, d], [3.93, 0.08 + 0.3 * v, d * 0.28], [9.2, 0.12 * v, d * 0.1]], out);
  }

  v_glock(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 1.8], [2.76, 0.3 * v + 0.05, 0.5], [5.4, 0.15 * v, 0.25], [8.93, 0.08 * v, 0.12]], out);
  }

  v_chime(f, t, v, out) {
    return this.partials(f, t, [[1, 0.8, 3.6], [2, 0.5, 2.6], [3, 0.35, 1.8], [4.2, 0.3 * v + 0.05, 1.0], [5.4, 0.2 * v, 0.6], [6.8, 0.1 * v, 0.3]], out);
  }

  v_bell(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 2.4], [2, 0.55, 1.7], [3, 0.3, 1.1], [4.16, 0.25 * v + 0.05, 0.6], [5.43, 0.15 * v, 0.35]], out);
  }

  v_pluck(f, t, v, out, midi) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.ksBuffer(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200 + 6000 * v;
    src.connect(lp).connect(out);
    src.start(t);
    return t + src.buffer.duration;
  }

  v_piano(f, t, v, out) {
    const d0 = clamp(3.5 * Math.pow(262 / f, 0.4), 0.8, 6);
    const list = [];
    for (let n = 1; n <= 8; n++) {
      const r = n * Math.sqrt(1 + 0.0004 * n * n);
      list.push([r, Math.pow(n, -1.2) * (n === 1 ? 1 : 0.4 + 0.6 * v), d0 / Math.sqrt(n)]);
    }
    list.push([1.0012, 0.5, d0 * 1.2]);
    this.noise(t, 0.02, out, { type: 'lowpass', freq: 3000, amp: 0.15 * v });
    return this.partials(f, t, list, out);
  }

  v_kick(f, t, v, out) {
    this.noise(t, 0.015, out, { type: 'lowpass', freq: 1800, amp: 0.5 * v });
    return this.partials(f, t, [[1, 1, 0.5]], out, 3.5, 0.07);
  }

  v_tom(f, t, v, out) {
    this.noise(t, 0.04, out, { type: 'bandpass', freq: 600, amp: 0.3 * v });
    return this.partials(f, t, [[1, 1, 0.6], [1.5, 0.25, 0.15]], out, 1.7, 0.09);
  }

  v_timpani(f, t, v, out) {
    this.noise(t, 0.06, out, { type: 'lowpass', freq: 400, amp: 0.6 * v });
    return this.partials(f, t, [[1, 1, 1.9], [1.5, 0.4, 1.3], [1.98, 0.3, 1.0], [2.44, 0.15, 0.6]], out, 1.02, 0.12);
  }

  v_snare(f, t, v, out) {
    this.noise(t, 0.18, out, { type: 'bandpass', freq: 2800, q: 0.6, amp: 1 });
    this.noise(t, 0.1, out, { type: 'highpass', freq: 6000, amp: 0.4 });
    this.partials(f, t, [[1, 0.6, 0.08], [1.6, 0.3, 0.05]], out, 1.3, 0.03);
    return t + 0.2;
  }

  v_hihat(f, t, v, out) {
    return this.noise(t, 0.06 + 0.05 * v, out, { type: 'highpass', freq: 7500, amp: 1 });
  }

  v_crash(f, t, v, out) {
    const d = 1.6 + v;
    this.noise(t, d, out, { type: 'highpass', freq: 3200, amp: 1 });
    this.noise(t, d * 0.5, out, { type: 'bandpass', freq: 7000, q: 0.5, amp: 0.6 });
    this.partials(f, t, [[1, 0.15, 1.2], [2.76, 0.1, 0.8]], out);
    return t + d;
  }

  v_ride(f, t, v, out) {
    this.noise(t, 0.9, out, { type: 'highpass', freq: 5500, amp: 0.5 });
    return this.partials(f, t, [[1, 0.8, 1.4], [2.76, 0.35, 0.8], [5.4, 0.15, 0.4]], out);
  }

  v_gong(f, t, v, out) {
    this.noise(t, 1.5, out, { type: 'lowpass', freq: 900, amp: 0.25, attack: 0.05 });
    return this.partials(f, t, [
      [0.5, 0.5, 6, 0.01], [1, 1, 5.5, 0.02], [1.5, 0.4, 4.5, 0.2], [2, 0.45, 4, 0.25],
      [2.52, 0.3, 3, 0.35], [3.1, 0.25, 2.5, 0.4], [4.2, 0.15, 1.6, 0.5],
    ], out);
  }

  v_wood(f, t, v, out) {
    this.noise(t, 0.01, out, { type: 'bandpass', freq: f * 2, q: 2, amp: 0.3 });
    return this.partials(f, t, [[1, 1, 0.09], [2.7, 0.35, 0.04]], out);
  }

  v_harp(f, t, v, out, midi) {
    return this.v_pluck(f, t, 0.35 + 0.4 * v, out, midi);
  }

  v_glass(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 2.8, 0.004], [2, 0.15, 1.2], [3, 0.06, 0.6]], out);
  }

  v_jingle(f, t, v, out) {
    this.noise(t, 0.25 + 0.15 * v, out, { type: 'bandpass', freq: 7500, q: 1.5, amp: 1 });
    this.noise(t, 0.15, out, { type: 'highpass', freq: 10000, amp: 0.5 });
    return this.partials(f, t, [[1, 0.35, 0.12]], out, 1.4, 0.03);
  }

  v_triangle(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 3], [2, 0.5, 2.2], [3, 0.45, 1.7], [4.2, 0.3, 1.0], [5.4, 0.25, 0.7], [6.8, 0.15, 0.4]], out);
  }

  v_crystal(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 1.3], [2, 0.3, 0.6], [3, 0.15, 0.3]], out);
  }

  // Motor vibraphone: long-ringing aluminium bars with the rotating-disc tremolo.
  v_vibe(f, t, v, out) {
    const ctx = this.ctx;
    const d = clamp(3.2 * Math.pow(400 / f, 0.3), 1.5, 4.5);
    const trem = ctx.createGain();
    trem.gain.value = 0.75;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = ctx.createGain();
    depth.gain.value = 0.25;
    lfo.connect(depth).connect(trem.gain);
    lfo.start(t);
    lfo.stop(t + d + 0.1);
    trem.connect(out);
    return this.partials(f, t, [[1, 1, d], [4, 0.2 * v + 0.05, d * 0.3], [10, 0.05 * v, d * 0.08]], trem);
  }

  v_xylo(f, t, v, out) {
    this.noise(t, 0.008, out, { type: 'bandpass', freq: f * 4, q: 1.5, amp: 0.4 * v });
    return this.partials(f, t, [[1, 1, 0.28], [3, 0.35 * v + 0.1, 0.09], [6.2, 0.15 * v, 0.04]], out);
  }

  // Steel pan: the octave and twelfth ring almost as strongly as the note itself.
  v_steelpan(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 1.5], [2, 0.6, 0.9], [3, 0.28, 0.5], [4, 0.1, 0.25]], out, 1.008, 0.05);
  }

  v_handpan(f, t, v, out) {
    this.noise(t, 0.05, out, { type: 'lowpass', freq: 400, amp: 0.3 * v });
    return this.partials(f, t, [[1, 1, 3.2, 0.004], [2, 0.4, 2], [3, 0.15, 1.2]], out);
  }

  v_conga(f, t, v, out) {
    this.noise(t, 0.03, out, { type: 'bandpass', freq: 1800, q: 1, amp: 0.4 * v });
    return this.partials(f, t, [[1, 1, 0.38], [1.52, 0.18, 0.12]], out, 1.4, 0.03);
  }

  // Singing bowl: two nearly identical modes beat against each other as it rings.
  v_bowl(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 5.5, 0.003], [1.004, 0.8, 5], [2.71, 0.35, 3], [5.1, 0.15, 1.4]], out);
  }

  v_cowbell(f, t, v, out) {
    const ctx = this.ctx;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    for (const r of [1, 1.48]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f * r;
      o.connect(bp);
      o.start(t);
      o.stop(t + 0.37);
    }
    bp.connect(g).connect(out);
    return t + 0.37;
  }

  // Kalimba tine: a sweet fundamental and a quick inharmonic ping from the tine's overtone.
  v_kalimba(f, t, v, out) {
    this.noise(t, 0.006, out, { type: 'highpass', freq: 3000, amp: 0.2 * v });
    return this.partials(f, t, [[1, 1, 1.4], [6.9, 0.25 * v + 0.05, 0.05]], out);
  }

  v_shaker(f, t, v, out) {
    this.noise(t, 0.09, out, { type: 'bandpass', freq: 5500, q: 1, amp: 1 });
    return this.noise(t + 0.07, 0.07, out, { type: 'bandpass', freq: 6000, q: 1, amp: 0.6 });
  }

  // A struck bullseye: a bright bell with a sparkle on top.
  v_target(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 1.6], [2, 0.5, 1.0], [3, 0.3, 0.6], [4.2, 0.2, 0.3], [5.4, 0.12, 0.15]], out);
  }

  // The launcher's soft cork pop.
  v_pop(f, t, v, out) {
    this.noise(t, 0.035, out, { type: 'bandpass', freq: 1200, q: 1.5, amp: 1 });
    return this.partials(f, t, [[1, 0.6, 0.06]], out, 0.6, 0.03);
  }

  // A rubber ball landing on the floor: a small muted bop.
  v_bounce(f, t, v, out) {
    this.noise(t, 0.03, out, { type: 'lowpass', freq: 700, amp: 0.5 });
    return this.partials(f, t, [[1, 1, 0.09]], out, 1.5, 0.03);
  }
}
