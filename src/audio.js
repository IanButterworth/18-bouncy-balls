// All sound is synthesised with Web Audio. Every pitched note is taken from the
// chord that is sounding at that moment, so a pile of simultaneous hits adds up
// to a fuller chord rather than a clash.

// Pachelbel's Canon in D, two beats per chord.
const PROGRESSION = [
  { name: 'D', pcs: [2, 6, 9], add: 4 },
  { name: 'A', pcs: [9, 1, 4], add: 11 },
  { name: 'Bm', pcs: [11, 2, 6], add: 1 },
  { name: 'F♯m', pcs: [6, 9, 1], add: 8 },
  { name: 'G', pcs: [7, 11, 2], add: 9 },
  { name: 'D', pcs: [2, 6, 9], add: 4 },
  { name: 'G', pcs: [7, 11, 2], add: 9 },
  { name: 'A', pcs: [9, 1, 4], add: 11 },
];
const BEAT = 60 / 64;
const CHORD_SECONDS = BEAT * 2;

// Energy needed to reach each symphony level.
const THRESHOLDS = [0, 1.5, 4.5, 9, 15, 22];
export const LEVEL_NAMES = ['Tuning up', 'Solo', 'Duet', 'Quartet', 'Orchestra', 'Symphony!'];

// Voices whose physical instrument is a fixed scale get the added ninth too.
const EXTENDED = new Set(['mallet', 'glock', 'chime', 'bell', 'click', 'pop']);

const LEVEL = {
  mallet: 0.55, glock: 0.3, chime: 0.28, bell: 0.3, pluck: 0.75, piano: 0.42,
  brass: 0.3, bowed: 0.24, organ: 0.17, kick: 0.9, tom: 0.6, timpani: 0.7,
  snare: 0.32, hihat: 0.16, crash: 0.18, ride: 0.22, gong: 0.5, wood: 0.3,
  boing: 0.16, thud: 0.3, click: 0.08, pop: 0.12,
};

