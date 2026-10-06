import { ENEMY, WORLD } from '../config.js';
import { distSq } from '../utils/math.js';
import { insideArena, randomArenaPoint } from './arena.js';

export function createStrategicLandmarks(territory, count, radius, minDistance = 600, attempts = 220) {
  const placements = [];
  const safeMargin = ENEMY.SPAWN_MARGIN + radius;
  for (let i = 0; i < count; i++) {
    let point = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const candidate = { x: 0, y: 0 };
      randomArenaPoint(safeMargin, candidate);
      if (territory.ownerAt(candidate.x, candidate.y) !== 0) continue;
      if (!insideArena(candidate.x, candidate.y, safeMargin)) continue;
      const conflicts = placements.some((other) => distSq(candidate.x, candidate.y, other.x, other.y) < minDistance ** 2);
      if (conflicts) continue;
      point = candidate;
      break;
    }

    if (!point) {
      const fallback = { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 };
      for (let attempt = 0; attempt < attempts; attempt++) {
        randomArenaPoint(safeMargin, fallback);
        if (territory.ownerAt(fallback.x, fallback.y) === 0) {
          point = { x: fallback.x, y: fallback.y };
          break;
        }
      }
    }

    if (!point) {
      point = { x: WORLD.WIDTH / 2 + (i - count / 2) * 280, y: WORLD.HEIGHT / 2 + (i % 2 ? -220 : 220) };
    }
    placements.push(point);
  }
  return placements;
}

/** Picks neutral ground close to existing claims, fully inside the arena rim. */
export function findNeutralNearOwned(territory, radius, attempts) {
  const owned = [];
  let safeNeutral = -1;
  const safeMargin = ENEMY.SPAWN_MARGIN + radius;
  const { cellSize, cols } = territory;

  for (let index = 0; index < territory.totalCells; index++) {
    if (!territory.playable[index]) continue;
    if (territory.owners[index] === 0) {
      const col = index % cols;
      const row = (index - col) / cols;
      const x = (col + 0.5) * cellSize;
      const y = (row + 0.5) * cellSize;
      if (safeNeutral < 0 && insideArena(x, y, safeMargin)) safeNeutral = index;
    } else {
      owned.push(index);
    }
  }

  for (let i = 0; i < attempts && owned.length > 0; i++) {
    const index = owned[Math.floor(Math.random() * owned.length)];
    const col = index % cols;
    const row = (index - col) / cols;
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * radius;
    const x = (col + 0.5) * cellSize + Math.cos(angle) * distance;
    const y = (row + 0.5) * cellSize + Math.sin(angle) * distance;
    if (insideArena(x, y, safeMargin) && territory.ownerAt(x, y) === 0) return { x, y };
  }

  if (owned.length > 0) return null;
  if (safeNeutral >= 0) {
    const col = safeNeutral % cols;
    const row = (safeNeutral - col) / cols;
    return { x: (col + 0.5) * cellSize, y: (row + 0.5) * cellSize };
  }

  const point = { x: 0, y: 0 };
  for (let i = 0; i < attempts; i++) {
    randomArenaPoint(safeMargin, point);
    if (territory.ownerAt(point.x, point.y) === 0) return { x: point.x, y: point.y };
  }
  return { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 };
}
