/**
 * StrategicLandmarkRenderer — pseudo-3D Canvas 2D artwork for the four strategic
 * landmarks (Claim Beacon, Flux Core, Rift Gate, Stasis Structure) plus the
 * claimed-only territory boundary.
 *
 * Visual language matches the DOMINION characters (render/CreatureRenderer.js):
 * layered gradient-lit volumes, dark bevel silhouettes, rim light from the shared
 * upper-left world light, bright internal cores in dark sockets, cached glow
 * sprites instead of shadowBlur, floating debris for depth, and sparse motes.
 * No WebGL, no minimap icons, no permanent circles: an unclaimed landmark draws
 * only the physical structure and its atmosphere.
 *
 * All state lives on the landmark objects (see StrategicLandmarkManager and the
 * individual systems); this module only reads it and paints.
 */
import { CLAIM_BEACON, FLUX_CORE, LANDMARKS, RIFT, STASIS } from '../config.js';
import { glowSprite, haloSprite, shadowSprite, socketSprite } from './sprites.js';

const TAU = Math.PI * 2;
const GOLDEN = 0.6180339887498949;
const DEEP_METAL = '#04060e';

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function easeOutCubic(k) { return 1 - (1 - k) ** 3; }
function fract(v) { return v - Math.floor(v); }
function hashRand(seed, i) {
  const s = Math.sin(seed * 91.7 + i * 47.3) * 43758.5453;
  return s - Math.floor(s);
}

/** Deterministic per-landmark seed so every structure keeps its own silhouette. */
function seedOf(lm) {
  if (lm.seed === undefined) {
    const s = Math.sin(lm.x * 12.9898 + lm.y * 78.233) * 43758.5453;
    lm.seed = 1 + (s - Math.floor(s)) * 999;
  }
  return lm.seed;
}

/**
 * Landmark energy: full while its gameplay effect is live, visibly muted on
 * cooldown, and a little brighter while claimed by a domain.
 */
function powerOf(lm) {
  let p = lm.active ? 1 : 0.3;
  if (lm.claimT) p = Math.min(1.2, p + 0.18 * lm.claimT);
  return p;
}

/** Angular alien rubble: a jittered polygon around the origin. */
function rockPath(ctx, r, seed, sides = 6) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * TAU;
    const rr = r * (0.68 + 0.44 * hashRand(seed, i));
    const px = Math.cos(angle) * rr;
    const py = Math.sin(angle) * rr * 0.9;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Floating debris field shared by every structure (two draw passes for depth). */
