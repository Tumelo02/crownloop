/**
 * Elemental trail accents: a light layer of motes drawn ON TOP of the solid continuous
 * trail (which stays the gameplay-readable line). Each character's `visual.trailStyle`
 * picks a shape and motion; adding a character only needs data, or one new case here.
 *
 * Cost is fixed: ACCENTS motes per open trail, placed on existing path points, no
 * allocation and no particle state.
 */

const TAU = Math.PI * 2;
const ACCENTS = 4;
const SPAN_POINTS = 36; // how far back along the trail (in path points) the motes travel
const FLOW_RATE = 9; // path points per second the motes drift toward the tail

/** How each style moves: `flow` direction along the trail, `lift` sideways drift. */
const MOTION = Object.freeze({
  ribbon: { flow: 1, lift: 0 },
  cinder: { flow: 0.6, lift: 1 }, // sparks rise off the line
  frost: { flow: 0.35, lift: 0 }, // crystals barely move: they "set"
  rift: { flow: -0.8, lift: 0 }, // pulled forward, toward the creature
  ripple: { flow: 0.8, lift: 0 },
  flare: { flow: 1.1, lift: 0.4 },
  fault: { flow: 0.25, lift: 0 }, // heavy chips
  stream: { flow: 1.8, lift: 0.2 }, // fast air
  vine: { flow: 0.5, lift: 0.3 },
});

/**
 * @param {CanvasRenderingContext2D} ctx world-space transform
 * @param {{x:number,y:number}[]} path open trail, oldest first
 * @param {string} style character.visual.trailStyle
 * @param {string} color character.palette.trail
 * @param {string} accent character.palette.accent
 * @param {number} time seconds
 * @param {number} zoom camera zoom (sizes are kept in screen pixels)
 */
export function drawTrailAccents(ctx, path, style, color, accent, time, zoom) {
  const span = Math.min(path.length - 2, SPAN_POINTS);
  if (span < 6) return;
  const motion = MOTION[style] || MOTION.ribbon;
  const px = 1 / zoom;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < ACCENTS; i++) {
    // Continuous position along the trail, wrapping within the newest `span` points.
    const travel = (time * FLOW_RATE * motion.flow + (i * span) / ACCENTS) % span;
    const along = travel < 0 ? travel + span : travel;
    const index = path.length - 2 - Math.floor(along);
    const a = path[index];
    const b = path[Math.max(0, index - 1)];
    const t = along - Math.floor(along);
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const dir = Math.atan2(a.y - b.y, a.x - b.x);
    const life = along / span; // 0 at the head, 1 at the far end
    const seed = i * 1.618;
    const lift = motion.lift * life * 9 * px;
    const nx = -Math.sin(dir);
    const ny = Math.cos(dir);
    const side = i % 2 === 0 ? 1 : -1;
    const cx = x + nx * lift * side;
    const cy = y + ny * lift * side;
    const r = 2.6 * px;
    ctx.globalAlpha = 0.85 * (1 - life * 0.65);

    ctx.beginPath();
    switch (style) {
      case 'cinder': { // flickering ember sparks, hot centre
        const flick = 0.6 + 0.4 * Math.sin(time * 23 + seed * 7);
        ctx.globalAlpha *= flick;
        ctx.arc(cx, cy, r * 0.7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.32, 0, TAU);
        ctx.fill();
        ctx.fillStyle = color;
        break;
      }
      case 'frost': { // four-point ice crystal
        const s = r * 1.15;
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s * 0.28, cy - s * 0.28);
        ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx + s * 0.28, cy + s * 0.28);
        ctx.lineTo(cx, cy + s);
        ctx.lineTo(cx - s * 0.28, cy + s * 0.28);
        ctx.lineTo(cx - s, cy);
        ctx.lineTo(cx - s * 0.28, cy - s * 0.28);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'rift': { // dark rings that shrink as they are pulled in
        ctx.lineWidth = 1.3 * px;
        ctx.arc(cx, cy, r * (0.5 + life * 1.1), 0, TAU);
        ctx.stroke();
        break;
      }
      case 'ripple': { // droplet rings, widening across the line
        ctx.lineWidth = 1.1 * px;
        ctx.ellipse(cx, cy, r * (0.7 + life * 1.2), r * (0.35 + life * 0.5), dir + Math.PI / 2, 0, TAU);
        ctx.stroke();
        break;
      }
      case 'flare': { // tiny radiant stars
        const s = r * 1.3;
        ctx.lineWidth = 1.1 * px;
        for (let k = 0; k < 4; k++) {
          const ang = (k * Math.PI) / 4 + time * 1.5;
          ctx.moveTo(cx - Math.cos(ang) * s, cy - Math.sin(ang) * s);
          ctx.lineTo(cx + Math.cos(ang) * s, cy + Math.sin(ang) * s);
        }
        ctx.stroke();
        break;
      }
      case 'fault': { // irregular rock chips, earth-toned
        const s = r * 0.95;
        const rot = seed + life;
        for (let k = 0; k < 5; k++) {
          const ang = rot + (k * TAU) / 5;
          const d = s * (k % 2 ? 0.65 : 1);
          if (k === 0) ctx.moveTo(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d);
          else ctx.lineTo(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'stream': { // thin air dashes along the direction of travel
        const len = r * 2.6;
        ctx.lineWidth = 1 * px;
        ctx.moveTo(cx - Math.cos(dir) * len, cy - Math.sin(dir) * len);
        ctx.quadraticCurveTo(cx + nx * r * side, cy + ny * r * side, cx + Math.cos(dir) * len, cy + Math.sin(dir) * len);
        ctx.stroke();
        break;
      }
      case 'vine': { // small leaves angled off the line
        ctx.ellipse(cx, cy, r * 0.5, r * 1.15, dir + side * 0.8, 0, TAU);
        ctx.fill();
        break;
      }
      default: { // ribbon (Core): pulsing energy beads
        const pulse = 0.75 + 0.25 * Math.sin(time * 8 + seed * 3);
        ctx.arc(cx, cy, r * 0.62 * pulse, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}
