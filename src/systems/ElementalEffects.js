const MAX_EFFECTS = 28;
const EFFECT_SHADOW = 'rgba(15, 25, 45, 0.45)';
const PARTICLES_PER_EFFECT = 12;
const TAU = Math.PI * 2;

function makeEffect() {
  return {
    active: false,
    character: null,
    type: '',
    x: 0,
    y: 0,
    heading: 0,
    age: 0,
    duration: 0,
    particles: Array.from({ length: PARTICLES_PER_EFFECT }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, delay: 0, life: 0, size: 0,
    })),
  };
}

/** Bounded, event-driven elemental presentation; it never changes simulation state. */
export class ElementalEffects {
  constructor() {
    this.pool = Array.from({ length: MAX_EFFECTS }, makeEffect);
    this.active = [];
    this.next = 0;
  }

  clear() {
    for (const effect of this.active) effect.active = false;
    this.active.length = 0;
    this.next = 0;
  }

  acquire(character, type, x, y, heading = 0) {
    const effect = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    if (effect.active) {
      const index = this.active.indexOf(effect);
      if (index !== -1) this.active.splice(index, 1);
    }
    effect.active = true;
    effect.character = character;
    effect.type = type;
    effect.x = x;
    effect.y = y;
    effect.heading = heading;
    effect.scale = 1;
    effect.age = 0;
    effect.duration = type === 'contact' ? 0.24 : type === 'cut' ? 0.42 : type === 'capture' ? 0.56 : 0.72;
    const count = type === 'contact' ? 5 : type === 'cut' ? 7 : type === 'capture' ? 4 : PARTICLES_PER_EFFECT;
    for (let i = 0; i < effect.particles.length; i++) {
      const particle = effect.particles[i];
      if (i >= count) {
        particle.life = 0;
        continue;
      }
      const angle = heading + (TAU * i) / count + (Math.random() - 0.5) * 0.3;
      const inwardVoid = character.element === 'VOID' && type !== 'capture';
      const speed = type === 'contact' ? 26 + Math.random() * 26 : type === 'cut' ? 24 + Math.random() * 34
        : type === 'capture' ? 18 + Math.random() * 30 : 45 + Math.random() * 90;
      const startRadius = inwardVoid ? (type === 'cut' ? 18 : 28) + Math.random() * 12 : 0;
      particle.x = x + Math.cos(angle) * startRadius;
      particle.y = y + Math.sin(angle) * startRadius;
      particle.vx = Math.cos(angle) * speed * (inwardVoid ? -1 : 1);
      particle.vy = Math.sin(angle) * speed * (inwardVoid ? -1 : 1);
      particle.delay = Math.random() * 0.08;
      particle.life = type === 'contact' ? 0.16 : type === 'cut' ? 0.22 : type === 'capture' ? 0.34 : 0.48 + Math.random() * 0.18;
      particle.size = type === 'contact' ? 1.6 + Math.random() * 1.2 : type === 'cut' ? 2.2 + Math.random() * 1.8
        : type === 'capture' ? 1.8 + Math.random() * 1.8 : 3 + Math.random() * 3;
    }
    this.active.push(effect);
    return effect;
  }

  emitTrailCut(character, x, y, heading) {
    if (character) this.acquire(character, 'cut', x, y, heading);
  }

  emitContact(character, x, y, heading = 0, strength = 0.5) {
    if (!character) return;
    const effect = this.acquire(character, 'contact', x, y, heading);
    effect.scale = Math.max(0.75, Math.min(1.25, strength));
  }

  emitElimination(character, x, y) {
    if (character) this.acquire(character, 'elimination', x, y);
  }