function drawDebris(ctx, lm, time, opts, pass) {
  const { hue, cx, cy, rad, count, power, squash = 0.36 } = opts;
  if (!lm.debris || lm.debris.length !== count) {
    const seed = seedOf(lm);
    lm.debris = Array.from({ length: count }, (_, i) => ({
      phase: hashRand(seed, i) * TAU,
      rad: rad * (0.62 + 0.55 * hashRand(seed, i + 11)),
      size: (7 + 7 * hashRand(seed, i + 23)) * LANDMARKS.SCALE,
      speed: (0.16 + 0.3 * hashRand(seed, i + 37)) * (hashRand(seed, i + 51) > 0.5 ? 1 : -1),
      spin: (0.2 + 0.5 * hashRand(seed, i + 67)) * (hashRand(seed, i + 71) > 0.5 ? 1 : -1),
      bob: (2 + 4 * hashRand(seed, i + 83)) * LANDMARKS.SCALE,
      lift: (hashRand(seed, i + 97) - 0.5) * 26 * LANDMARKS.SCALE,
    }));
  }
  const behind = pass === 0;
  for (let i = 0; i < lm.debris.length; i++) {
    const d = lm.debris[i];
    const a = time * d.speed * (0.35 + 0.65 * Math.min(1, power)) + d.phase;
    const depth = Math.sin(a);
    if (behind !== depth < 0) continue;
    const px = cx + Math.cos(a) * d.rad;
    const py = cy + Math.sin(a) * d.rad * squash + d.lift
      + Math.sin(time * 1.4 + i * 2.1) * d.bob;
    const scale = d.size * (0.72 + 0.38 * (depth * 0.5 + 0.5));
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(time * d.spin + d.phase);
    rockPath(ctx, scale, seedOf(lm) + i * 3.7);
    const g = ctx.createLinearGradient(-scale, -scale, scale * 0.7, scale);
    g.addColorStop(0, `hsl(${hue}, 28%, 26%)`);
    g.addColorStop(0.5, `hsl(${hue}, 32%, 13%)`);
    g.addColorStop(1, DEEP_METAL);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, scale * 0.18);
    ctx.strokeStyle = 'rgba(2, 4, 10, 0.85)';
    ctx.stroke();
    if (depth > 0) {
      const rim = ctx.createLinearGradient(-scale, -scale, scale, scale * 0.5);
      rim.addColorStop(0, `hsla(${hue}, 100%, 86%, ${0.5 * depth})`);
      rim.addColorStop(1, `hsla(${hue}, 90%, 65%, 0)`);
      ctx.lineWidth = Math.max(0.8, scale * 0.12);
      ctx.strokeStyle = rim;
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Ambient motes rising around a structure — atmosphere, not an effect radius. */
function drawMotes(ctx, lm, time, opts) {
  const {
    hue, cx, cy, rx, rise, count, alpha = 0.5, speed = 0.16, power, slow = 1,
  } = opts;
  const n = Math.max(2, Math.round(count * LANDMARKS.PARTICLE_DENSITY));
  const seed = seedOf(lm);
  const rate = speed * (0.4 + 0.6 * Math.min(1, power)) * slow;
  for (let i = 0; i < n; i++) {
    const t = fract(time * rate + i * GOLDEN);
    const ang = hashRand(seed, i + 5) * TAU;
    const rr = rx * (0.4 + 0.6 * hashRand(seed, i + 19));
    const px = cx + Math.cos(ang) * rr * (1 - 0.25 * t)
      + Math.sin(time * 0.9 + i) * 3 * LANDMARKS.SCALE;
    const py = cy - rise * t;
    const a = Math.sin(Math.PI * t) * alpha * (0.4 + 0.6 * Math.min(1, power));
    const size = (5 + 5 * hashRand(seed, i + 31)) * LANDMARKS.SCALE;
    glowDot(ctx, hue, px, py, size, a);
  }
}

function glowDot(ctx, hue, x, y, size, alpha) {
  if (alpha <= 0.015 || size <= 0.5) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(glowSprite(hue), x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = 1;
}

/** Soft light the structure casts on the ground — restrained, never a ring. */
function drawLightPool(ctx, x, y, rx, ry, hue, alpha) {
  if (alpha <= 0.005) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `hsla(${hue}, 85%, 68%, ${alpha})`);
  g.addColorStop(0.5, `hsla(${hue}, 85%, 60%, ${alpha * 0.42})`);
  g.addColorStop(1, `hsla(${hue}, 85%, 55%, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

function drawContactShadow(ctx, x, y, rx, ry) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.drawImage(shadowSprite(), -rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Dark bevel first (defined silhouette), then rim light from the upper-left. */
function bevelStroke(ctx, lw) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = 'rgba(2, 4, 10, 0.92)';
  ctx.stroke();
}

function rimStroke(ctx, lw, hue, x0, y0, x1, y1, strength = 1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, `hsla(${hue}, 100%, 90%, ${0.9 * strength})`);
  g.addColorStop(0.5, `hsla(${hue}, 85%, 72%, ${0.45 * strength})`);
  g.addColorStop(1, `hsla(${hue}, 75%, 60%, ${0.12 * strength})`);
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = g;
  ctx.stroke();
}

/** Alien alloy face: lit toward the world light (upper-left), black falloff. */
function metalFace(ctx, hue, x0, y0, x1, y1, lit = 30, mid = 15) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, `hsl(${hue}, 34%, ${lit}%)`);
  g.addColorStop(0.55, `hsl(${hue}, 30%, ${mid}%)`);
  g.addColorStop(1, `hsl(${hue}, 40%, 6%)`);
  return g;
}

/** Rounded-rect path (canvas roundRect is not universally available). */
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

// ---------------------------------------------------------------- claim state visuals

/**
 * Brief expansion pulse fired the moment a claim lands (before the boundary
 * finishes growing). Owner-coloured, organic-edged, purely transient.
 */
function drawClaimPulse(ctx, lm, claimRadius) {
  const p = lm.claimPulse || 0;
  if (p <= 0 || !lm.ownerRgb) return;
  const t = 1 - p;
  const [r, g, b] = lm.ownerRgb;
  const k = easeOutCubic(t);
  const radius = 46 * LANDMARKS.SCALE + (claimRadius - 46 * LANDMARKS.SCALE) * k;
  const seed = seedOf(lm);
  ctx.beginPath();
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const ang = (i / N) * TAU;
    const wobble = 1 + 0.05 * Math.sin(ang * 3 + seed) + 0.04 * Math.sin(ang * 5 - seed);
    const px = lm.x + Math.cos(ang) * radius * wobble;
    const py = lm.y + Math.sin(ang) * radius * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.lineWidth = (5 * (1 - k) + 1.5) * LANDMARKS.SCALE;
  ctx.strokeStyle = `rgba(${Math.min(255, r + 70)}, ${Math.min(255, g + 70)}, ${Math.min(255, b + 70)}, ${(1 - t) * 0.85})`;
  ctx.stroke();
  ctx.lineWidth = 12 * (1 - k) * LANDMARKS.SCALE;
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(1 - t) * 0.2})`;
  ctx.stroke();
}

/** Organic scalloped boundary point for index i of n (shared by pulse/growth). */
function boundaryRadius(lm, ang, time, radius, wobble = 1) {
  const seed = seedOf(lm);
  return radius * (1 + wobble * (0
    + 0.07 * Math.sin(ang * 3 + time * 0.5 + seed)
    + 0.05 * Math.sin(ang * 5 - time * 0.36 + seed * 0.5)
    + 0.04 * Math.sin(ang * 2 + time * 0.22)
    + 0.05 * (hashRand(seed, Math.round(ang * 13.7)) - 0.5)));
}

let boundaryPts = null;

/**
 * The claimed-only strategic boundary: an extension of the player's territory
 * language — irregular geometry, layered edge, traveling pulses, riding motes.
 * Drawn ONLY after a claim (lm.claimT animates it in and out).
 */
/**
 * A landmark's EFFECT AREA on the ground (only for landmarks whose area does something:
 * the Bonus Tower's double-value glow, the Slow Tower's slow field). Drawn while the effect
 * is on, at the exact radius the gameplay uses; grows in and fades out. Tinted by the
 * owner's colour once captured.
 */
export function drawLandmarkZone(ctx, lm, time, radius, on, rgb) {
  const zone = lm.zone || (lm.zone = { x: lm.x, y: lm.y, seed: seedOf(lm), claimT: 0, last: time });
  const dt = Math.max(0, Math.min(0.1, time - zone.last));
  zone.last = time;
  zone.claimT = on ? Math.min(1, zone.claimT + dt / LANDMARKS.CLAIM_SEQUENCE_TIME) : Math.max(0, zone.claimT - dt * 2);
  zone.ownerRgb = lm.ownerRgb || rgb;
  if (zone.claimT <= 0.02) return;
  // Nearly a true circle: the line must match where the effect actually applies.
  drawLandmarkBoundary(ctx, zone, time, radius, 0.15);
}

let warmed = false;
/**
 * Draws every landmark type once into a hidden canvas so the browser's first-use cost
 * (seen as a one-off hitch of up to a second) happens while a match loads, not when the
 * first structure scrolls into view.
 */
export function warmLandmarkRenderers() {
  if (warmed) return;
  warmed = true;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const lm = (active) => ({ x: 256, y: 420, active, claimT: 0, claimPulse: 0, ownerSlot: 0, seed: 7, chargeT: 0.3, enterFx: 0, arrivals: [] });
  for (const draw of [drawClaimBeacon, drawFluxCore, drawRiftGate, drawStasisStructure]) {
    for (const active of [true, false]) {
      try { draw(ctx, lm(active), 1.234); } catch (error) { console.error('Landmark warm-up failed', error); }
    }
  }
}

export function drawLandmarkBoundary(ctx, lm, time, claimRadius, wobble = 1) {
  const claimT = lm.claimT || 0;
  if (claimT <= 0.02 || !lm.ownerRgb) return;
  // A missing / bad radius or position must never reach the canvas (it throws on NaN).
  if (!Number.isFinite(claimRadius) || !Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return;
  const grow = clamp01((claimT - 0.28) / 0.55);
  if (grow <= 0) return;
  const k = easeOutCubic(grow);
  const [r, g, b] = lm.ownerRgb;
  const start = 52 * LANDMARKS.SCALE;
  const radius = start + (claimRadius - start) * k;
  const N = 52;
  if (!boundaryPts || boundaryPts.length !== (N + 1) * 2) boundaryPts = new Float64Array((N + 1) * 2);

  const trace = (scale) => {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const ang = (i / N) * TAU;
      const rr = boundaryRadius(lm, ang, time, radius * scale, wobble);
      const px = lm.x + Math.cos(ang) * rr;
      const py = lm.y + Math.sin(ang) * rr;
      boundaryPts[i * 2] = px;
      boundaryPts[i * 2 + 1] = py;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  // Soft domain fill — just enough to read as connected land, never an arena.
  trace(1);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(0.05 + 0.02 * Math.sin(time * 0.9)) * k})`;
  ctx.fill();

  // Layered edge: outer glow, main line, inner hairline.
  trace(1);
  ctx.lineWidth = 11 * LANDMARKS.SCALE;
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.09 * k})`;
  ctx.stroke();
  ctx.lineWidth = 3.4 * LANDMARKS.SCALE;
  ctx.strokeStyle = `rgba(${Math.min(255, r + 45)}, ${Math.min(255, g + 45)}, ${Math.min(255, b + 45)}, ${0.5 * k + (grow < 1 ? 0.3 : 0)})`;
  ctx.stroke();
  trace(0.962);
  ctx.lineWidth = 1.4 * LANDMARKS.SCALE;
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.32 * k})`;
  ctx.stroke();

  // Occasional brighter pulses traveling along the edge.
  trace(1);
  const peri = radius * TAU;
  for (let j = 0; j < LANDMARKS.BOUNDARY_PULSES; j++) {
    const dash = 30 * LANDMARKS.SCALE;
    const spacing = peri / LANDMARKS.BOUNDARY_PULSES;
    ctx.setLineDash([dash, Math.max(1, spacing - dash)]);
    ctx.lineDashOffset = -(time * LANDMARKS.BOUNDARY_PULSE_SPEED + j * spacing);
    ctx.lineWidth = 4 * LANDMARKS.SCALE;
    ctx.strokeStyle = `rgba(${Math.min(255, r + 110)}, ${Math.min(255, g + 110)}, ${Math.min(255, b + 110)}, ${0.8 * k})`;
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Small motes riding portions of the boundary.
  const seed = seedOf(lm);
  for (let j = 0; j < 3; j++) {
    const phase = fract(time * 0.07 + j * GOLDEN);
    const ang = phase * TAU;
    const rr = boundaryRadius(lm, ang, time, radius, wobble);
    const a = Math.sin(phase * Math.PI) * 0.75 * k
      * (0.5 + 0.5 * Math.sin(time * 2 + j + seed));
    const size = 16 * LANDMARKS.SCALE;
    const px = lm.x + Math.cos(ang) * rr;
    const py = lm.y + Math.sin(ang) * rr;
    if (a > 0.02) {
      const dot = ctx.createRadialGradient(px, py, 0, px, py, size / 2);
      dot.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, a)})`);
      dot.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${Math.min(1, a)})`);
      dot.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = dot;
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
    }
  }
}

// ---------------------------------------------------------------- Claim Beacon

/**
 * A tall crystalline alien spire on a machined base: layered crystal facets,
 * a bright internal core in a dark socket, side shards, orbiting fragments.
 * States: dormant/core dim → active/core bright with energy climbing the spire
 * → cooldown muted. Claimed: the core synchronizes with the owner's colour.
 */
export function drawClaimBeacon(ctx, lm, time) {
  const hue = CLAIM_BEACON.HUE;
  const power = powerOf(lm);
  const S = LANDMARKS.SCALE;
  const H = 208 * S; // ~2.7× a character's height
  const W = 33 * S;

  ctx.save();
  ctx.translate(lm.x, lm.y);

  drawLightPool(ctx, 0, 0, 130 * S, 46 * S, hue, (0.10 + 0.12 * power) * LANDMARKS.GLOW);
  drawContactShadow(ctx, 6 * S, 5 * S, 88 * S, 30 * S);

  // Atmospheric halo behind the spire.
  ctx.globalAlpha = (0.35 + 0.3 * power) * LANDMARKS.GLOW;
  ctx.drawImage(haloSprite(hue), -95 * S, -H - 55 * S, 190 * S, 190 * S);
  ctx.globalAlpha = 1;

  drawDebris(ctx, lm, time, { hue, cx: 0, cy: -H * 0.45, rad: 78 * S, count: 6, power }, 0);

  // --- machined base: two stacked platform discs with glowing seams.
  ctx.beginPath();
  ctx.ellipse(0, 0, 66 * S, 24 * S, 0, 0, TAU);
  ctx.fillStyle = metalFace(ctx, hue, -66 * S, -20 * S, 66 * S, 22 * S, 26, 13);
  ctx.fill();
  bevelStroke(ctx, 3.5 * S);
  rimStroke(ctx, 1.6 * S, hue, -66 * S, -24 * S, 50 * S, 20 * S, 0.7);

  ctx.beginPath();
  ctx.ellipse(0, -10 * S, 47 * S, 17 * S, 0, 0, TAU);
  ctx.fillStyle = metalFace(ctx, hue, -47 * S, -24 * S, 47 * S, 8 * S, 34, 18);
  ctx.fill();
  bevelStroke(ctx, 3 * S);

  const seam = 0.35 + 0.4 * power + 0.15 * Math.sin(time * 2.4);
  ctx.setLineDash([26 * S, 15 * S]);
  ctx.lineDashOffset = -time * 18 * S;
  ctx.beginPath();
  ctx.ellipse(0, -10 * S, 47 * S, 17 * S, 0, 0, TAU);
  ctx.lineWidth = 2.2 * S;
  ctx.strokeStyle = `hsla(${hue}, 100%, 72%, ${seam})`;
  ctx.stroke();
  ctx.setLineDash([]);

  // --- flanking shards (silhouette depth).
  drawCrystal(ctx, -37 * S, 0, H * 0.52, 15 * S, hue, power * 0.7, 0.14, 3, time);
  drawCrystal(ctx, 35 * S, 0, H * 0.44, 13 * S, hue, power * 0.7, -0.12, 7, time);

  // --- main spire.
  drawCrystal(ctx, 0, -6 * S, H, W, hue, power, 0, 1, time);

  // --- internal core: socket + glow + hot centre, brightening with power.
  const coreY = -H * 0.56;
  const coreR = 24 * S * (0.86 + 0.14 * power + 0.04 * Math.sin(time * 3.4));
  ctx.drawImage(socketSprite(), -coreR * 1.7, coreY - coreR * 1.7, coreR * 3.4, coreR * 3.4);
  glowDot(ctx, hue, 0, coreY, coreR * 4.6, (0.5 + 0.4 * power) * LANDMARKS.GLOW);
  // Energy climbs the spire while active.
  if (power > 0.5) {
    ctx.save();
    ctx.setLineDash([14 * S, 26 * S]);
    ctx.lineDashOffset = -time * 90 * S;
    const climb = ctx.createLinearGradient(0, 0, 0, -H);
    climb.addColorStop(0, `hsla(${hue}, 100%, 75%, ${0.55 * power})`);
    climb.addColorStop(1, `hsla(${hue}, 100%, 85%, ${0.2 * power})`);
    ctx.strokeStyle = climb;
    ctx.lineWidth = 3 * S;
    ctx.beginPath();
    ctx.moveTo(0, -8 * S);
    ctx.lineTo(0, -H + 8 * S);
    ctx.stroke();
    ctx.restore();
  }
  const core = ctx.createRadialGradient(-coreR * 0.25, coreY - coreR * 0.3, coreR * 0.08, 0, coreY, coreR);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.35, `hsla(${hue}, 100%, 88%, 1)`);
  core.addColorStop(0.75, `hsla(${hue}, 100%, 62%, 0.95)`);
  core.addColorStop(1, `hsla(${hue}, 95%, 38%, 0.85)`);
  ctx.beginPath();
  ctx.arc(0, coreY, coreR, 0, TAU);
  ctx.fillStyle = core;
  ctx.fill();
  // Claimed: the core takes on the owner's domain colour.
  if (lm.claimT > 0.01 && lm.ownerRgb) {
    const [r, g, b] = lm.ownerRgb;
    const sync = ctx.createRadialGradient(0, coreY, 0, 0, coreY, coreR);
    sync.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.55 * lm.claimT})`);
    sync.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.beginPath();
    ctx.arc(0, coreY, coreR, 0, TAU);
    ctx.fillStyle = sync;
    ctx.fill();
  }

  drawDebris(ctx, lm, time, { hue, cx: 0, cy: -H * 0.45, rad: 78 * S, count: 6, power }, 1);
  drawMotes(ctx, lm, time, {
    hue, cx: 0, cy: -12 * S, rx: 74 * S, rise: H * 1.1, count: 7, alpha: 0.5, speed: 0.14, power,
  });

  drawClaimPulse(ctx, lm, CLAIM_BEACON.CLAIM_RADIUS);
  ctx.restore();
}

