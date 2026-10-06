import { COIN_FIELD } from '../config.js';
import { COIN_FRAME_PX, COIN_SPRITE_RADIUS, coinSheet } from '../render/coinSprite.js';
import { glowSprite, shadowSprite } from '../render/sprites.js';
import { clamp, randRange } from '../utils/math.js';
import { clampToArena, randomArenaPoint } from '../world/arena.js';

const TAU = Math.PI * 2;
const MARGIN = 120;
const SPAWN_IN = 0.4;
const GLINT_TIME = 0.35;
const GOLD_HUE = 46;

class Coin {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.value = 1;
    this.big = false;
    this.radius = COIN_FIELD.RADIUS;
    this.age = 0;
    this.spin = 0;
    this.glintTimer = 0;
    this.glint = 0;
  }
}

/**
 * Coins lying in the world: a secondary, cosmetic-only reward. A small fixed pool,
 * rarer than food, spread across the world with some near the player so they're found.
 * Only the player collects them (they feed PlayerProgress, not the creature).
 */
export class CoinField {
  constructor() {
    this.pool = Array.from({ length: COIN_FIELD.MAX_ACTIVE }, () => new Coin());
    this.spawnTimer = 0;
  }

  reset() {
    for (const coin of this.pool) coin.active = false;
    this.spawnTimer = 0;
    // Start the match with half the coins already out there.
    for (let i = 0; i < Math.floor(COIN_FIELD.MAX_ACTIVE / 2); i++) this.spawn(null);
  }

  get activeCount() {
    let n = 0;
    for (const coin of this.pool) if (coin.active) n++;
    return n;
  }

  spawn(player) {
    const coin = this.pool.find((c) => !c.active);
    if (!coin) return;
    if (player && player.alive && Math.random() < COIN_FIELD.NEAR_PLAYER_CHANCE) {
      const a = Math.random() * TAU;
      const d = randRange(COIN_FIELD.NEAR_PLAYER_MIN, COIN_FIELD.NEAR_PLAYER_MAX);
      clampToArena(player.x + Math.cos(a) * d, player.y + Math.sin(a) * d, MARGIN, coin);
    } else {
      randomArenaPoint(MARGIN, coin);
    }
    coin.big = Math.random() < COIN_FIELD.BIG_CHANCE;
    coin.value = coin.big ? COIN_FIELD.BIG_VALUE : COIN_FIELD.VALUE;
    coin.radius = COIN_FIELD.RADIUS * (coin.big ? COIN_FIELD.BIG_RADIUS_SCALE : 1);
    coin.age = 0;
    coin.spin = Math.random() * TAU;
    coin.glintTimer = randRange(COIN_FIELD.GLINT_INTERVAL_MIN, COIN_FIELD.GLINT_INTERVAL_MAX);
    coin.glint = 0;
    coin.active = true;
  }

  /**
   * @param {object|null} player the local player's creature
   * @param {number} magnetRange extra pull range (Magnet power-up), 0 if none
   * @param {(coin: Coin) => void} onCollect
   */
  update(dt, player, magnetRange, onCollect) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = randRange(COIN_FIELD.SPAWN_INTERVAL_MIN, COIN_FIELD.SPAWN_INTERVAL_MAX);
      this.spawn(player);
    }

    const alive = player && player.alive;
    for (const coin of this.pool) {
      if (!coin.active) continue;
      coin.age += dt;
      coin.spin = (coin.spin + COIN_FIELD.SPIN_SPEED * dt) % TAU;
      coin.glintTimer -= dt;
      if (coin.glintTimer <= 0) {
        coin.glint = GLINT_TIME;
        coin.glintTimer = randRange(COIN_FIELD.GLINT_INTERVAL_MIN, COIN_FIELD.GLINT_INTERVAL_MAX);
      }
      if (coin.glint > 0) coin.glint = Math.max(0, coin.glint - dt);
      if (coin.age >= COIN_FIELD.LIFETIME) {
        coin.active = false;
        continue;
      }
      if (!alive) continue;

      const dx = player.x - coin.x;
      const dy = player.y - coin.y;
      const d = Math.hypot(dx, dy);
      const reach = player.radius + coin.radius + COIN_FIELD.PICKUP_RANGE;
      if (d <= reach) {
        coin.active = false;
        onCollect(coin);
        continue;
      }
      const pull = player.radius + COIN_FIELD.MAGNET_RANGE + magnetRange;
      if (d < pull) {
        const step = Math.min(d, (COIN_FIELD.MAGNET_PULL_SPEED + player.speed) * (1 - d / pull + 0.3) * dt);
        coin.x += (dx / d) * step;
        coin.y += (dy / d) * step;
      }
    }
  }

  draw(ctx, bounds, time) {
    const sheet = coinSheet();
    const frames = COIN_FIELD.SPRITE_FRAMES;
    for (const coin of this.pool) {
      if (!coin.active) continue;
      const cullRadius = coin.radius * COIN_FIELD.VISUAL_SCALE * COIN_FIELD.GLOW_SCALE + 8;
      if (coin.x + cullRadius < bounds.left || coin.x - cullRadius > bounds.right
        || coin.y + cullRadius < bounds.top || coin.y - cullRadius > bounds.bottom) continue;

      const spawnIn = Math.min(1, coin.age / SPAWN_IN);
      const fade = clamp((COIN_FIELD.LIFETIME - coin.age) / COIN_FIELD.FADE_TIME, 0, 1);
      const r = coin.radius * COIN_FIELD.VISUAL_SCALE * (0.6 + 0.4 * spawnIn);
      const bob = Math.sin(time * 3 + coin.spin) * r * 0.12;
      ctx.globalAlpha = spawnIn * fade;

      // Ground shadow (shrinks a little as the coin bobs up).
      const sw = r * (1.15 - bob / (r * 2));
      ctx.drawImage(shadowSprite(), coin.x + r * 0.25 - sw, coin.y + r * 0.95 - sw * 0.35, sw * 2, sw * 0.7);
      const glow = r * COIN_FIELD.GLOW_SCALE;
      ctx.globalAlpha *= coin.big ? 0.48 : 0.32;
      ctx.drawImage(glowSprite(GOLD_HUE), coin.x - glow, coin.y - glow - bob, glow * 2, glow * 2);
      ctx.globalAlpha = spawnIn * fade;

      const frame = Math.floor((coin.spin / TAU) * frames) % frames;
      const scale = r / COIN_SPRITE_RADIUS;
      const half = (COIN_FRAME_PX / 2) * scale;
      ctx.drawImage(sheet, frame * COIN_FRAME_PX, 0, COIN_FRAME_PX, COIN_FRAME_PX,
        coin.x - half, coin.y - half - bob, half * 2, half * 2);

      // Occasional sparkle: a four-point star catching the light.
      if (coin.glint > 0) {
        const k = Math.sin((coin.glint / GLINT_TIME) * Math.PI);
        const s = r * 0.9 * k;
        const gx = coin.x - r * 0.45;
        const gy = coin.y - r * 0.55 - bob;
        ctx.fillStyle = 'rgba(255, 255, 240, 0.95)';
        ctx.beginPath();
        ctx.moveTo(gx, gy - s);
        ctx.lineTo(gx + s * 0.18, gy - s * 0.18);
        ctx.lineTo(gx + s, gy);
        ctx.lineTo(gx + s * 0.18, gy + s * 0.18);
        ctx.lineTo(gx, gy + s);
        ctx.lineTo(gx - s * 0.18, gy + s * 0.18);
        ctx.lineTo(gx - s, gy);
        ctx.lineTo(gx - s * 0.18, gy - s * 0.18);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
