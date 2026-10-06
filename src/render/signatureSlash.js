/**
 * Signature moves: the attacker's elemental slash, drawn at the exact point where a lethal
 * trail cut (or a lethal body hit) happened. "This character just attacked."
 *
 * Every element has its own SHAPE LANGUAGE (not a recoloured burst):
 *   CORE    electric arc + bright energy streak + pulse ring
 *   EMBER   burning crescent + sparks + red-orange flare
 *   GLACIER straight ice blade + shard burst + hexagonal frost ring
 *   VOID    dark lens-shaped tear + inward-pulled motes + contracting ripples
 *   TIDAL   thick curved water arc + droplet spray + splash ellipse
 *   SOL     golden arc + radial rays + bright flash disc
 *   TERRA   jagged crack + flying rock chunks + dust puffs
 *   GALE    three thin curved wind blades + swirl streaks
 *   VERDANT curved vine slash + leaves + green bloom ring
 *
 * Timeline (~0.55-0.7 s): a fast sweep-in (0.12 s), an impact flash, then a fade. Pooled,
 * fixed size, nothing allocated per frame except a few strokes.
 */

const TAU = Math.PI * 2;
const POOL = 16;
const SWEEP = 0.12; // seconds for the slash to cut across
const SHARDS = 7;
// Pale elements get a deeper tone of their own colour family so they read on the light floor.
const ICE = '#3fb2e6';
const WIND = '#5f9fc0';

const DURATION = Object.freeze({
  CORE: 0.55, EMBER: 0.65, GLACIER: 0.6, VOID: 0.7, TIDAL: 0.6, SOL: 0.6, TERRA: 0.65, GALE: 0.5, VERDANT: 0.65,
});

const easeOut = (k) => 1 - (1 - k) ** 3;
const rnd = (seed, i) => {
  const s = Math.sin(seed * 91.7 + i * 47.3) * 43758.5453;
  return s - Math.floor(s);
};

function makeSlash() {
  return { active: false, element: 'CORE', palette: null, x: 0, y: 0, heading: 0, age: 0, dur: 0.6, seed: 0, scale: 1 };
}

export class SignatureSlashes {
  constructor() {
    this.pool = Array.from({ length: POOL }, makeSlash);
    this.next = 0;
  }

  clear() {
    for (const s of this.pool) s.active = false;
  }

  get activeCount() {
    let n = 0;
    for (const s of this.pool) if (s.active) n++;
    return n;
  }

  /**
   * @param {object} character attacker's character (element + palette)
   * @param {number} heading direction of the attacking movement (radians)
   * @param {number} [scale] 1 for a trail slice, smaller for a body hit
   */
  emit(character, x, y, heading, scale = 1) {
    const s = this.pool[this.next];
    this.next = (this.next + 1) % POOL;
    s.active = true;
    s.element = character.element in DURATION ? character.element : 'CORE';
    s.palette = character.palette;
    s.x = x;
    s.y = y;
    s.heading = heading;
    s.age = 0;
    s.dur = DURATION[s.element];
    s.seed = Math.random() * 1000;
    s.scale = scale;
    return s;
  }

  update(dt) {
    for (const s of this.pool) {
      if (!s.active) continue;
      s.age += Math.max(0, dt); // a restarted loop can report a tiny negative step
      if (s.age >= s.dur) s.active = false;
    }
  }

  draw(ctx, zoom, time) {
    for (const s of this.pool) if (s.active) drawSlash(ctx, s, zoom, time);
  }
}

const WEIGHT = 1.7; // all slash strokes are this much bolder than their nominal width

/**
 * Stroke a path three times: a wide soft glow in the element colour (energy), a thin dark
 * edge (readable on the light floor), then the bold colour stroke.
 */
