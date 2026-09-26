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
const CAMERA_POS = new THREE.Vector3(0, 1.85, 6.7);

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const $ = id => document.getElementById(id);

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

const shop = new Shop(scene, world, pm);
const { chair } = buildShop(shop);
buildPercussion(shop, chair);
buildOrgan(shop);
const decor = buildDecor(shop);
shop.finalize();
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
const mouth = launcher.userData.mouth;

// The second gun, held in the left hand, fires at a pinned spot.
const phaser = makeBell();
phaser.scale.setScalar(0.4);
const PHASER_REST = new THREE.Vector3(-0.5, -0.42, -0.85);
phaser.position.copy(PHASER_REST);
camera.add(phaser);
// "right click", engraved round the top of the bell's flare, which faces the player.
{
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d');
  g.font = 'italic 600 78px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,236,170,0.5)';
  g.fillText('right click', 257, 83);
  g.fillStyle = 'rgba(60,36,10,0.9)';
  g.fillText('right click', 256, 80);
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
  body.angularVelocity.set(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
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
  if (balls.filter(b => !b.dying).length > MAX_BALLS) balls.find(b => !b.dying).dying = true;
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
  if (inst.ostinato) lockToPulse(ball.body);
  if (inst.swell) {
    const now = performance.now();
    if (now - inst.last < 400) return;
    inst.last = now;
    if (inst.swell === 'church') music.churchSwell(2);
    else if (inst.swell === 'combo') music.comboSwell(1);
    else music.swell(1);
    music.addEnergy(vel);
    shop.hit(inst, vel);
    fx.note(point, 57, vel);
    return;
  }
  const now = performance.now();
  if (now - inst.last < 45) return;
  inst.last = now;
  const slot = inst.slotFrom ? inst.slotFrom(point.clone()) : inst.slot;
  const step = inst.arp ? inst.hits % 3 : 0;
  inst.hits++;
  const midi = music.hit(inst.voice, inst.lo, inst.hi, slot, step, vel, point.toArray(), inst.gliss);
  ball.bounces++;
  music.addEnergy(vel);
  shop.hit(inst, vel);
  fx.note(point, midi, vel);
}

// --- game state ----------------------------------------------------------------------------

const game = { state: 'menu', score: 0, shown: 0 };

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
  if (music.cue()) {
    if (playing) fx.popup(point, 'Next section', '', false);
    // The patterns already bouncing carry on through the change, and a cascade of
    // balls drops onto the bars to build new ones.
    for (const b of balls) if (!b.dying) b.age = Math.max(0, b.age - 10);
    cascade = CASCADE;
  }
  music.addEnergy(1);
  music.addEnergy(1);
}

function start() {
  music.init();
  game.state = 'playing';
  game.score = game.shown = 0;
  targets.reset();
  $('overlay').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hint').classList.add('show');
  setTimeout(() => $('hint').classList.remove('show'), 4500);
}

$('play').addEventListener('click', start);

// --- input ---------------------------------------------------------------------------------

const pointer = new THREE.Vector2(0, 0);
const crosshair = $('crosshair');
let firing = false, tapPending = false, lastPulse = -1, cascade = 0;
// The gun's pattern, in build-up order, and how many of its notes are sounding.
const gun = { order: [...SECTION_PATTERNS[0]], beats: PATTERN_START, heldBar: -99 };

// The second gun's pin and its phase: how many pulses it runs ahead of the first,
// whether it is holding there or drifting towards the next pulse, and the last
// pulse it played.
const pin = { at: null, lead: 0, target: 1, drifting: false, since: 0, last: -1, kick: 0 };

function setPin(ndc) {
  const p = aimPoint(ndc);
  if (pin.at && p.distanceTo(pin.at) < 0.6) {
    pin.at = null;
    pinMark.visible = false;
    return;
  }
  const now = (music.ctx.currentTime - music.t0) / PULSE;
  Object.assign(pin, { at: p.clone(), lead: 0, target: 1, drifting: false, since: now, last: Math.floor(now) });
  pinMark.position.copy(p);
  pinMark.lookAt(camera.position);
  pinMark.visible = true;
}

// Steps the second gun along its own, slowly drifting pulse and fires its pattern.
function updatePhaser(dt) {
  if (!pin.at || !music.ctx) return;
  const main = (music.ctx.currentTime - music.t0) / PULSE;
  if (!pin.drifting && main - pin.since > PHASE.holdBars * BAR) pin.drifting = true;
  if (pin.drifting) {
    pin.lead += dt / PULSE * PHASE.drift;
    if (pin.lead >= pin.target) {
      // A whole bar ahead is back in phase; count from there without skipping a beat.
      if (pin.target >= BAR) pin.last -= BAR;
      pin.lead = pin.target % BAR;
      pin.target = pin.lead + 1;
      pin.drifting = false;
      pin.since = main;
    }
  }
  const k = Math.floor(main + pin.lead);
  if (k <= pin.last) return;
  pin.last = k;
  if (!gun.order.slice(0, Math.max(gun.beats, PATTERN_START)).includes(((k % BAR) + BAR) % BAR)) return;
  const from = phaser.userData.mouth.getWorldPosition(new THREE.Vector3());
  launch(from, pin.at);
  pin.kick = 1;
  music.effect('pop', 70, 0.5, from.toArray());
}

