/* ═══════════════════════════════════════════════════════════════
   Flappy Jade 👑 — a pastel princess flappy game
   Everything is drawn on canvas: zero image/audio assets.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* ─── Logical resolution (landscape). The canvas scales to fit. ─── */
const W = 960, H = 540;

/* ─── Gameplay tuning — tweak difficulty here ─── */
const TUNE = {
  gravity: 1500,      // px/s² pulling the bird down
  flapVy: -400,       // upward velocity on tap (rise ≈ 53 px per flap)
  maxFall: 680,       // terminal fall speed
  birdR: 15,          // collision radius (visual body ≈ 21 → forgiving hitbox)
  groundH: 76,        // height of the ground strip
  pipeW: 74,          // pipe shaft width (gold caps are wider but decorative-only)
  pipeSpacing: 330,   // horizontal px between pipe pairs
  gapStart: 175,      // gap height at level 1
  gapPerLevel: 8,     // gap shrinks this much per level…
  gapMin: 132,        // …but never below this
  speedStart: 168,    // scroll speed at level 1 (px/s)
  speedPerLevel: 13,  // speed added per level…
  speedMax: 258,      // …capped here
  maxGapDelta: 165,   // max vertical jump between consecutive gap centers
  levelEvery: 10,     // points per level
  topMargin: 60,      // gap never hugs the ceiling
};
const GROUND_Y = H - TUNE.groundH;
const BIRD_X = 260;          // bird's x during play
const BIRD_BASE_Y = H * 0.44;

/* ─── Background palettes: L1 morning → L2 sunset → L3 twilight → L4+ starry ─── */
const PALETTES = [
  { skyTop:'#ffd3e8', skyBot:'#cbb4f6', hillFar:'#b0e7cd', hillNear:'#ffc9e3', castle:'#9d7fd1',
    cloud:'#ffffff', groundTop:'#ffddef', groundBot:'#f4aed6', scallop:'#fff0f8', heart:'#ff9ecb', star:0 },
  { skyTop:'#ff9fc2', skyBot:'#ffcf9c', hillFar:'#c98fd6', hillNear:'#ffadcf', castle:'#7e5cb8',
    cloud:'#ffe9f0', groundTop:'#ffd0e4', groundBot:'#f09cc8', scallop:'#ffe8f2', heart:'#ff8fb8', star:0.15 },
  { skyTop:'#8f78d8', skyBot:'#f0a2d0', hillFar:'#8a6fc8', hillNear:'#b389d9', castle:'#55418f',
    cloud:'#d9c6f0', groundTop:'#d8a8dd', groundBot:'#a878c4', scallop:'#ecd4f0', heart:'#ffa8d8', star:0.55 },
  { skyTop:'#322a63', skyBot:'#7d5cb6', hillFar:'#4e3f85', hillNear:'#67519e', castle:'#292050',
    cloud:'#a48fd0', groundTop:'#8a68b8', groundBot:'#5e4590', scallop:'#a888d0', heart:'#d9a8ff', star:1 },
];

/* ─── Playable characters (cosmetic only — same physics & hitbox) ─── */
const CHARS = {
  jade: {
    bodyTop: '#ffb3d6', bodyBot: '#f06ba8', outline: 'rgba(150,40,100,0.35)',
    belly: '#ffdcec', wing: '#e0559d', tail: '#e061a4',
    blush: 'rgba(255,120,170,0.4)', lashes: true, crown: 'tiara',
  },
  darling: {
    bodyTop: '#a8d6ff', bodyBot: '#5f8fe6', outline: 'rgba(40,80,150,0.4)',
    belly: '#ddeeff', wing: '#4a7fd6', tail: '#4d82dd',
    blush: 'rgba(255,130,170,0.3)', lashes: false, crown: 'crown',
  },
};

/* ─── Small helpers ─── */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => ((a % n) + n) % n;
const rand = (a, b) => a + Math.random() * (b - a);

function toRgb(c) {
  if (c[0] === '#') {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  const m = c.match(/\d+/g);
  return [+m[0], +m[1], +m[2]];
}
function mix(a, b, t) {
  const A = toRgb(a), B = toRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
function easeOutBack(t) {
  const c = 1.70158, u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

/* ─── localStorage (guarded — private mode etc. must never crash the game) ─── */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* no-op */ } },
};

