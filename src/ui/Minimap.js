import { MINIMAP, WORLD } from '../config.js';
import { drawCrownShape } from '../render/sprites.js';

const TAU = Math.PI * 2;
const PLAYER = '#4dfbd0';
const DANGER = '#ff6a76';
const REVEALED = 'rgba(190, 255, 205, 0.95)';
const EDGE = 'rgba(140, 230, 255, 0.75)';
const PAD = 7; // px between the projection's rim and the world
const SCAN_PERIOD = 1.4; // seconds between Vision scan pulses

/**
 * A small round tactical projection of the arena disc: translucent glass, a subtle luminous rim,
 * cell-accurate territory, and only the markers that matter:
 *   - your own position (small arrow; the crown replaces it when you are the King)
 *   - the King: the custom crown itself is the marker (no arrow, box or ring)
 *   - rivals: ONLY while Vision is active (with a scan pulse), gone when it ends
 * Nothing outside the playable world, no names, no counts.
 */
export class Minimap {
  constructor(canvas, territory) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.territory = territory;
    this.size = 0;
    this.dpr = 1;
    this.timer = 0;
    this.time = 0;
    this.landmarkActive = new WeakMap(); // landmark -> was it active last frame
    this.landmarkPings = new WeakMap(); // landmark -> time it switched on (ripple)

