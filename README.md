# Ricochet Rhapsody

A 3D bouncy-ball shooting gallery set in a music shop. Launch extra-bouncy balls
at the bullseyes hidden among drums, a grand piano, a marimba, tubular chimes,
guitars, cellos, brass, a gong, handbells and a pipe organ.

Every instrument plays notes from the chord that is sounding at that moment
(the progression from Pachelbel's Canon in D), so the more things you set
ringing, the fuller the harmony gets. Keep the shop busy and string sections,
horns and a choir fade in underneath, from a solo up to a full symphony.

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
- `src/audio.js`: chord tracking, instrument voices and the backing layers.
- `src/targets.js`: bullseyes on posts, ropes and sliding rails.
- `src/effects.js`: floating notes, confetti and score popups.
