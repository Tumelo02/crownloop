import { hiss, tone } from './synth.js';

/**
 * The game's sound palette. Each entry: { minInterval, priority?, play(ctx, out, opts) → duration }.
 * minInterval throttles repeats (seconds); priority sounds may use reserved voices. Sonic identities:
 *   food      tiny bright blip, pitch climbs with a pickup streak
 *   territory wide shimmering swell        intercept  low impact
 *   power-ups each its own character       king    short fanfare
 *   death     falling energy collapse
 */
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const SEMITONE = 2 ** (1 / 12);
const ELEMENTAL_SOUND = Object.freeze({
  CORE: { type: 'triangle', cut: 720, death: 260, boost: 470, capture: 560 },
  EMBER: { type: 'sawtooth', cut: 460, death: 185, boost: 330, capture: 410 },
  GLACIER: { type: 'sine', cut: 1040, death: 390, boost: 690, capture: 820 },
  VOID: { type: 'sine', cut: 330, death: 120, boost: 210, capture: 280 },
  TIDAL: { type: 'triangle', cut: 590, death: 210, boost: 390, capture: 480 },
  SOL: { type: 'square', cut: 880, death: 330, boost: 590, capture: 740 },
  TERRA: { type: 'triangle', cut: 390, death: 145, boost: 260, capture: 350 },
  GALE: { type: 'sine', cut: 790, death: 290, boost: 520, capture: 640 },
  VERDANT: { type: 'triangle', cut: 520, death: 195, boost: 350, capture: 450 },
});

/**
 * The element's signature layer on top of a pitched tone: crackle for fire, chime and
 * crack for ice, a low pull for void, splash for water, shimmer for sun, thud and grit
 * for rock, whoosh for wind, rustle for nature, a clean blip for energy.
 * @param {number} base reference pitch (Hz)  @param {number} dur  @param {number} level
 */
function elementTexture(ctx, out, element, base, dur, level) {
  const g = level;
  switch (element) {
    case 'EMBER':
      for (let i = 0; i < 3; i++) {
        hiss(ctx, out, { filter: 'highpass', cutoff: 2400 + i * 700, start: i * dur * 0.28, dur: 0.05, gain: 0.03 * g });
      }
      hiss(ctx, out, { filter: 'bandpass', cutoff: 900, cutoffEnd: 300, q: 0.8, dur: dur * 1.3, gain: 0.03 * g });
      break;
    case 'GLACIER':
      tone(ctx, out, { type: 'sine', freq: base * 2, start: 0.02, dur: dur * 1.4, gain: 0.03 * g });
      tone(ctx, out, { type: 'sine', freq: base * 2.76, start: 0.05, dur: dur * 1.2, gain: 0.018 * g });
      hiss(ctx, out, { filter: 'highpass', cutoff: 5200, dur: 0.035, gain: 0.04 * g });
      break;
    case 'VOID':
      tone(ctx, out, { type: 'sine', freq: 92, freqEnd: 40, dur: dur * 1.3, gain: 0.05 * g });
      hiss(ctx, out, { filter: 'lowpass', cutoff: 420, cutoffEnd: 120, dur: dur * 1.2, gain: 0.04 * g });
      break;
    case 'TIDAL':
      hiss(ctx, out, { filter: 'bandpass', cutoff: 2400, cutoffEnd: 500, q: 1.2, dur: dur * 1.2, gain: 0.035 * g });
      tone(ctx, out, { type: 'sine', freq: base * 0.5, freqEnd: base * 1.1, start: 0.03, dur: 0.09, gain: 0.03 * g });
      break;
    case 'SOL':
      tone(ctx, out, { type: 'sine', freq: base * 1.5, freqEnd: base * 2.2, start: 0.02, dur: dur * 1.2, gain: 0.025 * g });
      tone(ctx, out, { type: 'sine', freq: base * 3, start: 0.05, dur: dur, gain: 0.012 * g });
      break;
    case 'TERRA':
      tone(ctx, out, { type: 'triangle', freq: 95, freqEnd: 45, dur: dur * 0.8, gain: 0.05 * g });
      hiss(ctx, out, { filter: 'lowpass', cutoff: 900, cutoffEnd: 200, dur: dur * 0.9, gain: 0.04 * g });
      break;
    case 'GALE':
      hiss(ctx, out, { filter: 'bandpass', cutoff: 700, cutoffEnd: 3200, q: 2.2, attack: dur * 0.3, dur: dur * 1.3, gain: 0.04 * g });
      break;
    case 'VERDANT':
      hiss(ctx, out, { filter: 'bandpass', cutoff: 1600, cutoffEnd: 2600, q: 3, dur: dur * 0.9, gain: 0.025 * g });
      tone(ctx, out, { type: 'triangle', freq: base * 0.75, freqEnd: base, start: 0.03, dur: dur, gain: 0.025 * g });
      break;
    default: // CORE: clean electronic blip an octave up
      tone(ctx, out, { type: 'sine', freq: base * 2, freqEnd: base * 2.5, start: 0.02, dur: 0.08, gain: 0.025 * g });
  }
}

