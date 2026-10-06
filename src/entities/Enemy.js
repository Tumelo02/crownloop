import { CLAIM_BEACON, DIFFICULTY, ENEMY, FLUX_CORE, RIFT } from '../config.js';
import { clamp, distSq, randRange } from '../utils/math.js';
import { Creature } from './Creature.js';
import { ARENA, arenaDistance, clampToArena } from '../world/arena.js';

/** Current bot difficulty (EASY / NORMAL / HARD multipliers), set at the start of a match. */
let LEVEL = DIFFICULTY.LEVELS[DIFFICULTY.DEFAULT];
export function setBotDifficulty(id) {
  LEVEL = DIFFICULTY.LEVELS[id] || DIFFICULTY.LEVELS[DIFFICULTY.DEFAULT];
}

export const AIState = Object.freeze({
  WANDER: 'wander',
  CHASE: 'chase',
});

/**
 * AI-controlled creature. It hunts opponents with open trails, otherwise gathers energy
 * and expands its own territory. Contact rule (V10): touching a rival while exposed is
 * lethal (both die if both are exposed), so when it is off its land it steers clear of
 * bodies and goes for the rival's TRAIL instead; from its own land it may body-check.
 * Territory follows the same loop rule as the player: once its trail outside its land
 * is long enough, it heads back to the nearest land it owns to close the loop.
 * Territory war: from its own land it keeps a GOAL for a few seconds: push its border
 * outward (expand), loop through a neighbour's land to steal it (raid), or forage. Bigger
 * empires take bigger loops, and an open trail makes it hurry (boosting home when long).
 * It only ever calls setIntent(), exactly like the player's input does.
 */
export class Enemy extends Creature {
  constructor(options) {
    super(options);
    this.homeX = options.x;
    this.homeY = options.y;
    // Behaviour profile (aggressive / opportunist / explorer / defensive), stable per seat.
    this.personaName = ENEMY.PERSONA_ORDER[Math.max(0, options.slot - 2) % ENEMY.PERSONA_ORDER.length];
    const persona = ENEMY.PERSONAS[this.personaName];
    this.persona = persona;
    this.ai = {
      state: AIState.WANDER,
      target: null,
      waypointX: 0,
      waypointY: 0,
      decisionTimer: 0,
      chaseTime: 0,
      chaseCooldown: options.chaseGrace || 0,
      forageDelay: options.forageDelay || 0, // seconds before it starts seeking energy
      aggression: randRange(...persona.aggression),
      loopLimit: randRange(...persona.loopCells),
      // ...and by path length too: wandering back over its own cells adds path, not cells.
      loopPoints: randRange(...persona.loopPoints),
      returning: false,
      widenTime: 0, // seconds left of the sideways "widen the loop" leg before heading home
      boostHeld: false,
      eventAgility: 1,
      eventChaseBias: 1,
      goal: null, // 'expand' | 'raid' | 'forage'
      goalTime: 0,
    };
    this.homeTarget = { x: 0, y: 0 };
    this.centre = { x: 0, y: 0 };
    this.grudgeSlot = options.grudgeSlot || 0; // who knocked this seat out last time
    this.ai.aggression *= LEVEL.aggression;
    this.maxTurnRate = ENEMY.MAX_TURN_RATE * LEVEL.turn;
    this.pickWaypoint();
  }

