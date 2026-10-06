/**
 * "I'm outside my territory, and this feels dangerous." The player's own body carries
 * the feeling; nothing says what to do or where to go.
 *   - off your land: a faint pulsing edge around the character, slightly unsteady
 *   - near your own trail: the pulse quickens into a heartbeat rhythm and brightens
 * (The screen edge and the heartbeat sound are driven by Game alongside this.)
 *
 * @param {number} level 0 (safe) .. 1 (right next to your own trail), already smoothed
 */
export function drawExposureCue(ctx, creature, color, level, nearTrail, time, zoom) {
  if (level <= 0.01 || !creature.alive) return;
  const px = 1 / zoom;
  const r = creature.displayRadius;
  // A slow breathing pulse off your land; a "lub-dub" heartbeat near your own trail.
  const beat = nearTrail
    ? heartbeat(time * 1.25)
    : 0.5 + 0.5 * Math.sin(time * 3.2);
  const radius = r * (1.32 + 0.08 * beat * level);
  const alpha = (0.18 + 0.5 * beat) * level;
  ctx.save();
  ctx.translate(creature.x, creature.y);
  ctx.lineJoin = 'round';
  // Slightly unsteady outline (a tiny distortion), stronger with the danger.
  const wobble = 1.2 * px + 2.2 * px * level;
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rr = radius + Math.sin(a * 5 + time * 7) * wobble + Math.sin(a * 3 - time * 5) * wobble * 0.6;
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.globalAlpha = alpha * 0.6;
  ctx.strokeStyle = 'rgba(14, 18, 32, 0.9)';
  ctx.lineWidth = (3 + 2 * level) * px;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = (1.6 + 1.4 * level) * px;
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** 0..1 double pulse ("lub-dub") per period. */
export function heartbeat(t) {
  const f = t % 1;
  const lub = Math.exp(-((f - 0.08) ** 2) / 0.0025);
  const dub = 0.7 * Math.exp(-((f - 0.3) ** 2) / 0.003);
  return Math.min(1, lub + dub);
}
