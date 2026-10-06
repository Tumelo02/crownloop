import { ENEMY } from '../config.js';

const character = (definition) => Object.freeze({
  ...definition,
  look: Object.freeze(definition.look),
  palette: Object.freeze(definition.palette),
  visual: Object.freeze(definition.visual),
  animations: Object.freeze(definition.animations),
  territoryEffect: Object.freeze(definition.territoryEffect),
  effects: Object.freeze(definition.effects),
  soundSet: Object.freeze(definition.soundSet),
  unlock: Object.freeze(definition.unlock),
  territory: Object.freeze(definition.territory),
});

const elementalSounds = Object.freeze({
  trailCut: 'elementalCut',
  elimination: 'elementalElimination',
  boost: 'elementalBoost',
  movement: null,
  territoryCapture: 'elementalTerritory',
  powerup: null,
});

/**
 * Character identities are presentation data only. Gameplay reads none of these fields:
 * unlock, rarity, palette, visual style, effects and sounds never alter creature stats.
 */
export const SKINS = Object.freeze([
  character({
    id: 'core', territory: { hue: 172, sat: 80 }, name: 'Core', element: 'CORE', rarity: 'COMMON', cost: 12000,
    unlock: { type: 'coins', cost: 12000 },
    look: { coreHue: 162, shellHue: 205, rimHue: 160, shellLight: 0.13, style: 1 },
    palette: { primary: '#4dfbd0', secondary: '#183e54', accent: '#b1fff0', eye: '#071b25', trail: '#78ffe0', particle: '#9affea' },
    visual: { bodyStyle: 'flow', coreStyle: 'pulse', eyeStyle: 'slit', trailStyle: 'ribbon', particleStyle: 'orb', animationStyle: 'current', boostStyle: 'surge' },
    animations: { idle: 'pulse', movement: 'energy-flow' },
    territoryEffect: { style: 'energy-wave' },
    effects: { cutStyle: 'arc', eliminationStyle: 'collapse' },
    soundSet: elementalSounds,
  }),
  character({
    id: 'ember', territory: { hue: 16, sat: 86 }, name: 'Ember', element: 'EMBER', rarity: 'RARE', cost: 15000,
    unlock: { type: 'coins', cost: 15000 },
    look: { coreHue: 26, shellHue: 8, rimHue: 20, shellLight: 0.18, style: 2 },
    palette: { primary: '#ff7b35', secondary: '#552118', accent: '#ffe1a1', eye: '#32120b', trail: '#ff9a53', particle: '#ffc069' },
    visual: { bodyStyle: 'flame', coreStyle: 'ember', eyeStyle: 'slit', trailStyle: 'cinder', particleStyle: 'spark', animationStyle: 'flicker', boostStyle: 'flare' },
    animations: { idle: 'ember-flicker', movement: 'flame-flow' },
    territoryEffect: { style: 'ember-ring' },
    effects: { cutStyle: 'flare', eliminationStyle: 'burst' },
    soundSet: elementalSounds,
  }),
  character({
    id: 'glacier', territory: { hue: 198, sat: 62 }, name: 'Glacier', element: 'GLACIER', rarity: 'RARE', cost: 15000,
    unlock: { type: 'coins', cost: 15000 },
    look: { coreHue: 194, shellHue: 208, rimHue: 192, shellLight: 0.34, chroma: 0.62, coreChroma: 0.8, style: 0 },
    palette: { primary: '#a9e4fa', secondary: '#35506e', accent: '#f2fcff', eye: '#102535', trail: '#c4ecfb', particle: '#e6f8ff' },
    visual: { bodyStyle: 'crystal', coreStyle: 'prism', eyeStyle: 'lens', trailStyle: 'frost', particleStyle: 'shard', animationStyle: 'glint', boostStyle: 'shard' },
    animations: { idle: 'crystal-glint', movement: 'frost-shimmer' },
    territoryEffect: { style: 'frost-ring' },
    effects: { cutStyle: 'shatter', eliminationStyle: 'shards' },
    soundSet: elementalSounds,
  }),
  character({
    id: 'void', territory: { hue: 268, sat: 70 }, name: 'Void', element: 'VOID', rarity: 'COMMON', cost: 12000,
    unlock: { type: 'coins', cost: 12000 },
    look: { coreHue: 286, shellHue: 258, rimHue: 272, shellLight: 0.1, style: 2 },
    palette: { primary: '#c879ff', secondary: '#251843', accent: '#eed4ff', eye: '#160b26', trail: '#bd82ff', particle: '#dda7ff' },
    visual: { bodyStyle: 'void', coreStyle: 'singularity', eyeStyle: 'ring', trailStyle: 'rift', particleStyle: 'spark', animationStyle: 'orbit', boostStyle: 'rift' },
    animations: { idle: 'orbital-drift', movement: 'light-absorption' },
    territoryEffect: { style: 'void-ripple' },
    effects: { cutStyle: 'rift', eliminationStyle: 'implode' },
    soundSet: elementalSounds,
  }),
  character({
    id: 'tidal', territory: { hue: 214, sat: 82 }, name: 'Tidal', element: 'TIDAL', rarity: 'EPIC', cost: 20000,
    unlock: { type: 'coins', cost: 20000 },
    look: { coreHue: 176, shellHue: 220, rimHue: 182, shellLight: 0.15, style: 0 },
    palette: { primary: '#2fa8e6', secondary: '#123461', accent: '#b6fff6', eye: '#082635', trail: '#3fdad4', particle: '#8df8ee' },
    visual: { bodyStyle: 'tidal', coreStyle: 'wave', eyeStyle: 'ring', trailStyle: 'ripple', particleStyle: 'droplet', animationStyle: 'flow', boostStyle: 'wave' },
    animations: { idle: 'water-pulse', movement: 'fluid-flow' },
    territoryEffect: { style: 'tidal-ripple' },
    effects: { cutStyle: 'ripple', eliminationStyle: 'surge' },
    soundSet: elementalSounds,
  }),
  character({
    id: 'sol', territory: { hue: 50, sat: 92 }, name: 'Sol', element: 'SOL', rarity: 'LEGENDARY', cost: 30000,
    unlock: { type: 'coins', cost: 30000 },
    look: { coreHue: 50, shellHue: 42, rimHue: 50, shellLight: 0.22, style: 1 },
    palette: { primary: '#ffd34d', secondary: '#563b1c', accent: '#fff3b0', eye: '#30200b', trail: '#ffe16a', particle: '#fff0a1' },
    visual: { bodyStyle: 'solar', coreStyle: 'star', eyeStyle: 'slit', trailStyle: 'flare', particleStyle: 'spark', animationStyle: 'radiance', boostStyle: 'corona' },
    animations: { idle: 'solar-radiance', movement: 'coronal-flow' },
    territoryEffect: { style: 'solar-corona' },
    effects: { cutStyle: 'corona', eliminationStyle: 'supernova' },
    soundSet: elementalSounds,
  }),
  character({
    id: 'terra', territory: { hue: 28, sat: 40 }, name: 'Terra', element: 'TERRA', rarity: 'EPIC', cost: 20000,
    unlock: { type: 'coins', cost: 20000 },
    look: { coreHue: 30, shellHue: 24, rimHue: 30, shellLight: 0.09, chroma: 0.42, coreChroma: 0.7, style: 2 },
    palette: { primary: '#b88b61', secondary: '#40312b', accent: '#e7ba80', eye: '#241b18', trail: '#c19a73', particle: '#d7b28c' },
    visual: { bodyStyle: 'stone', coreStyle: 'geode', eyeStyle: 'diamond', trailStyle: 'fault', particleStyle: 'shard', animationStyle: 'tectonic', boostStyle: 'quake' },
    animations: { idle: 'mineral-glow', movement: 'tectonic-shift' },
    territoryEffect: { style: 'earth-fracture' },
    effects: { cutStyle: 'fault', eliminationStyle: 'fracture' },
    soundSet: elementalSounds,
  }),
  character({
    id: 'gale', territory: { hue: 190, sat: 26 }, name: 'Gale', element: 'GALE', rarity: 'RARE', cost: 15000,
    unlock: { type: 'coins', cost: 15000 },
    look: { coreHue: 160, shellHue: 176, rimHue: 164, shellLight: 0.36, chroma: 0.42, coreChroma: 0.72, style: 1 },
    palette: { primary: '#d4eef2', secondary: '#4c6470', accent: '#ffffff', eye: '#102830', trail: '#e2f6f6', particle: '#f4fffd' },
    visual: { bodyStyle: 'gale', coreStyle: 'cyclone', eyeStyle: 'lens', trailStyle: 'stream', particleStyle: 'streak', animationStyle: 'drift', boostStyle: 'gust' },
    animations: { idle: 'wind-drift', movement: 'air-stream' },
    territoryEffect: { style: 'wind-ribbon' },
    effects: { cutStyle: 'gust', eliminationStyle: 'vortex' },
    soundSet: elementalSounds,
  }),
  character({
    id: 'verdant', territory: { hue: 125, sat: 66 }, name: 'Verdant', element: 'VERDANT', rarity: 'LEGENDARY', cost: 28000,
    unlock: { type: 'coins', cost: 28000 },
    look: { coreHue: 112, shellHue: 142, rimHue: 101, shellLight: 0.16, style: 2 },
    palette: { primary: '#75e887', secondary: '#1d493b', accent: '#c8ffd1', eye: '#0c281d', trail: '#91f79e', particle: '#bdffb5' },
    visual: { bodyStyle: 'leaf', coreStyle: 'seed', eyeStyle: 'leaf', trailStyle: 'vine', particleStyle: 'leaf', animationStyle: 'bloom', boostStyle: 'bloom' },
    animations: { idle: 'living-pulse', movement: 'vine-flow' },
    territoryEffect: { style: 'verdant-bloom' },
    effects: { cutStyle: 'thorn', eliminationStyle: 'bloom' },
    soundSet: elementalSounds,
  }),
]);

