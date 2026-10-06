import { COMBAT, CREATURE, KING, SURGE } from '../config.js';
import { clamp, easeOutBack } from '../utils/math.js';
import { rivalLook } from '../progression/skins.js';
import {
  auraSprite, drawCrown, glowSprite, haloSprite, shadowSprite, socketSprite, specSprite,
} from './sprites.js';

const TAU = Math.PI * 2;
const TRAIL_MAX_ALPHA = 0.35;
const DANGER_COLOR = 'rgba(255, 82, 96, 0.95)';
const DANGER_FILL = 'rgba(255, 60, 80, 0.10)';
const PREY_COLOR = 'rgba(110, 255, 205, 0.8)';
const HOME_TURF_COLOR = 'rgba(120, 255, 215, 0.75)';
const SURGE_RING = `hsl(${SURGE.HUE}, 100%, 62%)`;
// Names sit in coloured pills (drawNamePill); other light-floor labels use dark text.
const PLAYER_LABEL_COLOR = 'rgba(8, 20, 38, 0.98)';
const KING_LABEL_COLOR = '#3d2800'; // on the gold name pill
const TAG_STROKE = 'rgba(2, 4, 10, 0.85)';
const KING_HUE = KING.INDICATOR_HUE;
const RIVAL_AURA_ALPHA = 0.45;

export function displayRadiusOf(creature) {
  return creature.displayRadius;
}