// A press fires on the next pulse. Holding on across bars builds the pattern up;
// letting go for more than a bar starts it again from the first few notes.
function startFiring() {
  if (firing) return;
  firing = true;
  tapPending = true;
  const bar = Math.floor(lastPulse / BAR);
  if (bar - gun.heldBar > 1) gun.beats = PATTERN_START;
}

// Drops a ball from the beams straight onto a random bar of the ensemble.
function dropBall() {
  const bars = shop.instruments.filter(i => i.ostinato && ['mallet', 'xylo', 'metallophone'].includes(i.voice));
  const bar = bars[Math.floor(Math.random() * bars.length)];
  const p = bar.node.getWorldPosition(new THREE.Vector3());
  const ball = launch(new THREE.Vector3(p.x, 6.2, p.z), p);
  ball.body.velocity.set(0, 0, 0);
  ball.body.angularVelocity.set(0, 0, 0);
}

// Once a bar, the gun's pattern takes one step towards the current section's: one
// note that no longer belongs drops out and one new note joins at the end of the
// build-up order, so a new section's rhythm arrives gradually, as in the piece.
function morphGun() {
  const target = SECTION_PATTERNS[music.section];
  const drop = gun.order.findIndex(p => !target.includes(p));
  if (drop >= 0) gun.order.splice(drop, 1);
  const add = target.find(p => !gun.order.includes(p));
  if (add !== undefined) gun.order.push(add);
}

function onPulse(q) {
  const bar = Math.floor(q / BAR), pos = q % BAR;
  if (pos === 0) morphGun();
  if (cascade > 0 && q % 2 === 0) {
    dropBall();
    cascade--;
  }
  if (firing) {
    if (pos === 0 && gun.heldBar === bar - 1) gun.beats = Math.min(gun.order.length, gun.beats + 1);
    gun.heldBar = bar;
    if (tapPending || gun.order.slice(0, gun.beats).includes(pos)) fire(pointer);
    tapPending = false;
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
  if (game.state !== 'playing') return;
  // Right-click, or a second finger, pins the second gun where it points.
  if (e.button === 2 || (mainPointer !== null && e.pointerType === 'touch')) {
    setPin(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
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
  if (e.key === ' ' && game.state === 'playing') { startFiring(); e.preventDefault(); }
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
function fire(ndc, quiet) {
  const to = aimPoint(ndc);
  const from = mouth.getWorldPosition(new THREE.Vector3());
  launch(from, to);
  recoil = 1;
  if (!quiet) music.effect('pop', 70, 0.5, from.toArray());
}

// --- main loop -----------------------------------------------------------------------------

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(Math.min(devicePixelRatio, 2));
  composer.setSize(w, h);
  camera.aspect = w / h;
  // Keep the whole shop in view on narrow screens.
  camera.fov = w / h < 1 ? 58 + (1 - w / h) * 30 : 58;
  camera.updateProjectionMatrix();
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

  world.step(1 / 180, dt, 12);
  for (const p of pending.splice(0)) handleCollision(p);

  // Camera looks gently toward the pointer; in the menu it idles.
  let yaw, pitch;
  if (game.state === 'menu') {
    yaw = Math.sin(clock * 0.15) * 0.22;
    pitch = -0.08 + Math.sin(clock * 0.21) * 0.04;
  } else {
    yaw = -pointer.x * 0.2;
    pitch = pointer.y * 0.12 - 0.06;
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
    // Attract mode: lob a few silent balls around the shop.
    demoTimer -= dt;
    if (demoTimer <= 0) {
      demoTimer = 0.5 + Math.random() * 0.6;
      fire(new THREE.Vector2(Math.random() * 1.6 - 0.8, Math.random() * 0.9 - 0.4), true);
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
  if (game.state === 'playing') updatePhaser(dt);
  recoil *= Math.exp(-dt * 12);
  launcher.position.copy(LAUNCHER_REST).addScaledVector(new THREE.Vector3(0, -0.02, 0.1), recoil);

  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    b.age += dt;
    if (b.age > BALL_LIFE || b.body.position.y < -2) b.dying = true;
    b.holder.position.copy(b.body.position);
    b.mesh.quaternion.copy(b.body.quaternion);
    b.squash *= Math.exp(-dt * 12);
    const s = b.squash * 0.28;
    let scale = 1;
    if (b.dying) {
      b.fade = (b.fade ?? 1) - dt * 2.5;
      scale = Math.max(0, b.fade);
      if (b.fade <= 0) {
        world.removeBody(b.body);
        b.holder.removeFromParent();
        balls.splice(i, 1);
        continue;
      }
    }
    b.holder.scale.set(scale * (1 + s * 0.6), scale * (1 - s), scale * (1 + s * 0.6));
  }

  if (music.ctx) shop.metronome.rotation.z = 0.45 * Math.sin(Math.PI * (music.ctx.currentTime - music.t0) / (2 * PULSE));
  shop.leslie.horn.rotation.y += music.rotor.horn * 2 * Math.PI * dt;
  shop.leslie.drum.rotation.y += music.rotor.drum * 2 * Math.PI * dt;
  shop.update(dt);
  decor.update(dt);
  targets.update(dt);
  fx.update(dt);
  camera.getWorldDirection(camFwd);
  camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  music.setListener(camera.position.toArray(), camFwd.toArray(), camUp.toArray());
  music.update(dt);
  updateHud(dt);
  composer.render();
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
  $('level').textContent = LEVEL_NAMES[lv];
  $('chord').textContent = music.ctx ? music.sectionName : '';
  $('hud').dataset.level = lv;
}

targets.reset();
renderer.setAnimationLoop(frame);
