import { MOVEMENT } from '../config.js';

/**
 * The player's direction feedback: a small double chevron that sits OUTSIDE the body,
 * ahead of it, pointing where the input is steering (the last valid direction, so it
 * never flips when the cursor is over the character). Visual only: the mouse/joystick
 * is still the input. Deliberately not a reticle, arrow-gun or crosshair.
 *
 * @param {CanvasRenderingContext2D} ctx world-space transform
 * @param {{x:number,y:number,displayRadius:number,isBoosting:boolean}} creature
 * @param {{x:number,y:number}} direction unit vector
 * @param {string} color element colour (character.palette.primary)
 * @param {number} zoom camera zoom (stroke widths stay in screen pixels)
 * @param {number} time seconds
 */
export function drawDirectionIndicator(ctx, creature, direction, color, zoom, time) {
  const angle = Math.atan2(direction.y, direction.x);
  const r = creature.displayRadius;
  const boosting = creature.isBoosting;
  const distance = r * MOVEMENT.INDICATOR_DISTANCE + (boosting ? 4 : 0) + Math.sin(time * 5) * 1.2;
  const size = Math.max(7 / zoom, r * 0.32);
  const px = 1 / zoom;

  ctx.save();
  ctx.translate(creature.x + Math.cos(angle) * distance, creature.y + Math.sin(angle) * distance);
  ctx.rotate(angle);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Soft dark under-stroke keeps it readable on light and dark ground alike.
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass === 0 ? 'rgba(10, 16, 30, 0.35)' : color;
    ctx.lineWidth = (pass === 0 ? 5 : 2.6) * px * (boosting ? 1.15 : 1);
    ctx.globalAlpha = pass === 0 ? 1 : boosting ? 1 : 0.9;
    ctx.beginPath();
    ctx.moveTo(-size * 0.55, -size * 0.7);
    ctx.lineTo(size * 0.25, 0);
    ctx.lineTo(-size * 0.55, size * 0.7);
    if (boosting) { // a second chevron trailing behind while boosting
      ctx.moveTo(-size * 1.15, -size * 0.55);
      ctx.lineTo(-size * 0.45, 0);
      ctx.lineTo(-size * 1.15, size * 0.55);
    }
    ctx.stroke();
  }
  ctx.restore();
}
