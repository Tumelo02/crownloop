import { COMBAT, ENERGY, POWER_UPS } from '../config.js';
import { GameEvent } from '../core/EventBus.js';

/**
 * Resolves every contact rule in one place:
 *  - creature ↔ energy   (magnet pull + collection)
 *  - creature ↔ power-up (pickup)
 *  - creature ↔ trail    (trail cuts, found by TerritorySystem; resolved here)
 *  - creature ↔ creature (the safe / exposed contact rule)
 * It applies state changes and emits events; presentation reacts to the events.
 *
 * Every lethal hit goes through `lethalHit`, so trail cuts and body contacts share the
 * same elimination rules.
 */
export class CollisionSystem {
  constructor(events) {
    this.events = events;
    this.nearby = [];
    this.dying = new Set(); // scratch: creatures eliminated in the current resolution
  }

  update(dt, creatures, energyField, powerUps) {
    for (const creature of creatures) {
      if (!creature.alive) continue;
      this.resolveEnergy(dt, creature, energyField);
      this.resolvePowerUps(creature, powerUps);
    }
    this.resolveCreatures(creatures);
  }

  /**
   * One cut = one resolution: each victim is resolved at most once per frame, and the
   * trail is cleared so the same trail can't be hit again.
   */
  resolveTrailCuts(cuts, territory) {
    const resolvedVictims = new Set();
    for (const { cutter, victim, x, y, heading } of cuts) {
      if (!cutter.alive || !victim.alive || resolvedVictims.has(victim)) continue;
      resolvedVictims.add(victim);
      const cutX = Number.isFinite(x) ? x : (cutter.x + victim.x) * 0.5;
      const cutY = Number.isFinite(y) ? y : (cutter.y + victim.y) * 0.5;
      const cutHeading = Number.isFinite(heading) ? heading : cutter.heading;
      territory.clearTrail(victim.slot);
      this.events.emit(GameEvent.TRAIL_CUT, {
        cutter, victim, x: cutX, y: cutY, heading: cutHeading,
      });
      // Lethal: the attacker's slice is announced first, so the signature move plays
      // before the victim's elimination (ATTACK -> SLICE -> ELIMINATION).
      this.events.emit(GameEvent.TRAIL_SLICED, {
        cutter, victim, x: cutX, y: cutY, heading: cutHeading, self: cutter === victim,
      });
      this.lethalHit(cutter, victim, cutter === victim ? 'self-trail-cut' : 'trail-cut', cutX, cutY);
    }
  }

  /** Eliminates the victim and returns whether they survived. */
  lethalHit(killer, victim, reason, x, y) {
    this.eliminate(killer, victim, reason, x, y);
    return false;
  }

  resolveEnergy(dt, creature, energyField) {
    const magnetRange = creature.magnetTime > 0 ? POWER_UPS.MAGNET.RANGE : ENERGY.MAGNET_RANGE;
    const pullSpeed = creature.magnetTime > 0 ? POWER_UPS.MAGNET.PULL_SPEED : ENERGY.MAGNET_PULL_SPEED;
    const reach = creature.radius * (1 + ENERGY.MAGNET_RADIUS_FACTOR) + magnetRange;
    const reachSq = reach * reach;
    const candidates = energyField.query(creature.x, creature.y, reach, this.nearby);

    for (const energy of candidates) {
      if (!energy.active) continue;
      const dx = creature.x - energy.x;
      const dy = creature.y - energy.y;
      const d2 = dx * dx + dy * dy;
      const collectRadius = creature.radius + energy.radius;

      if (d2 <= collectRadius * collectRadius) {
        // Fills the meter (max 100%); the rest becomes a little score (Creature.collectEnergy).
        const { amount, points } = creature.collectEnergy(energy.value);
        energyField.collect(energy);
        this.events.emit(GameEvent.ENERGY_COLLECTED, { creature, energy, amount, points });
      } else if (d2 < reachSq) {
        // Magnet: pull speeds up as it gets closer and always outruns the creature.
        const dist = Math.sqrt(d2);
        const strength = Math.max(ENERGY.MAGNET_MIN_STRENGTH, 1 - dist / reach);
        const step = Math.min(dist, (pullSpeed + creature.speed) * strength * dt);
        energy.x += (dx / dist) * step;
        energy.y += (dy / dist) * step;
        energyField.moved(energy);
      }
    }
  }

  resolvePowerUps(creature, powerUps) {
    for (const powerUp of powerUps) {
      if (!powerUp.active) continue;
      const dx = creature.x - powerUp.x;
      const dy = creature.y - powerUp.y;
      const reach = creature.radius + powerUp.radius;
      if (dx * dx + dy * dy <= reach * reach) {
        powerUp.active = false;
        this.events.emit(GameEvent.POWER_UP_COLLECTED, { creature, powerUp });
      }
    }
  }

  /** A creature counts as safe only while standing on its own territory. */
  isSafe(creature) {
    return creature.inSafeArea;
  }

