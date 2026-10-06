// Procedural background music: a tiny look-ahead step sequencer on the AudioManager's
// music bus. No audio files. Tracks crossfade; looping tracks repeat seamlessly.

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI note → Hz
const LOOKAHEAD = 0.15; // seconds scheduled ahead
const TICK_MS = 30;
const FADE_IN = 1.6;
const FADE_OUT = 1.4;

// ---------------------------------------------------------------- voices

function pad(ctx, out, freq, t, dur, gain, cutoff = 900) {
  const g = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  filter.Q.value = 0.4;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(1.2, dur * 0.4));
  g.gain.setValueAtTime(gain, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0, t + dur);
  filter.connect(g).connect(out);
  for (const detune of [-7, 7]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

function pluck(ctx, out, freq, t, dur, gain, type = 'triangle') {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function bass(ctx, out, freq, t, dur, gain) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(700, t);
  filter.frequency.exponentialRampToValueAtTime(180, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(filter).connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function kick(ctx, out, t, gain) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.22);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.3);
}

function noiseHit(ctx, out, noise, t, dur, gain, type, freq) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

// ---------------------------------------------------------------- tracks
// step(ctx, bus, i, t, player): called once per 16th note. bus = { dry, echo }.

const MENU_CHORDS = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]]; // Dm  Bb  F  C
const GAME_CHORDS = [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]]; // Am  F   Dm  E

const TRACKS = {
  /** Atmospheric, mysterious, restrained: slow pads, distant bell notes, a low drone. */
  menu: {
    bpm: 66,
    loop: true,
    step(ctx, bus, i, t, player) {
      const bar = Math.floor(i / 16) % MENU_CHORDS.length;
      const chord = MENU_CHORDS[bar];
      const barLen = player.stepDur * 16;
      if (i % 16 === 0) {
        for (const n of chord) pad(ctx, bus.dry, NOTE(n), t, barLen + 0.8, 0.018, 850);
        pluck(ctx, bus.dry, NOTE(chord[0] - 12), t, barLen, 0.05, 'sine');
      }
      if (i % 2 === 0 && Math.random() < 0.28) {
        const n = chord[Math.floor(Math.random() * 3)] + 24;
        pluck(ctx, bus.echo, NOTE(n), t, 1.4, 0.022, 'sine');
      }
    },
  },

  /** Relentless sci-fi battle pulse, with a minor-key progression and rising synth ostinato. */
  game: {
    bpm: 124,
    loop: true,
    step(ctx, bus, i, t, player) {
      const s = i % 16;
      const bar = Math.floor(i / 16) % GAME_CHORDS.length;
      const chord = GAME_CHORDS[bar];
      const hot = player.intensity > 0;
      if (s === 0 || s === 8 || (hot && (s === 6 || s === 14))) kick(ctx, bus.dry, t, hot ? 0.15 : 0.13);
      if (s === 4 || s === 12) noiseHit(ctx, bus.dry, player.noise, t, 0.15, 0.042, 'bandpass', 1450);
      if (s % 4 === 2 || (hot && s % 2 === 1)) {
        noiseHit(ctx, bus.dry, player.noise, t, 0.04, hot ? 0.022 : 0.016, 'highpass', 8000);
      }
      if (s % 2 === 0) {
        const n = s % 4 === 0 ? chord[0] - 24 : chord[0] - 12;
        bass(ctx, bus.dry, NOTE(n), t, player.stepDur * 1.7, 0.052);
        const arp = [chord[0] + 12, chord[2] + 12, chord[0] + 24, chord[1] + 12];
        pluck(ctx, bus.echo, NOTE(arp[(s / 2) % arp.length]), t, 0.2, hot ? 0.027 : 0.021, 'sawtooth');
      }
      if (s === 0) for (const n of chord) pad(ctx, bus.dry, NOTE(n), t, player.stepDur * 16, 0.009, 1150);
    },
  },

  /** Short result sequence; plays once, then the menu music returns. */
  end: {
    bpm: 84,
    loop: false,
    lengthSteps: 40,
    step(ctx, bus, i, t, player) {
      const win = player.variant === 'victory';
      const seq = win ? [60, 64, 67, 72, 76, 79] : [57, 60, 64, 62, 59, 57];
      if (i < 12 && i % 2 === 0) pluck(ctx, bus.echo, NOTE(seq[i / 2]), t, 0.9, 0.05);
      if (i === 12) {
        const chord = win ? [48, 52, 55, 60] : [45, 48, 52, 57];
        for (const n of chord) pad(ctx, bus.dry, NOTE(n + 12), t, player.stepDur * 26, 0.03, 1600);
        pluck(ctx, bus.dry, NOTE(chord[0] - 12), t, 2.5, 0.08, 'sine');
      }
    },
  },
};