/* ─── Sound: tiny WebAudio tones, created only after the first user gesture ─── */
const SFX = (() => {
  let ac = null, master = null;
  let muted = store.get('fj_muted', false);

  function ensure() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ac) {
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
  }
  function tone(o) {
    if (!ac || muted) return;
    const { f0 = 440, f1 = f0, t = 0.1, type = 'sine', v = 0.3, at = 0 } = o;
    const t0 = ac.currentTime + at;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + t);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + t + 0.05);
  }
  return {
    ensure,
    get muted() { return muted; },
    toggle() { muted = !muted; store.set('fj_muted', muted); return muted; },
    flap()  { tone({ f0: 340, f1: 620, t: 0.09, type: 'triangle', v: 0.25 }); },
    score() { tone({ f0: 660, t: 0.07, v: 0.22 }); tone({ f0: 880, t: 0.09, v: 0.22, at: 0.07 }); },
    level() { [523, 659, 784, 1047].forEach((f, i) => tone({ f0: f, t: 0.1, type: 'triangle', v: 0.22, at: i * 0.09 })); },
    hit()   { tone({ f0: 220, f1: 70, t: 0.25, type: 'sawtooth', v: 0.3 }); },
    over()  { tone({ f0: 392, t: 0.12, type: 'triangle', v: 0.22 });
              tone({ f0: 330, t: 0.12, type: 'triangle', v: 0.2, at: 0.12 });
              tone({ f0: 262, t: 0.3, type: 'triangle', v: 0.2, at: 0.24 }); },
    best()  { [784, 988, 1175, 1568].forEach((f, i) => tone({ f0: f, t: 0.12, v: 0.2, at: i * 0.08 }));
              tone({ f0: 600, f1: 1600, t: 0.5, v: 0.1, at: 0.1 }); },
    click() { tone({ f0: 700, f1: 900, t: 0.05, v: 0.15 }); },
  };
})();

/* ─── DOM ─── */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const frame = document.getElementById('frame');
const el = (id) => document.getElementById(id);
const menuScreen = el('menuScreen'), overScreen = el('overScreen');
const startBtn = el('startBtn'), retryBtn = el('retryBtn'), menuBtn = el('menuBtn');
const resetBtn = el('resetBtn'), muteBtn = el('muteBtn'), menuBest = el('menuBest');
const finalScore = el('finalScore'), finalBest = el('finalBest'), finalLevel = el('finalLevel');
const newBestBanner = el('newBestBanner');
const pickJade = el('pickJade'), pickDarling = el('pickDarling');

/* ─── Game state ─── */
let state = 'menu';          // 'menu' | 'play' | 'over'
let started = false;         // first flap given? (get-ready phase before)
let dying = false;           // hit something, falling to the ground
let awaitResume = false;     // paused mid-run (rotation / tab hidden) → tap to continue
let blocked = false;         // portrait orientation blocks everything
let score = 0, level = 1;
let best = store.get('fj_best', 0);
let bestLevel = store.get('fj_bestLevel', 1);
let selChar = store.get('fj_char', 'jade');
if (!CHARS[selChar]) selChar = 'jade';
let newBest = false;
let speed = 90, speedTarget = TUNE.speedStart;
let scrollX = 0;             // world scroll for parallax layers
let time = 0;                // global clock (seconds, pauses with the game)
let flash = 0, shake = 0;    // death juice
let toast = null;            // {text, t, dur} level-up toast
let overButtonsReady = false;
let resetArm = 0;

const bird = { x: W * 0.42, y: BIRD_BASE_Y, vy: 0, rot: 0, flapAnim: 0 };
let pipes = [];              // {x, gapY, gapH, scored}
let particles = [];          // sparkles + confetti

/* ─── Ambient decor (fixed random layouts, animated each frame) ─── */
const clouds = Array.from({ length: 7 }, () => ({
  x: Math.random() * W, y: 26 + Math.random() * 175,
  s: 0.6 + Math.random() * 0.9, f: 0.12 + Math.random() * 0.26,
}));
const floaties = Array.from({ length: 12 }, (_, i) => ({
  x: Math.random() * W, y: 50 + Math.random() * 300,
  f: 0.2 + Math.random() * 0.3, s: 0.5 + Math.random() * 0.8,
  ph: Math.random() * 6.28, kind: i % 3 === 0 ? 'star' : 'heart',
}));
const stars = Array.from({ length: 46 }, () => ({
  x: Math.random() * W, y: Math.random() * H * 0.55,
  r: 0.8 + Math.random() * 1.1, ph: Math.random() * 6.28,
}));
const groundSparks = Array.from({ length: 12 }, () => ({
  x: Math.random() * W, y: GROUND_Y + 22 + Math.random() * 42, ph: Math.random() * 6.28,
}));

/* ─── Palette blending (crossfade on level change) ─── */
let pal = Object.assign({}, PALETTES[0]);
let palFrom = Object.assign({}, PALETTES[0]);
let palTo = PALETTES[0];
let palT = 1;

function setPalette(i) {
  palFrom = Object.assign({}, pal);
  palTo = PALETTES[clamp(i, 0, PALETTES.length - 1)];
  palT = 0;
}
function updatePalette(dt) {
  if (palT >= 1) return;
  palT = Math.min(1, palT + dt / 1.1);
  for (const k in palTo) {
    if (k === 'star') pal.star = lerp(palFrom.star, palTo.star, palT);
    else pal[k] = mix(palFrom[k], palTo[k], palT);
  }
}