/**
 * One crystal shard: translucent facet gradient, darker shadow facet, bright
 * lit sliver, dark bevel, rim light — the character shell technique applied
 * to an angular alien form.
 */
function drawCrystal(ctx, cx, baseY, h, w, hue, power, tilt, seed, time = 0) {
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.quadraticCurveTo(w * 0.9, -h * 0.6, w * 0.6, -h * 0.2);
  ctx.lineTo(w * 0.3, 0);
  ctx.lineTo(-w * 0.3, 0);
  ctx.lineTo(-w * 0.6, -h * 0.2);
  ctx.quadraticCurveTo(-w * 0.9, -h * 0.6, 0, -h);
  ctx.closePath();

  const body = ctx.createLinearGradient(-w, -h * 0.62, w, -h * 0.18);
  body.addColorStop(0, `hsla(${hue}, 92%, 80%, 1)`);
  body.addColorStop(0.3, `hsla(${hue}, 78%, 56%, 1)`);
  body.addColorStop(0.66, `hsla(${hue}, 68%, 32%, 1)`);
  body.addColorStop(1, `hsla(${hue}, 62%, 13%, 1)`);
  ctx.fillStyle = body;
  ctx.fill();

  // Shadow facet on the right half, bright sliver on the lit edge, depth falloff.
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.quadraticCurveTo(w * 0.9, -h * 0.6, w * 0.6, -h * 0.2);
  ctx.lineTo(w * 0.3, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(3, 5, 12, 0.42)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.quadraticCurveTo(-w * 0.9, -h * 0.6, -w * 0.6, -h * 0.2);
  ctx.lineTo(-w * 0.36, -h * 0.22);
  ctx.quadraticCurveTo(-w * 0.7, -h * 0.62, 0, -h * 0.94);
  ctx.closePath();
  ctx.fillStyle = `hsla(${hue}, 100%, 92%, ${0.5 + 0.2 * power})`;
  ctx.fill();
  const depth = ctx.createLinearGradient(0, -h, 0, 0);
  depth.addColorStop(0, 'rgba(2, 4, 10, 0.5)');
  depth.addColorStop(0.45, 'rgba(2, 4, 10, 0)');
  depth.addColorStop(1, 'rgba(2, 4, 10, 0.55)');
  ctx.fillStyle = depth;
  ctx.fillRect(-w, -h, w * 2, h);
  ctx.restore();

  bevelStroke(ctx, Math.max(2, w * 0.16));
  rimStroke(ctx, Math.max(1.2, w * 0.08), hue, -w * 0.8, -h * 0.8, w * 0.8, -h * 0.2,
    0.75 + 0.25 * power);

  // Occasional glint travelling along the lit facet while powered.
  const glint = fract(time * 0.14 + seed * 0.37);
  if (power > 0.6 && glint < 0.22) {
    const gy = -h * (0.15 + glint * 3.2);
    const gl = ctx.createLinearGradient(-w * 0.5, gy, w * 0.5, gy - h * 0.1);
    gl.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gl.addColorStop(0.5, `rgba(255, 255, 255, ${0.55 * (1 - glint / 0.22)})`);
    gl.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = gl;
    ctx.lineWidth = Math.max(1, w * 0.1);
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, gy);
    ctx.lineTo(w * 0.5, gy - h * 0.06);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Flux Core

/**
 * A physical alien energy generator: white-hot core in a containment housing,
 * three segmented rings on tilted orbits, mechanical legs, orbiting debris.
 * Active: rings spin faster, embers rise, core blazes. Cooldown: everything
 * slows and dims — communicated through the machine itself.
 */
export function drawFluxCore(ctx, lm, time) {
  const hue = FLUX_CORE.HUE;
  const power = powerOf(lm);
  const S = LANDMARKS.SCALE;
  const coreY = -92 * S;
  const coreR = 40 * S * (0.9 + 0.08 * power + 0.03 * Math.sin(time * 3.1));
  const spin = 0.4 + 0.6 * Math.min(1, power);

  ctx.save();
  ctx.translate(lm.x, lm.y);

  drawLightPool(ctx, 0, 0, 148 * S, 52 * S, hue, (0.11 + 0.13 * power) * LANDMARKS.GLOW);
  drawContactShadow(ctx, 6 * S, 5 * S, 104 * S, 36 * S);
  ctx.globalAlpha = (0.35 + 0.35 * power) * LANDMARKS.GLOW;
  ctx.drawImage(haloSprite(hue), -110 * S, coreY - 110 * S, 220 * S, 220 * S);
  ctx.globalAlpha = 1;

  drawDebris(ctx, lm, time, { hue, cx: 0, cy: coreY, rad: 122 * S, count: 8, power, squash: 0.32 }, 0);

  // --- base ring on the ground.
  ctx.beginPath();
  ctx.ellipse(0, 0, 96 * S, 34 * S, 0, 0, TAU);
  ctx.fillStyle = metalFace(ctx, hue, -96 * S, -30 * S, 96 * S, 30 * S, 27, 13);
  ctx.fill();
  bevelStroke(ctx, 4 * S);
  rimStroke(ctx, 1.8 * S, hue, -96 * S, -34 * S, 70 * S, 26 * S, 0.7);
  ctx.setLineDash([30 * S, 18 * S]);
  ctx.lineDashOffset = time * 24 * S * spin;
  ctx.beginPath();
  ctx.ellipse(0, 0, 96 * S, 34 * S, 0, 0, TAU);
  ctx.lineWidth = 2.4 * S;
  ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${0.3 + 0.4 * power + 0.12 * Math.sin(time * 2)})`;
  ctx.stroke();
  ctx.setLineDash([]);

  // --- three angled support legs up to the housing.
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + 0.5;
    const bx = Math.cos(a) * 76 * S;
    const by = Math.sin(a) * 27 * S - 4 * S;
    const tx = Math.cos(a) * 30 * S;
    const ty = coreY + 30 * S + Math.sin(a) * 12 * S;
    const nx = Math.cos(a) * 7 * S;
    const ny = Math.sin(a) * 3.5 * S;
    ctx.beginPath();
    ctx.moveTo(bx - nx, by - ny);
    ctx.lineTo(tx - nx * 0.6, ty - ny * 0.6);
    ctx.lineTo(tx + nx * 0.6, ty + ny * 0.6);
    ctx.lineTo(bx + nx, by + ny);
    ctx.closePath();
    ctx.fillStyle = metalFace(ctx, hue, bx - 20 * S, ty, bx + 20 * S, by, 30, 14);
    ctx.fill();
    bevelStroke(ctx, 2.6 * S);
    rimStroke(ctx, 1.3 * S, hue, bx - 16 * S, ty, bx + 14 * S, by, 0.6);
  }

  // --- containment rings (segmented, on tilted orbits).
  for (let i = 0; i < 3; i++) {
    const r = coreR * (1.62 + i * 0.52);
    const squash = 0.34 - i * 0.055 + Math.sin(time * 0.3 + i * 2) * 0.03;
    const tilt = 0.42 * Math.sin(time * 0.21 + i * 1.9);
    const dir = i % 2 ? 1 : -1;
    const dashOff = time * 40 * S * dir * spin;
    ctx.save();
    ctx.setLineDash([24 * S, 14 * S]);
    ctx.lineDashOffset = dashOff;
    // Back of the ring: dim.
    ctx.beginPath();
    ctx.ellipse(0, coreY, r, r * squash, tilt, 0, TAU);
    ctx.lineWidth = 5 * S;
    ctx.strokeStyle = `hsla(${hue}, 85%, 55%, ${0.28 + 0.25 * power})`;
    ctx.stroke();
    // Front of the ring: lit.
    ctx.beginPath();
    ctx.ellipse(0, coreY, r, r * squash, tilt, 0, Math.PI);
    ctx.lineWidth = 5.5 * S;
    ctx.strokeStyle = `hsla(${hue}, 100%, 74%, ${0.5 + 0.4 * power})`;
    ctx.stroke();
    // Specular catch where the world light strikes.
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(0, coreY, r, r * squash, tilt, 2.1, 2.7);
    ctx.lineWidth = 4 * S;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + 0.3 * power})`;
    ctx.stroke();
    ctx.restore();
  }

  // --- housing collar under the core.
  ctx.beginPath();
  ctx.ellipse(0, coreY + coreR * 0.9, coreR * 0.95, coreR * 0.34, 0, 0, TAU);
  ctx.fillStyle = metalFace(ctx, hue, -coreR, coreY, coreR, coreY + coreR, 34, 16);
  ctx.fill();
  bevelStroke(ctx, 3 * S);

  // --- the core itself: socket, glow, blazing orb with internal swirl.
  ctx.drawImage(socketSprite(), -coreR * 1.6, coreY - coreR * 1.6, coreR * 3.2, coreR * 3.2);
  glowDot(ctx, hue, 0, coreY, coreR * 4.6, (0.55 + 0.4 * power) * LANDMARKS.GLOW);
  const orb = ctx.createRadialGradient(-coreR * 0.2, coreY - coreR * 0.25, coreR * 0.05, 0, coreY, coreR);
  orb.addColorStop(0, '#ffffff');
  orb.addColorStop(0.3, `hsla(${hue}, 100%, 92%, 1)`);
  orb.addColorStop(0.62, `hsla(${hue}, 100%, 68%, 0.98)`);
  orb.addColorStop(0.88, `hsla(${hue}, 96%, 44%, 0.9)`);
  orb.addColorStop(1, `hsla(${hue}, 90%, 24%, 0.8)`);
  ctx.beginPath();
  ctx.arc(0, coreY, coreR, 0, TAU);
  ctx.fillStyle = orb;
  ctx.fill();
  // Internal rotation, clipped inside the orb.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, coreY, coreR, 0, TAU);
  ctx.clip();
  ctx.translate(0, coreY);
  ctx.rotate(time * 0.9 * spin);
  ctx.lineWidth = coreR * 0.16;
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + 0.25 * power})`;
  ctx.beginPath();
  ctx.arc(0, 0, coreR * 0.55, 0.4, 2.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, coreR * 0.78, 3.4, 5.4);
  ctx.stroke();
  ctx.restore();
  // Hot centre.
  glowDot(ctx, hue, -coreR * 0.1, coreY - coreR * 0.1, coreR * 0.9, 0.8 + 0.2 * power);
  if (lm.claimT > 0.01 && lm.ownerRgb) {
    const [r, g, b] = lm.ownerRgb;
    const sync = ctx.createRadialGradient(0, coreY, 0, 0, coreY, coreR);
    sync.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.5 * lm.claimT})`);
    sync.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.beginPath();
    ctx.arc(0, coreY, coreR, 0, TAU);
    ctx.fillStyle = sync;
    ctx.fill();
  }

  drawDebris(ctx, lm, time, { hue, cx: 0, cy: coreY, rad: 122 * S, count: 8, power, squash: 0.32 }, 1);
  drawMotes(ctx, lm, time, {
    hue, cx: 0, cy: -18 * S, rx: 108 * S, rise: 190 * S, count: 9, alpha: 0.55, speed: 0.2, power,
  });

  drawClaimPulse(ctx, lm, FLUX_CORE.CLAIM_RADIUS);
  ctx.restore();
}

