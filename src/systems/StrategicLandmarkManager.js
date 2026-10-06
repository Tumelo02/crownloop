import { CLAIM_BEACON, FLUX_CORE, LANDMARKS, RIFT, STASIS } from '../config.js';

/** Claim rules are shared; only the announce/kind label differs per structure. */
const KIND_LABELS = Object.freeze({
  beacon: 'BONUS TOWER',
  flux: 'ENERGY CORE',
  rift: 'TELEPORTER',
  stasis: 'SLOW TOWER',
});

function seedOf(lm) {
  if (lm.seed === undefined) {
    const s = Math.sin(lm.x * 12.9898 + lm.y * 78.233) * 43758.5453;
    lm.seed = 1 + (s - Math.floor(s)) * 999;
  }
  return lm.seed;
}

/**
 * StrategicLandmarkManager — the claim state layer shared by all four landmark
 * systems. A landmark becomes claimed when a player's territory actually holds
 * its ground cell (discovered → explored → conquered over), with hysteresis so
 * border flicker never strobes the boundary. It also advances the claim
 * sequence timers the renderer reads (claimT, claimPulse).
 *
 * Gameplay effects (capture bonus, energy bursts, slowing, teleporting) stay in
 * their own systems; this manager only owns *ownership* and returns events.
 */
export class StrategicLandmarkManager {
  constructor() {
    this.events = [];
    this.kinds = [['beacon', null], ['flux', null], ['rift', null], ['stasis', null]];
  }

  reset() {
    this.events.length = 0;
  }

  /**
   * @param {number} dt seconds
   * @param {object} territory TerritorySystem
   * @param {{beacon:object, flux:object, rift:object, stasis:object}} systems
   * @returns {Array<{type:'claimed'|'released', kind:string, label:string, landmark:object, slot:number, previous:number}>}
   */
  update(dt, territory, systems) {
    const events = this.events;
    events.length = 0;
    this.kinds[0][1] = systems.beacon;
    this.kinds[1][1] = systems.flux;
    this.kinds[2][1] = systems.rift;
    this.kinds[3][1] = systems.stasis;

    for (const [kind, system] of this.kinds) {
      if (!system || !system.landmarks) continue;
      for (const lm of system.landmarks) {
        if (lm.ownerSlot === undefined) {
          lm.ownerSlot = 0;
          lm.claimT = 0;
          lm.claimPulse = 0;
          lm.pending = -1;
          lm.pendingT = 0;
          seedOf(lm);
        }
        const center = territory.ownerAt(lm.x, lm.y);
        // Hysteresis: the ground must be held continuously before it changes hands.
        if (center !== lm.pending) {
          lm.pending = center;
          lm.pendingT = 0;
        } else {
          lm.pendingT += dt;
        }
        if (center !== lm.ownerSlot) {
          const needed = center === 0 ? LANDMARKS.CLAIM_RELEASE_TIME : LANDMARKS.CLAIM_TAKE_TIME;
          if (lm.pendingT >= needed) {
            const previous = lm.ownerSlot;
            lm.ownerSlot = center;
            lm.ownerRgb = center > 0 ? territory.rgb[center] : null;
            lm.claimPulse = 1;
            events.push({
              type: center > 0 ? 'claimed' : 'released',
              kind,
              label: KIND_LABELS[kind],
              landmark: lm,
              slot: center,
              previous,
            });
          }
        }

        // Claim sequence: structure powers up, pulse fires, boundary grows out.
        const target = lm.ownerSlot > 0 ? 1 : 0;
        const step = dt / LANDMARKS.CLAIM_SEQUENCE_TIME;
        lm.claimT = target ? Math.min(1, lm.claimT + step) : Math.max(0, lm.claimT - step);
        if (lm.claimPulse > 0) {
          lm.claimPulse = Math.max(0, lm.claimPulse - dt / LANDMARKS.CLAIM_PULSE_TIME);
        }
      }
    }
    return events;
  }
}

export const LANDMARK_KIND_CONFIG = Object.freeze({
  beacon: CLAIM_BEACON,
  flux: FLUX_CORE,
  rift: RIFT,
  stasis: STASIS,
});
