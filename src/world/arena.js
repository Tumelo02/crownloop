import { WORLD } from '../config.js';

/**
 * The arena is a disc (a planet surface in space) centred in the WORLD.WIDTH x HEIGHT
 * square. The square still holds the territory grid and spatial hashes; these helpers keep
 * everything that moves or spawns inside the disc.
 */
export const ARENA = Object.freeze({
  CX: WORLD.WIDTH / 2,
  CY: WORLD.HEIGHT / 2,
  R: WORLD.RADIUS,
});

const scratch = { x: 0, y: 0 };

/** Distance from the arena centre. */
export function arenaDistance(x, y) {
  return Math.hypot(x - ARENA.CX, y - ARENA.CY);
}

/** Is (x, y) at least `margin` inside the rim? */
export function insideArena(x, y, margin = 0) {
  const r = ARENA.R - margin;
  const dx = x - ARENA.CX;
  const dy = y - ARENA.CY;
  return dx * dx + dy * dy <= r * r;
}

/** (x, y) pulled straight toward the centre until it is `margin` inside the rim. */
export function clampToArena(x, y, margin = 0, out = scratch) {
  const r = Math.max(0, ARENA.R - margin);
  const dx = x - ARENA.CX;
  const dy = y - ARENA.CY;
  const d2 = dx * dx + dy * dy;
  if (d2 <= r * r) {
    out.x = x;
    out.y = y;
  } else {
    const k = r / Math.sqrt(d2);
    out.x = ARENA.CX + dx * k;
    out.y = ARENA.CY + dy * k;
  }
  return out;
}

/** A uniformly random point at least `margin` inside the rim. */
export function randomArenaPoint(margin = 0, out = scratch) {
  const r = Math.max(0, ARENA.R - margin) * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  out.x = ARENA.CX + Math.cos(a) * r;
  out.y = ARENA.CY + Math.sin(a) * r;
  return out;
}