// ---------------------------------------------------------------- Rift Gate

/**
 * ONE physical gate: two tall alien pylons framing a spatial aperture — a real
 * tear in space (dark interior, violet distortion swirl, star fragments, bright
 * rim) rather than a flat circle. There is no exit portal anywhere in the galaxy.
 *
 * Closed/idle: a tall thin slit of light between the pylons. Active: the tear
 * opens wide, swirls, and pulls motes inward. Charging: it recognises a creature
 * and intensifies. Cooldown: dim seams, closed slit.
 */
export function drawRiftGate(ctx, lm, time) {
  const hue = RIFT.HUE;
  const power = powerOf(lm);
  const S = LANDMARKS.SCALE;
  const H = 214 * S; // pylon height
  const apY = -108 * S; // aperture centre
  const charge = lm.charging && lm.chargeT > 0
    ? clamp01(lm.chargeT / Math.max(0.01, RIFT.ACTIVATION_TIME)) : 0;
  // The gate's physical structure is always present, but the portal itself stays
  // nearly closed by default so the landmark reads as a real doorway, not a
  // constantly-open floor portal. Only charging/arrival states open it.
  // Open while the gate is active (wider while charging), shut while it cools down; the
  // door animates between the two.
  const target = lm.active ? clamp01(0.62 + charge * 0.38) : 0.04;
  lm.openAnim = lm.openAnim === undefined ? target : lm.openAnim + (target - lm.openAnim) * 0.12;
  const open = lm.openAnim;
  const apRX = 46 * S * (0.1 + 0.9 * Math.min(1, open));
  const apRY = 88 * S * (0.42 + 0.58 * Math.min(1, open));
  const seed = seedOf(lm);

  ctx.save();
  ctx.translate(lm.x, lm.y);

  drawLightPool(ctx, 0, 0, 150 * S, 52 * S, hue, (0.06 + 0.12 * power + 0.12 * charge) * LANDMARKS.GLOW);
  drawContactShadow(ctx, -46 * S, 6 * S, 54 * S, 22 * S);
  drawContactShadow(ctx, 46 * S, 6 * S, 54 * S, 22 * S);
  drawContactShadow(ctx, 0, 4 * S, 66 * S, 24 * S);

  ctx.globalAlpha = (0.18 + 0.26 * power + 0.22 * charge) * LANDMARKS.GLOW;
  ctx.drawImage(haloSprite(hue), -120 * S, apY - 120 * S, 240 * S, 240 * S);
  ctx.globalAlpha = 1;

  drawDebris(ctx, lm, time, { hue, cx: 0, cy: -H * 0.5, rad: 118 * S, count: 6, power, squash: 0.4 }, 0);

  // --- the spatial aperture: dark depth at the centre, bright rim, swirl inside.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, apY, apRX, apRY, 0, 0, TAU);
  ctx.clip();
  const depth = ctx.createRadialGradient(0, apY, 0, 0, apY, Math.max(apRX, apRY));
  depth.addColorStop(0, 'rgba(3, 2, 9, 1)');
  depth.addColorStop(0.5, `hsla(${hue}, 65%, 12%, 1)`);
  depth.addColorStop(0.8, `hsla(${hue}, 85%, 40%, 1)`);
  depth.addColorStop(1, `hsla(${hue}, 100%, 72%, 1)`);
  ctx.fillStyle = depth;
  ctx.fillRect(-apRX, apY - apRY, apRX * 2, apRY * 2);

  ctx.save();
  ctx.translate(0, apY);
  const swirlSpeed = 0.35 + 0.75 * Math.min(1, power) + charge;
  for (let k = 0; k < 3; k++) {
    ctx.save();
    ctx.rotate(time * swirlSpeed * (k % 2 ? -0.7 : 0.9) + k * 2.1);
    ctx.beginPath();
    for (let j = 0; j <= 26; j++) {
      const t = j / 26;
      const ang = t * TAU * 1.5;
      const rr = t * apRX * 1.25;
      const px = Math.cos(ang) * rr;
      const py = Math.sin(ang) * rr * (apRY / Math.max(1, apRX)) * 0.9;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineWidth = (3.5 + 2.5 * Math.min(1, power)) * S;
    ctx.strokeStyle = `hsla(${hue}, 100%, 84%, ${0.1 + 0.22 * Math.min(1, power) + 0.15 * charge})`;
    ctx.stroke();
    ctx.restore();
  }
  // Star-like fragments drifting through the tear.
  for (let i = 0; i < 10; i++) {
    const a = time * (0.5 + hashRand(seed, i + 3)) + hashRand(seed, i) * TAU;
    const rr = apRX * (0.2 + 0.75 * hashRand(seed, i + 7));
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr * (apRY / Math.max(1, apRX));
    const s = (1.4 + 2.2 * hashRand(seed, i + 13)) * S;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.5 * hashRand(seed, i + 17)})`;
    ctx.fillRect(px, py, s, s);
  }
  ctx.restore();
  ctx.restore();

  // Aperture rim: soft outer glow + bright edge.
  ctx.beginPath();
  ctx.ellipse(0, apY, apRX, apRY, 0, 0, TAU);
  ctx.lineWidth = 9 * S;
  ctx.strokeStyle = `hsla(${hue}, 100%, 66%, ${0.16 + 0.22 * power + 0.15 * charge})`;
  ctx.stroke();
  ctx.lineWidth = 3 * S;
  ctx.strokeStyle = `hsla(${hue}, 100%, 88%, ${0.55 + 0.4 * Math.min(1, power) + 0.3 * charge})`;
  ctx.stroke();
  if (open < 0.25) {
    // Closed: a tall thin slit of light remains, so the gate still reads.
    ctx.beginPath();
    ctx.moveTo(0, apY - apRY);
    ctx.lineTo(0, apY + apRY);
    ctx.lineWidth = 2.5 * S;
    ctx.strokeStyle = `hsla(${hue}, 100%, 80%, ${0.35 + 0.3 * Math.sin(time * 2 + seed)})`;
    ctx.stroke();
  }

  // --- pylons frame the aperture.
  drawPylon(ctx, -1, H, hue, power, time, S);
  drawPylon(ctx, 1, H, hue, power, time, S);

  // Charging: rings collapse inward and wisps stream from the creature in.
  if (charge > 0 && lm.charging) {
    const cx = lm.charging.x - lm.x;
    const cy = lm.charging.y - lm.y;
    for (let j = 0; j < 2; j++) {
      const phase = fract(charge * 1.6 + j * 0.5);
      const rr = 1 - phase;
      if (rr <= 0.06) continue;
      ctx.beginPath();
      ctx.ellipse(0, apY, (apRX + 55 * S * rr) * 0.92, (apRY + 45 * S * rr) * 0.92, 0, 0, TAU);
      ctx.setLineDash([16 * S, 20 * S]);
      ctx.lineDashOffset = time * 60 * S;
      ctx.lineWidth = 2.5 * S;
      ctx.strokeStyle = `hsla(${hue}, 100%, 82%, ${0.4 * charge})`;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const dx = -cx;
    const dy = apY - cy;
    for (let j = 0; j < 5; j++) {
      const t = fract(time * 1.6 + j * GOLDEN);
      const px = cx + dx * t;
      const py = cy + dy * t;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - dx * 0.05, py - dy * 0.05);
      ctx.lineWidth = 2.4 * S;
      ctx.strokeStyle = `hsla(${hue}, 100%, 85%, ${(1 - t) * 0.6 * charge})`;
      ctx.stroke();
    }
  }

  // --- base rubble.
  for (let i = 0; i < 3; i++) {
    const px = (hashRand(seed, i + 41) - 0.5) * 190 * S;
    const py = (6 + hashRand(seed, i + 43) * 12) * S;
    ctx.save();
    ctx.translate(px, py);
    rockPath(ctx, (5 + 6 * hashRand(seed, i + 47)) * S, seed + i);
    ctx.fillStyle = metalFace(ctx, hue, -8 * S, -8 * S, 8 * S, 8 * S, 26, 12);
    ctx.fill();
    bevelStroke(ctx, 1.6 * S);
    ctx.restore();
  }

  // Inward-drifting motes while the tear is open.
  if (power > 0.5) {
    const n = Math.max(2, Math.round(8 * LANDMARKS.PARTICLE_DENSITY));
    for (let i = 0; i < n; i++) {
      const t = fract(time * (0.2 + 0.25 * power) + i * GOLDEN);
      const ang = hashRand(seed, i + 29) * TAU + t * 2.4;
      const rr = (150 - 110 * t) * S;
      const px = Math.cos(ang) * rr;
      const py = apY + Math.sin(ang) * rr * 0.7;
      glowDot(ctx, hue, px, py, (7 + 5 * hashRand(seed, i + 33)) * S,
        Math.sin(Math.PI * t) * 0.6 * Math.min(1, power));
    }
  }

  drawDebris(ctx, lm, time, { hue, cx: 0, cy: -H * 0.5, rad: 118 * S, count: 6, power, squash: 0.4 }, 1);

  drawRiftEnterFx(ctx, lm, hue, apY, S);
  drawClaimPulse(ctx, lm, RIFT.CLAIM_RADIUS);
  ctx.restore();
}

/**
 * One structural pylon: an extruded alien slab with faceted bands and a glowing
 * seam along the edge that faces the aperture. The left geometry is defined in
 * local space; the right side mirrors it (gradients are authored per side so the
 * world light and the aperture spill stay physically placed).
 */
function drawPylon(ctx, side, H, hue, power, time, S) {
  // Magnitudes: inner edge ≈54, outer ≈100, height 0…-218 (left = negative x).
  const pts = [
    [54, -6], [66, -52], [58, -104], [70, -156], [62, -206],
    [86, -218], [100, -158], [90, -104], [100, -52], [92, -6],
  ];
  ctx.save();
  if (side > 0) ctx.scale(-1, 1);
  ctx.beginPath();
  ctx.moveTo(-pts[0][0] * S, pts[0][1] * S);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(-pts[i][0] * S, pts[i][1] * S);
  ctx.closePath();

  const body = ctx.createLinearGradient(-100 * S, -H, -54 * S, 0);
  body.addColorStop(0, `hsl(${hue}, 26%, 27%)`);
  body.addColorStop(0.5, `hsl(${hue}, 30%, 14%)`);
  body.addColorStop(1, `hsl(${hue}, 40%, 6%)`);
  ctx.fillStyle = body;
  ctx.fill();

  // Aperture light spilling onto the inner face + faceted bands.
  ctx.save();
  ctx.clip();
  const spill = ctx.createLinearGradient(-104 * S, 0, -50 * S, 0);
  spill.addColorStop(0, `hsla(${hue}, 100%, 70%, 0)`);
  spill.addColorStop(1, `hsla(${hue}, 100%, 70%, ${0.4 + 0.3 * power})`);
  ctx.fillStyle = spill;
  ctx.fillRect(-104 * S, -H, 60 * S, H);
  ctx.fillStyle = 'rgba(2, 4, 10, 0.35)';
  ctx.fillRect(-104 * S, -150 * S, 60 * S, 14 * S);
  ctx.fillRect(-104 * S, -84 * S, 60 * S, 10 * S);
  ctx.restore();

  bevelStroke(ctx, 4.5 * S);
  // World-light rim: the left pylon lights on its outer edge, the right pylon
  // on its inner (left) edge — both face the upper-left world light.
  const brightX = side < 0 ? -104 : -54;
  const dimX = side < 0 ? -54 : -104;
  rimStroke(ctx, 1.8 * S, hue, brightX * S, -H, dimX * S, -20 * S, 0.8);

  // Glowing inner seam along the aperture-facing edge.
  ctx.beginPath();
  ctx.moveTo(-pts[0][0] * S, pts[0][1] * S);
  for (let i = 1; i <= 4; i++) ctx.lineTo(-pts[i][0] * S, pts[i][1] * S);
  const seamA = 0.4 + 0.45 * power + 0.1 * Math.sin(time * 3 + side);
  ctx.setLineDash([26 * S, 12 * S]);
  ctx.lineDashOffset = -time * 26 * S;
  ctx.lineWidth = 7 * S;
  ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${seamA * 0.3})`;
  ctx.stroke();
  ctx.lineWidth = 2.4 * S;
  ctx.strokeStyle = `hsla(${hue}, 100%, 82%, ${seamA})`;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Absorption flare at the gate after a creature is pulled through: burst of
 * inward streaks, bright aperture flash, quick ground shock. Driven by
 * rift.enterFx (set by RiftSystem.traverse).
 */
function drawRiftEnterFx(ctx, lm, hue, apY, S) {
  const fx = lm.enterFx || 0;
  if (fx <= 0) return;
  const k = 1 - clamp01(fx / RIFT.ENTER_FX_TIME); // 0 → 1
  const flash = Math.sin(Math.PI * Math.min(1, k * 1.4));
  glowDot(ctx, hue, 0, apY, (90 + 160 * k) * S, flash * 0.9);
  // Inward streaks collapsing into the aperture.
  const seed = seedOf(lm);
  for (let i = 0; i < 8; i++) {
    const ang = hashRand(seed, i + 61) * TAU;
    const rr = (1 - k) * 170 * S + 30 * S;
    const px = Math.cos(ang) * rr;
    const py = apY + Math.sin(ang) * rr * 0.75;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - Math.cos(ang) * 46 * S, py - Math.sin(ang) * 46 * S * 0.75);
    ctx.lineWidth = 3 * S;
    ctx.strokeStyle = `hsla(${hue}, 100%, 86%, ${(1 - k) * 0.75})`;
    ctx.stroke();
  }
  // Ground shock around the base.
  const shockR = (40 + 150 * k) * S;
  ctx.beginPath();
  ctx.ellipse(0, 0, shockR, shockR * 0.36, 0, 0, TAU);
  ctx.lineWidth = (4 - 2.5 * k) * S;
  ctx.strokeStyle = `hsla(${hue}, 100%, 80%, ${(1 - k) * 0.6})`;
  ctx.stroke();
}

