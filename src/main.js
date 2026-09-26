import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { Music, LEVEL_NAMES } from './audio.js';
import { Shop, buildShop } from './shop.js';
import { buildDecor, SUN_DIR } from './decor.js';
import { buildPercussion } from './percussion.js';
import { Targets } from './targets.js';
import { Effects } from './effects.js';

const ROUND_SECONDS = 90;
const BALL_R = 0.11;
const BALL_SPEED = 15;
const BALL_LIFE = 24;
const MAX_BALLS = 60;
const GRAVITY = 9;
// Held fire follows the rhythm of lilting 6/8 phrases, like a barcarolle. Each entry
// is [length in sixteenths, melody step]; a null step is a breath with no ball.
const SIXTEENTH = 0.11;
const PHRASES = [
  [[2, 0], [1, 1], [1, 2], [2, 4], [2, 3], [4, 2]],
  [[3, 4], [1, 3], [2, 2], [2, 1], [2, 2], [2, null]],
  [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 2], [2, null]],
  [[4, 2], [2, 4], [3, 5], [1, 4], [2, 2]],
  [[2, 5], [2, 4], [2, 2], [2, 4], [4, 1]],
  [[1, 6], [1, 5], [1, 4], [1, 3], [2, 2], [2, 1], [4, null]],
  [[3, 2], [1, 3], [2, 4], [3, 6], [1, 5], [2, 4]],
];
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
const decor = buildDecor(shop);
shop.finalize();
const targets = new Targets(scene, world, pm);
const fx = new Effects(scene, camera);
const music = new Music();

// --- launcher: a brass bell that follows the aim ------------------------------------------

const launcher = new THREE.Group();
{
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
  launcher.add(bell);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.018, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0xb3202a, roughness: 0.3 }),
  );
  ring.position.z = -0.05;
  launcher.add(ring);
}
launcher.position.set(0.5, -0.42, -0.85);
launcher.scale.setScalar(0.4);
camera.add(launcher);
const LAUNCHER_REST = launcher.position.clone();
const mouth = new THREE.Object3D();
mouth.position.z = -0.62;
launcher.add(mouth);

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

const game = {
  state: 'menu', mode: 'timed', time: ROUND_SECONDS, score: 0, shown: 0,
  hits: 0, bestBank: 0, peak: 0, fired: 0,
};
let best = 0;
try { best = Number(localStorage.getItem('rr-best')) || 0; } catch {}
$('best').textContent = best.toLocaleString();

function hitTarget(t, ball, point) {
  if (!targets.strike(t)) return;
  const playing = game.state === 'playing';
  const bank = Math.min(ball.bounces, 5);
  const mult = music.level + 1;
  const depth = Math.round(clamp(CAMERA_POS.z - point.z, 0, 14) * 8);
  const points = (100 + depth) * (1 + bank) * mult;
  if (playing) {
    game.score += points;
    game.hits++;
    game.bestBank = Math.max(game.bestBank, bank);
  }
  const subs = [];
  if (bank) subs.push(`Ricochet ×${1 + bank}`);
  if (mult > 1) subs.push(`${LEVEL_NAMES[music.level]} ×${mult}`);
  if (playing) fx.popup(point, `+${points.toLocaleString()}`, subs.join(' · '), bank + mult > 3);
  fx.burst(point, 50 + 15 * mult);
  music.targetChime(point.toArray(), bank + mult);
  music.addEnergy(1);
  music.addEnergy(1);
}

function start(mode) {
  music.init();
  game.state = 'playing';
  game.mode = mode;
  game.time = ROUND_SECONDS;
  game.score = game.shown = game.hits = game.bestBank = game.peak = game.fired = 0;
  targets.reset();
  $('overlay').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('timer').classList.toggle('hidden', mode !== 'timed');
  $('hint').classList.add('show');
  setTimeout(() => $('hint').classList.remove('show'), 4500);
}

function finish() {
  game.state = 'over';
  firing = false;
  const isBest = game.score > best;
  if (isBest) {
    best = game.score;
    try { localStorage.setItem('rr-best', String(best)); } catch {}
  }
  setTimeout(() => {
    $('results').innerHTML = `
      <div class="big-score">${game.score.toLocaleString()}</div>
      ${isBest ? '<div class="new-best">New best!</div>' : ''}
      <dl>
        <dt>Targets</dt><dd>${game.hits}</dd>
        <dt>Longest ricochet</dt><dd>${game.bestBank ? `${game.bestBank} bounce${game.bestBank > 1 ? 's' : ''}` : 'none'}</dd>
        <dt>Peak</dt><dd>${LEVEL_NAMES[game.peak]}</dd>
        <dt>Balls launched</dt><dd>${game.fired}</dd>
      </dl>`;
    $('best').textContent = best.toLocaleString();
    $('play').textContent = 'Play again';
    $('overlay').classList.remove('hidden');
    $('overlay').classList.add('results');
    $('hud').classList.add('hidden');
  }, 2200);
}

$('play').addEventListener('click', () => start('timed'));
$('free').addEventListener('click', () => start('free'));

// --- input ---------------------------------------------------------------------------------

const pointer = new THREE.Vector2(0, 0);
const crosshair = $('crosshair');
let firing = false;
const melody = { phrase: null, i: 0, wait: 0 };

function startFiring() {
  if (firing) return;
  firing = true;
  melody.phrase = null;
  melody.wait = 0;
}

function nextNote() {
  if (!melody.phrase || melody.i >= melody.phrase.length) {
    melody.phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    melody.i = 0;
  }
  return melody.phrase[melody.i++];
}

function setPointer(e) {
  pointer.x = e.clientX / innerWidth * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  crosshair.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
}

canvas.addEventListener('pointermove', setPointer);
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || game.state !== 'playing') return;
  setPointer(e);
  canvas.setPointerCapture(e.pointerId);
  startFiring();
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => { firing = false; });
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
  if (!quiet) {
    game.fired++;
    music.effect('pop', 70, 0.5, from.toArray());
  }
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
    if (firing) {
      melody.wait -= dt;
      while (melody.wait <= 0) {
        const [len, step] = nextNote();
        if (step !== null) fire(pointer);
        // A little rubato, so it breathes like a player rather than a sequencer.
        melody.wait += len * SIXTEENTH * (0.93 + Math.random() * 0.14);
      }
    }
    if (game.mode === 'timed') {
      game.time -= dt;
      if (game.time <= 0) { game.time = 0; finish(); }
    }
    game.peak = Math.max(game.peak, music.level);
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
  const t = Math.ceil(game.time);
  $('time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('timer').classList.toggle('urgent', game.mode === 'timed' && game.time < 10 && game.state === 'playing');
  const lv = music.level;
  meterSegs.forEach((s, i) => {
    s.classList.toggle('on', i < lv);
    s.style.setProperty('--fill', i === lv ? music.levelProgress.toFixed(2) : i < lv ? 1 : 0);
  });
  $('mult').textContent = `×${lv + 1}`;
  $('level').textContent = LEVEL_NAMES[lv];
  $('chord').textContent = music.ctx ? `♪ ${music.chord().name}` : '';
  $('hud').dataset.level = lv;
}

targets.reset();
renderer.setAnimationLoop(frame);