function drawTrail(ctx, creature, radius, palette) {
  const trail = creature.trail;
  if (trail.length === 0) return;
  ctx.fillStyle = palette.trail;
  for (let i = 0; i < trail.length; i++) {
    const t = (i + 1) / trail.length;
    ctx.globalAlpha = t * TRAIL_MAX_ALPHA;
    ctx.beginPath();
    ctx.arc(trail[i].x, trail[i].y, radius * (0.55 + 0.45 * t), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** An exposed rival is vulnerable because its trail is open, not because of body contact. */
export function relationTo(creature, viewer) {
  // Exposure is only highlighted while you hold the Tracker power-up.
  if (!viewer || viewer === creature || !viewer.alive || !(viewer.trackerTime > 0)) return null;
  return creature.isExposed ? 'danger' : null;
}

/** Red marks a rival who can intercept you; mint marks a rival you can intercept. */
function drawRelationRing(ctx, creature, relation, radius, time, zoom) {
  if (!relation) return;
  ctx.beginPath();
  ctx.arc(creature.x, creature.y, radius + 7 / zoom, 0, TAU);
  if (relation === 'danger') {
    ctx.fillStyle = DANGER_FILL;
    ctx.fill();
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 8);
    ctx.strokeStyle = DANGER_COLOR;
    ctx.lineWidth = 3 / zoom;
  } else {
    ctx.strokeStyle = PREY_COLOR;
    ctx.lineWidth = 2.5 / zoom;
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- living energy core

const lookPaletteCache = new Map();
const PLAYER_EDGE = 'rgba(255, 255, 255, 0.92)';
const ANIMATION_RATES = Object.freeze({
  flicker: 1.35,
  glint: 0.72,
  orbit: 0.82,
  flow: 1.12,
  radiance: 0.7,
  tectonic: 0.56,
  drift: 0.76,
  bloom: 0.9,
  current: 1,
  pulse: 0.9,
  'energy-flow': 1.15,
  'ember-flicker': 1.35,
  'flame-flow': 1.3,
  'crystal-glint': 0.72,
  'frost-shimmer': 0.84,
  'orbital-drift': 0.82,
  'light-absorption': 0.9,
  'water-pulse': 0.88,
  'fluid-flow': 1.12,
  'solar-radiance': 0.7,
  'coronal-flow': 0.95,
  'mineral-glow': 0.5,
  'tectonic-shift': 0.56,
  'wind-drift': 0.76,
  'air-stream': 1.05,
  'living-pulse': 0.92,
  'vine-flow': 1.08,
});

function lookPalette(look) {
  // Saturation: `sat` (1 for the player, lower for rivals) times the character's own
  // `chroma` (shell and rim) and `coreChroma` (core), so earthy or pale elements
  // (Terra, Gale, Glacier) can read muted without any new art.
  const base = look.sat ?? 1;
  const k = base * (look.chroma ?? 1);
  const kc = base * (look.coreChroma ?? look.chroma ?? 1);
  const key = `${look.coreHue}|${look.shellHue}|${look.rimHue}|${look.shellLight}|${k}|${kc}`;
  let p = lookPaletteCache.get(key);
  if (!p) {
    const l = Math.round(look.shellLight * 100);
    const S = (pct) => Math.round(pct * k);
    const C = (pct) => Math.round(pct * kc);
    p = {
      shellLit: `hsl(${look.shellHue}, ${S(70)}%, ${l + 38}%)`,
      shellDark: `hsl(${look.shellHue}, ${S(70)}%, ${l}%)`,
      shellMid: `hsl(${look.shellHue}, ${S(85)}%, ${l + 18}%)`,
      shellDeep: `hsl(${look.shellHue}, ${S(60)}%, ${Math.max(3, l - 10)}%)`,
      rim: `hsl(${look.rimHue}, ${S(100)}%, 66%)`,
      rimBright: `hsl(${look.rimHue}, ${S(100)}%, 88%)`,
      rimDim: `hsl(${look.rimHue}, ${S(80)}%, 38%)`,
      spec: 'rgba(255, 255, 255, 0.42)',
      socket: `hsla(${look.shellHue}, 70%, 4%, 0.85)`,
      coreDeep: `hsl(${look.coreHue}, ${C(95)}%, 40%)`,
      rimSoft: `hsla(${look.rimHue}, ${S(100)}%, 72%, 0.75)`,
      core: `hsl(${look.coreHue}, ${C(100)}%, 66%)`,
      coreHot: `hsl(${look.coreHue}, ${C(100)}%, 94%)`,
      coreHalo: `hsla(${look.coreHue}, ${C(100)}%, 70%, 0.55)`,
      coreHaloOut: `hsla(${look.coreHue}, ${C(100)}%, 60%, 0)`,
      streak: `hsla(${look.coreHue}, ${C(100)}%, 72%, 0.6)`,
      streakOut: `hsla(${look.coreHue}, ${C(100)}%, 72%, 0)`,
      trail: `hsl(${look.coreHue}, ${C(100)}%, 65%)`,
      pupil: `hsl(${look.shellHue}, 60%, 7%)`,
    };
    lookPaletteCache.set(key, p);
  }
  return p;
}

const fallbackLooks = new Map();
function lookOf(creature) {
  if (creature.look) return creature.look;
  let look = fallbackLooks.get(creature.id);
  if (!look) {
    look = rivalLook(creature.hue, creature.id);
    fallbackLooks.set(creature.id, look);
  }
  return look;
}

/** The base character form is stable; skins may vary its colors and accessories. */
export function formFor() {
  return 0;
}

/**
 * The shell silhouette: K blades swept back from the direction of travel, with the
 * front left open so the core "looks out". Style 0 rounded, 1 pointed, 2 forked.
 */
function traceShell(ctx, r, blades, style, sweep, tipScale, valley, time, phase, wobbleScale = 1) {
  const half = Math.PI / blades;
  const wobble = CREATURE.MEMBRANE_WOBBLE * wobbleScale;
  const speed = CREATURE.MEMBRANE_WOBBLE_SPEED;
  ctx.beginPath();
  for (let k = 0; k < blades; k++) {
    const a = half + k * 2 * half; // no blade straight ahead
    const w = 1 + wobble * Math.sin(time * speed + k * 1.9 + phase);
    const tip = r * tipScale * w;
    const low = r * valley * (1 + wobble * 0.6 * Math.sin(time * speed * 1.7 - k * 1.3 + phase));
    const v0 = a - half;
    const v1 = a + half;
    const t = a + sweep;
    if (k === 0) ctx.moveTo(Math.cos(v0) * low, Math.sin(v0) * low);
    if (style === 0) {
      const m0 = a - half * 0.35;
      const m1 = a + half * 0.35;
      ctx.quadraticCurveTo(Math.cos(m0) * tip * 0.98, Math.sin(m0) * tip * 0.98, Math.cos(t) * tip, Math.sin(t) * tip);
      ctx.quadraticCurveTo(Math.cos(m1) * tip * 0.98, Math.sin(m1) * tip * 0.98, Math.cos(v1) * low, Math.sin(v1) * low);
    } else if (style === 1) {
      const m0 = a - half * 0.45;
      const m1 = a + half * 0.55;
      ctx.quadraticCurveTo(Math.cos(m0) * low * 1.1, Math.sin(m0) * low * 1.1, Math.cos(t) * tip, Math.sin(t) * tip);
      ctx.quadraticCurveTo(Math.cos(m1) * low * 1.02, Math.sin(m1) * low * 1.02, Math.cos(v1) * low, Math.sin(v1) * low);
    } else {
      const f0 = t - half * 0.3;
      const f1 = t + half * 0.3;
      ctx.quadraticCurveTo(Math.cos(a - half * 0.5) * low * 1.08, Math.sin(a - half * 0.5) * low * 1.08, Math.cos(f0) * tip, Math.sin(f0) * tip);
      ctx.lineTo(Math.cos(t) * tip * 0.86, Math.sin(t) * tip * 0.86);
      ctx.lineTo(Math.cos(f1) * tip, Math.sin(f1) * tip);
      ctx.quadraticCurveTo(Math.cos(a + half * 0.6) * low * 1.04, Math.sin(a + half * 0.6) * low * 1.04, Math.cos(v1) * low, Math.sin(v1) * low);
    }
  }
  ctx.closePath();
}

/** Energy streak behind a boosting creature (world space). */
function drawBoostStreak(ctx, creature, r, palette, glow, character = null) {
  if (glow < 0.02) return;
  const length = r * (1.4 + 2.6 * glow);
  const back = creature.heading + Math.PI;
  const cx = Math.cos(back);
  const cy = Math.sin(back);
  const px = -cy;
  const py = cx;
  const x0 = creature.x + cx * r * 0.4;
  const y0 = creature.y + cy * r * 0.4;
  const gradient = ctx.createLinearGradient(x0, y0, x0 + cx * length, y0 + cy * length);
  gradient.addColorStop(0, palette.streak);
  gradient.addColorStop(1, palette.streakOut);
  ctx.globalAlpha = glow;
  ctx.beginPath();
  ctx.moveTo(x0 + px * r * 0.75, y0 + py * r * 0.75);
  ctx.lineTo(x0 + cx * length, y0 + cy * length);
  ctx.lineTo(x0 - px * r * 0.75, y0 - py * r * 0.75);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  // Two thin speed lines either side.
  ctx.strokeStyle = palette.streak;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const sx = x0 + px * r * 0.95 * side;
    const sy = y0 + py * r * 0.95 * side;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + cx * length * 0.7, sy + cy * length * 0.7);
  }
  ctx.stroke();
  const boostStyle = character?.visual.boostStyle;
  if (boostStyle === 'shard') {
    ctx.globalAlpha = glow * 0.68;
    ctx.fillStyle = character.palette.accent;
    ctx.beginPath();
    ctx.moveTo(x0 + cx * length * 0.46, y0 + cy * length * 0.46);
    ctx.lineTo(x0 + cx * length * 0.72 + px * r * 0.18, y0 + cy * length * 0.72 + py * r * 0.18);
    ctx.lineTo(x0 + cx * length * 0.7 - px * r * 0.18, y0 + cy * length * 0.7 - py * r * 0.18);
    ctx.closePath();
    ctx.fill();
  } else if (boostStyle === 'flare' || boostStyle === 'corona' || boostStyle === 'bloom') {
    ctx.globalAlpha = glow * 0.58;
    ctx.strokeStyle = character.palette.accent;
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    const rays = boostStyle === 'corona' ? 5 : 3;
    for (let i = 0; i < rays; i++) {
      const side = (i - (rays - 1) / 2) * r * 0.17;
      ctx.moveTo(x0 + cx * length * 0.2 + px * side, y0 + cy * length * 0.2 + py * side);
      ctx.lineTo(x0 + cx * length * 0.38 + px * side * 1.5, y0 + cy * length * 0.38 + py * side * 1.5);
    }
    ctx.stroke();
  } else if (boostStyle === 'rift') {
    ctx.globalAlpha = glow * 0.52;
    ctx.strokeStyle = character.palette.accent;
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    ctx.ellipse(x0 + cx * length * 0.42, y0 + cy * length * 0.42,
      r * 0.18, r * 0.48, creature.heading, 0, TAU);
    ctx.stroke();
  } else if (boostStyle === 'quake') {
    ctx.globalAlpha = glow * 0.58;
    ctx.strokeStyle = character.palette.accent;
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    ctx.moveTo(x0 + cx * length * 0.22 - px * r * 0.16, y0 + cy * length * 0.22 - py * r * 0.16);
    ctx.lineTo(x0 + cx * length * 0.3 + px * r * 0.11, y0 + cy * length * 0.3 + py * r * 0.11);
    ctx.lineTo(x0 + cx * length * 0.38 - px * r * 0.1, y0 + cy * length * 0.38 - py * r * 0.1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawInternalEnergy(ctx, r, palette, time, phase, glow, shell, animationStyle = 'current') {
  const cx = r * 0.1;
  const rate = ANIMATION_RATES[animationStyle] || 1;
  ctx.save();
  traceShell(ctx, r, shell.blades, shell.style, shell.sweep, shell.tipScale, shell.valley,
    time, phase, shell.wobbleScale);
  ctx.clip();

  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const startX = -r * 0.78;
    const startY = side * r * 0.34;
    const control1X = -r * 0.35;
    const control1Y = side * r * 0.7;
    const control2X = cx + r * 0.3;
    const control2Y = side * r * 0.56;
    const endX = cx - r * 0.08;
    const endY = side * r * 0.08;

    const flow = ctx.createLinearGradient(startX, startY, endX, endY);
    flow.addColorStop(0, palette.streakOut);
    flow.addColorStop(0.55, palette.coreHalo);
    flow.addColorStop(1, palette.streakOut);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(control1X, control1Y, control2X, control2Y, endX, endY);
    ctx.strokeStyle = flow;
    ctx.lineWidth = r * (0.035 + glow * 0.018);
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.55;
    ctx.stroke();

    const t = ((time * (0.22 + glow * 0.3) * rate + phase / TAU + i * 0.5) % 1 + 1) % 1;
    const inverse = 1 - t;
    const x = inverse ** 3 * startX
      + 3 * inverse ** 2 * t * control1X
      + 3 * inverse * t ** 2 * control2X
      + t ** 3 * endX;
    const y = inverse ** 3 * startY
      + 3 * inverse ** 2 * t * control1Y
      + 3 * inverse * t ** 2 * control2Y
      + t ** 3 * endY;
    const moteRadius = r * 0.12;
    const mote = ctx.createRadialGradient(x, y, 0, x, y, moteRadius);
    mote.addColorStop(0, palette.coreHot);
    mote.addColorStop(0.24, palette.coreHalo);
    mote.addColorStop(1, palette.coreHaloOut);
    const flicker = animationStyle === 'flicker' ? 0.82 + 0.18 * Math.sin(time * 17 + phase + i) : 1;
    ctx.globalAlpha = (0.45 + glow * 0.25) * flicker;
    ctx.fillStyle = mote;
    ctx.beginPath();
    ctx.arc(x, y, moteRadius, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawElementalMotif(ctx, r, time, glow, character, shell) {
  if (!character) return;
  const { bodyStyle } = character.visual;
  const color = character.palette.primary;
  ctx.save();
  traceShell(ctx, r, shell.blades, shell.style, shell.sweep, shell.tipScale, shell.valley,
    time, shell.phase, shell.wobbleScale);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.8, r * 0.035);
  ctx.globalAlpha = 0.2 + glow * 0.1;
  const flow = (y, offset) => {
    ctx.beginPath();
    ctx.moveTo(-r * 0.82, y);
    ctx.bezierCurveTo(-r * 0.52, y - offset, -r * 0.24, y + offset, r * 0.06, y);
    ctx.stroke();
  };

  if (bodyStyle === 'flame') {
    flow(-r * 0.45, r * 0.17);
    flow(-r * 0.28, -r * 0.15);
    flow(r * 0.46, r * 0.13);
  } else if (bodyStyle === 'crystal') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.48, side * r * 0.54);
      ctx.lineTo(-r * 0.18, side * r * 0.24);
      ctx.lineTo(-r * 0.06, side * r * 0.56);
      ctx.closePath();
      ctx.fillStyle = character.palette.accent;
      ctx.fill();
    }
  } else if (bodyStyle === 'void') {
    ctx.beginPath();
    ctx.ellipse(-r * 0.16, 0, r * 0.58, r * 0.23, -0.25, 0, TAU);
    ctx.stroke();
  } else if (bodyStyle === 'tidal') {
    flow(-r * 0.42, r * 0.12 * Math.sin(time * 2));
    flow(r * 0.4, -r * 0.12 * Math.cos(time * 2));
  } else if (bodyStyle === 'solar') {
    for (let i = 0; i < 5; i++) {
      const y = (i - 2) * r * 0.22;
      ctx.beginPath();
      ctx.moveTo(-r * 0.68, y);
      ctx.lineTo(-r * (0.34 + glow * 0.05), y);
      ctx.stroke();
    }
  } else if (bodyStyle === 'stone') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.76, -r * 0.42);
    ctx.lineTo(-r * 0.42, -r * 0.08);
    ctx.lineTo(-r * 0.57, r * 0.25);
    ctx.moveTo(-r * 0.36, -r * 0.16);
    ctx.lineTo(-r * 0.16, r * 0.14);
    ctx.stroke();
  } else if (bodyStyle === 'gale') {
    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * r * 0.3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.82, y);
      ctx.quadraticCurveTo(-r * 0.42, y - r * 0.18, -r * 0.08, y + r * 0.04);
      ctx.stroke();
    }
  } else if (bodyStyle === 'leaf') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(-r * 0.38, side * r * 0.34, r * 0.24, r * 0.1, side * -0.5, 0, TAU);
      ctx.fillStyle = character.palette.accent;
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCoreMark(ctx, character, cx, coreR, time) {
  if (!character) return;
  const style = character.visual.coreStyle;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, 0, coreR * 0.94, 0, TAU);
  ctx.clip();
  ctx.globalAlpha = 0.48;
  ctx.strokeStyle = character.palette.accent;
  ctx.fillStyle = character.palette.accent;
  ctx.lineWidth = Math.max(0.65, coreR * 0.09);
  if (style === 'wave') {
    for (let i = -1; i <= 1; i++) {
      const y = i * coreR * 0.34 + Math.sin(time * 2 + i) * coreR * 0.06;
      ctx.beginPath();
      ctx.moveTo(cx - coreR, y);
      ctx.quadraticCurveTo(cx - coreR * 0.35, y - coreR * 0.2, cx, y);
      ctx.quadraticCurveTo(cx + coreR * 0.4, y + coreR * 0.2, cx + coreR, y);
      ctx.stroke();
    }
  } else if (style === 'star' || style === 'corona') {
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + time * 0.15;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * coreR * 0.48, Math.sin(a) * coreR * 0.48);
      ctx.lineTo(cx + Math.cos(a) * coreR * 0.88, Math.sin(a) * coreR * 0.88);
      ctx.stroke();
    }
  } else if (style === 'prism' || style === 'geode') {
    ctx.beginPath();
    ctx.moveTo(cx, -coreR * 0.82);
    ctx.lineTo(cx + coreR * 0.58, 0);
    ctx.lineTo(cx, coreR * 0.82);
    ctx.lineTo(cx - coreR * 0.58, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, -coreR * 0.78);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx + coreR * 0.55, 0);
    ctx.stroke();
  } else if (style === 'seed') {
    ctx.beginPath();
    ctx.ellipse(cx, 0, coreR * 0.2, coreR * 0.52, Math.sin(time) * 0.14, 0, TAU);
    ctx.stroke();
  } else if (style === 'singularity') {
    ctx.beginPath();
    ctx.arc(cx, 0, coreR * 0.37, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, 0, coreR * 0.18, 0, TAU);
    ctx.fill();
  } else if (style === 'cyclone') {
    ctx.beginPath();
    ctx.arc(cx, 0, coreR * 0.62, time * 0.4, time * 0.4 + Math.PI * 1.4);
    ctx.stroke();
  } else if (style === 'ember') {
    ctx.beginPath();
    ctx.arc(cx - coreR * 0.05, 0, coreR * (0.42 + 0.08 * Math.sin(time * 4)), 0, TAU);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, 0, coreR * (0.62 + 0.04 * Math.sin(time * 2)), 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws the creature at the origin, facing +x, as a shaded Canvas 2D character.
 * Light always comes from the upper-left of the WORLD; `light` is that direction
 * already rotated into this local frame, so shading stays put as the creature turns.
 * Shared by the game and the skin picker.
 * @param {object} s
 */
function paintCore(ctx, s) {
  const {
    r, palette, form, style, time, phase, glow, blink, isPlayer, isKing, lineScale, light, coreHue,
    character = null, animationStyle = null, silhouette = false,
  } = s;
  if (silhouette) {
    traceShell(ctx, r, CREATURE.FORM_PETALS[form], style, -0.18, 1.24, 0.8, 0, 0, 1);
    ctx.fillStyle = '#536273';
    ctx.fill();
    return;
  }
  // Level of detail: sub-pixel touches are skipped when the creature is small on screen.
  const detailed = r / lineScale >= CREATURE.DETAIL_MIN_SCREEN_RADIUS;
  const lx = Math.cos(light);
  const ly = Math.sin(light);
  const blades = CREATURE.FORM_PETALS[form];
  const sweep = -0.18 - glow * 0.22;
  const tipScale = 1.24 + form * 0.04 + glow * 0.08;
  const valley = 0.8;
  const wobbleScale = 1 + glow * 1.6; // boost makes the shell ripple

  // ---- Shell: shaded like a lit volume (bright highlight → mid body → dark shadow side).
  traceShell(ctx, r, blades, style, sweep, tipScale, valley, time, phase, wobbleScale);
  const shell = ctx.createRadialGradient(lx * r * 0.5, ly * r * 0.5, r * 0.05, 0, 0, r * 1.32);
  shell.addColorStop(0, palette.shellLit);
  shell.addColorStop(0.42, palette.shellMid);
  shell.addColorStop(0.8, palette.shellDark);
  shell.addColorStop(1, palette.shellDeep);
  ctx.fillStyle = shell;
  ctx.fill();

  drawInternalEnergy(ctx, r, palette, time, phase, glow, {
    blades, style, sweep, tipScale, valley, wobbleScale,
  }, animationStyle || character?.visual.animationStyle);
  drawElementalMotif(ctx, r, time, glow, character, {
    blades, style, sweep, tipScale, valley, wobbleScale, phase,
  });

  // A dark bevel gives the shell a defined silhouette before its colored rim catches the light.
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2 * lineScale, r * 0.085);
  ctx.strokeStyle = palette.shellDeep;
  ctx.stroke();

  // Rim light: bright on the lit edge, dim on the shadow edge.
  const rim = ctx.createLinearGradient(lx * r, ly * r, -lx * r, -ly * r);
  rim.addColorStop(0, palette.rimBright);
  rim.addColorStop(0.5, palette.rim);
  rim.addColorStop(1, palette.rimDim);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.4 * lineScale, r * (0.05 + form * 0.012));
  ctx.strokeStyle = rim;
  ctx.stroke();
  if (isPlayer) {
    // Crisp white edge: the player never blends into their own territory tint.
    ctx.lineWidth = 1.6 * lineScale;
    ctx.strokeStyle = PLAYER_EDGE;
    ctx.stroke();
  }

  // Glossy specular streak on the shell, facing the light.
  if (detailed) {
    ctx.save();
    ctx.translate(lx * r * 0.6, ly * r * 0.6);
    ctx.rotate(light + Math.PI / 2);
    ctx.scale(1, 0.38);
    const sr = r * 0.34;
    ctx.drawImage(specSprite(), -sr, -sr, sr * 2, sr * 2);
    ctx.restore();
  }

  // Large: a second, inner layer of blades turning against the outer shell.
  if (form === 2) {
    ctx.save();
    ctx.rotate(Math.PI / blades + Math.sin(time * 0.8 + phase) * 0.15);
    traceShell(ctx, r * 0.74, blades, style, -sweep, 1.12, 0.82, time * 1.3, phase + 2, wobbleScale);
    const inner = ctx.createRadialGradient(lx * r * 0.35, ly * r * 0.35, 0, 0, 0, r * 0.9);
    inner.addColorStop(0, palette.shellLit);
    inner.addColorStop(1, palette.shellDark);
    ctx.globalAlpha *= 0.6;
    ctx.fillStyle = inner;
    ctx.fill();
    ctx.globalAlpha /= 0.6;
    ctx.lineWidth = Math.max(lineScale, r * 0.025);
    ctx.strokeStyle = palette.rimSoft;
    ctx.stroke();
    ctx.restore();
  }

  // Medium+: rotating energy structure around the core.
  if (form >= 1) {
    const segments = form === 2 ? 4 : 3;
    const ringR = r * 0.68;
    const spin = time * (1.2 + glow * 2.5) + phase;
    ctx.lineWidth = Math.max(lineScale, r * 0.045);
    ctx.lineCap = 'round';
    ctx.strokeStyle = palette.rimSoft;
    ctx.beginPath();
    for (let i = 0; i < segments; i++) {
      const a0 = spin + (i / segments) * TAU;
      ctx.moveTo(Math.cos(a0) * ringR, Math.sin(a0) * ringR);
      ctx.arc(0, 0, ringR, a0, a0 + (TAU / segments) * 0.55);
    }
    ctx.stroke();
  }

  // ---- Energy core, set INSIDE the shell: dark socket → glow → shaded sphere → glint.
  const pulse = 1 + 0.06 * Math.sin(time * CREATURE.CORE_PULSE_SPEED + phase);
  const coreR = r * CREATURE.FORM_CORE[form] * pulse * (1 + glow * 0.2);
  const cx = r * 0.1;

  // Recessed socket: the shell curves in around the core.
  if (detailed) {
    const sr = coreR * 1.45;
    ctx.drawImage(socketSprite(), cx - sr, -sr, sr * 2, sr * 2);
  }

  // Soft energy light spilling out of the socket.
  const haloR = coreR * (1.8 + glow * 0.8 + (isKing ? 0.5 : 0));
  ctx.drawImage(haloSprite(coreHue), cx - haloR, -haloR, haloR * 2, haloR * 2);

  if (form === 2) {
    ctx.strokeStyle = palette.coreHalo;
    ctx.lineWidth = Math.max(lineScale, r * 0.03);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + time * 0.5;
      const len = coreR * (1.35 + 0.25 * Math.sin(time * 5 + i * 2));
      ctx.moveTo(cx + Math.cos(a) * coreR * 1.05, Math.sin(a) * coreR * 1.05);
      ctx.lineTo(cx + Math.cos(a) * len, Math.sin(a) * len);
    }
    ctx.stroke();
  }

  // The core as a glowing sphere: hot centre towards the light, deeper colour on the far side.
  const core = ctx.createRadialGradient(cx + lx * coreR * 0.35, ly * coreR * 0.35, coreR * 0.08, cx, 0, coreR);
  core.addColorStop(0, palette.coreHot);
  core.addColorStop(0.45 - glow * 0.15, palette.core);
  core.addColorStop(1, palette.coreDeep);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, 0, coreR, 0, TAU);
  ctx.fill();
  drawCoreMark(ctx, character, cx, coreR, time + phase);

  // The signature: a dark slit pupil looking where the creature goes. Blinks; narrows when boosting.
  const eyeX = cx + coreR * 0.28;
  const eyeStyle = character?.visual.eyeStyle || 'slit';
  const slitH = coreR * 0.95 * blink;
  const slitW = coreR * (0.3 - glow * 0.12);
  if (eyeStyle === 'slit' && slitH > 0.5 * lineScale) {
    ctx.beginPath();
    ctx.ellipse(eyeX, 0, slitW, slitH, 0, 0, TAU);
    ctx.fillStyle = palette.pupil;
    ctx.fill();
  } else if (eyeStyle === 'lens' || eyeStyle === 'ring') {
    ctx.beginPath();
    ctx.ellipse(eyeX, 0, coreR * 0.4, coreR * 0.58, 0, 0, TAU);
    ctx.strokeStyle = character.palette.accent;
    ctx.lineWidth = Math.max(lineScale, coreR * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(eyeX, 0, coreR * 0.14, 0, TAU);
    ctx.fillStyle = character.palette.eye;
    ctx.fill();
  } else if (eyeStyle === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(eyeX, -coreR * 0.55);
    ctx.lineTo(eyeX + coreR * 0.27, 0);
    ctx.lineTo(eyeX, coreR * 0.55);
    ctx.lineTo(eyeX - coreR * 0.27, 0);
    ctx.closePath();
    ctx.fillStyle = character.palette.eye;
    ctx.fill();
  } else if (eyeStyle === 'leaf') {
    ctx.beginPath();
    ctx.ellipse(eyeX, 0, coreR * 0.22, coreR * 0.52, -0.35, 0, TAU);
    ctx.fillStyle = character.palette.eye;
    ctx.fill();
    ctx.strokeStyle = character.palette.accent;
    ctx.lineWidth = Math.max(lineScale, coreR * 0.05);
    ctx.stroke();
  } else if (eyeStyle === 'spark') {
    ctx.beginPath();
    ctx.arc(eyeX, 0, coreR * 0.22, 0, TAU);
    ctx.fillStyle = character.palette.eye;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX - coreR * 0.07, -coreR * 0.08, coreR * 0.06, 0, TAU);
    ctx.fillStyle = character.palette.accent;
    ctx.fill();
  }

  if (!detailed) return;

  // Shadow crescent on the core's far side, cast by the socket lip.
  ctx.beginPath();
  ctx.arc(cx, 0, coreR * 0.93, light + Math.PI - 1.1, light + Math.PI + 1.1);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.lineWidth = coreR * 0.16;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Specular glint: makes the core read as a glassy, physical sphere.
  ctx.beginPath();
  ctx.ellipse(cx + lx * coreR * 0.45, ly * coreR * 0.45, coreR * 0.2, coreR * 0.11, light + Math.PI / 2, 0, TAU);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();
}

