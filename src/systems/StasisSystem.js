import { STASIS, STRATEGIC_LANDMARKS } from '../config.js';
import { distSq } from '../utils/math.js';
import { createStrategicLandmarks } from '../world/nodePlacement.js';
import { drawLandmarkBoundary, drawLandmarkZone, drawStasisStructure, drawSnowField } from '../render/StrategicLandmarkRenderer.js';

const SLOW_RGB = [120, 175, 255];

/** Stasis landmarks remain fixed in the world; once captured, the slow field cycles on and off. */
export class StasisSystem {
  constructor() {
    this.active = null;
    this.landmarks = [];
    this.spawnTimer = 0;
  }

  reset(territory = null) {
    this.landmarks = [];
    if (territory) {
      for (const point of createStrategicLandmarks(
        territory,
        STRATEGIC_LANDMARKS.STASIS,
        STASIS.SLOW_RADIUS,
        STASIS.LANDMARK_MIN_DISTANCE,
      )) {
        // Off until someone captures it (see update).
        this.landmarks.push({ ...point, active: false, remaining: 0, cooldown: 0 });
      }
    }
    this.active = this.landmarks.find((field) => field && field.active) || null;
    this.spawnTimer = 0;
  }

  /**
   * A tower does nothing until captured: it switches ON the moment it has an owner, then
   * cycles ON/OFF on its own clock. Losing its owner shuts it off.
   */
  update(dt, territory, creatures) {
    if (!this.landmarks.length) return null;

    let event = null;
    const nowActive = [];
    for (const field of this.landmarks) {
      if (!field.ownerSlot) {
        if (field.active) event = 'expired';
        field.active = false;
        field.remaining = 0;
        field.cooldown = 0;
      } else if (field.active) {
        field.remaining -= dt;
        if (field.remaining <= 0) {
          field.active = false;
          field.cooldown = STASIS.COOLDOWN;
          field.remaining = 0;
          event = 'expired';
        }
      } else {
        field.cooldown -= dt;
        if (field.cooldown <= 0) {
          field.active = true;
          field.remaining = STASIS.ACTIVE_DURATION;
          field.cooldown = 0;
          event = 'spawned';
        }
      }
      if (field.active) nowActive.push(field);
    }
    this.active = nowActive.find((field) => field && field.active) || null;
    this.apply(creatures, territory);
    return event;
  }

  /**
   * Everyone inside an ON Slow Tower's ring moves slower, except the tower's owner. The tower
   * counts as yours the moment it stands on your land (no wait for the claim to register).
   */
  apply(creatures, territory = null) {
    const radiusSquared = STASIS.SLOW_RADIUS ** 2;
    for (const field of this.landmarks) field.landOwner = territory ? territory.ownerAt(field.x, field.y) : 0;
    for (const creature of creatures) {
      let affected = false;
      for (const field of this.landmarks) {
        if (!field.active || !field.ownerSlot || !creature.alive) continue;
        if (creature.slot === field.ownerSlot || creature.slot === field.landOwner) continue;
        if (distSq(creature.x, creature.y, field.x, field.y) <= radiusSquared) {
          affected = true;
          break;
        }
      }
      creature.environmentSpeedMultiplier = affected ? STASIS.SPEED_MULTIPLIER : 1;
    }
  }

  /** Delegates to the shared pseudo-3D landmark renderer (structure + claimed boundary). */
  draw(ctx, time, zoom, bounds) {
    if (!this.landmarks.length) return;
    for (const field of this.landmarks) {
      const reach = (field.claimT > 0 ? STASIS.CLAIM_RADIUS : 0) + 300;
      if (bounds && (field.x + reach < bounds.left || field.x - reach > bounds.right
        || field.y + reach < bounds.top || field.y - reach > bounds.bottom)) continue;
      drawStasisStructure(ctx, field, time);
      drawLandmarkBoundary(ctx, field, time, STASIS.CLAIM_RADIUS);
    }
  }

  /** Ground layer: the slow field (exact slow radius), only while it is active. */
  drawGround(ctx, time, zoom, bounds) {
    for (const lm of this.landmarks) {
      if (!this.inView(lm, bounds)) continue;
      drawLandmarkZone(ctx, lm, time, STASIS.SLOW_RADIUS, lm.active, SLOW_RGB);
      if (lm.active) drawSnowField(ctx, lm, time, STASIS.SLOW_RADIUS);
    }
  }

  /**
   * The standing structures, for the depth-sorted pass with the creatures: each one is
   * drawn in order of its base (y), so creatures walk behind and in front of it.
   */
  collectStructures(bounds, out) {
    for (const lm of this.landmarks) {
      if (this.inView(lm, bounds)) out.push({ lm, y: lm.y, draw: drawStasisStructure });
    }
  }

  inView(lm, bounds) {
    const reach = STASIS.SLOW_RADIUS + 80;
    return !bounds || !(lm.x + reach < bounds.left || lm.x - reach > bounds.right
      || lm.y + reach < bounds.top || lm.y - reach > bounds.bottom);
  }
}
