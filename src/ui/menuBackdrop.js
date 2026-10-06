import { traceOutline } from '../render/territoryShapes.js';
import { SKINS } from '../progression/skins.js';
import { currentTheme } from './ThemeToggle.js';

/**
 * The menu's backdrop: a dim, distant view of a contested galaxy. Organic territories in
 * the elements' colours, a few open trails between them, no grid. Painted once per size
 * (cheap: a handful of traced shapes) and drifted slowly with CSS.
 */
const CELL = 30;
const BLOBS = 11;

export class MenuBackdrop {
  constructor(canvas) {
    this.canvas = canvas;
    this.size = '';
    if (canvas) window.addEventListener('resize', () => this.paint());
  }

  /** Theme changed: same size, new colours. */
  repaint() {
    this.size = '';
    this.paint();
  }

  paint() {
    const canvas = this.canvas;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Oversized so the CSS drift never shows an edge.
    const w = Math.ceil(window.innerWidth * 1.15);
    const h = Math.ceil(window.innerHeight * 1.15);
    const key = `${w}x${h}@${dpr}`;
    if (key === this.size) return;
    this.size = key;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);
    const owners = new Uint8Array(cols * rows);
    const hues = SKINS.map((s) => s.territory);
    // Grow each territory from a seed by random frontier expansion: organic, never square.
    // Seeds avoid the middle band where the title, name and PLAY sit.
    const blobs = [];
    for (let b = 1; b <= BLOBS; b++) {
      let c;
      let r;
      for (let tries = 0; tries < 20; tries++) {
        c = Math.floor(Math.random() * cols);
        r = Math.floor(Math.random() * rows);
        const nx = Math.abs(c / cols - 0.5);
        if (nx > 0.22 || Math.random() < 0.15) break;
      }
      const target = 40 + Math.floor(Math.random() * 140);
      const frontier = [r * cols + c];
      let grown = 0;
      while (frontier.length && grown < target) {
        const i = frontier.splice(Math.floor(Math.random() * frontier.length), 1)[0];
        if (owners[i]) continue;
        owners[i] = b;
        grown++;
        const cc = i % cols;
        if (cc > 0) frontier.push(i - 1);
        if (cc < cols - 1) frontier.push(i + 1);
        if (i >= cols) frontier.push(i - cols);
        if (i < cols * (rows - 1)) frontier.push(i + cols);
      }
      blobs.push({ slot: b, c, r, tone: hues[(b - 1) % hues.length] });
    }

    // Light theme: deeper, slightly stronger tints so the shapes still read on a pale sky.
    const light = currentTheme() === 'light';
    const fillL = light ? 52 : 46;
    const fillA = light ? 0.16 : 0.13;
    const lineL = light ? 48 : 62;
    const lineA = light ? 0.34 : 0.3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const blob of blobs) {
      const { hue, sat } = blob.tone;
      const shape = traceOutline((c, r) => owners[r * cols + c] === blob.slot, 0, cols - 1, 0, rows - 1, CELL);
      if (shape.minX === Infinity) continue;
      ctx.fillStyle = `hsla(${hue}, ${Math.max(30, sat)}%, ${fillL}%, ${fillA})`;
      ctx.fill(shape.path, 'evenodd');
      ctx.strokeStyle = `hsla(${hue}, ${Math.max(40, sat)}%, ${lineL}%, ${lineA})`;
      ctx.lineWidth = 2;
      ctx.stroke(shape.path);
    }
    // A few open trails leaving territories: the moment before a capture (or a cut).
    for (let i = 0; i < 5; i++) {
      const blob = blobs[Math.floor(Math.random() * blobs.length)];
      const { hue, sat } = blob.tone;
      let x = (blob.c + 0.5) * CELL;
      let y = (blob.r + 0.5) * CELL;
      let a = Math.random() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      // Gentle arcs, like a creature steering: the turn rate drifts instead of jittering.
      let turn = (Math.random() - 0.5) * 0.12;
      const steps = 40 + Math.floor(Math.random() * 40);
      for (let s = 0; s < steps; s++) {
        turn = Math.max(-0.12, Math.min(0.12, turn + (Math.random() - 0.5) * 0.04));
        a += turn;
        x += Math.cos(a) * 10;
        y += Math.sin(a) * 10;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsla(${hue}, ${Math.max(45, sat)}%, ${light ? 48 : 60}%, ${lineA + 0.02})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = `hsla(${hue}, ${Math.max(45, sat)}%, ${light ? 50 : 70}%, 0.55)`;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
