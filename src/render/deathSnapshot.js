import { currentFloor } from './floorThemes.js';
import { traceOutline } from './territoryShapes.js';

/**
 * "Where it ended": a small framed map of your domain at the moment you were eliminated,
 * for the results card. Painted ONCE at death, before the land changes hands:
 *   your land (smooth, in your colour) · neighbouring land (quiet) · your open trail ·
 *   a mark where you fell · a dot for whoever got you.
 * No grid, no names: just the shape of what you held.
 */
const SIZE_W = 280;
const SIZE_H = 190;
const PAD_CELLS = 5;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} territory TerritorySystem
 * @param {{slot:number, x:number, y:number, killer?: {slot:number, x:number, y:number}|null}} at
 */
export function paintDeathSnapshot(canvas, territory, at) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(SIZE_W * dpr);
  canvas.height = Math.round(SIZE_H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = currentFloor().base; // the floor you played on
  ctx.fillRect(0, 0, SIZE_W, SIZE_H);

  const cols = territory.cols;
  const owners = territory.owners;
  const size = territory.cellSize;
  const { slot } = at;

  // Frame the land you held (and where you fell); fall back to a window around you.
  let c0 = Math.floor(at.x / size);
  let c1 = c0;
  let r0 = Math.floor(at.y / size);
  let r1 = r0;
  if (territory.countFor(slot) > 0) {
    for (let i = 0; i < owners.length; i++) {
      if (owners[i] !== slot) continue;
      const c = i % cols;
      const r = (i - c) / cols;
      if (c < c0) c0 = c;
      if (c > c1) c1 = c;
      if (r < r0) r0 = r;
      if (r > r1) r1 = r;
    }
  }
  for (const p of territory.trailPaths[slot]) {
    const c = Math.floor(p.x / size);
    const r = Math.floor(p.y / size);
    if (c < c0) c0 = c;
    if (c > c1) c1 = c;
    if (r < r0) r0 = r;
    if (r > r1) r1 = r;
  }
  // Keep the frame's aspect; pad so the shape breathes.
  let w = c1 - c0 + 1 + PAD_CELLS * 2;
  let h = r1 - r0 + 1 + PAD_CELLS * 2;
  const aspect = SIZE_W / SIZE_H;
  if (w / h < aspect) w = Math.ceil(h * aspect);
  else h = Math.ceil(w / aspect);
  const cx = (c0 + c1 + 1) / 2;
  const cy = (r0 + r1 + 1) / 2;
  const wc0 = Math.max(0, Math.floor(cx - w / 2));
  const wr0 = Math.max(0, Math.floor(cy - h / 2));
  const wc1 = Math.min(cols - 1, wc0 + w);
  const wr1 = Math.min(territory.rows - 1, wr0 + h);
  const scale = Math.min(SIZE_W / (w * size), SIZE_H / (h * size));
  const ox = (SIZE_W - w * size * scale) / 2 - wc0 * size * scale;
  const oy = (SIZE_H - h * size * scale) / 2 - wr0 * size * scale;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  const px = 1 / scale;

  // Everyone's land in view, quiet; yours last and vivid.
  const present = new Set();
  for (let r = wr0; r <= wr1; r++) {
    for (let c = wc0; c <= wc1; c++) {
      const o = owners[r * cols + c];
      if (o) present.add(o);
    }
  }
  present.delete(slot);
  ctx.lineJoin = 'round';
  for (const other of present) {
    const shape = traceOutline((c, r) => owners[r * cols + c] === other, wc0, wc1, wr0, wr1, size);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = territory.fillStyles[other];
    ctx.fill(shape.path, 'evenodd');
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = territory.borderStyles[other];
    ctx.lineWidth = 1.2 * px;
    ctx.stroke(shape.path);
  }
  const [r, g, b] = territory.rgb[slot] || [90, 220, 200];
  if (territory.countFor(slot) > 0) {
    const mine = traceOutline((c, rr) => owners[rr * cols + c] === slot, wc0, wc1, wr0, wr1, size);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.42)`;
    ctx.fill(mine.path, 'evenodd');
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.lineWidth = 2.2 * px;
    ctx.stroke(mine.path);
    ctx.shadowBlur = 0;
  }

  // The open trail you were drawing.
  const path = territory.trailPaths[slot];
  if (path.length > 1) {
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(10, 14, 24, 0.55)';
    ctx.lineWidth = 4.5 * px;
    ctx.stroke();
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.lineWidth = 2.4 * px;
    ctx.stroke();
  }

  // Who got you, and where you fell.
  if (at.killer && at.killer.slot !== slot) {
    const [kr, kg, kb] = territory.rgb[at.killer.slot] || [255, 255, 255];
    ctx.fillStyle = `rgb(${kr}, ${kg}, ${kb})`;
    ctx.strokeStyle = 'rgba(10, 14, 24, 0.8)';
    ctx.lineWidth = 1.5 * px;
    ctx.beginPath();
    ctx.arc(at.killer.x, at.killer.y, 4.5 * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  const m = 6 * px;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(10, 14, 24, 0.85)';
  ctx.lineWidth = 4.5 * px;
  ctx.beginPath();
  ctx.moveTo(at.x - m, at.y - m); ctx.lineTo(at.x + m, at.y + m);
  ctx.moveTo(at.x + m, at.y - m); ctx.lineTo(at.x - m, at.y + m);
  ctx.stroke();
  ctx.strokeStyle = '#ff5d6c';
  ctx.lineWidth = 2.4 * px;
  ctx.stroke();
  ctx.restore();
}
