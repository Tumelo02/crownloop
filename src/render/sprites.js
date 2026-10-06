// Pre-rendered glow sprites. Drawing a cached gradient image is far cheaper
// than shadowBlur or building a gradient for every particle every frame.

const SPRITE_SIZE = 64;
const FOOD_SPRITE_SIZE = 96;
const glowCache = new Map();
const auraCache = new Map();
const foodCache = new Map();

function makeSprite(paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  const c = SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  paint(gradient);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
}

/** Bright core with a soft halo — particles and power-up glow. */
export function glowSprite(hue) {
  let sprite = glowCache.get(hue);
  if (!sprite) {
    sprite = makeSprite((g) => {
      g.addColorStop(0, `hsla(${hue}, 100%, 94%, 1)`);
      g.addColorStop(0.2, `hsla(${hue}, 100%, 70%, 1)`);
      g.addColorStop(0.34, `hsla(${hue}, 100%, 60%, 0.45)`);
      g.addColorStop(1, `hsla(${hue}, 100%, 55%, 0)`);
    });
    glowCache.set(hue, sprite);
  }
  return sprite;
}

/** Soft contact shadow under creatures (gives them weight on the ground). */
let shadowCache = null;
export function shadowSprite() {
  if (!shadowCache) {
    shadowCache = makeSprite((g) => {
      g.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
      g.addColorStop(0.55, 'rgba(0, 0, 0, 0.22)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    });
  }
  return shadowCache;
}

/** White soft spot for specular highlights (scaled/rotated at draw time). */
let specCache = null;
export function specSprite() {
  if (!specCache) {
    specCache = makeSprite((g) => {
      g.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    });
  }
  return specCache;
}

/** Dark recess the energy core sits in: opaque to 62% of the radius, then fades out. */
let socketCache = null;
export function socketSprite() {
  if (!socketCache) {
    socketCache = makeSprite((g) => {
      g.addColorStop(0, 'rgba(1, 3, 8, 0.85)');
      g.addColorStop(0.62, 'rgba(1, 3, 8, 0.85)');
      g.addColorStop(1, 'rgba(1, 3, 8, 0)');
    });
  }
  return socketCache;
}

/** Energy light spilling from a core. */
const haloCache = new Map();
export function haloSprite(hue) {
  let sprite = haloCache.get(hue);
  if (!sprite) {
    sprite = makeSprite((g) => {
      g.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.55)`);
      g.addColorStop(0.22, `hsla(${hue}, 100%, 70%, 0.55)`);
      g.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
    });
    haloCache.set(hue, sprite);
  }
  return sprite;
}

/** Faint wide halo behind creatures. */
export function auraSprite(hue) {
  let sprite = auraCache.get(hue);
  if (!sprite) {
    sprite = makeSprite((g) => {
      g.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.32)`);
      g.addColorStop(0.45, `hsla(${hue}, 100%, 55%, 0.12)`);
      g.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
    });
    auraCache.set(hue, sprite);
  }
  return sprite;
}

/**
 * Food: a solid glossy orb inside a soft halo, so it reads as "a thing to pick up".
 * Bigger tiers get a bright ring. The orb fills 1 / scale of the sprite's half-size.
 * @param {number} tierIndex 0 small, 1 medium, 2 large
 */
export function foodSprite(hue, tierIndex, scale) {
  const key = `${hue}:${tierIndex}`;
  let sprite = foodCache.get(key);
  if (sprite) return sprite;

  sprite = document.createElement('canvas');
  sprite.width = sprite.height = FOOD_SPRITE_SIZE;
  const ctx = sprite.getContext('2d');
  const c = FOOD_SPRITE_SIZE / 2;
  const r = c / scale;

  const halo = ctx.createRadialGradient(c, c, r * 0.6, c, c, c);
  halo.addColorStop(0, `hsla(${hue}, 100%, 62%, ${0.42 + tierIndex * 0.08})`);
  halo.addColorStop(1, `hsla(${hue}, 100%, 55%, 0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, FOOD_SPRITE_SIZE, FOOD_SPRITE_SIZE);

  const body = ctx.createRadialGradient(c - r * 0.3, c - r * 0.3, r * 0.1, c, c, r);
  body.addColorStop(0, `hsl(${hue}, 100%, 96%)`);
  body.addColorStop(0.45, `hsl(${hue}, 100%, ${68 + tierIndex * 4}%)`);
  body.addColorStop(1, `hsl(${hue}, 90%, 46%)`);
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  // A thin darker rim keeps the marble crisp on the light arena floor.
  ctx.strokeStyle = `hsla(${hue}, 80%, 30%, 0.55)`;
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.stroke();

  if (tierIndex > 0) {
    ctx.beginPath();
    ctx.arc(c, c, r * 1.45, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue}, 100%, 80%, ${0.35 + tierIndex * 0.2})`;
    ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.stroke();
  }

  foodCache.set(key, sprite);
  return sprite;
}

// ---------------------------------------------------------------- the King's crown
// A metallic crown drawn with Canvas shapes (no emoji, no image): a curved band for
// roundness, five points with orbs, gold shaded from the upper-left light, a dark rim,
// a bright bevel and set jewels.

const CROWN_RIM = '#6e4108';
const BAND_TOP = '#ffe48a';
const BAND_BOTTOM = '#9a5f0c';

function jewel(ctx, x, y, r, base, light) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, light);
  g.addColorStop(0.55, base);
  g.addColorStop(1, '#1a0610');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(0.6, r * 0.3);
  ctx.strokeStyle = 'rgba(110, 65, 8, 0.9)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();
}

