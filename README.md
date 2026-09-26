# Ricochet Rhapsody

A 3D bouncy-ball shooting gallery set in a Belle Époque Paris music shop,
Maison Ricochet. Launch extra-bouncy balls at the bullseyes hidden among nearly
two hundred things a ball can make ring: a jazz drum kit, congas, a djembe,
darbukas and a cajón; a marimba, vibraphone, xylophone and glockenspiel; steel
pans, a handpan, singing bowls, gongs, cymbals, tubular chimes, wind chimes,
bells, triangles, cowbells, temple blocks and tuned wine glasses; kalimbas,
guitars, mandolins, a harp, pizzicato strings and two pianos; and crystal
chandeliers.

Every sound is something a ball could really make: instruments are struck, plucked or knocked, never blown or bowed, plus a pop at launch, a soft bounce on the floor and a chime for a hit target. Each note comes from the chord
of the moment: extended, modal harmony in the manner of Debussy and Ravel
(maj9, m11, maj7♯11, 13sus, a whole-tone colour) that drifts to a neighbouring
chord every few seconds, with no set progression. However many things ring at
once, they blend into one rich chord.

Sound is placed where it happens. Each note comes from the point the ball struck,
through an HRTF panner relative to where you stand and look, quieter and duller
with distance, and late by the time sound takes to cross the room. The walls,
floor and ceiling each send back a first-order reflection from the source's
mirror image, and a late reverb sized for the furnished shop (about 1.1 s) sits
just under the direct sound. Audio pauses while the page is in the background.

## Scoring

- A bullseye is worth more the deeper into the shop it is.
- Each instrument a ball bounces off before the hit adds a ricochet multiplier.
- The symphony level multiplies everything.

## Running

No build step. Serve the directory and open it in a browser:

```sh
python3 -m http.server 8765
# then open http://localhost:8765
```

three.js and cannon-es load from jsDelivr, so the first load needs a network
connection. All sound is synthesised in the browser with Web Audio.

Controls: click (or tap) to launch, hold for rapid fire, `M` to mute.

## Layout

- `src/main.js`: renderer, physics world, balls, input, game loop and HUD.
- `src/shop.js`: the room and every instrument, each with a physics proxy.
- `src/decor.js`: books, lamps, window light, dust and the rest of the clutter.
- `src/audio.js`: the drifting harmony, the synthesised voices and the room acoustics.
- `src/targets.js`: bullseyes on posts, ropes and sliding rails.
- `src/effects.js`: floating notes, confetti and score popups.
