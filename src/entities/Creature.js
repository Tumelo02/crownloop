import {
  BOOST, CREATURE, ENERGY, MAX_MOVEMENT_SPEED, MOVEMENT, POWER_UPS, SURGE,
} from '../config.js';
import { gameplayProfile } from '../progression/elementProfiles.js';
import { clamp, damp, lerpAngle, randRange } from '../utils/math.js';
import { ARENA } from '../world/arena.js';

export const CreatureState = Object.freeze({
  ALIVE: 'alive',
  ELIMINATED: 'eliminated',
});

/**
 * Shared entity for every creature (player, AI, and later networked players).
 * Body size and normal movement stay fixed. Energy only controls the temporary boost.
 *
 * A creature doesn't know who controls it: something calls setIntent()
 * (local input, AI, or a network message) and update() moves it.
 */
export class Creature {
  constructor({
    id, slot, name, hue, x, y, isPlayer = false, huntGrace = 0, look = null, character = null,
  }) {
    this.id = id;
    this.slot = slot;
    this.name = name;
    this.hue = hue;
    // Look and character are presentation (renderer). The element's small gameplay
    // specialisation comes ONLY through `profile` (see progression/elementProfiles.js).
    this.look = look;
    this.character = character;
    this.profile = gameplayProfile(character && character.element);
    this.isPlayer = isPlayer;

    this.x = x;
    this.y = y;
    this.previousX = x;
    this.previousY = y;
    this.vx = 0;
    this.vy = 0;
    this.heading = Math.random() * Math.PI * 2;
    // Movement is direction + speed: the direction turns toward the input quickly, speed
    // follows the target speed. (vx/vy are derived from these each step.)
    this.moveAngle = this.heading;
    this.moveSpeed = 0;
    // Optional cap on turning speed (rad/s). Players have none (direct control); AI uses
    // one so it moves in readable arcs instead of snapping back over its own trail.
    this.maxTurnRate = Infinity;

    this.radius = CREATURE.RADIUS;
    this.state = CreatureState.ALIVE;
    this.kills = 0;
    this.bonusScore = 0;
    this.energy = BOOST.START_ENERGY;
    this.surgeTime = 0;
    this.magnetTime = 0;
    this.visionTime = 0;
    this.trackerTime = 0; // Tracker power-up: exposed rivals are marked for you
    this.zoomTime = 0; // Zoom power-up: the camera pulls back
    this.multiplierTime = 0;
    // Timed power-ups that ran out during the last update (Game turns them into events).
    this.expired = [];
    this.boostFactor = 0;
    this.isBoosting = false;
    this.boostGlow = 0; // presentation: fades out smoothly after release
    this.environmentSpeedMultiplier = 1;
    this.intent = { x: 0, y: 0, throttle: 0 };
    // Set by TerritorySystem: standing on land this creature has held long enough to be "home".
    this.onHomeTurf = false;
    this.isExposed = false;
    this.nearOwnTrail = false;
    this.bumpCooldown = 0;
    this.boostTime = 0; // seconds into the current boost (element boost kick)
    // Standing on its own land (set by TerritorySystem): the body-contact safety rule.
    this.inSafeArea = false;
    // Seconds during which AI won't start hunting this creature (fresh spawns).
    this.huntGrace = huntGrace;

    // Presentation-only state
    this.displayRadius = this.radius;
    this.phase = Math.random() * 1000;
    this.blinkTimer = randRange(CREATURE.BLINK_INTERVAL_MIN, CREATURE.BLINK_INTERVAL_MAX);
    this.blinkTime = 0;
    this.trail = [];
    this.trailTimer = 0;
  }

  get alive() {
    return this.state === CreatureState.ALIVE;
  }

  get isSurging() {
    return this.surgeTime > 0;
  }

  get energyRatio() {
    return this.energy / BOOST.MAX_ENERGY;
  }

  /**
   * The ONE place movement speed is decided.
   *   normal: base speed (x the element's small base-speed modifier)
   *   boost:  base x boost multiplier (ramped in; + element kick right after starting)
   *   Surge:  base x Surge multiplier
   *   boost + Surge: the stronger of the two, never multiplied together
   * Final safety cap: MAX_MOVEMENT_SPEED.
   */
  getCurrentMovementSpeed() {
    const base = CREATURE.BASE_SPEED * this.profile.baseSpeed;
    let multiplier = 1;
    if (this.boostFactor > 0) {
      const kick = this.boostTime < BOOST.KICK_TIME ? this.profile.boostKick : 0;
      multiplier = Math.max(multiplier, 1 + (BOOST.SPEED_MULTIPLIER + kick - 1) * this.boostFactor);
    }
    if (this.isSurging) multiplier = Math.max(multiplier, SURGE.SPEED_MULTIPLIER);
    return Math.min(base * multiplier * this.environmentSpeedMultiplier, MAX_MOVEMENT_SPEED);
  }

