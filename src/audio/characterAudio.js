import { GameEvent } from '../core/EventBus.js';
import { SKINS } from '../progression/skins.js';

function stopNode(node) {
  try { node.stop && node.stop(); } catch {}
  try { node.disconnect && node.disconnect(); } catch {}
}

function connectTone(ctx, output, spec, nodes) {
  const at = ctx.currentTime + (spec.start || 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = spec.type || 'sine';
  osc.frequency.setValueAtTime(spec.freq, at);
  if (spec.freqEnd) osc.frequency.exponentialRampToValueAtTime(spec.freqEnd, at + (spec.dur || 0.2));
  if (spec.detune) osc.detune.value = spec.detune;
  const peak = Math.max(0.0001, spec.gain || 0.12);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + (spec.attack || 0.02));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + (spec.dur || 0.2));
  osc.connect(gain).connect(output);
  osc.start(at);
  osc.stop(at + (spec.dur || 0.2) + 0.04);
  nodes.push(osc, gain);
}

function connectNoise(ctx, output, spec, nodes) {
  const at = ctx.currentTime + (spec.start || 0);
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter || 'bandpass';
  filter.Q.value = spec.q || 1;
  filter.frequency.setValueAtTime(spec.cutoff, at);
  if (spec.cutoffEnd) filter.frequency.exponentialRampToValueAtTime(spec.cutoffEnd, at + (spec.dur || 0.2));
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, spec.gain || 0.08), at + (spec.attack || 0.02));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + (spec.dur || 0.2));
  src.connect(filter).connect(gain).connect(output);
  src.start(at);
  src.stop(at + (spec.dur || 0.2) + 0.04);
  nodes.push(src, filter, gain);
}

const profiles = Object.freeze({
  CORE: {
    duration: 0.56,
    gain: 0.22,
    layers: [
      { type: 'triangle', freq: 720, freqEnd: 980, dur: 0.18, gain: 0.06 },
      { type: 'sawtooth', freq: 280, freqEnd: 430, start: 0.06, dur: 0.18, gain: 0.05 },
      { filter: 'bandpass', cutoff: 2600, cutoffEnd: 9000, dur: 0.2, gain: 0.04, q: 1.2 },
    ],
  },
  EMBER: {
    duration: 0.68,
    gain: 0.22,
    layers: [
      { type: 'sawtooth', freq: 150, freqEnd: 240, dur: 0.2, gain: 0.07 },
      { type: 'triangle', freq: 430, freqEnd: 820, start: 0.04, dur: 0.22, gain: 0.06 },
      { filter: 'highpass', cutoff: 2200, cutoffEnd: 6200, start: 0.02, dur: 0.26, gain: 0.05, q: 1.4 },
    ],
  },
  GLACIER: {
    duration: 0.75,
    gain: 0.18,
    layers: [
      { type: 'sine', freq: 1100, freqEnd: 1800, dur: 0.22, gain: 0.05 },
      { type: 'sine', freq: 1560, freqEnd: 2440, start: 0.04, dur: 0.3, gain: 0.035 },
      { filter: 'bandpass', cutoff: 3800, cutoffEnd: 2100, start: 0.05, dur: 0.3, gain: 0.035, q: 2 },
    ],
  },
  VOID: {
    duration: 0.82,
    gain: 0.18,
    layers: [
      { type: 'sine', freq: 92, freqEnd: 42, dur: 0.4, gain: 0.065 },
      { type: 'triangle', freq: 180, freqEnd: 72, start: 0.08, dur: 0.36, gain: 0.045 },
      { filter: 'lowpass', cutoff: 620, cutoffEnd: 150, dur: 0.5, gain: 0.05, q: 0.9 },
    ],
  },
  TIDAL: {
    duration: 0.72,
    gain: 0.19,
    layers: [
      { type: 'sine', freq: 280, freqEnd: 520, dur: 0.24, gain: 0.06 },
      { type: 'triangle', freq: 420, freqEnd: 660, start: 0.04, dur: 0.2, gain: 0.04 },
      { filter: 'bandpass', cutoff: 2000, cutoffEnd: 700, dur: 0.32, gain: 0.045, q: 1.1 },
    ],
  },
  SOL: {
    duration: 0.7,
    gain: 0.22,
    layers: [
      { type: 'triangle', freq: 580, freqEnd: 980, dur: 0.2, gain: 0.06 },
      { type: 'sine', freq: 920, freqEnd: 1760, start: 0.05, dur: 0.28, gain: 0.045 },
      { filter: 'bandpass', cutoff: 3600, cutoffEnd: 9200, start: 0.04, dur: 0.24, gain: 0.032, q: 1.2 },
    ],
  },
  TERRA: {
    duration: 0.64,
    gain: 0.19,
    layers: [
      { type: 'triangle', freq: 110, freqEnd: 62, dur: 0.24, gain: 0.07 },
      { type: 'sine', freq: 240, freqEnd: 150, start: 0.06, dur: 0.18, gain: 0.04 },
      { filter: 'lowpass', cutoff: 760, cutoffEnd: 180, dur: 0.4, gain: 0.045, q: 0.8 },
    ],
  },
  GALE: {
    duration: 0.68,
    gain: 0.18,
    layers: [
      { type: 'sine', freq: 420, freqEnd: 760, dur: 0.18, gain: 0.05 },
      { filter: 'bandpass', cutoff: 1100, cutoffEnd: 4200, dur: 0.28, gain: 0.052, q: 2.2 },
      { filter: 'highpass', cutoff: 700, cutoffEnd: 2600, start: 0.03, dur: 0.26, gain: 0.04, q: 1.5 },
    ],
  },
  VERDANT: {
    duration: 0.78,
    gain: 0.18,
    layers: [
      { type: 'triangle', freq: 240, freqEnd: 420, dur: 0.26, gain: 0.06 },
      { type: 'sine', freq: 420, freqEnd: 620, start: 0.05, dur: 0.22, gain: 0.04 },
      { filter: 'bandpass', cutoff: 1600, cutoffEnd: 2600, start: 0.08, dur: 0.3, gain: 0.035, q: 2 },
    ],
  },
});

