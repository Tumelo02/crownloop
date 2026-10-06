import { RIFT, STRATEGIC_LANDMARKS } from '../config.js';
import { distSq } from '../utils/math.js';
import { createStrategicLandmarks } from '../world/nodePlacement.js';
import { insideArena } from '../world/arena.js';
import { drawLandmarkBoundary, drawRiftGate } from '../render/StrategicLandmarkRenderer.js';

/**
 * The Teleporter: ONE physical gate per landmark, no paired exit. A creature with no open
 * trail that lingers at the open gate is recognised (RIFT.ACTIVATION_TIME), absorbed, and
 * reappears on the BORDER of its own territory where it helps: next to a rival's open trail
 * that is attacking its land (so it can cut it), otherwise at the edge facing open land, far
 * from the gate, turned outward.
 */
export class RiftSystem {
  constructor() {
    this.active = null;
    this.landmarks = [];
    this.spawnTimer = 0;
    this.usedCreatures = new Set();
  }

  reset(territory = null) {
    this.landmarks = [];
    this.usedCreatures.clear();
    this.spawnTimer = 0;
    this.active = null;
    if (!territory) return;
    const entries = createStrategicLandmarks(
      territory, STRATEGIC_LANDMARKS.RIFT, RIFT.ENTRY_PLACEMENT_RADIUS, RIFT.LANDMARK_MIN_DISTANCE,
    );
    for (const [i, entry] of entries.entries()) {
      const on = i % 2 === 0; // staggered: about half start ON, the rest switch on later
      this.landmarks.push({
        x: entry.x,
        y: entry.y,
        active: on,
        activeTimer: on ? RIFT.ACTIVE_DURATION * (0.4 + Math.random() * 0.6) : 0,
        cooldown: on ? 0 : RIFT.COOLDOWN * (0.2 + Math.random() * 0.8),
        charging: null, // creature currently being recognised
        chargeT: 0,
        enterFx: 0, // absorption flare timer
        arrivals: [], // materialization FX at destinations
      });
    }
    this.active = this.landmarks.find((gate) => gate && gate.active) || null;
  }

  /**
   * Each gate opens and closes on its own clock: open ACTIVE_DURATION, then shut COOLDOWN
   * (or USE_COOLDOWN right after a trip), then open again. Other landmarks never pause it.
   */
  update(dt) {
    if (!this.landmarks.length) return null;
    let event = null;
    const nowActive = [];
    for (const gate of this.landmarks) {
      {
        if (gate.active) {
          gate.activeTimer -= dt;
          if (gate.activeTimer <= 0) {
            gate.active = false;
            gate.cooldown = RIFT.COOLDOWN;
            gate.activeTimer = 0;
            gate.charging = null;
            gate.chargeT = 0;
            event = 'expired';
          }
        } else {
          gate.cooldown -= dt;
          if (gate.cooldown <= 0) {
            gate.active = true;
            gate.activeTimer = RIFT.ACTIVE_DURATION;
            gate.cooldown = 0;
            event = 'spawned';
          }
        }
      }
      if (gate.active) nowActive.push(gate);
      if (gate.enterFx > 0) gate.enterFx = Math.max(0, gate.enterFx - dt);
      for (let i = gate.arrivals.length - 1; i >= 0; i--) {
        gate.arrivals[i].t += dt;
        if (gate.arrivals[i].t >= RIFT.ARRIVAL_TIME) gate.arrivals.splice(i, 1);
      }
    }
    this.active = nowActive[0] || null;
    return event;
  }