    const step = MINIMAP.CELLS_PER_PIXEL;
    this.step = step;
    this.texture = document.createElement('canvas');
    this.texture.width = Math.ceil(territory.cols / step);
    this.texture.height = Math.ceil(territory.rows / step);
    this.textureCtx = this.texture.getContext('2d');
    this.image = this.textureCtx.createImageData(this.texture.width, this.texture.height);
    this.glass = null; // cached background for the current size
  }

  resize(dpr) {
    const size = this.canvas.clientWidth;
    if (size === 0) return;
    this.size = size;
    this.dpr = dpr;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.glass = null;
  }

  reset() {
    this.timer = 0;
  }

  refreshTexture(playerSlot) {
    this.territory.paintMap(this.image, this.step, playerSlot);
    this.textureCtx.putImageData(this.image, 0, 0);
  }

  /** The glass plate (drawn once per size): dark translucent fill + faint inner light. */
  buildGlass() {
    const { size, dpr } = this;
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(size * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); // round, like the arena
    g.fillStyle = 'rgba(8, 14, 30, 0.66)';
    g.fill();
    const light = g.createRadialGradient(size * 0.35, size * 0.3, 0, size / 2, size / 2, size * 0.75);
    light.addColorStop(0, 'rgba(120, 220, 255, 0.14)');
    light.addColorStop(1, 'rgba(120, 220, 255, 0)');
    g.fillStyle = light;
    g.fill();
    this.glass = c;
  }

  /**
   * @param {object} s
   * @param {number} s.dt
   * @param {object|null} s.player player creature (may be dead)
   * @param {number} s.playerSlot
   * @param {object[]} s.creatures
   * @param {object|null} s.king King's creature
   * Strategic landmarks are marked with a small glyph each, so players know where to go.
   */
  draw({
    dt, player, playerSlot, creatures, king, landmarks = [], revenge = null,
  }) {
    if (this.size === 0) this.resize(this.dpr);
    if (this.size === 0) return;
    this.time += dt;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = MINIMAP.TEXTURE_REFRESH;
      this.refreshTexture(playerSlot);
    }
    if (!this.glass) this.buildGlass();

    const { ctx, size } = this;
    const inner = size - PAD * 2;
    const scale = inner / Math.max(WORLD.WIDTH, WORLD.HEIGHT);
    const mapW = WORLD.WIDTH * scale;
    const mapH = WORLD.HEIGHT * scale;
    const ox = (size - mapW) / 2;
    const oy = (size - mapH) / 2;
    const toX = (wx) => ox + Math.min(Math.max(wx, 0), WORLD.WIDTH) * scale;
    const toY = (wy) => oy + Math.min(Math.max(wy, 0), WORLD.HEIGHT) * scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.glass, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Everything inside the projection is clipped to the arena disc.
    const discX = ox + mapW / 2;
    const discY = oy + mapH / 2;
    const discR = WORLD.RADIUS * scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(discX, discY, discR, 0, TAU);
    ctx.clip();
    // Keep thin and small domains visible when the cell map is reduced to minimap size.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.texture, ox, oy, mapW, mapH);

    const viewer = player && player.alive ? player : null;
    const revealing = Boolean(viewer && viewer.visionTime > 0);
    if (revealing) {
      // Vision: a scan pulse from your position, and every rival appears.
      const k = (this.time % SCAN_PERIOD) / SCAN_PERIOD;
      ctx.beginPath();
      ctx.arc(toX(viewer.x), toY(viewer.y), k * size * 0.9, 0, TAU);
      ctx.strokeStyle = `rgba(150, 255, 170, ${0.55 * (1 - k)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      for (const c of creatures) {
        if (!c.alive || c.isPlayer || c === king) continue;
        ctx.beginPath();
        ctx.arc(toX(c.x), toY(c.y), 2, 0, TAU);
        ctx.fillStyle = c.isExposed ? DANGER : REVEALED;
        ctx.fill();
      }
    }
    // Tracker (without Radar): only the exposed rivals appear, in red.
    if (viewer && viewer.trackerTime > 0 && !revealing) {
      for (const c of creatures) {
        if (!c.alive || c.isPlayer || !c.isExposed) continue;
        ctx.beginPath();
        ctx.arc(toX(c.x), toY(c.y), 2.6, 0, TAU);
        ctx.fillStyle = DANGER;
        ctx.fill();
      }
    }
    ctx.restore();
    // Strategic landmarks: a badge each, drawn above the land so nobody misses them. When
    // one switches on, a ripple spreads from it across the map.
    const badgeR = Math.max(5.5, Math.min(8.5, size * 0.045));
    ctx.save();
    ctx.beginPath();
    ctx.arc(discX, discY, discR, 0, TAU);
    ctx.clip();
    for (const lm of landmarks) {
      const was = this.landmarkActive.get(lm);
      if (lm.active && was === false) this.landmarkPings.set(lm, this.time);
      this.landmarkActive.set(lm, Boolean(lm.active));
      const ping = this.landmarkPings.get(lm);
      const age = ping === undefined ? Infinity : this.time - ping;
      drawLandmarkBadge(ctx, toX(lm.x), toY(lm.y), lm, playerSlot, badgeR, this.time, age);
    }
    ctx.restore();

    // The rim: a subtle luminous boundary of the playable world.
    ctx.beginPath();
    ctx.arc(discX, discY, discR, 0, TAU);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(80, 190, 255, 0.18)';
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = EDGE;
    ctx.stroke();

    // Revenge target: an orange crosshair on the rival who last took you out.
    if (revenge && revenge.alive) {
      const rx = toX(revenge.x);
      const ry = toY(revenge.y);
      const pulse = 4.5 + 1.5 * Math.sin(this.time * 6);
      ctx.beginPath();
      ctx.arc(rx, ry, pulse, 0, TAU);
      ctx.moveTo(rx - pulse - 3, ry); ctx.lineTo(rx - pulse + 1, ry);
      ctx.moveTo(rx + pulse - 1, ry); ctx.lineTo(rx + pulse + 3, ry);
      ctx.moveTo(rx, ry - pulse - 3); ctx.lineTo(rx, ry - pulse + 1);
      ctx.moveTo(rx, ry + pulse - 1); ctx.lineTo(rx, ry + pulse + 3);
      ctx.strokeStyle = '#ff9f43';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // The King: the custom crown is the whole marker.
    if (king && king.alive) {
      drawCrownShape(ctx, toX(king.x), toY(king.y), 13);
    }

    // You: a small arrow (the crown already marks you when you are the King).
    if (viewer && viewer !== king) {
      ctx.save();
      ctx.translate(toX(viewer.x), toY(viewer.y));
      ctx.rotate(viewer.heading);
      ctx.beginPath();
      ctx.moveTo(5.5, 0);
      ctx.lineTo(-3.5, 4);
      ctx.lineTo(-1.2, 0);
      ctx.lineTo(-3.5, -4);
      ctx.closePath();
      ctx.fillStyle = PLAYER;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * Landmark badges on the minimap: a dark disc with a coloured ring and a white symbol
 * (Bonus Tower = tower, Energy Core = bolt, Teleporter = portal, Slow Tower = snowflake).
 * Active: full colour with a pulsing halo. Inactive: dimmed. Yours: a white ring; a rival's:
 * a red ring. RIPPLE_TIME seconds after switching on, a ripple spreads across the map.
 */
const LANDMARK_COLORS = Object.freeze({
  beacon: '#5ff3ff',
  flux: '#ffae4d',
  rift: '#c18cff',
  stasis: '#7fb6ff',
});
const RIPPLE_TIME = 2.4;

function drawLandmarkBadge(ctx, x, y, lm, playerSlot, r, time, pingAge) {
  const color = LANDMARK_COLORS[lm.kind];
  if (!color) return;
  ctx.save();
  ctx.translate(x, y);
  if (pingAge < RIPPLE_TIME) {
    for (let i = 0; i < 2; i++) {
      const k = (pingAge - i * 0.35) / RIPPLE_TIME;
      if (k <= 0 || k >= 1) continue;
      ctx.beginPath();
      ctx.arc(0, 0, r + k * r * 7, 0, TAU);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.85 * (1 - k);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (lm.active) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.35 + 0.25 * pulse), 0, TAU);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22 + 0.18 * pulse;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = 0.55;
  }
  // Disc + ring
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = 'rgba(8, 12, 24, 0.92)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.4, r * 0.24);
  ctx.strokeStyle = color;
  ctx.stroke();
  // Symbol
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const u = r / 7; // symbol unit
  if (lm.kind === 'beacon') {
    ctx.beginPath(); // tower with a light on top
    ctx.moveTo(-2.4 * u, 3.6 * u); ctx.lineTo(-1.3 * u, -1.6 * u); ctx.lineTo(1.3 * u, -1.6 * u); ctx.lineTo(2.4 * u, 3.6 * u);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -3.1 * u, 1.3 * u, 0, TAU);
    ctx.fill();
  } else if (lm.kind === 'flux') {
    ctx.beginPath(); // lightning bolt
    ctx.moveTo(0.9 * u, -4 * u); ctx.lineTo(-2.4 * u, 0.6 * u); ctx.lineTo(-0.1 * u, 0.6 * u);
    ctx.lineTo(-0.9 * u, 4 * u); ctx.lineTo(2.4 * u, -0.6 * u); ctx.lineTo(0.1 * u, -0.6 * u);
    ctx.closePath();
    ctx.fill();
  } else if (lm.kind === 'rift') {
    ctx.lineWidth = Math.max(1, 1.1 * u); // portal: two rings
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.2 * u, 3.6 * u, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 1 * u, 0, TAU);
    ctx.fill();
  } else {
    ctx.lineWidth = Math.max(1, 1.1 * u); // snowflake
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI + Math.PI / 2;
      ctx.moveTo(Math.cos(a) * 3.6 * u, Math.sin(a) * 3.6 * u);
      ctx.lineTo(-Math.cos(a) * 3.6 * u, -Math.sin(a) * 3.6 * u);
    }
    ctx.stroke();
  }
  // Owner ring: yours white, a rival's red.
  if (lm.ownerSlot) {
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r + Math.max(1.6, r * 0.3), 0, TAU);
    ctx.strokeStyle = lm.ownerSlot === playerSlot ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 93, 108, 0.9)';
    ctx.lineWidth = Math.max(1.2, r * 0.18);
    ctx.stroke();
  }
  ctx.restore();
}
