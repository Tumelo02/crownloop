import { CLAIM_BEACON, STRATEGIC_LANDMARKS, TERRITORY } from '../config.js';
import { createStrategicLandmarks } from '../world/nodePlacement.js';
import { drawClaimBeacon, drawLandmarkBoundary } from '../render/StrategicLandmarkRenderer.js';


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
  /** Bonus Towers are always ON: what matters is who owns one. */
  update() {
    for (const beacon of this.landmarks) beacon.active = true;
    this.active = this.landmarks[0] || null;
    return null;
  }

  /** True when this slot owns at least one Bonus Tower. */
  owns(slot) {
    return slot > 0 && this.landmarks.some((beacon) => beacon.ownerSlot === slot);
  }

  /**
   * Owning a Bonus Tower doubles the score of every capture you make, anywhere on the map
   * (owning two is still double). Returns the extra cells' worth of score.
   */
  recordCapture(capture) {
    if (!capture.cells.length || !this.owns(capture.slot)) return 0;
    const extraValue = capture.count * (CLAIM_BEACON.CAPTURE_VALUE_MULTIPLIER - 1);
    this.bonusCounts[capture.slot] += extraValue;
    return extraValue;
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

  /** No ground zone: the bonus works everywhere for the owner. */
  drawGround() {}

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
