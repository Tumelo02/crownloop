import { ENERGY } from '../config.js';
import { foodSprite } from '../render/sprites.js';
import { clamp } from '../utils/math.js';

const MAX_ABSORBS = 160;
const MAX_POPUPS = 24;
const TAU = Math.PI * 2;
const POPUP_STROKE = 'rgba(2, 4, 10, 0.85)';

const easeIn = (t) => t * t;

/**
 * Short-lived presentation effects that explain what just happened:
 *  - absorbs: collected energy, shown as a brief visual effect
 *  - popups: floating energy, power-up, territory and interception text in world space
 * Purely visual; never touches game state.
 */
export class EffectsSystem {
  constructor() {
    this.absorbs = [];
    this.popups = [];
  }

  clear() {
    this.absorbs.length = 0;
    this.popups.length = 0;
  }

  absorbFood(energy, target) {
    if (this.absorbs.length >= MAX_ABSORBS) return;
    this.absorbs.push({
      food: true, x: energy.x, y: energy.y, radius: energy.radius, hue: energy.hue, tier: energy.tier,
      target, t: 0, duration: ENERGY.ABSORB_TIME,
    });
  }

  /**
   * @param {object} options
   * @param {object} [options.anchor] creature to follow (text sits above it)
   * @returns the popup, so callers can merge later values into it
   */
  popup(x, y, text, color, { anchor = null, sizePx = 16, life = 0.9, rise = 40 } = {}) {
    if (this.popups.length >= MAX_POPUPS) this.popups.shift();
    const popup = { x, y, text, color, anchor, sizePx, life, maxLife: life, rise, value: 0 };
    this.popups.push(popup);
    return popup;
  }

  update(dt) {
    for (let i = this.absorbs.length - 1; i >= 0; i--) {
      const a = this.absorbs[i];
      a.t += dt;
      if (a.t >= a.duration) this.absorbs.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  draw(ctx, zoom) {
    for (const a of this.absorbs) {
      const k = easeIn(clamp(a.t / a.duration, 0, 1));
      const x = a.x + (a.target.x - a.x) * k;
      const y = a.y + (a.target.y - a.y) * k;
      const r = a.radius * (1 - k * 0.85);
      if (a.food) {
        const size = r * ENERGY.SPRITE_SCALE;
        ctx.drawImage(foodSprite(a.hue, a.tier, ENERGY.SPRITE_SCALE), x - size, y - size, size * 2, size * 2);
      } else {
        ctx.globalAlpha = 1 - k * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fillStyle = `hsla(${a.hue}, 90%, 60%, 0.75)`;
        ctx.fill();
        ctx.lineWidth = 2 / zoom;
        ctx.strokeStyle = `hsl(${a.hue}, 100%, 82%)`;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Popups draw with a constant on-screen size, so they stay readable at any zoom. */
  drawPopups(ctx, zoom) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of this.popups) {
      const t = 1 - p.life / p.maxLife;
      const px = p.anchor ? p.anchor.x : p.x;
      const baseY = p.anchor ? p.anchor.y - p.anchor.displayRadius - 18 / zoom : p.y;
      const y = baseY - (p.rise * t) / zoom;
      const pop = t < 0.15 ? 0.7 + (t / 0.15) * 0.3 : 1;
      ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.font = `800 ${(p.sizePx * pop) / zoom}px system-ui, sans-serif`;
      ctx.lineWidth = 4 / zoom;
      ctx.strokeStyle = POPUP_STROKE;
      ctx.strokeText(p.text, px, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, px, y);
    }
    ctx.globalAlpha = 1;
  }
}
