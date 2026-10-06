/**
 * Capture waves: "I just conquered this piece of alien territory."
 *
 * When a loop closes, a wave in the capturer's element spreads from the point where the
 * loop was closed through exactly the newly claimed area (clipped to a smooth outline of
 * the claimed cells AND the land outline), then settles. Larger captures: longer,
 * stronger waves and a final pulse across the whole area. Each element has its own personality:
 *   EMBER   a warm energy front with sparks          GLACIER crystalline frost spikes
 *   VERDANT organic growth (wavy front + leaves)      VOID    an inward dimensional ripple
 *   TIDAL   rolling water rings                      SOL     a radiant solar burst (rays)
 *   TERRA   cracks spreading through the ground      GALE    wind streaks sweeping across
 *   CORE    an electric front
 * Pooled; a handful of fills per wave per frame; nothing allocated per frame but gradients.
 */

import { traceOutline } from './territoryShapes.js';

const TAU = Math.PI * 2;
const MAX_WAVES = 10;
const ICE = '#3fb2e6';
const WIND = '#5f9fc0';

const easeOut = (k) => 1 - (1 - k) ** 3;
const easeOutQuad = (k) => 1 - (1 - k) ** 2;
const SPREAD = 0.72; // share of the wave's life spent spreading; the rest settles
const rnd = (seed, i) => {
  const s = Math.sin(seed * 91.7 + i * 47.3) * 43758.5453;
  return s - Math.floor(s);
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (hex, a) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};

export class CaptureWaves {
  constructor() {
    this.waves = [];
  }

  clear() {
    this.waves.length = 0;
  }

  /**
   * @param {object} character capturer's character (element + palette)
   * @param {{cells:number[], count:number}} capture from TerritorySystem.capture
   * @param {number} ox origin (where the loop closed) @param {number} oy
   * @param {object} territory for cell geometry and the smooth outline
   * @param {number} strength 1 for the player, quieter for rivals
   */
  emit(character, capture, ox, oy, territory, strength = 1) {
    if (!capture.cells || capture.cells.length === 0) return;
    const size = territory.cellSize;
    const cols = territory.cols;
    const owners = territory.owners;
    const claimed = new Set(capture.cells);
    let c0 = Infinity;
    let c1 = -Infinity;
    let r0 = Infinity;
    let r1 = -Infinity;
    for (const index of capture.cells) {
      const col = index % cols;
      const row = (index - col) / cols;
      if (col < c0) c0 = col;
      if (col > c1) c1 = col;
      if (row < r0) r0 = row;
      if (row > r1) r1 = row;
    }
    // A smooth outline of the claimed cells (no squares at the wave's edge), grown one
    // cell into the capturer's existing land so there is no seam along the old border.
    const slot = capture.slot;
    const isIn = (c, r) => {
      const i = r * cols + c;
      if (claimed.has(i)) return true;
      return owners[i] === slot && (claimed.has(i - 1) || claimed.has(i + 1)
        || claimed.has(i - cols) || claimed.has(i + cols));
    };
    const outline = traceOutline(isIn, Math.max(0, c0 - 1), Math.min(cols - 1, c1 + 1),
      Math.max(0, r0 - 1), Math.min(territory.rows - 1, r1 + 1), size);
    const clip = outline.path;
    const minX = (c0 - 1) * size;
    const minY = (r0 - 1) * size;
    const maxX = (c1 + 2) * size;
    const maxY = (r1 + 2) * size;
    const maxDist = Math.max(
      Math.hypot(minX - ox, minY - oy), Math.hypot(maxX - ox, minY - oy),
      Math.hypot(minX - ox, maxY - oy), Math.hypot(maxX - ox, maxY - oy),
    ) + size;
    const count = capture.count;
    if (this.waves.length >= MAX_WAVES) this.waves.shift();
    const tierFactor = count >= 450 ? 1.55 : count >= 150 ? 1.25 : 1;
    this.waves.push({
      element: character.element,
      palette: character.palette,
      slot: capture.slot,
      clip, minX, minY, maxX, maxY, ox, oy, maxDist,
      age: 0,
      dur: Math.min(2.5, 0.85 + Math.sqrt(count) * 0.055),
      power: Math.min(2.1, 0.7 + count / 220) * tierFactor * strength,
      big: count >= 150,
      huge: count >= 450,
      seed: Math.random() * 1000,
    });
  }