// ---------------------------------------------------------------- player

/** One playing instance of a track, with its own gain for crossfades. */
class TrackInstance {
  constructor(name, def, player, at) {
    this.name = name;
    this.def = def;
    this.gain = player.ctx.createGain();
    this.gain.gain.setValueAtTime(0, at);
    this.gain.gain.linearRampToValueAtTime(1, at + FADE_IN);
    this.gain.connect(player.out);
    // "echo" voices: heard dry (a little quieter) and also sent into the shared delay.
    // The send passes through this instance's gain too, so fades apply to the echo.
    const echo = player.ctx.createGain();
    const dry = player.ctx.createGain();
    dry.gain.value = 0.7;
    this.echoSend = player.ctx.createGain();
    this.echoSend.gain.value = 0.9;
    echo.connect(dry).connect(this.gain);
    echo.connect(this.echoSend).connect(player.echoIn);
    this.bus = { dry: this.gain, echo };
    this.step = 0;
    this.nextTime = at + 0.05;
    this.stopping = false;
  }

  fadeOut(at) {
    this.stopping = true;
    this.gain.gain.cancelScheduledValues(at);
    this.gain.gain.setValueAtTime(this.gain.gain.value, at);
    this.gain.gain.linearRampToValueAtTime(0, at + FADE_OUT);
    this.endAt = at + FADE_OUT + 0.1;
  }

  dispose() {
    try {
      this.gain.disconnect();
      this.echoSend.disconnect();
    } catch {
      // already disconnected
    }
  }
}

export class MusicPlayer {
  /**
   * @param {AudioContext} ctx
   * @param {AudioNode} out the music bus
   * @param {AudioBuffer} noise shared white-noise buffer
   */
  constructor(ctx, out, noise) {
    this.ctx = ctx;
    this.out = out;
    this.noise = noise;
    this.instances = [];
    this.current = null;
    this.intensity = 0;
    this.variant = null;
    this.onFinished = null;
    // A shared echo (delay + feedback through a lowpass) gives the bells their space.
    this.echoIn = ctx.createGain();
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    this.echoIn.connect(delay);
    delay.connect(tone).connect(feedback).connect(delay);
    tone.connect(wet).connect(out);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  get stepDur() {
    return this.current ? 60 / this.current.def.bpm / 4 : 0.13;
  }

  /** Crossfades to a track ('menu' | 'game' | 'end'). No-op if it's already playing. */
  play(name, { variant = null } = {}) {
    const def = TRACKS[name];
    if (!def) return;
    if (this.current && this.current.name === name && !this.current.stopping && def.loop) return;
    const now = this.ctx.currentTime;
    if (this.current) this.current.fadeOut(now);
    this.variant = variant;
    this.intensity = 0;
    this.current = new TrackInstance(name, def, this, now);
    this.instances.push(this.current);
  }

  stop() {
    const now = this.ctx.currentTime;
    for (const inst of this.instances) if (!inst.stopping) inst.fadeOut(now);
    this.current = null;
  }

  setIntensity(level) {
    this.intensity = level;
  }

  tick() {
    const now = this.ctx.currentTime;
    for (let k = this.instances.length - 1; k >= 0; k--) {
      const inst = this.instances[k];
      if (inst.stopping && now >= inst.endAt) {
        inst.dispose();
        this.instances.splice(k, 1);
        continue;
      }
      if (inst.stopping) continue;
      const stepDur = 60 / inst.def.bpm / 4;
      while (inst.nextTime < now + LOOKAHEAD) {
        if (!inst.def.loop && inst.step >= inst.def.lengthSteps) {
          inst.fadeOut(inst.nextTime);
          if (inst === this.current && this.onFinished) {
            const done = this.onFinished;
            setTimeout(() => done(inst.name), 0);
          }
          break;
        }
        // A tab that was suspended can fall behind: skip ahead rather than burst-play.
        if (inst.nextTime < now - 0.25) inst.nextTime = now + 0.02;
        inst.def.step(this.ctx, inst.bus, inst.step, inst.nextTime, { stepDur, intensity: this.intensity, variant: this.variant, noise: this.noise });
        inst.step++;
        inst.nextTime += stepDur;
      }
    }
  }
}
