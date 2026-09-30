// All sound is synthesised with Web Audio and only ever comes from a ball striking
// something. The shop keeps a steady pulse, in homage to Steve Reich's Music for 18
// Musicians: every note lands on its grid and is drawn from the chord of the current
// section, so a pile of bouncing balls interlocks into one shimmering pattern.

// A cycle of eleven chords in A major and F sharp minor, voiced as clusters. The
// music stays on one until a struck target cues the next, as the vibraphone cues
// each section of the piece. Each lists root, fifth, third, then its colour tones,
// so low registers keep to the plainer notes.
const CYCLE = [
  { name: 'Dmaj9', pcs: [2, 9, 6, 1, 4] },
  { name: 'E6sus', pcs: [4, 11, 9, 1, 6] },
  { name: 'F♯m11', pcs: [6, 1, 9, 4, 11] },
  { name: 'C♯m11', pcs: [1, 8, 4, 11, 6] },
  { name: 'Bm11', pcs: [11, 6, 2, 9, 4] },
  { name: 'Aadd9', pcs: [9, 4, 1, 11, 6] },
  { name: 'D6/9', pcs: [2, 9, 6, 11, 4] },
  { name: 'G♯m7♭5', pcs: [8, 2, 11, 6, 1] },
  { name: 'F♯m9', pcs: [6, 1, 9, 4, 8] },
  { name: 'Esus2', pcs: [4, 11, 6, 1, 9] },
  { name: 'Dmaj7♯11', pcs: [2, 9, 6, 1, 8] },
];
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

// The pulse, in seconds, and how it groups into bars.
export const PULSE = 0.2;
export const BAR = 12;
// Notes are held back to the next half pulse.
const GRID = PULSE / 2;
// A section moves on by itself if no target cues it for this long.
const SECTION_MAX = 40;

// Rotor speeds of the Leslie cabinet in turns per second: slow chorale and fast
// tremolo, and how lazily the light horn and the heavy drum catch up, in seconds.
const LESLIE = { horn: [0.8, 6.8, 1.2], drum: [0.7, 5.9, 3.2] };
// How long the church organ's own stone-church reverb rings, in seconds.
const NAVE_RT60 = 4.5;
// The church organ's tremulant: a deep, quick wobble of pitch (in cents) and level.
const TREMULANT = { rate: 5.6, cents: 22, level: 0.35 };
// The combo organ's built-in vibrato: quicker and shallower, with a little level flutter.
const COMBO_VIBRATO = { rate: 6.6, cents: 12, level: 0.08 };

// Energy needed to reach each ensemble level.
const THRESHOLDS = [0, 1.5, 4.5, 9, 15, 22];
export const LEVEL_NAMES = ['Pulse', 'Pattern', 'Canon', 'Build-up', 'Ensemble', 'Eighteen'];

// Every voice is something struck, plucked or shaken, since that is all a ball can do.
const LEVEL = {
  mallet: 0.55, xylo: 0.38, metallophone: 0.36, piano: 0.42, harpsichord: 0.4, shaker: 0.22,
  pluck: 0.5, harp: 0.45, pizz: 0.7, pop: 0.1, bounce: 0.35, thud: 0.45, crystal: 0.14,
  // The percussion on the wall behind the counter, heard only in flight.
  kick: 0.8, snare: 0.4, tom: 0.55, timpani: 0.6, cymbal: 0.16, hihat: 0.14, gong: 0.4,
  triangle: 0.12, cowbell: 0.2, block: 0.4, tambourine: 0.22, chimes: 0.3, glock: 0.22, steelpan: 0.35,
};
// Hammond drawbars: 16', 8', 4', 2 2/3', 2' and 1 1/3', as ratios and levels.
const DRAWBARS = [[0.5, 0.45], [1, 1], [2, 0.55], [3, 0.3], [4, 0.25], [6, 0.1]];

// The acoustics of the shop, in the same metres as the scene.
const SPEED_OF_SOUND = 343;
const REF_DISTANCE = 1.5;
// Direct sound keeps rising as a source comes closer than that, down to this distance,
// so something struck right beside you in flight is as loud as it would be.
const NEAR_DISTANCE = 0.3;
// The reflections are placed by level alone, not by the HRTF. At their full physical
// level they blur where the direct sound seems to come from, so they are held back.
const REFLECTION_LEVEL = 0.55;
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
// Freezes a parameter's automation at its value at time t, so a new ramp can start there.
const holdAt = (p, t) => {
  if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
  else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); }
};
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;

