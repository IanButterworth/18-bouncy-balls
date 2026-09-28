// Play with me: a fixed score for the shop's own two guns, after the shape of
// Music for 18 Musicians. It opens with the Pulses, each chord of the cycle in turn
// over a steady pulse with the organs breathing on it, gives each chord a section of
// its own, and closes with the Pulses again before the balls fall silent one by one.
// Sections take turns. In one, a pattern grows a note at a time on a melody that
// changes a note at a time, with a second gun following in canon, drifting out of
// phase. In the next, the two xylophones play one fast figure, one of them slipping
// slowly out of phase with the other. The guns only start, stop or move to another
// instrument as the chord changes.
import { BAR } from './audio.js';

const CHORDS = 11;
// Bars on each chord in the Pulses, and in each section.
const PULSE_BARS = 4;
const SECTION_BARS = 20;
const OPEN = CHORDS * PULSE_BARS;
const CLOSE = OPEN + CHORDS * SECTION_BARS;
// The last chord of the closing Pulses is held while the balls fall away.
const LAST = CLOSE + OPEN - PULSE_BARS;
// The Pulses begin with two quick notes alone, a pair on the second and third pulse of
// every three, as chord-tone steps: the right gun alone on the central marimba for the
// first chord, then the two guns on the marimbas either side of it. The left one slips
// ahead a pulse every four bars, so every twelve bars it is back in unison. It plays on
// under the Pulses until the first section, and returns for the closing Pulses, losing
// a note a bar from their last chord until it falls silent.
const FIGURE = {
  steps: '. 7 9 . 7 9 . 7 9 . 7 9', phase: { holdBars: 1, drift: 1 / 36 },
  places: [['marimba1', null], ['marimba2', 'marimba0']],
};

// The keys and bars that carry the Pulses, played by the left gun, as chord-tone steps
// from 0 (lowest) to 12.
const PULSE_SPOTS = [
  ['piano', 4], ['marimba1', 6], ['harpsichord', 7], ['marimba0', 8], ['upright', 5], ['marimba2', 4],
  ['piano', 9], ['marimba1', 10], ['metallophone', 6], ['marimba2', 8], ['harpsichord', 3],
];

// Each section is one of two kinds. A melody section names the instrument the right gun
// plays its melody on and the one the left gun follows it on in canon; the melody is
// chord-tone steps from 0 (lowest) to 12 and turns from `cell` into `to` one note at a
// time. A xylophone section gives the twin xylophones' figure in `xylo`: a chord-tone
// step or a rest for each pulse of the bar. `breath` is the organ that breathes over the
// first half and the one over the second; `maracas` and `spin` bring in the maracas and
// spin up the Leslie; `peak` is how many balls the texture swells to.
const SECTIONS = [
  { lead: 'marimba1', canon: 'marimba0', cell: [4, 6, 5, 8, 7], to: [4, 7, 5, 9, 8], breath: ['combo', 'tonewheel'], maracas: true, peak: 34 },
  { xylo: '8 6 9 . 7 10 . 8 11 9 . 7', breath: ['tonewheel', 'pipes'], peak: 30 },
  { lead: 'marimba0', canon: 'marimba2', cell: [5, 7, 6, 9, 8, 7], to: [5, 8, 6, 10, 8, 7], breath: ['combo', 'combo'], maracas: true, peak: 32 },
  { xylo: '9 . 7 10 8 . 11 9 . 7 10 .', breath: ['tonewheel', 'combo'], spin: true, peak: 36 },
  { lead: 'metallophone', canon: 'upright', cell: [6, 8, 7, 10], to: [6, 9, 7, 11], breath: ['pipes', 'tonewheel'], peak: 24 },
  { xylo: '6 8 10 . 9 7 . 11 9 . 8 10', breath: ['combo', 'tonewheel'], maracas: true, spin: true, peak: 40 },
  { lead: 'upright', canon: 'harpsichord', cell: [3, 6, 4, 7], to: [4, 7, 5, 8], breath: ['tonewheel', 'combo'], peak: 30 },
  { xylo: '7 . 9 8 11 . 10 . 8 9 7 .', breath: ['combo', 'pipes'], maracas: true, peak: 32 },
  { lead: 'piano', canon: 'marimba2', cell: [2, 5, 4, 7, 6], to: [3, 6, 5, 8, 7], breath: ['tonewheel', 'combo'], peak: 34 },
  { xylo: '9 11 . 10 8 . 9 12 . 10 11 .', breath: ['combo', 'tonewheel'], maracas: true, spin: true, peak: 38 },
  { lead: 'metallophone', canon: 'piano', cell: [7, 9, 8, 11], to: [7, 10, 8, 12], breath: ['pipes', 'combo'], peak: 24 },
];

