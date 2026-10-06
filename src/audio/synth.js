// Tiny procedural synth helpers. Every sound in the game is built from these,
// so there are no audio files to load. All times are in seconds from `at`.

let noiseBuffer = null;

function noise(ctx) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function envelope(ctx, gainNode, at, attack, dur, peak) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, at);
  g.exponentialRampToValueAtTime(Math.max(0.0001, peak), at + attack);
  g.exponentialRampToValueAtTime(0.0001, at + dur);
}

/**
 * One oscillator voice.
 * @param {object} o
 * @param {OscillatorType} [o.type]
 * @param {number} o.freq start frequency
 * @param {number} [o.freqEnd] glide target
 * @param {number} [o.start] offset from now
 * @param {number} o.dur
 * @param {number} [o.gain]
 * @param {number} [o.attack]
 * @param {number} [o.vibrato] LFO rate (Hz)
 * @param {number} [o.vibratoDepth] LFO depth (Hz)
 */
export function tone(ctx, dest, o) {
  const at = ctx.currentTime + (o.start || 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.freq, at);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, at + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = o.vibrato;
    depth.gain.value = o.vibratoDepth || 10;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(at);
    lfo.stop(at + o.dur + 0.05);
  }
  envelope(ctx, gain, at, o.attack || 0.005, o.dur, o.gain || 0.2);
  osc.connect(gain).connect(dest);
  osc.start(at);
  osc.stop(at + o.dur + 0.05);
}

/**
 * Filtered noise burst (whooshes, impacts, collapses).
 * @param {object} o
 * @param {BiquadFilterType} [o.filter]
 * @param {number} o.cutoff
 * @param {number} [o.cutoffEnd]
 * @param {number} [o.q]
 */
export function hiss(ctx, dest, o) {
  const at = ctx.currentTime + (o.start || 0);
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = o.filter || 'bandpass';
  filter.Q.value = o.q || 1;
  filter.frequency.setValueAtTime(o.cutoff, at);
  if (o.cutoffEnd) filter.frequency.exponentialRampToValueAtTime(o.cutoffEnd, at + o.dur);
  const gain = ctx.createGain();
  envelope(ctx, gain, at, o.attack || 0.01, o.dur, o.gain || 0.15);
  src.connect(filter).connect(gain).connect(dest);
  src.start(at, Math.random() * 0.5);
  src.stop(at + o.dur + 0.05);
}

/** Shared one-second white-noise buffer (also used by the music). */
export function getNoiseBuffer(ctx) {
  return noise(ctx);
}