/** Contact shadow on the ground, offset away from the light (world space, fixed). */
function drawGroundShadow(ctx, creature, radius) {
  const sw = radius * 1.25;
  ctx.drawImage(shadowSprite(), creature.x + radius * 0.22 - sw, creature.y + radius * 0.3 - sw * 0.85, sw * 2, sw * 1.7);
}

function drawBody(ctx, creature, radius, time, zoom, isKing) {
  const look = lookOf(creature);
  const palette = lookPalette(look);
  drawGroundShadow(ctx, creature, radius);

  ctx.save();
  ctx.translate(creature.x, creature.y);
  ctx.rotate(creature.heading);

  // Squash & stretch along the direction of travel (more while boosting).
  const stretch = Math.min(creature.speed / CREATURE.BASE_SPEED, 1) * CREATURE.STRETCH_MAX + creature.boostGlow * 0.06;
  ctx.scale(1 + stretch, 1 - stretch * 0.5);

  paintCore(ctx, {
    r: radius,
    palette,
    form: formFor(),
    style: look.style,
    time,
    phase: creature.phase,
    glow: creature.boostGlow,
    blink: creature.blinkTime > 0 ? 0.1 : 1,
    isPlayer: creature.isPlayer,
    isKing,
    lineScale: 1 / zoom,
    light: CREATURE.LIGHT_ANGLE - creature.heading,
    coreHue: look.coreHue,
    character: creature.character,
    animationStyle: creature.character
      ? (creature.isBoosting ? creature.character.animations.movement : creature.character.animations.idle)
      : null,
  });
  ctx.restore();
}