/* ─── Layout: scale the 960×540 canvas to fit the viewport, letterboxed ─── */
let scaleX = 1, scaleY = 1;
function layout() {
  const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const s = Math.min(vw / W, vh / H);
  const cssW = Math.max(1, Math.floor(W * s)), cssH = Math.max(1, Math.floor(H * s));
  frame.style.width = cssW + 'px';
  frame.style.height = cssH + 'px';
  frame.style.setProperty('--u', (cssH / 100) + 'px');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  scaleX = canvas.width / W;
  scaleY = canvas.height / H;
}

/* ─── Orientation & visibility: pause instead of dying unfairly ─── */
const portraitMQ = window.matchMedia ? window.matchMedia('(orientation: portrait)') : null;
function pauseIfMidRun() {
  if (state === 'play' && started && !dying) awaitResume = true;
}
function checkOrientation() {
  const portrait = (portraitMQ && portraitMQ.matches) || window.innerHeight > window.innerWidth;
  document.body.classList.toggle('portrait', portrait);
  if (portrait && !blocked) pauseIfMidRun();
  blocked = portrait;
}
window.addEventListener('resize', () => { layout(); checkOrientation(); });
window.addEventListener('orientationchange', () => { layout(); checkOrientation(); });
if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
if (portraitMQ) {
  const onMQ = () => { layout(); checkOrientation(); };
  if (portraitMQ.addEventListener) portraitMQ.addEventListener('change', onMQ);
  else if (portraitMQ.addListener) portraitMQ.addListener(onMQ);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseIfMidRun(); });

/* ─── Input: tap / click / space all flap ─── */
function flap() {
  bird.vy = TUNE.flapVy;
  bird.flapAnim = 1;
  spawnFlapSparkles();
  SFX.flap();
}
function primaryAction() {
  SFX.ensure();
  if (blocked) return;
  if (state !== 'play' || dying) return;
  if (awaitResume) { awaitResume = false; flap(); return; }
  if (!started) { started = true; speed = 90; flap(); return; }
  flap();
}
frame.addEventListener('touchstart', (e) => {
  if (e.target.closest('button')) return;   // let buttons receive their tap
  e.preventDefault();                        // kills scroll / zoom / ghost clicks
  primaryAction();
}, { passive: false });
frame.addEventListener('mousedown', (e) => {
  if (e.target.closest('button')) return;
  e.preventDefault();
  primaryAction();
});
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
  e.preventDefault();
  if (e.repeat) return;
  SFX.ensure();
  if (blocked) return;
  if (state === 'menu') startGame();
  else if (state === 'over') { if (overButtonsReady) restart(); }
  else primaryAction();
});
document.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
frame.addEventListener('contextmenu', (e) => e.preventDefault());

/* ─── Flow ─── */
function resetRun() {
  score = 0; level = 1;
  speed = 90; speedTarget = TUNE.speedStart;
  pipes = []; particles = [];
  toast = null; flash = 0; shake = 0;
  started = false; dying = false; awaitResume = false; newBest = false;
  bird.y = BIRD_BASE_Y; bird.vy = 0; bird.rot = 0; bird.flapAnim = 0;
}
function startGame() {
  resetRun();
  state = 'play';
  menuScreen.classList.add('hidden');
  overScreen.classList.add('hidden');
}
function restart() {
  startGame();
}
function toMenu() {
  resetRun();
  state = 'menu';
  setPalette(0);
  overScreen.classList.add('hidden');
  menuScreen.classList.remove('hidden');
  updateMenuBest();
}
function updateMenuBest() {
  menuBest.textContent = `👑 Best: ${best} · Level ${bestLevel}`;
}
function addScore() {
  score++;
  SFX.score();
  const nl = Math.floor(score / TUNE.levelEvery) + 1;
  if (nl > level) {
    level = nl;
    speedTarget = Math.min(TUNE.speedMax, TUNE.speedStart + TUNE.speedPerLevel * (level - 1));
    setPalette(level - 1);
    toast = { text: `Level ${level}!`, t: 0, dur: 1.6 };
    sparkleBurst(W / 2, H * 0.30, 16);
    SFX.level();
  }
}
function hit() {
  dying = true;
  flash = 1; shake = 1;
  bird.vy = Math.min(bird.vy, -160);   // little bounce, then the fall
  SFX.hit();
}
function finishGameOver() {
  if (state !== 'play') return;
  state = 'over';
  newBest = score > 0 && score > best;
  if (newBest) { best = score; store.set('fj_best', best); }
  if (level > bestLevel) { bestLevel = level; store.set('fj_bestLevel', bestLevel); }
  finalScore.textContent = score;
  finalBest.textContent = best;
  finalLevel.textContent = level;
  newBestBanner.classList.toggle('hidden', !newBest);
  overScreen.classList.remove('hidden');
  retryBtn.disabled = true; menuBtn.disabled = true; overButtonsReady = false;
  setTimeout(() => { retryBtn.disabled = false; menuBtn.disabled = false; overButtonsReady = true; }, 550);
  SFX.over();
  if (newBest) setTimeout(() => { confettiBurst(); SFX.best(); }, 450);
}