  /**
   * Body contact (no knockback anywhere):
   *   safe vs exposed    -> the exposed one is eliminated (the safe one is untouched)
   *   exposed vs exposed -> both are eliminated
   *   safe vs safe       -> nobody dies; they ease apart
   * Outcomes for a pair are decided before anything is applied, so "both die" is fair.
   */
  resolveCreatures(creatures) {
    const dying = this.dying;
    dying.clear();
    // O(n²) is fine for a 20-seat world (~190 cheap pair checks).
    for (let i = 0; i < creatures.length; i++) {
      const a = creatures[i];
      if (!a.alive || dying.has(a)) continue;
      for (let j = i + 1; j < creatures.length; j++) {
        const b = creatures[j];
        if (!b.alive || dying.has(b) || !a.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const touch = a.radius + b.radius;
        if (d2 >= touch * touch) continue;
        const distance = Math.sqrt(d2);
        const aSafe = this.isSafe(a);
        const bSafe = this.isSafe(b);
        const contact = distance < touch * COMBAT.CONTACT_REACH_FACTOR;

        if (aSafe && bSafe) {
          this.easeApart(a, b, dx, dy, distance, touch);
          continue;
        }
        // A graze isn't a hit yet; it isn't corrected either, so pressing on turns into one.
        if (!contact) continue;
        const x = a.x + (dx / (distance || 1)) * a.radius;
        const y = a.y + (dy / (distance || 1)) * a.radius;
        if (aSafe) {
          if (!this.lethalHit(a, b, 'collision', x, y)) dying.add(b);
        } else if (bSafe) {
          if (!this.lethalHit(b, a, 'collision', x, y)) dying.add(a);
        } else {
          // Both exposed: both are eliminated.
          const aSurvives = this.lethalHit(b, a, 'collision-mutual', x, y);
          const bSurvives = this.lethalHit(a, b, 'collision-mutual', x, y);
          if (!aSurvives) dying.add(a);
          if (!bSurvives) dying.add(b);
        }
        if (a.alive && b.alive) this.easeApart(a, b, dx, dy, distance, touch);
      }
    }

    // Extra relaxation passes (positions only) so crowds and corners never lock up.
    for (let pass = 1; pass < COMBAT.SEPARATION_ITERATIONS; pass++) {
      if (!this.separate(creatures)) break;
    }
  }

  eliminate(killer, victim, reason = null, x = victim.x, y = victim.y) {
    victim.eliminate();
    if (killer !== victim) killer.kills += 1;
    this.events.emit(GameEvent.CREATURE_ELIMINATED, { killer, victim, reason, x, y });
  }

  /**
   * Safe contact: no impulse, no bounce. The overlap is corrected gradually (each body
   * moves its profile's share, so Terra holds its ground), and a soft cue fires at most
   * once per cooldown so AI can choose to go elsewhere.
   */
  easeApart(a, b, dx, dy, dist, reach) {
    this.pushApart(a, b, dx, dy, dist, reach, COMBAT.SAFE_SEPARATION_RATE);
    if (a.bumpCooldown > 0 || b.bumpCooldown > 0) return;
    a.bumpCooldown = b.bumpCooldown = COMBAT.BUMP_COOLDOWN;
    if (a.onBump) a.onBump(b);
    if (b.onBump) b.onBump(a);
    const nx = dist > 0.001 ? dx / dist : 1;
    const ny = dist > 0.001 ? dy / dist : 0;
    this.events.emit(GameEvent.CREATURES_BUMPED, {
      a, b, x: a.x + nx * a.radius, y: a.y + ny * a.radius, strength: 0.25,
    });
  }

  /** Eases overlapping safe pairs apart (extra passes). Returns whether anything moved. */
  separate(creatures) {
    let moved = false;
    for (let i = 0; i < creatures.length; i++) {
      const a = creatures[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < creatures.length; j++) {
        const b = creatures[j];
        if (!b.alive) continue;
        if (!this.isSafe(a) || !this.isSafe(b)) continue; // only safe pairs are eased apart
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const reach = a.radius + b.radius - COMBAT.SEPARATION_SLOP;
        const d2 = dx * dx + dy * dy;
        if (d2 >= reach * reach) continue;
        this.pushApart(a, b, dx, dy, Math.sqrt(d2), reach, COMBAT.SAFE_SEPARATION_RATE);
        moved = true;
      }
    }
    return moved;
  }

  /**
   * Positional correction of `rate` × the overlap, split by each body's contact share
   * (element profile; equal by default), respecting walls.
   */
  pushApart(a, b, dx, dy, dist, reach, rate = 1) {
    // Exactly on top of each other: pick a direction so they can't stay stuck.
    const nx = dist > 0.001 ? dx / dist : Math.cos(a.id * 2.399);
    const ny = dist > 0.001 ? dy / dist : Math.sin(a.id * 2.399);
    const overlap = (reach - dist) * rate;
    const total = a.profile.contactShare + b.profile.contactShare;
    const aShare = a.profile.contactShare / total;
    const bShare = b.profile.contactShare / total;
    a.x -= nx * overlap * aShare;
    a.y -= ny * overlap * aShare;
    b.x += nx * overlap * bShare;
    b.y += ny * overlap * bShare;
    // A creature pinned against the wall can't give way, so the other one takes the push.
    const ax = a.x;
    const ay = a.y;
    a.keepInsideWorld();
    b.x -= ax - a.x;
    b.y -= ay - a.y;
    const bx = b.x;
    const by = b.y;
    b.keepInsideWorld();
    a.x -= bx - b.x;
    a.y -= by - b.y;
    a.keepInsideWorld();
    return { nx, ny };
  }
}