function duo(ctx, color, width, px, alpha) {
  const w = width * WEIGHT;
  ctx.globalAlpha = alpha * 0.22;
  ctx.strokeStyle = color;
  ctx.lineWidth = w * 3.2 + 6 * px;
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = 'rgba(12, 18, 32, 0.9)';
  ctx.lineWidth = w + 2.5 * px;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function drawSlash(ctx, s, zoom, time) {
  const px = 1 / zoom;
  const L = Math.max(78, 64 / zoom) * s.scale; // half length of the main stroke (world units)
  const k = s.age / s.dur;
  const sweep = easeOut(Math.min(1, s.age / SWEEP));
  const fade = s.age < SWEEP ? 1 : Math.max(0, 1 - (s.age - SWEEP) / (s.dur - SWEEP));
  const out = easeOut(Math.min(1, s.age / (s.dur * 0.7))); // how far bursts have travelled
  const p = s.palette;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.heading);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Impact flash: a short bright disc right at the cut point.
  if (s.age < 0.16) {
    const f = 1 - s.age / 0.16;
    ctx.globalAlpha = 0.75 * f;
    ctx.fillStyle = s.element === 'VOID' ? 'rgba(20, 0, 40, 0.9)' : '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, L * (0.18 + 0.25 * (1 - f)), 0, TAU);
    ctx.fill();
  }

  switch (s.element) {
    case 'EMBER': drawEmber(ctx, s, L, px, sweep, fade, out, p); break;
    case 'GLACIER': drawGlacier(ctx, s, L, px, sweep, fade, out, p); break;
    case 'VOID': drawVoid(ctx, s, L, px, sweep, fade, out, p, k); break;
    case 'TIDAL': drawTidal(ctx, s, L, px, sweep, fade, out, p); break;
    case 'SOL': drawSol(ctx, s, L, px, sweep, fade, out, p); break;
    case 'TERRA': drawTerra(ctx, s, L, px, sweep, fade, out, p); break;
    case 'GALE': drawGale(ctx, s, L, px, sweep, fade, out, p); break;
    case 'VERDANT': drawVerdant(ctx, s, L, px, sweep, fade, out, p); break;
    default: drawCore(ctx, s, L, px, sweep, fade, out, p, time);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- element shapes
// Local space: +x is the attack direction, the cut point is (0, 0).

function drawCore(ctx, s, L, px, sweep, fade, out, p, time) {
  // Energy streak cutting through.
  ctx.beginPath();
  ctx.moveTo(-L, 0);
  ctx.lineTo(-L + 2 * L * sweep, 0);
  duo(ctx, p.primary, 5 * px, px, fade);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8 * px;
  ctx.stroke();
  // A jagged electric arc that flickers (re-randomised every few frames).
  const flick = Math.floor(time * 30);
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const x = -L * 0.7 + (i / 8) * L * 1.4 * sweep;
    const y = (rnd(s.seed + flick, i) - 0.5) * L * 0.35;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  duo(ctx, p.accent, 2.2 * px, px, fade * 0.95);
  // Pulse ring + electric sparks.
  ctx.beginPath();
  ctx.arc(0, 0, L * 0.55 * out, 0, TAU);
  duo(ctx, p.primary, 2.5 * px, px, fade * 0.7);
  for (let i = 0; i < 6; i++) {
    const a = rnd(s.seed, i + 20) * TAU;
    const r0 = L * 0.25 * out;
    const r1 = L * (0.45 + rnd(s.seed, i + 30) * 0.35) * out;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a + 0.2) * (r0 + r1) * 0.5, Math.sin(a + 0.2) * (r0 + r1) * 0.5);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    duo(ctx, p.accent, 1.6 * px, px, fade);
  }
}

function drawEmber(ctx, s, L, px, sweep, fade, out, p) {
  // Burning crescent: filled, hot core, swept along the attack.
  const span = Math.PI * 0.9 * sweep;
  const start = -Math.PI * 0.45;
  for (const [color, width, a] of [['#7a1500', 1, 0.6], [p.primary, 0.8, 0.95], [p.accent, 0.35, 1]]) {
    ctx.beginPath();
    ctx.arc(-L * 0.25, 0, L * 0.85, start, start + span);
    ctx.arc(-L * 0.05, 0, L * (0.85 - 0.22 * width), start + span, start, true);
    ctx.closePath();
    ctx.globalAlpha = fade * a;
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Sparks flung forward along the slash.
  for (let i = 0; i < 9; i++) {
    const a = (rnd(s.seed, i) - 0.5) * 1.6;
    const d = L * (0.4 + rnd(s.seed, i + 9) * 0.9) * out;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    ctx.globalAlpha = fade;
    ctx.fillStyle = i % 2 ? p.accent : p.primary;
    ctx.beginPath();
    ctx.arc(x, y, (1.6 + rnd(s.seed, i + 3) * 1.8) * px * 1.4, 0, TAU);
    ctx.fill();
  }
  // Red-orange flare at the cut.
  ctx.globalAlpha = fade * 0.5;
  ctx.fillStyle = '#ff4a1c';
  ctx.beginPath();
  ctx.arc(0, 0, L * 0.3 * (0.6 + 0.4 * out), 0, TAU);
  ctx.fill();
}

function drawGlacier(ctx, s, L, px, sweep, fade, out, p) {
  // A straight, sharp ice blade (thin diamond).
  const len = L * 1.1 * sweep;
  ctx.beginPath();
  ctx.moveTo(-L * 1.1, 0);
  ctx.lineTo(-L * 1.1 + len * 0.6, -L * 0.07);
  ctx.lineTo(-L * 1.1 + len * 2, 0);
  ctx.lineTo(-L * 1.1 + len * 0.6, L * 0.07);
  ctx.closePath();
  ctx.globalAlpha = fade;
  ctx.fillStyle = p.accent;
  ctx.fill();
  duo(ctx, ICE, 1.5 * px, px, fade);
  // Shards bursting out sideways.
  for (let i = 0; i < SHARDS; i++) {
    const side = i % 2 ? 1 : -1;
    const a = side * (0.8 + rnd(s.seed, i) * 1.2);
    const d = L * (0.25 + 0.6 * rnd(s.seed, i + 7)) * out;
    ctx.save();
    ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
    ctx.rotate(a + s.age * 6 * side);
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.13);
    ctx.lineTo(L * 0.05, L * 0.06);
    ctx.lineTo(-L * 0.05, L * 0.06);
    ctx.closePath();
    ctx.globalAlpha = fade;
    ctx.fillStyle = p.primary;
    ctx.fill();
    duo(ctx, ICE, 1 * px, px, fade);
    ctx.restore();
  }
  // Hexagonal frost ring.
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * TAU;
    const r = L * 0.5 * out;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  duo(ctx, ICE, 2 * px, px, fade * 0.8);
}

