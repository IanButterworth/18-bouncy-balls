import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { Music, LEVEL_NAMES, PULSE, BAR } from './audio.js';
import { Shop, buildShop } from './shop.js';
import { buildDecor, SUN_DIR } from './decor.js';
import { buildPercussion } from './percussion.js';
import { buildOrgan } from './organ.js';
import { Targets } from './targets.js';
import { Effects } from './effects.js';
import { Autoplay } from './autoplay.js';

const BALL_R = 0.11;
const BALL_SPEED = 15;
// Balls live long enough for their patterns to overlap and build, then fade so the texture turns over.
const BALL_LIFE = 40;
const MAX_BALLS = 48;
const GRAVITY = 9;
// Held fire claps out a 12-pulse pattern, one for each section of the chord cycle,
// listed in the order its notes build up. The cycle opens and closes on the pattern
// of Reich's Clapping Music; between, the patterns thin out and thicken again.
const SECTION_PATTERNS = [
  [0, 7, 4, 10, 2, 5, 9, 1],
  [0, 6, 3, 9],
  [0, 6, 3, 9, 1, 7],
  [0, 4, 8, 2, 6, 10],
  [0, 3, 6, 9, 1, 4, 7, 10],
  [0, 7, 2, 5, 10],
  [0, 4, 8, 2, 6, 10, 1, 5, 9],
  [0, 5, 10, 3, 8],
  [0, 1, 6, 7, 3, 9],
  [0, 9, 5, 2, 11, 7],
  [0, 7, 4, 10, 2, 5, 9, 1, 11],
];
// Held fire starts from this many notes of the pattern and adds one per bar held.
const PATTERN_START = 3;
// A ball bouncing on an instrument that keeps a pattern bounces for a whole number of pulses.
const OSTINATO_PULSES = [2, 8];
// Balls a struck target drops onto the bars, one every other pulse.
const CASCADE = 8;
// The pinned second gun phases against the first, as in Reich's Piano Phase: it holds
// in step for a few bars, then runs this much faster until it is a pulse ahead.
const PHASE = { holdBars: 3, drift: 1 / 24 };
// Play with me's twin xylophones drift more slowly, lingering just out of phase.
const DUET_PHASE = { holdBars: 2, drift: 1 / 60 };
const CAMERA_POS = new THREE.Vector3(0, 1.85, 6.7);
// Play with me steps the physics this many times a pulse. Its own two guns stand on
// the counter, wider apart than the player's, and fire from these fixed points.
const STEPS = 36;
const STEP = PULSE / STEPS;
const BAND_AT = {
  right: new THREE.Vector3(1.2, 1.35, 5.2),
  left: new THREE.Vector3(-1.2, 1.35, 5.2),
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
// Phones and tablets: taps instead of clicks, a second finger instead of a right-click.
const IS_TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches;
const $ = id => document.getElementById(id);
// A small seeded generator, so Play with me makes the same choices every time.
const seeded = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let rand = Math.random;

// --- renderer and scene --------------------------------------------------------------

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0906);
// A faint warm haze, so the back of the shop recedes into dusty lamplight.
scene.fog = new THREE.FogExp2(0x1a110b, 0.028);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.28;

