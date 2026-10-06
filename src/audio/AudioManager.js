import { AUDIO } from '../config.js';
import { MusicPlayer } from './music.js';
import { SOUNDS } from './sounds.js';
import { getNoiseBuffer } from './synth.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function readPrefs() {
  try {
    const data = JSON.parse(window.localStorage.getItem(AUDIO.STORAGE_KEY) || 'null');
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/**
 * Single entry point for all game audio. Nothing else touches the Web Audio API.
 *
 *   master (mute) ─┬─ sfx    × sfxVolume   (sound effects)
 *                  └─ music  × musicVolume (procedural music, see music.js)
 *
 * The context is created on the first real user gesture (unlock()), respecting autoplay
 * rules; music asked for before that starts as soon as audio is allowed. If Web Audio is
 * unavailable every call is a silent no-op. Each sound has a minimum repeat interval and
 * the number of live voices is capped, so a burst of events never turns into noise.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.musicBus = null;
    this.music = null;
    this.wantedMusic = null; // { name, options } requested before audio was allowed
    this.lastPlayed = new Map();
    this.voices = 0;
    this.listeners = [];
    this.platformMuted = false;
    const prefs = readPrefs() || {};
    this.muted = Boolean(prefs.muted); // default: sound ON
    // v1 stored a single "volume": it becomes the SFX volume.
    const sfx = Number.isFinite(prefs.sfxVolume) ? prefs.sfxVolume : prefs.volume;
    this.sfxVolume = Number.isFinite(sfx) ? clamp01(sfx) : AUDIO.DEFAULT_SFX_VOLUME;
    this.musicVolume = Number.isFinite(prefs.musicVolume) ? clamp01(prefs.musicVolume) : AUDIO.DEFAULT_MUSIC_VOLUME;

    // Don't keep a hidden tab humming.
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
    });
    const resumeFromGesture = () => this.unlock();
    for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) {
      window.addEventListener(type, resumeFromGesture, true);
    }
  }

  /** True once unlocked. A context still resuming counts: sounds queue and play as it starts. */
  get ready() {
    return this.ctx !== null && this.ctx.state !== 'closed';
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.sfx = this.ctx.createGain();
        this.musicBus = this.ctx.createGain();
        this.sfx.connect(this.master);
        this.musicBus.connect(this.master);
        this.master.connect(this.ctx.destination);
        this.applyVolume(true);
        this.music = new MusicPlayer(this.ctx, this.musicBus, getNoiseBuffer(this.ctx));
        this.music.onFinished = (name) => this.onMusicFinished(name);
        if (this.wantedMusic) this.music.play(this.wantedMusic.name, this.wantedMusic.options);
      }
      if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null; // audio unavailable: stay silent
    }
  }

  applyVolume(immediate = false) {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    const set = (param, value) => (immediate ? param.setValueAtTime(value, t) : param.setTargetAtTime(value, t, 0.03));
    set(this.master.gain, this.muted || this.platformMuted ? 0 : 1);
    set(this.sfx.gain, AUDIO.SFX_LEVEL * this.sfxVolume);
    set(this.musicBus.gain, AUDIO.MUSIC_LEVEL * this.musicVolume);
  }

  onChange(listener) {
    this.listeners.push(listener);
  }

  changed() {
    this.applyVolume();
    try {
      window.localStorage.setItem(AUDIO.STORAGE_KEY, JSON.stringify({
        muted: this.muted, sfxVolume: this.sfxVolume, musicVolume: this.musicVolume,
      }));
    } catch {
      // Storage unavailable: the preference lasts for this page only.
    }
    for (const listener of this.listeners) listener(this);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.changed();
  }

  setPlatformMuted(muted) {
    this.platformMuted = Boolean(muted);
    this.applyVolume();
  }

  toggleMute() {
    this.setMuted(!this.muted);
  }

  setSfxVolume(volume) {
    this.sfxVolume = clamp01(volume);
    if (this.sfxVolume > 0 && this.muted) this.muted = false;
    this.changed();
  }

  setMusicVolume(volume) {
    this.musicVolume = clamp01(volume);
    if (this.musicVolume > 0 && this.muted) this.muted = false;
    this.changed();
  }

  // ---------------------------------------------------------------- music

  /**
   * 'menu' | 'game' | 'end'. Safe before unlock(): it starts once audio is allowed.
   * @param {{variant?: 'victory'|'result'}} [options]
   */
  playMusic(name, options = {}) {
    this.wantedMusic = { name, options };
    if (this.music) this.music.play(name, options);
  }

  setMusicIntensity(level) {
    if (this.music) this.music.setIntensity(level);
  }

  /** After the end sequence, the menu music comes back. */
  onMusicFinished(name) {
    if (name === 'end' && this.wantedMusic && this.wantedMusic.name === 'end') this.playMusic('menu');
  }

  // ---------------------------------------------------------------- effects

  /**
   * @param {keyof typeof SOUNDS} name
   * @param {object} [opts] sound-specific parameters
   * @returns {boolean} whether it played
   */
  play(name, opts = {}) {
    if (!this.ready || this.muted || this.sfxVolume <= 0) return false;
    const sound = SOUNDS[name];
    if (!sound) return false;
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(name);
    if (last !== undefined && now - last < sound.minInterval) return false;
    // Important cues (King, death, captures, power-ups) get a few reserved voices.
    const cap = sound.priority ? AUDIO.MAX_VOICES + AUDIO.PRIORITY_VOICES : AUDIO.MAX_VOICES;
    if (this.voices >= cap) return false;

    this.lastPlayed.set(name, now);
    try {
      // Directional: an optional stereo position (-1 left .. 1 right) for world sounds.
      let out = this.sfx;
      let panner = null;
      if (opts.pan && this.ctx.createStereoPanner) {
        panner = this.ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
        panner.connect(this.sfx);
        out = panner;
      }
      const duration = sound.play(this.ctx, out, opts) || 0.3;
      this.voices++;
      setTimeout(() => {
        this.voices--;
        if (panner) panner.disconnect();
      }, duration * 1000 + 60);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * The lethal trail-cut "slice": short, punchy, and in the ATTACKER's element.
   * @param {string} attackerElement e.g. 'EMBER'
   * @param {{level?: number, pan?: number}} [opts] distance level and stereo position
   */
  playTrailSliceSound(attackerElement, opts = {}) {
    return this.play('slice', { element: attackerElement, level: opts.level ?? 1, pan: opts.pan ?? 0 });
  }
}