/* ─── Pipes ─── */
function gapForLevel() {
  return Math.max(TUNE.gapMin, TUNE.gapStart - TUNE.gapPerLevel * (level - 1));
}
function spawnPipe(x) {
  const gapH = gapForLevel();
  const minY = TUNE.topMargin + gapH / 2 + 10;
  const maxY = GROUND_Y - gapH / 2 - 16;
  let gy = rand(minY, maxY);
  const prev = pipes[pipes.length - 1];
  if (prev) gy = clamp(gy, prev.gapY - TUNE.maxGapDelta, prev.gapY + TUNE.maxGapDelta);
  gy = clamp(gy, minY, maxY);
  pipes.push({ x, gapY: gy, gapH, scored: false });
}
function updatePipes(dt) {
  for (const p of pipes) p.x -= speed * dt;
  if (pipes.length && pipes[0].x + TUNE.pipeW < -60) pipes.shift();
  const last = pipes[pipes.length - 1];
  if (!last) spawnPipe(W + 240);
  else if (last.x < W - TUNE.pipeSpacing) spawnPipe(last.x + TUNE.pipeSpacing);
  for (const p of pipes) {
    if (!p.scored && p.x + TUNE.pipeW < bird.x) { p.scored = true; addScore(); }
  }
}
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
function checkCollisions() {
  const r = TUNE.birdR;
  for (const p of pipes) {
    if (p.x > bird.x + 60 || p.x + TUNE.pipeW < bird.x - 60) continue;
    const gt = p.gapY - p.gapH / 2, gb = p.gapY + p.gapH / 2;
    if (circleRect(bird.x, bird.y, r, p.x, -200, TUNE.pipeW, gt + 200) ||
        circleRect(bird.x, bird.y, r, p.x, gb, TUNE.pipeW, GROUND_Y - gb + 50)) {
      hit();
      return;
    }
  }
}