const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 60);
camera.position.copy(CAMERA_POS);
camera.rotation.order = 'YXZ';
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xffe6c8, 0x2a1a10, 0.22));
// Cool afternoon daylight falling in through the shop windows on the left.
const sun = new THREE.DirectionalLight(0xdfe6ff, 1.6);
sun.target.position.set(2, 0, -1);
sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, -20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 10, bottom: -10, near: 1, far: 30 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// Bloom blurs through ever smaller copies of the frame, so one NaN or overflowing
// glint from a polished surface would grow into a black square. Clamp them first.
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c.rgb)) || any(isinf(c.rgb))) c.rgb = vec3(0.0);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 24.0), c.a);
    }`,
}));
// Only the lamps, candles and daylit windows are bright enough to bloom.
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.6, 0.92));
composer.addPass(new OutputPass());
const vignette = new ShaderPass(VignetteShader);
vignette.uniforms.offset.value = 1.0;
vignette.uniforms.darkness.value = 1.25;
composer.addPass(vignette);

// --- physics -------------------------------------------------------------------------

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.solver.iterations = 8;
const pm = {
  ball: new CANNON.Material('ball'),
  hard: new CANNON.Material('hard'),
  drum: new CANNON.Material('drum'),
  floor: new CANNON.Material('floor'),
  wall: new CANNON.Material('wall'),
};
// Restitution is tuned high so balls keep bouncing around the shop for a good while.
for (const [other, restitution, friction] of [
  [pm.hard, 0.86, 0.05], [pm.drum, 0.97, 0.05], [pm.floor, 0.84, 0.08], [pm.wall, 0.8, 0.05], [pm.ball, 0.93, 0.02],
]) world.addContactMaterial(new CANNON.ContactMaterial(pm.ball, other, { restitution, friction }));

// --- the shop --------------------------------------------------------------------------

// The shop's books and hooks are placed with a little randomness. Draw it from a fixed
// seed, so the room is laid out the same way every time and Play with me always meets it.
const random = Math.random;
Math.random = seeded(1885);
const shop = new Shop(scene, world, pm);
const { chair } = buildShop(shop);
buildPercussion(shop, chair);
buildOrgan(shop);
const decor = buildDecor(shop);
shop.finalize();
Math.random = random;
const targets = new Targets(scene, world, pm);
const fx = new Effects(scene, camera);
const music = new Music();
music.leslieAt = shop.leslie.pos;
music.churchAt = shop.church.pos;
music.comboAt = shop.combo.pos;

// --- launcher: a brass bell that follows the aim ------------------------------------------

function makeBell() {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push(new THREE.Vector2(0.05 + 0.11 * Math.pow(t, 3), t * 0.5));
  }
  const bell = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 32),
    new THREE.MeshStandardMaterial({ color: 0xe3b04b, metalness: 1, roughness: 0.25, side: THREE.DoubleSide }),
  );
  bell.rotation.x = -Math.PI / 2;
  bell.position.z = -0.1;
  g.add(bell);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.018, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0xb3202a, roughness: 0.3 }),
  );
  ring.position.z = -0.05;
  g.add(ring);
  const mouth = new THREE.Object3D();
  mouth.position.z = -0.62;
  g.add(mouth);
  g.userData.mouth = mouth;
  return g;
}

const launcher = makeBell();
launcher.position.set(0.5, -0.42, -0.85);
launcher.scale.setScalar(0.4);
camera.add(launcher);
const LAUNCHER_REST = launcher.position.clone();
// How far to tilt the view up on tall screens, so the counter drops out of the bottom.
let tiltUp = 0;
const mouth = launcher.userData.mouth;

// The second gun, held in the left hand, fires at a pinned spot.
const phaser = makeBell();
phaser.scale.setScalar(0.4);
const PHASER_REST = new THREE.Vector3(-0.5, -0.42, -0.85);
phaser.position.copy(PHASER_REST);
camera.add(phaser);
// How to use the left gun, engraved round the top of its bell's flare, which faces the player.
{
  const label = IS_TOUCH ? 'second finger' : 'right click';
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d');
  g.font = `italic 600 ${IS_TOUCH ? 66 : 78}px Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,236,170,0.5)';
  g.fillText(label, 257, 83);
  g.fillStyle = 'rgba(60,36,10,0.9)';
  g.fillText(label, 256, 80);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Seen from behind, the band's texture runs right to left and from the neck up
  // towards the mouth, so flip it both ways to read normally.
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = -1;
  const arc = 1.8;
  // A band of cone matching the flare between 0.43 and 0.49 along the bell.
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.105, 0.06, 24, 1, true, Math.PI - arc / 2, arc),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, metalness: 0.4, roughness: 0.5, depthWrite: false }),
  );
  band.rotation.x = Math.PI / 2;
  band.position.z = -0.46;
  phaser.add(band);
}
const pinMark = new THREE.Mesh(
  new THREE.TorusGeometry(0.2, 0.025, 10, 40),
  new THREE.MeshStandardMaterial({ color: 0xffd070, emissive: 0xffb040, emissiveIntensity: 2, metalness: 0.5, roughness: 0.3 }),
);
pinMark.visible = false;
scene.add(pinMark);

// Play with me's two guns: brass bells on posts at either end of the counter.
const bandGuns = {};
{
  const brass = new THREE.MeshStandardMaterial({ color: 0xe3b04b, metalness: 1, roughness: 0.3 });
  for (const side of ['right', 'left']) {
    const at = BAND_AT[side];
    const group = new THREE.Group();
    const bell = makeBell();
    bell.scale.setScalar(0.6);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, at.y - 1.01, 12), brass);
    post.position.set(at.x, (at.y + 1.01) / 2, at.z);
    group.add(bell, post);
    group.visible = false;
    scene.add(group);
    bandGuns[side] = { group, bell, look: new THREE.Vector3(at.x * 2, 1.2, 0), kick: 0 };
  }
}

// --- balls -------------------------------------------------------------------------------

const BALL_COLORS = [0xff4d6d, 0xffb703, 0x3a86ff, 0x8ac926, 0xff7b00, 0xc77dff, 0x00c2a8, 0xf15bb5];
const ballGeo = new THREE.SphereGeometry(BALL_R, 28, 18);
const ballMats = BALL_COLORS.map(c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 }));
const balls = [];
let colorIdx = 0;

function launch(from, to) {
  const body = new CANNON.Body({
    mass: 0.15, material: pm.ball, shape: new CANNON.Sphere(BALL_R),
    linearDamping: 0, angularDamping: 0.2,
    sleepSpeedLimit: 0.25, sleepTimeLimit: 0.6,
  });
  body.position.set(from.x, from.y, from.z);
  // Solve for the launch velocity that lands exactly on the crosshair despite gravity.
  const dist = from.distanceTo(to);
  const t = Math.max(0.12, dist / BALL_SPEED);
  const v = to.clone().sub(from).divideScalar(t);
  v.y += GRAVITY * t / 2;
  body.velocity.set(v.x, v.y, v.z);
  body.angularVelocity.set(rand() * 20 - 10, rand() * 20 - 10, rand() * 20 - 10);
  body.ball = true;

  const holder = new THREE.Group();
  const m = new THREE.Mesh(ballGeo, ballMats[colorIdx++ % ballMats.length]);
  m.castShadow = true;
  holder.add(m);
  scene.add(holder);
  const ball = { body, holder, mesh: m, age: 0, squash: 0, bounces: 0, dying: false };
  body.addEventListener('collide', e => onCollide(ball, e));
  world.addBody(body);
  balls.push(ball);
  const cap = game.state === 'auto' ? Math.min(auto.cap, MAX_BALLS) : MAX_BALLS;
  if (balls.filter(b => !b.dying).length > cap) balls.find(b => !b.dying).dying = true;
  return ball;
}

