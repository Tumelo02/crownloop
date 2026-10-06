const TAU = Math.PI * 2;

export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

export const randRange = (min, max) => min + Math.random() * (max - min);

export const randItem = (items) => items[Math.floor(Math.random() * items.length)];

export const distSq = (ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};

/** Frame-rate independent smoothing factor for exponential approach. */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

/** Interpolate between two angles along the shortest arc. */
export const lerpAngle = (from, to, t) => {
  const delta = ((((to - from + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return from + delta * t;
};

export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
};

/** HSL (h in degrees, s/l in 0..1) to [r, g, b] in 0..255. */
export const hslToRgb = (h, s, l) => {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};

export const formatPercent = (value) => `${value < 20
  ? (Math.floor((value + 1e-9) * 10) / 10).toFixed(1)
  : Math.round(value)}%`;

export const formatClock = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export { TAU };