/** Small preview for the skin picker (screen space). */
export function drawCreatureIcon(ctx, look, x, y, radius, form, time, character = null, options = {}) {
  const { silhouette = false } = options;
  const heading = -Math.PI / 2;
  if (!silhouette) {
    const sw = radius * 1.25;
    ctx.drawImage(shadowSprite(), x + radius * 0.22 - sw, y + radius * 0.3 - sw * 0.85, sw * 2, sw * 1.7);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  paintCore(ctx, {
    r: radius,
    palette: lookPalette(look),
    form,
    style: look.style,
    time,
    phase: 0,
    glow: 0,
    blink: 1,
    isPlayer: true,
    isKing: false,
    lineScale: 1,
    light: CREATURE.LIGHT_ANGLE - heading,
    coreHue: look.coreHue,
    character,
    silhouette,
  });
  ctx.restore();
}

/** Remaining boost meter, shown only while the hold is active (never a "ready" slot). */
function drawBoostMeter(ctx, creature, radius, zoom) {
  if (!creature.isBoosting) return;
  const palette = lookPalette(lookOf(creature));
  const r = radius * 1.7 + 10 / zoom;
  ctx.beginPath();
  ctx.arc(creature.x, creature.y, r, 0, TAU);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 3 / zoom;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(creature.x, creature.y, r, -Math.PI / 2, -Math.PI / 2 + creature.energyRatio * TAU);
  ctx.strokeStyle = palette.coreHot;
  ctx.lineWidth = 3.5 / zoom;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawSurgeRing(ctx, creature, radius, zoom) {
  if (!creature.isSurging) return;
  const remaining = creature.surgeTime / SURGE.DURATION;
  ctx.beginPath();
  ctx.arc(creature.x, creature.y, radius * 1.28 + 4 / zoom, -Math.PI / 2, -Math.PI / 2 + remaining * TAU);
  ctx.strokeStyle = SURGE_RING;
  ctx.lineWidth = 3.5 / zoom;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Rotating dashed ring marks a creature on its own settled territory. */
function drawHomeTurfRing(ctx, creature, radius, time, zoom) {
  const r = radius * 1.45 + 6 / zoom;
  ctx.save();
  ctx.translate(creature.x, creature.y);
  ctx.rotate(time * 0.6);
  ctx.setLineDash([10 / zoom, 7 / zoom]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.strokeStyle = HOME_TURF_COLOR;
  ctx.lineWidth = 2.5 / zoom;
  ctx.stroke();
  ctx.restore();
}

/**
 * Body pass.
 * @param {object} view
 * @param {object|null} view.viewer the local player (for danger cues)
 * @param {number} view.zoom
 * @param {object|null} view.king the King's creature
 */
export function drawCreature(ctx, creature, time, view) {
  const { zoom } = view;
  const palette = lookPalette(lookOf(creature));
  const radius = displayRadiusOf(creature);

  if (creature === view.king) {
    const aura = radius * KING.AURA_SCALE;
    ctx.globalAlpha = 0.45 + 0.15 * Math.sin(time * 2.5);
    ctx.drawImage(glowSprite(KING_HUE), creature.x - aura, creature.y - aura, aura * 2, aura * 2);
    ctx.globalAlpha = 1;
  }

  drawTrail(ctx, creature, radius, palette);
  drawBoostStreak(ctx, creature, radius, palette, creature.boostGlow, creature.character);
  // Coloured halo: full strength for the player, quieter for rivals (no rainbow of glows).
  const aura = radius * CREATURE.AURA_SCALE;
  if (!creature.isPlayer) ctx.globalAlpha = RIVAL_AURA_ALPHA;
  ctx.drawImage(auraSprite(creature.hue), creature.x - aura, creature.y - aura, aura * 2, aura * 2);
  ctx.globalAlpha = 1;
  drawRelationRing(ctx, creature, relationTo(creature, view.viewer), radius, time, zoom);
  drawBody(ctx, creature, radius, time, zoom, creature === view.king);
  ctx.globalAlpha = 1;
  drawCreatureAfterBody(ctx, creature, time, view);
}

/** Rings that sit on top of the body. */
function drawCreatureAfterBody(ctx, creature, time, view) {
  const radius = displayRadiusOf(creature);
  drawSurgeRing(ctx, creature, radius, view.zoom);
  if (creature.isPlayer) drawBoostMeter(ctx, creature, radius, view.zoom);
}

/**
 * Names sit in a small pill of the owner's colour (gold for the King), so who-is-who reads
 * at a glance and matches their land. Your own pill gets a light rim.
 */
function drawNamePill(ctx, creature, isKing, y, zoom) {
  const fontPx = CREATURE.LABEL_FONT_PX / zoom;
  ctx.font = `700 ${fontPx}px system-ui, sans-serif`;
  const textW = ctx.measureText(creature.name).width;
  const padX = 7 / zoom;
  const h = fontPx + 6 / zoom;
  const w = textW + padX * 2;
  const x0 = creature.x - w / 2;
  const y0 = y - 2 / zoom;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, h / 2);
  ctx.fillStyle = isKing ? 'rgba(255, 205, 64, 0.95)'
    : creature.isPlayer ? `hsla(${creature.hue}, 72%, 38%, 0.95)`
    : `hsla(${creature.hue}, 45%, 34%, 0.82)`;
  ctx.fill();
  if (creature.isPlayer) {
    ctx.lineWidth = 1.5 / zoom;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();
  }
  ctx.fillStyle = isKing ? KING_LABEL_COLOR : '#ffffff';
  ctx.textBaseline = 'top';
  ctx.fillText(creature.name, creature.x, y + 1 / zoom);
}

function drawTag(ctx, text, color, x, y, zoom) {
  ctx.font = `800 ${11 / zoom}px system-ui, sans-serif`;
  ctx.lineWidth = 3 / zoom;
  ctx.strokeStyle = TAG_STROKE;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/**
 * The crown sits ON the creature: its band rests just inside the top of the shell, scales
 * with the fixed body radius, bobs with the shell's
 * wobble, leans a little with movement, and pops in when the crown changes hands.
 */
function drawKingCrown(ctx, creature, radius, time, zoom, crownAge) {
  const appear = crownAge === undefined ? 1 : Math.min(1, crownAge / KING.CROWN_APPEAR_TIME);
  const pop = appear < 1 ? easeOutBack(appear) : 1;
  const width = Math.max(KING.CROWN_SCREEN_PX / zoom, radius * KING.CROWN_RADIUS_FACTOR) * pop;
  if (width <= 0) return;
  // Same wobble the shell uses, so crown and body move together.
  const wobble = Math.sin(time * CREATURE.MEMBRANE_WOBBLE_SPEED + creature.phase) * CREATURE.MEMBRANE_WOBBLE;
  const lean = clamp(creature.vx / (CREATURE.BASE_SPEED * 2), -1, 1) * KING.CROWN_LEAN;
  const tilt = lean + Math.sin(time * 1.3 + creature.phase) * KING.CROWN_SWAY;
  const baseY = creature.y - radius * (KING.CROWN_SEAT - wobble) + Math.sin(time * 2.2) * radius * 0.025;
  // Soft royal glow behind it.
  const g = width * 1.1;
  ctx.globalAlpha = 0.35;
  ctx.drawImage(glowSprite(KING_HUE), creature.x - g, baseY - width * 0.4 - g, g * 2, g * 2);
  ctx.globalAlpha = 1;
  const glint = (time * 0.35 + creature.phase) % 1; // a slow shimmer across the metal
  drawCrown(ctx, creature.x + Math.sin(tilt) * width * 0.15, baseY, width, tilt, glint);
}

/**
 * Overlay pass, drawn after every body so names and the crown are never covered.
 * @param {boolean} view.hints show short territory-combat cues during onboarding
 */
export function drawCreatureOverlay(ctx, creature, time, view) {
  const { zoom } = view;
  const radius = displayRadiusOf(creature);
  const isKing = creature === view.king;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';

  if (isKing) drawKingCrown(ctx, creature, radius, time, zoom, view.crownAge);

  // Rival names only near the player, so 20 labels never crowd the battlefield.
  const viewer = view.viewer;
  const near = !viewer || creature.isPlayer || isKing
    || Math.hypot(creature.x - viewer.x, creature.y - viewer.y) < CREATURE.LABEL_RANGE + radius;
  let y = creature.y + radius + (CREATURE.LABEL_OFFSET_PX / zoom) * 0.5;
  ctx.textBaseline = 'top';
  const hideOwnName = creature.isPlayer && creature === viewer;
  if (!hideOwnName
    && creature !== viewer
    && near
    && (radius * zoom >= CREATURE.LABEL_MIN_SCREEN_RADIUS || creature.isPlayer || isKing)) {
    drawNamePill(ctx, creature, isKing, y, zoom);
    y += (CREATURE.LABEL_FONT_PX + 9) / zoom;
  }

  // Tracker power-up: every exposed rival carries an EXPOSED tag.
  if (relationTo(creature, view.viewer) === 'danger') {
    drawTag(ctx, 'EXPOSED', DANGER_COLOR, creature.x, y, zoom);
    y += 14 / zoom;
  }
  // The rival who last took you out.
  if (view.revenge && creature === view.revenge) drawTag(ctx, 'REVENGE', '#ff9f43', creature.x, y, zoom);
}

/**
 * While the player's trail is open: a small arrow on their ring pointing back to their
 * own land ("return here to claim everything inside your path").
 */
export function drawHomePointer(ctx, creature, target, zoom, time) {
  const dx = target.x - creature.x;
  const dy = target.y - creature.y;
  const d = Math.hypot(dx, dy);
  if (d < creature.radius * 2) return;
  const a = Math.atan2(dy, dx);
  const r = displayRadiusOf(creature) * 1.6 + 16 / zoom;
  const s = 9 / zoom;
  ctx.save();
  ctx.translate(creature.x + Math.cos(a) * r, creature.y + Math.sin(a) * r);
  ctx.rotate(a);
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 6);
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(-s * 0.7, s * 0.75);
  ctx.lineTo(-s * 0.25, 0);
  ctx.lineTo(-s * 0.7, -s * 0.75);
  ctx.closePath();
  ctx.fillStyle = PLAYER_LABEL_COLOR;
  ctx.fill();
  ctx.restore();
}

/**
 * A full creature drawn outside the game world (title screen): same renderer, same light,
 * facing `heading`, with shadow and aura.
 */
export function drawShowcaseCreature(ctx, look, x, y, radius, heading, time, form, glow = 0, character = null) {
  const palette = lookPalette(look);
  const aura = radius * CREATURE.AURA_SCALE;
  ctx.drawImage(auraSprite(look.coreHue), x - aura, y - aura, aura * 2, aura * 2);
  const sw = radius * 1.25;
  ctx.drawImage(shadowSprite(), x + radius * 0.22 - sw, y + radius * 0.3 - sw * 0.85, sw * 2, sw * 1.7);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  paintCore(ctx, {
    r: radius,
    palette,
    form,
    style: look.style,
    time,
    phase: 0,
    glow,
    blink: Math.sin(time * 0.9) > 0.985 ? 0.1 : 1,
    isPlayer: false,
    isKing: false,
    lineScale: 1,
    light: CREATURE.LIGHT_ANGLE - heading,
    coreHue: look.coreHue,
    character,
  });
  ctx.restore();
}