const pending = [];
const tmp = new THREE.Vector3();

function onCollide(ball, e) {
  const c = e.contact;
  const impact = Math.abs(c.getImpactVelocityAlongNormal());
  if (impact < 0.45) return;
  const other = e.body;
  const mine = c.bi === ball.body;
  const b = mine ? c.bi : c.bj, r = mine ? c.ri : c.rj;
  const point = new THREE.Vector3(b.position.x + r.x, b.position.y + r.y, b.position.z + r.z);
  ball.squash = Math.min(1, impact / 9);
  // Collisions fire mid-step, so the work is queued and done after the step.
  pending.push({ ball, other, impact, point });
}

// Tunes a bounce off a bar, piano or maraca so the ball comes back down a whole number
// of pulses later, and nearly straight down, so it keeps landing on the same note.
// Each ball becomes an ostinato; balls with different lengths phase against each other.
function lockToPulse(body) {
  const vy = body.velocity.y;
  if (vy < 0.5) return;
  const pulses = clamp(Math.round(2 * vy / GRAVITY / PULSE), ...OSTINATO_PULSES);
  body.velocity.y = pulses * PULSE * GRAVITY / 2;
  body.velocity.x *= 0.08;
  body.velocity.z *= 0.08;
}

function handleCollision({ ball, other, impact, point }) {
  const vel = clamp(impact / 11, 0, 1);
  if (other.ball) return;
  if (other.target) {
    hitTarget(other.target, ball, point);
    return;
  }
  if (other.material === pm.floor) {
    music.effect('bounce', 43, vel, point.toArray());
    return;
  }
  const inst = other.inst;
  if (!inst || !inst.voice) return;
  if (inst.thud) {
    music.effect('thud', 36, vel, point.toArray());
    return;
  }
  if (inst.ostinato) lockToPulse(ball.body);
  if (inst.swell) {
    const now = clockMs();
    if (now - inst.last < 400) return;
    inst.last = now;
    if (inst.swell === 'church') music.churchSwell(2);
    else if (inst.swell === 'combo') music.comboSwell(1);
    else if (inst.swell === 'leslie') music.spin(vel);
    else music.swell(1);
    music.addEnergy(vel);
    shop.hit(inst, vel);
    fx.note(point, 57, vel);
    return;
  }
  const now = clockMs();
  if (now - inst.last < 45) return;
  inst.last = now;
  // Which way and how hard the ball struck, for things hung free to swing.
  const push = point.clone().sub(ball.body.position).normalize().multiplyScalar(impact);
  if (inst.jingle) {
    music.jingle(point.toArray(), vel);
    music.addEnergy(vel);
    shop.hit(inst, vel, push);
    fx.note(point, 96, vel);
    return;
  }
  const slot = inst.slotFrom ? inst.slotFrom(point.clone()) : inst.slot;
  const step = inst.arp ? inst.hits % 3 : 0;
  inst.hits++;
  // Balls from the pinned gun sound on its own drifting pulse, so it is heard slipping
  // gradually out of phase rather than jumping from one step of the grid to the next.
  const lag = ball.phased?.at ? ball.phased.lead * PULSE : 0;
  const midi = music.hit(inst.voice, inst.lo, inst.hi, slot, step, vel, point.toArray(), inst.gliss, lag);
  ball.bounces++;
  music.addEnergy(vel);
  shop.hit(inst, vel, push);
  fx.note(point, midi, vel);
}

// --- game state ----------------------------------------------------------------------------

const game = { state: 'menu', score: 0, shown: 0 };
// Play with me: its score, the physics step it has reached, the pulse it started on,
// and how many balls it wants in play.
const auto = { score: null, step: 0, start: 0, cap: MAX_BALLS };
const clockMs = () => game.state === 'auto' ? auto.step * STEP * 1000 : performance.now();

function hitTarget(t, ball, point) {
  if (!targets.strike(t)) return;
  const playing = game.state === 'playing';
  const bank = Math.min(ball.bounces, 5);
  const mult = music.level + 1;
  const depth = Math.round(clamp(CAMERA_POS.z - point.z, 0, 14) * 8);
  const points = (100 + depth) * (1 + bank) * mult;
  if (playing) game.score += points;
  const subs = [];
  if (bank) subs.push(`Ricochet ×${1 + bank}`);
  if (mult > 1) subs.push(`${LEVEL_NAMES[music.level]} ×${mult}`);
  if (playing) fx.popup(point, `+${points.toLocaleString()}`, subs.join(' · '), bank + mult > 3);
  fx.burst(point, 50 + 15 * mult);
  // The target itself rings once, like a struck bar.
  music.hit('metallophone', 79, 91, Math.random(), 0, 0.8, point.toArray());
  if (game.state !== 'auto' && music.cue()) {
    if (playing) fx.popup(point, 'Next section', '', false);
    // The patterns already bouncing carry on through the change, and a cascade of
    // balls drops onto the bars to build new ones.
    for (const b of balls) if (!b.dying) b.age = Math.max(0, b.age - 10);
    cascade = CASCADE;
  }
  if (playing) targets.grow();
  music.addEnergy(1);
  music.addEnergy(1);
}

function start() {
  music.init();
  game.state = 'playing';
  game.score = game.shown = 0;
  for (const b of balls) b.dying = true;
  targets.reset();
  $('overlay').classList.add('hidden');
  $('hud').classList.remove('hidden');
  // The portrait note fades a few seconds into play.
  $('landscape').classList.remove('faded');
  setTimeout(() => $('landscape').classList.add('faded'), 5000);
  showHint(IS_TOUCH
    ? 'Tap to launch · hold to build a pattern · a second finger pins the left gun to a spot'
    : 'Click to launch · hold to build a pattern · right-click pins the left gun to a spot', 4500);
}

