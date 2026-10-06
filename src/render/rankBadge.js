/**
 * DOMINION rank insignia (Canvas, no images). 6 tiers x 5 divisions = 30 badges.
 *
 * Each TIER has its own silhouette and metal; DIVISIONS add detail on top:
 *   I   base insignia + 1 division star
 *   II  + 2nd mark
 *   III + 3rd mark + inner chevron
 *   IV  + 4th mark + inner trim ring
 *   V   + 5th mark + completed outer frame and crest spike (elite)
 *
 * Tiers: BEGINNER (steel shield) -> AMATEUR (hex shield, bronze-teal) -> PRO (winged
 * cobalt shield) -> EXPERT (spread wings, violet steel, star core) -> MASTER (tall crimson
 * crest with crown spikes) -> LEGENDARY (alien: iridescent shell, floating halo ring,
 * orbiting shards; deliberately NOT gold).
 * Every badge carries the DOMINION glyph (a notched diamond in a ring) at its heart.
 * Fictional insignia: no real-world military marks.
 */

const TAU = Math.PI * 2;
const cache = new Map();

export const TIER_STYLE = Object.freeze([
  { name: 'BEGINNER', light: '#e7edf5', mid: '#9aa7b8', dark: '#3d4756', edge: '#141a24', glow: 'rgba(160, 190, 220, 0.35)', mark: '#cfd8e6' },
  { name: 'AMATEUR', light: '#ffe2bf', mid: '#c98b56', dark: '#5a3418', edge: '#1d0f06', glow: 'rgba(90, 220, 200, 0.35)', mark: '#6ff0d8' },
  { name: 'PRO', light: '#d6e6ff', mid: '#4f7fd8', dark: '#162a63', edge: '#070d22', glow: 'rgba(80, 150, 255, 0.45)', mark: '#9fd0ff' },
  { name: 'EXPERT', light: '#ead9ff', mid: '#8b5bd6', dark: '#2f1663', edge: '#0f0624', glow: 'rgba(170, 110, 255, 0.5)', mark: '#e3c7ff' },
  { name: 'MASTER', light: '#ffd3d3', mid: '#c23b4a', dark: '#4a0c16', edge: '#170307', glow: 'rgba(255, 90, 90, 0.5)', mark: '#ffd36b' },
  { name: 'LEGENDARY', light: '#e9fffb', mid: '#5ef0d6', dark: '#2b1260', edge: '#06020f', glow: 'rgba(120, 255, 230, 0.6)', mark: '#ff8cf2' },
]);

/** Index helpers: rank index 0..29 -> tier 0..5, division 0..4. */
export function badgeParts(rankIndex) {
  const i = Math.max(0, Math.min(29, rankIndex | 0));
  return { tier: Math.floor(i / 5), division: i % 5 };
}

/**
 * A cached badge sprite (square canvas, `size` CSS px at `dpr`).
 * @returns {HTMLCanvasElement}
 */
export function rankBadgeSprite(rankIndex, size = 64, dpr = 1) {
  const key = `${rankIndex}|${size}|${dpr}`;
  let sprite = cache.get(key);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = Math.round(size * dpr);
  const ctx = sprite.getContext('2d');
  ctx.scale(dpr, dpr);
  drawRankBadge(ctx, rankIndex, size / 2, size / 2, size);
  cache.set(key, sprite);
  return sprite;
}

/** Paints every `canvas[data-rank-badge]` under `root` with the given rank. */
export function paintRankBadge(canvas, rankIndex) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = canvas.clientWidth || Number(canvas.getAttribute('width')) || 48;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(rankBadgeSprite(rankIndex, size, dpr), 0, 0);
  canvas.dataset.rankIndex = String(rankIndex);
}