  update(dt) {
    dt = Math.max(0, dt);
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.age += dt;
      if (w.age >= w.dur) this.waves.splice(i, 1);
    }
  }

  /** Drawn right after the land fill (before trails). */
  draw(ctx, zoom, territory, bounds) {
    if (this.waves.length === 0) return;
    const shapes = territory.shapes.get(bounds);
    const px = 1 / zoom;
    for (const w of this.waves) {
      if (w.maxX < bounds.left || w.minX > bounds.right || w.maxY < bounds.top || w.minY > bounds.bottom) continue;
      ctx.save();
      ctx.clip(w.clip);
      const outline = shapes.get(w.slot);
      if (outline && outline.minX !== Infinity) ctx.clip(outline.path, 'evenodd');
      drawWave(ctx, w, px);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

function drawWave(ctx, w, px) {
  const k = w.age / w.dur;
  const p = w.palette;
  const inward = w.element === 'VOID';
  // The front crosses the area steadily over the first ~70% of the wave, then settles.
  const spread = easeOutQuad(Math.min(1, k / SPREAD));
  const front = inward ? w.maxDist * (1 - spread) : w.maxDist * spread;
  const band = Math.max(36, Math.min(140, w.maxDist * 0.25));
  const fade = Math.max(0, Math.min(1, 1 - (k - SPREAD + 0.1) / 0.28)); // front details fade as it arrives
  const power = w.power;
  const main = w.element === 'GLACIER' ? ICE : w.element === 'GALE' ? WIND : p.primary;
  const { ox, oy } = w;
  const fillArea = () => ctx.fillRect(w.minX, w.minY, w.maxX - w.minX, w.maxY - w.minY);

  // 1) The wash: the conquered area lights up behind the front (Void darkens instead).
  ctx.globalAlpha = 1;
  if (inward) {
    ctx.fillStyle = rgba('#1a0630', 0.22 * Math.sin(Math.min(1, k * 1.2) * Math.PI) * power);
    fillArea();
  } else {
    ctx.fillStyle = rgba(main, 0.2 * (1 - k) * power);
    ctx.beginPath();
    ctx.arc(ox, oy, front, 0, TAU);
    ctx.fill();
  }

  // 2) The front: a bright band at the wave's edge.
  const inner = Math.max(0, front - band);
  const outer = front + band * 0.3;
  if (outer > 0) {
    const g = ctx.createRadialGradient(ox, oy, inner, ox, oy, outer);
    const bandColor = inward ? '#7a2bd6' : main;
    g.addColorStop(0, rgba(bandColor, 0));
    g.addColorStop(0.75, rgba(bandColor, 0.5 * fade * power));
    g.addColorStop(1, rgba(bandColor, 0));
    ctx.fillStyle = g;
    fillArea();
  }

  // 3) Element personality along the front.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (w.element) {
    case 'EMBER': { // sparks riding the warm front
      for (let i = 0; i < 36; i++) {
        const a = rnd(w.seed, i) * TAU;
        const r = front - band * 0.3 * rnd(w.seed, i + 40);
        const flick = 0.5 + 0.5 * Math.sin(w.age * 30 + i * 2.3);
        ctx.globalAlpha = fade * flick * power;
        ctx.fillStyle = i % 3 ? '#ffb347' : '#fff1a8';
        ctx.beginPath();
        ctx.arc(ox + Math.cos(a) * r, oy + Math.sin(a) * r, (1.6 + rnd(w.seed, i + 9) * 2) * px * 1.3, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'GLACIER': { // crystals growing outward at the front
      const n = Math.max(14, Math.floor(front / 22));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rnd(w.seed, i) * 0.2;
        const len = (18 + rnd(w.seed, i + 7) * 30) * (0.6 + 0.4 * fade);
        const half = 6 + rnd(w.seed, i + 3) * 4;
        const back = front - len * 0.35; // crystals root slightly behind the front
        const bx = ox + Math.cos(a) * back;
        const by = oy + Math.sin(a) * back;
        ctx.globalAlpha = Math.min(1, fade * power);
        ctx.beginPath();
        ctx.moveTo(bx - Math.sin(a) * half, by + Math.cos(a) * half);
        ctx.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len);
        ctx.lineTo(bx + Math.sin(a) * half, by - Math.cos(a) * half);
        ctx.closePath();
        ctx.fillStyle = 'rgba(240, 252, 255, 0.85)';
        ctx.fill();
        ctx.strokeStyle = ICE;
        ctx.lineWidth = 1.6 * px;
        ctx.stroke();
      }
      break;
    }
    case 'VERDANT': { // an organic, wavy growth front + leaves left behind
      ctx.globalAlpha = fade * 0.85 * power;
      ctx.strokeStyle = p.primary;
      ctx.lineWidth = Math.max(3 * px, band * 0.12);
      ctx.beginPath();
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * TAU;
        const r = front * (1 + 0.045 * Math.sin(a * 7 + w.age * 4)) + 6 * Math.sin(a * 13);
        const x = ox + Math.cos(a) * r;
        const y = oy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let i = 0; i < 24; i++) {
        const a = rnd(w.seed, i) * TAU;
        const r = front * (0.4 + 0.55 * rnd(w.seed, i + 30));
        ctx.save();
        ctx.translate(ox + Math.cos(a) * r, oy + Math.sin(a) * r);
        ctx.rotate(a + w.age * 2);
        ctx.globalAlpha = fade * 0.8 * power;
        ctx.fillStyle = i % 2 ? p.primary : p.particle;
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.2 * px * 1.4, 7 * px * 1.4, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'VOID': { // rings collapsing inward toward the closing point
      for (let i = 0; i < 3; i++) {
        const r = front + i * band * 0.45;
        ctx.globalAlpha = fade * (0.8 - i * 0.22) * power;
        ctx.strokeStyle = i === 0 ? '#c879ff' : '#3a1466';
        ctx.lineWidth = (i === 0 ? 3 : 2) * px;
        ctx.beginPath();
        ctx.ellipse(ox, oy, r, r * (0.92 + 0.08 * Math.sin(w.age * 9 + i)), w.age * 0.6, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case 'TIDAL': { // rolling water rings
      for (let i = 0; i < 3; i++) {
        const r = front - i * band * 0.45;
        if (r <= 0) continue;
        ctx.globalAlpha = fade * (0.85 - i * 0.25) * power;
        ctx.strokeStyle = i === 0 ? p.accent : p.primary;
        ctx.lineWidth = (3 - i * 0.6) * px;
        ctx.beginPath();
        ctx.arc(ox, oy, r, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case 'SOL': { // radiant rays from the closing point
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + w.seed;
        ctx.globalAlpha = fade * (i % 2 ? 0.35 : 0.6) * power;
        ctx.strokeStyle = i % 2 ? p.accent : p.primary;
        ctx.lineWidth = (i % 2 ? 2 : 3.5) * px;
        ctx.beginPath();
        ctx.moveTo(ox + Math.cos(a) * front * 0.2, oy + Math.sin(a) * front * 0.2);
        ctx.lineTo(ox + Math.cos(a) * front, oy + Math.sin(a) * front);
        ctx.stroke();
      }
      break;
    }
    case 'TERRA': { // cracks running through the ground
      for (let i = 0; i < 7; i++) {
        let a = rnd(w.seed, i) * TAU;
        let x = ox;
        let y = oy;
        ctx.globalAlpha = fade * 0.75 * power;
        ctx.strokeStyle = i % 2 ? p.secondary : p.primary;
        ctx.lineWidth = 2.4 * px;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const steps = 10;
        for (let s = 1; s <= steps; s++) {
          a += (rnd(w.seed, i * 10 + s) - 0.5) * 0.9;
          const r = (front / steps) * s;
          x = ox + Math.cos(a) * r;
          y = oy + Math.sin(a) * r;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'GALE': { // wind streaks sweeping around the front
      for (let i = 0; i < 16; i++) {
        const a = rnd(w.seed, i) * TAU + w.age * 2.5;
        const r = front * (0.55 + 0.45 * rnd(w.seed, i + 16));
        ctx.globalAlpha = fade * 0.7 * power;
        ctx.strokeStyle = i % 2 ? WIND : '#ffffff';
        ctx.lineWidth = 2 * px;
        ctx.beginPath();
        ctx.arc(ox, oy, r, a, a + 0.5);
        ctx.stroke();
      }
      break;
    }
    default: { // CORE: an electric front
      const n = 64;
      ctx.globalAlpha = fade * 0.85 * power;
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 2 * px;
      ctx.beginPath();
      const flick = Math.floor(w.age * 24);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        const r = front + (rnd(w.seed + flick, i) - 0.5) * 14;
        const x = ox + Math.cos(a) * r;
        const y = oy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // 4) Settle: the new border lights up once ("this is mine now"); big captures also
  //    brighten the whole conquered area.
  if (k > SPREAD - 0.1) {
    const pulse = Math.sin(Math.min(1, (k - SPREAD + 0.1) / (1.1 - SPREAD)) * Math.PI);
    ctx.globalAlpha = 1;
    if (w.big || w.huge) {
      const glow = inward ? '#c879ff' : '#ffffff';
      ctx.fillStyle = rgba(glow, (w.huge ? 0.22 : 0.16) * pulse * power);
      fillArea();
    }
    ctx.strokeStyle = rgba(inward ? '#c879ff' : main, 0.8 * pulse * Math.min(1, power));
    ctx.lineWidth = (w.huge ? 12 : w.big ? 9 : 6) * px;
    ctx.stroke(w.clip);
  }
}