/* ─── Particles ─── */
function pushParticle(p) {
  if (particles.length > 400) particles.shift();
  particles.push(p);
}
function spawnFlapSparkles() {
  for (let i = 0; i < 2; i++) {
    pushParticle({
      kind: 'spark', x: bird.x - 16, y: bird.y + 8,
      vx: -rand(60, 130), vy: rand(-30, 40), g: 120,
      rot: rand(0, 6.28), vr: rand(-4, 4),
      t: 0, dur: 0.45, size: rand(4, 7),
      color: ['#fff6fb', '#ffd166', '#ff9ecb'][Math.floor(rand(0, 3))],
    });
  }
}
function sparkleBurst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), v = rand(50, 170);
    pushParticle({
      kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, g: 70,
      rot: rand(0, 6.28), vr: rand(-5, 5),
      t: 0, dur: rand(0.5, 0.9), size: rand(5, 9),
      color: ['#fff6fb', '#ffd166', '#ff9ecb', '#c58fff'][Math.floor(rand(0, 4))],
    });
  }
}
function confettiBurst() {
  const colors = ['#ff8fc7', '#b28bff', '#ffd166', '#7ee8fa', '#ff6f91', '#ffffff'];
  for (let i = 0; i < 90; i++) {
    pushParticle({
      kind: Math.random() < 0.3 ? 'spark' : 'confetti',
      x: W / 2 + rand(-260, 260), y: H * 0.12 + rand(-30, 30),
      vx: rand(-140, 140), vy: rand(-260, -50), g: 520,
      rot: rand(0, 6.28), vr: rand(-8, 8),
      t: 0, dur: rand(2.2, 3.4),
      size: rand(6, 11), w: rand(6, 10), h: rand(8, 14),
      color: colors[Math.floor(rand(0, colors.length))],
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt;
    if (p.t > p.dur) { particles.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
}

/* ─── Update ─── */
function ambientSpeed() {
  if (state === 'play' && started && !dying && !awaitResume) return speed;
  if (dying || state === 'over') return 0;
  return 55;
}
function update(dt) {
  time += dt;
  updatePalette(dt);
  updateParticles(dt);
  if (toast) { toast.t += dt; if (toast.t > toast.dur) toast = null; }
  if (flash > 0) flash -= dt * 3;
  if (shake > 0) shake -= dt * 3.5;

  const amb = ambientSpeed();
  for (const c of clouds) {
    c.x -= amb * c.f * dt;
    if (c.x < -180 * c.s) { c.x += W + 360 * c.s; c.y = 26 + Math.random() * 175; }
  }
  for (const f of floaties) {
    f.x -= amb * f.f * dt;
    if (f.x < -40) { f.x += W + 80; f.y = 50 + Math.random() * 300; }
  }

  if (state === 'menu') {
    scrollX += 55 * dt;
    bird.x += (W * 0.52 - bird.x) * Math.min(1, dt * 5);
    bird.y = H * 0.48 + Math.sin(time * 2.6) * 10;   // below the character chips
    bird.rot = Math.sin(time * 2.6 + 1.2) * 0.08;
    bird.flapAnim = Math.max(0, bird.flapAnim - dt * 2.6);
    return;
  }
  if (state !== 'play') return;

  if (!started) {           // get-ready: bird bobs, glides to its lane
    scrollX += 55 * dt;
    bird.x += (BIRD_X - bird.x) * Math.min(1, dt * 5);
    bird.y = BIRD_BASE_Y + Math.sin(time * 3) * 9;
    bird.rot = 0;
    return;
  }
  if (awaitResume) return;  // frozen mid-run until the player taps

  // physics (x eases into its lane in case play began mid-glide)
  bird.x += (BIRD_X - bird.x) * Math.min(1, dt * 3);
  bird.vy = Math.min(bird.vy + TUNE.gravity * dt, TUNE.maxFall);
  bird.y += bird.vy * dt;
  if (bird.y < TUNE.birdR) { bird.y = TUNE.birdR; bird.vy = Math.max(bird.vy, 0); }

  const targetRot = dying ? 1.5 : clamp(lerp(-0.38, 1.35, (bird.vy - TUNE.flapVy) / (600 - TUNE.flapVy)), -0.38, 1.35);
  bird.rot += (targetRot - bird.rot) * Math.min(1, dt * (bird.vy < 0 ? 14 : dying ? 10 : 7));
  bird.flapAnim = Math.max(0, bird.flapAnim - dt * 2.6);

  if (!dying) {
    speed += (speedTarget - speed) * Math.min(1, dt * 2);
    scrollX += speed * dt;
    updatePipes(dt);
    checkCollisions();
  }

  if (bird.y + TUNE.birdR - 2 >= GROUND_Y) {
    bird.y = GROUND_Y - TUNE.birdR + 2;
    if (!dying) hit();
    finishGameOver();
  }
}

/* ─── Drawing helpers ─── */
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function heartPath(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + 0.3 * s);
  ctx.bezierCurveTo(x + 0.45 * s, y - 0.3 * s, x + 0.9 * s, y + 0.15 * s, x, y + 0.8 * s);
  ctx.bezierCurveTo(x - 0.9 * s, y + 0.15 * s, x - 0.45 * s, y - 0.3 * s, x, y + 0.3 * s);
  ctx.closePath();
}
function starPath(x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.38;
    const a = rot + i * Math.PI / 4 - Math.PI / 2;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
function drawTextC(text, x, y, size, fill, stroke, lw, weight) {
  ctx.font = `${weight || 700} ${size}px Fredoka, "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw || Math.max(3, size * 0.14);
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/* ─── Scene layers ─── */
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pal.skyTop);
  g.addColorStop(1, pal.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function drawStarsMoon() {
  if (pal.star < 0.02) return;
  for (const s of stars) {
    const a = pal.star * (0.45 + 0.55 * Math.abs(Math.sin(time * 2.2 + s.ph)));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fff9e8';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, 6.28);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const moonA = clamp((pal.star - 0.5) * 2, 0, 1);
  if (moonA > 0) {
    ctx.globalAlpha = moonA;
    ctx.fillStyle = '#fff5d0';
    ctx.beginPath(); ctx.arc(W - 150, 92, 27, 0, 6.28); ctx.fill();
    const yFrac = 92 / H;
    ctx.fillStyle = mix(pal.skyTop, pal.skyBot, yFrac);
    ctx.beginPath(); ctx.arc(W - 140, 86, 24, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
function drawClouds() {
  for (const c of clouds) {
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = pal.cloud;
    const { x, y, s } = c;
    ctx.beginPath();
    ctx.arc(x, y, 26 * s, 0, 6.28);
    ctx.arc(x + 30 * s, y - 8 * s, 20 * s, 0, 6.28);
    ctx.arc(x + 58 * s, y + 2 * s, 23 * s, 0, 6.28);
    ctx.arc(x + 28 * s, y + 10 * s, 22 * s, 0, 6.28);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawCastle() {
  const wrap = 1500;
  const cx = mod(720 - scrollX * 0.18, wrap) - 270;
  const baseY = GROUND_Y - 62;
  const c = pal.castle;
  const roof = mix(pal.castle, '#241b3a', 0.35);
  ctx.fillStyle = c;
  // keep (center block) + battlements
  ctx.fillRect(cx - 45, baseY - 80, 90, 80);
  for (let i = 0; i < 4; i++) ctx.fillRect(cx - 45 + i * 24, baseY - 92, 14, 14);
  // side towers
  for (const side of [-1, 1]) {
    const tx = cx + side * 62;
    ctx.fillRect(tx - 17, baseY - 112, 34, 112);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(tx - 24, baseY - 112);
    ctx.lineTo(tx, baseY - 152);
    ctx.lineTo(tx + 24, baseY - 112);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.heart;
    ctx.beginPath();                       // little flag
    ctx.moveTo(tx, baseY - 152);
    ctx.lineTo(tx, baseY - 168);
    ctx.lineTo(tx + 14, baseY - 161);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = c;
  }
  // gate
  ctx.fillStyle = mix(pal.castle, '#ffffff', 0.25);
  ctx.beginPath();
  ctx.arc(cx, baseY - 18, 14, Math.PI, 0);
  ctx.lineTo(cx + 14, baseY);
  ctx.lineTo(cx - 14, baseY);
  ctx.closePath(); ctx.fill();
}
function hillLine(x, off, base, a1, k1, a2, k2) {
  const t = x + off;
  return base + Math.sin(t * k1) * a1 + Math.sin(t * k2 + 1.7) * a2;
}
function drawHills() {
  // far hills
  ctx.fillStyle = pal.hillFar;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 4);
  for (let x = 0; x <= W; x += 32) ctx.lineTo(x, hillLine(x, scrollX * 0.25, GROUND_Y - 64, 20, 0.0042, 26, 0.0013));
  ctx.lineTo(W, GROUND_Y + 4);
  ctx.closePath(); ctx.fill();
  // near hills
  ctx.fillStyle = pal.hillNear;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 4);
  for (let x = 0; x <= W; x += 32) ctx.lineTo(x, hillLine(x, scrollX * 0.45, GROUND_Y - 26, 14, 0.006, 16, 0.0021));
  ctx.lineTo(W, GROUND_Y + 4);
  ctx.closePath(); ctx.fill();
}
function drawFloaties() {
  for (const f of floaties) {
    const y = f.y + Math.sin(time * 1.3 + f.ph) * 12;
    ctx.globalAlpha = 0.32;
    if (f.kind === 'heart') {
      ctx.fillStyle = pal.heart;
      heartPath(f.x, y, 16 * f.s);
      ctx.fill();
    } else {
      ctx.fillStyle = '#fff3c4';
      starPath(f.x, y, 9 * f.s, time * 0.5 + f.ph);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function drawPipeShaft(x, y, w, h) {
  if (h <= 0) return;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#c964c9');
  g.addColorStop(0.16, '#ff9fd0');
  g.addColorStop(0.5, '#ffcde9');
  g.addColorStop(0.84, '#f88cc4');
  g.addColorStop(1, '#a958c4');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // candy stripes
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 8;
  for (let sx = x - h; sx < x + w + h; sx += 30) {
    ctx.beginPath();
    ctx.moveTo(sx, y + h + 4);
    ctx.lineTo(sx + h + 8, y - 4);
    ctx.stroke();
  }
  // little hearts down the middle
  ctx.fillStyle = 'rgba(190,45,130,0.28)';
  for (let hy = y + 42; hy < y + h - 30; hy += 84) {
    heartPath(x + w / 2, hy, 11);
    ctx.fill();
  }
  ctx.restore();
}
function drawCap(x, y, w) {
  const g = ctx.createLinearGradient(0, y, 0, y + 26);
  g.addColorStop(0, '#ffeaa8');
  g.addColorStop(0.5, '#ffd166');
  g.addColorStop(1, '#eda93d');
  ctx.fillStyle = g;
  rr(x, y, w, 26, 9);
  ctx.fill();
  ctx.strokeStyle = '#c98a24';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(x + w * 0.22, y + 8, 3, 0, 6.28);
  ctx.fill();
}
function drawPipes() {
  for (const p of pipes) {
    const gt = p.gapY - p.gapH / 2, gb = p.gapY + p.gapH / 2;
    drawPipeShaft(p.x, -8, TUNE.pipeW, gt - 26 + 8);      // top shaft (cap covers last 26px)
    drawPipeShaft(p.x, gb + 26, TUNE.pipeW, GROUND_Y - gb - 26 + 6);
    drawCap(p.x - 8, gt - 26, TUNE.pipeW + 16);
    drawCap(p.x - 8, gb, TUNE.pipeW + 16);
  }
}
function drawGround() {
  const g = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  g.addColorStop(0, pal.groundTop);
  g.addColorStop(1, pal.groundBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, GROUND_Y, W, TUNE.groundH);
  // scalloped lace edge
  ctx.fillStyle = pal.scallop;
  const off = -mod(scrollX, 22);
  for (let x = off - 22; x < W + 22; x += 22) {
    ctx.beginPath();
    ctx.arc(x, GROUND_Y + 4, 11, 0, 6.28);
    ctx.fill();
  }
  // candy path stripes
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  const soff = -mod(scrollX, 52);
  for (let x = soff - 60; x < W + 60; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + 18, GROUND_Y + 14);
    ctx.lineTo(x + 44, GROUND_Y + 14);
    ctx.lineTo(x + 26, H);
    ctx.closePath();
    ctx.fill();
  }
  // twinkling sparkle dust
  for (const s of groundSparks) {
    const a = 0.35 + 0.65 * Math.abs(Math.sin(time * 2.6 + s.ph));
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = '#fffbe8';
    starPath(mod(s.x - scrollX * 0.9, W + 30) - 15, s.y, 4.5, 0);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(0, GROUND_Y - 2, W, 3);
}
function drawBird() {
  const C = CHARS[selChar];
  const wingA = bird.flapAnim > 0
    ? Math.sin(bird.flapAnim * Math.PI * 3.5) * 0.9
    : Math.sin(time * 6) * 0.25;
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rot);
  // tail feathers
  ctx.fillStyle = C.tail;
  ctx.beginPath(); ctx.moveTo(-14, -3); ctx.lineTo(-27, -9); ctx.lineTo(-17, 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14, 2); ctx.lineTo(-28, 1); ctx.lineTo(-15, 8); ctx.closePath(); ctx.fill();
  // body
  const bg = ctx.createLinearGradient(0, -20, 0, 20);
  bg.addColorStop(0, C.bodyTop);
  bg.addColorStop(1, C.bodyBot);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(0, 0, 21, 17, 0, 0, 6.28);
  ctx.fill();
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = 2;
  ctx.stroke();
  // belly
  ctx.fillStyle = C.belly;
  ctx.beginPath();
  ctx.ellipse(3, 7, 12, 8, -0.2, 0, 6.28);
  ctx.fill();
  // wing (flaps on tap)
  ctx.save();
  ctx.translate(-3, 1);
  ctx.rotate(-wingA);
  ctx.fillStyle = C.wing;
  ctx.beginPath();
  ctx.ellipse(-7, 0, 11, 6.5, 0.15, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-9, -1.5, 6, 2.6, 0.15, 0, 6.28);
  ctx.fill();
  ctx.restore();
  // beak
  ctx.fillStyle = '#ffb04d';
  ctx.beginPath();
  ctx.moveTo(15, -5);
  ctx.lineTo(27, -1);
  ctx.lineTo(15, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,110,20,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(16, -0.5); ctx.lineTo(24, -1); ctx.stroke();
  // eye + lashes + blush
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(8, -6, 5.6, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#3a2434';
  ctx.beginPath(); ctx.arc(9.4, -5.6, 2.7, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(10.3, -6.6, 1, 0, 6.28); ctx.fill();
  if (C.lashes) {
    ctx.strokeStyle = '#3a2434';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(4.5, -10.5); ctx.lineTo(2.2, -12.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6.5, -11.8); ctx.lineTo(5.2, -14.2); ctx.stroke();
  }
  ctx.fillStyle = C.blush;
  ctx.beginPath(); ctx.ellipse(12, 1.5, 3.6, 2.4, 0, 0, 6.28); ctx.fill();
  // 👑 headwear
  if (C.crown === 'tiara') drawTiara(); else drawCrown();
  ctx.restore();
}
function drawTiara() {
  ctx.save();
  ctx.translate(-2, -15);
  ctx.rotate(-0.08);
  const gold = ctx.createLinearGradient(0, -14, 0, 0);
  gold.addColorStop(0, '#ffe89a');
  gold.addColorStop(1, '#f0b23c');
  ctx.fillStyle = gold;
  ctx.strokeStyle = '#c98a24';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-9, -6);
  ctx.lineTo(-5.5, -1.5);
  ctx.lineTo(-2.5, -12);
  ctx.lineTo(1, -1.5);
  ctx.lineTo(5, -8);
  ctx.lineTo(7, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  rr(-11, -1, 19, 4, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff5fa8';
  ctx.beginPath(); ctx.arc(-2.5, -12, 2, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#7ec8ff';
  ctx.beginPath(); ctx.arc(-9, -6, 1.5, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(5, -8, 1.5, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#ff8fc0';
  ctx.beginPath(); ctx.arc(-1.5, 1, 1.4, 0, 6.28); ctx.fill();
  ctx.restore();
}
function drawCrown() {
  ctx.save();
  ctx.translate(-2, -14);
  ctx.rotate(-0.04);
  const gold = ctx.createLinearGradient(0, -15, 0, 2);
  gold.addColorStop(0, '#ffe89a');
  gold.addColorStop(1, '#f0b23c');
  ctx.fillStyle = gold;
  ctx.strokeStyle = '#c98a24';
  ctx.lineWidth = 1.5;
  ctx.beginPath();                 // three-point king crown
  ctx.moveTo(-10, -3);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-5.5, -6.5);
  ctx.lineTo(-1, -14);
  ctx.lineTo(3.5, -6.5);
  ctx.lineTo(8, -12);
  ctx.lineTo(8, -3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  rr(-11, -3.5, 20, 5.5, 2);       // band
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd166';       // gold balls on the tips
  ctx.beginPath(); ctx.arc(-10, -12.5, 1.6, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(-1, -14.5, 1.8, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(8, -12.5, 1.6, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#ff4d6d';       // ruby center
  ctx.beginPath(); ctx.arc(-1, -0.8, 1.7, 0, 6.28); ctx.fill();
  ctx.fillStyle = '#7ec8ff';       // sapphires
  ctx.beginPath(); ctx.arc(-7, -0.8, 1.3, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(5, -0.8, 1.3, 0, 6.28); ctx.fill();
  ctx.restore();
}
function drawParticles() {
  for (const p of particles) {
    const a = clamp(1 - p.t / p.dur, 0, 1);
    ctx.globalAlpha = a;
    if (p.kind === 'confetti') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      starPath(p.x, p.y, p.size, p.rot);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function drawHud() {
  if (state === 'play' && started) {
    drawTextC(String(score), W / 2, 58, 58, '#ffffff', '#b04a8f', 9);
    drawTextC(`Level ${level}`, W / 2, 98, 21, 'rgba(255,255,255,0.92)', 'rgba(146,60,120,0.75)', 5, 600);
  }
  if (state === 'play' && !started) {
    const a = 0.7 + 0.3 * Math.sin(time * 5);
    ctx.globalAlpha = a;
    drawTextC('Tap to flap!', W / 2, H * 0.62, 40, '#ffffff', '#b04a8f', 8);
    ctx.globalAlpha = 1;
  }
  if (state === 'play' && awaitResume) {
    ctx.fillStyle = 'rgba(60,25,80,0.35)';
    ctx.fillRect(0, 0, W, H);
    drawTextC('Tap to continue', W / 2, H * 0.45, 40, '#ffffff', '#b04a8f', 8);
  }
  if (toast) {
    const popT = clamp(toast.t / 0.28, 0, 1);
    const fade = clamp((toast.dur - toast.t) / 0.4, 0, 1);
    ctx.save();
    ctx.translate(W / 2, H * 0.3);
    ctx.scale(easeOutBack(popT), easeOutBack(popT));
    ctx.globalAlpha = fade;
    drawTextC(toast.text, 0, 0, 56, '#fff6d8', '#c9871f', 10);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
function render() {
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  if (shake > 0) ctx.translate(rand(-1, 1) * 7 * shake, rand(-1, 1) * 7 * shake);
  drawSky();
  drawStarsMoon();
  drawClouds();
  drawCastle();
  drawHills();
  drawFloaties();
  drawPipes();
  drawGround();
  drawBird();
  drawParticles();
  drawHud();
  if (flash > 0) {
    ctx.globalAlpha = clamp(flash, 0, 1) * 0.7;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

/* ─── UI wiring ─── */
startBtn.addEventListener('click', () => { SFX.ensure(); SFX.click(); startGame(); startBtn.blur(); });
retryBtn.addEventListener('click', () => { if (!overButtonsReady) return; SFX.ensure(); SFX.click(); restart(); retryBtn.blur(); });
menuBtn.addEventListener('click', () => { if (!overButtonsReady) return; SFX.ensure(); SFX.click(); toMenu(); menuBtn.blur(); });
muteBtn.addEventListener('click', () => {
  SFX.ensure();
  muteBtn.textContent = SFX.toggle() ? '🔇' : '🔊';
  muteBtn.blur();
});
resetBtn.addEventListener('click', () => {
  SFX.ensure();
  if (resetArm) {
    clearTimeout(resetArm);
    resetArm = 0;
    best = 0; bestLevel = 1;
    store.set('fj_best', 0);
    store.set('fj_bestLevel', 1);
    updateMenuBest();
    resetBtn.textContent = 'cleared! ✨';
    setTimeout(() => { resetBtn.textContent = 'reset high score'; }, 1200);
  } else {
    resetBtn.textContent = 'tap again to confirm';
    resetArm = setTimeout(() => { resetArm = 0; resetBtn.textContent = 'reset high score'; }, 2500);
  }
});
function applyCharUI() {
  pickJade.classList.toggle('selected', selChar === 'jade');
  pickDarling.classList.toggle('selected', selChar === 'darling');
  pickJade.setAttribute('aria-pressed', String(selChar === 'jade'));
  pickDarling.setAttribute('aria-pressed', String(selChar === 'darling'));
}
function selectChar(id) {
  SFX.ensure();
  if (!CHARS[id] || selChar === id) return;
  selChar = id;
  store.set('fj_char', id);
  SFX.click();
  applyCharUI();
}
pickJade.addEventListener('click', () => { selectChar('jade'); pickJade.blur(); });
pickDarling.addEventListener('click', () => { selectChar('darling'); pickDarling.blur(); });

/* ─── Main loop (delta-time; clamped so pauses/hiccups can't teleport the bird) ─── */
let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) dt = 0.0001;
  if (dt > 1 / 30) dt = 1 / 30;
  if (!blocked) update(dt);
  render();
}

/* ─── Init ─── */
if (document.fonts && document.fonts.load) {
  document.fonts.load('700 60px Fredoka').catch(() => {});
}
layout();
checkOrientation();
updateMenuBest();
applyCharUI();
muteBtn.textContent = SFX.muted ? '🔇' : '🔊';
requestAnimationFrame(tick);

/* Tiny debug/test handle (harmless in production) */
window.FJ = {
  get: () => ({
    state, started, dying, awaitResume, blocked, score, level, speed, char: selChar,
    bird: { x: bird.x, y: bird.y, vy: bird.vy },
    pipes: pipes.map(p => ({ x: p.x, gapY: p.gapY, gapH: p.gapH })),
  }),
  flap: primaryAction,
};