/**
 * Materialization at the destination: particles gather, the body flashes in,
 * then two shock rings settle. Drawn AFTER creatures (Game calls this in the
 * overlay pass) so the arrival reads on top of the teleportee.
 */
export function drawRiftArrivals(ctx, rifts, bounds) {
  const hue = RIFT.HUE;
  const S = LANDMARKS.SCALE;
  for (const rift of rifts) {
    if (!rift.arrivals || !rift.arrivals.length) continue;
    for (const arr of rift.arrivals) {
      if (bounds && (arr.x + 260 < bounds.left || arr.x - 260 > bounds.right
        || arr.y + 260 < bounds.top || arr.y - 260 > bounds.bottom)) continue;
      const t = clamp01(arr.t / RIFT.ARRIVAL_TIME);
      // Gathering motes converging on the point (first half).
      if (t < 0.6) {
        const g = 1 - t / 0.6;
        for (let i = 0; i < 9; i++) {
          const ang = (i / 9) * TAU + arr.x * 0.01;
          const rr = (24 + g * 110) * S;
          glowDot(ctx, hue, arr.x + Math.cos(ang) * rr, arr.y + Math.sin(ang) * rr * 0.85,
            10 * S, g * 0.85);
        }
      }
      // Materialize flash.
      if (t < 0.55) {
        const f = Math.sin(Math.PI * (t / 0.55));
        glowDot(ctx, hue, arr.x, arr.y, (70 + 130 * t) * S, f * 0.9);
      }
      // Shock rings.
      for (let j = 0; j < 2; j++) {
        const p = clamp01((t - 0.15 - j * 0.14) / 0.7);
        if (p <= 0 || p >= 1) continue;
        const r = (26 + 130 * easeOutCubic(p)) * S;
        ctx.beginPath();
        ctx.ellipse(arr.x, arr.y, r, r * 0.86, 0, 0, TAU);
        ctx.lineWidth = (3.5 - 2 * p) * S;
        ctx.strokeStyle = `hsla(${hue}, 100%, 84%, ${(1 - p) * 0.7})`;
        ctx.stroke();
      }
    }
  }
}

