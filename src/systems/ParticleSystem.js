import { PARTICLES, RENDER } from '../config.js';

const LIGHTNESS = RENDER.PARTICLE_LIGHTNESS;

class Particle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.life = 0;
    this.maxLife = 1;
    this.size = 1;
    this.color = '#fff';
  }
}

/** Fixed ring-buffer pool: no allocations during play, oldest particle is recycled. */
export class ParticleSystem {
  constructor(max = PARTICLES.MAX) {
    this.pool = Array.from({ length: max }, () => new Particle());
    this.cursor = 0;
    this.colors = new Map();
  }

  clear() {
    for (const p of this.pool) p.active = false;
  }

  colorFor(hue) {
    let color = this.colors.get(hue);
    if (!color) {
      color = `hsl(${hue}, 100%, ${LIGHTNESS}%)`;
      this.colors.set(hue, color);
    }
    return color;
  }

  /** @param {{count:number, speed:number, life:number, size:number}} preset */
  emit(x, y, hue, preset, scale = 1) {
    const color = this.colorFor(hue);
    for (let i = 0; i < preset.count; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;
      const angle = Math.random() * Math.PI * 2;
      const speed = preset.speed * (0.35 + Math.random() * 0.65) * scale;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = p.life = preset.life * (0.6 + Math.random() * 0.4);
      p.size = preset.size * (0.6 + Math.random() * 0.8) * scale;
      p.color = color;
    }
  }

  update(dt) {
    const drag = Math.exp(-PARTICLES.DRAG * dt);
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