let hintTimer = 0;
function showHint(text, ms) {
  $('hint').textContent = text;
  $('hint').classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => $('hint').classList.remove('show'), ms);
}

$('play').addEventListener('click', start);
$('auto').addEventListener('click', startAuto);
$('home').addEventListener('click', goHome);

// Where Play with me aims: a bar or key of an instrument, `step` from 0 (lowest) to 12.
// The cellos and basses hide parts of the grand piano and harpsichord from each gun,
// so on those each gun spreads the steps over the stretches it has a clear shot at,
// given as ranges across the instrument in metres. Struck bars bob and maracas jiggle,
// so every spot is taken once, at rest, before anything is played.
const aimSpots = {};
{
  const ins = shop.instruments;
  const bars = voice => ins.filter(i => i.voice === voice && i.ostinato);
  const mallets = bars('mallet'), xylos = bars('xylo');
  const row = list => step => list[Math.round(step / 12 * (list.length - 1))].node.localToWorld(new THREE.Vector3(0, 0.03, 0));
  const keys = (inst, y, z, clear) => (step, gun) => {
    const spans = clear[gun];
    let x = step / 12 * spans.reduce((a, [lo, hi]) => a + hi - lo, 0);
    for (const [lo, hi] of spans) {
      if (x <= hi - lo) return inst.node.localToWorld(new THREE.Vector3(lo + x, y, z));
      x -= hi - lo;
    }
    return inst.node.localToWorld(new THREE.Vector3(spans.at(-1)[1], y, z));
  };
  const [grand, upright] = ins.filter(i => i.voice === 'piano' && i.wobble === 'none');
  const harpsichord = ins.find(i => i.voice === 'harpsichord' && i.wobble === 'none');
  const organ = swell => ins.find(i => i.swell === swell).node;
  for (let k = 0; k < 3; k++) aimSpots['marimba' + k] = row(mallets.slice(13 * k, 13 * k + 13));
  for (let k = 0; k < 2; k++) aimSpots['xylo' + k] = row(xylos.slice(12 * k, 12 * k + 12));
  aimSpots.metallophone = row(bars('metallophone'));
  aimSpots.piano = keys(grand, 1.05, -0.8, { right: [[-0.4, 0.7]], left: [[-0.25, 0.4]] });
  aimSpots.harpsichord = keys(harpsichord, 1.02, -0.9, { right: [[-0.3, 0.4]], left: [[0, 0.4]] });
  aimSpots.upright = keys(upright, 1.35, 0.05, { right: [[-0.6, 0.6]], left: [[-0.6, 0.6]] });
  aimSpots.pipes = () => organ('church').localToWorld(new THREE.Vector3(0, 1.8, 0));
  aimSpots.combo = () => organ('combo').localToWorld(new THREE.Vector3(0, 1.02, 0));
  aimSpots.tonewheel = () => organ(true).localToWorld(new THREE.Vector3(0, 0.95, 0));
  aimSpots.leslie = () => organ('leslie').localToWorld(new THREE.Vector3(0, 0.7, 0));
  aimSpots.maracas = () => ins.find(i => i.voice === 'shaker').node.localToWorld(new THREE.Vector3(0, 0.12, -0.05));
  for (const [name, spot] of Object.entries(aimSpots)) {
    if (!spot.length) {
      const p = spot();
      aimSpots[name] = () => p.clone();
      continue;
    }
    const steps = { right: [], left: [] };
    for (const gun in steps) for (let k = 0; k <= 12; k++) steps[gun].push(spot(k, gun));
    aimSpots[name] = (step, gun) => steps[gun][step].clone();
  }
}

function bandShoot(side, to) {
  launch(BAND_AT[side], to);
  bandGuns[side].look.copy(to);
  bandGuns[side].kick = 1;
  music.effect('pop', 70, 0.5, BAND_AT[side].toArray());
}

// Play with me's right gun on each pulse: its fixed figure, or the pattern it builds
// up while it holds, on the notes of its melody in turn.
function bandPulse(bar, pos) {
  const R = band.right;
  if (R.figure?.[pos]) bandShoot('right', R.figure[pos]);
  if (!R.holding) return;
  if (pos === 0 && R.heldBar === bar - 1) R.beats = Math.min(R.order.length, R.beats + 1);
  R.heldBar = bar;
  if (R.order.slice(0, R.beats).includes(pos)) bandShoot('right', R.cell[R.shots++ % R.cell.length]);
}