export const DEFAULT_SKIN_ID = SKINS[0].id;

/**
 * New players get ONE random character from this pool (Common + Rare), so not everyone
 * starts as the same character; Epic and Legendary characters stay something to earn.
 */
export const STARTER_POOL = Object.freeze(SKINS.filter((s) => s.rarity === 'COMMON' || s.rarity === 'RARE').map((s) => s.id));

export function skinById(id) {
  return SKINS.find((skin) => skin.id === id) || SKINS[0];
}

/**
 * The colour a participant's land, trail and particles use: the element's own hue, or the
 * closest variation of it (within the same family) not already taken by someone else.
 * Element identity has priority: Ember stays red/orange even when orange is taken.
 * @param {object} character
 * @param {number[]} usedHues hues already assigned in this world
 * @returns {{ hue: number, sat: number }}
 */
export function elementColor(character, usedHues) {
  const { hue, sat } = character.territory;
  const offsets = [0, 12, -12, 6, -6, 17, -17]; // never more than 17° from the element's hue
  let best = hue;
  let bestGap = -1;
  for (const offset of offsets) {
    const candidate = (hue + offset + 360) % 360;
    let gap = 180;
    for (const used of usedHues) {
      const d = Math.abs(((candidate - used + 540) % 360) - 180);
      gap = Math.min(gap, d);
    }
    if (gap >= 7) return { hue: candidate, sat };
    if (gap > bestGap) {
      bestGap = gap;
      best = candidate;
    }
  }
  return { hue: best, sat };
}

/** Keep rival identities stable by seat while preserving their independent territory hue. */
export function rivalCharacter(slot) {
  return SKINS[(Math.max(0, slot - 2)) % SKINS.length];
}

/** Legacy renderer fallback; gameplay and territory continue to use the participant hue. */
export function rivalLook(_hue, id) {
  return { ...rivalCharacter(id).look, sat: ENEMY.SATURATION };
}
