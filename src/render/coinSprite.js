import { COIN_FIELD } from '../config.js';

// A metallic coin drawn once into a sprite sheet of spin frames, lit from the upper-left
// like the creatures. Drawing a frame is then a single drawImage.

const FRAME_PX = 96;
const R = 36;
const GOLD_LIGHT = '#fff1b0';
const GOLD_MID = '#f2bd3a';
const GOLD_DARK = '#9c6614';
const EDGE_DARK = '#7a4d0e';
const EDGE_LIGHT = '#c98d24';
const ENGRAVE_DARK = 'rgba(120, 72, 10, 0.85)';
const ENGRAVE_LIGHT = 'rgba(255, 246, 205, 0.8)';

let sheet = null;

function crownPath(ctx, cx, cy, w, h) {
  const l = cx - w / 2;
  const t = cy - h / 2;
  ctx.beginPath();
  ctx.moveTo(l, t + h);
  ctx.lineTo(l, t + h * 0.32);
  ctx.lineTo(l + w * 0.27, t + h * 0.6);
  ctx.lineTo(l + w * 0.5, t);
  ctx.lineTo(l + w * 0.73, t + h * 0.6);
  ctx.lineTo(l + w, t + h * 0.32);
  ctx.lineTo(l + w, t + h);
  ctx.closePath();
}

/** One coin at spin angle `theta` (0 = face-on), centred at (cx, cy), radius r. */
function paintCoin(ctx, cx, cy, r, theta) {
  const w = Math.cos(theta);
  const face = Math.max(Math.abs(w), 0.07); // horizontal squash of the face
  const side = Math.sin(theta); // which way the edge shows
  const thickness = r * 0.16;
  const e = side * thickness;

  // Edge: stacked slices between the back and front faces give the coin real thickness.
  const slices = 7;
  for (let k = slices; k >= 0; k--) {
    const x = cx + e * (k / slices - 0.5);
    ctx.beginPath();
    ctx.ellipse(x, cy, r * face, r, 0, 0, Math.PI * 2);
    ctx.fillStyle = k % 2 === 0 ? EDGE_DARK : EDGE_LIGHT; // reeded edge
    ctx.fill();
  }

  const fx = cx - e * 0.5; // front face position
  // Face body: lit from the upper-left.
  const body = ctx.createLinearGradient(fx - r * face, cy - r, fx + r * face, cy + r);
  body.addColorStop(0, GOLD_LIGHT);
  body.addColorStop(0.45, GOLD_MID);
  body.addColorStop(1, GOLD_DARK);
  ctx.beginPath();
  ctx.ellipse(fx, cy, r * face, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  // Darker rim, with a thin bright bevel on the lit side.
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = 'rgba(150, 95, 18, 0.9)';
  ctx.beginPath();
  ctx.ellipse(fx, cy, r * face * 0.86, r * 0.86, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = r * 0.035;
  ctx.strokeStyle = 'rgba(255, 245, 200, 0.75)';
  ctx.beginPath();
  ctx.ellipse(fx, cy, r * face * 0.95, r * 0.95, 0, Math.PI * 0.95, Math.PI * 1.6);
  ctx.stroke();

  // Raised inner face.
  const inner = ctx.createRadialGradient(fx - r * face * 0.3, cy - r * 0.3, r * 0.05, fx, cy, r * 0.78);
  inner.addColorStop(0, '#ffe796');
  inner.addColorStop(1, '#e0a52c');
  ctx.beginPath();
  ctx.ellipse(fx, cy, r * face * 0.76, r * 0.76, 0, 0, Math.PI * 2);
  ctx.fillStyle = inner;
  ctx.fill();

  // Engraved crown: recessed (dark), with light catching its lower-right lip.
  if (face > 0.25) {
    ctx.save();
    ctx.translate(fx, cy);
    ctx.scale(face, 1);
    crownPath(ctx, r * 0.03, r * 0.05, r * 0.86, r * 0.6);
    ctx.fillStyle = ENGRAVE_LIGHT;
    ctx.fill();
    crownPath(ctx, -r * 0.02, 0, r * 0.86, r * 0.6);
    ctx.fillStyle = ENGRAVE_DARK;
    ctx.fill();
    const jewel = ctx.createRadialGradient(-r * 0.02, -r * 0.12, r * 0.015, -r * 0.02, -r * 0.12, r * 0.11);
    jewel.addColorStop(0, '#fffbdc');
    jewel.addColorStop(0.35, '#fff0a0');
    jewel.addColorStop(1, '#c98719');
    ctx.beginPath();
    ctx.arc(-r * 0.02, -r * 0.12, r * 0.11, 0, Math.PI * 2);
    ctx.fillStyle = jewel;
    ctx.fill();
    ctx.restore();
  }

  // Specular streak.
  ctx.save();
  ctx.translate(fx - r * face * 0.38, cy - r * 0.42);
  ctx.rotate(-0.6);
  ctx.scale(Math.max(face, 0.15), 0.35);
  const spec = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
  spec.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
  spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Sprite sheet: COIN_FIELD.SPRITE_FRAMES spin frames side by side. */
export function coinSheet() {
  if (sheet) return sheet;
  const frames = COIN_FIELD.SPRITE_FRAMES;
  sheet = document.createElement('canvas');
  sheet.width = FRAME_PX * frames;
  sheet.height = FRAME_PX;
  const ctx = sheet.getContext('2d');
  for (let i = 0; i < frames; i++) {
    paintCoin(ctx, i * FRAME_PX + FRAME_PX / 2, FRAME_PX / 2, R, (i / frames) * Math.PI * 2);
  }
  return sheet;
}

export const COIN_FRAME_PX = FRAME_PX;
export const COIN_SPRITE_RADIUS = R;

/** Draws a slightly turned coin into a small canvas (HUD / menu icons). */
export function paintCoinIcon(canvas, size = canvas.clientWidth || 16) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintCoin(ctx, size / 2, size / 2, size * 0.42, 0.35);
}