// The melody a section has reached by a bar: from the fourth bar, one note every two bars
// changes to the new one.
const melody = (S, b) => S.cell.map((x, i) => (b - 3) / 2 >= i ? S.to[i] : x);
const xyloFigure = (S, name, gun, io) => S.xylo.split(' ').map(x => x === '.' ? null : io.at(name, +x, gun));

// `io` is how the score reaches the shop:
//   at(name, step, gun)         where a gun aims to play a step on an instrument
//   spot(name)                  where to aim at an organ or the maracas
//   shoot(gun, point)           a single shot from the 'left' or 'right' gun
//   hold(points)                the right gun claps out its pattern on these, in turn; null lets go
//   canon(points)               the left gun is pinned to follow on these; null unpins it
//   duet(right, left, phase)    both guns play a figure, a point or null for each pulse of
//                               the bar, the left pinned and drifting as `phase` says, or
//                               by default slowly; no arguments stops
//   rest(pos)                   whether the right gun's pattern leaves this pulse of the bar free
//   cue(bar), cascade(), cap(n) change chord at a bar, drop balls on the bars, set how many balls
//   target(), live()            where a target stands, and how many balls are still in play
//   label(text), end()
export class Autoplay {
  constructor(io) {
    this.io = io;
    this.wait = null;
    this.quiet = 0;
  }

  // Called on every pulse, counted from the start of the performance.
  pulse(q) {
    const bar = Math.floor(q / BAR), pos = q % BAR;
    if (bar < OPEN) this.pulses(bar, pos, bar);
    else if (bar < CLOSE) this.section(Math.floor((bar - OPEN) / SECTION_BARS), (bar - OPEN) % SECTION_BARS, pos, bar);
    else this.pulses(bar - CLOSE, pos, bar, true);
    // A single shot from the right gun waits for a rest in its pattern.
    if (this.wait && this.io.rest(pos)) {
      this.io.shoot('right', this.wait);
      this.wait = null;
    }
  }

  // The Pulses: each chord is pulsed for four bars, and a shot at a target cues the next
  // chord, as the vibraphone does. The opening Pulses start from just the two-note
  // figure drifting in and out of phase; the pulse joins on the second chord and the
  // organs half way through it. The Hammond swells in with each chord, the combo organ
  // breathes over it, and a second breath passes between the three organs from one chord
  // to the next. The closing Pulses thin out and the last chord is left to die away.
  pulses(k0, pos, bar, closing = false) {
    const io = this.io;
    const k = Math.min(CHORDS - 1, Math.floor(k0 / PULSE_BARS));
    const b = k0 - k * PULSE_BARS, p = b * BAR + pos;
    if (bar >= LAST + PULSE_BARS) return this.fade(bar, pos);
    const pulse = closing || k0 >= PULSE_BARS;
    const organs = closing || k0 >= PULSE_BARS + 2;
    // The figure only moves as the chord changes. The last section's guns give way to it
    // as the closing Pulses begin.
    if (closing && k === CHORDS - 1 && pos === 0) this.thinFigure(bar);
    else if (p === 0) {
      const [right, left] = FIGURE.places[closing ? 1 : Math.min(k, FIGURE.places.length - 1)];
      if (closing && k0 === 0) {
        io.hold(null);
        io.duet();
      }
      io.duet(this.figure(right, 'right'), this.figure(left, 'left'), FIGURE.phase);
    }
    if (p === 0) {
      io.label('Pulses');
      if (k === 0) io.cap(closing ? 18 : 6);
      if (k === 1 && !closing) io.cap(16);
    }
    if (!closing && k === 1 && pos % 2 && b < 2) io.shoot('left', io.at(...PULSE_SPOTS[(p >> 1) % PULSE_SPOTS.length], 'left'));
    const spots = closing ? (k < 7 ? 1 : 0) : pulse ? 2 : 0;
    if (p === 4 && spots > 0) io.shoot('left', io.at(...PULSE_SPOTS[(2 * k) % PULSE_SPOTS.length], 'left'));
    if (p === 18 && spots > 1) io.shoot('left', io.at(...PULSE_SPOTS[(2 * k + 1) % PULSE_SPOTS.length], 'left'));
    if (p === 12 && organs) io.shoot('left', io.spot('combo'));
    if (p === 24 && organs) io.shoot('right', io.spot(['pipes', 'combo', 'tonewheel'][(k + 2) % 3]));
    if (p === 36 && !(closing && k === CHORDS - 1)) this.cue(bar + 1);
    if (closing && k === CHORDS - 1 && p === 0) io.cap(10);
  }

