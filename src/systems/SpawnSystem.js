import { ENEMY, PLAYER, POWER_UPS, WORLD } from '../config.js';
import { PowerUp, PowerUpType } from '../entities/PowerUp.js';
import { distSq, randRange } from '../utils/math.js';
import { clampToArena, randomArenaPoint } from '../world/arena.js';

/**
 * Decides where creatures and power-ups appear.
 * Game owns the lists; the Roster owns respawn timing.
 */
export class SpawnSystem {
  /**
   * @param {object} hooks
   * @param {() => import('../entities/Creature.js').Creature | null} hooks.getPlayer
   * @param {() => import('../entities/Creature.js').Creature[]} hooks.getCreatures
   * @param {(x: number, y: number) => number} hooks.ownerAt territory owner slot at a point
   * @param {(powerUp: PowerUp) => void} hooks.addPowerUp
   * @param {() => number} hooks.countPowerUps
   */
  constructor(hooks) {
    this.hooks = hooks;
    this.powerUpTimer = 0;
    this.point = { x: 0, y: 0 };
  }

  reset() {
    this.powerUpTimer = randRange(POWER_UPS.SPAWN_INTERVAL_MIN, POWER_UPS.SPAWN_INTERVAL_MAX);
  }

  update(dt) {
    this.powerUpTimer -= dt;
    if (this.powerUpTimer <= 0) {
      this.powerUpTimer = randRange(POWER_UPS.SPAWN_INTERVAL_MIN, POWER_UPS.SPAWN_INTERVAL_MAX);
      if (this.hooks.countPowerUps() < POWER_UPS.MAX_ACTIVE) {
        const p = this.powerUpPoint();
        this.hooks.addPowerUp(new PowerUp(this.randomPowerUpType(), p.x, p.y));
      }
    }
  }

  randomPowerUpType() {
    const entries = Object.entries(POWER_UPS.SPAWN_WEIGHTS);
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * total;
    for (const [type, weight] of entries) {
      roll -= weight;
      if (roll < 0) return type;
    }
    return PowerUpType.SURGE;
  }

  /** Random point in a ring around (x, y), kept inside the world. */
  pointNear(x, y, minDist, maxDist, margin = ENEMY.SPAWN_MARGIN) {
    const angle = Math.random() * Math.PI * 2;
    const dist = randRange(minDist, maxDist);
    const p = this.point;
    return clampToArena(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, margin, p);
  }

  /**
   * Rival spawn point: often somewhere in the player's region (off-screen but
   * reachable), otherwise anywhere. Never on top of the player.
   */
  enemyPoint(regionChance = ENEMY.REGION_SPAWN_CHANCE, minDistance = ENEMY.SPAWN_SAFE_DISTANCE) {
    const player = this.hooks.getPlayer();
    const margin = ENEMY.SPAWN_MARGIN;
    const safeSq = minDistance * minDistance;
    const p = this.point;
    const nearPlayer = player && player.alive && Math.random() < regionChance;
    for (let attempt = 0; attempt < ENEMY.SPAWN_ATTEMPTS; attempt++) {
      if (nearPlayer) {
        this.pointNear(player.x, player.y, minDistance, Math.max(minDistance, ENEMY.REGION_SPAWN_MAX));
      } else {
        randomArenaPoint(margin, p);
      }
      if (!player || !player.alive || distSq(p.x, p.y, player.x, player.y) >= safeSq) break;
    }
    return p;
  }

  /**
   * Where a fresh creature can safely (re)join: away from rivals, preferably on
   * unclaimed land. Best of several random tries.
   */
  playerPoint() {
    const creatures = this.hooks.getCreatures();
    const margin = PLAYER.SPAWN_MARGIN;
    let bestX = WORLD.WIDTH / 2;
    let bestY = WORLD.HEIGHT / 2;
    let bestScore = -Infinity;
    for (let attempt = 0; attempt < PLAYER.SPAWN_ATTEMPTS; attempt++) {
      const { x, y } = randomArenaPoint(margin);
      let nearest = Infinity;
      for (const c of creatures) {
        if (!c.alive || c.isPlayer) continue;
        nearest = Math.min(nearest, Math.sqrt(distSq(x, y, c.x, c.y)));
      }
      const score = Math.min(nearest, PLAYER.SPAWN_THREAT_DISTANCE * 2)
        + (this.hooks.ownerAt(x, y) === 0 ? PLAYER.SPAWN_THREAT_DISTANCE : 0);
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
    this.point.x = bestX;
    this.point.y = bestY;
    return this.point;
  }

  /** Surge appears within reach of the player so it actually gets found and tested. */
  powerUpPoint() {
    const player = this.hooks.getPlayer();
    if (player && player.alive) {
      return this.pointNear(player.x, player.y, POWER_UPS.SPAWN_NEAR_PLAYER_MIN, POWER_UPS.SPAWN_NEAR_PLAYER_MAX);
    }
    const margin = ENEMY.SPAWN_MARGIN;
    return randomArenaPoint(margin, this.point);
  }
}