export const SOUNDS = Object.freeze({
  // ---------------------------------------------------------------- UI
  click: {
    minInterval: 0.04,
    play(ctx, out) {
      tone(ctx, out, { type: 'triangle', freq: 720, freqEnd: 940, dur: 0.07, gain: 0.12 });
      return 0.1;
    },
  },
  play: {
    minInterval: 0.3,
    play(ctx, out) {
      [C5, E5, G5, C6].forEach((f, i) => tone(ctx, out, { type: 'triangle', freq: f, start: i * 0.06, dur: 0.22, gain: 0.12 }));
      hiss(ctx, out, { cutoff: 2500, cutoffEnd: 6000, start: 0.12, dur: 0.3, gain: 0.04 });
      return 0.5;
    },
  },
  restart: {
    minInterval: 0.3,
    play(ctx, out) {
      tone(ctx, out, { type: 'triangle', freq: G5, start: 0, dur: 0.12, gain: 0.12 });
      tone(ctx, out, { type: 'triangle', freq: C6, start: 0.08, dur: 0.22, gain: 0.12 });
      return 0.35;
    },
  },

  // ---------------------------------------------------------------- pickups & territory
  food: {
    minInterval: 0.08, // ~12 blips/s at most while vacuuming a cluster
    play(ctx, out, { tier = 0, streak = 0 }) {
      const base = [1046, 1244, 1480][tier] || 1046;
      const f = base * SEMITONE ** Math.min(streak, 7);
      tone(ctx, out, { freq: f, freqEnd: f * 1.25, dur: 0.07 + tier * 0.02, gain: 0.07 + tier * 0.02 });
      return 0.12;
    },
  },
  territory: {
    priority: true,
    minInterval: 0.3,
    play(ctx, out, { size = 1 }) {
      // Wide, satisfying: detuned pad sweeping open + rising sparkle.
      const dur = 0.6 + Math.min(0.4, size * 0.1);
      tone(ctx, out, { type: 'sawtooth', freq: 196, freqEnd: 392, attack: 0.06, dur, gain: 0.045, detune: -8 });
      tone(ctx, out, { type: 'sawtooth', freq: 196, freqEnd: 392, attack: 0.06, dur, gain: 0.045, detune: 8 });
      hiss(ctx, out, { filter: 'lowpass', cutoff: 500, cutoffEnd: 4000, attack: 0.08, dur, gain: 0.05 });
      [E5, G5, C6].forEach((f, i) => tone(ctx, out, { freq: f, start: 0.12 + i * 0.07, dur: 0.3, gain: 0.06 }));
      return dur + 0.1;
    },
  },
  expand: {
    minInterval: 0.3,
    play(ctx, out) {
      hiss(ctx, out, { cutoff: 600, cutoffEnd: 2000, q: 2, attack: 0.05, dur: 0.4, gain: 0.07 });
      tone(ctx, out, { freq: 330, freqEnd: 495, attack: 0.05, dur: 0.4, gain: 0.07 });
      return 0.45;
    },
  },
  claimBeacon: {
    priority: true,
    minInterval: 1,
    play(ctx, out) {
      [440, 660, 990].forEach((freq, i) => tone(ctx, out, {
        type: 'sine', freq, freqEnd: freq * 1.12, start: i * 0.09, dur: 0.38, gain: 0.055,
      }));
      return 0.55;
    },
  },
  claimBeaconOffline: {
    minInterval: 1,
    play(ctx, out) {
      tone(ctx, out, { type: 'sine', freq: 660, freqEnd: 330, dur: 0.32, gain: 0.045 });
      tone(ctx, out, { type: 'triangle', freq: 440, freqEnd: 220, start: 0.08, dur: 0.28, gain: 0.035 });
      return 0.4;
    },
  },
  fluxCoreOnline: {
    priority: true,
    minInterval: 1,
    play(ctx, out) {
      [392, 587, 784, 1174].forEach((freq, i) => tone(ctx, out, {
        type: 'sine', freq, start: i * 0.07, dur: 0.34, gain: 0.05,
      }));
      return 0.55;
    },
  },
  fluxCorePulse: {
    minInterval: 2.5,
    play(ctx, out) {
      tone(ctx, out, { type: 'triangle', freq: 520, freqEnd: 1040, dur: 0.22, gain: 0.055 });
      tone(ctx, out, { type: 'sine', freq: 780, freqEnd: 1170, start: 0.04, dur: 0.18, gain: 0.035 });
      return 0.28;
    },
  },
  fluxCoreOffline: {
    minInterval: 1,
    play(ctx, out) {
      tone(ctx, out, { type: 'sine', freq: 784, freqEnd: 392, dur: 0.35, gain: 0.045 });
      return 0.4;
    },
  },
  riftOnline: {
    priority: true,
    minInterval: 1,
    play(ctx, out) {
      tone(ctx, out, { type: 'sine', freq: 190, freqEnd: 740, dur: 0.6, gain: 0.06 });
      tone(ctx, out, { type: 'triangle', freq: 380, freqEnd: 160, start: 0.08, dur: 0.45, gain: 0.04 });
      hiss(ctx, out, { filter: 'lowpass', cutoff: 2600, cutoffEnd: 500, dur: 0.38, gain: 0.035 });
      return 0.65;
    },
  },
  riftTransit: {
    priority: true,
    minInterval: 0.12,
    play(ctx, out) {
      hiss(ctx, out, { filter: 'lowpass', cutoff: 2400, cutoffEnd: 350, dur: 0.18, gain: 0.07 });
      tone(ctx, out, { type: 'sine', freq: 260, freqEnd: 1040, dur: 0.22, gain: 0.075 });
      tone(ctx, out, { type: 'triangle', freq: 780, freqEnd: 390, start: 0.08, dur: 0.2, gain: 0.045 });
      return 0.32;
    },
  },
  riftOffline: {
    minInterval: 1,
    play(ctx, out) {
      tone(ctx, out, { type: 'sine', freq: 620, freqEnd: 190, dur: 0.48, gain: 0.04 });
      return 0.52;
    },
  },
  stasisOnline: {
    priority: true,
    minInterval: 1,
    play(ctx, out) {
      tone(ctx, out, { type: 'sine', freq: 840, freqEnd: 280, dur: 0.6, gain: 0.05 });
      tone(ctx, out, { type: 'triangle', freq: 1260, freqEnd: 420, start: 0.08, dur: 0.42, gain: 0.035 });
      return 0.62;
    },
  },
  stasisOffline: {
    minInterval: 1,
    play(ctx, out) {
      tone(ctx, out, { type: 'sine', freq: 330, freqEnd: 880, dur: 0.42, gain: 0.04 });
      return 0.45;
    },
  },

  // ---------------------------------------------------------------- strategic landmarks
  landmarkClaim: {
    // A structure wakes up and binds to a domain: alien power-up, not fantasy magic.
    priority: true,
    minInterval: 1,
    play(ctx, out) {
      tone(ctx, out, { type: 'sawtooth', freq: 82, freqEnd: 330, attack: 0.06, dur: 0.7, gain: 0.06, detune: -7 });
      tone(ctx, out, { type: 'sawtooth', freq: 82, freqEnd: 330, attack: 0.06, dur: 0.7, gain: 0.06, detune: 7 });
      hiss(ctx, out, { filter: 'bandpass', cutoff: 700, cutoffEnd: 3600, q: 1.4, attack: 0.1, dur: 0.55, gain: 0.05 });
      [220, 440, 660, 990].forEach((freq, i) => tone(ctx, out, {
        type: 'sine', freq, freqEnd: freq * 1.06, start: 0.1 + i * 0.08, dur: 0.4, gain: 0.045,
      }));
      tone(ctx, out, { freq: 65, start: 0.32, dur: 0.5, gain: 0.1 });
      return 0.95;
    },
  },
  landmarkLost: {
    minInterval: 1,
    play(ctx, out) {
      tone(ctx, out, { type: 'triangle', freq: 520, freqEnd: 180, dur: 0.4, gain: 0.045 });
      tone(ctx, out, { type: 'sine', freq: 260, freqEnd: 90, start: 0.06, dur: 0.5, gain: 0.05 });
      return 0.55;
    },
  },
  landmarkHum: {
    // Proximity ambience of a structure (non-Rift): alien machine hum. The
    // listener scales it by distance and state (intensity, base pitch).
    minInterval: 2.4,
    play(ctx, out, { intensity = 1, base = 220 } = {}) {
      const g = 0.035 * intensity;
      tone(ctx, out, { type: 'sine', freq: base, freqEnd: base * 1.04, dur: 1.8, gain: g });
      tone(ctx, out, { type: 'triangle', freq: base * 2.01, freqEnd: base * 1.96, start: 0.1, dur: 1.5, gain: g * 0.55 });
      tone(ctx, out, { type: 'sine', freq: base * 3.02, start: 0.2, dur: 1.2, gain: g * 0.3 });
      return 1.9;
    },
  },
  riftAmbient: {
    // Idle Rift presence: a low spatial hum heard only near the gate. `intensity` scales it.
    minInterval: 2.2,
    play(ctx, out, { intensity = 1 }) {
      const g = 0.04 * intensity;
      tone(ctx, out, { type: 'sine', freq: 58, freqEnd: 64, dur: 2.0, gain: g });
      tone(ctx, out, { type: 'sine', freq: 87, freqEnd: 82, dur: 2.0, gain: g * 0.7 });
      tone(ctx, out, { type: 'triangle', freq: 174, freqEnd: 168, start: 0.1, dur: 1.7, gain: g * 0.5 });
      hiss(ctx, out, { filter: 'bandpass', cutoff: 420, cutoffEnd: 900, q: 3, attack: 0.5, dur: 1.6, gain: g * 0.8 });
      return 2.1;
    },
  },
  riftEnter: {
    // Being absorbed: everything is pulled sharply upward into the tear.
    priority: true,
    minInterval: 0.3,
    play(ctx, out) {
      tone(ctx, out, { type: 'sawtooth', freq: 70, freqEnd: 560, attack: 0.03, dur: 0.42, gain: 0.07, detune: -9 });
      tone(ctx, out, { type: 'sawtooth', freq: 70, freqEnd: 560, attack: 0.03, dur: 0.42, gain: 0.07, detune: 9 });
      hiss(ctx, out, { filter: 'bandpass', cutoff: 500, cutoffEnd: 4200, q: 1.6, attack: 0.05, dur: 0.4, gain: 0.06 });
      tone(ctx, out, { type: 'sine', freq: 140, freqEnd: 1120, dur: 0.38, gain: 0.05 });
      return 0.48;
    },
  },
  riftArrive: {
    // Reappearance: spatial snap that lands a beat after the transit.
    priority: true,
    minInterval: 0.3,
    play(ctx, out) {
      tone(ctx, out, { type: 'sine', freq: 900, freqEnd: 220, start: 0.14, dur: 0.3, gain: 0.06 });
      tone(ctx, out, { type: 'triangle', freq: 450, freqEnd: 110, start: 0.16, dur: 0.34, gain: 0.05 });
      hiss(ctx, out, { filter: 'lowpass', cutoff: 3200, cutoffEnd: 400, start: 0.14, dur: 0.3, gain: 0.05 });
      tone(ctx, out, { freq: 70, start: 0.18, dur: 0.4, gain: 0.11 });
      return 0.62;
    },
  },

  // ---------------------------------------------------------------- combat
  intercept: {
    priority: true,
    minInterval: 0.08,
    play(ctx, out) {
      tone(ctx, out, { freq: 190, freqEnd: 50, dur: 0.32, gain: 0.3 });
      hiss(ctx, out, { filter: 'lowpass', cutoff: 1800, cutoffEnd: 200, dur: 0.2, gain: 0.12 });
      tone(ctx, out, { type: 'triangle', freq: 660, freqEnd: 1320, start: 0.05, dur: 0.18, gain: 0.07 });
      return 0.4;
    },
  },
  contact: {
    // Collision / knockback: harder impacts are lower and louder.
    minInterval: 0.3,
    play(ctx, out, { strength = 0.5 }) {
      const k = Math.min(1, Math.max(0, strength));
      tone(ctx, out, { freq: 170 - k * 60, freqEnd: 80 - k * 25, dur: 0.12 + k * 0.08, gain: 0.1 + k * 0.12 });
      hiss(ctx, out, { filter: 'lowpass', cutoff: 900 + k * 700, dur: 0.06 + k * 0.05, gain: 0.05 + k * 0.05 });
      return 0.22;
    },
  },
  danger: {
    minInterval: 2.5,
    play(ctx, out) {
      tone(ctx, out, { type: 'square', freq: 880, dur: 0.08, gain: 0.035 });
      tone(ctx, out, { type: 'square', freq: 660, start: 0.11, dur: 0.1, gain: 0.035 });
      return 0.25;
    },
  },
  death: {
    priority: true,
    minInterval: 1,
    play(ctx, out) {
      tone(ctx, out, { type: 'sawtooth', freq: 440, freqEnd: 45, dur: 0.95, gain: 0.1 });
      tone(ctx, out, { freq: 220, freqEnd: 30, dur: 0.9, gain: 0.18 });
      hiss(ctx, out, { filter: 'lowpass', cutoff: 3000, cutoffEnd: 150, dur: 0.9, gain: 0.1 });
      return 1;
    },
  },
  // Elemental sounds share one recognisable texture per element (elementTexture), so the
  // cut, elimination, boost and capture of a character all "sound like" it. `level` (0..1)
  // lets the caller attenuate by distance from the player.
  // Title-screen character moment: the element's texture, kept soft (menu only).
  showcase: {
    minInterval: 2,
    play(ctx, out, { element = 'CORE' } = {}) {
      const sound = ELEMENTAL_SOUND[element] || ELEMENTAL_SOUND.CORE;
      tone(ctx, out, { type: 'sine', freq: sound.boost * 0.5, freqEnd: sound.boost, attack: 0.08, dur: 0.5, gain: 0.03 });
      elementTexture(ctx, out, element, sound.capture, 0.45, 0.55);
      return 0.6;
    },
  },
  elementalCut: {
    minInterval: 0.07,
    play(ctx, out, { element = 'CORE', level = 1 } = {}) {
      const sound = ELEMENTAL_SOUND[element] || ELEMENTAL_SOUND.CORE;
      tone(ctx, out, {
        type: sound.type, freq: sound.cut, freqEnd: sound.cut * 1.4, dur: 0.16, gain: 0.07 * level,
      });
      elementTexture(ctx, out, element, sound.cut, 0.16, level);
      return 0.24;
    },
  },
  elementalElimination: {
    priority: true,
    minInterval: 0.18,
    play(ctx, out, { element = 'CORE', level = 1 } = {}) {
      const sound = ELEMENTAL_SOUND[element] || ELEMENTAL_SOUND.CORE;
      tone(ctx, out, {
        type: sound.type, freq: sound.death, freqEnd: sound.death * 0.24, dur: 0.62, gain: 0.1 * level,
      });
      tone(ctx, out, {
        type: 'sine', freq: sound.death * 0.5, freqEnd: sound.death * 0.12,
        start: 0.04, dur: 0.55, gain: 0.05 * level,
      });
      elementTexture(ctx, out, element, sound.death * 2, 0.4, level * 1.2);
      return 0.7;
    },
  },
  elementalBoost: {
    minInterval: 0.12,
    play(ctx, out, { element = 'CORE', level = 1 } = {}) {
      const sound = ELEMENTAL_SOUND[element] || ELEMENTAL_SOUND.CORE;
      tone(ctx, out, { type: sound.type, freq: sound.boost, freqEnd: sound.boost * 1.7, dur: 0.18, gain: 0.04 * level });
      elementTexture(ctx, out, element, sound.boost, 0.18, level * 0.6);
      return 0.24;
    },
  },
  elementalTerritory: {
    minInterval: 0.35,
    play(ctx, out, { element = 'CORE', size = 1, level = 1 } = {}) {
      const sound = ELEMENTAL_SOUND[element] || ELEMENTAL_SOUND.CORE;
      const duration = 0.22 + Math.min(0.2, size * 0.025);
      tone(ctx, out, { type: sound.type, freq: sound.capture, freqEnd: sound.capture * 1.25, dur: duration, gain: 0.032 * level });
      elementTexture(ctx, out, element, sound.capture, duration, level * 0.5);
      return duration + 0.04;
    },
  },
  respawn: {
    priority: true,
    minInterval: 1,
    play(ctx, out) {
      tone(ctx, out, { freq: 220, freqEnd: 660, attack: 0.3, dur: 0.5, gain: 0.1 });
      tone(ctx, out, { type: 'triangle', freq: 440, freqEnd: 1320, attack: 0.3, dur: 0.5, gain: 0.05 });
      return 0.55;
    },
  },

  // ---------------------------------------------------------------- movement
  boostOn: {
    minInterval: 0.12,
    play(ctx, out) {
      hiss(ctx, out, { cutoff: 500, cutoffEnd: 2600, q: 1.5, attack: 0.02, dur: 0.26, gain: 0.1 });
      tone(ctx, out, { freq: 280, freqEnd: 620, dur: 0.18, gain: 0.05 });
      return 0.3;
    },
  },
  boostOff: {
    minInterval: 0.12,
    play(ctx, out) {
      hiss(ctx, out, { cutoff: 1800, cutoffEnd: 450, q: 1.5, dur: 0.18, gain: 0.05 });
      return 0.2;
    },
  },

  // ---------------------------------------------------------------- power-ups
  surge: {
    priority: true,
    minInterval: 0.2,
    play(ctx, out) {
      tone(ctx, out, { type: 'sawtooth', freq: 300, freqEnd: 1500, dur: 0.18, gain: 0.07 });
      tone(ctx, out, { type: 'square', freq: 1200, start: 0.12, dur: 0.1, gain: 0.04 });
      hiss(ctx, out, { cutoff: 2000, cutoffEnd: 6000, dur: 0.22, gain: 0.05 });
      return 0.3;
    },
  },
  magnet: {
    priority: true,
    minInterval: 0.2,
    play(ctx, out) {
      tone(ctx, out, { freq: 220, freqEnd: 330, attack: 0.05, dur: 0.5, gain: 0.1, vibrato: 11, vibratoDepth: 25 });
      tone(ctx, out, { freq: 440, freqEnd: 660, attack: 0.05, dur: 0.45, gain: 0.04, vibrato: 11, vibratoDepth: 40 });
      return 0.55;
    },
  },
  vision: {
    priority: true,
    minInterval: 0.2,
    play(ctx, out) {
      tone(ctx, out, { type: 'sine', freq: 520, freqEnd: 1040, attack: 0.03, dur: 0.35, gain: 0.07 });
      tone(ctx, out, { type: 'triangle', freq: 780, start: 0.08, dur: 0.28, gain: 0.045 });
      return 0.4;
    },
  },
  // Zoom: a rising, widening sweep (the view pulls back).
  zoom: {
    priority: true,
    minInterval: 0.2,
    play(ctx, out) {
      tone(ctx, out, { type: 'triangle', freq: 260, freqEnd: 780, attack: 0.02, dur: 0.45, gain: 0.07 });
      tone(ctx, out, { type: 'sine', freq: 390, freqEnd: 1170, start: 0.05, dur: 0.4, gain: 0.04 });
      return 0.5;
    },
  },
  // Tracker: a low sonar ping, then a sharp lock-on.
  tracker: {
    priority: true,
    minInterval: 0.2,
    play(ctx, out) {
      tone(ctx, out, { type: 'sine', freq: 330, freqEnd: 300, attack: 0.01, dur: 0.3, gain: 0.08 });
      tone(ctx, out, { type: 'square', freq: 880, start: 0.16, dur: 0.08, gain: 0.03 });
      tone(ctx, out, { type: 'square', freq: 1175, start: 0.26, dur: 0.08, gain: 0.03 });
      return 0.4;
    },
  },
  // The signature slice: a fast whoosh/cut, then the element's own bite. Every element
  // has a different body so a slice is recognisable by ear.
  slice: {
    priority: true,
    minInterval: 0.06,
    play(ctx, out, { element = 'CORE', level = 1 } = {}) {
      const g = level;
      // The cut itself: a very fast high-to-low filtered noise sweep.
      hiss(ctx, out, { filter: 'bandpass', cutoff: 5200, cutoffEnd: 900, q: 1.6, attack: 0.004, dur: 0.11, gain: 0.16 * g });
      switch (element) {
        case 'EMBER': // fiery whoosh + crackle
          hiss(ctx, out, { filter: 'lowpass', cutoff: 1800, cutoffEnd: 400, start: 0.02, dur: 0.22, gain: 0.12 * g });
          for (let i = 0; i < 4; i++) hiss(ctx, out, { filter: 'highpass', cutoff: 3500, start: 0.04 + i * 0.035, dur: 0.02, gain: 0.07 * g });
          tone(ctx, out, { type: 'sawtooth', freq: 220, freqEnd: 90, start: 0.01, dur: 0.16, gain: 0.05 * g });
          break;
        case 'GLACIER': // crystalline slice + chime
          tone(ctx, out, { type: 'sine', freq: 2600, freqEnd: 1900, start: 0.015, dur: 0.22, gain: 0.07 * g });
          tone(ctx, out, { type: 'sine', freq: 3480, start: 0.03, dur: 0.18, gain: 0.04 * g });
          hiss(ctx, out, { filter: 'highpass', cutoff: 6500, start: 0.01, dur: 0.04, gain: 0.1 * g });
          break;
        case 'VOID': // deep distorted tear
          tone(ctx, out, { type: 'sawtooth', freq: 160, freqEnd: 45, start: 0.01, dur: 0.32, gain: 0.08 * g });
          tone(ctx, out, { type: 'sine', freq: 70, freqEnd: 30, start: 0.02, dur: 0.38, gain: 0.12 * g });
          hiss(ctx, out, { filter: 'lowpass', cutoff: 600, cutoffEnd: 120, start: 0.02, dur: 0.3, gain: 0.08 * g });
          break;
        case 'TIDAL': // water cut + splash
          hiss(ctx, out, { filter: 'bandpass', cutoff: 2600, cutoffEnd: 600, q: 1.1, start: 0.03, dur: 0.2, gain: 0.12 * g });
          tone(ctx, out, { type: 'sine', freq: 380, freqEnd: 780, start: 0.04, dur: 0.07, gain: 0.07 * g });
          break;
        case 'SOL': // bright energetic slash
          tone(ctx, out, { type: 'square', freq: 980, freqEnd: 1600, start: 0.005, dur: 0.12, gain: 0.05 * g });
          tone(ctx, out, { type: 'sine', freq: 1960, freqEnd: 2400, start: 0.03, dur: 0.18, gain: 0.05 * g });
          break;
        case 'TERRA': // heavy rock impact + short whoosh
          tone(ctx, out, { type: 'triangle', freq: 110, freqEnd: 40, start: 0.01, dur: 0.2, gain: 0.16 * g });
          hiss(ctx, out, { filter: 'lowpass', cutoff: 1100, cutoffEnd: 180, start: 0.01, dur: 0.18, gain: 0.12 * g });
          break;
        case 'GALE': // sharp wind blade
          hiss(ctx, out, { filter: 'bandpass', cutoff: 900, cutoffEnd: 4200, q: 3, start: 0.0, dur: 0.16, gain: 0.12 * g });
          hiss(ctx, out, { filter: 'bandpass', cutoff: 4200, cutoffEnd: 1500, q: 3, start: 0.08, dur: 0.12, gain: 0.08 * g });
          break;
        case 'VERDANT': // organic leafy slice
          hiss(ctx, out, { filter: 'bandpass', cutoff: 1900, cutoffEnd: 2900, q: 4, start: 0.02, dur: 0.14, gain: 0.08 * g });
          tone(ctx, out, { type: 'triangle', freq: 300, freqEnd: 520, start: 0.03, dur: 0.14, gain: 0.07 * g });
          break;
        default: // CORE: electric energy slash
          tone(ctx, out, { type: 'sawtooth', freq: 1400, freqEnd: 300, start: 0.005, dur: 0.12, gain: 0.06 * g });
          tone(ctx, out, { type: 'square', freq: 90, start: 0.01, dur: 0.06, gain: 0.04 * g });
          hiss(ctx, out, { filter: 'highpass', cutoff: 4000, start: 0.02, dur: 0.05, gain: 0.07 * g });
      }
      return 0.4;
    },
  },
  // Near your own trail: a quiet, low "lub-dub" (felt more than heard).
  heartbeat: {
    minInterval: 0.5,
    play(ctx, out) {
      tone(ctx, out, { type: 'sine', freq: 62, freqEnd: 44, dur: 0.12, gain: 0.11 });
      tone(ctx, out, { type: 'sine', freq: 56, freqEnd: 40, start: 0.18, dur: 0.12, gain: 0.07 });
      return 0.34;
    },
  },
  capture: {
    priority: true,
    minInterval: 0.25,
    play(ctx, out, { element = 'CORE', size = 20 } = {}) {
      const s = Math.min(1, Math.sqrt(size) / 18); // 0 small .. 1 huge
      const dur = 0.3 + s * 0.6;
      const root = 330 - s * 110; // bigger land, deeper and fuller
      // A rising sweep of energy.
      hiss(ctx, out, { filter: 'bandpass', cutoff: 500, cutoffEnd: 2800 + s * 2000, q: 1.2, attack: dur * 0.3, dur, gain: 0.07 + s * 0.06 });
      tone(ctx, out, { type: 'triangle', freq: root, freqEnd: root * 2, dur: dur * 0.8, gain: 0.07 });
      // Chord that swells with the size of the capture.
      const chord = s > 0.45 ? [1, 1.25, 1.5, 2] : s > 0.2 ? [1, 1.5, 2] : [1, 2];
      chord.forEach((m, i) => {
        tone(ctx, out, { type: 'sine', freq: root * 2 * m, start: 0.06 + i * 0.03, attack: 0.04, dur: dur * (0.9 + s), gain: (0.035 + s * 0.03) / (1 + i * 0.3) });
      });
      if (s > 0.45) tone(ctx, out, { type: 'sine', freq: root * 0.5, start: 0.02, dur: dur * 1.2, gain: 0.08 }); // sub swell
      elementTexture(ctx, out, element, root * 2, dur, 0.7 + s * 0.6);
      return dur * (1.2 + s) + 0.1;
    },
  },
  rankUp: {
    priority: true,
    minInterval: 1,
    play(ctx, out) {
      // A short metallic fanfare: two bright stabs and a ringing fifth.
      tone(ctx, out, { type: 'square', freq: 523, dur: 0.08, gain: 0.05 });
      tone(ctx, out, { type: 'square', freq: 784, start: 0.09, dur: 0.1, gain: 0.05 });
      tone(ctx, out, { type: 'triangle', freq: 1046, start: 0.2, dur: 0.45, gain: 0.07 });
      tone(ctx, out, { type: 'sine', freq: 1568, start: 0.22, dur: 0.4, gain: 0.03 });
      return 0.7;
    },
  },
  multiplier: {
    priority: true,
    minInterval: 0.5,
    play(ctx, out) {
      // A rising alien arpeggio.
      [523, 659, 784, 1046, 1318].forEach((f, i) => {
        tone(ctx, out, { type: 'square', freq: f, start: i * 0.045, dur: 0.09, gain: 0.04 });
      });
      tone(ctx, out, { type: 'sine', freq: 1046, freqEnd: 2093, start: 0.2, dur: 0.25, gain: 0.05 });
      return 0.5;
    },
  },
  multiplierPickup: {
    minInterval: 0.04,
    play(ctx, out, { streak = 0 } = {}) {
      const f = 1320 * 2 ** (Math.min(12, streak) / 12);
      tone(ctx, out, { type: 'square', freq: f, freqEnd: f * 1.5, dur: 0.06, gain: 0.035 });
      return 0.1;
    },
  },
  expire: {
    minInterval: 0.3,
    play(ctx, out) {
      tone(ctx, out, { type: 'triangle', freq: 660, dur: 0.1, gain: 0.06 });
      tone(ctx, out, { type: 'triangle', freq: 440, start: 0.1, dur: 0.16, gain: 0.06 });
      return 0.3;
    },
  },

  // ---------------------------------------------------------------- King
  king: {
    priority: true,
    minInterval: 1,
    play(ctx, out) {
      [C5, E5, G5].forEach((f, i) => tone(ctx, out, { type: 'triangle', freq: f, start: i * 0.09, dur: 0.16, gain: 0.11 }));
      tone(ctx, out, { type: 'triangle', freq: C6, start: 0.27, dur: 0.5, gain: 0.12 });
      tone(ctx, out, { freq: C6 * 2, start: 0.27, dur: 0.4, gain: 0.03 });
      return 0.8;
    },
  },
  kingLost: {
    priority: true,
    minInterval: 1,
    play(ctx, out) {
      [C5, 415.3, 349.2].forEach((f, i) => tone(ctx, out, { type: 'triangle', freq: f, start: i * 0.13, dur: 0.22, gain: 0.09 }));
      return 0.6;
    },
  },
  crownShift: {
    // The crown changed hands between rivals: a quiet chime, not a fanfare.
    minInterval: 2,
    play(ctx, out) {
      tone(ctx, out, { type: 'triangle', freq: G5, dur: 0.18, gain: 0.04 });
      tone(ctx, out, { type: 'triangle', freq: C6, start: 0.09, dur: 0.25, gain: 0.04 });
      return 0.4;
    },
  },
  kingClaim: {
    // The King eliminated a player: heavy, final.
    priority: true,
    minInterval: 0.5,
    play(ctx, out) {
      tone(ctx, out, { freq: 140, freqEnd: 38, dur: 0.6, gain: 0.34 });
      hiss(ctx, out, { filter: 'lowpass', cutoff: 2400, cutoffEnd: 120, dur: 0.45, gain: 0.14 });
      tone(ctx, out, { type: 'sawtooth', freq: 110, start: 0.06, attack: 0.03, dur: 0.7, gain: 0.05, detune: -12 });
      tone(ctx, out, { type: 'sawtooth', freq: 164.8, start: 0.06, attack: 0.03, dur: 0.7, gain: 0.05, detune: 12 });
      tone(ctx, out, { type: 'triangle', freq: C6, start: 0.28, dur: 0.45, gain: 0.06 });
      return 0.9;
    },
  },

  // ---------------------------------------------------------------- coins
  coin: {
    // Metallic "ting": two inharmonic partials with a fast decay.
    minInterval: 0.06,
    play(ctx, out, { big = false }) {
      const f = big ? 1568 : 1975;
      tone(ctx, out, { type: 'triangle', freq: f, dur: 0.22, gain: 0.07 });
      tone(ctx, out, { freq: f * 1.5, start: 0.035, dur: 0.28, gain: 0.05 });
      if (big) tone(ctx, out, { freq: f * 2, start: 0.09, dur: 0.35, gain: 0.04 });
      return 0.4;
    },
  },

  // ---------------------------------------------------------------- territory (big)
  territoryBig: {
    priority: true,
    minInterval: 0.4,
    play(ctx, out) {
      tone(ctx, out, { type: 'sawtooth', freq: 130.8, freqEnd: 392, attack: 0.08, dur: 1.1, gain: 0.05, detune: -10 });
      tone(ctx, out, { type: 'sawtooth', freq: 130.8, freqEnd: 392, attack: 0.08, dur: 1.1, gain: 0.05, detune: 10 });
      hiss(ctx, out, { filter: 'lowpass', cutoff: 400, cutoffEnd: 5000, attack: 0.1, dur: 1, gain: 0.06 });
      [C5, E5, G5, C6].forEach((f, i) => tone(ctx, out, { freq: f, start: 0.15 + i * 0.08, dur: 0.4, gain: 0.06 }));
      return 1.2;
    },
  },

  // ---------------------------------------------------------------- match
  tick: {
    minInterval: 0.5,
    play(ctx, out, { final = false }) {
      tone(ctx, out, { type: 'square', freq: final ? 1320 : 990, dur: 0.05, gain: 0.03 });
      return 0.08;
    },
  },
  victory: {
    priority: true,
    minInterval: 2,
    play(ctx, out) {
      [C5, E5, G5, C6].forEach((f, i) => tone(ctx, out, { type: 'triangle', freq: f, start: i * 0.12, dur: 0.22, gain: 0.11 }));
      [C5, E5, G5].forEach((f) => tone(ctx, out, { type: 'triangle', freq: f * 2, start: 0.5, attack: 0.02, dur: 1.1, gain: 0.06 }));
      tone(ctx, out, { freq: 261.6, start: 0.5, attack: 0.05, dur: 1.2, gain: 0.08 });
      return 1.7;
    },
  },
  matchEnd: {
    priority: true,
    minInterval: 2,
    play(ctx, out) {
      [G5, E5, C5].forEach((f, i) => tone(ctx, out, { type: 'triangle', freq: f, start: i * 0.14, dur: 0.3, gain: 0.08 }));
      tone(ctx, out, { freq: 196, start: 0.42, attack: 0.05, dur: 0.9, gain: 0.07 });
      return 1.4;
    },
  },
  worldTransition: {
    minInterval: 1,
    play(ctx, out) {
      hiss(ctx, out, { cutoff: 300, cutoffEnd: 3200, q: 1.2, attack: 0.25, dur: 0.7, gain: 0.08 });
      tone(ctx, out, { freq: 196, freqEnd: 587, attack: 0.3, dur: 0.7, gain: 0.07 });
      return 0.8;
    },
  },
});
