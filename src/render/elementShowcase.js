/**
 * Title-screen elemental showcase (menu only, no gameplay).
 *
 * The selected character's `element` picks a SCRIPT: what happens while it charges, the
 * moment it acts, and while it settles, plus the light idle particles around it. Scripts
 * only call a small shared vocabulary (pooled particles + timed overlay shapes), so a new
 * element is one new SCRIPTS entry. Colours always come from `character.palette`.
 *
 * Everything is in screen pixels around the creature's centre, and is capped: at most
 * MAX_PARTICLES particles and MAX_SHAPES overlays exist at once, all reused.
 */

const TAU = Math.PI * 2;
const MAX_PARTICLES = 90;
const MAX_SHAPES = 10;
const AMBIENT_MAX = 8;

const rand = (a, b) => a + Math.random() * (b - a);
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const smooth = (k) => k * k * (3 - 2 * k);

function makeParticle() {
  return {
    active: false, ambient: false, mode: 'free', shape: 'dot', color: '#fff',
    x: 0, y: 0, vx: 0, vy: 0, ang: 0, rad: 0, angVel: 0, radVel: 0,
    gravity: 0, drag: 0, sway: 0, size: 2, age: 0, life: 1, spin: 0,
  };
}

function makeShape() {
  return { active: false, type: '', age: 0, dur: 1, color: '#fff', color2: '#fff', a: 0, b: 0, n: 0, seed: 0 };
}

export class ElementShowcase {
  constructor() {
    this.particles = Array.from({ length: MAX_PARTICLES }, makeParticle);
    this.shapes = Array.from({ length: MAX_SHAPES }, makeShape);
    this.reset(null);
  }

  /** New character (or leaving the menu): drop every effect, plan the first showcase soon. */
  reset(character) {
    this.character = character;
    this.script = character ? SCRIPTS[character.element] || SCRIPTS.CORE : SCRIPTS.CORE;
    for (const p of this.particles) p.active = false;
    for (const s of this.shapes) s.active = false;
    this.phase = 'idle';
    this.phaseTime = 0;
    this.wait = character ? 1.6 : 0; // first showcase shortly after the title lands
    this.ambientTimer = 0;
    this.cx = 0;
    this.cy = 0;
    this.r = 40;
    // Read by the title screen each frame to shape the creature itself.
    this.out = { hold: 0, glow: 0, spin: 0, dx: 0, dy: 0, sink: 0, dark: 0, warm: 0 };
  }

  get activeParticles() {
    let n = 0;
    for (const p of this.particles) if (p.active) n++;
    return n;
  }

  // ------------------------------------------------------------ vocabulary for scripts

  /** Spawns one pooled particle; when the pool is full the oldest one is reused. */
  spawn(o) {
    let p = this.particles.find((q) => !q.active);
    if (!p) {
      p = this.particles[0];
      for (const q of this.particles) if (q.age / q.life > p.age / p.life) p = q;
    }
    Object.assign(p, makeParticle(), o, { active: true, age: 0 });
    if (p.mode !== 'free') return p;
    p.x = this.cx + (o.x ?? 0);
    p.y = this.cy + (o.y ?? 0);
    return p;
  }