export class CharacterAudioSystem {
  constructor(audio, eventBus = null) {
    this.audio = audio;
    this.eventBus = eventBus;
    this.lastSelectedId = null;
    this.currentNodes = [];
  }

  stopCurrent() {
    for (const node of this.currentNodes) stopNode(node);
    this.currentNodes = [];
  }

  resolveSkin(skinOrId) {
    if (!skinOrId) return null;
    if (typeof skinOrId === 'string') {
      return SKINS.find((skin) => skin.id === skinOrId) || null;
    }
    return SKINS.some((skin) => skin.id === skinOrId.id) ? skinOrId : null;
  }

  playSelection(skinOrId, options = {}) {
    const { force = false } = options;
    const skin = this.resolveSkin(skinOrId);
    if (!skin) return false;
    if (!force && this.lastSelectedId === skin.id) return false;
    this.lastSelectedId = skin.id;
    if (!this.audio || !this.audio.ready || this.audio.muted || this.audio.sfxVolume <= 0) return false;
    this.stopCurrent();
    const ctx = this.audio.ctx;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, (this.audio.sfxVolume || 0.7) * 0.24), ctx.currentTime + 0.01);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (profiles[skin.element]?.duration || 0.6));
    master.connect(this.audio.sfx);
    this.currentNodes.push(master);

    const profile = profiles[skin.element] || profiles.CORE;
    for (const layer of profile.layers) {
      if (layer.filter) connectNoise(ctx, master, { ...layer, dur: layer.dur || 0.2 }, this.currentNodes);
      else connectTone(ctx, master, { ...layer, dur: layer.dur || 0.2 }, this.currentNodes);
    }

    if (this.eventBus) {
      this.eventBus.emit(GameEvent.CHARACTER_SELECTED, {
        skinId: skin.id,
        element: skin.element,
        name: skin.name,
      });
    }
    return true;
  }
}
