# Music for 18 Bouncy Balls

A 3D bouncy-ball shooting gallery set in a Belle Époque Paris music shop,
Maison Ricochet, and a quiet homage to Steve Reich's *Music for 18 Musicians*.
Its ensemble fills the shop floor in an arc: three marimbas, two xylophones, a
metallophone, three pianos, a French harpsichord and maracas, with cellos and
double basses among them played pizzicato, and plucked strings round the walls. There are three organs: at the back left a tonewheel organ with its
rotating Leslie cabinet, at the back right a gothic chamber pipe organ with reed
stops, and by the left window a Farfisa-style combo organ like those of Reich's
*Four Organs*.

The shop keeps one steady pulse, five to the second in bars of twelve.

- Every note a ball strikes waits for the pulse, and is drawn from the current
  chord of an eleven-chord cycle in A major and F sharp minor.
- A ball that lands on a bar, a keyboard or the maracas is tuned to bounce back a
  whole number of pulses later, nearly on the spot, so it becomes a repeating
  pattern. Patterns of different lengths interlock and drift against each
  other; balls fade after forty seconds and the texture turns over.
- Held fire claps out a 12-pulse pattern, built up one note for every bar you
  hold on. Each section of the cycle has its own, opening and closing on the
  pattern of *Clapping Music*. When the section changes, the gun's rhythm moves
  to the new pattern gradually, one note dropping out and one coming in each
  bar, so the change arrives over several bars as it does in the piece.
- Right-click (or tap with a second finger) to pin a second gun, held in your
  left hand, to a spot in the shop. It keeps firing your pattern there,
  in step at first; then, as in *Piano Phase*, it runs a touch faster until it is
  one pulse ahead, holds, and moves ahead again, stepping through every offset
  until it is back in phase. Right-click the pin to clear it.
- Every note comes from something being struck in the room; only the organs
  sustain on their own once struck.
- Hitting a target rings it once and moves the ensemble to the next chord at the
  next bar, with the Leslie organ swelling in. A cascade of balls then drops from
  the beams onto the bars, one every other pulse, each settling into a new
  pattern, and the balls already bouncing live on for longer. Left alone, a
  section moves on by itself.
- Striking the organ or its Leslie swells a chord through the cabinet: the horn
  and drum rotors spin up from chorale to tremolo, so the vibrato grows with the
  swell, then wind down as it fades.
- Striking the pipe organ swells a deep, reedy chord on a 16-foot bass, opening
  slowly like a swell box and wavering with a deep tremulant.
- Striking the combo organ swells bright square-wave reeds with its own quick
  vibrato.
- Striking any organ again while it sounds builds the swell louder and holds
  it longer; the build-up ebbs away over a few seconds without more strikes.
- The ensemble breathes, swelling and fading every few seconds.

Sound is placed where it happens. Each note comes from the point the ball
struck, through an HRTF panner relative to where you stand and look, quieter
and duller with distance, and late by the time sound takes to cross the room.
The walls, floor and ceiling each send back a first-order reflection, and a
late reverb sized for the furnished shop sits just under the direct sound.
Audio pauses while the page is in the background.

## Scoring

- A bullseye is worth more the deeper into the shop it is.
- Each instrument a ball bounces off before the hit adds a ricochet multiplier.
- The ensemble level, from Pulse to Eighteen, multiplies everything.

## Playing

Play it at <https://ianbutterworth.github.io/18-bouncy-balls/>.

## Running locally

No build step. Serve the directory and open it in a browser:

```sh
python3 -m http.server 8765
# then open http://localhost:8765
```

three.js and cannon-es load from jsDelivr, so the first load needs a network
connection. All sound is synthesised in the browser with Web Audio.

The site is published with GitHub Pages straight from the `main` branch; there
is nothing to build. Google Analytics loads only on the published site: set
`GA_ID` in `index.html` to the GA4 measurement ID.

Controls: click (or tap) to launch on the next pulse, hold to build the pattern, right-click (or a second finger) to pin the second gun, `M` to mute.

## Layout

- `src/main.js`: renderer, physics world, balls, input, game loop and HUD.
- `src/shop.js`: the room and every instrument, each with a physics proxy.
- `src/decor.js`: books, lamps, window light, dust and the rest of the clutter.
- `src/percussion.js`: the xylophones, metallophone and maracas.
- `src/organ.js`: the tonewheel organ and its Leslie cabinet, the pipe organ and the combo organ.
- `src/audio.js`: the pulse, the chord cycle, the synthesised voices and the room acoustics.
- `src/targets.js`: bullseyes on posts, ropes and sliding rails.
- `src/effects.js`: floating notes, confetti and score popups.
