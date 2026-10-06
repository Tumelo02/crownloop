import { ENERGY, WORLD } from '../config.js';
import { foodSprite } from '../render/sprites.js';
import { clamp, distSq, randRange } from '../utils/math.js';
import { SpatialHash } from '../utils/SpatialHash.js';
import { clampToArena, randomArenaPoint } from '../world/arena.js';

const TOTAL_WEIGHT = ENERGY.TIERS.reduce((sum, tier) => sum + tier.weight, 0);

/** Weighted pick (weights are relative, they needn't sum to 1). Value and size come from the tier. */
function pickTierIndex() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < ENERGY.TIERS.length; i++) {
    if (roll < ENERGY.TIERS[i].weight) return i;
    roll -= ENERGY.TIERS[i].weight;
  }
  return 0;
}

/** A food / energy cell. Small, medium and large tiers differ in value, size and colour. */
export class Energy {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.tier = 0;
    this.value = 0;
    this.radius = 0;
    this.hue = 0;
    this.active = false;
    this.respawnAt = 0;
    this.spawnedAt = -Infinity;
    this.phase = 0;
    this.hashCell = -1;
  }

  spawnAt(x, y, time) {
    const tierIndex = pickTierIndex();
    const tier = ENERGY.TIERS[tierIndex];
    this.x = x;
    this.y = y;
    this.tier = tierIndex;
    this.value = tier.value;
    this.radius = tier.radius;
    this.hue = tier.hue;
    this.active = true;
    this.spawnedAt = time;
    this.phase = Math.random() * Math.PI * 2;
  }
}

/**
 * Capped food pool with a cached, coarse regional density field. Food respawns
 * gradually into jittered clusters; the spatial hash keeps queries and drawing local.
 */
export class EnergyField {
  constructor(count = ENERGY.MAX_POPULATION) {
    this.capacity = Math.min(count, ENERGY.MAX_POPULATION);
    this.items = Array.from({ length: this.capacity }, () => new Energy());
    this.hash = new SpatialHash(WORLD.WIDTH, WORLD.HEIGHT, ENERGY.SPATIAL_CELL);
    this.respawnQueue = [];
    this.available = [];
    this.scratch = [];
    this.visible = [];
    this.time = 0;
    this.population = 0;
    this.regenBudget = 0;
    this.densityAge = 0;
    this.buildDensityField();
  }

  reset() {
    this.time = 0;
    this.densityAge = 0;
    this.buildDensityField();
    this.hash.clear();
    this.respawnQueue.length = 0;
    this.available.length = 0;
    this.population = 0;
    this.regenBudget = 0;
    for (let i = 0; i < this.items.length; i++) {
      const energy = this.items[i];
      energy.active = false;
      energy.hashCell = -1;
      if (i >= ENERGY.INITIAL_POPULATION) {
        this.available.push(energy);
        continue;
      }
      this.spawnRandom(energy);
      energy.spawnedAt = -Infinity; // already there, no pop-in
      this.hash.insert(energy);
      this.population++;
    }
  }