/** Draws the badge centred at (cx, cy) inside a `size` box. */
export function drawRankBadge(ctx, rankIndex, cx, cy, size) {
  const { tier, division } = badgeParts(rankIndex);
  const st = TIER_STYLE[tier];
  const s = size / 118; // design space ~100 units, plus room for the widest wings
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Soft glow behind the insignia.
  const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 50);
  glow.addColorStop(0, st.glow);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-50, -50, 100, 100);

  const body = SHAPES[tier];
  // 3D: a soft cast shadow under the whole insignia (wings included).
  ctx.save();
  ctx.translate(0, 9);
  ctx.scale(1.02, 0.96);
  body(ctx);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = Math.max(2, size * 0.09);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = Math.max(1, size * 0.04);
  ctx.shadowOffsetY = Math.max(1, size * 0.025);
  if (tier >= 2) drawWings(ctx, tier, st, division);
  ctx.restore();
  if (tier === 5) drawHalo(ctx, st);

  // The metal slab's thickness: the plate's side, dropping below the face.
  for (let d = 6; d >= 1; d--) {
    ctx.save();
    ctx.translate(0, d);
    body(ctx);
    ctx.fillStyle = d > 3 ? st.edge : st.dark;
    ctx.fill();
    ctx.restore();
  }
  // Dark outer edge, then the metal plate with a top-left light, then a bevel highlight.
  body(ctx);
  ctx.lineWidth = 7;
  ctx.strokeStyle = st.edge;
  ctx.stroke();
  const metal = ctx.createLinearGradient(-30, -40, 30, 40);
  metal.addColorStop(0, st.light);
  metal.addColorStop(0.45, st.mid);
  metal.addColorStop(1, st.dark);
  if (tier === 5) { // iridescent alien shell
    metal.addColorStop(0, '#f2fffd');
    metal.addColorStop(0.35, '#5ef0d6');
    metal.addColorStop(0.65, '#8f5bff');
    metal.addColorStop(1, '#2b1260');
  }
  ctx.fillStyle = metal;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Internal highlight: a bright sheen across the upper-left.
  const sheen = ctx.createLinearGradient(-40, -40, 10, 10);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-50, -50, 100, 100);
  // Lower-right falls into shade, so the plate reads as curved metal.
  const shade = ctx.createLinearGradient(-10, -10, 34, 40);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = shade;
  ctx.fillRect(-50, -50, 100, 100);
  // Bevel: a recessed inner plate (dark top-left lip, lit bottom-right lip).
  ctx.save();
  ctx.scale(0.78, 0.78);
  body(ctx);
  ctx.restore();
  const bevel = ctx.createLinearGradient(-30, -36, 30, 36);
  bevel.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
  bevel.addColorStop(0.5, 'rgba(0, 0, 0, 0.05)');
  bevel.addColorStop(1, 'rgba(255, 255, 255, 0.45)');
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = bevel;
  ctx.stroke();
  // Specular glare on the upper-left of the plate.
  ctx.save();
  ctx.translate(-11, -19);
  ctx.rotate(-0.55);
  const glare = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
  glare.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  glare.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glare;
  ctx.scale(1, 0.42);
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();
  body(ctx);
  ctx.lineWidth = 1.6;
  const rim = ctx.createLinearGradient(-30, -40, 30, 40);
  rim.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  rim.addColorStop(0.6, 'rgba(255, 255, 255, 0.25)');
  rim.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
  ctx.strokeStyle = rim;
  ctx.stroke();

  // Division details.
  if (division >= 2) drawInnerChevron(ctx, st, tier);
  if (division >= 3) drawTrimRing(ctx, st);
  drawRivets(ctx, st);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = Math.max(1, size * 0.03);
  ctx.shadowOffsetY = Math.max(0.5, size * 0.015);
  drawGlyph(ctx, st, tier);
  ctx.restore();
  drawDivisionMarks(ctx, st, division + 1);
  if (division >= 4) drawEliteFrame(ctx, st, tier, body);
  if (tier === 5) drawShards(ctx, st, division);
  if (tier >= 4) { // Master+: glints catching the light
    drawSparkle(ctx, -24, -30, 3.6, 0.9);
    drawSparkle(ctx, 26, -8, 2.6, 0.75);
    drawSparkle(ctx, 14, 26, 2.2, 0.6);
  }

  ctx.restore();
}

// ---------------------------------------------------------------- tier silhouettes