// ---------------------------------------------------------------- Stasis Structure

/**
 * A tall alien motion-control device: segmented column, suspended cyan core,
 * orbiting rings and plates, an antenna spike. Active: the air around it holds
 * still — suspended motes, slow temporal ripples, energy hum — but the effect
 * is sourced FROM the structure, never drawn as a giant circle.
 */
export function drawStasisStructure(ctx, lm, time) {
  const hue = STASIS.HUE;
  const power = powerOf(lm);
  const S = LANDMARKS.SCALE;
  const H = 252 * S;
  const coreY = -112 * S;
  const coreR = 21 * S * (0.88 + 0.12 * power + 0.05 * Math.sin(time * 2.6));

  ctx.save();
  ctx.translate(lm.x, lm.y);

  drawLightPool(ctx, 0, 0, 122 * S, 44 * S, hue, (0.10 + 0.12 * power) * LANDMARKS.GLOW);
  drawContactShadow(ctx, 5 * S, 5 * S, 82 * S, 28 * S);
  ctx.globalAlpha = (0.32 + 0.33 * power) * LANDMARKS.GLOW;
  ctx.drawImage(haloSprite(hue), -90 * S, coreY - 90 * S, 180 * S, 180 * S);
  ctx.globalAlpha = 1;

  drawDebris(ctx, lm, time, { hue, cx: 0, cy: -130 * S, rad: 84 * S, count: 5, power, squash: 0.4 }, 0);

  // --- alien base: faceted platform.
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const px = Math.cos(a) * 68 * S;
    const py = Math.sin(a) * 24 * S;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = metalFace(ctx, hue, -68 * S, -24 * S, 68 * S, 24 * S, 27, 13);
  ctx.fill();
  bevelStroke(ctx, 3.5 * S);
  rimStroke(ctx, 1.6 * S, hue, -68 * S, -26 * S, 50 * S, 22 * S, 0.7);
  ctx.setLineDash([22 * S, 16 * S]);
  ctx.lineDashOffset = time * 16 * S;
  ctx.beginPath();
  ctx.ellipse(0, 0, 56 * S, 20 * S, 0, 0, TAU);
  ctx.lineWidth = 2.2 * S;
  ctx.strokeStyle = `hsla(${hue}, 100%, 74%, ${0.3 + 0.4 * power + 0.12 * Math.sin(time * 2.2)})`;
  ctx.stroke();
  ctx.setLineDash([]);

  // --- segmented column: contiguous overlapping blocks read as one machine
  // (micro-shift keeps it alive when dormant).
  const segs = [
    { w: 33, h: 76, y: -8 }, { w: 29, h: 70, y: -76 }, { w: 24, h: 58, y: -138 },
  ];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const shift = Math.sin(time * 0.5 + i * 1.7) * 1.6 * S;
    const x = -seg.w * S + shift;
    const y = (seg.y - seg.h) * S; // seg.y is the block's BOTTOM edge
    const w = seg.w * 2 * S;
    const h = seg.h * S;
    roundRectPath(ctx, x, y, w, h, 9 * S);
    ctx.fillStyle = metalFace(ctx, hue, x, y, x + w, y + h, 32, 15);
    ctx.fill();
    bevelStroke(ctx, 3 * S);
    rimStroke(ctx, 1.4 * S, hue, x, y, x + w, y + h * 0.6, 0.75);
    // Glowing seam at the segment foot.
    ctx.beginPath();
    ctx.moveTo(x + 5 * S, y + h - 3 * S);
    ctx.lineTo(x + w - 5 * S, y + h - 3 * S);
    ctx.lineWidth = 2.4 * S;
    ctx.strokeStyle = `hsla(${hue}, 100%, 76%, ${0.35 + 0.45 * power + 0.1 * Math.sin(time * 3 + i)})`;
    ctx.stroke();
  }

  // --- suspended core window in the middle segment.
  ctx.drawImage(socketSprite(), -coreR * 1.9, coreY - coreR * 1.9, coreR * 3.8, coreR * 3.8);
  glowDot(ctx, hue, 0, coreY, coreR * 4.8, (0.55 + 0.4 * power) * LANDMARKS.GLOW);
  const core = ctx.createRadialGradient(-coreR * 0.2, coreY - coreR * 0.25, coreR * 0.08, 0, coreY, coreR);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.4, `hsla(${hue}, 100%, 90%, 1)`);
  core.addColorStop(0.8, `hsla(${hue}, 100%, 64%, 0.95)`);
  core.addColorStop(1, `hsla(${hue}, 95%, 36%, 0.85)`);
  ctx.beginPath();
  ctx.arc(0, coreY, coreR, 0, TAU);
  ctx.fillStyle = core;
  ctx.fill();
  if (lm.claimT > 0.01 && lm.ownerRgb) {
    const [r, g, b] = lm.ownerRgb;
    const sync = ctx.createRadialGradient(0, coreY, 0, 0, coreY, coreR);
    sync.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.55 * lm.claimT})`);
    sync.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.beginPath();
    ctx.arc(0, coreY, coreR, 0, TAU);
    ctx.fillStyle = sync;
    ctx.fill();
  }

  // --- antenna spike rising from the top segment.
  ctx.beginPath();
  ctx.moveTo(-12 * S, -192 * S);
  ctx.lineTo(0, -H);
  ctx.lineTo(12 * S, -192 * S);
  ctx.closePath();
  ctx.fillStyle = metalFace(ctx, hue, -12 * S, -H, 12 * S, -192 * S, 34, 16);
  ctx.fill();
  bevelStroke(ctx, 2.4 * S);
  rimStroke(ctx, 1.2 * S, hue, -12 * S, -H, 4 * S, -198 * S, 0.8);
  glowDot(ctx, hue, 0, -H, (14 + 5 * Math.sin(time * 3)) * S * (0.7 + 0.5 * power),
    0.8 * (0.5 + 0.5 * power));

  // --- two segmented rings orbiting the column.
  for (let i = 0; i < 2; i++) {
    const ry = (-64 - i * 62) * S;
    const r = (66 - i * 14) * S;
    const squash = 0.3 - i * 0.04;
    const dir = i % 2 ? -1 : 1;
    ctx.save();
    ctx.setLineDash([20 * S, 13 * S]);
    ctx.lineDashOffset = time * 34 * S * dir * (0.4 + 0.6 * Math.min(1, power));
    ctx.beginPath();
    ctx.ellipse(0, ry, r, r * squash, 0, 0, TAU);
    ctx.lineWidth = 4.5 * S;
    ctx.strokeStyle = `hsla(${hue}, 85%, 58%, ${0.3 + 0.25 * power})`;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, ry, r, r * squash, 0, 0, Math.PI);
    ctx.lineWidth = 5 * S;
    ctx.strokeStyle = `hsla(${hue}, 100%, 76%, ${0.5 + 0.4 * power})`;
    ctx.stroke();
    ctx.restore();
  }

  // --- active: temporal stillness around the structure (ripples + hung motes).
  if (lm.active) {
    for (let i = 0; i < 3; i++) {
      const t = fract(time * 0.4 + i / 3);
      const r = (42 + t * 128) * S;
      ctx.beginPath();
      ctx.ellipse(0, -6 * S, r, r * 0.42, 0, 0, TAU);
      ctx.lineWidth = 2.2 * S;
      ctx.strokeStyle = `hsla(${hue}, 100%, 80%, ${(1 - t) * 0.16 * power})`;
      ctx.stroke();
    }
    // Suspended fragments hanging in altered time.
    const seed = seedOf(lm);
    for (let i = 0; i < 5; i++) {
      const px = (hashRand(seed, i + 53) - 0.5) * 170 * S;
      const baseY = (-30 - hashRand(seed, i + 59) * 150) * S;
      const py = baseY + Math.sin(time * 0.7 + i * 2.3) * 3 * S;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(time * 0.15 + i);
      rockPath(ctx, (3.5 + 3 * hashRand(seed, i + 61)) * S, seed + i * 2, 5);
      ctx.fillStyle = metalFace(ctx, hue, -5 * S, -5 * S, 5 * S, 5 * S, 30, 14);
      ctx.fill();
      bevelStroke(ctx, 1.2 * S);
      ctx.restore();
    }
  }

  drawDebris(ctx, lm, time, { hue, cx: 0, cy: -130 * S, rad: 84 * S, count: 5, power, squash: 0.4 }, 1);
  // Ambient motes — slowed while the field is holding (temporal character).
  drawMotes(ctx, lm, time, {
    hue, cx: 0, cy: -14 * S, rx: 82 * S, rise: 200 * S, count: 7, alpha: 0.5, speed: 0.13,
    power, slow: lm.active ? 0.4 : 0.75,
  });

  drawClaimPulse(ctx, lm, STASIS.CLAIM_RADIUS);
  ctx.restore();
}

// ---------------------------------------------------------------- name plates

/** What each landmark is and does, in plain words (shown under it in the world). */
const PLATES = Object.freeze({
  beacon: { name: 'BONUS TOWER', on: 'ON', off: 'OFF', effect: '2× score for land captured in its ring', color: '#5ff3ff' },
  flux: { name: 'ENERGY CORE', on: 'ON', off: 'OFF', effect: 'Sprays free energy every 6 s', color: '#ffae4d' },
  rift: { name: 'TELEPORTER', on: 'OPEN', off: 'SHUT', effect: 'Trail closed? Step in: jump to your border', color: '#c18cff' },
  stasis: { name: 'SLOW TOWER', on: 'ON', off: 'OFF', effect: 'Rivals in its ring move 35% slower', color: '#7fb6ff' },
});

function clockText(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * A readable plate under a landmark: name, what it does, and its status
 * (ON 0:25 / OFF 0:41, or OPEN / SHUT for the Teleporter), plus YOURS when you own it.
 * Drawn at a constant on-screen size, above the creatures.
 */
export function drawLandmarkPlate(ctx, lm, zoom, localSlot) {
  const plate = PLATES[lm.kind];
  if (!plate) return;
  const on = Boolean(lm.active);
  const left = on ? (lm.remaining ?? lm.activeTimer ?? 0) : (lm.cooldown ?? 0);
  const yours = Boolean(lm.ownerSlot && lm.ownerSlot === localSlot);
  ctx.save();
  ctx.translate(lm.x, lm.y);
  ctx.scale(1 / zoom, 1 / zoom);
  ctx.translate(0, 26);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const font = '"Segoe UI", system-ui, sans-serif';

  const status = `${on ? plate.on : plate.off} ${clockText(left)}`;
  ctx.font = `900 13px ${font}`;
  const nameW = ctx.measureText(plate.name).width;
  ctx.font = `800 10px ${font}`;
  const statusW = ctx.measureText(status).width + 12;
  const yoursW = yours ? ctx.measureText('YOURS').width + 12 : 0;
  ctx.font = `700 11px ${font}`;
  const effectW = ctx.measureText(plate.effect).width;
  const topW = nameW + 8 + statusW + (yours ? 6 + yoursW : 0);
  const w = Math.max(topW, effectW) + 22;
  const h = 40;

  // Card
  roundRectPath(ctx, -w / 2, 0, w, h, 10);
  ctx.fillStyle = 'rgba(8, 12, 24, 0.82)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = on ? plate.color : 'rgba(255, 255, 255, 0.18)';
  ctx.stroke();

  // Top row: NAME [STATUS] [YOURS]
  let x = -topW / 2;
  ctx.textAlign = 'left';
  ctx.font = `900 13px ${font}`;
  ctx.fillStyle = plate.color;
  ctx.fillText(plate.name, x, 13);
  x += nameW + 8;
  roundRectPath(ctx, x, 5, statusW, 16, 8);
  ctx.fillStyle = on ? 'rgba(95, 227, 90, 0.95)' : 'rgba(255, 255, 255, 0.16)';
  ctx.fill();
  ctx.font = `800 10px ${font}`;
  ctx.fillStyle = on ? '#062b10' : 'rgba(232, 241, 255, 0.85)';
  ctx.fillText(status, x + 6, 13.5);
  if (yours) {
    x += statusW + 6;
    roundRectPath(ctx, x, 5, yoursW, 16, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fill();
    ctx.fillStyle = '#0b1424';
    ctx.fillText('YOURS', x + 6, 13.5);
  }
  // Second row: what it does
  ctx.textAlign = 'center';
  ctx.font = `700 11px ${font}`;
  ctx.fillStyle = on ? 'rgba(232, 241, 255, 0.95)' : 'rgba(232, 241, 255, 0.6)';
  ctx.fillText(plate.effect, 0, 30);
  ctx.restore();
}
