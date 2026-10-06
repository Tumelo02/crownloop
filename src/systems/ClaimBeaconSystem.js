import { CLAIM_BEACON, STRATEGIC_LANDMARKS, TERRITORY } from '../config.js';
import { createStrategicLandmarks } from '../world/nodePlacement.js';
import { hslToRgb } from '../utils/math.js';
import { drawClaimBeacon, drawLandmarkBoundary, drawLandmarkZone } from '../render/StrategicLandmarkRenderer.js';

const BEACON_RGB = hslToRgb(CLAIM_BEACON.HUE, 0.85, 0.6);

/**
 * Claim Beacons are permanent strategic landmarks; they remain in the world and
 * are placed once at the start of each Galaxy. Their capture bonus is preserved,
 * but the landform itself stays fixed for the full match.
 */
export class ClaimBeaconSystem {
  constructor() {
    this.active = null;
    this.landmarks = [];
    this.spawnTimer = 0;
    this.bonusCounts = new Float64Array(TERRITORY.MAX_SLOTS);
  }

  reset(territory = null) {
    this.landmarks = [];
    if (territory) {
      for (const [i, point] of createStrategicLandmarks(
        territory,
        STRATEGIC_LANDMARKS.CLAIM_BEACON,
        CLAIM_BEACON.INFLUENCE_RADIUS,
        CLAIM_BEACON.LANDMARK_MIN_DISTANCE,
      ).entries()) {
        const on = i % 2 === 0; // staggered: about half start ON, the rest switch on later
        this.landmarks.push({
          ...point, active: on,
          remaining: on ? CLAIM_BEACON.ACTIVE_DURATION * (0.4 + Math.random() * 0.6) : 0,
          cooldown: on ? 0 : CLAIM_BEACON.COOLDOWN * (0.2 + Math.random() * 0.8),
        });
      }
    }
    this.active = this.landmarks.find((beacon) => beacon && beacon.active) || null;
    this.bonusCounts.fill(0);
    this.spawnTimer = 0;
  }

  /** Each tower cycles ON/OFF on its own clock (other landmarks never pause it). */
  update(dt) {
    if (!this.landmarks.length) return null;
    let event = null;
    const activeNow = [];
    for (const beacon of this.landmarks) {
      if (beacon.active) {
        beacon.remaining -= dt;
        if (beacon.remaining <= 0) {
          beacon.active = false;
          beacon.cooldown = CLAIM_BEACON.COOLDOWN;
          beacon.remaining = 0;
          event = 'expired';
        }
      } else {
        beacon.cooldown -= dt;
        if (beacon.cooldown <= 0) {
          beacon.active = true;
          beacon.remaining = CLAIM_BEACON.ACTIVE_DURATION;
          beacon.cooldown = 0;
          event = 'spawned';
        }
      }
      if (beacon.active) activeNow.push(beacon);
    }
    this.active = activeNow[0] || null;
    return event;
  }

  recordCapture(capture, territory, localSlot) {
    if (!this.landmarks.length || !capture.cells.length) return 0;
    const radiusSq = CLAIM_BEACON.INFLUENCE_RADIUS ** 2;
    let totalExtra = 0;
    for (const beacon of this.landmarks) {
      if (!beacon.active) continue; // the bonus only works while the tower is online
      let qualifying = 0;
      for (const index of capture.cells) {
        const col = index % territory.cols;
        const row = (index - col) / territory.cols;
        const x = (col + 0.5) * territory.cellSize;
        const y = (row + 0.5) * territory.cellSize;
        const dx = x - beacon.x;
        const dy = y - beacon.y;
        if (dx * dx + dy * dy <= radiusSq) qualifying++;
      }
      if (!qualifying) continue;
      const extraValue = qualifying * (CLAIM_BEACON.CAPTURE_VALUE_MULTIPLIER - 1); // same for everyone
      this.bonusCounts[capture.slot] += extraValue;
      totalExtra += extraValue;
    }
    return totalExtra;
  }

  /** Delegates to the shared pseudo-3D landmark renderer (structure + claimed boundary). */
  draw(ctx, time, zoom, bounds) {
    if (!this.landmarks.length) return;
    for (const beacon of this.landmarks) {
      const reach = (beacon.claimT > 0 ? CLAIM_BEACON.CLAIM_RADIUS : 0) + 300;
      if (bounds && (beacon.x + reach < bounds.left || beacon.x - reach > bounds.right
        || beacon.y + reach < bounds.top || beacon.y - reach > bounds.bottom)) continue;
      drawClaimBeacon(ctx, beacon, time);
      drawLandmarkBoundary(ctx, beacon, time, CLAIM_BEACON.CLAIM_RADIUS);
    }
  }

  /** Ground layer: the double-value area (exact bonus radius), only while the tower is online. */
  drawGround(ctx, time, zoom, bounds) {
    for (const lm of this.landmarks) {
      if (!this.inView(lm, bounds)) continue;
      drawLandmarkZone(ctx, lm, time, CLAIM_BEACON.INFLUENCE_RADIUS, lm.active, BEACON_RGB);
    }
  }

  /**
   * The standing structures, for the depth-sorted pass with the creatures: each one is
   * drawn in order of its base (y), so creatures walk behind and in front of it.
   */
  collectStructures(bounds, out) {
    for (const lm of this.landmarks) {
      if (this.inView(lm, bounds)) out.push({ lm, y: lm.y, draw: drawClaimBeacon });
    }
  }

  inView(lm, bounds) {
    const reach = CLAIM_BEACON.INFLUENCE_RADIUS + 80;
    return !bounds || !(lm.x + reach < bounds.left || lm.x - reach > bounds.right
      || lm.y + reach < bounds.top || lm.y - reach > bounds.bottom);
  }
}