  // The opening figure on an instrument, keeping only its first `notes` notes.
  figure(name, gun, notes = Infinity) {
    if (!name) return null;
    return FIGURE.steps.split(' ').map(x => x === '.' || notes-- <= 0 ? null : this.io.at(name, +x, gun));
  }

  // From the last chord, the figure loses a note each bar until the guns fall silent.
  thinFigure(bar) {
    const [right, left] = FIGURE.places[1], notes = FIGURE.steps.split(' ').filter(x => x !== '.').length - (bar - LAST);
    if (notes > 0) this.io.duet(this.figure(right, 'right', notes), this.figure(left, 'left', notes), FIGURE.phase);
    else this.io.duet();
  }

  // The end: the last chord held on while the balls drop out one by one, then silence.
  fade(bar, pos) {
    const io = this.io;
    const b = bar - LAST - PULSE_BARS;
    if (pos === 0) this.thinFigure(bar);
    if (b === 0 && pos === 0) io.shoot('right', io.spot('pipes'));
    if (pos === 0) io.cap(Math.max(0, 8 - b));
    if (io.live() > 0) return;
    if (++this.quiet > 2 * BAR) io.end();
  }

  section(s, b, pos, bar) {
    const io = this.io, S = SECTIONS[s];
    if (pos === 0) {
      if (b === 0) {
        io.label(`Section ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][s]}`);
        io.cascade();
        io.cap(20);
        // Whatever the last section's guns were doing stops here, and this one's starts.
        io.hold(null);
        io.duet();
        // The twin xylophones, one each side: two bars in unison, then the left one
        // slowly slips ahead, a pulse every few bars, until the section ends.
        if (S.xylo) io.duet(xyloFigure(S, 'xylo1', 'right', io), xyloFigure(S, 'xylo0', 'left', io));
      }
      if (b === 1 && S.maracas) io.shoot('left', io.spot('maracas'));
      if (b === 5) io.cap(S.peak);
      // The right gun builds its pattern from the first bar to the last, and the left gun
      // follows in canon, in step at first, then drifting a pulse at a time.
      if (S.lead) {
        const cell = melody(S, b);
        io.hold(cell.map(i => io.at(S.lead, i, 'right')));
        io.canon(cell.map(i => io.at(S.canon, i, 'left')));
      }
      if (b === 16) io.cap(Math.round(S.peak * 0.6));
      if (b === 18) {
        io.cap(14);
        this.cue(bar + 2);
      }
      if (b === 6 || b === 8) this.wait = io.spot(S.breath[0]);
      if (b === 13 || b === 15) this.wait = io.spot(S.breath[1]);
    }
    if (S.spin && (b === 9 || b === 12) && pos === 6) io.shoot('left', io.spot('leslie'));
  }

  // A shot at a target announces the change, which comes at the start of `bar`.
  cue(bar) {
    const t = this.io.target();
    if (t) this.io.shoot('right', t);
    this.io.cue(bar);
  }
}