function drawVoid(ctx, s, L, px, sweep, fade, out, p, k) {
  // A dark dimensional tear: a lens that opens, then closes.
  const open = Math.sin(Math.min(1, k * 1.4) * Math.PI) * L * 0.22;
  const len = L * sweep;
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.quadraticCurveTo(0, -open * 2, len, 0);
  ctx.quadraticCurveTo(0, open * 2, -len, 0);
  ctx.closePath();
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#12021f';
  ctx.fill();
  duo(ctx, p.primary, 2.4 * px, px, fade);
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 1 * px;
  ctx.stroke();
  // Motes pulled INTO the tear.
  for (let i = 0; i < 10; i++) {
    const a = rnd(s.seed, i) * TAU;
    const d = L * (0.9 - 0.75 * out) * (0.6 + rnd(s.seed, i + 10) * 0.6);
    ctx.globalAlpha = fade;
    ctx.fillStyle = i % 2 ? p.accent : p.primary;
    ctx.beginPath();
    ctx.arc(Math.cos(a + out * 1.5) * d, Math.sin(a + out * 1.5) * d * 0.7, 1.8 * px * 1.3, 0, TAU);
    ctx.fill();
  }
  // Contracting distortion ripples.
  for (let i = 0; i < 2; i++) {
    const r = L * (1 - out * 0.7) * (0.6 + i * 0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.6, 0, 0, TAU);
    duo(ctx, p.primary, 1.4 * px, px, fade * 0.5);
  }
}

function drawTidal(ctx, s, L, px, sweep, fade, out, p) {
  // A thick curved water blade.
  const span = Math.PI * 0.8 * sweep;
  ctx.beginPath();
  ctx.arc(-L * 0.3, L * 0.55, L * 0.95, -Math.PI * 0.85, -Math.PI * 0.85 + span);
  duo(ctx, p.primary, 7 * px, px, fade);
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2 * px;
  ctx.globalAlpha = fade;
  ctx.stroke();
  // Droplets sprayed along the tangent.
  for (let i = 0; i < 10; i++) {
    const a = -0.6 + rnd(s.seed, i) * 1.2;
    const d = L * (0.3 + rnd(s.seed, i + 11) * 0.8) * out;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d + out * out * L * 0.25; // a little gravity
    ctx.globalAlpha = fade;
    ctx.fillStyle = p.particle;
    ctx.beginPath();
    ctx.arc(x, y, 2.2 * px * 1.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10, 40, 80, 0.5)';
    ctx.lineWidth = 0.8 * px;
    ctx.stroke();
  }
  // Splash ring.
  ctx.beginPath();
  ctx.ellipse(0, 0, L * 0.6 * out, L * 0.32 * out, 0, 0, TAU);
  duo(ctx, p.accent, 2 * px, px, fade * 0.7);
}

function drawSol(ctx, s, L, px, sweep, fade, out, p) {
  // Bright solar disc.
  ctx.globalAlpha = fade * 0.55;
  ctx.fillStyle = p.primary;
  ctx.beginPath();
  ctx.arc(0, 0, L * 0.32 * (0.5 + out * 0.5), 0, TAU);
  ctx.fill();
  // Golden arc through the cut.
  ctx.beginPath();
  ctx.arc(0, L * 0.9, L * 1.1, -Math.PI / 2 - 0.75 * sweep, -Math.PI / 2 + 0.75 * sweep);
  duo(ctx, p.primary, 5 * px, px, fade);
  ctx.strokeStyle = '#fff6c8';
  ctx.lineWidth = 1.6 * px;
  ctx.stroke();
  // Radial rays (corona), alternating long and short.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const r0 = L * 0.35;
    const r1 = L * (i % 2 ? 0.6 : 0.95) * out;
    if (r1 <= r0) continue;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    duo(ctx, i % 2 ? p.accent : p.primary, 2 * px, px, fade);
  }
}

