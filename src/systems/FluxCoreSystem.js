import { FLUX_CORE, STRATEGIC_LANDMARKS } from '../config.js';
import { createStrategicLandmarks } from '../world/nodePlacement.js';
import { drawFluxCore, drawLandmarkBoundary } from '../render/StrategicLandmarkRenderer.js';

/** Flux Core landmarks are static world features; once captured, they pulse energy into the owner's boost. */
export class FluxCoreSystem {
  constructor() {
    this.active = null;
    this.landmarks = [];
    this.spawnTimer = 0;
    this.lastEmission = 0;
    this.ownerPulses = []; // owner slots whose boost this frame's pulses refill
  }

  reset(territory = null) {
    this.ownerPulses = [];
    this.landmarks = [];
    if (territory) {
      for (const point of createStrategicLandmarks(
        territory,
        STRATEGIC_LANDMARKS.FLUX_CORE,
        FLUX_CORE.BURST_RADIUS,
        FLUX_CORE.LANDMARK_MIN_DISTANCE,
      )) {
        // Off until someone captures it (see update).
        this.landmarks.push({ ...point, active: false, remaining: 0, cooldown: 0, pulseTimer: 0 });
      }
    }
    this.active = this.landmarks.find((core) => core && core.active) || null;
    this.lastEmission = 0;
    this.spawnTimer = 0;
  }

  /**
   * A core does nothing until captured: it switches ON the moment it has an owner, then
   * cycles ON/OFF on its own clock. Losing its owner shuts it off.
   */
  update(dt, territory, energy) {
    this.ownerPulses.length = 0;
    if (!this.landmarks.length) return null;
    let event = null;
    const activeNow = [];
    for (const core of this.landmarks) {
      if (!core.ownerSlot) {
        if (core.active) event = 'expired';
        core.active = false;
        core.remaining = 0;
        core.cooldown = 0;
      } else if (core.active) {
        core.remaining -= dt;
        core.pulseTimer -= dt;
        if (core.remaining <= 0) {
          core.active = false;
          core.cooldown = FLUX_CORE.COOLDOWN;
          core.remaining = 0;
          event = 'expired';
        } else if (core.pulseTimer <= 0) {
          core.pulseTimer += FLUX_CORE.PULSE_INTERVAL;
          // The pulse goes straight into its owner's boost meter.
          this.ownerPulses.push(core.ownerSlot);
          this.lastEmission = 0;
          event = 'pulse';
        }
      } else {
        core.cooldown -= dt;
        if (core.cooldown <= 0) {
          core.active = true;
          core.remaining = FLUX_CORE.ACTIVE_DURATION;
          core.pulseTimer = FLUX_CORE.FIRST_PULSE_DELAY + ((core.x + core.y) * 0.001 % 1.5);
          core.cooldown = 0;
          event = 'spawned';
        }
      }
      if (core.active) activeNow.push(core);
    }
    this.active = activeNow[0] || null;
    return event;
  }

  /** Delegates to the shared pseudo-3D landmark renderer (structure + claimed boundary). */
  draw(ctx, time, zoom, bounds) {
    if (!this.landmarks.length) return;
    for (const core of this.landmarks) {
      const reach = (core.claimT > 0 ? FLUX_CORE.CLAIM_RADIUS : 0) + 300;
      if (bounds && (core.x + reach < bounds.left || core.x - reach > bounds.right
        || core.y + reach < bounds.top || core.y - reach > bounds.bottom)) continue;
      drawFluxCore(ctx, core, time);
      drawLandmarkBoundary(ctx, core, time, FLUX_CORE.CLAIM_RADIUS);
    }
  }

  /** No ground area: the Energy Core's effect is the energy it throws out, not a zone. */
  drawGround() {}

  /**
   * The standing structures, for the depth-sorted pass with the creatures: each one is
   * drawn in order of its base (y), so creatures walk behind and in front of it.
   */
  collectStructures(bounds, out) {
    for (const lm of this.landmarks) {
      if (this.inView(lm, bounds)) out.push({ lm, y: lm.y, draw: drawFluxCore });
    }
  }

  inView(lm, bounds) {
    const reach = (lm.claimT > 0 ? FLUX_CORE.CLAIM_RADIUS : 0) + 300;
    return !bounds || !(lm.x + reach < bounds.left || lm.x - reach > bounds.right
      || lm.y + reach < bounds.top || lm.y - reach > bounds.bottom);
  }
}