  /**
   * @param {{ creatures: Creature[], energy: import('./Energy.js').EnergyField,
   *   territory: import('../systems/TerritorySystem.js').TerritorySystem,
   *   claimBeacon?: import('../systems/ClaimBeaconSystem.js').ClaimBeaconSystem,
   *   fluxCore?: import('../systems/FluxCoreSystem.js').FluxCoreSystem,
   *   rift?: import('../systems/RiftSystem.js').RiftSystem }} world
   */
  think(dt, world) {
    if (!this.alive) return;
    const ai = this.ai;
    this.world = world;
    ai.decisionTimer -= dt;
    if (ai.widenTime > 0) {
      ai.widenTime -= dt;
      const wx = ai.waypointX - this.x;
      const wy = ai.waypointY - this.y;
      if (wx * wx + wy * wy < ENEMY.WAYPOINT_REACHED * ENEMY.WAYPOINT_REACHED) ai.widenTime = 0;
      if (ai.widenTime <= 0) ai.decisionTimer = 0; // now plan the way home
    }
    ai.chaseCooldown = Math.max(0, ai.chaseCooldown - dt);
    ai.forageDelay = Math.max(0, ai.forageDelay - dt);
    ai.goalTime = Math.max(0, ai.goalTime - dt);

    if (ai.state === AIState.CHASE) {
      ai.chaseTime += dt;
      const target = ai.target;
      if (!target || !target.alive || ai.chaseTime > ENEMY.MAX_CHASE_TIME * LEVEL.chase
        || !target.isExposed) {
        this.endChase();
      }
    }

    if (ai.decisionTimer <= 0) {
      this.decide(world);
      ai.decisionTimer = randRange(ENEMY.DECISION_INTERVAL_MIN, ENEMY.DECISION_INTERVAL_MAX) * LEVEL.think;
    }

    this.steer();
  }