function drawTerra(ctx, s, L, px, sweep, fade, out, p) {
  // A jagged crack struck across.
  ctx.beginPath();
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const x = -L + (i / n) * 2 * L * sweep;
    const y = (i % 2 ? 1 : -1) * L * 0.1 * (0.5 + rnd(s.seed, i));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  duo(ctx, p.accent, 4 * px, px, fade);
  // Rock chunks flying out (irregular polygons).
  for (let i = 0; i < 8; i++) {
    const a = rnd(s.seed, i) * TAU;
    const d = L * (0.25 + rnd(s.seed, i + 8) * 0.6) * out;
    const r = L * (0.05 + rnd(s.seed, i + 16) * 0.05);
    ctx.save();
    ctx.translate(Math.cos(a) * d, Math.sin(a) * d + out * out * L * 0.15);
    ctx.rotate(a + s.age * 4);
    ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      const b = (j / 5) * TAU;
      const rr = r * (j % 2 ? 0.7 : 1.1);
      if (j === 0) ctx.moveTo(Math.cos(b) * rr, Math.sin(b) * rr);
      else ctx.lineTo(Math.cos(b) * rr, Math.sin(b) * rr);
    }
    ctx.closePath();
    ctx.globalAlpha = fade;
    ctx.fillStyle = i % 2 ? p.primary : p.secondary;
    ctx.fill();
    ctx.restore();
  }
  // Dust puffs.
  for (let i = 0; i < 4; i++) {
    const a = rnd(s.seed, i + 30) * TAU;
    const d = L * 0.35 * out;
    ctx.globalAlpha = fade * 0.25;
    ctx.fillStyle = p.particle;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, L * (0.12 + 0.18 * out), 0, TAU);
    ctx.fill();
  }
}

function drawGale(ctx, s, L, px, sweep, fade, out, p) {
  // Three thin curved wind blades, staggered.
  for (let i = 0; i < 3; i++) {
    const delay = i * 0.12;
    const local = Math.max(0, Math.min(1, (sweep - delay) / (1 - delay)));
    if (local <= 0) continue;
    const off = (i - 1) * L * 0.22;
    ctx.beginPath();
    ctx.moveTo(-L, off + L * 0.25);
    ctx.quadraticCurveTo(0, off - L * 0.35, -L + 2 * L * local, off + L * 0.1);
    duo(ctx, WIND, (i === 1 ? 3 : 1.8) * px, px, fade * (1 - i * 0.15));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = (i === 1 ? 1.4 : 0.8) * px;
    ctx.stroke();
  }
  // Swirl streaks around the cut.
  for (let i = 0; i < 6; i++) {
    const a = rnd(s.seed, i) * TAU + out * 3;
    const r = L * (0.3 + 0.4 * out);
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.7 + rnd(s.seed, i + 6) * 0.5), a, a + 0.7);
    duo(ctx, WIND, 1.2 * px, px, fade * 0.8);
  }
}

function drawVerdant(ctx, s, L, px, sweep, fade, out, p) {
  // A curved vine slash.
  const end = -L + 2 * L * sweep;
  ctx.beginPath();
  ctx.moveTo(-L, L * 0.3);
  ctx.bezierCurveTo(-L * 0.3, -L * 0.45, L * 0.3, L * 0.45, end, -L * 0.2 * sweep);
  duo(ctx, p.primary, 4.5 * px, px, fade);
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 1.2 * px;
  ctx.globalAlpha = fade;
  ctx.stroke();
  // Leaves scattering from the cut.
  for (let i = 0; i < 8; i++) {
    const a = rnd(s.seed, i) * TAU;
    const d = L * (0.25 + rnd(s.seed, i + 8) * 0.65) * out;
    ctx.save();
    ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
    ctx.rotate(a + s.age * 5);
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.04, L * 0.1, 0, 0, TAU);
    ctx.globalAlpha = fade;
    ctx.fillStyle = i % 2 ? p.primary : p.particle;
    ctx.fill();
    ctx.restore();
  }
  // Organic bloom ring (petal-scalloped).
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU;
    const r = L * 0.45 * out * (1 + 0.12 * Math.sin(a * 6));
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  duo(ctx, p.primary, 1.6 * px, px, fade * 0.7);
}