  buildDensityField() {
    const size = ENERGY.DENSITY_CELL_SIZE;
    this.densityCols = Math.ceil(WORLD.WIDTH / size) + 1;
    this.densityRows = Math.ceil(WORLD.HEIGHT / size) + 1;
    const raw = new Float32Array(this.densityCols * this.densityRows);
    this.density = new Float32Array(raw.length);
    for (let i = 0; i < raw.length; i++) raw[i] = Math.random();

    for (let row = 0; row < this.densityRows; row++) {
      for (let col = 0; col < this.densityCols; col++) {
        let neighbors = 0;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr < 0 || nr >= this.densityRows || nc < 0 || nc >= this.densityCols) continue;
            neighbors += raw[nr * this.densityCols + nc];
            count++;
          }
        }
        const index = row * this.densityCols + col;
        this.density[index] = raw[index] * 0.35 + (neighbors / count) * 0.65;
      }
    }

    this.clusterAnchors = [];
    const anchorCount = Math.ceil((WORLD.WIDTH * WORLD.HEIGHT) / (size * size) * 1.2);
    for (let i = 0; i < anchorCount; i++) {
      this.clusterAnchors.push(randomArenaPoint(ENERGY.EDGE_MARGIN, { x: 0, y: 0 }));
    }
  }

  densityAt(x, y) {
    const size = ENERGY.DENSITY_CELL_SIZE;
    const gx = clamp(x / size, 0, this.densityCols - 1);
    const gy = clamp(y / size, 0, this.densityRows - 1);
    const col = Math.floor(gx);
    const row = Math.floor(gy);
    const nextCol = Math.min(col + 1, this.densityCols - 1);
    const nextRow = Math.min(row + 1, this.densityRows - 1);
    const fx = gx - col;
    const fy = gy - row;
    const a = this.density[row * this.densityCols + col];
    const b = this.density[row * this.densityCols + nextCol];
    const c = this.density[nextRow * this.densityCols + col];
    const d = this.density[nextRow * this.densityCols + nextCol];
    const top = a + (b - a) * fx;
    const bottom = c + (d - c) * fx;
    return top + (bottom - top) * fy;
  }

  densityMultiplierAt(x, y) {
    const density = this.densityAt(x, y);
    if (density < ENERGY.DRY_ZONE_THRESHOLD) return ENERGY.DRY_ZONE_MULTIPLIER;
    if (density > ENERGY.RICH_ZONE_THRESHOLD) return ENERGY.RICH_ZONE_MULTIPLIER;
    return ENERGY.NORMAL_ZONE_MULTIPLIER;
  }

  resourcePoint() {
    const margin = ENERGY.EDGE_MARGIN;
    const maxWeight = ENERGY.RICH_ZONE_MULTIPLIER;
    if (Math.random() < ENERGY.CLUSTER_STRENGTH) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const anchor = this.clusterAnchors[Math.floor(Math.random() * this.clusterAnchors.length)];
        if (Math.random() * maxWeight > this.densityMultiplierAt(anchor.x, anchor.y)) continue;
        const angle = Math.random() * Math.PI * 2;
        const distance = gaussian() * ENERGY.CLUSTER_RADIUS * 0.45;
        return clampToArena(anchor.x + Math.cos(angle) * distance, anchor.y + Math.sin(angle) * distance,
          margin, { x: 0, y: 0 });
      }
    }

    for (let attempt = 0; attempt < 30; attempt++) {
      const p = randomArenaPoint(margin, { x: 0, y: 0 });
      if (Math.random() * maxWeight <= this.densityMultiplierAt(p.x, p.y)) return p;
    }
    return randomArenaPoint(margin, { x: 0, y: 0 });
  }

  spawnRandom(energy) {
    const point = this.resourcePoint();
    energy.spawnAt(point.x, point.y, this.time);
  }

  /** Adds a bounded burst of shared pickups without exceeding the field population cap. */
  emitBurst(x, y, count, radius) {
    const spawned = Math.max(0, Math.min(count, ENERGY.MAX_POPULATION - this.population, this.available.length));
    for (let i = 0; i < spawned; i++) {
      const energy = this.available.pop();
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * radius;
      const point = clampToArena(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance,
        ENERGY.EDGE_MARGIN, { x: 0, y: 0 });
      energy.spawnAt(point.x, point.y, this.time);
      this.hash.insert(energy);
      this.population++;
    }
    return spawned;
  }

  collect(energy) {
    if (!energy.active) return;
    energy.active = false;
    this.population--;
    this.hash.remove(energy);
    energy.respawnAt = this.time + randRange(ENERGY.RESPAWN_DELAY_MIN, ENERGY.RESPAWN_DELAY_MAX);
    let low = 0;
    let high = this.respawnQueue.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.respawnQueue[mid].respawnAt > energy.respawnAt) low = mid + 1;
      else high = mid;
    }
    this.respawnQueue.splice(low, 0, energy);
  }

  /** Call after moving an item (magnet pull). */
  moved(energy) {
    this.hash.move(energy);
  }

  /** Gathers `count` random food items around a point so a fresh spawn has food at its feet. */
  scatterAround(x, y, count, radius) {
    const m = ENERGY.EDGE_MARGIN;
    const moved = new Set();
    for (let i = 0; i < count; i++) {
      let energy = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = this.items[Math.floor(Math.random() * this.items.length)];
        if (candidate.active && !moved.has(candidate)) {
          energy = candidate;
          moved.add(candidate);
          break;
        }
      }
      if (!energy) break;
      const angle = Math.random() * Math.PI * 2;
      // A ring around the spawn, not on top of it: the first pickups take a few seconds of moving.
      const dist = ENERGY.SPAWN_CLUSTER_MIN_DISTANCE + Math.abs(gaussian()) * radius * 0.42;
      clampToArena(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, m, energy);
      energy.spawnedAt = this.time;
      this.hash.move(energy);
    }
  }

  update(dt) {
    this.time += dt;
    // Food zones drift: new spawns follow a fresh rich/normal/dry layout every so often.
    this.densityAge += dt;
    if (this.densityAge >= ENERGY.DENSITY_SHIFT_INTERVAL) {
      this.densityAge = 0;
      this.buildDensityField();
    }
    const deficit = ENERGY.MIN_POPULATION - this.population;
    const rate = deficit > 0
      ? ENERGY.BASE_SPAWN_RATE * ENERGY.BELOW_MIN_REGEN_MULTIPLIER + deficit * ENERGY.DEFICIT_REGEN_PER_ITEM
      : ENERGY.BASE_SPAWN_RATE;
    this.regenBudget = Math.min(this.regenBudget + dt * rate, ENERGY.MAX_SPAWN_BUDGET);
    const queue = this.respawnQueue;
    while (this.regenBudget >= 1 && this.population < ENERGY.MAX_POPULATION) {
      let energy;
      if (queue.length && queue[queue.length - 1].respawnAt <= this.time) {
        energy = queue.pop();
      } else if (this.available.length) {
        energy = this.available.pop();
      } else {
        break;
      }
      this.spawnRandom(energy);
      this.hash.insert(energy);
      this.population++;
      this.regenBudget -= 1;
    }
  }

  /** Active items near a point. Callers must still check `active`. */
  query(x, y, radius, out) {
    return this.hash.query(x, y, radius, out);
  }

  findNearest(x, y, range) {
    const candidates = this.hash.query(x, y, range, this.scratch);
    let best = null;
    let bestDist = range * range;
    for (const energy of candidates) {
      if (!energy.active) continue;
      const d2 = distSq(x, y, energy.x, energy.y);
      if (d2 < bestDist) {
        best = energy;
        bestDist = d2;
      }
    }

    return best;
  }

  draw(ctx, bounds) {
    const items = this.hash.queryRect(bounds.left, bounds.top, bounds.right, bounds.bottom, this.visible);
    const time = this.time;
    for (const energy of items) {
      const spawnIn = clamp((time - energy.spawnedAt) / ENERGY.SPAWN_IN_TIME, 0, 1);
      const pulse = 1 + Math.sin(time * ENERGY.PULSE_SPEED + energy.phase) * ENERGY.PULSE_AMOUNT;
      const size = energy.radius * pulse * spawnIn * ENERGY.SPRITE_SCALE;
      if (size <= 0) continue;
      ctx.drawImage(foodSprite(energy.hue, energy.tier, ENERGY.SPRITE_SCALE), energy.x - size, energy.y - size, size * 2, size * 2);
    }
  }
}

function gaussian() {
  const u = Math.max(Number.EPSILON, Math.random());
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