  emitTerritoryCapture(character, x, y, scale = 1) {
    if (!character) return;
    const effect = this.acquire(character, 'capture', x, y);
    effect.scale = Math.max(0.6, Math.min(1.8, scale));
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const effect = this.active[i];
      effect.age += dt;
      if (effect.age >= effect.duration) {
        effect.active = false;
        this.active.splice(i, 1);
        continue;
      }
      for (const particle of effect.particles) {
        if (particle.life <= 0 || effect.age < particle.delay) continue;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 1 - Math.min(1, dt * 2.8);
        particle.vy *= 1 - Math.min(1, dt * 2.8);
      }
    }
  }

  drawCutMark(ctx, effect, style, radius, zoom, fade) {
    const angle = effect.heading;
    const length = radius * (0.55 + (1 - fade) * 0.65);
    ctx.save();
    ctx.translate(effect.x, effect.y);
    ctx.rotate(angle);
    ctx.globalAlpha = fade * 0.9;
    ctx.strokeStyle = effect.character.palette.accent;
    ctx.fillStyle = effect.character.palette.primary;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.4 / zoom, 2.1 / zoom * fade);
    ctx.shadowColor = EFFECT_SHADOW; // dark backing: pale elements stay readable on the light floor
    ctx.shadowBlur = 9 / zoom;
    ctx.beginPath();
    if (style === 'ripple') {
      ctx.ellipse(0, 0, length, length * 0.32, 0, 0.12, Math.PI - 0.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, length * 0.72, length * 0.24, 0, Math.PI + 0.2, TAU - 0.2);
      ctx.stroke();
    } else if (style === 'fault') {
      ctx.moveTo(-length * 0.5, -length * 0.12);
      ctx.lineTo(-length * 0.16, -length * 0.12);
      ctx.lineTo(-length * 0.03, -length * 0.44);
      ctx.moveTo(-length * 0.16, -length * 0.12);
      ctx.lineTo(length * 0.08, length * 0.1);
      ctx.lineTo(length * 0.02, length * 0.48);
      ctx.moveTo(length * 0.08, length * 0.1);
      ctx.lineTo(length * 0.5, length * 0.2);
      ctx.stroke();
    } else if (style === 'thorn') {
      ctx.moveTo(-length * 0.54, 0);
      ctx.lineTo(length * 0.5, 0);
      ctx.stroke();
      for (const side of [-1, 1]) {
        for (const x of [-0.28, 0.1, 0.4]) {
          ctx.beginPath();
          ctx.moveTo(length * x, 0);
          ctx.lineTo(length * (x + 0.12), side * length * 0.24);
          ctx.lineTo(length * (x + 0.2), 0);
          ctx.stroke();
        }
      }
    } else if (style === 'shatter') {
      ctx.moveTo(-length * 0.5, -length * 0.48);
      ctx.lineTo(-length * 0.08, -length * 0.12);
      ctx.lineTo(length * 0.08, -length * 0.27);
      ctx.lineTo(length * 0.5, length * 0.48);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-length * 0.08, -length * 0.12);
      ctx.lineTo(-length * 0.38, length * 0.38);
      ctx.moveTo(length * 0.08, -length * 0.27);
      ctx.lineTo(length * 0.42, -length * 0.45);
      ctx.stroke();
    } else if (style === 'rift') {
      ctx.strokeStyle = effect.character.palette.secondary;
      ctx.lineWidth *= 1.7;
      ctx.beginPath();
      ctx.moveTo(-length * 0.36, -length * 0.62);
      ctx.bezierCurveTo(-length * 0.08, -length * 0.28, length * 0.22, -length * 0.18, length * 0.36, 0);
      ctx.bezierCurveTo(length * 0.12, length * 0.13, -length * 0.16, length * 0.38, -length * 0.36, length * 0.62);
      ctx.stroke();
      ctx.strokeStyle = effect.character.palette.accent;
      ctx.lineWidth *= 0.45;
      ctx.beginPath();
      ctx.moveTo(-length * 0.3, -length * 0.48);
      ctx.quadraticCurveTo(0, 0, length * 0.3, length * 0.48);
      ctx.stroke();
    } else if (style === 'flare') {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-length * 0.48, side * length * 0.2);
        ctx.quadraticCurveTo(-length * 0.12, side * length * 0.48, length * 0.42, side * length * 0.08);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-length * 0.22, -length * 0.1);
      ctx.quadraticCurveTo(length * 0.06, -length * 0.52, length * 0.36, -length * 0.18);
      ctx.stroke();
    } else if (style === 'gust') {
      for (let i = 0; i < 3; i++) {
        const offset = (i - 0.5) * length * 0.24;
        ctx.beginPath();
        ctx.moveTo(-length * 0.58, offset + length * 0.16);
        ctx.bezierCurveTo(-length * 0.14, offset - length * 0.34, length * 0.1, offset + length * 0.36, length * 0.58, offset - length * 0.1);
        ctx.stroke();
      }
    } else if (style === 'corona') {
      for (let i = 0; i < 5; i++) {
        const y = (i - 2) * length * 0.13;
        ctx.beginPath();
        ctx.moveTo(-length * 0.5, y);
        ctx.quadraticCurveTo(0, y - length * (0.28 + (i % 2) * 0.1), length * 0.5, y * 0.7);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, length * 0.13, 0, TAU);
      ctx.fill();
    } else { // arc (Core): one bright curved energy slash with a hot inner line
      ctx.lineWidth *= 1.6;
      ctx.moveTo(-length * 0.55, length * 0.3);
      ctx.quadraticCurveTo(0, -length * 0.45, length * 0.55, length * 0.3);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth *= 0.4;
      ctx.beginPath();
      ctx.moveTo(-length * 0.4, length * 0.18);
      ctx.quadraticCurveTo(0, -length * 0.32, length * 0.4, length * 0.18);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawContactMark(ctx, effect, radius, zoom, fade) {
    const r = radius * effect.scale * (0.65 + (1 - fade) * 0.25);
    ctx.save();
    ctx.translate(effect.x, effect.y);
    ctx.rotate(effect.heading);
    ctx.globalAlpha = fade * 0.62;
    ctx.strokeStyle = effect.character.palette.accent;
    ctx.shadowColor = EFFECT_SHADOW;
    ctx.shadowBlur = 5 / zoom;
    ctx.lineWidth = Math.max(0.8 / zoom, 1.5 / zoom * fade);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.58, -0.35, Math.PI * 1.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.32, -r * 0.18);
    ctx.lineTo(r * 0.64, -r * 0.38);
    ctx.moveTo(r * 0.32, r * 0.18);
    ctx.lineTo(r * 0.64, r * 0.38);
    ctx.stroke();
    ctx.restore();
  }

  drawParticle(ctx, effect, particle, zoom, alpha) {
    const style = effect.character.visual.particleStyle;
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = effect.character.palette.particle;
    ctx.strokeStyle = effect.character.palette.accent;
    ctx.lineWidth = Math.max(0.8 / zoom, particle.size * 0.3);
    ctx.beginPath();
    if (style === 'shard') {
      ctx.moveTo(0, -particle.size);
      ctx.lineTo(particle.size * 0.65, particle.size * 0.45);
      ctx.lineTo(-particle.size * 0.5, particle.size * 0.75);
      ctx.closePath();
      ctx.fill();
    } else if (style === 'leaf') {
      ctx.ellipse(0, 0, particle.size * 0.45, particle.size, effect.age * 3, 0, TAU);
      ctx.fill();
    } else if (style === 'streak') {
      ctx.moveTo(-particle.size * 0.5, particle.size * 0.4);
      ctx.lineTo(particle.size * 0.5, -particle.size * 0.4);
      ctx.stroke();
    } else if (style === 'droplet') {
      ctx.arc(0, 0, particle.size * 0.55, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -particle.size);
      ctx.lineTo(-particle.size * 0.4, 0);
      ctx.lineTo(particle.size * 0.4, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.arc(0, 0, particle.size * 0.48, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEliminationMark(ctx, effect, style, radius, zoom, fade) {
    const progress = 1 - fade;
    const contracts = style === 'implode' || style === 'collapse';
    const size = contracts ? radius * (1.1 - progress * 0.72) : radius * (0.55 + progress * 1.8);
    ctx.save();
    ctx.translate(effect.x, effect.y);
    ctx.globalAlpha = fade * 0.76;
    ctx.strokeStyle = effect.character.palette.primary;
    ctx.fillStyle = effect.character.palette.primary;
    ctx.shadowColor = EFFECT_SHADOW; // dark backing: pale elements stay readable on the light floor
    ctx.shadowBlur = 10 / zoom;
    ctx.lineWidth = Math.max(1 / zoom, 2.6 / zoom * fade);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (style === 'fracture') { // Terra: a cracked stone ring
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = i * TAU / 8;
        const r = size * (i % 2 === 0 ? 1 : 0.78);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (style === 'vortex') { // Gale: two counter-spinning wind arcs
      ctx.beginPath();
      ctx.arc(0, 0, size, effect.age * 5, effect.age * 5 + Math.PI * 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.64, -effect.age * 6 + 2, -effect.age * 6 + 2 + Math.PI);
      ctx.stroke();
    } else if (style === 'bloom') { // Verdant: petals opening
      for (let i = 0; i < 6; i++) {
        const angle = i * TAU / 6 + effect.age * 0.7;
        ctx.beginPath();
        ctx.ellipse(Math.cos(angle) * size * 0.48, Math.sin(angle) * size * 0.48,
          size * 0.4, size * 0.16, angle, 0, TAU);
        ctx.stroke();
      }
    } else if (style === 'burst') { // Ember: flame tongues licking outward
      ctx.fillStyle = effect.character.palette.primary;
      for (let i = 0; i < 7; i++) {
        const angle = i * TAU / 7 + effect.x * 0.01;
        const reach = size * (0.9 + 0.25 * Math.sin(i * 2.3 + effect.age * 20));
        const w = size * 0.2;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(ca * size * 0.3 - sa * w, sa * size * 0.3 + ca * w);
        ctx.quadraticCurveTo(ca * reach * 0.75 + sa * w, sa * reach * 0.75 - ca * w, ca * reach, sa * reach);
        ctx.quadraticCurveTo(ca * reach * 0.6 - sa * w * 0.4, sa * reach * 0.6 + ca * w * 0.4, ca * size * 0.3 + sa * w, sa * size * 0.3 - ca * w);
        ctx.closePath();
        ctx.globalAlpha = fade * 0.55;
        ctx.fill();
      }
    } else if (style === 'shards') { // Glacier: ice shards flying apart
      ctx.fillStyle = effect.character.palette.accent;
      for (let i = 0; i < 7; i++) {
        const angle = i * TAU / 7 + 0.4;
        const d = size * (0.55 + 0.25 * (i % 3) / 2);
        ctx.save();
        ctx.translate(Math.cos(angle) * d, Math.sin(angle) * d);
        ctx.rotate(angle + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.26);
        ctx.lineTo(size * 0.08, size * 0.12);
        ctx.lineTo(-size * 0.08, size * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else if (style === 'surge') { // Tidal: ripples spreading across water
      for (let i = 0; i < 3; i++) {
        const r = size * (0.45 + i * 0.32);
        ctx.globalAlpha = fade * 0.7 * (1 - i * 0.25);
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.62, 0, 0, TAU);
        ctx.stroke();
      }
    } else if (style === 'supernova') { // Sol: radiant corona with alternating rays
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.6, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 16; i++) {
        const angle = i * TAU / 16 + effect.age;
        const outer = size * (i % 2 ? 0.95 : 1.3);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * size * 0.68, Math.sin(angle) * size * 0.68);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.stroke();
      }
    } else { // collapse (Core) / implode (Void): a ring drawn in on itself
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.55, effect.age * 4, effect.age * 4 + Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTerritoryMark(ctx, effect, style, radius, zoom, fade) {
    const r = radius * (0.72 + (1 - fade) * 0.46) * (effect.scale || 1);
    ctx.save();
    ctx.translate(effect.x, effect.y);
    ctx.globalAlpha = fade * 0.58;
    ctx.strokeStyle = effect.character.palette.primary;
    ctx.shadowColor = EFFECT_SHADOW; // dark backing: pale elements stay readable on the light floor
    ctx.shadowBlur = 7 / zoom;
    ctx.lineWidth = Math.max(0.8 / zoom, 1.7 / zoom * fade);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (style === 'frost-ring') {
      for (let i = 0; i < 8; i++) {
        const angle = i * TAU / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * r * 0.68, Math.sin(angle) * r * 0.68);
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        ctx.stroke();
      }
    } else if (style === 'void-ripple' || style === 'tidal-ripple') {
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, r * (0.55 + i * 0.34), r * (0.28 + i * 0.15),
          effect.age * (style === 'void-ripple' ? -0.5 : 0.45), 0, TAU);
        ctx.stroke();
      }
    } else if (style === 'solar-corona') {
      for (let i = 0; i < 10; i++) {
        const angle = i * TAU / 10;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * r * 0.72, Math.sin(angle) * r * 0.72);
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        ctx.stroke();
      }
    } else if (style === 'earth-fracture') {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = i * TAU / 8;
        const distance = r * (i % 2 ? 0.84 : 1);
        if (i === 0) ctx.moveTo(Math.cos(angle) * distance, Math.sin(angle) * distance);
        else ctx.lineTo(Math.cos(angle) * distance, Math.sin(angle) * distance);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (style === 'wind-ribbon') {
      for (const offset of [-0.18, 0.18]) {
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * (0.34 + offset), offset, 0.1, Math.PI * 1.85);
        ctx.stroke();
      }
    } else if (style === 'verdant-bloom') {
      for (let i = 0; i < 6; i++) {
        const angle = i * TAU / 6 + effect.age * 0.3;
        ctx.beginPath();
        ctx.ellipse(Math.cos(angle) * r * 0.52, Math.sin(angle) * r * 0.52,
          r * 0.31, r * 0.12, angle, 0, TAU);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0.2, Math.PI * 1.8);
      ctx.stroke();
      if (style === 'ember-ring') {
        for (let i = 0; i < 5; i++) {
          const angle = i * TAU / 5 + effect.age * 0.25;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * r * 0.74, Math.sin(angle) * r * 0.74);
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  /** Element-coloured light behind the mark: Void darkens instead of glowing. */
  drawGlow(ctx, effect, radius, fade) {
    const palette = effect.character.palette;
    const r = radius * (effect.type === 'contact' ? 0.75 : effect.type === 'cut' ? 1.3 : 1.9)
      * (0.7 + 0.3 * (1 - fade));
    const glow = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, r);
    const dark = effect.character.element === 'VOID';
    glow.addColorStop(0, dark ? palette.secondary : palette.primary);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.globalAlpha = fade * (dark ? 0.7 : effect.type === 'contact' ? 0.16 : 0.32);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  draw(ctx, zoom) {
    for (const effect of this.active) {
      const character = effect.character;
      const fade = Math.max(0, 1 - effect.age / effect.duration);
      const radius = effect.type === 'contact' ? 18 : effect.type === 'cut' ? 24 : effect.type === 'capture' ? 40 : 32;
      if (effect.type !== 'capture') this.drawGlow(ctx, effect, radius, fade);
      if (effect.type === 'contact') {
        this.drawContactMark(ctx, effect, radius, zoom, fade);
      } else if (effect.type === 'cut') {
        this.drawCutMark(ctx, effect, character.effects.cutStyle, radius, zoom, fade);
      } else if (effect.type === 'capture') {
        this.drawTerritoryMark(ctx, effect, character.territoryEffect.style, radius, zoom, fade);
      } else {
        this.drawEliminationMark(ctx, effect, character.effects.eliminationStyle, radius, zoom, fade);
      }
      for (const particle of effect.particles) {
        const particleAge = effect.age - particle.delay;
        if (particle.life <= 0 || particleAge < 0 || particleAge >= particle.life) continue;
        this.drawParticle(ctx, effect, particle, zoom, fade * (1 - particleAge / particle.life));
      }
    }
  }
}