const autoIo = {
  at: (name, step, gun) => aimSpots[name](step, gun),
  spot: name => aimSpots[name](),
  shoot: bandShoot,
  hold(points) {
    const R = band.right;
    if (points && !R.holding) Object.assign(R, { beats: PATTERN_START, heldBar: -99, shots: 0 });
    R.holding = !!points;
    R.cell = points;
  },
  canon(points) {
    const L = band.left;
    if (!points) return unpin(L);
    if (!L.at) pinAt(L, centre(points), auto.step / STEPS);
    L.cell = points;
  },
  duet(right = null, left = null, phase = DUET_PHASE) {
    band.right.figure = right;
    const L = band.left;
    if (!left) return unpin(L);
    const at = centre(left.filter(Boolean));
    if (!L.figure) pinAt(L, at, auto.step / STEPS, phase);
    // Moving to another instrument, it keeps its place in the phase.
    L.at = at;
    L.figure = left;
  },
  rest: pos => {
    const R = band.right;
    return !(R.holding && R.order.slice(0, R.beats).includes(pos)) && !R.figure?.[pos];
  },
  cue: bar => music.cueAt(music.t0 + (auto.start + bar * BAR) * PULSE),
  cascade() {
    for (const b of balls) if (!b.dying) b.age = Math.max(0, b.age - 10);
    cascade = CASCADE;
  },
  cap: n => { auto.cap = n; },
  target() {
    const t = targets.list.find(t => t.state === 'up' || t.state === 'popping');
    return t && t.disc.getWorldPosition(new THREE.Vector3());
  },
  live: () => balls.filter(b => !b.dying).length,
  label: text => { auto.label = text; },
  end: stopAuto,
};

// Play with me: two guns of the shop's own play a fixed score, and the player can play
// along with theirs. The physics runs in fixed steps counted on the audio clock, and
// every choice that could change where a ball goes comes from a seeded generator, so
// left to itself it plays out the same way every time, whatever the frame rate.
function startAuto() {
  music.init();
  music.rewind();
  music.autoAdvance = false;
  rand = seeded(18);
  targets.rand = rand;
  targets.allow = s => s.type === 'post' && !s.floor;
  game.state = 'auto';
  // Clear the shop at once, so nothing left from before can nudge the performance.
  for (const b of balls.splice(0)) {
    world.removeBody(b.body);
    b.holder.removeFromParent();
  }
  pending.length = 0;
  for (const inst of shop.instruments) inst.last = -1e9;
  autoIo.hold(null);
  autoIo.duet(null);
  band.right.order = [...SECTION_PATTERNS[0]];
  firing = false;
  unpin();
  cascade = 0;
  auto.cap = MAX_BALLS;
  auto.label = '';
  auto.step = Math.floor((music.ctx.currentTime - music.t0) / STEP);
  // Start on the bar after next, so the first shots land on a bar line.
  auto.start = (Math.floor(auto.step / STEPS / BAR) + 2) * BAR;
  auto.score = new Autoplay(autoIo);
  targets.reset(3);
  document.body.classList.add('auto');
  $('overlay').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('landscape').classList.remove('faded');
  setTimeout(() => $('landscape').classList.add('faded'), 5000);
  showHint(IS_TOUCH
    ? 'Play along, or just listen · tap to launch · a second finger pins your left gun'
    : 'Play along, or just listen · click to launch · right-click pins your left gun · Esc to stop', 5000);
}

function stopAuto() {
  if (game.state !== 'auto') return;
  game.state = 'menu';
  music.autoAdvance = true;
  music.simTime = null;
  rand = Math.random;
  targets.rand = Math.random;
  targets.allow = null;
  autoIo.hold(null);
  autoIo.duet(null);
  firing = false;
  unpin();
  for (const b of balls) b.dying = true;
  targets.reset();
  document.body.classList.remove('auto');
  $('hud').classList.add('hidden');
  $('overlay').classList.remove('hidden');
}

// Back to the title screen, from play or from Play with me.
function goHome() {
  if (game.state === 'auto') return stopAuto();
  if (game.state !== 'playing') return;
  game.state = 'menu';
  firing = false;
  unpin();
  for (const b of balls) b.dying = true;
  targets.reset();
  $('hud').classList.add('hidden');
  $('overlay').classList.remove('hidden');
}

// Runs the physics up to the audio clock in fixed steps, playing the score on each pulse.
// A frame catches up at most half a second, so a stall never piles up work.
function stepAuto() {
  const due = Math.floor((music.ctx.currentTime - music.t0) / STEP);
  for (let n = 0; auto.step < due && n < 90 && game.state === 'auto'; n++) advanceAuto();
}

function advanceAuto() {
  auto.step++;
  music.simTime = music.t0 + auto.step * STEP;
  music.chord();
  if (auto.step % STEPS === 0) {
    const q = auto.step / STEPS;
    if (q >= auto.start) auto.score.pulse(q - auto.start);
    if (game.state !== 'auto') return;
    onPulse(q);
    lastPulse = q;
    // Past the score's limit, the oldest ball drops out, one a pulse.
    const live = balls.filter(b => !b.dying);
    if (live.length > auto.cap) live[0].dying = true;
  }
  world.step(STEP);
  for (const p of pending.splice(0)) handleCollision(p);
  const R = band.right;
  updatePhaser(band.left, STEP, auto.step / STEPS, R.order.slice(0, Math.max(R.beats, PATTERN_START)), () => BAND_AT.left);
  updatePlayerPin(STEP, auto.step / STEPS);
  targets.update(STEP);
  ageBalls(STEP);
}

// --- input ---------------------------------------------------------------------------------

const pointer = new THREE.Vector2(0, 0);
const crosshair = $('crosshair');
let firing = false, lastShot = 0, lastPulse = -1, cascade = 0;
// The gun's pattern, in build-up order, and how many of its notes are sounding.
const gun = { order: [...SECTION_PATTERNS[0]], beats: PATTERN_START, heldBar: -99 };