export class Music {
  constructor() {
    this.ctx = null;
    // `spin` is how far the Leslie has been urged from chorale towards tremolo.
    this.rotor = { horn: LESLIE.horn[0], drum: LESLIE.drum[0], spin: 0 };
    this.leslieAt = [-7.6, 0.85, -5.6];
    // How each organ swells: peak level, attack and release time constants, and how
    // many seconds the build-up from repeated strikes takes to ebb away.
    this.tonewheel = { peak: 0.1, attack: 0.45, release: 0.7, ebb: 6 };
    this.pipes = { peak: 0.15, attack: 0.9, release: 1.1, ebb: 6 };
    this.churchAt = [6.6, 1.6, -4.6];
    this.combo = { peak: 0.07, attack: 0.2, release: 0.4, ebb: 6 };
    this.comboAt = [-8.3, 1.05, -2.8];
    this.energy = 0;
    this.muted = false;
    // Sections move on by themselves unless a fixed score is deciding when.
    this.autoAdvance = true;
    // The moment notes are struck, when the physics runs on its own clock rather than the audio's.
    this.simTime = null;
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
    // The ensemble breathes: a slow swell and fade, like the clarinets and voices.
    const breath = ctx.createGain();
    breath.gain.value = 0.8;
    const lung = ctx.createOscillator();
    lung.frequency.value = 1 / 7;
    const depth = ctx.createGain();
    depth.gain.value = 0.2;
    lung.connect(depth).connect(breath.gain);
    lung.start();
    // Every voice feeds the late reverb at the same level wherever it is: the
    // diffuse field fills the room evenly while the direct sound falls away.
    this.reverbIn = ctx.createGain();
    this.reverbIn.gain.value = REF_DISTANCE / CRITICAL_DISTANCE;
    const reverb = ctx.createConvolver();
    reverb.normalize = false;
    reverb.buffer = this.impulse();
    this.bus.connect(breath).connect(comp);
    this.reverbIn.connect(reverb).connect(this.bus);
    this.listener = { pos: [0, 1.8, 6.7], fwd: [0, 0, -1], right: [1, 0, 0] };
    this.sources = [];
    comp.connect(this.out);
    this.out.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;

    this.ks = new Map();
    this.active = 0;
    this.t0 = ctx.currentTime + 0.05;
    this.section = 0;
    this.sectionStart = this.t0;
    this.pending = null;
    this.buildLeslie();
    this.buildChurch();
    this.buildCombo();
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
  impulse(rt = RT60) {
    const ctx = this.ctx, sr = ctx.sampleRate, len = Math.floor(sr * rt * 1.6);
    const buf = ctx.createBuffer(2, len, sr);
    const onset = Math.floor(sr * 0.018), ramp = sr * 0.03;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let y = 0, energy = 0;
      for (let i = onset; i < len; i++) {
        const t = i / sr;
        const a = 0.85 - 0.6 * (t / (rt * 1.6));
        y += a * ((Math.random() * 2 - 1) - y);
        d[i] = y * Math.exp(-6.91 * t / rt) * Math.min(1, (i - onset) / ramp);
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
    // The organs sound on for as long as they are played, so their reflections follow
    // the listener round the room, once they have moved enough to tell.
    const from = this.aimedFrom, apart = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    if (!from || apart(pos, from.pos) + apart(right, from.right) > 0.02) {
      this.aimedFrom = { pos, right };
      for (const { at, taps } of this.sources) {
        this.aimReflections(taps, at, Math.hypot(at[0] - pos[0], at[1] - pos[1], at[2] - pos[2]), 0.05);
      }
    }
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

  now() {
    return this.simTime ?? this.ctx.currentTime;
  }

  // Back to the first chord, with no change coming.
  rewind() {
    this.section = 0;
    this.pending = null;
    this.sectionStart = this.ctx.currentTime;
  }

  chord() {
    if (!this.ctx) return CYCLE[0];
    if (this.pending && this.now() >= this.pending.at) {
      this.section = this.pending.section;
      this.sectionStart = this.pending.at;
      this.pending = null;
    }
    return CYCLE[this.section];
  }

  get sectionName() {
    return `${NUMERALS[this.section]} · ${CYCLE[this.section].name}`;
  }

  // The pulse count since the music started, or -1 before it has.
  pulseIndex() {
    return this.ctx ? Math.floor((this.ctx.currentTime - this.t0) / PULSE) : -1;
  }

  nextBarTime(after) {
    const bars = Math.floor((after - this.t0) / (PULSE * BAR)) + 1;
    return this.t0 + bars * PULSE * BAR;
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
  // `pos` is where in the room the instrument was struck, in scene metres. `lag` shifts
  // the grid the note waits for, for a player drifting against the shop's pulse.
  hit(voice, lo, hi, slot, step, vel, pos, gliss = 1, lag = 0) {
    if (!this.ready()) return null;
    if (this.active > 110) return null;
    if (this.active > 70 && vel < 0.35) return null;
    const midi = this.pick(lo, hi, slot, step);
    this.play(voice, midi, vel, pos, 0, true, lag);
    for (let k = 1; k < gliss; k++) {
      this.play(voice, this.pick(lo, hi, slot, step + k), vel * (1 - 0.12 * k), pos, k * GRID, true, lag);
    }
    return midi;
  }

  play(voice, midi, vel, pos, delay = 0, onGrid = true, lag = 0) {
    const ctx = this.ctx, lp = this.listener.pos;
    const dist = Math.max(0.3, Math.hypot(pos[0] - lp[0], pos[1] - lp[1], pos[2] - lp[2]));
    let t = this.now() + 0.004 + delay;
    // Every note waits for the next step of the pulse, then for its sound to cross the room.
    if (onGrid) t = this.t0 + lag + Math.ceil((t - this.t0 - lag) / GRID) * GRID;
    t += dist / SPEED_OF_SOUND;
    const out = ctx.createGain();
    out.gain.value = (LEVEL[voice] ?? 0.3) * (0.12 + 0.88 * vel);
    const nodes = [out];

    // Direct path: air soaks up the highs over distance, then an HRTF panner places it.
    const air = ctx.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = 20000 / (1 + dist * 0.07);
    const pan = this.panner(pos);
    out.connect(air).connect(pan.input);
    out.connect(this.reverbIn);
    nodes.push(air, ...pan.nodes);

    if (this.active < 60) for (const r of this.reflections(out, pos, dist)) nodes.push(r.delay, r.gain, r.pan);

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
    const ctx = this.ctx;
    const taps = SURFACES.map(surface => {
      const tap = { surface, delay: ctx.createDelay(0.2), gain: ctx.createGain(), pan: ctx.createStereoPanner() };
      out.connect(tap.delay).connect(tap.gain).connect(tap.pan).connect(this.bus);
      return tap;
    });
    this.aimReflections(taps, pos, dist);
    return taps;
  }

  // Sets each reflection's delay, level and side for where the listener is now.
  // With `glide`, they ease there instead, so a sound that holds on follows a moving
  // listener without clicks.
  aimReflections(taps, pos, dist, glide = 0) {
    const { pos: lp, right } = this.listener, now = this.ctx.currentTime;
    const set = (param, v) => glide ? param.setTargetAtTime(v, now, glide) : param.value = v;
    for (const { surface: { axis, at, keep }, delay, gain, pan } of taps) {
      const img = [...pos];
      img[axis] = 2 * at - pos[axis];
      const d = Math.hypot(img[0] - lp[0], img[1] - lp[1], img[2] - lp[2]);
      set(delay.delayTime, clamp((d - dist) / SPEED_OF_SOUND, 0, 0.2));
      set(gain.gain, REFLECTION_LEVEL * keep * REF_DISTANCE / Math.max(d, REF_DISTANCE));
      const side = ((img[0] - lp[0]) * right[0] + (img[1] - lp[1]) * right[1] + (img[2] - lp[2]) * right[2]) / d;
      set(pan.pan, clamp(side, -1, 1));
    }
  }

  meter(node) {
    const a = this.ctx.createAnalyser();
    a.fftSize = 512;
    node.connect(a);
    return a;
  }

  // How loud each organ is playing right now, in dB, swells and all.
  organLoudness() {
    if (!this.ctx) return null;
    this.meterBuf ??= new Float32Array(512);
    const read = a => {
      a.getFloatTimeDomainData(this.meterBuf);
      let s = 0;
      for (const v of this.meterBuf) s += v * v;
      return 10 * Math.log10(s / this.meterBuf.length + 1e-12);
    };
    return { tonewheel: read(this.leslie.meter), pipes: read(this.church.meter), combo: read(this.comboOut.meter) };
  }

  // The direct path to the listener: an HRTF panner at `pos`, falling off inversely with
  // distance, at the same level as before from REF_DISTANCE out and louder nearer in.
  // The listener moves every frame and the panner follows it, direction and level.
  panner(pos) {
    const ctx = this.ctx;
    const near = ctx.createGain();
    near.gain.value = REF_DISTANCE / NEAR_DISTANCE;
    const pan = ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'inverse';
    pan.refDistance = NEAR_DISTANCE;
    pan.rolloffFactor = 1;
    if (pan.positionX) {
      pan.positionX.value = pos[0]; pan.positionY.value = pos[1]; pan.positionZ.value = pos[2];
    } else {
      pan.setPosition(...pos);
    }
    near.connect(pan).connect(this.bus);
    return { input: near, nodes: [near, pan] };
  }

  // A fixed source in the room: a panner at `at`, the late reverb and its reflections.
  placeSource(out, at) {
    const [x, y, z] = at;
    out.connect(this.panner(at).input);
    out.connect(this.reverbIn);
    const lp = this.listener.pos;
    this.sources.push({ at, taps: this.reflections(out, at, Math.hypot(x - lp[0], y - lp[1], z - lp[2])) });
  }

  // The Leslie cabinet: the organ's highs go to a spinning horn, heard as a
  // swirling pitch wobble (a delay swept by the rotation) and a pulsing level; its
  // lows go to a slower rotating drum. It sits where the cabinet stands in the room.
  buildLeslie() {
    const ctx = this.ctx, L = this.leslie = {};
    L.input = ctx.createGain();
    L.meter = this.meter(L.input);
    const out = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800;
    const sweep = ctx.createDelay(0.02);
    sweep.delayTime.value = 0.002;
    L.hornLfo = ctx.createOscillator();
    L.hornLfo.frequency.value = this.rotor.horn;
    // The delay shortens as the horn's mouth swings towards the listener, raising the
    // pitch a quarter turn before it faces them, as the Doppler effect does.
    const sweepDepth = ctx.createGain();
    sweepDepth.gain.value = -0.0007;
    const hornLevel = ctx.createGain();
    hornLevel.gain.value = 0.75;
    const hornDepth = ctx.createGain();
    hornDepth.gain.value = 0.25;
    L.hornLfo.connect(sweepDepth).connect(sweep.delayTime);
    L.hornLfo.connect(hornDepth).connect(hornLevel.gain);
    L.input.connect(hp).connect(sweep).connect(hornLevel).connect(out);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    L.drumLfo = ctx.createOscillator();
    L.drumLfo.frequency.value = this.rotor.drum;
    const drumLevel = ctx.createGain();
    drumLevel.gain.value = 0.85;
    const drumDepth = ctx.createGain();
    drumDepth.gain.value = 0.15;
    L.drumLfo.connect(drumDepth).connect(drumLevel.gain);
    L.input.connect(lp).connect(drumLevel).connect(out);
    L.hornLfo.start();
    L.drumLfo.start();
    // Each rotor's phase is tracked here so the cabinet drawn on screen turns in step:
    // the turns completed as of `at`, and the speed in force before and after `at`.
    this.rotorPhase = { at: ctx.currentTime, horn: 0, drum: 0, before: { ...this.rotor }, after: { ...this.rotor } };
    this.placeSource(out, this.leslieAt);
  }

  // How far round each rotor is, in turns, at this moment of the audio. Zero is where
  // its wobble starts; a quarter turn later it is loudest, facing the listener.
  rotorTurns() {
    if (!this.ctx) return null;
    const R = this.rotorPhase, dt = this.ctx.currentTime - R.at;
    const speed = dt >= 0 ? R.after : R.before;
    return { horn: R.horn + speed.horn * dt, drum: R.drum + speed.drum * dt };
  }

  // The church organ's tremulant shakes the whole windchest: one slow-ish LFO
  // wobbles every pipe's pitch and the organ's level together.
  buildChurch() {
    const ctx = this.ctx;
    this.church = this.vibratoChain(TREMULANT, this.churchAt);
    // The pipes also sound into a long, stone-church tail of their own.
    const nave = ctx.createConvolver();
    nave.normalize = false;
    nave.buffer = this.impulse(NAVE_RT60);
    const send = ctx.createGain();
    send.gain.value = 0.45;
    this.church.out.connect(send).connect(nave).connect(this.bus);
    // A diapason: the round, slightly bright tone of an organ's principal pipes.
    this.church.principal = ctx.createPeriodicWave(
      new Float32Array([0, 1, 0.45, 0.22, 0.12, 0.07, 0.04, 0.02]),
      new Float32Array(8),
    );
  }

  buildCombo() {
    this.comboOut = this.vibratoChain(COMBO_VIBRATO, this.comboAt);
  }

  // An organ's output with a vibrato shared by all its notes: one LFO wobbles the
  // level here and, through `pitch`, the tuning of every oscillator connected to it.
  vibratoChain({ rate, cents, level }, at) {
    const ctx = this.ctx, C = {};
    C.input = ctx.createGain();
    C.meter = this.meter(C.input);
    const trem = ctx.createGain();
    trem.gain.value = 1 - level;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const levelDepth = ctx.createGain();
    levelDepth.gain.value = level;
    lfo.connect(levelDepth).connect(trem.gain);
    C.pitch = ctx.createGain();
    C.pitch.gain.value = cents;
    lfo.connect(C.pitch);
    lfo.start();
    C.input.connect(trem);
    this.placeSource(trem, at);
    C.out = trem;
    return C;
  }



  // Swells an organ. Repeated strikes build it up: each adds to a level that ebbs
  // away between hits, and a swell already sounding on the same chord grows louder
  // and holds on rather than starting over. `o` describes the organ; `pipes` builds
  // the chord's oscillators into the swell's envelope. Returns when it lets go.
  organSwell(o, start, until, chord, pipes) {
    const ctx = this.ctx, now = ctx.currentTime;
    o.level = Math.min(1, (o.level ?? 0) * Math.exp(-(now - (o.hitAt ?? now)) / o.ebb) + 0.3);
    o.hitAt = now;
    const peak = o.peak * (0.5 + o.level);
    const v = o.voice;
    if (v && v.chord === chord && now < v.until + 1) {
      v.until = Math.max(v.until, until);
      holdAt(v.env.gain, now);
      v.env.gain.setTargetAtTime(peak, now, 0.35);
      v.env.gain.setTargetAtTime(0, v.until, o.release);
      for (const osc of v.oscs) osc.stop(v.until + o.release * 5);
      return v.until;
    }
    if (v) {
      holdAt(v.env.gain, start);
      v.env.gain.setTargetAtTime(0, start, 0.5);
      for (const osc of v.oscs) osc.stop(start + 3);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.setTargetAtTime(peak, start, o.attack);
    env.gain.setTargetAtTime(0, until, o.release);
    const { oscs, done } = pipes(env);
    for (const osc of oscs) {
      osc.start(start);
      osc.stop(until + o.release * 5);
    }
    oscs[0].onended = () => {
      env.disconnect();
      done?.();
    };
    o.voice = { env, oscs, chord, until };
    return until;
  }

  // An organ chord swelling in volume through the Leslie. How fast the Leslie spins
  // is separate: that is up to strikes on the cabinet.
  swell(holdBars = 1, at) {
    if (!this.ready()) return;
    const ctx = this.ctx;
    const start = at ?? this.t0 + Math.ceil((ctx.currentTime + 0.01 - this.t0) / PULSE) * PULSE;
    const chord = at ? CYCLE[this.pending?.section ?? this.section] : this.chord();
    const notes = [...this.notesIn(40, 52, chord).slice(0, 1), ...this.notesIn(57, 76, chord).slice(0, 4)];
    this.organSwell(this.tonewheel, start, start + holdBars * BAR * PULSE, chord, env => {
      env.connect(this.leslie.input);
      const oscs = [];
      for (const m of notes) {
        const f = mtof(m);
        for (const [r, a] of DRAWBARS) {
          if (f * r > 12000) continue;
          const osc = ctx.createOscillator();
          osc.frequency.value = f * r;
          const g = ctx.createGain();
          g.gain.value = a;
          osc.connect(g).connect(env);
          oscs.push(osc);
        }
      }
      return { oscs };
    });
  }

  // Striking the Leslie cabinet urges its rotors faster; the urge builds with more
  // strikes and ebbs away, and the rotors follow it lazily either way.
  spin(vel) {
    this.rotor.spin = Math.min(1, this.rotor.spin + 0.25 + 0.25 * vel);
  }

  // A church chord: a principal chorus of flue pipes (8-foot, octave, twelfth,
  // fifteenth and a little mixture) over a 16-foot bass, tinted with a quiet reed,
  // opening like a swell box and wavering with the tremulant, then closing again.
  churchSwell(holdBars = 2) {
    if (!this.ready()) return;
    const ctx = this.ctx;
    const start = this.t0 + Math.ceil((ctx.currentTime + 0.01 - this.t0) / PULSE) * PULSE;
    const chord = this.chord();
    const notes = [...this.notesIn(26, 38, chord).slice(0, 2), ...this.notesIn(43, 64, chord).slice(0, 4)];
    const fresh = !this.pipes.voice || this.pipes.voice.chord !== chord || ctx.currentTime > this.pipes.voice.until + 1;
    this.organSwell(this.pipes, start, start + holdBars * BAR * PULSE, chord, env => {
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 4500;
      tone.Q.value = 0.6;
      env.connect(tone).connect(this.church.input);
      // Each swell takes the tremulant through its own node, so it can let go cleanly.
      const wobble = ctx.createGain();
      this.church.pitch.connect(wobble);
      const oscs = [];
      const ranks = [
        [this.church.principal, 1, 0.8], [this.church.principal, 2, 0.6], [this.church.principal, 3, 0.3],
        [this.church.principal, 4, 0.35], ['sine', 6, 0.2], ['sine', 8, 0.16], ['sawtooth', 1, 0.1], ['triangle', 0.5, 1.1],
      ];
      notes.forEach((m, k) => {
        const f = mtof(m), bass = k < 2 ? 1.4 : 1;
        for (const [wave, r, a] of ranks) {
          if (f * r > 9000) continue;
          const osc = ctx.createOscillator();
          if (typeof wave === 'string') osc.type = wave;
          else osc.setPeriodicWave(wave);
          osc.frequency.value = f * r;
          osc.detune.value = (Math.random() - 0.5) * 6;
          wobble.connect(osc.detune);
          const g = ctx.createGain();
          g.gain.value = a * bass;
          osc.connect(g).connect(env);
          oscs.push(osc);
        }
      });
      return {
        oscs,
        done: () => {
          tone.disconnect();
          // Chrome may already have dropped this link once the pipes stopped.
          try { this.church.pitch.disconnect(wobble); } catch {}
        },
      };
    });
    // Pipes starting to speak give a soft, breathy chiff.
    if (fresh) for (const m of notes.slice(2)) this.noise(start, 0.09, this.church.input, { type: 'bandpass', freq: mtof(m) * 3, q: 4, amp: 0.02 });
  }

  // A combo organ, as in Reich's Four Organs: bright square-wave reeds at 8 and 4
  // feet over a soft 16-foot, with its own quick vibrato.
  comboSwell(holdBars = 1) {
    if (!this.ready()) return;
    const ctx = this.ctx;
    const start = this.t0 + Math.ceil((ctx.currentTime + 0.01 - this.t0) / PULSE) * PULSE;
    const chord = this.chord();
    const notes = this.notesIn(57, 79, chord).slice(0, 4);
    this.organSwell(this.combo, start, start + holdBars * BAR * PULSE, chord, env => {
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 3800;
      const reed = ctx.createBiquadFilter();
      reed.type = 'peaking';
      reed.frequency.value = 1600;
      reed.gain.value = 5;
      env.connect(tone).connect(reed).connect(this.comboOut.input);
      const wobble = ctx.createGain();
      this.comboOut.pitch.connect(wobble);
      const oscs = [];
      for (const m of notes) {
        for (const [type, r, a] of [['square', 1, 0.6], ['square', 2, 0.3], ['sawtooth', 0.5, 0.25]]) {
          const osc = ctx.createOscillator();
          osc.type = type;
          osc.frequency.value = mtof(m) * r;
          wobble.connect(osc.detune);
          const g = ctx.createGain();
          g.gain.value = a;
          osc.connect(g).connect(env);
          oscs.push(osc);
        }
      }
      return {
        oscs,
        done: () => {
          reed.disconnect();
          // Chrome may already have dropped this link once the notes stopped.
          try { this.comboOut.pitch.disconnect(wobble); } catch {}
        },
      };
    });
  }


  // A struck target moves the ensemble on to the next chord at the next bar, with
  // the Leslie organ swelling in on it. Returns false if a change is already coming.
  cue() {
    if (!this.ready() || this.pending) return false;
    const next = (this.section + 1) % CYCLE.length;
    this.pending = { section: next, at: this.nextBarTime(this.ctx.currentTime) };
    this.swell(2, this.pending.at);
    return true;
  }

  // Moves to the next chord at a given time, as a fixed score asks, whether or not it can be heard.
  cueAt(at) {
    this.pending = { section: (this.section + 1) % CYCLE.length, at };
    this.swell(2, at);
  }

  // Crystal pendants knocked together: a quick tumble of tiny glass clinks, more for
  // a harder knock, pitched high in the chord but loose in time as they settle.
  jingle(pos, vel) {
    if (!this.ready()) return;
    const n = 3 + Math.round(vel * 6);
    let at = 0;
    for (let k = 0; k < n; k++) {
      const loud = vel * (1 - k / (n + 2)) * (0.6 + 0.4 * Math.random());
      this.play('crystal', this.pick(84, 103, Math.random(), 0), loud, pos, at, false);
      at += 0.02 + Math.random() * 0.07;
    }
  }

  // Unpitched sounds of the balls themselves.
  effect(voice, midi, vel, pos, onGrid = false) {
    if (!this.ready() || this.active > 90) return;
    this.play(voice, midi, vel, pos, 0, onGrid);
  }

  update(dt) {
    this.energy *= Math.exp(-dt / 4.2);
    // The urge to spin ebbs away, and the rotors ease towards the speed it asks for
    // with the inertia of a real cabinet.
    const now = this.ctx?.currentTime ?? 0;
    this.rotor.spin *= Math.exp(-dt / 7);
    for (const part of ['horn', 'drum']) {
      const [slow, quick, lag] = LESLIE[part];
      const want = slow + (quick - slow) * this.rotor.spin;
      this.rotor[part] += (want - this.rotor[part]) * (1 - Math.exp(-dt / lag));
    }
    if (!this.ctx) return;
    // Speed changes are scheduled slightly ahead, so the moment each takes effect in
    // the audio is known exactly and the phase kept here matches the sound.
    const R = this.rotorPhase, at = now + 0.03;
    for (const part of ['horn', 'drum']) {
      R[part] = (R[part] + R.after[part] * (at - R.at)) % 1;
      this.leslie[part + 'Lfo'].frequency.setValueAtTime(this.rotor[part], at);
    }
    R.before = R.after;
    R.after = { horn: this.rotor.horn, drum: this.rotor.drum };
    R.at = at;
    this.chord();
    // A section left alone for too long moves on quietly at the next bar.
    if (this.autoAdvance && !this.pending && this.ctx.currentTime - this.sectionStart > SECTION_MAX) {
      this.pending = { section: (this.section + 1) % CYCLE.length, at: this.nextBarTime(this.ctx.currentTime) };
    }
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

  // A finger-plucked gut string: a soft, rounded pluck rather than a burst of noise,
  // a three-point average that darkens the tone each pass, and a heavier loss so the
  // note dies away like pizzicato. Cached per note.
  pizzBuffer(midi) {
    const key = `pizz${midi}`;
    let buf = this.ks.get(key);
    if (buf) return buf;
    const ctx = this.ctx, sr = ctx.sampleRate;
    const N = Math.max(3, Math.round(sr / mtof(midi)));
    const len = Math.floor(sr * 2);
    buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    // The finger pulls the string aside at a point near the end and lets it go.
    const at = 0.18;
    for (let i = 0; i < N; i++) {
      const x = i / N;
      d[i] = (x < at ? x / at : (1 - x) / (1 - at)) - 0.5 + (Math.random() - 0.5) * 0.04;
    }
    // Damped so the note falls 40 dB in about this long, as a gut string does.
    const loss = Math.exp(-4.6 / (mtof(midi) * (midi < 45 ? 1.4 : 0.9)));
    for (let i = N; i < len; i++) {
      d[i] = loss * (0.25 * d[i - N - 1 < 0 ? i - N : i - N - 1] + 0.5 * d[i - N] + 0.25 * d[i - N + 1]);
    }
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
    for (let i = 0; i < len; i++) d[i] /= peak || 1;
    this.ks.set(key, buf);
    return buf;
  }

  // --- voices ------------------------------------------------------------------

  v_mallet(f, t, v, out) {
    const d = clamp(1.4 * Math.sqrt(300 / f), 0.3, 1.8);
    this.noise(t, 0.012, out, { type: 'bandpass', freq: f * 6, q: 1, amp: 0.25 * v });
    return this.partials(f, t, [[1, 1, d], [3.93, 0.08 + 0.3 * v, d * 0.28], [9.2, 0.12 * v, d * 0.1]], out);
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

  // Harpsichord: a quill plucks an 8-foot string, with the 4-foot stop an octave above.
  v_harpsichord(f, t, v, out, midi) {
    const ctx = this.ctx;
    this.noise(t, 0.01, out, { type: 'bandpass', freq: 3500, q: 1.2, amp: 0.3 });
    let end = t;
    for (const [m, a] of [[midi, 1], [midi + 12, 0.45]]) {
      const src = ctx.createBufferSource();
      src.buffer = this.ksBuffer(m);
      const bright = ctx.createBiquadFilter();
      bright.type = 'peaking';
      bright.frequency.value = 2800;
      bright.gain.value = 7;
      const g = ctx.createGain();
      g.gain.value = a;
      src.connect(bright).connect(g).connect(out);
      src.start(t);
      end = Math.max(end, t + src.buffer.duration);
    }
    return end;
  }

  // Pizzicato cello, bass or violin: the string through a hollow wooden body, with
  // the brightness rolled off and the soft knock of the finger on the fingerboard.
  v_pizz(f, t, v, out, midi) {
    const ctx = this.ctx;
    this.noise(t, 0.035, out, { type: 'lowpass', freq: 350, amp: 0.35 * v });
    const src = ctx.createBufferSource();
    src.buffer = this.pizzBuffer(midi);
    const air = ctx.createBiquadFilter();
    air.type = 'peaking';
    air.frequency.value = 110;
    air.Q.value = 1.2;
    air.gain.value = 6;
    const wood = ctx.createBiquadFilter();
    wood.type = 'peaking';
    wood.frequency.value = 290;
    wood.Q.value = 1.4;
    wood.gain.value = 4;
    const soft = ctx.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = Math.min(900 + 1500 * v + f * 2, 4000);
    soft.Q.value = 0.5;
    src.connect(air).connect(wood).connect(soft).connect(out);
    src.start(t);
    return t + src.buffer.duration;
  }

  v_harp(f, t, v, out, midi) {
    return this.v_pluck(f, t, 0.35 + 0.4 * v, out, midi);
  }

  // The metallophone: vibraphone bars with the motor off, ringing plain and long.
  v_metallophone(f, t, v, out) {
    const d = clamp(3.0 * Math.pow(400 / f, 0.3), 1.4, 4.2);
    return this.partials(f, t, [[1, 1, d], [4, 0.2 * v + 0.05, d * 0.3], [10, 0.05 * v, d * 0.08]], out);
  }

  v_xylo(f, t, v, out) {
    this.noise(t, 0.008, out, { type: 'bandpass', freq: f * 4, q: 1.5, amp: 0.4 * v });
    return this.partials(f, t, [[1, 1, 0.28], [3, 0.35 * v + 0.1, 0.09], [6.2, 0.15 * v, 0.04]], out);
  }

  v_shaker(f, t, v, out) {
    this.noise(t, 0.09, out, { type: 'bandpass', freq: 5500, q: 1, amp: 1 });
    return this.noise(t + 0.07, 0.07, out, { type: 'bandpass', freq: 6000, q: 1, amp: 0.6 });
  }

  // --- the percussion wall ---

  // A bass drum: a deep thump that drops in pitch as the head settles.
  v_kick(f, t, v, out) {
    this.noise(t, 0.03, out, { type: 'lowpass', freq: 900, amp: 0.3 * v });
    return this.partials(55, t, [[1, 1, 0.35], [1.6, 0.3, 0.12]], out, 2.2, 0.06);
  }

  v_snare(f, t, v, out) {
    this.noise(t, 0.16 + 0.06 * v, out, { type: 'bandpass', freq: 3200, q: 0.6, amp: 1 });
    return this.partials(190, t, [[1, 0.6, 0.08], [1.52, 0.3, 0.06]], out, 1.3, 0.02);
  }

  // Toms, bongos and congas: a tuned head with a quick drop into pitch.
  v_tom(f, t, v, out) {
    this.noise(t, 0.025, out, { type: 'bandpass', freq: f * 5, q: 0.8, amp: 0.25 * v });
    const d = clamp(0.5 * Math.sqrt(200 / f), 0.15, 0.7);
    return this.partials(f, t, [[1, 1, d], [1.51, 0.35, d * 0.5], [2.01, 0.15, d * 0.3]], out, 1.35, 0.05);
  }

  // Kettledrums ring on, with the slightly stretched overtones of a tuned membrane.
  v_timpani(f, t, v, out) {
    this.noise(t, 0.05, out, { type: 'lowpass', freq: 500, amp: 0.4 * v });
    return this.partials(f, t, [[1, 1, 2.2], [1.5, 0.5, 1.5], [1.98, 0.3, 1.1], [2.44, 0.15, 0.7]], out, 1.04, 0.08);
  }

  // Cymbals: a wash of bright noise over a cluster of clashing metal tones.
  v_cymbal(f, t, v, out) {
    const d = 1.2 + 1.2 * v;
    this.noise(t, d, out, { type: 'highpass', freq: 4500, amp: 1 });
    this.noise(t, d * 0.4, out, { type: 'bandpass', freq: 8000, q: 0.8, amp: 0.6 });
    return this.partials(f, t, [[1, 0.2, d * 0.6], [1.41, 0.15, d * 0.5], [2.19, 0.12, d * 0.4], [3.07, 0.1, d * 0.3]], out);
  }

  v_hihat(f, t, v, out) {
    return this.noise(t, 0.05 + 0.04 * v, out, { type: 'highpass', freq: 7500, amp: 1 });
  }

  // A tam-tam: slow to bloom and very long, its overtones far from harmonic.
  v_gong(f, t, v, out) {
    this.noise(t, 2.5, out, { type: 'bandpass', freq: 1800, q: 0.5, amp: 0.12, attack: 0.3 });
    return this.partials(f, t, [
      [1, 1, 6, 0.04], [1.52, 0.6, 5, 0.12], [2.11, 0.45, 4, 0.2], [2.77, 0.35, 3.2, 0.3], [3.4, 0.25, 2.6, 0.4], [4.33, 0.15, 2, 0.5],
    ], out);
  }

  v_triangle(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 2.4], [2.76, 0.45, 1.8], [5.4, 0.3, 1.2], [8.93, 0.2, 0.8]], out);
  }

  v_cowbell(f, t, v, out) {
    this.noise(t, 0.01, out, { type: 'bandpass', freq: 3000, q: 1, amp: 0.3 });
    return this.partials(f, t, [[1, 1, 0.3], [1.48, 0.7, 0.22], [2.9, 0.2, 0.1]], out);
  }

  // Wood and temple blocks: a hollow knock with a short, pitched ring.
  v_block(f, t, v, out) {
    this.noise(t, 0.012, out, { type: 'bandpass', freq: f * 3, q: 2, amp: 0.4 });
    return this.partials(f, t, [[1, 1, 0.1], [2.7, 0.3, 0.04]], out);
  }

  v_tambourine(f, t, v, out) {
    this.partials(170, t, [[1, 0.3, 0.07]], out);
    this.noise(t, 0.22, out, { type: 'bandpass', freq: 7000, q: 1.2, amp: 1 });
    return this.noise(t + 0.05, 0.18, out, { type: 'bandpass', freq: 9000, q: 1.2, amp: 0.5 });
  }

  // Tubular bells: the strike tone and its stretched partials ringing a long time.
  v_chimes(f, t, v, out) {
    this.noise(t, 0.01, out, { type: 'bandpass', freq: 4000, q: 1, amp: 0.2 });
    return this.partials(f, t, [[1, 1, 4.5], [2.0, 0.35, 3], [3.01, 0.3, 2.2], [4.16, 0.2, 1.5], [5.43, 0.1, 1]], out);
  }

  v_glock(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 1.6], [2.71, 0.25 + 0.2 * v, 0.4], [5.1, 0.1 * v, 0.15]], out);
  }

  // A steel pan: a soft attack that blooms into its octave and fifth above.
  v_steelpan(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 1.3, 0.01], [2, 0.6, 0.9, 0.02], [3, 0.3, 0.5, 0.02], [4.02, 0.1, 0.3]], out);
  }

  // The launcher's soft cork pop.
  v_pop(f, t, v, out) {
    this.noise(t, 0.035, out, { type: 'bandpass', freq: 1200, q: 1.5, amp: 1 });
    return this.partials(f, t, [[1, 0.6, 0.06]], out, 0.6, 0.03);
  }

  // One cut-glass pendant: a bright click and a short ring with glass's uneven overtones.
  v_crystal(f, t, v, out) {
    this.noise(t, 0.008, out, { type: 'bandpass', freq: 7000, q: 1.5, amp: 0.5 });
    return this.partials(f, t, [[1, 1, 0.45], [2.32, 0.4, 0.25], [4.25, 0.2, 0.12]], out);
  }

  // A ball landing on upholstery: a low, muffled thump with no ring to it.
  v_thud(f, t, v, out) {
    this.noise(t, 0.09, out, { type: 'lowpass', freq: 260, amp: 0.8 });
    return this.partials(f, t, [[1, 1, 0.12]], out, 1.6, 0.05);
  }

  // A rubber ball landing on the floor: a small muted bop.
  v_bounce(f, t, v, out) {
    this.noise(t, 0.03, out, { type: 'lowpass', freq: 700, amp: 0.5 });
    return this.partials(f, t, [[1, 1, 0.09]], out, 1.5, 0.03);
  }
}
