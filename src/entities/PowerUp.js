import { POWER_UPS, SURGE } from '../config.js';
import { foodSprite } from '../render/sprites.js';
import { clamp, easeOutBack } from '../utils/math.js';

export const PowerUpType = Object.freeze({
  SURGE: 'surge',
  MAGNET: 'magnet',
  VISION: 'vision',
  TRACKER: 'tracker',
  ZOOM: 'zoom',
  MULTIPLIER: 'multiplier',
});

const BOB_SPEED = 5;
const BOB_AMOUNT = 0.08;
const POWER_UP_SPRITE_SCALE = 2.6;
const COLORS = Object.freeze({
  [PowerUpType.SURGE]: SURGE.HUE,
  [PowerUpType.MAGNET]: POWER_UPS.MAGNET.HUE,
  [PowerUpType.VISION]: POWER_UPS.VISION.HUE,
  [PowerUpType.TRACKER]: POWER_UPS.TRACKER.HUE,
  [PowerUpType.ZOOM]: POWER_UPS.ZOOM.HUE,
  [PowerUpType.MULTIPLIER]: POWER_UPS.MULTIPLIER.HUE,
});

export class PowerUp {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = SURGE.RADIUS;
    this.active = true;
    this.age = 0;
  }

  update(dt) {
    this.age += dt;
    if (this.age >= SURGE.LIFETIME) this.active = false;
  }

  get visibility() {
    const spawnIn = easeOutBack(clamp(this.age / SURGE.SPAWN_IN_TIME, 0, 1));
    const fadeOut = clamp((SURGE.LIFETIME - this.age) / SURGE.FADE_TIME, 0, 1);
    return Math.max(0, spawnIn) * fadeOut;
  }

  draw(ctx) {
    const style = COLORS[this.type];
    if (!style) return;
    const scale = this.visibility;
    if (scale <= 0) return;
    const pulse = 1 + Math.sin(this.age * BOB_SPEED) * BOB_AMOUNT;
    const size = this.radius * POWER_UP_SPRITE_SCALE * scale * pulse;
    const sprite = foodSprite(style, 0, POWER_UP_SPRITE_SCALE);
    ctx.drawImage(sprite, this.x - size, this.y - size, size * 2, size * 2);
  }
}
