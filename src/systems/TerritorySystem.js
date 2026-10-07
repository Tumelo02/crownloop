import { TERRITORY } from '../config.js';
import { drawTrailAccents } from '../render/elementalTrail.js';
import { organicPattern } from '../render/galaxyAtmosphere.js';
import { TerritoryShapes } from '../render/territoryShapes.js';
import { gameplayProfile } from '../progression/elementProfiles.js';

/** Sol's advantage is presentation for its owner: its own land reads a little brighter. */
function characterVisibility(character, isPlayer) {
  return isPlayer ? gameplayProfile(character.element).territoryVisibility : 1;
}
import { clamp, hslToRgb } from '../utils/math.js';
import { insideArena } from '../world/arena.js';
import { currentFloor } from '../render/floorThemes.js';

const NO_OWNER = 0;

function pointSegmentDistanceSquared(x, y, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0
    ? clamp(((x - x0) * dx + (y - y0) * dy) / lengthSquared, 0, 1)
    : 0;
  const nearestX = x0 + dx * t;
  const nearestY = y0 + dy * t;
  return (x - nearestX) ** 2 + (y - nearestY) ** 2;
}

function closestSegmentPoints(x0, y0, x1, y1, x2, y2, x3, y3, out) {
  const ux = x1 - x0;
  const uy = y1 - y0;
  const vx = x3 - x2;
  const vy = y3 - y2;
  const wx = x0 - x2;
  const wy = y0 - y2;
  const a = ux * ux + uy * uy;
  const b = ux * vx + uy * vy;
  const c = vx * vx + vy * vy;
  const d = ux * wx + uy * wy;
  const e = vx * wx + vy * wy;
  const denominator = a * c - b * b;
  let s;
  let t;

  if (a <= 1e-9 && c <= 1e-9) {
    s = 0;
    t = 0;
  } else if (a <= 1e-9) {
    s = 0;
    t = clamp(e / c, 0, 1);
  } else if (c <= 1e-9) {
    t = 0;
    s = clamp(-d / a, 0, 1);
  } else {
    s = denominator > 1e-9 ? clamp((b * e - c * d) / denominator, 0, 1) : clamp(-d / a, 0, 1);
    t = (b * s + e) / c;
    if (t < 0) {
      t = 0;
      s = clamp(-d / a, 0, 1);
    } else if (t > 1) {
      t = 1;
      s = clamp((b - d) / a, 0, 1);
    }
  }

  const ax = x0 + ux * s;
  const ay = y0 + uy * s;
  const bx = x2 + vx * t;
  const by = y2 + vy * t;
  out.x = (ax + bx) * 0.5;
  out.y = (ay + by) * 0.5;
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

function segmentRectEntryT(x0, y0, x1, y1, left, top, right, bottom) {
  let entry = 0;
  let exit = 1;
  for (const [start, delta, min, max] of [
    [x0, x1 - x0, left, right],
    [y0, y1 - y0, top, bottom],
  ]) {
    if (delta === 0) {
      if (start < min || start > max) return null;
      continue;
    }
    let near = (min - start) / delta;
    let far = (max - start) / delta;
    if (near > far) [near, far] = [far, near];
    entry = Math.max(entry, near);
    exit = Math.min(exit, far);
    if (entry > exit) return null;
  }
  return entry >= 0 && entry <= 1 ? entry : null;
}

/**
 * Grid-based territory with loop capture. Each cell stores the slot id of its owner.
 *
 * The rule is the same for every creature (player, AI, future remote players):
 *   leave your land → your trail marks the path → reconnect with your land →
 *   the trail and everything it encloses becomes yours (including rival land).
 * The flood fill runs once per reconnection, limited to the trail's bounding box.
 *
 * Land a creature has held for TERRITORY.SETTLE_TIME is its "home": standing there
 * sets `creature.onHomeTurf` for safe-zone presentation and AI behavior.
 *
 * Territory stats and leaderboard percentages measure shares of the playable arena.
 * The leaderboard may give the local player's display value extra weight, funded only
 * from unclaimed area; neither representation changes ownership or map geometry.
 */
export class TerritorySystem {
  constructor(worldWidth, worldHeight, cellSize = TERRITORY.CELL_SIZE) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldWidth / cellSize);
    this.rows = Math.ceil(worldHeight / cellSize);
    this.totalCells = this.cols * this.rows;
    this.owners = new Uint8Array(this.totalCells);
    // The arena is a disc: only cells whose centre sits inside the rim (by half a cell) can be
    // owned. Cells outside count as open space for the capture fill, like the old square edge.
    this.playable = new Uint8Array(this.totalCells);
    this.playableCount = 0; // the whole planet, in cells (the 100% of domain %)
    for (let i = 0; i < this.totalCells; i++) {
      const col = i % this.cols;
      const row = (i - col) / this.cols;
      this.playable[i] = insideArena((col + 0.5) * cellSize, (row + 0.5) * cellSize, cellSize * 0.5) ? 1 : 0;
      this.playableCount += this.playable[i];
    }
    this.claimedAt = new Float32Array(this.totalCells);
    this.counts = new Uint32Array(TERRITORY.MAX_SLOTS);
    // Running sums of owned cell coordinates → territory centroid per slot.
    this.sumCol = new Float64Array(TERRITORY.MAX_SLOTS);
    this.sumRow = new Float64Array(TERRITORY.MAX_SLOTS);
    // Per-slot box around every cell the slot has owned since the last reset. It only
    // grows (never shrinks), so it always contains the slot's land: the capture fill can be
    // limited to it (plus the tether) and stay exact.
    this.boxC0 = new Int32Array(TERRITORY.MAX_SLOTS);
    this.boxC1 = new Int32Array(TERRITORY.MAX_SLOTS);
    this.boxR0 = new Int32Array(TERRITORY.MAX_SLOTS);
    this.boxR1 = new Int32Array(TERRITORY.MAX_SLOTS);
    this.claimed = 0;
    this.fillStyles = new Array(TERRITORY.MAX_SLOTS).fill(null);
    this.borderStyles = new Array(TERRITORY.MAX_SLOTS).fill(null);
    this.flashStyles = new Array(TERRITORY.MAX_SLOTS).fill(null);
    this.trailStyles = new Array(TERRITORY.MAX_SLOTS).fill(null);
    this.trailIdentityStyles = new Array(TERRITORY.MAX_SLOTS).fill(null);
    this.trailAccentStyles = new Array(TERRITORY.MAX_SLOTS).fill(null);
    this.trailAccentColors = new Array(TERRITORY.MAX_SLOTS).fill(null);
    this.rgb = new Array(TERRITORY.MAX_SLOTS).fill(null);
    this.isPlayerSlot = new Uint8Array(TERRITORY.MAX_SLOTS);
    this.kingSlot = NO_OWNER;
    // Open trails: ordered cells + a set for O(1) "already on my trail?".
    this.trails = Array.from({ length: TERRITORY.MAX_SLOTS }, () => []);
    this.trailSets = Array.from({ length: TERRITORY.MAX_SLOTS }, () => new Set());
    this.trailPaths = Array.from({ length: TERRITORY.MAX_SLOTS }, () => []);
    this.trailWarnings = new Uint8Array(TERRITORY.MAX_SLOTS);
    // Scratch buffers for the capture flood fill (allocated once).
    this.fillMark = new Uint8Array(this.totalCells);
    this.fillQueue = new Int32Array(this.totalCells);
    this.captures = []; // captures that happened during the last update()
    this.trailCuts = []; // swept creature contacts with trails that were already open
    this.batches = Array.from({ length: TERRITORY.MAX_SLOTS }, () => []);
    this.flashing = [];
    this.time = 0;
    this.version = 0; // bumps on every ownership change (smooth shapes rebuild on change)
    this.shapes = new TerritoryShapes(this);
    this.reset();
  }

  reset() {
    this.version++;
    this.versionAll = (this.versionAll || 0) + 1; // whole-map changes force a shape rebuild
    this.owners.fill(NO_OWNER);
    this.claimedAt.fill(-Infinity);
    this.counts.fill(0);
    this.sumCol.fill(0);
    this.sumRow.fill(0);
    for (let slot = 0; slot < TERRITORY.MAX_SLOTS; slot++) this.resetBox(slot);
    this.claimed = 0;
    this.time = 0;
    this.kingSlot = NO_OWNER;
    for (let slot = 0; slot < TERRITORY.MAX_SLOTS; slot++) this.clearTrail(slot);
    this.captures.length = 0;
    this.trailCuts.length = 0;
  }

  registerSlot(slot, hue, isPlayer = false, character = null, elementSat = 85) {
    // Colour = the element's hue family (see skins.elementColor). The player's land is vivid;
    // rivals' land is quieter so 20 owners never look like a rainbow.
    const sat = Math.round(isPlayer ? elementSat : elementSat * TERRITORY.RIVAL_SATURATION_FACTOR);
    // On a dark floor (Settings > Floor) domains need stronger fills and lighter borders.
    const dark = currentFloor().dark;
    const fill = (isPlayer ? TERRITORY.PLAYER_FILL_ALPHA : TERRITORY.FILL_ALPHA) * (dark ? 1.5 : 1);
    const border = isPlayer ? TERRITORY.PLAYER_BORDER_ALPHA : TERRITORY.BORDER_ALPHA;
    const trail = isPlayer ? TERRITORY.TRAIL_ALPHA_PLAYER : TERRITORY.TRAIL_ALPHA_RIVAL;
    const vis = character ? characterVisibility(character, isPlayer) : 1; // Sol: brighter own land
    this.fillStyles[slot] = `hsla(${hue}, ${sat}%, ${TERRITORY.FILL_LIGHTNESS}%, ${Math.min(0.5, fill * vis)})`;
    this.borderStyles[slot] = `hsla(${hue}, ${Math.min(100, sat + 10)}%, ${dark ? TERRITORY.BORDER_LIGHTNESS_DARK : TERRITORY.BORDER_LIGHTNESS}%, ${border})`;
    this.flashStyles[slot] = `hsl(${hue}, ${Math.min(100, sat + 10)}%, 52%)`;
    this.trailStyles[slot] = `hsla(${hue}, ${Math.min(100, sat + 10)}%, ${TERRITORY.TRAIL_LIGHTNESS}%, ${trail})`;
    this.trailIdentityStyles[slot] = character ? character.palette.trail : null;
    this.trailAccentStyles[slot] = character ? character.visual.trailStyle : null;
    this.trailAccentColors[slot] = character ? character.palette.accent : null;
    this.rgb[slot] = hslToRgb(hue, sat / 100, 0.56);
    this.isPlayerSlot[slot] = isPlayer ? 1 : 0;
  }

  /** @returns {Array<{slot:number,count:number,x:number,y:number}>} captures made this frame */
  update(dt, creatures) {
    this.time += dt;
    this.captures.length = 0;
    this.trailCuts.length = 0;
    for (const creature of creatures) {
      if (!creature.alive || this.counts[creature.slot] === 0) continue;
      if (this.owners[this.indexAt(creature.x, creature.y)] !== creature.slot) {
        this.appendTrailMovement(creature.slot, creature);
      }
    }
    this.findTrailCuts(creatures);
    for (const creature of creatures) {
      if (!creature.alive) continue;
      const slot = creature.slot;
      // Checked before anything changes this frame: freshly captured land isn't home yet.
      creature.onHomeTurf = this.isSettled(creature.x, creature.y, slot);
      creature.isExposed = false;
      creature.inSafeArea = false;

      // Lost every cell (captured by rivals)? Put down a small new root where it stands.
      if (this.counts[slot] === 0) {
        this.clearTrail(slot);
        this.claimCircle(creature.x, creature.y, TERRITORY.START_RADIUS * 0.6, slot);
        creature.inSafeArea = true;
        continue;
      }

      const cell = this.indexAt(creature.x, creature.y);
      // Every cell crossed this frame joins the tether (outside your land), so a diagonal
      // move through a cell corner never leaves a gap the capture fill could leak through.
      this.addTrailCells(slot, creature.previousX, creature.previousY, creature.x, creature.y);
      // Body-contact rule: on your own land you are safe (CollisionSystem).
      creature.inSafeArea = this.owners[cell] === slot;
      if (this.owners[cell] === slot && this.trails[slot].length > 0) {
        const capture = this.capture(slot);
        if (capture) this.captures.push(capture);
      }
      creature.isExposed = this.owners[cell] !== slot && this.trails[slot].length > 0;
    }
    return this.captures;
  }

  /**
   * Adds the cells on the segment (x0,y0)->(x1,y1) to `slot`'s tether, walking the grid one
   * axis step at a time (a 4-connected chain), skipping the slot's own cells.
   */
  addTrailCells(slot, x0, y0, x1, y1) {
    const size = this.cellSize;
    const cols = this.cols;
    const rows = this.rows;
    let c = clamp(Math.floor(x0 / size), 0, cols - 1);
    let r = clamp(Math.floor(y0 / size), 0, rows - 1);
    const ce = clamp(Math.floor(x1 / size), 0, cols - 1);
    const re = clamp(Math.floor(y1 / size), 0, rows - 1);
    const add = () => {
      const index = r * cols + c;
      if (this.owners[index] === slot || this.trailSets[slot].has(index)) return;
      this.trailSets[slot].add(index);
      this.trails[slot].push(index);
    };
    // A jump of more than a few cells is a teleport (spawn, respawn), not movement.
    if (Math.abs(ce - c) + Math.abs(re - r) > 6) {
      c = ce;
      r = re;
      add();
      return;
    }
    add();
    if (c === ce && r === re) return;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const stepC = Math.sign(dx);
    const stepR = Math.sign(dy);
    // Distance (in t, 0..1 along the segment) to the next vertical / horizontal cell line.
    const tDeltaC = stepC !== 0 ? Math.abs(size / dx) : Infinity;
    const tDeltaR = stepR !== 0 ? Math.abs(size / dy) : Infinity;
    let tMaxC = stepC > 0 ? ((c + 1) * size - x0) / dx : stepC < 0 ? (c * size - x0) / dx : Infinity;
    let tMaxR = stepR > 0 ? ((r + 1) * size - y0) / dy : stepR < 0 ? (r * size - y0) / dy : Infinity;
    for (let guard = 0; guard < 64 && (c !== ce || r !== re); guard++) {
      if (tMaxC < tMaxR) {
        c += stepC;
        tMaxC += tDeltaC;
      } else {
        r += stepR;
        tMaxR += tDeltaR;
      }
      if (c < 0 || c >= cols || r < 0 || r >= rows) return;
      add();
    }
  }

  appendTrailMovement(slot, creature) {
    const path = this.trailPaths[slot];
    if (path.length === 0) path.push({ x: creature.previousX, y: creature.previousY });
    const dx = creature.x - creature.previousX;
    const dy = creature.y - creature.previousY;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / TERRITORY.TRAIL_POINT_SPACING));
    for (let i = 1; i <= steps; i++) {
      const point = {
        x: creature.previousX + (dx * i) / steps,
        y: creature.previousY + (dy * i) / steps,
      };
      const last = path[path.length - 1];
      if (Math.hypot(point.x - last.x, point.y - last.y) > 1e-5) path.push(point);
    }
  }

  findTrailCuts(creatures) {
    const bySlot = new Array(TERRITORY.MAX_SLOTS);
    this.trailWarnings.fill(0);
    for (const creature of creatures) {
      if (creature.alive) bySlot[creature.slot] = creature;
    }
    // Bounding box of every open trail, once per frame: a creature far from a trail's box
    // can't touch it, so the expensive per-segment test is skipped (same results, far less work).
    const box = this.trailBoxes || (this.trailBoxes = new Float64Array(TERRITORY.MAX_SLOTS * 4));
    for (let slot = 1; slot < TERRITORY.MAX_SLOTS; slot++) {
      const path = this.trailPaths[slot];
      let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
      for (let i = 0; i < path.length; i++) {
        const pt = path[i];
        if (pt.x < x0) x0 = pt.x;
        if (pt.x > x1) x1 = pt.x;
        if (pt.y < y0) y0 = pt.y;
        if (pt.y > y1) y1 = pt.y;
      }
      box[slot * 4] = x0; box[slot * 4 + 1] = y0; box[slot * 4 + 2] = x1; box[slot * 4 + 3] = y1;
    }
    const reach = TERRITORY.TRAIL_WARNING_DISTANCE + TERRITORY.TRAIL_WIDTH + TERRITORY.TRAIL_OUTLINE_WIDTH;

    for (const creature of creatures) {
      creature.nearOwnTrail = false;
      if (!creature.alive) continue;
      const pad = reach + creature.radius;
      const cx0 = Math.min(creature.previousX, creature.x) - pad;
      const cx1 = Math.max(creature.previousX, creature.x) + pad;
      const cy0 = Math.min(creature.previousY, creature.y) - pad;
      const cy1 = Math.max(creature.previousY, creature.y) + pad;
      for (let slot = 1; slot < TERRITORY.MAX_SLOTS; slot++) {
        const path = this.trailPaths[slot];
        const owner = bySlot[slot];
        if (path.length < 2 || !owner) continue;
        if (box[slot * 4 + 2] < cx0 || box[slot * 4] > cx1 || box[slot * 4 + 3] < cy0 || box[slot * 4 + 1] > cy1) continue;
        const selfTrail = creature === owner;
        const ownerCell = this.indexAt(owner.x, owner.y);
        const ownerReturned = this.owners[ownerCell] === slot;
        const bodyRadius = selfTrail ? creature.radius * TERRITORY.SELF_CUT_RADIUS_FACTOR : creature.radius;
        const cutRadius = bodyRadius + (TERRITORY.TRAIL_WIDTH + TERRITORY.TRAIL_OUTLINE_WIDTH) * 0.5;
        let ownerMovementEndT = 1;
        if (ownerReturned) {
          const col = ownerCell % this.cols;
          const row = (ownerCell - col) / this.cols;
          const entryT = segmentRectEntryT(
            owner.previousX, owner.previousY, owner.x, owner.y,
            col * this.cellSize, row * this.cellSize,
            (col + 1) * this.cellSize, (row + 1) * this.cellSize,
          );
          if (entryT === null) ownerMovementEndT = 0;
          else ownerMovementEndT = entryT;
        }
        const movementEndT = selfTrail ? ownerMovementEndT : ownerReturned
          ? Math.min(ownerMovementEndT, 1) : 1;
        const movementEndX = creature.previousX + (creature.x - creature.previousX) * movementEndT;
        const movementEndY = creature.previousY + (creature.y - creature.previousY) * movementEndT;
        let segmentEnd = path.length - 1;
        let excludedSegments = 0;
        let excludedLength = 0;
        // The newest stretch behind the owner's head never counts: at least N segments and
        // a length that scales with body size (bigger bodies turn wider).
        const safeLength = selfTrail ? owner.radius * TERRITORY.SELF_CUT_SAFE_LENGTH_RADII : 0;
        while (segmentEnd > 0) {
          const i = segmentEnd - 1;
          const nearHead = pointSegmentDistanceSquared(
            owner.previousX, owner.previousY,
            path[i].x, path[i].y, path[i + 1].x, path[i + 1].y,
          ) <= cutRadius * cutRadius;
          if (excludedSegments >= TERRITORY.TRAIL_SELF_CUT_EXCLUSION_SEGMENTS
            && excludedLength >= safeLength && !nearHead) break;
          excludedLength += Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
          segmentEnd--;
          excludedSegments++;
        }
        const contact = { x: creature.x, y: creature.y };
        const distanceSquared = this.segmentTrailDistanceSquared(
          creature, path, segmentEnd, movementEndX, movementEndY, contact,
        );
        // Tangling: the head's path actually crosses an older piece of its own trail. That is a
        // self-cut however tight the loop, even inside the stretch excluded above.
        if (selfTrail && movementEndT > 0
          && this.movementCrossesOwnTrail(creature, path, movementEndX, movementEndY, contact)) {
          this.trailCuts.push({
            cutter: creature,
            victim: owner,
            selfTrail: true,
            x: contact.x,
            y: contact.y,
            heading: Math.atan2(creature.y - creature.previousY, creature.x - creature.previousX),
          });
          continue;
        }
        const nearestDistanceSquared = distanceSquared;
        if (selfTrail && nearestDistanceSquared <= TERRITORY.TRAIL_WARNING_DISTANCE ** 2) {
          creature.nearOwnTrail = true;
          this.trailWarnings[slot] = 1;
        }
        if (nearestDistanceSquared <= cutRadius * cutRadius) {
          this.trailCuts.push({
            cutter: creature,
            victim: owner,
            selfTrail: creature === owner,
            x: contact.x,
            y: contact.y,
            heading: Math.atan2(creature.y - creature.previousY, creature.x - creature.previousX),
          });
        }
      }
    }
  }

  /**
   * Distance from (x, y) to `slot`'s open trail, ignoring the newest `skipLength` units of
   * path (the stretch right behind the head is always close). Infinity without a trail.
   * Presentation only (the exposure heartbeat), so no swept test.
   */
  distanceToOlderTrail(slot, x, y, skipLength) {
    const path = this.trailPaths[slot];
    let skipped = 0;
    let i = path.length - 1;
    while (i > 0 && skipped < skipLength) {
      skipped += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      i--;
    }
    let best = Infinity;
    for (let j = i; j > 0; j--) {
      const d = pointSegmentDistanceSquared(x, y, path[j - 1].x, path[j - 1].y, path[j].x, path[j].y);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  /**
   * Would moving straight from (x0,y0) to (x1,y1) touch `slot`'s own open trail? The newest
   * `skipNewest` path points (right behind the creature) are ignored. Used by the AI to
   * plan a way home that doesn't run over its own trail.
   */
  pathCrossesTrail(slot, x0, y0, x1, y1, radius, skipNewest = 12) {
    const path = this.trailPaths[slot];
    const end = path.length - 1 - skipNewest;
    if (end < 1) return false;
    const closest = { x: 0, y: 0 };
    const r2 = radius * radius;
    const left = Math.min(x0, x1) - radius;
    const right = Math.max(x0, x1) + radius;
    const top = Math.min(y0, y1) - radius;
    const bottom = Math.max(y0, y1) + radius;
    for (let i = 0; i < end; i++) {
      const a = path[i];
      const b = path[i + 1];
      // Segments nowhere near the move can't touch it (cheap test before the exact one).
      if (Math.max(a.x, b.x) < left || Math.min(a.x, b.x) > right
        || Math.max(a.y, b.y) < top || Math.min(a.y, b.y) > bottom) continue;
      if (closestSegmentPoints(x0, y0, x1, y1, a.x, a.y, b.x, b.y, closest) <= r2) return true;
    }
    return false;
  }

  /**
   * True when this frame's head movement crosses one of the creature's own older trail
   * segments (the ones laid down this frame, and the one joining them, can't count).
   * Writes the crossing point into `contact`.
   */
  movementCrossesOwnTrail(creature, path, endX, endY, contact) {
    const ax = creature.previousX;
    const ay = creature.previousY;
    const moved = Math.hypot(creature.x - ax, creature.y - ay);
    if (moved < 1e-6) return false;
    const laidThisFrame = Math.max(1, Math.ceil(moved / TERRITORY.TRAIL_POINT_SPACING));
    const last = path.length - 2 - laidThisFrame; // newest segment allowed to count
    const minX = Math.min(ax, endX);
    const maxX = Math.max(ax, endX);
    const minY = Math.min(ay, endY);
    const maxY = Math.max(ay, endY);
    const ex = endX - ax;
    const ey = endY - ay;
    for (let i = 0; i <= last; i++) {
      const c = path[i];
      const d = path[i + 1];
      if (Math.max(c.x, d.x) < minX || Math.min(c.x, d.x) > maxX
        || Math.max(c.y, d.y) < minY || Math.min(c.y, d.y) > maxY) continue;
      const fx = d.x - c.x;
      const fy = d.y - c.y;
      const denom = ex * fy - ey * fx;
      if (Math.abs(denom) < 1e-9) continue; // parallel: running alongside is not a crossing
      const t = ((c.x - ax) * fy - (c.y - ay) * fx) / denom;
      const u = ((c.x - ax) * ey - (c.y - ay) * ex) / denom;
      if (t > 0 && t <= 1 && u > 0 && u < 1) {
        contact.x = ax + ex * t;
        contact.y = ay + ey * t;
        return true;
      }
    }
    return false;
  }

  segmentTrailDistanceSquared(
    creature, path, segmentEnd, movementEndX = creature.x, movementEndY = creature.y, contact = null,
  ) {
    const padding = TERRITORY.TRAIL_WARNING_DISTANCE;
    const movementLeft = Math.min(creature.previousX, movementEndX) - padding;
    const movementRight = Math.max(creature.previousX, movementEndX) + padding;
    const movementTop = Math.min(creature.previousY, movementEndY) - padding;
    const movementBottom = Math.max(creature.previousY, movementEndY) + padding;
    let nearest = Infinity;
    const closest = { x: 0, y: 0 };
    for (let i = 0; i < segmentEnd; i++) {
      const a = path[i];
      const b = path[i + 1];
      if (Math.max(a.x, b.x) < movementLeft || Math.min(a.x, b.x) > movementRight
        || Math.max(a.y, b.y) < movementTop || Math.min(a.y, b.y) > movementBottom) continue;
      const distanceSquared = closestSegmentPoints(
        creature.previousX, creature.previousY, movementEndX, movementEndY,
        a.x, a.y, b.x, b.y, closest,
      );
      if (distanceSquared < nearest) {
        nearest = distanceSquared;
        if (contact) {
          contact.x = closest.x;
          contact.y = closest.y;
        }
      }
      if (nearest === 0) break;
    }
    return nearest;
  }

  drawTrailPath(ctx, slot, zoom) {
    const path = this.trailPaths[slot];
    if (path.length < 2 || !this.trailStyles[slot]) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lineWidth = TERRITORY.TRAIL_WIDTH / zoom;
    const warning = this.trailWarnings[slot] === 1;
    ctx.strokeStyle = TERRITORY.TRAIL_OUTLINE;
    ctx.lineWidth = (TERRITORY.TRAIL_WIDTH + TERRITORY.TRAIL_OUTLINE_WIDTH) / zoom;
    ctx.globalAlpha = 1;
    ctx.stroke();

    const pulse = warning ? 0.08 * (0.5 + 0.5 * Math.sin(this.time * 8)) : 0;
    ctx.strokeStyle = this.trailStyles[slot];
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = this.isPlayerSlot[slot]
      ? Math.min(1, 0.82 + 0.18 * Math.sin(this.time * 6) + pulse)
      : 0.75;
    if (warning) {
      // Warning glow: a wide soft stroke underneath (a blur shadow on a long trail is very slow).
      const alpha = ctx.globalAlpha;
      ctx.strokeStyle = this.flashStyles[slot];
      ctx.lineWidth = lineWidth * 2.6;
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.strokeStyle = this.trailStyles[slot];
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = alpha;
    }
    ctx.stroke();
    const identityTrail = this.trailIdentityStyles[slot];
    if (identityTrail) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = identityTrail;
      ctx.lineWidth = Math.max(1.25 / zoom, lineWidth * 0.2);
      ctx.globalAlpha = warning ? 0.78 : 0.56;
      ctx.stroke();
    }
    const accentStyle = this.trailAccentStyles[slot];
    if (identityTrail && accentStyle) {
      ctx.shadowBlur = 0;
      drawTrailAccents(ctx, path, accentStyle, identityTrail, this.trailAccentColors[slot], this.time, zoom);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * Reconnected: the trail and every cell it encloses (walls = own land + trail, within the
   * trail's bounding box) become `slot`'s. Returns what was gained, or null.
   */
  capture(slot) {
    const trail = this.trails[slot];
    const cols = this.cols;
    // The fill covers the box around ALL your land plus the new tether, one cell wider, and
    // floods in from its edge: anything your domain + tether fully enclose becomes yours,
    // including bays of your own domain closed by a short tether. (A box around the tether
    // alone would miss those: part of the bay lies outside it.)
    let minC = this.boxC0[slot];
    let maxC = this.boxC1[slot];
    let minR = this.boxR0[slot];
    let maxR = this.boxR1[slot];
    for (const index of trail) {
      const col = index % cols;
      const row = (index - col) / cols;
      if (col < minC) minC = col;
      if (col > maxC) maxC = col;
      if (row < minR) minR = row;
      if (row > maxR) maxR = row;
    }
    minC = Math.max(0, minC - 1);
    maxC = Math.min(cols - 1, maxC + 1);
    minR = Math.max(0, minR - 1);
    maxR = Math.min(this.rows - 1, maxR + 1);

    // fillMark: 0 = open, 1 = wall (own land / trail), 2 = reachable from outside the loop.
    const mark = this.fillMark;
    const queue = this.fillQueue;
    for (let row = minR; row <= maxR; row++) {
      for (let col = minC; col <= maxC; col++) {
        const index = row * cols + col;
        mark[index] = this.owners[index] === slot ? 1 : 0;
      }
    }
    for (const index of trail) mark[index] = 1;

    let tail = 0;
    const seed = (index) => {
      if (mark[index] !== 0) return;
      mark[index] = 2;
      queue[tail++] = index;
    };
    for (let col = minC; col <= maxC; col++) {
      seed(minR * cols + col);
      seed(maxR * cols + col);
    }
    for (let row = minR; row <= maxR; row++) {
      seed(row * cols + minC);
      seed(row * cols + maxC);
    }
    for (let head = 0; head < tail; head++) {
      const index = queue[head];
      const col = index % cols;
      const row = (index - col) / cols;
      if (col > minC) seed(index - 1);
      if (col < maxC) seed(index + 1);
      if (row > minR) seed(index - cols);
      if (row < maxR) seed(index + cols);
    }

    // Only the pocket(s) this trail actually closes fill in: enclosed ground touching the new
    // trail. Older gaps elsewhere in the domain stay open until a loop goes around them.
    let pocket = 0;
    const claim = (index) => {
      if (mark[index] !== 0) return;
      mark[index] = 3;
      queue[pocket++] = index;
    };
    const around = (index, visit) => {
      const col = index % cols;
      const row = (index - col) / cols;
      if (col > minC) visit(index - 1);
      if (col < maxC) visit(index + 1);
      if (row > minR) visit(index - cols);
      if (row < maxR) visit(index + cols);
    };
    for (const index of trail) around(index, claim);
    for (let head = 0; head < pocket; head++) around(queue[head], claim);

    let gained = 0;
    let sumX = 0;
    let sumY = 0;
    const cells = [];
    const take = (index) => {
      if (this.owners[index] === slot || !this.playable[index]) return;
      this.setOwner(index, slot);
      cells.push(index);
      const col = index % cols;
      sumX += col;
      sumY += (index - col) / cols;
      gained++;
    };
    for (const index of trail) take(index);
    for (let row = minR; row <= maxR; row++) {
      for (let col = minC; col <= maxC; col++) {
        const index = row * cols + col;
        if (mark[index] === 3) take(index);
      }
    }
    this.clearTrail(slot);
    if (gained === 0) return null;
    return {
      slot,
      count: gained,
      x: (sumX / gained + 0.5) * this.cellSize,
      y: (sumY / gained + 0.5) * this.cellSize,
      cells, // indices claimed by this capture (presentation: the capture wave)
    };
  }

  clearTrail(slot) {
    this.trails[slot].length = 0;
    this.trailSets[slot].clear();
    this.trailPaths[slot].length = 0;
    this.trailWarnings[slot] = 0;
  }

  trailLength(slot) {
    return this.trails[slot].length;
  }

  /**
   * Like nearestOwnedCell, but only cells for which `accept(cx, cy)` is true count (at most
   * `maxChecks` candidates are tested, nearest rings first). Used by the AI to find a spot
   * of its own land it can reach without running over its own trail.
   */
  nearestOwnedCellWhere(x, y, slot, maxRings, accept, out, maxChecks = 40) {
    const cols = this.cols;
    const size = this.cellSize;
    const c0 = clamp(Math.floor(x / size), 0, cols - 1);
    const r0 = clamp(Math.floor(y / size), 0, this.rows - 1);
    let checks = 0;
    for (let ring = 0; ring <= maxRings; ring++) {
      let best = -1;
      let bestD = Infinity;
      for (let dr = -ring; dr <= ring; dr++) {
        const row = r0 + dr;
        if (row < 0 || row >= this.rows) continue;
        const step = Math.abs(dr) === ring ? 1 : Math.max(1, ring * 2);
        for (let dc = -ring; dc <= ring; dc += step) {
          const col = c0 + dc;
          if (col < 0 || col >= cols) continue;
          const index = row * cols + col;
          if (this.owners[index] !== slot) continue;
          const d = dr * dr + dc * dc;
          if (d >= bestD) continue;
          if (checks++ >= maxChecks) return best >= 0 ? this.cellCentre(best, out) : null;
          if (!accept((col + 0.5) * size, (row + 0.5) * size)) continue;
          bestD = d;
          best = index;
        }
      }
      if (best >= 0) return this.cellCentre(best, out);
    }
    return null;
  }

  cellCentre(index, out) {
    const col = index % this.cols;
    out.x = (col + 0.5) * this.cellSize;
    out.y = ((index - col) / this.cols + 0.5) * this.cellSize;
    return out;
  }

  /** Centre of the nearest cell `slot` owns, searching outward ring by ring (or null). */
  nearestOwnedCell(x, y, slot, maxRings, out) {
    const cols = this.cols;
    const c0 = clamp(Math.floor(x / this.cellSize), 0, cols - 1);
    const r0 = clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
    for (let ring = 0; ring <= maxRings; ring++) {
      let best = -1;
      let bestD = Infinity;
      for (let dr = -ring; dr <= ring; dr++) {
        const row = r0 + dr;
        if (row < 0 || row >= this.rows) continue;
        // Full rows at the top/bottom of the ring, only the two ends in between.
        const step = Math.abs(dr) === ring ? 1 : Math.max(1, ring * 2);
        for (let dc = -ring; dc <= ring; dc += step) {
          const col = c0 + dc;
          if (col < 0 || col >= cols) continue;
          const index = row * cols + col;
          if (this.owners[index] !== slot) continue;
          const d = dr * dr + dc * dc;
          if (d < bestD) {
            bestD = d;
            best = index;
          }
        }
      }
      if (best >= 0) {
        const col = best % cols;
        out.x = (col + 0.5) * this.cellSize;
        out.y = ((best - col) / cols + 0.5) * this.cellSize;
        return out;
      }
    }
    return null;
  }

  indexAt(x, y) {
    const col = clamp(Math.floor(x / this.cellSize), 0, this.cols - 1);
    const row = clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
    return row * this.cols + col;
  }

  ownerAt(x, y) {
    return this.owners[this.indexAt(x, y)];
  }

  /** True when `slot` owns the cell at (x, y) and has held it for SETTLE_TIME. */
  isSettled(x, y, slot) {
    const index = this.indexAt(x, y);
    return this.owners[index] === slot && this.time - this.claimedAt[index] >= TERRITORY.SETTLE_TIME;
  }

  setOwner(index, slot) {
    const previous = this.owners[index];
    const col = index % this.cols;
    const row = (index - col) / this.cols;
    if (previous !== NO_OWNER) {
      this.counts[previous]--;
      if (this.counts[previous] === 0) this.resetBox(previous);
      this.sumCol[previous] -= col;
      this.sumRow[previous] -= row;
    } else {
      this.claimed++;
    }
    this.owners[index] = slot;
    this.growBox(slot, col, row);
    this.version++;
    if (this.shapes) this.shapes.touch(index);
    this.counts[slot]++;
    this.sumCol[slot] += col;
    this.sumRow[slot] += row;
    this.claimedAt[index] = this.time;
  }

  /** Grants a round patch of land (home bases). */
  claimCircle(x, y, radius, slot) {
    const size = this.cellSize;
    const c0 = clamp(Math.floor((x - radius) / size), 0, this.cols - 1);
    const c1 = clamp(Math.floor((x + radius) / size), 0, this.cols - 1);
    const r0 = clamp(Math.floor((y - radius) / size), 0, this.rows - 1);
    const r1 = clamp(Math.floor((y + radius) / size), 0, this.rows - 1);
    const radiusSq = radius * radius;

    for (let row = r0; row <= r1; row++) {
      const dy = (row + 0.5) * size - y;
      const dySq = dy * dy;
      if (dySq > radiusSq) continue;
      for (let col = c0; col <= c1; col++) {
        const dx = (col + 0.5) * size - x;
        if (dx * dx + dySq > radiusSq) continue;
        const index = row * this.cols + col;
        if (this.owners[index] !== slot && this.playable[index]) this.setOwner(index, slot);
      }
    }
  }

  /**
   * A kill: the winner takes the `fraction` of the loser's land nearest to (nearX, nearY);
   * the rest is released as neutral ground anyone can claim. fraction 1 hands over everything.
   */
  conquer(fromSlot, toSlot, fraction, nearX, nearY) {
    this.clearTrail(fromSlot);
    if (fromSlot === toSlot || this.counts[fromSlot] === 0) return;
    if (fraction >= 1) {
      this.transfer(fromSlot, toSlot);
      return;
    }
    const cells = [];
    for (let i = 0; i < this.totalCells; i++) {
      if (this.owners[i] === fromSlot) cells.push(i);
    }
    const size = this.cellSize;
    const d2 = (i) => {
      const col = i % this.cols;
      const dx = (col + 0.5) * size - nearX;
      const dy = ((i - col) / this.cols + 0.5) * size - nearY;
      return dx * dx + dy * dy;
    };
    cells.sort((a, b) => d2(a) - d2(b));
    const taken = Math.round(cells.length * fraction);
    for (let k = 0; k < cells.length; k++) {
      if (k < taken) this.setOwner(cells[k], toSlot);
      else this.release(cells[k]);
    }
  }

  release(index) {
    const owner = this.owners[index];
    if (owner === NO_OWNER) return;
    const col = index % this.cols;
    const row = (index - col) / this.cols;
    this.counts[owner]--;
    if (this.counts[owner] === 0) this.resetBox(owner);
    this.sumCol[owner] -= col;
    this.sumRow[owner] -= row;
    this.claimed--;
    this.owners[index] = NO_OWNER;
    this.claimedAt[index] = this.time;
    this.version++;
    if (this.shapes) this.shapes.touch(index);
  }

  /** Releases every cell a slot owns (a seat leaving the world for good). */
  releaseAll(slot) {
    this.clearTrail(slot);
    if (this.counts[slot] === 0) return;
    for (let i = 0; i < this.totalCells; i++) {
      if (this.owners[i] === slot) this.release(i);
    }
  }

  /** Hands all of one owner's cells to another (to = 0 releases them). */
  /** A slot with no land left: its box starts over (it will regrow from its next cells). */
  resetBox(slot) {
    this.boxC0[slot] = this.cols;
    this.boxR0[slot] = this.rows;
    this.boxC1[slot] = -1;
    this.boxR1[slot] = -1;
  }

  growBox(slot, col, row) {
    if (col < this.boxC0[slot]) this.boxC0[slot] = col;
    if (col > this.boxC1[slot]) this.boxC1[slot] = col;
    if (row < this.boxR0[slot]) this.boxR0[slot] = row;
    if (row > this.boxR1[slot]) this.boxR1[slot] = row;
  }

  transfer(fromSlot, toSlot) {
    if (fromSlot === toSlot || this.counts[fromSlot] === 0) return;
    this.version++;
    if (this.shapes) this.shapes.invalidate();
    for (let i = 0; i < this.totalCells; i++) {
      if (this.owners[i] !== fromSlot) continue;
      this.owners[i] = toSlot;
      this.claimedAt[i] = this.time;
    }
    if (toSlot !== NO_OWNER) {
      this.growBox(toSlot, this.boxC0[fromSlot], this.boxR0[fromSlot]);
      this.growBox(toSlot, this.boxC1[fromSlot], this.boxR1[fromSlot]);
    }
    if (toSlot !== NO_OWNER) {
      this.counts[toSlot] += this.counts[fromSlot];
      this.sumCol[toSlot] += this.sumCol[fromSlot];
      this.sumRow[toSlot] += this.sumRow[fromSlot];
    } else {
      this.claimed -= this.counts[fromSlot];
    }
    this.counts[fromSlot] = 0;
    this.resetBox(fromSlot);
    this.sumCol[fromSlot] = 0;
    this.sumRow[fromSlot] = 0;
  }

  countFor(slot) {
    return this.counts[slot];
  }

  /**
   * Territory-stat %: the slot's share of every playable cell, including neutral ground in
   * the denominator, before the local player's unclaimed-area display bonus.
   */
  percentFor(slot) {
    return (this.counts[slot] / this.playableCount) * 100;
  }

  /**
   * Display percentage for the leaderboard and crown checks. The map keeps real ownership,
   * while the display layer is normalized so all leaderboard percentages share a single 100%
   * total without changing the underlying arena.
   */
  displayPercentFor(slot) {
    return this.percentFor(slot);
  }

  /**
   * Scores actual ownership plus temporary value points, then normalizes the whole set so the
   * leaderboard totals sum to exactly 100% while keeping map ownership and scoring logic
   * separate from the display layer.
   */
  scoreCounts(bonusCounts, localSlot, out = new Float64Array(TERRITORY.MAX_SLOTS)) {
    // Realistic share: each player's ACTUAL land over the WHOLE map (unclaimed land counts
    // too), counted once, no bonuses: domainPercentFor = land / every playable cell, so the
    // crown threshold (KING.MINIMUM_ARENA_PERCENT) is a share of the planet. (Parameters kept for the call site.)
    out.set(this.counts);
    return out;
  }

  /** World-space centre of mass of a slot's territory, or null if it has none. */
  centroidFor(slot, out) {
    const n = this.counts[slot];
    if (n === 0) return null;
    out.x = (this.sumCol[slot] / n + 0.5) * this.cellSize;
    out.y = (this.sumRow[slot] / n + 0.5) * this.cellSize;
    return out;
  }

  /**
   * Paints a downsampled ownership map (one pixel per `step`×`step` cells) for the minimap.
   * @param {ImageData} image sized cols/step × rows/step
   */
  paintMap(image, step, playerSlot) {
    const data = image.data;
    const w = image.width;
    const h = image.height;
    let p = 0;
    for (let y = 0; y < h; y++) {
      const rowBase = Math.min(this.rows - 1, y * step) * this.cols;
      for (let x = 0; x < w; x++, p += 4) {
        const owner = this.owners[rowBase + Math.min(this.cols - 1, x * step)];
        const rgb = owner === NO_OWNER ? null : this.rgb[owner];
        if (!rgb) {
          data[p + 3] = 0;
          continue;
        }
        data[p] = rgb[0];
        data[p + 1] = rgb[1];
        data[p + 2] = rgb[2];
        // Keep map coverage tied to owned cells, not the local player's boosted score.
        data[p + 3] = 175;
      }
    }
  }

  /** @param {(ctx) => void} [afterLand] drawn over the land, under the trails (capture waves) */
  draw(ctx, bounds, zoom, afterLand = null) {
    // Domains (render/territoryShapes.js): exact cells with a soft bump over each floor
    // circle on the outer edge. Inside, a slowly flowing organic texture.
    const shapes = this.shapes.get(bounds);
    const organic = organicPattern(ctx, this.time);
    for (const [slot, shape] of shapes) {
      if (!this.fillStyles[slot] || shape.minX === Infinity) continue;
      ctx.save();
      ctx.fillStyle = this.fillStyles[slot];
      ctx.fill(shape.path, 'evenodd');
      ctx.clip(shape.path, 'evenodd');
      ctx.globalAlpha = this.isPlayerSlot[slot] ? 0.9 : 0.6;
      ctx.fillStyle = organic;
      ctx.fillRect(shape.minX, shape.minY, shape.maxX - shape.minX, shape.maxY - shape.minY);
      ctx.restore();
    }

    // Frontiers: a soft glow, then the crisp edge. The King's frontier is gold.
    for (const [slot, shape] of shapes) {
      if (!this.borderStyles[slot] || shape.minX === Infinity) continue;
      const isKing = slot === this.kingSlot;
      const px = isKing ? TERRITORY.KING_BORDER_WIDTH_PX
        : this.isPlayerSlot[slot] ? TERRITORY.PLAYER_BORDER_WIDTH_PX : TERRITORY.BORDER_WIDTH_PX;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = isKing ? TERRITORY.KING_BORDER : this.borderStyles[slot];
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = (px * 4.5) / zoom;
      ctx.stroke(shape.path);
      ctx.globalAlpha = 1;
      ctx.lineWidth = px / zoom;
      ctx.stroke(shape.path);
      ctx.restore();
    }

    if (afterLand) afterLand(ctx);

    // Open trails are drawn as continuous paths, matching the geometry used for trail cuts.
    for (let slot = 1; slot < TERRITORY.MAX_SLOTS; slot++) {
      if (this.trails[slot].length > 0) this.drawTrailPath(ctx, slot, zoom);
    }
  }
}
