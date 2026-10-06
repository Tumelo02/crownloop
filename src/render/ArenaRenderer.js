import { RENDER, TERRITORY, WORLD } from '../config.js';
import { ARENA } from '../world/arena.js';
import { currentFloor } from './floorThemes.js';
import { drawGalaxyBackdrop, hazeSprite } from './galaxyAtmosphere.js';

const TAU = Math.PI * 2;
const HALO = 320; // world units of atmospheric glow outside the rim
const SHADE = 520; // world units of "curvature" shading just inside the rim

/** True when every corner of the view is well inside the disc (nothing of the rim shows). */
function viewInsideDisc(bounds, margin) {
  const r = ARENA.R - margin;
  const r2 = r * r;
  for (const x of [bounds.left, bounds.right]) {
    for (const y of [bounds.top, bounds.bottom]) {
      const dx = x - ARENA.CX;
      const dy = y - ARENA.CY;
      if (dx * dx + dy * dy > r2) return false;
    }
  }
  return true;
}

/**
 * Cell circles: one soft ring per 40-unit domain cell, exactly on the gameplay grid, so you
 * can read the ground you are about to claim (land fills over them). Rendered at 2 px per
 * world unit into a one-cell tile and repeated as a pattern: one fill per frame.
 */
const cellPatterns = new Map(); // colour -> { ctx, pattern }
function cellPattern(ctx, color) {
  let entry = cellPatterns.get(color);
  if (!entry || entry.ctx !== ctx) {
    const size = TERRITORY.CELL_SIZE;
    const k = 2;
    const c = document.createElement('canvas');
    c.width = c.height = size * k;
    const g = c.getContext('2d');
    g.strokeStyle = color;
    g.lineWidth = 1.6 * k;
    g.beginPath();
    g.arc(size * k / 2, size * k / 2, size * k * 0.4, 0, TAU);
    g.stroke();
    g.fillStyle = color;
    g.beginPath();
    g.arc(size * k / 2, size * k / 2, 1.6 * k, 0, TAU);
    g.fill();
    const pattern = ctx.createPattern(c, 'repeat');
    if (pattern.setTransform) pattern.setTransform(new DOMMatrix([1 / k, 0, 0, 1 / k, 0, 0]));
    entry = { ctx, pattern };
    cellPatterns.set(color, entry);
  }
  return entry.pattern;
}

let starTile = null;
/** A cached tile of faint stars for the space beyond the rim. */
function starPattern(ctx) {
  if (!starTile) {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() < 0.12 ? 1.8 : 0.5 + Math.random() * 0.9;
      g.fillStyle = `rgba(${200 + Math.random() * 55 | 0}, ${215 + Math.random() * 40 | 0}, 255, ${0.25 + Math.random() * 0.6})`;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    starTile = c;
  }
  return ctx.createPattern(starTile, 'repeat');
}

/**
 * The arena: a disc of pale alien ground (a planet surface) floating in deep space.
 * Inside: a cool base, tinted haze pools, barely visible energy currents and sparse dust
 * (render/galaxyAtmosphere.js), shaded slightly toward the rim. Outside: dark space with
 * faint stars and a soft atmospheric halo. No grid. Culled to the view; the rim pieces are
 * only drawn when the rim is near.
 */
export function drawArenaFloor(ctx, bounds, zoom, cam = { x: 0, y: 0 }, time = 0) {
  const x0 = Math.max(0, bounds.left);
  const x1 = Math.min(WORLD.WIDTH, bounds.right);
  const y0 = Math.max(0, bounds.top);
  const y1 = Math.min(WORLD.HEIGHT, bounds.bottom);
  const rimVisible = !viewInsideDisc(bounds, SHADE);

  if (rimVisible) {
    // Space: faint stars (the canvas is already cleared to RENDER.BACKGROUND), then the halo.
    ctx.fillStyle = starPattern(ctx);
    ctx.globalAlpha = 0.8;
    ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    ctx.globalAlpha = 1;
    const halo = ctx.createRadialGradient(ARENA.CX, ARENA.CY, ARENA.R, ARENA.CX, ARENA.CY, ARENA.R + HALO);
    halo.addColorStop(0, 'rgba(120, 210, 255, 0.34)');
    halo.addColorStop(0.35, 'rgba(110, 140, 255, 0.12)');
    halo.addColorStop(1, 'rgba(90, 80, 200, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(ARENA.CX, ARENA.CY, ARENA.R + HALO, 0, TAU);
    ctx.fill();
  }
  if (x1 <= x0 || y1 <= y0) return;

  ctx.save();
  if (rimVisible) {
    ctx.beginPath();
    ctx.arc(ARENA.CX, ARENA.CY, ARENA.R, 0, TAU);
    ctx.clip();
  }
  const floor = currentFloor(); // Settings > Floor (render/floorThemes.js)
  ctx.fillStyle = floor.base;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Cell circles fade out when zoomed far out (they would turn into noise).
  if (zoom > 0.35) {
    ctx.globalAlpha = Math.min(1, (zoom - 0.35) / 0.2);
    ctx.fillStyle = cellPattern(ctx, floor.cell);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.globalAlpha = 1;
  }

  // Light pools on a fixed world lattice (offset every other row), so the floor has depth
  // that moves with the world without any texture.
  const pool = RENDER.FLOOR_POOL_SIZE;
  for (let row = Math.floor(y0 / pool) - 1; row * pool <= y1 + pool; row++) {
    const shift = (row & 1) * pool * 0.5;
    for (let col = Math.floor((x0 - shift) / pool) - 1; col * pool + shift <= x1 + pool; col++) {
      const cx = col * pool + shift + pool * 0.5;
      const cy = row * pool + pool * 0.5;
      const r = pool * 0.62;
      if (cx + r < x0 || cx - r > x1 || cy + r < y0 || cy - r > y1) continue;
      // Tinted pools (cyan / violet / teal): an alien haze, never a texture.
      ctx.drawImage(hazeSprite(col, row), cx - r, cy - r, r * 2, r * 2);
    }
  }
  // Barely visible energy currents and sparse cosmic dust (cached patterns).
  drawGalaxyBackdrop(ctx, x0, y0, x1, y1, cam, time);

  if (rimVisible) {
    // The ground curves away toward the rim: a gentle cool shade, then a lit edge.
    const shade = ctx.createRadialGradient(ARENA.CX, ARENA.CY, ARENA.R - SHADE, ARENA.CX, ARENA.CY, ARENA.R);
    shade.addColorStop(0, 'rgba(70, 90, 140, 0)');
    shade.addColorStop(0.75, 'rgba(70, 90, 140, 0.1)');
    shade.addColorStop(0.95, 'rgba(90, 170, 230, 0.2)');
    shade.addColorStop(1, 'rgba(160, 235, 255, 0.45)');
    ctx.fillStyle = shade;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  ctx.restore();
}

/**
 * The rim: a crisp luminous line over the land's edge (drawn after territory), so the
 * boundary always reads clearly. Movement simply stops there.
 */
export function drawWorldEdge(ctx, bounds, zoom) {
  if (viewInsideDisc(bounds, 40)) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ARENA.CX, ARENA.CY, ARENA.R, 0, TAU);
  ctx.strokeStyle = 'rgba(110, 200, 255, 0.25)';
  ctx.lineWidth = 9 / zoom;
  ctx.stroke();
  ctx.strokeStyle = RENDER.WORLD_EDGE;
  ctx.lineWidth = 2.2 / zoom;
  ctx.stroke();
  ctx.restore();
}