  decide(world) {
    const ai = this.ai;
    let prey = null;
    let preyDist = Infinity;
    let invader = null; // a rival with an open trail in (or right at) our land
    let grudge = null; // whoever knocked this seat out last time
    let danger = false; // our trail is open and a rival is right on us
    const persona = this.persona;
    const territory = world.territory;
    const exposed = territory.trailLength(this.slot) > 0;
    for (const other of world.creatures) {
      if (other === this || !other.alive) continue;
      const d2 = distSq(this.x, this.y, other.x, other.y);
      if (exposed && d2 < ENEMY.DANGER_RANGE * ENEMY.DANGER_RANGE) danger = true;
      if (other.huntGrace > 0 || !other.isExposed) continue;
      // Elements that are harder to notice (Void) are sensed from a little closer.
      const sense = ENEMY.SENSE_RANGE * persona.sense * other.profile.detectability * LEVEL.sense;
      if (other.slot === this.grudgeSlot && d2 < (sense * ENEMY.GRUDGE_SENSE) ** 2) grudge = other;
      if (d2 < ENEMY.DEFEND_RANGE * ENEMY.DEFEND_RANGE && this.invades(other, territory)) invader = other;
      if (d2 < sense * sense && d2 < preyDist && this.wouldHunt(other, d2, world)) {
        prey = other;
        preyDist = d2;
      }
    }

    // Exposed and someone is on top of us: run home now (boosting), no detours.
    if (danger && !ai.returning && ai.state !== AIState.CHASE) {
      ai.returning = true;
      ai.widenTime = 0;
      ai.fleeing = true;
    }

    if (ai.state === AIState.CHASE) return; // still a valid chase

    // Fighting back comes first: defend our land, then settle the score with our last killer.
    const fight = Math.min(0.97, LEVEL.fight);
    const counter = invader && Math.random() < ENEMY.DEFEND_CHANCE * fight ? invader
      : grudge && Math.random() < ENEMY.GRUDGE_CHANCE * fight ? grudge : null;
    if (counter && !danger) {
      ai.state = AIState.CHASE;
      ai.target = counter;
      ai.chaseTime = 0;
      return;
    }

    if (prey && ai.chaseCooldown <= 0) {
      const chance = (ai.aggression + (prey.isPlayer ? ENEMY.PLAYER_INTEREST_BONUS + LEVEL.playerBonus : 0)) * ai.eventChaseBias;
      if (Math.random() < chance) {
        ai.state = AIState.CHASE;
        ai.target = prey;
        ai.chaseTime = 0;
        return;
      }
    }

    ai.state = AIState.WANDER;
    ai.target = null;

    // Close the loop: a long enough trail means it's time to head back to its own land.
    const trail = world.territory.trailLength(this.slot);
    if (trail === 0 && ai.returning) {
      ai.returning = false; // captured
      ai.fleeing = false;
      ai.widenTime = 0;
      ai.loopLimit = randRange(...persona.loopCells);
      ai.loopPoints = randRange(...persona.loopPoints);
      ai.goalTime = 0; // fresh goal after every capture
      this.pickWaypoint();
    }
    const scale = this.loopScale(world.territory);
    if (!ai.returning && (trail >= ai.loopLimit * scale
      || world.territory.trailPaths[this.slot].length >= ai.loopPoints * scale)) {
      ai.returning = true;
      this.startWidening(world.territory);
    }
    if (ai.returning && ai.widenTime > 0) return; // still swinging wide
    if (ai.returning) {
      const home = world.territory.nearestOwnedCell(this.x, this.y, this.slot, ENEMY.RETURN_SEARCH_CELLS, this.homeTarget);
      if (home) {
        this.planReturn(world.territory, home.x, home.y);
        return;
      }
      ai.returning = false; // nothing owned nearby: keep wandering, the trail keeps growing
    }

    if (trail > 0) return; // keep a stable heading while exposed instead of chasing new energy
    // Territory war: pick (or keep) a goal. Expanding and raiding set their own waypoint.
    if (ai.goalTime <= 0) {
      ai.goalTime = ENEMY.GOAL_TIME;
      const roll = Math.random();
      const raid = persona.raid * LEVEL.aggression;
      const expand = persona.expand * LEVEL.expand;
      if (ai.forageDelay <= 0 && roll < raid && this.pickRaidWaypoint(world)) ai.goal = 'raid';
      else if (ai.forageDelay <= 0 && roll < raid + expand && this.pickExpansionWaypoint(world.territory)) ai.goal = 'expand';
      else ai.goal = 'forage';
    }
    if (ai.goal !== 'forage') return;
    const energy = ai.forageDelay > 0 ? null : world.energy.findNearest(this.x, this.y, ENEMY.ENERGY_SEARCH_RANGE);
    if (energy) {
      ai.waypointX = energy.x;
      ai.waypointY = energy.y;
    }
    const beacon = world.claimBeacon && world.claimBeacon.active;
    const beaconDistance = beacon ? distSq(this.x, this.y, beacon.x, beacon.y) : Infinity;
    if (beacon && beaconDistance < CLAIM_BEACON.BOT_INTEREST_RANGE ** 2
      && Math.random() < CLAIM_BEACON.BOT_INTEREST_CHANCE) {
      ai.waypointX = beacon.x;
      ai.waypointY = beacon.y;
    }
    const core = world.fluxCore && world.fluxCore.active;
    const coreDistance = core ? distSq(this.x, this.y, core.x, core.y) : Infinity;
    if (core && coreDistance < FLUX_CORE.BOT_INTEREST_RANGE ** 2
      && Math.random() < FLUX_CORE.BOT_INTEREST_CHANCE) {
      ai.waypointX = core.x;
      ai.waypointY = core.y;
    }
    const rift = world.rift && world.rift.active;
    const riftDistance = rift ? distSq(this.x, this.y, rift.x, rift.y) : Infinity;
    if (rift && world.territory.trailLength(this.slot) === 0
      && riftDistance < RIFT.BOT_INTEREST_RANGE ** 2
      && Math.random() < RIFT.BOT_INTEREST_CHANCE) {
      ai.waypointX = rift.x;
      ai.waypointY = rift.y;
    }
  }