const SHAPES = [
  // BEGINNER: a simple pointed shield.
  (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-26, -30);
    ctx.lineTo(26, -30);
    ctx.lineTo(26, 6);
    ctx.lineTo(0, 34);
    ctx.lineTo(-26, 6);
    ctx.closePath();
  },
  // AMATEUR: a hexagonal shield with a notched top.
  (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-14, -34);
    ctx.lineTo(0, -28);
    ctx.lineTo(14, -34);
    ctx.lineTo(30, -16);
    ctx.lineTo(28, 12);
    ctx.lineTo(0, 36);
    ctx.lineTo(-28, 12);
    ctx.lineTo(-30, -16);
    ctx.closePath();
  },
  // PRO: an angular kite shield with stepped shoulders.
  (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, -38);
    ctx.lineTo(22, -30);
    ctx.lineTo(30, -14);
    ctx.lineTo(24, 14);
    ctx.lineTo(0, 38);
    ctx.lineTo(-24, 14);
    ctx.lineTo(-30, -14);
    ctx.lineTo(-22, -30);
    ctx.closePath();
  },
  // EXPERT: a faceted crest.
  (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(16, -32);
    ctx.lineTo(28, -20);
    ctx.lineTo(30, 4);
    ctx.lineTo(16, 26);
    ctx.lineTo(0, 40);
    ctx.lineTo(-16, 26);
    ctx.lineTo(-30, 4);
    ctx.lineTo(-28, -20);
    ctx.lineTo(-16, -32);
    ctx.closePath();
  },
  // MASTER: a tall crest topped with three crown spikes.
  (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(8, -32);
    ctx.lineTo(20, -40);
    ctx.lineTo(22, -24);
    ctx.lineTo(30, -12);
    ctx.lineTo(28, 10);
    ctx.lineTo(12, 30);
    ctx.lineTo(0, 42);
    ctx.lineTo(-12, 30);
    ctx.lineTo(-28, 10);
    ctx.lineTo(-30, -12);
    ctx.lineTo(-22, -24);
    ctx.lineTo(-20, -40);
    ctx.lineTo(-8, -32);
    ctx.closePath();
  },
  // LEGENDARY: an alien seed-crystal (curved, asymmetric facets).
  (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.bezierCurveTo(22, -36, 34, -16, 30, 2);
    ctx.bezierCurveTo(26, 20, 12, 34, 0, 44);
    ctx.bezierCurveTo(-12, 34, -26, 20, -30, 2);
    ctx.bezierCurveTo(-34, -16, -22, -36, 0, -42);
    ctx.closePath();
  },
];

// ---------------------------------------------------------------- details

function drawWings(ctx, tier, st, division) {
  // Swept wings behind the plate: more feathers and span for higher tiers.
  const feathers = tier === 2 ? 2 : tier === 3 ? 3 : 4;
  const span = 30 + tier * 4 + (division >= 4 ? 4 : 0);
  for (const side of [-1, 1]) {
    for (let i = 0; i < feathers; i++) {
      const y = -14 + i * 9;
      ctx.beginPath();
      ctx.moveTo(side * 18, y);
      ctx.lineTo(side * (span + 14 - i * 5), y - 8 + i * 2);
      ctx.lineTo(side * (span + 6 - i * 5), y + 4);
      ctx.lineTo(side * 18, y + 7);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? st.mid : st.dark;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = st.edge;
      ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.stroke();
    }
  }
}

function drawHalo(ctx, st) {
  // A floating ring behind the legendary crystal, tilted like an orbit.
  ctx.save();
  ctx.rotate(-0.35);
  ctx.beginPath();
  ctx.ellipse(0, 0, 46, 15, 0, 0, TAU);
  ctx.lineWidth = 5;
  ctx.strokeStyle = st.edge;
  ctx.stroke();
  const g = ctx.createLinearGradient(-46, 0, 46, 0);
  g.addColorStop(0, '#ff8cf2');
  g.addColorStop(0.5, '#e9fffb');
  g.addColorStop(1, '#5ef0d6');
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = g;
  ctx.stroke();
  ctx.restore();
}

function drawGlyph(ctx, st, tier) {
  // The DOMINION glyph: a faceted gem in a bevelled metal ring.
  const r = 13 + Math.min(tier, 3);
  const cy = -2;
  // Ring: dark socket, metal band (lit top-left), fine inner highlight.
  ctx.beginPath();
  ctx.arc(0, cy, r, 0, TAU);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.fill();
  const band = ctx.createLinearGradient(-r, cy - r, r, cy + r);
  band.addColorStop(0, '#ffffff');
  band.addColorStop(0.35, st.mark);
  band.addColorStop(1, st.dark);
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = band;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, cy, r - 2, Math.PI * 1.05, Math.PI * 1.7);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.stroke();
  // Gem: four facets, each its own brightness, so it reads as cut stone.
  const h = r * 0.72;
  const w = r * 0.56;
  const facets = [
    [[0, cy - h], [-w, cy], [0, cy], 0.95], // top-left: brightest
    [[0, cy - h], [w, cy], [0, cy], 0.7],
    [[-w, cy], [0, cy + h], [0, cy], 0.5],
    [[w, cy], [0, cy + h], [0, cy], 0.28], // bottom-right: darkest
  ];
  for (const [p1, p2, p3, light] of facets) {
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.fillStyle = st.mark;
    ctx.fill();
    ctx.fillStyle = light > 0.6
      ? `rgba(255, 255, 255, ${(light - 0.6) * 1.4})`
      : `rgba(0, 0, 0, ${(0.6 - light) * 0.9})`;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, cy - h);
  ctx.lineTo(w, cy);
  ctx.lineTo(0, cy + h);
  ctx.lineTo(-w, cy);
  ctx.closePath();
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = st.edge;
  ctx.stroke();
  // The notch (the DOMINION mark) and a sparkle on the gem.
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, cy);
  ctx.lineTo(0, cy - r * 0.25);
  ctx.lineTo(r * 0.2, cy);
  ctx.lineTo(0, cy + r * 0.25);
  ctx.closePath();
  ctx.fillStyle = st.edge;
  ctx.fill();
  drawSparkle(ctx, -w * 0.38, cy - h * 0.42, 2.6, 0.95);
  if (tier >= 3) { // Expert+: a shaded star crowning the glyph
    drawStar(ctx, 0, cy - r - 6.5, 5.6, 2.4, 5, st);
  }
}

