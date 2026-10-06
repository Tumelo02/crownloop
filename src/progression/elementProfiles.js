/**
 * Element gameplay profiles: the ONLY place an element changes gameplay.
 *
 * Gameplay code never checks `element === 'EMBER'`; it reads a creature's `profile`
 * (built here from its character's element) through neutral modifiers. Every modifier is
 * clamped to PROFILE_LIMITS, so no element (or future character) can become an extreme
 * build, and rebalancing after playtests only touches ELEMENT_PROFILES below.
 *
 * Design rule: each element gets one small, situational advantage and one limitation.
 */

/** Neutral values: a profile with nothing set plays exactly like the base game. */
const NEUTRAL = Object.freeze({
  baseSpeed: 1, // × normal movement speed
  turn: 1, // × turn responsiveness
  boostTurn: 1, // extra × turn responsiveness while boosting (Glacier keeps control at speed)
  boostDrain: 1, // × energy drained per second of boost
  boostKick: 0, // + boost multiplier for the first BOOST.KICK_TIME seconds of a boost
  energyPickup: 1, // × energy gained per pickup
  overflowScore: 1, // × score from pickups collected at full energy
  contactShare: 0.5, // share of a safe-vs-safe separation this creature moves (lower = steadier)
  territoryVisibility: 1, // × brightness of its own land and capture feedback (presentation for its owner)
  detectability: 1, // × the range at which rivals notice / label it (never invisible)
});

/** Hard caps per modifier: [min, max]. */
export const PROFILE_LIMITS = Object.freeze({
  baseSpeed: [0.94, 1.04],
  turn: [0.85, 1.2],
  boostTurn: [1, 1.34],
  boostDrain: [0.9, 1.15],
  boostKick: [0, 0.12],
  energyPickup: [0.9, 1.15],
  overflowScore: [0.6, 1],
  contactShare: [0.25, 0.5],
  territoryVisibility: [1, 1.3],
  detectability: [0.8, 1.2],
});

/** Advantage + limitation per element (only differences from NEUTRAL). */
export const ELEMENT_PROFILES = Object.freeze({
  // Energy management: pickups give a little more. No defensive edge.
  CORE: { energyPickup: 1.08 },
  // Aggressive movement: a short extra kick when a boost starts; boosting drains faster.
  EMBER: { boostKick: 0.1, boostDrain: 1.12 },
  // Precision: keeps full turning control at boost speed; slightly slower base speed.
  GLACIER: { boostTurn: 1.33, baseSpeed: 0.96 },
  // Resource collection: pickups refill more; overflow scoring is weaker.
  TIDAL: { energyPickup: 1.12, overflowScore: 0.7 },
  // A small star: always a little faster; it blazes, so rivals notice it from farther away.
  // (Its land also reads brighter for its owner: presentation only, not counted as an edge.)
  SOL: { baseSpeed: 1.03, detectability: 1.15, territoryVisibility: 1.25 },
  // Steady stone: boosts last longer and it is hard to shove in body contact; turns slower.
  // (No knockback: contact is never a weapon.)
  TERRA: { boostDrain: 0.9, contactShare: 0.25, turn: 0.9 },
  // Agility: quicker turning; slightly lower base speed.
  GALE: { turn: 1.15, baseSpeed: 0.96 },
  // Living growth: more energy per pickup and nimbler turning; overflow scoring is weaker.
  VERDANT: { energyPickup: 1.1, turn: 1.06, overflowScore: 0.8 },
  // Uncertainty: rivals notice it later (never hidden); a little less energy per pickup.
  VOID: { detectability: 0.8, energyPickup: 0.95 },
});

const cache = new Map();

/**
 * @param {string|undefined} element character.element
 * @returns {typeof NEUTRAL} frozen, clamped profile
 */
export function gameplayProfile(element) {
  const key = element || 'NONE';
  let profile = cache.get(key);
  if (!profile) {
    const merged = { ...NEUTRAL, ...(ELEMENT_PROFILES[element] || {}) };
    for (const [name, [min, max]] of Object.entries(PROFILE_LIMITS)) {
      merged[name] = Math.min(max, Math.max(min, merged[name]));
    }
    profile = Object.freeze(merged);
    cache.set(key, profile);
  }
  return profile;
}

export const NEUTRAL_PROFILE = gameplayProfile(undefined);