  steer() {
    const ai = this.ai;
    let dx = 0;
    let dy = 0;
    let throttle = ENEMY.WANDER_THROTTLE;

    if (ai.state === AIState.CHASE) {
      // From safe ground, the body itself is a valid target; when exposed, a head-on
      // touch would take both out, so aim at a point on the prey's open trail.
      const aim = this.inSafeArea ? ai.target : this.trailAimPoint(ai.target) || ai.target;
      dx = aim.x - this.x;
      dy = aim.y - this.y;
      throttle = ENEMY.CHASE_THROTTLE;
    } else {
      dx = ai.waypointX - this.x;
      dy = ai.waypointY - this.y;
      if (dx * dx + dy * dy < ENEMY.WAYPOINT_REACHED * ENEMY.WAYPOINT_REACHED) {
        this.pickWaypoint();
        dx = ai.waypointX - this.x;
        dy = ai.waypointY - this.y;
      }
    }

    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;

    // Galaxy events lightly bias bot movement without changing the game rules.
    const agility = ai.eventAgility || 1;
    throttle *= agility;
    if (agility < 1) {
      const steerScale = 0.6 + (1 - agility) * 0.75;
      dx *= steerScale;
      dy *= steerScale;
    }

    // Off its own land, any touch is lethal: veer away from nearby bodies.
    if (!this.inSafeArea && this.world) {
      for (const other of this.world.creatures) {
        if (other === this || !other.alive) continue;
        const ox = this.x - other.x;
        const oy = this.y - other.y;
        const range = this.radius + other.radius + ENEMY.CONTACT_AVOID_DISTANCE;
        const d2 = ox * ox + oy * oy;
        if (d2 >= range * range || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = ((range - d) / range) * ENEMY.CONTACT_AVOID_STRENGTH;
        dx += (ox / d) * push;
        dy += (oy / d) * push;
      }
    }

    // Steer away from the rim so creatures don't pin themselves against it.
    const avoid = ENEMY.WALL_AVOID_DISTANCE;
    const fromCentre = arenaDistance(this.x, this.y);
    const toRim = ARENA.R - fromCentre;
    if (toRim < avoid && fromCentre > 0) {
      const push = ((avoid - toRim) / avoid) * ENEMY.WALL_AVOID_STRENGTH;
      dx -= ((this.x - ARENA.CX) / fromCentre) * push;
      dy -= ((this.y - ARENA.CY) / fromCentre) * push;
    }

    // Slow into sharp turns (like a driver): a tighter circle, so it never orbits a nearby
    // waypoint and runs over its own trail.
    const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - this.moveAngle), Math.cos(Math.atan2(dy, dx) - this.moveAngle)));
    if (off > ENEMY.TURN_SLOWDOWN_ANGLE) {
      const k = Math.min(1, (off - ENEMY.TURN_SLOWDOWN_ANGLE) / (Math.PI - ENEMY.TURN_SLOWDOWN_ANGLE));
      throttle *= 1 - k * (1 - ENEMY.TURN_SLOWDOWN_MIN);
    }

    // An open trail is a risk: hurry, and boost home once the loop is long.
    if (ai.state !== AIState.CHASE && this.isExposed) throttle = Math.max(throttle, ENEMY.EXPOSED_THROTTLE * agility);
    this.setIntent(dx, dy, throttle);
    const territory = this.world?.territory;
    const longTrail = ai.returning && territory
      && territory.trailLength(this.slot) >= ai.loopLimit * this.loopScale(territory) * ENEMY.RETURN_BOOST_SHARE;
    this.ai.boostHeld = (ai.state === AIState.CHASE || longTrail || ai.fleeing) && this.energy > this.persona.boostMin;
  }

  /** A rival whose open trail runs through (or right along) this bot's land is invading it. */
  invades(other, territory) {
    const path = territory.trailPaths[other.slot];
    if (!path || path.length < 3) return false;
    for (let i = path.length - 1; i >= 0; i -= 4) {
      const p = path[i];
      if (territory.ownerAt(p.x, p.y) === this.slot) return true;
    }
    return false;
  }

  /** Bigger empires take bigger bites: x1 for a fresh start, up to x(1 + LOOP_GROWTH_MAX). */
  loopScale(territory) {
    return 1 + Math.min(ENEMY.LOOP_GROWTH_MAX, Math.sqrt(territory.countFor(this.slot)) / ENEMY.LOOP_GROWTH);
  }

  /**
   * Expand: a point past its own border, roughly on the side it is already on (away from
   * its land's centre), so the loop it draws pushes the border outward.
   */
  pickExpansionWaypoint(territory) {
    const c = territory.centroidFor(this.slot, this.centre);
    if (!c) return false;
    const size = territory.cellSize;
    const radius = Math.sqrt((territory.countFor(this.slot) * size * size) / Math.PI);
    const outward = Math.hypot(this.x - c.x, this.y - c.y) > 1
      ? Math.atan2(this.y - c.y, this.x - c.x) : Math.random() * Math.PI * 2;
    const angle = outward + randRange(-0.9, 0.9);
    const dist = radius + randRange(...ENEMY.EXPAND_REACH) * Math.min(1.6, this.loopScale(territory));
    this.setWaypoint(c.x + Math.cos(angle) * dist, c.y + Math.sin(angle) * dist, ENEMY.SPAWN_MARGIN);
    return true;
  }

  /**
   * Raid: head into a nearby rival's land (preferring big, close empires: the leaders get
   * attacked most) so the loop it closes steals their cells.
   */
  pickRaidWaypoint(world) {
    const territory = world.territory;
    let best = null;
    let bestScore = 0;
    for (const other of world.creatures) {
      if (other === this || !other.alive) continue;
      const cells = territory.countFor(other.slot);
      if (cells < ENEMY.RAID_MIN_CELLS) continue;
      const c = territory.centroidFor(other.slot, this.centre);
      if (!c) continue;
      const d = Math.hypot(c.x - this.x, c.y - this.y);
      if (d > ENEMY.RAID_RANGE) continue;
      const score = cells / (300 + d);
      if (score > bestScore) {
        bestScore = score;
        best = { x: c.x, y: c.y };
      }
    }
    if (!best) return false;
    this.setWaypoint(best.x + randRange(-120, 120), best.y + randRange(-120, 120), ENEMY.SPAWN_MARGIN);
    return true;
  }

  /**
   * Knocked back by a rival: don't grind against it. Drop any chase and
   * head off at an angle away from it (unless it's on its way home to close a loop).
   */
  onBump(other) {
    const ai = this.ai;
    if (ai.state === AIState.CHASE && ai.target === other) this.endChase();
    if (ai.returning) return;
    const away = Math.atan2(this.y - other.y, this.x - other.x) + randRange(-0.9, 0.9);
    const dist = randRange(ENEMY.BUMP_RETREAT_MIN, ENEMY.BUMP_RETREAT_MAX);
    const margin = ENEMY.SPAWN_MARGIN;
    this.setWaypoint(this.x + Math.cos(away) * dist, this.y + Math.sin(away) * dist, margin);
    ai.decisionTimer = Math.max(ai.decisionTimer, ENEMY.BUMP_COMMIT_TIME);
  }

  /**
   * Before turning for home, swing sideways (away from the outgoing leg of its trail) so
   * the way back doesn't run alongside the way out: a wide loop instead of a hairpin.
   */
  startWidening(territory) {
    const ai = this.ai;
    const home = territory.nearestOwnedCell(this.x, this.y, this.slot, ENEMY.RETURN_SEARCH_CELLS, this.homeTarget);
    const path = territory.trailPaths[this.slot];
    if (!home || path.length < 4) return;
    const hx = home.x - this.x;
    const hy = home.y - this.y;
    const mid = path[Math.floor(path.length / 3)];
    // Which side of the line home is the outgoing leg on? Swing to the other side.
    const side = hx * (mid.y - this.y) - hy * (mid.x - this.x) > 0 ? -1 : 1;
    const len = Math.hypot(hx, hy) || 1;
    const dist = clamp(len * 0.6, ENEMY.WIDEN_MIN, ENEMY.WIDEN_MAX);
    const margin = ENEMY.SPAWN_MARGIN;
    this.setWaypoint(this.x + (-hy / len) * side * dist + (hx / len) * dist * 0.3,
      this.y + (hx / len) * side * dist + (hy / len) * dist * 0.3, margin);
    ai.widenTime = ENEMY.WIDEN_TIME;
  }

  /**
   * Head home without running over its own trail: go straight if that's clear; otherwise
   * try the point where the trail left its land; otherwise swing wide to one side (the
   * side whose detour is clear) and re-plan at the next decision.
   */
  planReturn(territory, homeX, homeY) {
    const ai = this.ai;
    const reach = this.radius + ENEMY.RETURN_CLEARANCE;
    const clear = (tx, ty) => !territory.pathCrossesTrail(this.slot, this.x, this.y, tx, ty, reach);
    if (clear(homeX, homeY)) {
      ai.waypointX = homeX;
      ai.waypointY = homeY;
      return;
    }
    // The nearest land is usually right where the trail left it: look for the nearest
    // piece of its own land with a clear approach instead.
    const reachable = territory.nearestOwnedCellWhere(this.x, this.y, this.slot, ENEMY.RETURN_SEARCH_CELLS,
      clear, this.homeTarget);
    if (reachable) {
      ai.waypointX = reachable.x;
      ai.waypointY = reachable.y;
      return;
    }
    const toHome = Math.atan2(homeY - this.y, homeX - this.x);
    for (const turn of [ENEMY.RETURN_DETOUR_ANGLE, -ENEMY.RETURN_DETOUR_ANGLE, Math.PI / 2, -Math.PI / 2]) {
      const { x: tx, y: ty } = clampToArena(this.x + Math.cos(toHome + turn) * ENEMY.RETURN_DETOUR_DISTANCE,
        this.y + Math.sin(toHome + turn) * ENEMY.RETURN_DETOUR_DISTANCE, ENEMY.SPAWN_MARGIN);
      if (clear(tx, ty)) {
        ai.waypointX = tx;
        ai.waypointY = ty;
        return;
      }
    }
    ai.waypointX = homeX; // boxed in: take the direct line and hope
    ai.waypointY = homeY;
  }

  /** A point on the prey's open trail, a little behind its head (null if no trail). */
  trailAimPoint(prey) {
    const path = this.world && this.world.territory.trailPaths[prey.slot];
    if (!path || path.length < 6) return null;
    return path[Math.max(0, path.length - 1 - ENEMY.TRAIL_AIM_POINTS)];
  }

  /**
   * Profile filter on top of "exposed and in range":
   *   guard: only rivals that come near its home   easy: long open trails, or very close
   */
  wouldHunt(other, d2, world) {
    const p = this.persona;
    if (p.hunt === 'guard') {
      const g = p.guardRange;
      return distSq(this.homeX, this.homeY, other.x, other.y) < g * g;
    }
    if (p.hunt === 'easy') {
      return world.territory.trailLength(other.slot) >= p.minPreyTrail || d2 < p.easyRange * p.easyRange;
    }
    return true;
  }

  endChase() {
    const ai = this.ai;
    ai.state = AIState.WANDER;
    ai.target = null;
    ai.chaseCooldown = this.persona.chaseCooldown;
    ai.decisionTimer = 0;
  }

  /** Waypoints always land at least `margin` inside the arena rim. */
  setWaypoint(x, y, margin) {
    const p = clampToArena(x, y, margin);
    this.ai.waypointX = p.x;
    this.ai.waypointY = p.y;
  }

  pickWaypoint() {
    const margin = ENEMY.SPAWN_MARGIN;
    if (this.isExposed) {
      // Trail open: keep going roughly forward (a U-turn would run over its own trail).
      const angle = this.moveAngle + randRange(-ENEMY.EXPOSED_WAYPOINT_SPREAD, ENEMY.EXPOSED_WAYPOINT_SPREAD);
      const dist = randRange(250, 600);
      this.setWaypoint(this.x + Math.cos(angle) * dist, this.y + Math.sin(angle) * dist, margin);
      return;
    }
    const roam = Math.random() < this.persona.roamChance;
    const originX = roam ? this.x : this.homeX;
    const originY = roam ? this.y : this.homeY;
    const range = roam ? ENEMY.ROAM_RANGE : this.persona.homeRange;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * range;
    this.setWaypoint(originX + Math.cos(angle) * dist, originY + Math.sin(angle) * dist, margin);
    // A long roam relocates home: the creature settles wherever it ends up.
    if (roam) {
      this.homeX = this.ai.waypointX;
      this.homeY = this.ai.waypointY;
    }
  }
}