  /**
   * Recognition → absorption → teleport. Called once per frame with the live
   * creature list; returns this frame's travelers for FX/audio.
   * @returns {Array<{creature:object, fromX:number, fromY:number, x:number, y:number}>}
   */
  traverse(creatures, territory, dt) {
    if (!this.landmarks.length) return [];
    this.usedCreatures.clear();
    const travelers = [];
    for (const gate of this.landmarks) {
      if (!gate.active) {
        gate.charging = null;
        gate.chargeT = 0;
        continue;
      }
      // The gate recognises one creature at a time: in range, no open tether.
      let candidate = null;
      for (const creature of creatures) {
        if (!creature.alive || this.usedCreatures.has(creature)) continue;
        if (territory.trailLength(creature.slot) > 0) continue;
        if (distSq(creature.x, creature.y, gate.x, gate.y) > RIFT.ENTRY_RADIUS ** 2) continue;
        candidate = creature;
        break;
      }
      if (!candidate) {
        gate.charging = null;
        gate.chargeT = 0;
        continue;
      }
      if (gate.charging !== candidate) {
        gate.charging = candidate;
        gate.chargeT = 0;
      }
      gate.chargeT += dt;
      if (gate.chargeT < RIFT.ACTIVATION_TIME) continue; // portal intensifies first

      const destination = this.findTeleportDestination(candidate, territory, gate, creatures);
      gate.charging = null;
      gate.chargeT = 0;
      if (!destination) continue; // nowhere safe inside its own domain: no entry

      const fromX = candidate.x;
      const fromY = candidate.y;
      candidate.x = destination.x;
      candidate.y = destination.y;
      // Face where the action is (the threat, or out of the territory), not back at the gate.
      candidate.moveAngle = destination.angle;
      candidate.heading = destination.angle;
      candidate.previousX = destination.x;
      candidate.previousY = destination.y;
      candidate.trail.length = 0;
      candidate.trailTimer = 0;
      candidate.isExposed = false;
      candidate.inSafeArea = territory.ownerAt(destination.x, destination.y) === candidate.slot;
      this.usedCreatures.add(candidate);
      gate.enterFx = RIFT.ENTER_FX_TIME;
      gate.arrivals.push({ x: destination.x, y: destination.y, t: 0 });
      travelers.push({ creature: candidate, fromX, fromY, x: destination.x, y: destination.y });
      // One trip, then the door shuts: no going back and forth.
      gate.active = false;
      gate.activeTimer = 0;
      gate.cooldown = RIFT.USE_COOLDOWN;
    }
    return travelers;
  }

  // ---------------------------------------------------------------- destination

  /**
   * A random valid arrival point fully inside the creature's own domain:
   * owned ground with clearance (not on the boundary), away from the rim, not
   * overlapping any body, and never on top of a gate. The arena has no static
   * obstacles, so clearance + body gap covers "safe to immediately control".
   * Unpredictable by design — never the same spot twice.
   */
  findTeleportDestination(creature, territory, gate, creatures) {
    return this.borderDestination(creature, territory, gate, creatures)
      || this.interiorDestination(creature, territory, gate, creatures);
  }

  /**
   * The useful arrival: on its own land at the border, (1) right next to the closest rival
   * trail attacking it, else (2) at the edge facing the most open land, far from the gate.
   */
  borderDestination(creature, territory, gate, creatures) {
    const slot = creature.slot;
    const { cellSize, cols, rows, totalCells, owners, playable } = territory;
    const border = [];
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let index = 0; index < totalCells; index++) {
      if (!playable[index] || owners[index] !== slot) continue;
      const col = index % cols;
      const row = (index - col) / cols;
      sumX += col;
      sumY += row;
      count++;
      const edge = (col > 0 && owners[index - 1] !== slot) || (col < cols - 1 && owners[index + 1] !== slot)
        || (row > 0 && owners[index - cols] !== slot) || (row < rows - 1 && owners[index + cols] !== slot);
      if (edge) border.push(index);
    }
    if (!border.length) return null;
    const cx = (sumX / count + 0.5) * cellSize;
    const cy = (sumY / count + 0.5) * cellSize;
    const centre = (index) => {
      const col = index % cols;
      return { x: (col + 0.5) * cellSize, y: ((index - col) / cols + 0.5) * cellSize };
    };

    // (1) An attack: the nearest point of any rival's open trail to our border.
    let best = null;
    let bestD = RIFT.THREAT_RANGE ** 2;
    for (const other of creatures) {
      if (other === creature || !other.alive) continue;
      const path = territory.trailPaths[other.slot];
      if (!path || path.length < 4) continue;
      for (let i = 0; i < path.length; i += 3) {
        const pt = path[i];
        for (let k = 0; k < border.length; k += 2) {
          const c = centre(border[k]);
          const d = (c.x - pt.x) ** 2 + (c.y - pt.y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { cell: border[k], tx: pt.x, ty: pt.y };
          }
        }
      }
    }
    if (best) {
      const spot = this.safeSpotNear(best.cell, best.tx, best.ty, creature, territory, creatures);
      if (spot) return { ...spot, angle: Math.atan2(best.ty - spot.y, best.tx - spot.x), threat: true };
    }