  get maxSpeed() {
    return this.getCurrentMovementSpeed();
  }

  /** Turn rate (1/s) toward the input direction. */
  get turnRate() {
    let rate = (1 / MOVEMENT.TURN_SMOOTHING) * this.profile.turn;
    if (this.isBoosting) rate *= Math.min(1, MOVEMENT.BOOST_TURN_FACTOR * this.profile.boostTurn);
    return rate;
  }

  get acceleration() {
    return CREATURE.BASE_ACCELERATION * (this.isSurging ? SURGE.ACCELERATION_MULTIPLIER : 1);
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  setIntent(x, y, throttle) {
    const length = Math.hypot(x, y);
    const intent = this.intent;
    if (length === 0 || throttle <= 0) {
      intent.x = intent.y = intent.throttle = 0;
      return;
    }
    intent.x = x / length;
    intent.y = y / length;
    intent.throttle = clamp(throttle, 0, 1);
  }

  addEnergy(amount) {
    const restored = Math.max(0, Math.min(amount, BOOST.MAX_ENERGY - this.energy));
    this.energy += restored;
    return restored;
  }

  /**
   * An energy pickup: fills the meter (never past 100%); whatever the meter can't hold
   * becomes a little score. Element modifiers apply here and only here.
   * @returns {{ amount: number, points: number }}
   */
  collectEnergy(value) {
    const gained = value * this.profile.energyPickup;
    const amount = this.addEnergy(gained);
    const overflow = gained - amount;
    let points = overflow > 1e-6
      ? Math.max(1, Math.round(overflow * ENERGY.OVERFLOW_ENERGY_SCORE_VALUE * this.profile.overflowScore))
      : 0;
    // 5X: every pickup also pays value x 5 in score (the meter refill is unchanged).
    const multiplied = this.multiplierTime > 0;
    if (multiplied) points += value * POWER_UPS.MULTIPLIER.FACTOR;
    this.bonusScore += points;
    return { amount, points, multiplied };
  }

  applySurge(duration) {
    this.surgeTime = duration;
  }

  applyPowerUp(type) {
    switch (type) {
      case 'surge':
        this.applySurge(SURGE.DURATION);
        break;
      case 'magnet':
        this.magnetTime = POWER_UPS.MAGNET.DURATION;
        break;
      case 'vision':
        this.visionTime = POWER_UPS.VISION.DURATION;
        break;
      case 'tracker':
        this.trackerTime = POWER_UPS.TRACKER.DURATION;
        break;
      case 'zoom':
        this.zoomTime = POWER_UPS.ZOOM.DURATION;
        break;
      case 'multiplier':
        this.multiplierTime = POWER_UPS.MULTIPLIER.DURATION;
        break;
      default:
        return false;
    }
    return true;
  }

  /**
   * Press-and-hold boost drains only the energy meter. Release and empty energy stop it.
   */
  updateBoost(dt, held) {
    const wasBoosting = this.isBoosting;
    this.isBoosting = Boolean(held && this.energy > BOOST.MINIMUM_BOOST_ENERGY);
    if (this.isBoosting) {
      this.boostTime = wasBoosting ? this.boostTime + dt : 0;
      this.energy = Math.max(0, this.energy - BOOST.ENERGY_DRAIN_PER_SECOND * this.profile.boostDrain * dt);
      if (this.energy <= BOOST.MINIMUM_BOOST_ENERGY) {
        this.energy = 0;
        this.isBoosting = false;
      }
    }
    if (this.isBoosting) this.boostFactor += (1 - this.boostFactor) * damp(10, dt);
    else this.boostFactor = 0;
    if (wasBoosting && !this.isBoosting) this.endBoost();
    return wasBoosting || this.isBoosting;
  }

  /** Release → normal speed immediately (not a slow coast down from boost speed). */
  endBoost() {
    this.boostFactor = 0;
    this.boostTime = 0;
    const max = this.maxSpeed;
    if (this.moveSpeed > max) this.moveSpeed = max;
    const speed = this.speed;
    if (speed > max) {
      this.vx *= max / speed;
      this.vy *= max / speed;
    }
  }

  eliminate() {
    this.state = CreatureState.ELIMINATED;
    this.vx = this.vy = 0;
    this.moveSpeed = 0;
    this.boostFactor = 0;
    this.isBoosting = false;
    this.energy = 0;
    this.boostGlow = 0;
    this.surgeTime = this.magnetTime = this.visionTime = this.multiplierTime = this.trackerTime = this.zoomTime = 0;
    this.setIntent(0, 0, 0);
    this.trail.length = 0;
  }

  update(dt) {
    if (!this.alive) return;

    this.previousX = this.x;
    this.previousY = this.y;
    // Direct control: the direction turns toward the input with a small time constant
    // (no velocity blending, so no rubber band), and speed follows the target speed.
    const intent = this.intent;
    const targetSpeed = this.maxSpeed * intent.throttle;
    if (intent.throttle > 0) {
      const target = lerpAngle(this.moveAngle, Math.atan2(intent.y, intent.x), damp(this.turnRate, dt));
      if (Number.isFinite(this.maxTurnRate)) { // (Infinity × a zero dt would be NaN)
        const delta = Math.atan2(Math.sin(target - this.moveAngle), Math.cos(target - this.moveAngle));
        const limit = this.maxTurnRate * this.profile.turn * dt;
        this.moveAngle += Math.max(-limit, Math.min(limit, delta));
      } else {
        this.moveAngle = target;
      }
    }
    this.moveSpeed += (targetSpeed - this.moveSpeed) * damp(this.acceleration, dt);
    this.vx = Math.cos(this.moveAngle) * this.moveSpeed;
    this.vy = Math.sin(this.moveAngle) * this.moveSpeed;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.keepInsideWorld();

    if (this.moveSpeed > CREATURE.HEADING_MIN_SPEED) {
      this.heading = lerpAngle(this.heading, this.moveAngle, damp(CREATURE.HEADING_TURN_RATE, dt));
    }

    if (this.huntGrace > 0) this.huntGrace = Math.max(0, this.huntGrace - dt);
    this.expired.length = 0;
    this.surgeTime = this.tick(this.surgeTime, dt, 'surge');
    this.magnetTime = this.tick(this.magnetTime, dt, 'magnet');
    this.visionTime = this.tick(this.visionTime, dt, 'vision');
    this.trackerTime = this.tick(this.trackerTime, dt, 'tracker');
    this.zoomTime = this.tick(this.zoomTime, dt, 'zoom');
    this.multiplierTime = this.tick(this.multiplierTime, dt, 'multiplier');
    if (this.bumpCooldown > 0) this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    this.updatePresentation(dt);
  }

  /** Counts a power-up timer down; notes it in `expired` the moment it runs out. */
  tick(time, dt, type) {
    if (time <= 0) return 0;
    const next = Math.max(0, time - dt);
    if (next === 0) this.expired.push(type);
    return next;
  }

  /**
   * The arena rim is a solid wall: you slide along it (the outward part of the velocity is
   * removed), nothing else happens.
   */
  keepInsideWorld() {
    const max = ARENA.R - this.radius;
    const dx = this.x - ARENA.CX;
    const dy = this.y - ARENA.CY;
    const d2 = dx * dx + dy * dy;
    if (d2 <= max * max) return;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    this.x = ARENA.CX + nx * max;
    this.y = ARENA.CY + ny * max;
    const outward = this.vx * nx + this.vy * ny;
    if (outward > 0) {
      this.vx -= outward * nx;
      this.vy -= outward * ny;
    }
  }

  updatePresentation(dt) {
    const glowTarget = this.isBoosting ? 1 : 0;
    this.boostGlow += (glowTarget - this.boostGlow) * damp(BOOST.GLOW_FADE_RATE, dt);
    this.displayRadius += (this.radius - this.displayRadius) * damp(CREATURE.RADIUS_ANIM_RATE, dt);

    if (this.blinkTime > 0) {
      this.blinkTime = Math.max(0, this.blinkTime - dt);
    } else {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkTime = CREATURE.BLINK_DURATION;
        this.blinkTimer = randRange(CREATURE.BLINK_INTERVAL_MIN, CREATURE.BLINK_INTERVAL_MAX);
      }
    }

    // Afterimage trail grows while surging and drains when it ends.
    this.trailTimer -= dt;
    if (this.trailTimer <= 0) {
      this.trailTimer = SURGE.TRAIL_INTERVAL;
      if (this.isSurging || this.boostGlow > 0.4) {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > SURGE.TRAIL_LENGTH) this.trail.shift();
      } else if (this.trail.length > 0) {
        this.trail.shift();
      }
    }
  }
}