// A second gun's pin and its phase: where it aims, how many pulses it runs ahead of
// the first, whether it is holding there or drifting towards the next pulse, and the
// last pulse it played. It may instead play a melody or a fixed figure.
const newPin = () => ({
  at: null, cell: null, figure: null, shots: 0, phase: PHASE,
  lead: 0, target: 1, drifting: false, since: 0, last: -1, kick: 0,
});
// The player's left gun.
const pin = newPin();
// Play with me's guns, kept apart from the player's: the right one's pattern, melody
// and figure, and the left one's pin.
const band = {
  right: { order: [...SECTION_PATTERNS[0]], beats: PATTERN_START, heldBar: -99, holding: false, cell: null, figure: null, shots: 0 },
  left: newPin(),
};

const centre = points => points.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(points.length);

// Pins a second gun at `p`, as of `now` in pulses, to phase against the first as
// `phase` describes.
function pinAt(pn, p, now, phase = PHASE) {
  Object.assign(pn, {
    at: p.clone(), cell: null, figure: null, shots: 0, phase,
    lead: 0, target: 1, drifting: false, since: now, last: Math.floor(now),
  });
}

function setPin(p, now) {
  pinAt(pin, p, now);
  pinMark.position.copy(p);
  pinMark.lookAt(camera.position);
  pinMark.visible = true;
  // The first time, say what just happened and how to undo it.
  if (!pin.explained) {
    pin.explained = true;
    showHint(`Left gun pinned: it keeps firing here and drifts out of phase · ${IS_TOUCH ? 'tap the ring with a second finger' : 'right-click the ring'} to clear`, 5000);
  }
}

function unpin(pn = pin) {
  pn.at = null;
  pn.cell = null;
  pn.figure = null;
  if (pn === pin) pinMark.visible = false;
}

// Steps a pinned gun along its own, slowly drifting pulse and fires, as of `main` in
// pulses of the gun it follows, whose pattern is `pattern`. `from` says where it fires from.
function updatePhaser(pn, dt, main, pattern, from) {
  if (!pn.at || !music.ctx) return;
  if (!pn.drifting && main - pn.since > pn.phase.holdBars * BAR) pn.drifting = true;
  if (pn.drifting) {
    pn.lead += dt / PULSE * pn.phase.drift;
    if (pn.lead >= pn.target) {
      // A whole bar ahead is back in phase; count from there without skipping a beat.
      if (pn.target >= BAR) pn.last -= BAR;
      pn.lead = pn.target % BAR;
      pn.target = pn.lead + 1;
      pn.drifting = false;
      pn.since = main;
    }
  }
  const k = Math.floor(main + pn.lead);
  if (k <= pn.last) return;
  pn.last = k;
  const pos = ((k % BAR) + BAR) % BAR;
  // Playing a fixed figure, it plays that; following a melody, it plays the notes in turn.
  let to = pn.figure?.[pos];
  if (!pn.figure) {
    if (!pattern.includes(pos)) return;
    to = pn.cell ? pn.cell[pn.shots++ % pn.cell.length] : pn.at;
  }
  if (!to) return;
  const at = from();
  launch(at, to).phased = pn;
  pn.kick = 1;
  music.effect('pop', 70, 0.5, at.toArray());
}

function updatePlayerPin(dt, main) {
  updatePhaser(pin, dt, main, gun.order.slice(0, Math.max(gun.beats, PATTERN_START)),
    () => phaser.userData.mouth.getWorldPosition(new THREE.Vector3()));
}

// A press fires straight away. Holding on then claps the pattern on the pulse, and
// holding across bars builds it up; letting go for more than a bar starts it again
// from the first few notes.
function startFiring() {
  if (firing) return;
  firing = true;
  fire(pointer);
  lastShot = performance.now();
  const bar = Math.floor(lastPulse / BAR);
  if (bar - gun.heldBar > 1) gun.beats = PATTERN_START;
}

// Drops a ball from the beams straight onto a random bar of the ensemble.
function dropBall() {
  const bars = shop.instruments.filter(i => i.ostinato && ['mallet', 'xylo', 'metallophone'].includes(i.voice));
  const bar = bars[Math.floor(rand() * bars.length)];
  const p = bar.node.getWorldPosition(new THREE.Vector3());
  const ball = launch(new THREE.Vector3(p.x, 6.2, p.z), p);
  ball.body.velocity.set(0, 0, 0);
  ball.body.angularVelocity.set(0, 0, 0);
}

// Once a bar, a gun's pattern takes one step towards the current section's: one
// note that no longer belongs drops out and one new note joins at the end of the
// build-up order, so a new section's rhythm arrives gradually, as in the piece.
function morphGun(g) {
  const target = SECTION_PATTERNS[music.section];
  const drop = g.order.findIndex(p => !target.includes(p));
  if (drop >= 0) g.order.splice(drop, 1);
  const add = target.find(p => !g.order.includes(p));
  if (add !== undefined) g.order.push(add);
}

function onPulse(q) {
  const bar = Math.floor(q / BAR), pos = q % BAR;
  if (pos === 0) {
    morphGun(gun);
    morphGun(band.right);
  }
  if (game.state === 'auto') bandPulse(bar, pos);
  if (cascade > 0 && q % 2 === 0) {
    dropBall();
    cascade--;
  }
  if (firing) {
    if (pos === 0 && gun.heldBar === bar - 1) gun.beats = Math.min(gun.order.length, gun.beats + 1);
    gun.heldBar = bar;
    // A pattern note right on the heels of the press would be a double shot, so skip it.
    if (gun.order.slice(0, gun.beats).includes(pos) && performance.now() - lastShot > 120) {
      fire(pointer);
      lastShot = performance.now();
    }
  }
}

function setPointer(e) {
  pointer.x = e.clientX / innerWidth * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  crosshair.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
}