// Sustained backing layers that fade in as the shop gets busier.
const PAD = [
  { range: [33, 45], count: 1, root: true, cutoff: 520, level: 0.5, from: 1, to: 4.5 },
  { range: [55, 71], count: 4, cutoff: 2600, level: 0.17, from: 4, to: 10, vibrato: true },
  { range: [50, 64], count: 3, cutoff: 1100, level: 0.2, from: 9, to: 16 },
  { range: [64, 79], count: 3, choir: true, level: 0.24, from: 14, to: 24, vibrato: true },
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
      if (this.ctx.state !== 'running') this.ctx.resume();
      return;
    }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.out = ctx.createGain();
    this.out.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.7;
    this.padBus = ctx.createGain();
    this.padBus.gain.value = 0.8;
    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(3.8);
    const send = ctx.createGain();
    send.gain.value = 0.5;
    const padSend = ctx.createGain();
    padSend.gain.value = 0.9;
    this.bus.connect(comp);
    this.bus.connect(send);
    this.padBus.connect(comp);
    this.padBus.connect(padSend);
    send.connect(reverb);
    padSend.connect(reverb);
    reverb.connect(comp);
    comp.connect(this.out);
    this.out.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;

    this.ks = new Map();
    this.active = 0;
    this.t0 = ctx.currentTime + 0.1;
    this.lastChord = -1;
    this.lastBeat = -1;
    this.layers = PAD.map(spec => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.padBus);
      return { spec, gain, voices: [], target: 0 };
    });
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.out.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  // A warm stereo tail: decaying noise that loses its highs as it fades.
  impulse(seconds) {
    const ctx = this.ctx, sr = ctx.sampleRate, len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let y = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const a = 0.9 - 0.75 * t;
        y += a * ((Math.random() * 2 - 1) - y);
        d[i] = y * Math.pow(1 - t, 2.6) * (i < sr * 0.01 ? i / (sr * 0.01) : 1);
      }
    }
    return buf;
  }

  chordAt(t) {
    const idx = Math.floor((t - this.t0) / CHORD_SECONDS);
    return PROGRESSION[mod(idx, PROGRESSION.length)];
  }

  chord() {
    // Look slightly ahead so a hit on the boundary lands in the new chord.
    return this.ctx ? this.chordAt(this.ctx.currentTime + 0.06) : PROGRESSION[0];
  }

  notesIn(lo, hi, chord, extended) {
    const pcs = extended ? [...chord.pcs, chord.add] : chord.pcs;
    const out = [];
    for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) out.push(m);
    return out;
  }

  pick(lo, hi, slot, step, extended, chord = this.chord()) {
    const notes = this.notesIn(lo, hi, chord, extended);
    if (!notes.length) return lo;
    const i = Math.round(clamp(slot, 0, 1) * (notes.length - 1)) + step;
    return notes[mod(i, notes.length)];
  }

  rootIn(lo, hi, chord) {
    for (let m = lo; m <= hi; m++) if (m % 12 === chord.pcs[0]) return m;
    return lo;
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
  hit(voice, lo, hi, slot, step, vel, pan = 0) {
    if (!this.ready()) return null;
    if (this.active > 110) return null;
    if (this.active > 70 && vel < 0.35) return null;
    const midi = this.pick(lo, hi, slot, step, EXTENDED.has(voice));
    this.play(voice, midi, vel, pan);
    return midi;
  }

  play(voice, midi, vel, pan = 0, delay = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.004 + delay;
    const out = ctx.createGain();
    out.gain.value = (LEVEL[voice] ?? 0.3) * (0.12 + 0.88 * vel);
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    out.connect(p).connect(this.bus);
    const end = this['v_' + voice](mtof(midi), t, vel, out, midi);
    this.active++;
    setTimeout(() => { this.active--; p.disconnect(); }, (end - ctx.currentTime) * 1000 + 250);
  }

  fanfare(pan, power) {
    if (!this.ready()) return;
    const chord = this.chord();
    const high = this.notesIn(74, 98, chord, false);
    const n = Math.min(high.length, 3 + Math.min(power, 3));
    for (let i = 0; i < n; i++) this.play('glock', high[i], 0.85, pan, i * 0.065);
    for (const m of this.notesIn(62, 73, chord, false)) this.play('brass', m, 0.75, pan * 0.5, 0.02);
    this.play('timpani', this.rootIn(38, 49, chord), 0.8, 0);
    if (power >= 3) this.play('crash', high[0], 0.5, pan);
  }

  // Called every frame: decays energy, drives the backing layers and the pulse.
  update(dt) {
    this.energy *= Math.exp(-dt / 4.2);
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    const idx = Math.floor((now - this.t0 + 0.12) / CHORD_SECONDS);
    const chordChanged = idx !== this.lastChord;
    const tc = this.t0 + idx * CHORD_SECONDS;
    if (chordChanged) this.lastChord = idx;
    const chord = PROGRESSION[mod(idx, PROGRESSION.length)];

    for (const layer of this.layers) {
      const s = layer.spec;
      const target = s.level * smooth(this.energy, s.from, s.to);
      if (Math.abs(target - layer.target) > 0.002) {
        layer.target = target;
        layer.gain.gain.setTargetAtTime(target, now, 0.5);
      }
      const want = target > 0.003;
      if (want && (chordChanged || !layer.voices.length)) {
        this.releaseLayer(layer, Math.max(now, tc));
        layer.voices = this.voicing(s, chord).map(m => this.padVoice(s, m, Math.max(now, tc), layer.gain));
      } else if (!want && layer.voices.length && layer.gain.gain.value < 0.002) {
        this.releaseLayer(layer, now);
      }
    }

    const b = Math.floor((now - this.t0 + 0.08) / BEAT);
    if (b !== this.lastBeat) {
      this.lastBeat = b;
      const tb = this.t0 + b * BEAT;
      const delay = Math.max(0, tb - now);
      const lv = this.level;
      const bc = this.chordAt(tb + 0.01);
      if (lv >= 2 && !this.muted) this.play('pluck', this.rootIn(38, 49, bc), 0.4, 0, delay);
      if (lv >= 4 && b % 2 === 0 && !this.muted) this.play('timpani', this.rootIn(36, 47, bc), 0.45, 0, delay);
    }
  }

  voicing(s, chord) {
    if (s.root) return [this.rootIn(s.range[0], s.range[1], chord)];
    const notes = this.notesIn(s.range[0], s.range[1], chord, false);
    if (notes.length <= s.count) return notes;
    const out = [];
    for (let i = 0; i < s.count; i++) out.push(notes[Math.round(i * (notes.length - 1) / (s.count - 1))]);
    return out;
  }

  releaseLayer(layer, t) {
    for (const v of layer.voices) v.stop(t);
    layer.voices = [];
  }

  padVoice(s, midi, t, dest) {
    const ctx = this.ctx, f = mtof(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(1 / Math.sqrt(s.count), t, 0.28);
    let input;
    if (s.choir) {
      input = ctx.createGain();
      for (const [fq, q, a] of [[730, 7, 1], [1090, 8, 0.6], [2440, 10, 0.25]]) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = fq;
        bp.Q.value = q;
        const ga = ctx.createGain();
        ga.gain.value = a * 3;
        input.connect(bp).connect(ga).connect(g);
      }
    } else {
      input = ctx.createBiquadFilter();
      input.type = 'lowpass';
      input.frequency.value = s.cutoff;
      input.Q.value = 0.5;
      input.connect(g);
    }
    g.connect(dest);
    const oscs = [];
    let lfo;
    if (s.vibrato) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = 4.8 + Math.random();
      const lg = ctx.createGain();
      lg.gain.value = f * 0.004;
      lfo.connect(lg);
      lfo.start(t);
      lfo.depth = lg;
    }
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det + (Math.random() - 0.5) * 4;
      if (lfo) lfo.depth.connect(o.frequency);
      o.connect(input);
      o.start(t);
      oscs.push(o);
    }
    if (lfo) oscs.push(lfo);
    return {
      stop(at) {
        const p = g.gain;
        if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(at);
        else { p.cancelScheduledValues(at); p.setValueAtTime(p.value, at); }
        p.setTargetAtTime(0, at, 0.35);
        for (const o of oscs) o.stop(at + 2.5);
        setTimeout(() => g.disconnect(), (at - ctx.currentTime + 2.6) * 1000);
      },
    };
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

  v_brass(f, t, v, out) {
    const ctx = this.ctx;
    const hold = 0.3 + 0.35 * v, end = t + hold + 0.3;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2.5;
    lp.frequency.setValueAtTime(f * 1.2, t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(f * (3 + 8 * v), 12000), t + 0.06);
    lp.frequency.exponentialRampToValueAtTime(Math.min(f * (2 + 2 * v), 12000), t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.65, t + 0.18);
    g.gain.setValueAtTime(0.65, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.97, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(end + 0.05);
    }
    lp.connect(g).connect(out);
    return end;
  }

  v_bowed(f, t, v, out) {
    const ctx = this.ctx;
    const hold = 0.5 + 0.5 * v, end = t + hold + 0.6;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = clamp(f * 6, 800, 5000);
    lp.Q.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.007, t + 0.3);
    lfo.connect(lg);
    lfo.start(t);
    lfo.stop(end + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.3);
    g.gain.setValueAtTime(0.7, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    for (const det of [-9, 0, 9]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      lg.connect(o.frequency);
      o.connect(lp);
      o.start(t);
      o.stop(end + 0.05);
    }
    lp.connect(g).connect(out);
    this.noise(t, 0.08, out, { type: 'bandpass', freq: f * 3, q: 2, amp: 0.1 * v });
    return end;
  }

  v_organ(f, t, v, out) {
    const ctx = this.ctx;
    const hold = 0.45 + 0.35 * v, end = t + hold + 0.3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.025);
    g.gain.setValueAtTime(1, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    g.connect(out);
    for (const [r, a] of [[1, 1], [2, 0.55], [3, 0.35], [4, 0.2], [6, 0.12]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f * r;
      const ga = ctx.createGain();
      ga.gain.value = a;
      o.connect(ga).connect(g);
      o.start(t);
      o.stop(end + 0.05);
    }
    this.noise(t, 0.04, out, { type: 'bandpass', freq: f * 4, q: 3, amp: 0.15 });
    return end;
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

  // A rubbery bounce: the pitch springs up into the note.
  v_boing(f, t, v, out) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f * 0.6, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    o.frequency.exponentialRampToValueAtTime(f * 0.96, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.28);
    return t + 0.28;
  }

  v_thud(f, t, v, out) {
    this.noise(t, 0.06, out, { type: 'lowpass', freq: 500, amp: 0.5 });
    return this.partials(f, t, [[1, 1, 0.18]], out, 2, 0.1);
  }

  v_click(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 0.05], [2.4, 0.3, 0.03]], out);
  }

  v_pop(f, t, v, out) {
    return this.partials(f, t, [[1, 1, 0.09]], out, 0.5, 0.03);
  }
}