/**
 * Crown whose band bottom is centred at (x, baseY), `width` wide, rotated by `tilt`.
 * @param {number} [glint] 0..1 extra highlight sweep (for a subtle shimmer)
 */
export function drawCrown(ctx, x, baseY, width, tilt = 0, glint = 0) {
  const w = width;
  const h = w * 0.66;
  const band = h * 0.34;
  const curve = h * 0.12; // the band bows downward: it reads as round, not flat
  const half = w / 2;
  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate(tilt);
  ctx.lineJoin = 'round';

  // Silhouette: curved bottom, straight sides, five points (tallest in the middle).
  const tips = [
    [-half, -band - h * 0.42],
    [-half * 0.5, -band - h * 0.5],
    [0, -h],
    [half * 0.5, -band - h * 0.5],
    [half, -band - h * 0.42],
  ];
  const valleys = [-half * 0.75, -half * 0.25, half * 0.25, half * 0.75];
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  ctx.quadraticCurveTo(0, curve, half, 0);
  ctx.lineTo(half, -band);
  ctx.lineTo(tips[4][0], tips[4][1]);
  for (let i = 3; i >= 0; i--) {
    ctx.lineTo(valleys[i], -band - h * 0.1);
    ctx.lineTo(tips[i][0], tips[i][1]);
  }
  ctx.lineTo(-half, -band);
  ctx.closePath();
  const body = ctx.createLinearGradient(-half, -h, half, curve);
  body.addColorStop(0, '#fff3b8');
  body.addColorStop(0.35, '#f7c948');
  body.addColorStop(0.7, '#d18f1c');
  body.addColorStop(1, '#8a520b');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.04);
  ctx.strokeStyle = CROWN_RIM;
  ctx.stroke();

  // Band: a separate, darker strip with a bright bevel along its top edge.
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  ctx.quadraticCurveTo(0, curve, half, 0);
  ctx.lineTo(half, -band);
  ctx.quadraticCurveTo(0, -band + curve, -half, -band);
  ctx.closePath();
  const bandFill = ctx.createLinearGradient(0, -band, 0, curve);
  bandFill.addColorStop(0, BAND_TOP);
  bandFill.addColorStop(1, BAND_BOTTOM);
  ctx.fillStyle = bandFill;
  ctx.fill();
  ctx.lineWidth = Math.max(0.8, w * 0.03);
  ctx.strokeStyle = CROWN_RIM;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-half * 0.92, -band * 0.92);
  ctx.quadraticCurveTo(0, -band + curve * 0.9, half * 0.92, -band * 0.92);
  ctx.strokeStyle = 'rgba(255, 250, 220, 0.85)';
  ctx.lineWidth = Math.max(0.6, w * 0.025);
  ctx.stroke();

  // Orbs on the points.
  const orb = Math.max(1, w * 0.065);
  for (const [tx, ty] of tips) {
    const g = ctx.createRadialGradient(tx - orb * 0.4, ty - orb * 0.4, orb * 0.1, tx, ty, orb);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#e2a52a');
    ctx.beginPath();
    ctx.arc(tx, ty, orb, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // Jewels set in the band.
  const jy = -band * 0.5 + curve * 0.5;
  jewel(ctx, 0, jy, w * 0.085, '#e0244e', '#ffd0dc');
  jewel(ctx, -half * 0.58, jy - curve * 0.15, w * 0.055, '#2f6dff', '#d6e4ff');
  jewel(ctx, half * 0.58, jy - curve * 0.15, w * 0.055, '#2f6dff', '#d6e4ff');

  // Specular streak (and an optional travelling glint).
  ctx.globalCompositeOperation = 'lighter';
  const sx = -half * 0.45 + glint * w * 0.9;
  const spec = ctx.createRadialGradient(sx, -h * 0.55, 0, sx, -h * 0.55, w * 0.32);
  spec.addColorStop(0, `rgba(255, 255, 230, ${0.35 + glint * 0.3})`);
  spec.addColorStop(1, 'rgba(255, 255, 230, 0)');
  ctx.fillStyle = spec;
  ctx.fillRect(-half, -h, w, h + curve);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/** Crown centred on (x, y), `size` wide (icons, minimap). */
export function drawCrownShape(ctx, x, y, size) {
  drawCrown(ctx, x, y + size * 0.33, size, 0, 0);
}