    // (2) No attack: the edge with the most open land beyond it, far from the gate.
    let pick = null;
    let pickScore = -Infinity;
    const tries = Math.min(border.length, 90);
    for (let t = 0; t < tries; t++) {
      const index = border[(Math.random() * border.length) | 0];
      const c = centre(index);
      const fromGate = Math.hypot(c.x - gate.x, c.y - gate.y);
      if (fromGate < RIFT.BORDER_GATE_MIN || !insideArena(c.x, c.y, RIFT.TELEPORT_EDGE_MARGIN)) continue;
      const ox = c.x - cx;
      const oy = c.y - cy;
      const len = Math.hypot(ox, oy) || 1;
      // Open land: unowned cells a little way outward from this edge.
      let open = 0;
      for (let step = 2; step <= 6; step += 2) {
        if (territory.ownerAt(c.x + (ox / len) * step * cellSize, c.y + (oy / len) * step * cellSize) === 0) open++;
      }
      const score = open * 1000 + Math.min(fromGate, 3000) * 0.2 + Math.random() * 50;
      if (score > pickScore) {
        pickScore = score;
        pick = { index, x: c.x, y: c.y, angle: Math.atan2(oy, ox) };
      }
    }
    if (!pick) return null;
    const spot = this.safeSpotNear(pick.index, pick.x + Math.cos(pick.angle) * 200,
      pick.y + Math.sin(pick.angle) * 200, creature, territory, creatures);
    return spot ? { ...spot, angle: pick.angle, threat: false } : null;
  }

  /**
   * A safe arrival on its own ground near a border cell: the owned cell within a few cells
   * that keeps ARRIVAL_CLEARANCE of owned ground and a body gap, closest to (tx, ty).
   */
  safeSpotNear(cell, tx, ty, creature, territory, creatures) {
    const { cellSize, cols, rows, owners, playable } = territory;
    const slot = creature.slot;
    const col0 = cell % cols;
    const row0 = (cell - col0) / cols;
    let best = null;
    let bestD = Infinity;
    for (let dr = -4; dr <= 4; dr++) {
      for (let dc = -4; dc <= 4; dc++) {
        const col = col0 + dc;
        const row = row0 + dr;
        if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
        const index = row * cols + col;
        if (!playable[index] || owners[index] !== slot) continue;
        const x = (col + 0.5) * cellSize;
        const y = (row + 0.5) * cellSize;
        if (!insideArena(x, y, RIFT.TELEPORT_EDGE_MARGIN)) continue;
        if (!this.ownedClearance(x, y, slot, territory, RIFT.ARRIVAL_CLEARANCE)) continue;
        if (this.nearGate(x, y, 1.4) || !this.bodyGap(x, y, creature, creatures)) continue;
        const d = (x - tx) ** 2 + (y - ty) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    return best;
  }

  /** Fallback (tiny or crowded territory): a safe point inside its own land. */
  interiorDestination(creature, territory, gate, creatures) {
    const slot = creature.slot;
    const { cellSize, cols, totalCells, owners, playable } = territory;
    // Collect the slot's owned cells (one pass; teleports are rare events).
    const owned = [];
    for (let index = 0; index < totalCells; index++) {
      if (playable[index] && owners[index] === slot) owned.push(index);
    }
    if (!owned.length) return null;

    const point = { x: 0, y: 0 };
    const toPoint = (index, jitter) => {
      const col = index % cols;
      const row = (index - col) / cols;
      point.x = (col + 0.5) * cellSize + (jitter ? (Math.random() - 0.5) * cellSize * 0.6 : 0);
      point.y = (row + 0.5) * cellSize + (jitter ? (Math.random() - 0.5) * cellSize * 0.6 : 0);
    };
    const pickCell = () => owned[(Math.random() * owned.length) | 0];

    // Preferred: full clearance from the territory edge (never on the boundary).
    for (let attempt = 0; attempt < RIFT.TELEPORT_ATTEMPTS; attempt++) {
      toPoint(pickCell(), true);
      const clearance = attempt < RIFT.TELEPORT_ATTEMPTS / 2
        ? RIFT.TELEPORT_CLEARANCE : RIFT.TELEPORT_CLEARANCE * 0.55;
      if (this.validArrival(point, slot, creature, territory, clearance, creatures, 2.2)) {
        return { x: point.x, y: point.y, angle: creature.moveAngle };
      }
    }
    // Fallback (very small domains): any owned cell centre that stays safe.
    for (let attempt = 0; attempt < 24; attempt++) {
      toPoint(pickCell(), false);
      if (!insideArena(point.x, point.y, RIFT.TELEPORT_EDGE_MARGIN)) continue;
      if (this.nearGate(point.x, point.y, 1.4)) continue;
      if (!this.bodyGap(point.x, point.y, creature, creatures)) continue;
      return { x: point.x, y: point.y, angle: creature.moveAngle };
    }
    return null;
  }

  validArrival(point, slot, creature, territory, clearance, creatures, gateRange) {
    if (!insideArena(point.x, point.y, RIFT.TELEPORT_EDGE_MARGIN)) return false;
    if (!this.ownedClearance(point.x, point.y, slot, territory, clearance)) return false;
    if (this.nearGate(point.x, point.y, gateRange)) return false;
    if (!this.bodyGap(point.x, point.y, creature, creatures)) return false;
    return true;
  }

  /** True when a disc of `radius` around (x, y) is entirely this slot's playable ground. */
  ownedClearance(x, y, slot, territory, radius) {
    const { cellSize, cols, rows, owners, playable } = territory;
    if (!insideArena(x, y, radius + 40)) return false;
    const r2 = radius * radius;
    const minCol = Math.max(0, Math.floor((x - radius) / cellSize));
    const maxCol = Math.min(cols - 1, Math.floor((x + radius) / cellSize));
    const minRow = Math.max(0, Math.floor((y - radius) / cellSize));
    const maxRow = Math.min(rows - 1, Math.floor((y + radius) / cellSize));
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const index = row * cols + col;
        const left = col * cellSize;
        const top = row * cellSize;
        const dx = Math.max(left - x, 0, x - (left + cellSize));
        const dy = Math.max(top - y, 0, y - (top + cellSize));
        if (dx * dx + dy * dy > r2) continue; // cell lies outside the disc
        if (!playable[index] || owners[index] !== slot) return false;
      }
    }
    return true;
  }

  /** Keep arrivals away from every gate (distance in units of ENTRY_RADIUS). */
  nearGate(x, y, units) {
    const minSq = (RIFT.ENTRY_RADIUS * units) ** 2;
    for (const other of this.landmarks) {
      if (distSq(x, y, other.x, other.y) < minSq) return true;
    }
    return false;
  }

  /** Clear space around other bodies so the arrival is immediately controllable. */
  bodyGap(x, y, creature, creatures) {
    for (const other of creatures) {
      if (other === creature || !other.alive) continue;
      const gap = RIFT.TELEPORT_CREATURE_GAP + creature.radius + other.radius;
      if (distSq(x, y, other.x, other.y) < gap * gap) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- rendering

  draw(ctx, time, zoom, bounds) {
    if (!this.landmarks.length) return;
    for (const gate of this.landmarks) {
      const reach = (gate.claimT > 0 ? RIFT.CLAIM_RADIUS : 0) + 300;
      if (bounds && (gate.x + reach < bounds.left || gate.x - reach > bounds.right
        || gate.y + reach < bounds.top || gate.y - reach > bounds.bottom)) continue;
      drawRiftGate(ctx, gate, time);
      drawLandmarkBoundary(ctx, gate, time, RIFT.CLAIM_RADIUS);
    }
  }

  /** No ground area: the Teleporter is a door (its owner is alerted when it opens). */
  drawGround() {}

  /**
   * The standing structures, for the depth-sorted pass with the creatures: each one is
   * drawn in order of its base (y), so creatures walk behind and in front of it.
   */
  collectStructures(bounds, out) {
    for (const lm of this.landmarks) {
      if (this.inView(lm, bounds)) out.push({ lm, y: lm.y, draw: drawRiftGate });
    }
  }

  inView(lm, bounds) {
    const reach = (lm.claimT > 0 ? RIFT.CLAIM_RADIUS : 0) + 300;
    return !bounds || !(lm.x + reach < bounds.left || lm.x - reach > bounds.right
      || lm.y + reach < bounds.top || lm.y - reach > bounds.bottom);
  }
}