let mainPointer = null;
canvas.addEventListener('pointermove', e => { if (mainPointer === null || e.pointerId === mainPointer) setPointer(e); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (game.state !== 'playing' && game.state !== 'auto') return;
  // Right-click, or a second finger, pins the second gun where it points.
  if (e.button === 2 || (mainPointer !== null && e.pointerType === 'touch')) {
    const p = aimPoint(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
    if (pin.at && p.distanceTo(pin.at) < 0.6) {
      unpin();
    } else {
      setPin(p, (music.ctx.currentTime - music.t0) / PULSE);
    }
    return;
  }
  if (e.button !== 0) return;
  setPointer(e);
  mainPointer = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  startFiring();
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => {
  if (e.pointerId !== mainPointer) return;
  mainPointer = null;
  firing = false;
});
addEventListener('keydown', e => {
  if (e.key === 'm' || e.key === 'M') {
    music.setMuted(!music.muted);
    $('mute').textContent = music.muted ? '🔇' : '🔊';
  }
  if (e.key === ' ' && (game.state === 'playing' || game.state === 'auto')) { startFiring(); e.preventDefault(); }
  if (e.key === 'Escape') stopAuto();
});
addEventListener('keyup', e => { if (e.key === ' ') firing = false; });
document.addEventListener('visibilitychange', () => {
  music.setBackground(document.hidden);
  if (document.hidden) firing = false;
});
$('mute').addEventListener('click', () => {
  music.setMuted(!music.muted);
  $('mute').textContent = music.muted ? '🔇' : '🔊';
});

const raycaster = new THREE.Raycaster();
const aimRoots = [shop.root, targets.root];

function aimPoint(ndc) {
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(aimRoots, true)[0];
  return hit ? hit.point : raycaster.ray.at(20, new THREE.Vector3());
}

let recoil = 0;
function fire(ndc) {
  const to = aimPoint(ndc);
  const from = mouth.getWorldPosition(new THREE.Vector3());
  launch(from, to);
  recoil = 1;
  music.effect('pop', 70, 0.5, from.toArray());
}

// Notes rise from an organ when it plays loud, more and bigger the louder it gets.
// The Hammond's fly from the Leslie's spinning horn, the pipe organ's from its pipe
// tops and the combo organ's from above its keys. `boost` evens out their levels.
const organNoteSources = [
  { key: 'tonewheel', boost: 0, from: v => shop.leslie.horn.localToWorld(v.set(0.28, 0, 0)) },
  { key: 'pipes', boost: 0, from: v => shop.church.node.localToWorld(v.set(Math.random() * 1.8 - 0.9, 2.5 + Math.random() * 1.2, 0.3)) },
  { key: 'combo', boost: 5, from: v => shop.combo.node.localToWorld(v.set(Math.random() * 0.8 - 0.4, 1.25, 0)) },
];

function organNotes(dt) {
  const loud = music.organLoudness();
  if (!loud) return;
  for (const o of organNoteSources) {
    const l = clamp((loud[o.key] + o.boost + 28) / 18, 0, 1);
    o.due = (o.due ?? 0) + dt * 9 * l * l;
    while (o.due >= 1) {
      o.due -= 1;
      fx.note(o.from(new THREE.Vector3()), music.pick(60, 84, Math.random(), 0), 0.3 + 0.7 * l);
    }
  }
}

// Turns the Leslie's rotors in step with the sound: the horn's bell points at the
// listener just as its wobble is loudest, and the drum's opening likewise.
function turnLeslie(dt) {
  const { horn, drum, cabinet } = shop.leslie;
  const turns = music.rotorTurns();
  if (!turns) {
    horn.rotation.y += music.rotor.horn * 2 * Math.PI * dt;
    drum.rotation.y += music.rotor.drum * 2 * Math.PI * dt;
    return;
  }
  const v = cabinet.worldToLocal(camera.position.clone()).sub(horn.position);
  horn.rotation.y = Math.atan2(-v.z, v.x) + 2 * Math.PI * (turns.horn - 0.25);
  drum.rotation.y = Math.atan2(v.x, v.z) + 2 * Math.PI * (turns.drum - 0.25);
}

// --- main loop -----------------------------------------------------------------------------

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(Math.min(devicePixelRatio, 2));
  composer.setSize(w, h);
  const aspect = w / h;
  camera.aspect = aspect;
  // Keep at least 64 degrees of the shop in view across, so a tall phone screen still
  // shows the ensemble side to side.
  const across = 2 * Math.atan(Math.tan(32 * Math.PI / 180) / aspect) * 180 / Math.PI;
  camera.fov = Math.min(100, Math.max(58, across));
  camera.updateProjectionMatrix();
  tiltUp = aspect < 1 ? 0.12 : 0;
  // Hold the two guns inside whatever part of the view the screen shows.
  const halfH = 0.85 * Math.tan(camera.fov * Math.PI / 360), halfW = halfH * aspect;
  const gx = Math.min(0.5, halfW * 0.62), gy = -halfH * 0.9;
  LAUNCHER_REST.set(gx, gy, -0.85);
  PHASER_REST.set(-gx, gy, -0.85);
}
addEventListener('resize', resize);
resize();

const meterSegs = [...document.querySelectorAll('#meter i')];
let last = performance.now(), clock = 0, demoTimer = 1;
const aimTarget = new THREE.Vector3();
const camFwd = new THREE.Vector3(), camUp = new THREE.Vector3();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;

  if (game.state === 'auto') {
    stepAuto();
  } else {
    world.step(1 / 180, dt, 12);
    for (const p of pending.splice(0)) handleCollision(p);
    ageBalls(dt);
  }

  // Camera looks gently toward the pointer; in the menu it idles.
  let yaw, pitch;
  if (game.state === 'menu') {
    yaw = Math.sin(clock * 0.15) * 0.22;
    pitch = -0.08 + tiltUp + Math.sin(clock * 0.21) * 0.04;
  } else {
    yaw = -pointer.x * 0.2;
    pitch = pointer.y * 0.12 - 0.06 + tiltUp;
  }
  camera.rotation.y += (yaw - camera.rotation.y) * Math.min(1, dt * 4);
  camera.rotation.x += (pitch - camera.rotation.x) * Math.min(1, dt * 4);

  if (game.state === 'playing') {
    // Shots go out on the shop's pulse, never between.
    const q = music.pulseIndex();
    if (q > lastPulse) {
      for (let p = Math.max(lastPulse + 1, q - 2); p <= q; p++) onPulse(p);
      lastPulse = q;
    }
  } else if (game.state === 'menu') {
    // Attract mode: drop the odd silent ball from the beams onto the bars. The
    // player's guns stay still until they play.
    demoTimer -= dt;
    if (demoTimer <= 0) {
      demoTimer = 0.8 + Math.random() * 0.8;
      dropBall();
    }
  }

  // The launcher turns toward what the crosshair is over.
  if (game.state !== 'menu') {
    raycaster.setFromCamera(pointer, camera);
    aimTarget.copy(raycaster.ray.at(8, tmp));
  } else {
    aimTarget.set(0, 1.5, -3);
  }
  launcher.lookAt(aimTarget);
  launcher.rotateY(Math.PI);
  // Unpinned, the left gun rests pointing ahead and a little outwards.
  phaser.position.copy(PHASER_REST);
  phaser.lookAt(pin.at ?? camera.localToWorld(tmp.set(-1.5, -0.5, -8)));
  phaser.rotateY(Math.PI);
  phaser.translateZ(0.1 * pin.kick);
  pin.kick *= Math.exp(-dt * 12);
  pinMark.scale.setScalar(1 + 0.25 * pin.kick);
  if (game.state === 'playing') updatePlayerPin(dt, (music.ctx.currentTime - music.t0) / PULSE);
  recoil *= Math.exp(-dt * 12);
  launcher.position.copy(LAUNCHER_REST).addScaledVector(new THREE.Vector3(0, -0.02, 0.1), recoil);
  // Play with me's guns turn to where they last fired, the left one to its pin.
  for (const side in bandGuns) {
    const g = bandGuns[side], pinned = side === 'left' && band.left.at;
    g.group.visible = game.state === 'auto';
    if (!g.group.visible) continue;
    const kick = Math.max(g.kick, side === 'left' ? band.left.kick : 0);
    g.bell.position.copy(BAND_AT[side]);
    g.bell.lookAt(pinned ? band.left.at : g.look);
    g.bell.rotateY(Math.PI);
    g.bell.translateZ(0.12 * kick);
    g.kick *= Math.exp(-dt * 12);
    if (side === 'left') band.left.kick *= Math.exp(-dt * 12);
  }

  for (const b of balls) {
    b.holder.position.copy(b.body.position);
    b.mesh.quaternion.copy(b.body.quaternion);
    b.squash *= Math.exp(-dt * 12);
    const s = b.squash * 0.28;
    const scale = Math.max(0, b.fade ?? 1);
    b.holder.scale.set(scale * (1 + s * 0.6), scale * (1 - s), scale * (1 + s * 0.6));
  }

  if (music.ctx) shop.metronome.rotation.z = 0.45 * Math.sin(Math.PI * (music.ctx.currentTime - music.t0) / (2 * PULSE));
  turnLeslie(dt);
  organNotes(dt);
  shop.update(dt);
  decor.update(dt);
  if (game.state !== 'auto') targets.update(dt);
  fx.update(dt);
  camera.getWorldDirection(camFwd);
  camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  music.setListener(camera.position.toArray(), camFwd.toArray(), camUp.toArray());
  music.update(dt);
  updateHud(dt);
  composer.render();
}