  /** Particles leaving at random angles from the body. */
  burst(count, o) {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * TAU + rand(-0.25, 0.25);
      const speed = rand(o.speed[0], o.speed[1]) * this.r;
      const start = (o.from ?? 0.6) * this.r;
      this.spawn({
        ...o,
        x: Math.cos(ang) * start, y: Math.sin(ang) * start,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        life: rand(o.life[0], o.life[1]), size: rand(o.size[0], o.size[1]) * this.r * 0.05,
      });
    }
  }

  /** Particles circling the body (they follow it). */
  orbit(count, o) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        ...o,
        mode: 'orbit',
        ang: (i / count) * TAU + rand(-0.3, 0.3),
        rad: rand(o.radius[0], o.radius[1]) * this.r,
        angVel: rand(o.angVel[0], o.angVel[1]) * (o.dir ?? 1),
        radVel: (o.radVel ?? 0) * this.r,
        life: rand(o.life[0], o.life[1]),
        size: rand(o.size[0], o.size[1]) * this.r * 0.05,
      });
    }
  }

  /** Turns orbiting particles loose, flung outward (or dropped). */
  release(speed, gravity = 0) {
    for (const p of this.particles) {
      if (!p.active || p.mode !== 'orbit' || p.ambient) continue;
      p.mode = 'free';
      p.x = this.cx + Math.cos(p.ang) * p.rad;
      p.y = this.cy + Math.sin(p.ang) * p.rad;
      const tangent = p.angVel * p.rad;
      p.vx = Math.cos(p.ang) * speed * this.r - Math.sin(p.ang) * tangent * 0.4;
      p.vy = Math.sin(p.ang) * speed * this.r + Math.cos(p.ang) * tangent * 0.4;
      p.gravity = gravity * this.r;
      p.age = 0;
      p.life = rand(0.5, 0.9);
    }
  }

  /** Overlay shape anchored to the creature: ring, rays, crystals, flames, ribbons... */
  shape(type, o) {
    let s = this.shapes.find((q) => !q.active);
    if (!s) s = this.shapes[0];
    Object.assign(s, makeShape(), o, { active: true, type, age: 0, seed: Math.random() * TAU });
    return s;
  }

  // ------------------------------------------------------------ simulation

  /**
   * @param {number} dt seconds
   * @param {object} character selected character
   * @param {number} cx creature centre (px) @param {number} cy @param {number} r radius (px)
   * @param {(element: string) => void} onAction called once when the showcase fires
   */
  update(dt, character, cx, cy, r, onAction) {
    if (character !== this.character) this.reset(character);
    this.cx = cx;
    this.cy = cy;
    this.r = r;
    const script = this.script;
    const out = this.out;
    out.hold = out.glow = out.spin = out.dx = out.dy = out.sink = out.dark = out.warm = 0;

    // Phase machine: idle (random 4-8 s) -> charge -> action -> settle -> idle.
    this.phaseTime += dt;
    if (this.phase === 'idle') {
      this.wait -= dt;
      if (this.wait <= 0) this.enter('charge');
    } else {
      const length = script.timing[this.phase];
      const k = Math.min(1, this.phaseTime / length);
      script[this.phase]?.(this, k, dt, out);
      if (this.phaseTime >= length) {
        if (this.phase === 'charge') {
          this.enter('action');
          onAction?.(character.element);
        } else if (this.phase === 'action') {
          this.enter('settle');
        } else {
          this.phase = 'idle';
          this.phaseTime = 0;
          this.wait = rand(4, 8);
        }
      }
    }

    // A little life between showcases.
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = rand(0.35, 0.8);
      let ambient = 0;
      for (const p of this.particles) if (p.active && p.ambient) ambient++;
      if (ambient < AMBIENT_MAX) script.ambient(this);
    }

    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        continue;
      }
      if (p.mode === 'orbit') {
        p.ang += p.angVel * dt;
        p.rad = Math.max(0, p.rad + p.radVel * dt);
      } else {
        p.vy += p.gravity * dt;
        const damp = 1 - Math.min(1, p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
        p.x += (p.vx + (p.sway ? Math.sin(p.age * 3 + p.ang) * p.sway * r : 0)) * dt;
        p.y += p.vy * dt;
        if (p.mode === 'inward') { // pulled toward the creature, bending around it
          const dx = this.cx - p.x;
          const dy = this.cy - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const pull = p.radVel * r;
          p.vx += (dx / d) * pull * dt - (dy / d) * pull * 0.6 * dt;
          p.vy += (dy / d) * pull * dt + (dx / d) * pull * 0.6 * dt;
          if (d < r * 0.35) p.active = false;
        }
      }
      p.spin += dt * 3;
    }
    for (const s of this.shapes) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.dur) s.active = false;
    }
  }

  enter(phase) {
    this.phase = phase;
    this.phaseTime = 0;
    this.script[`${phase}Start`]?.(this);
  }

  // ------------------------------------------------------------ drawing

  /** Local light or darkness behind the creature (Void darkens, Sol and Ember warm). */
  drawBack(ctx) {
    const { dark, warm, glow } = this.out;
    const palette = this.character?.palette;
    if (!palette) return;
    const r = this.r;
    if (dark > 0.01) {
      const g = ctx.createRadialGradient(this.cx, this.cy, r * 0.4, this.cx, this.cy, r * 4);
      g.addColorStop(0, `rgba(4, 0, 12, ${0.85 * dark})`);
      g.addColorStop(1, 'rgba(4, 0, 12, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(this.cx - r * 4, this.cy - r * 4, r * 8, r * 8);
    }
    const light = Math.max(warm, glow * 0.6);
    if (light > 0.01) {
      const g = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, r * 3.2);
      g.addColorStop(0, withAlpha(palette.primary, 0.45 * light));
      g.addColorStop(1, withAlpha(palette.primary, 0));
      ctx.fillStyle = g;
      ctx.fillRect(this.cx - r * 3.2, this.cy - r * 3.2, r * 6.4, r * 6.4);
    }
  }

  /** Overlays and particles in front of the creature. */
  drawFront(ctx) {
    for (const s of this.shapes) if (s.active) drawShape(ctx, this, s);
    for (const p of this.particles) if (p.active) drawParticle(ctx, this, p);
  }
}