/** A shaded 5-point star: gradient body, dark outline, small highlight. */
function drawStar(ctx, x, y, outer, inner, points, st) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i / (points * 2)) * TAU;
    const rr = i % 2 ? inner : outer;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(x - outer, y - outer, x + outer, y + outer);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.4, st.mark);
  g.addColorStop(1, st.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = st.edge;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - outer * 0.22, y - outer * 0.28, outer * 0.18, 0, TAU);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();
}

/** A tiny four-point glint. */
function drawSparkle(ctx, x, y, size, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(0, 0, size, 0);
  ctx.quadraticCurveTo(0, 0, 0, size);
  ctx.quadraticCurveTo(0, 0, -size, 0);
  ctx.quadraticCurveTo(0, 0, 0, -size);
  ctx.fill();
  ctx.restore();
}

/** Small domed rivets fixing the plate (two pairs, inside every silhouette). */
function drawRivets(ctx, st) {
  for (const [x, y] of [[-18, -23], [18, -23], [-17, 9], [17, 9]]) {
    const g = ctx.createRadialGradient(x - 0.8, y - 0.9, 0.2, x, y, 2.4);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, st.mark);
    g.addColorStop(1, st.edge);
    ctx.beginPath();
    ctx.arc(x, y, 2.1, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.stroke();
  }
}

function drawInnerChevron(ctx, st, tier) {
  ctx.beginPath();
  ctx.moveTo(-14, 16);
  ctx.lineTo(0, 24 + (tier === 0 ? 2 : 0));
  ctx.lineTo(14, 16);
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = st.edge;
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = st.mark;
  ctx.stroke();
}

function drawTrimRing(ctx, st) {
  ctx.beginPath();
  ctx.arc(0, -2, 22, Math.PI * 0.85, Math.PI * 2.15);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = st.mark;
  ctx.setLineDash([3, 2.5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawDivisionMarks(ctx, st, count) {
  // 1..5 stars in a gentle arc under the plate: I .. V at a glance.
  const spacing = 9.4;
  for (let i = 0; i < count; i++) {
    const t = i - (count - 1) / 2;
    const x = t * spacing;
    const y = 33 + t * t * 0.55; // the arc follows the plate's curve
    drawStar(ctx, x, y, 5.1, 2.2, 5, st);
  }
}

function drawEliteFrame(ctx, st, tier, body) {
  // Division V: the insignia is "completed" with a bright outer frame and a crest spike.
  ctx.save();
  ctx.scale(1.12, 1.1);
  body(ctx);
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = st.mark;
  ctx.stroke();
  ctx.beginPath();
  const top = tier === 4 ? -52 : -48;
  ctx.moveTo(0, top);
  ctx.lineTo(4, top + 9);
  ctx.lineTo(0, top + 6);
  ctx.lineTo(-4, top + 9);
  ctx.closePath();
  ctx.fillStyle = st.mark;
  ctx.fill();
}

function drawShards(ctx, st, division) {
  // Legendary: small crystal shards orbiting the badge (more with each division).
  const n = 2 + division;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + 0.6 + (i / n) * TAU;
    const x = Math.cos(a) * 40;
    const y = Math.sin(a) * 40;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(2.6, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-2.6, 0);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#ff8cf2' : '#5ef0d6';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = st.edge;
    ctx.stroke();
    ctx.restore();
  }
}