// Ages the balls and clears away the faded ones.
function ageBalls(dt) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    b.age += dt;
    if (b.age > BALL_LIFE || b.body.position.y < -2) b.dying = true;
    if (!b.dying) continue;
    b.fade = (b.fade ?? 1) - dt * 2.5;
    if (b.fade <= 0) {
      world.removeBody(b.body);
      b.holder.removeFromParent();
      balls.splice(i, 1);
    }
  }
}

function updateHud(dt) {
  if (game.state === 'menu') return;
  game.shown += (game.score - game.shown) * Math.min(1, dt * 8);
  if (Math.abs(game.score - game.shown) < 1) game.shown = game.score;
  $('score').textContent = Math.round(game.shown).toLocaleString();
  const lv = music.level;
  meterSegs.forEach((s, i) => {
    s.classList.toggle('on', i < lv);
    s.style.setProperty('--fill', i === lv ? music.levelProgress.toFixed(2) : i < lv ? 1 : 0);
  });
  $('mult').textContent = `×${lv + 1}`;
  $('level').textContent = game.state === 'auto' ? auto.label : LEVEL_NAMES[lv];
  $('chord').textContent = music.ctx ? music.sectionName : '';
  $('hud').dataset.level = lv;
}

targets.reset();
renderer.setAnimationLoop(frame);