// ---------------------------------------------------------------- shapes & particles

function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function drawParticle(ctx, fx, p) {
  const k = p.age / p.life;
  const fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
  const x = p.mode === 'orbit' ? fx.cx + Math.cos(p.ang) * p.rad : p.x;
  const y = p.mode === 'orbit' ? fx.cy + Math.sin(p.ang) * p.rad : p.y;
  const s = p.size;
  ctx.globalAlpha = Math.max(0, fade);
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  ctx.beginPath();
  switch (p.shape) {
    case 'spark': { // a short streak along its motion
      const vx = p.mode === 'orbit' ? -Math.sin(p.ang) * p.angVel * p.rad : p.vx;
      const vy = p.mode === 'orbit' ? Math.cos(p.ang) * p.angVel * p.rad : p.vy;
      const v = Math.hypot(vx, vy) || 1;
      ctx.lineWidth = s * 0.7;
      ctx.lineCap = 'round';
      ctx.moveTo(x, y);
      ctx.lineTo(x - (vx / v) * s * 3, y - (vy / v) * s * 3);
      ctx.stroke();
      break;
    }
    case 'shard':
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.spin);
      ctx.moveTo(0, -s * 1.6);
      ctx.lineTo(s * 0.6, 0);
      ctx.lineTo(0, s * 1.6);
      ctx.lineTo(-s * 0.6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    case 'droplet':
      ctx.arc(x, y, s * 0.8, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.55, y - s * 0.3);
      ctx.lineTo(x, y - s * 1.8);
      ctx.lineTo(x + s * 0.55, y - s * 0.3);
      ctx.fill();
      break;
    case 'rock':
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.spin * 0.5);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const d = s * (i % 2 ? 0.75 : 1.15);
        if (i === 0) ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
        else ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    case 'leaf':
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.spin * 0.6 + p.ang);
      ctx.ellipse(0, 0, s * 0.5, s * 1.3, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      break;
    case 'dust':
      ctx.globalAlpha *= 0.35;
      ctx.arc(x, y, s * (1 + k * 2), 0, TAU);
      ctx.fill();
      break;
    case 'star': // 4-point twinkle
      ctx.lineWidth = Math.max(1, s * 0.35);
      ctx.moveTo(x - s * 1.4, y);
      ctx.lineTo(x + s * 1.4, y);
      ctx.moveTo(x, y - s * 1.4);
      ctx.lineTo(x, y + s * 1.4);
      ctx.stroke();
      break;
    default: // dot with a soft halo
      ctx.globalAlpha *= 0.35;
      ctx.arc(x, y, s * 2.2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.beginPath();
      ctx.arc(x, y, s * 0.9, 0, TAU);
      ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawShape(ctx, fx, s) {
  const k = s.age / s.dur;
  const r = fx.r;
  const cx = fx.cx;
  const cy = fx.cy;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (s.type) {
    case 'ring': { // expanding pulse
      const radius = r * (s.a + (s.b - s.a) * easeOut(k));
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(1, r * 0.09 * (1 - k * 0.7));
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();
      break;
    }
    case 'collapse': { // a ring drawn IN (Void)
      const radius = r * (s.a - (s.a - s.b) * smooth(k));
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = s.color2;
      ctx.lineWidth = r * 0.04;
      ctx.stroke();
      break;
    }
    case 'rays': { // Sol: rays extend then retract
      const ext = Math.sin(k * Math.PI);
      ctx.globalAlpha = 0.9 * ext;
      ctx.strokeStyle = s.color;
      for (let i = 0; i < s.n; i++) {
        const a = (i / s.n) * TAU + s.seed + k * 0.4;
        const long = i % 2 ? 1 : 1.5;
        ctx.lineWidth = r * (i % 2 ? 0.05 : 0.08);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
        ctx.lineTo(Math.cos(a) * r * (1.15 + ext * long), Math.sin(a) * r * (1.15 + ext * long));
        ctx.stroke();
      }
      break;
    }
    case 'corona': { // Sol: hot ring of light around the body
      const glow = Math.sin(k * Math.PI);
      const g = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 2.2);
      g.addColorStop(0, withAlpha(s.color, 0.7 * glow));
      g.addColorStop(1, withAlpha(s.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.2, 0, TAU);
      ctx.fill();
      break;
    }
    case 'crystals': { // Glacier: spikes grow outward, hold, then fade
      const grow = smooth(Math.min(1, k * 2.5));
      ctx.globalAlpha = k < 0.7 ? 0.95 : (1 - k) / 0.3 * 0.95;
      ctx.fillStyle = s.color;
      ctx.strokeStyle = s.color2;
      ctx.lineWidth = Math.max(1, r * 0.03);
      for (let i = 0; i < s.n; i++) {
        const a = (i / s.n) * TAU + s.seed;
        const len = r * (0.9 + (i % 3) * 0.3) * grow;
        const w = r * 0.16;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(r * 0.85, -w);
        ctx.lineTo(r * 0.85 + len, 0);
        ctx.lineTo(r * 0.85, w);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'flames': { // Ember: flame tongues flicker around the body
      const life = Math.sin(k * Math.PI);
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = layer === 0 ? s.color : s.color2;
        ctx.globalAlpha = life * (layer === 0 ? 0.75 : 0.9);
        const scale = layer === 0 ? 1 : 0.6;
        for (let i = 0; i < s.n; i++) {
          const a = (i / s.n) * TAU + s.seed + k * 1.5;
          const flick = 0.75 + 0.25 * Math.sin(s.age * 26 + i * 2.1);
          const reach = r * (1 + 0.9 * life * flick) * (layer === 0 ? 1 : 0.9);
          const w = r * 0.28 * scale;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const base = r * 0.75;
          ctx.beginPath();
          ctx.moveTo(ca * base - sa * w, sa * base + ca * w);
          ctx.quadraticCurveTo(ca * reach * 0.8 + sa * w * 0.8, sa * reach * 0.8 - ca * w * 0.8, ca * reach, sa * reach);
          ctx.quadraticCurveTo(ca * reach * 0.7 - sa * w * 0.3, sa * reach * 0.7 + ca * w * 0.3, ca * base + sa * w, sa * base - ca * w);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    }
    case 'ribbons': { // Gale (thin, fast) or Tidal (thick, slow wave): arcs circling
      const life = Math.sin(k * Math.PI);
      ctx.strokeStyle = s.color;
      for (let i = 0; i < s.n; i++) {
        const turn = s.seed + (i / s.n) * TAU + s.age * s.a * (1 + k * s.b);
        const radius = r * (1.35 + i * 0.22 + (s.type === 'ribbons' ? Math.sin(s.age * 4 + i) * 0.08 : 0));
        ctx.globalAlpha = life * (0.85 - i * 0.15);
        ctx.lineWidth = r * (s.n > 2 ? 0.035 : 0.11) * (1 - i * 0.2);
        ctx.beginPath();
        ctx.arc(0, 0, radius, turn, turn + Math.PI * (0.7 + 0.3 * life));
        ctx.stroke();
      }
      break;
    }
    case 'wave': { // Tidal: a cresting arc of water
      const life = Math.sin(k * Math.PI);
      const turn = s.seed + k * Math.PI * 1.6;
      ctx.rotate(turn);
      ctx.globalAlpha = 0.8 * life;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.75, -1.1, 1.1);
      ctx.quadraticCurveTo(r * 2.1, r * 0.4, r * 1.35, r * 0.15);
      ctx.arc(0, 0, r * 1.35, 0.9 * 0.2, -1.0, true);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = s.color2;
      ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.75, -1.1, 1.1);
      ctx.stroke();
      break;
    }
    case 'vines': { // Verdant: curling tendrils grow, then fade
      const grow = smooth(Math.min(1, k * 2));
      ctx.globalAlpha = k < 0.75 ? 0.9 : (1 - k) / 0.25 * 0.9;
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color2;
      ctx.lineWidth = Math.max(1, r * 0.05);
      for (let i = 0; i < s.n; i++) {
        const a = (i / s.n) * TAU + s.seed;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const len = r * 1.2 * grow;
        const curl = (i % 2 ? 1 : -1) * r * 0.5 * grow;
        const ex = ca * (r * 0.9 + len) - sa * curl * 0.4;
        const ey = sa * (r * 0.9 + len) + ca * curl * 0.4;
        ctx.beginPath();
        ctx.moveTo(ca * r * 0.85, sa * r * 0.85);
        ctx.quadraticCurveTo(ca * (r + len * 0.5) - sa * curl, sa * (r + len * 0.5) + ca * curl, ex, ey);
        ctx.stroke();
        if (grow > 0.6) { // a leaf at the tip
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(a + (i % 2 ? 0.7 : -0.7));
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 0.1 * grow, r * 0.22 * grow, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- element scripts

/**
 * Each script: timing (seconds per phase), ambient() idle particles, and optional
 * chargeStart/charge/actionStart/action/settleStart/settle hooks. Hooks receive the
 * showcase (fx), the phase progress k (0..1), dt and `out`, which shapes the creature:
 *   hold  0..1  how much it stops drifting      glow 0..1  core brightness
 *   spin  rad   extra turn                      dx/dy  px  extra offset
 *   sink  px    weight (moves it down)          dark/warm  local light 0..1
 */
const SCRIPTS = {
  CORE: { // energy builds, orbiting motes, an expanding pulse
    timing: { charge: 1.2, action: 0.5, settle: 1.1 },
    ambient(fx) {
      const c = fx.character.palette;
      fx.orbit(1, { ambient: true, shape: 'dot', color: c.particle, radius: [1.3, 1.9], angVel: [0.8, 1.4], life: [1.6, 2.4], size: [0.6, 1] });
    },
    chargeStart(fx) {
      const c = fx.character.palette;
      fx.orbit(10, { shape: 'dot', color: c.particle, radius: [1.5, 1.9], angVel: [2.5, 3.5], radVel: -0.25, life: [2.4, 2.6], size: [0.8, 1.3] });
    },
    charge(fx, k, dt, out) { out.hold = smooth(k); out.glow = k; },
    actionStart(fx) {
      const c = fx.character.palette;
      fx.shape('ring', { dur: 0.9, color: c.primary, a: 1, b: 4 });
      fx.shape('ring', { dur: 1.1, color: c.accent, a: 0.8, b: 3 });
      fx.release(3.2);
      fx.burst(10, { shape: 'spark', color: c.accent, speed: [3, 5], life: [0.4, 0.7], size: [0.9, 1.4], drag: 1.5 });
    },
    action(fx, k, dt, out) { out.hold = 1; out.glow = 1; },
    settle(fx, k, dt, out) { out.hold = 1 - smooth(k); out.glow = 1 - k; },
  },

  EMBER: { // embers rise, flames lick out, a turn and a flame burst with sparks
    timing: { charge: 1.0, action: 0.7, settle: 1.2 },
    ambient(fx) {
      const c = fx.character.palette;
      fx.spawn({ ambient: true, shape: 'dot', color: c.particle, x: rand(-0.6, 0.6) * fx.r, y: rand(-0.2, 0.4) * fx.r, vx: rand(-6, 6), vy: -fx.r * rand(0.5, 0.9), sway: 0.15, life: rand(1, 1.6), size: fx.r * 0.035 });
    },
    charge(fx, k, dt, out) {
      out.hold = smooth(k); out.glow = k * 0.9; out.warm = k * 0.6;
      if (Math.random() < dt * 16) {
        const c = fx.character.palette;
        fx.spawn({ shape: 'dot', color: Math.random() < 0.5 ? c.particle : c.accent, x: rand(-0.7, 0.7) * fx.r, y: rand(-0.3, 0.5) * fx.r, vx: rand(-8, 8), vy: -fx.r * rand(0.8, 1.4), sway: 0.2, life: rand(0.7, 1.1), size: fx.r * rand(0.03, 0.05) });
      }
    },
    actionStart(fx) {
      const c = fx.character.palette;
      fx.shape('flames', { dur: 0.9, color: c.primary, color2: c.accent, n: 7 });
      fx.burst(14, { shape: 'spark', color: c.accent, speed: [2.5, 4.5], life: [0.4, 0.8], size: [0.8, 1.3], drag: 1.2, gravity: -0.6 * fx.r });
    },
    action(fx, k, dt, out) { out.hold = 1; out.glow = 1; out.warm = 0.8; out.spin = smooth(k) * Math.PI * 0.9; },
    settle(fx, k, dt, out) { out.hold = 1 - smooth(k); out.glow = 1 - k; out.warm = 0.8 * (1 - k); out.spin = Math.PI * 0.9; },
  },

  GLACIER: { // frost gathers, crystals grow outward, a frost ring, crystals dissolve
    timing: { charge: 1.1, action: 0.9, settle: 1.0 },
    ambient(fx) {
      const c = fx.character.palette;
      const a = rand(0, TAU);
      fx.spawn({ ambient: true, shape: 'star', color: c.accent, x: Math.cos(a) * fx.r * rand(1.2, 2), y: Math.sin(a) * fx.r * rand(1.2, 2), life: rand(0.6, 1.1), size: fx.r * 0.05 });
    },
    charge(fx, k, dt, out) {
      out.hold = smooth(k); out.glow = k * 0.8;
      if (Math.random() < dt * 14) { // frost drifting in and settling on the body
        const c = fx.character.palette;
        const a = rand(0, TAU);
        const d = fx.r * rand(2, 2.8);
        fx.spawn({ shape: Math.random() < 0.5 ? 'shard' : 'star', color: c.particle, x: Math.cos(a) * d, y: Math.sin(a) * d, vx: -Math.cos(a) * fx.r * 1.4, vy: -Math.sin(a) * fx.r * 1.4, drag: 1.2, life: 0.9, size: fx.r * 0.05 });
      }
    },
    actionStart(fx) {
      const c = fx.character.palette;
      fx.shape('crystals', { dur: 1.6, color: c.primary, color2: c.accent, n: 7 });
      fx.shape('ring', { dur: 1.0, color: c.accent, a: 1.1, b: 3.4 });
    },
    action(fx, k, dt, out) { out.hold = 1; out.glow = 1; },
    settleStart(fx) { // the crystals break into drifting shards
      const c = fx.character.palette;
      fx.burst(14, { shape: 'shard', color: c.particle, from: 1.5, speed: [0.5, 1.2], life: [0.7, 1.1], size: [0.9, 1.4], drag: 1 });
    },
    settle(fx, k, dt, out) { out.hold = 1 - smooth(k); out.glow = 1 - k; },
  },

  VOID: { // light bends inward, local darkness, a collapsing ring, then a purple pulse
    timing: { charge: 1.4, action: 0.6, settle: 1.1 },
    ambient(fx) {
      const c = fx.character.palette;
      const a = rand(0, TAU);
      const d = fx.r * rand(2.2, 3);
      fx.spawn({ ambient: true, mode: 'inward', radVel: 0.6, shape: 'star', color: c.accent, x: Math.cos(a) * d, y: Math.sin(a) * d, drag: 0.8, life: 2.2, size: fx.r * 0.035 });
    },
    charge(fx, k, dt, out) {
      out.hold = smooth(k); out.dark = smooth(k) * 0.8; out.glow = k * 0.5;
      if (Math.random() < dt * 22) { // surrounding particles pulled in, curving
        const c = fx.character.palette;
        const a = rand(0, TAU);
        const d = fx.r * rand(2.6, 3.6);
        fx.spawn({ mode: 'inward', radVel: 2.2, shape: Math.random() < 0.6 ? 'dot' : 'star', color: Math.random() < 0.5 ? c.particle : c.accent, x: Math.cos(a) * d, y: Math.sin(a) * d, drag: 0.6, life: 1.6, size: fx.r * rand(0.03, 0.05) });
      }
    },
    actionStart(fx) {
      const c = fx.character.palette;
      fx.shape('collapse', { dur: 0.65, color: c.secondary, color2: c.primary, a: 2.6, b: 0.9 });
    },
    action(fx, k, dt, out) { out.hold = 1; out.dark = 0.8 + 0.2 * k; out.glow = 0.4; },
    settleStart(fx) {
      const c = fx.character.palette;
      fx.shape('ring', { dur: 1.0, color: c.primary, a: 0.9, b: 3.6 });
      fx.burst(8, { shape: 'star', color: c.accent, speed: [1.5, 2.5], life: [0.5, 0.8], size: [0.7, 1], drag: 1.6 });
    },
    settle(fx, k, dt, out) { out.hold = 1 - smooth(k); out.dark = 1 - smooth(k); out.glow = 0.9 * (1 - k); },
  },

  TIDAL: { // droplets orbit, a circular sweep with a cresting wave, then a splash
    timing: { charge: 1.0, action: 1.0, settle: 1.0 },
    ambient(fx) {
      const c = fx.character.palette;
      fx.orbit(1, { ambient: true, shape: 'droplet', color: c.particle, radius: [1.4, 1.9], angVel: [0.6, 1], life: [1.5, 2.2], size: [0.6, 0.9] });
    },
    chargeStart(fx) {
      const c = fx.character.palette;
      fx.orbit(9, { shape: 'droplet', color: c.particle, radius: [1.5, 1.8], angVel: [1.8, 2.6], life: [2.6, 2.8], size: [0.8, 1.1] });
      fx.shape('ribbons', { dur: 2.0, color: c.primary, n: 2, a: 1.4, b: 1 });
    },
    charge(fx, k, dt, out) { out.hold = smooth(k) * 0.8; out.glow = k * 0.6; },
    actionStart(fx) {
      const c = fx.character.palette;
      fx.shape('wave', { dur: 1.0, color: c.primary, color2: c.accent });
    },
    action(fx, k, dt, out) { // one smooth loop
      const a = k * TAU;
      out.hold = 0.8; out.glow = 0.7;
      out.dx = Math.sin(a) * fx.r * 0.45;
      out.dy = (1 - Math.cos(a)) * fx.r * 0.25;
      out.spin = smooth(k) * TAU * 0.5;
    },
    settleStart(fx) {
      fx.release(1.6, 2.6); // droplets splash outward and fall away
      fx.shape('ring', { dur: 0.8, color: fx.character.palette.accent, a: 1, b: 2.4 });
    },
    settle(fx, k, dt, out) { out.hold = 0.8 * (1 - smooth(k)); out.glow = 0.6 * (1 - k); out.spin = Math.PI; },
  },

  SOL: { // the core blazes, golden motes orbit, a corona and rays, a warm pulse
    timing: { charge: 1.1, action: 0.9, settle: 1.0 },
    ambient(fx) {
      const c = fx.character.palette;
      const a = rand(0, TAU);
      fx.spawn({ ambient: true, shape: 'star', color: c.accent, x: Math.cos(a) * fx.r * rand(1.1, 1.8), y: Math.sin(a) * fx.r * rand(1.1, 1.8), vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, life: rand(0.7, 1.2), size: fx.r * 0.045 });
    },
    chargeStart(fx) {
      const c = fx.character.palette;
      fx.orbit(10, { shape: 'dot', color: c.particle, radius: [1.4, 1.7], angVel: [2, 3], life: [2.3, 2.5], size: [0.7, 1.1] });
    },
    charge(fx, k, dt, out) { out.hold = smooth(k); out.glow = k; out.warm = k * 0.8; },
    actionStart(fx) {
      const c = fx.character.palette;
      fx.shape('corona', { dur: 1.3, color: c.primary });
      fx.shape('rays', { dur: 1.1, color: c.accent, n: 12 });
    },
    action(fx, k, dt, out) { out.hold = 1; out.glow = 1; out.warm = 1; },
    settleStart(fx) {
      fx.shape('ring', { dur: 1.0, color: fx.character.palette.primary, a: 1.2, b: 3.5 });
      fx.release(1.4);
    },
    settle(fx, k, dt, out) { out.hold = 1 - smooth(k); out.glow = 1 - k; out.warm = 1 - smooth(k); },
  },

  TERRA: { // rocks rise and circle, it grows heavy, the rocks drop, dust
    timing: { charge: 1.3, action: 0.6, settle: 1.1 },
    ambient(fx) {
      const c = fx.character.palette;
      fx.spawn({ ambient: true, shape: 'dust', color: c.particle, x: rand(-0.8, 0.8) * fx.r, y: fx.r * rand(0.6, 0.9), vx: rand(-8, 8), vy: -4, life: rand(1, 1.6), size: fx.r * 0.07 });
    },
    chargeStart(fx) {
      const c = fx.character.palette;
      fx.orbit(7, { shape: 'rock', color: Math.random() < 0.5 ? c.primary : c.accent, radius: [1.5, 1.9], angVel: [0.8, 1.2], life: [3.2, 3.4], size: [1.4, 2.2] });
    },
    charge(fx, k, dt, out) { out.hold = smooth(k); out.glow = k * 0.5; out.sink = smooth(k) * fx.r * 0.25; },
    actionStart(fx) {
      for (const p of fx.particles) if (p.active && p.shape === 'rock' && !p.ambient) p.angVel *= 2.6; // spin up
    },
    action(fx, k, dt, out) { out.hold = 1; out.glow = 0.6; out.sink = fx.r * 0.25; },
    settleStart(fx) { // rocks drop, dust puffs where they land
      const c = fx.character.palette;
      fx.release(0.4, 5.5);
      fx.burst(10, { shape: 'dust', color: c.particle, from: 0.9, speed: [0.6, 1.3], life: [0.7, 1.1], size: [1.4, 2.2], drag: 2.2 });
    },
    settle(fx, k, dt, out) { out.hold = 1 - smooth(k); out.glow = 0.6 * (1 - k); out.sink = fx.r * 0.25 * (1 - smooth(k)); },
  },

  GALE: { // ribbons circle and speed up, a spin, a gust
    timing: { charge: 1.0, action: 0.6, settle: 0.9 },
    ambient(fx) {
      const c = fx.character.palette;
      const a = rand(0, TAU);
      fx.spawn({ ambient: true, shape: 'spark', color: c.particle, x: Math.cos(a) * fx.r * 1.6, y: Math.sin(a) * fx.r * 1.6, vx: -Math.sin(a) * fx.r * 1.4, vy: Math.cos(a) * fx.r * 1.4, drag: 0.6, life: rand(0.5, 0.8), size: fx.r * 0.04 });
    },
    chargeStart(fx) {
      const c = fx.character.palette;
      fx.shape('ribbons', { dur: 2.0, color: c.accent, n: 3, a: 3.5, b: 3 });
      fx.orbit(10, { shape: 'spark', color: c.particle, radius: [1.4, 2], angVel: [4, 6], life: [1.7, 1.9], size: [0.7, 1] });
    },
    charge(fx, k, dt, out) { out.hold = smooth(k); out.glow = k * 0.5; out.spin = k * k * Math.PI; },
    actionStart(fx) {
      const c = fx.character.palette;
      fx.shape('ring', { dur: 0.7, color: c.accent, a: 1.2, b: 4 });
      fx.release(3.5);
    },
    action(fx, k, dt, out) { out.hold = 1; out.glow = 0.7; out.spin = Math.PI + smooth(k) * Math.PI; },
    settle(fx, k, dt, out) { out.hold = 1 - smooth(k); out.glow = 0.7 * (1 - k); out.spin = TAU; },
  },

  VERDANT: { // green motes and leaves gather, a living pulse, tendrils grow, leaves drift off
    timing: { charge: 1.2, action: 0.8, settle: 1.3 },
    ambient(fx) {
      const c = fx.character.palette;
      fx.spawn({ ambient: true, shape: Math.random() < 0.5 ? 'leaf' : 'dot', color: Math.random() < 0.5 ? c.particle : c.primary, x: rand(-1.4, 1.4) * fx.r, y: rand(-1.2, 1.2) * fx.r, vx: rand(-5, 5), vy: -fx.r * 0.15, sway: 0.25, ang: rand(0, TAU), life: rand(1.4, 2.2), size: fx.r * 0.05 });
    },
    chargeStart(fx) {
      const c = fx.character.palette;
      fx.orbit(8, { shape: 'leaf', color: c.particle, radius: [1.4, 1.9], angVel: [0.7, 1.1], life: [2.6, 2.8], size: [1, 1.4] });
    },
    charge(fx, k, dt, out) {
      out.hold = smooth(k) * 0.9; out.glow = 0.3 + 0.4 * Math.sin(k * Math.PI * 3) ** 2; // the core pulses like a heartbeat
    },
    actionStart(fx) {
      const c = fx.character.palette;
      fx.shape('vines', { dur: 1.5, color: c.primary, color2: c.accent, n: 6 });
      fx.shape('ring', { dur: 1.0, color: c.primary, a: 1, b: 3 });
    },
    action(fx, k, dt, out) { out.hold = 0.9; out.glow = 1; },
    settleStart(fx) { // the leaves let go and drift away, swaying
      for (const p of fx.particles) {
        if (!p.active || p.mode !== 'orbit' || p.ambient) continue;
        p.sway = 0.35;
      }
      fx.release(0.7, -0.3);
    },
    settle(fx, k, dt, out) { out.hold = 0.9 * (1 - smooth(k)); out.glow = 1 - k; },
  },
};

/** Elements with a showcase (for tests and future content checks). */
export const SHOWCASE_ELEMENTS = Object.freeze(Object.keys(SCRIPTS));
