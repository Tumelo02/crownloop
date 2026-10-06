import { FEEDBACK, PARTICLES, POWER_UPS, SURGE } from '../config.js';
import { GameEvent } from '../core/EventBus.js';
import { skinById } from '../progression/skins.js';
import { SignatureSlashes } from '../render/signatureSlash.js';

const TAU = Math.PI * 2;
const MAX_RINGS = 24;
const VICTIM_DELAY = 0.09; // seconds between the attacker's slash and the victim's reaction
const COMBAT_QUIET = 0.45; // seconds during which low-priority pickup effects stay subtle

/** Power-up colours (one place): pickup bursts, auras, expiry fizzles. */
export const POWER_UP_HUES = Object.freeze({
  surge: SURGE.HUE,
  magnet: POWER_UPS.MAGNET.HUE,
  vision: POWER_UPS.VISION.HUE,
  tracker: POWER_UPS.TRACKER.HUE,
  zoom: POWER_UPS.ZOOM.HUE,
  multiplier: POWER_UPS.MULTIPLIER.HUE,
});

function makeRing() {
  return { active: false, kind: 'burst', x: 0, y: 0, hue: 0, age: 0, dur: 0.5, r0: 20, r1: 80, follow: null, seed: 0 };
}

/**
 * CombatEffectManager: the single, event-driven owner of what gameplay MOMENTS look and
 * sound like. Gameplay systems only emit events; this turns them into VISUAL + AUDIO:
 *
 *   TRAIL_SLICED       attacker's signature slash + element slice sound (+ shake if you're in it)
 *   PLAYER_ELIMINATED  victim's own element elimination, a beat after the slash
 *                      (body hits get a smaller attacker slash at the contact point)
 *   PLAYER_COLLISION   small "contact" ring + sparks (never the lethal slash)
 *   POWERUP_ACTIVATED  pickup burst in the power-up's colour + activation sound (+ Vision scan)
 *   POWERUP_EXPIRED    a short fizzle + expiry sound
 * Persistent power-up states (Surge streaks, Magnet field, Vision scans,
 * 5X glyph) are drawn by drawStates() every frame while they last.
 *
 * Priority: a lethal slice opens a short "combat quiet" window in which low-priority
 * pickup effects stay subtle (see isCombatQuiet), so they never drown out the attack.
 */
export class CombatEffectManager {
  /**
   * @param {object} game Game (camera, audio, particles, effects, elementalEffects,
   *   inView, soundLevelAt, player)
   */
  constructor(game) {
    this.game = game;
    this.slashes = new SignatureSlashes();
    this.rings = Array.from({ length: MAX_RINGS }, makeRing);
    this.pending = []; // delayed victim reactions
    this.time = 0;
    this.quietUntil = -Infinity;
    this.bind(game.events);
  }

  clear() {
    this.slashes.clear();
    for (const r of this.rings) r.active = false;
    this.pending.length = 0;
    this.quietUntil = -Infinity;
  }

  isCombatQuiet() {
    return this.time < this.quietUntil;
  }

  bind(events) {
    events.on(GameEvent.TRAIL_SLICED, (e) => this.onTrailSliced(e));
    events.on(GameEvent.PLAYER_ELIMINATED, (e) => this.onEliminated(e));
    events.on(GameEvent.PLAYER_COLLISION, (e) => this.onContact(e));
    events.on(GameEvent.POWERUP_ACTIVATED, (e) => this.onPowerUpActivated(e));
    events.on(GameEvent.POWERUP_EXPIRED, (e) => this.onPowerUpExpired(e));
  }

  /** Stereo position of a world point relative to the camera (-1 left .. 1 right). */
  panAt(x) {
    const cam = this.game.camera;
    const half = this.game.width / (2 * cam.zoom) || 1;
    return Math.max(-0.85, Math.min(0.85, (x - cam.x) / half));
  }

  // ------------------------------------------------------------ combat

  /**
   * 1. LETHAL TRAIL SLICE: the attacker's signature slash lands ON THE VICTIM (the one being
   * severed), aimed from the cut toward them. The cut point itself is where the attacker
   * stands, so it only gets a small snap ring on the tether.
   */
  onTrailSliced({ cutter, victim, x, y, heading }) {
    const game = this.game;
    const vx = victim.x;
    const vy = victim.y;
    const victimSeen = game.inView(vx, vy, 120);
    if (!victimSeen && !game.inView(x, y, 120)) return;
    if (cutter !== victim && game.inView(x, y, 60)) this.ring('contact', x, y, victim.hue, 0.32, 6, 34);
    const character = cutter.character || skinById('core');
    const d = Math.hypot(vx - x, vy - y);
    const aim = d > 1 ? Math.atan2(vy - y, vx - x) : heading;
    if (victimSeen) this.slashes.emit(character, vx, vy, aim, 1);
    const sx = victimSeen ? vx : x;
    game.audio.playTrailSliceSound(character.element, { level: game.soundLevelAt(sx, victimSeen ? vy : y), pan: this.panAt(sx) });
    this.quietUntil = this.time + COMBAT_QUIET;
    if (cutter.isPlayer && cutter !== victim) game.camera.shake(FEEDBACK.SHAKE_PLAYER_KILL);
  }

  /**
   * 4. ELIMINATION: the victim's own element reaction, a beat after the attack, so it reads
   * ATTACK -> SLICE -> ELIMINATION. Body hits show a smaller attacker slash at the contact.
   */
  onEliminated({ killer, victim, reason, x, y }) {
    const game = this.game;
    const contact = reason && reason.startsWith('collision');
    if (contact && killer !== victim && game.inView(victim.x, victim.y, 120)) {
      // Body hits: a smaller attacker slash, also on the one who falls.
      const character = killer.character || skinById('core');
      this.slashes.emit(character, victim.x, victim.y, Math.atan2(victim.y - killer.y, victim.x - killer.x), 0.75);
      game.audio.playTrailSliceSound(character.element, { level: game.soundLevelAt(victim.x, victim.y) * 0.85, pan: this.panAt(victim.x) });
      this.quietUntil = this.time + COMBAT_QUIET;
    }
    if (!game.inView(victim.x, victim.y, victim.radius * 3)) return;
    this.pending.push({ at: this.time + VICTIM_DELAY, victim, x: victim.x, y: victim.y });
  }

  playVictim({ victim, x, y }) {
    const game = this.game;
    const character = victim.character || skinById('core');
    game.elementalEffects.emitElimination(character, x, y);
    game.audio.play(character.soundSet.elimination, {
      element: character.element,
      level: victim.isPlayer ? 1 : game.soundLevelAt(x, y),
      pan: victim.isPlayer ? 0 : this.panAt(x),
    });
    game.particles.emit(x, y, victim.hue, PARTICLES.ELIMINATION, 0.7);
  }

  /** 7. NON-LETHAL CONTACT: a small ring and sparks, clearly "contact", not "death". */
  onContact({ a, b, x, y, strength = 0.4 }) {
    const game = this.game;
    if (!game.inView(x, y, 60)) return;
    const involvesPlayer = a.isPlayer || b.isPlayer;
    const character = (a.isPlayer ? a.character : b.isPlayer ? b.character : a.character) || skinById('core');
    game.elementalEffects.emitContact(character, x, y, Math.atan2(b.y - a.y, b.x - a.x), involvesPlayer ? strength : 0.5);
    this.ring('contact', x, y, a.hue, 0.32, 6, 34);
    if (involvesPlayer) {
      game.camera.shake(FEEDBACK.SHAKE_BUMP * (0.6 + strength));
      game.audio.play('contact', { strength, pan: this.panAt(x) });
    }
  }

  // ------------------------------------------------------------ power-ups

  /** 2. POWER-UP ACTIVATION: a burst in its colour, its own sound, and its state starts. */
  onPowerUpActivated({ creature, type }) {
    const game = this.game;
    const hue = POWER_UP_HUES[type];
    if (!game.inView(creature.x, creature.y, 200)) return;
    this.ring('burst', creature.x, creature.y, hue, 0.55, creature.radius, creature.radius * 4, creature);
    game.particles.emit(creature.x, creature.y, hue, PARTICLES.SURGE, 1.1);
    if (type === 'vision') this.ring('scan', creature.x, creature.y, hue, 1.1, creature.radius, 700, creature);
    if (type === 'multiplier') this.ring('glyph', creature.x, creature.y, hue, 0.7, creature.radius * 1.2, creature.radius * 3, creature);
    if (creature.isPlayer) {
      game.audio.play(type === 'multiplier' ? 'multiplier' : type);
      game.camera.shake(FEEDBACK.SHAKE_SURGE);
    }
  }

  /** ACTIVE -> ENDING -> EXPIRED: a short fizzle as the state goes away. */
  onPowerUpExpired({ creature, type }) {
    const game = this.game;
    if (!creature.alive || !game.inView(creature.x, creature.y, 120)) return;
    this.ring('fizzle', creature.x, creature.y, POWER_UP_HUES[type], 0.45, creature.radius * 2.2, creature.radius * 1.1, creature);
    if (creature.isPlayer) game.audio.play('expire');
  }

  ring(kind, x, y, hue, dur, r0, r1, follow = null) {
    let ring = this.rings.find((r) => !r.active);
    if (!ring) ring = this.rings[0];
    Object.assign(ring, { active: true, kind, x, y, hue, age: 0, dur, r0, r1, follow, seed: Math.random() * TAU });
  }

  // ------------------------------------------------------------ frame

  update(dt) {
    dt = Math.max(0, dt);
    this.time += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.pending[i].at <= this.time) {
        this.playVictim(this.pending[i]);
        this.pending.splice(i, 1);
      }
    }
    this.slashes.update(dt);
    for (const r of this.rings) {
      if (!r.active) continue;
      r.age += dt;
      if (r.follow && r.follow.alive) {
        r.x = r.follow.x;
        r.y = r.follow.y;
      }
      if (r.age >= r.dur) r.active = false;
    }
  }

  /** One-shot effects: rings / bursts / breaks, then the signature slashes on top. */
  draw(ctx, zoom) {
    const px = 1 / zoom;
    for (const r of this.rings) if (r.active) drawRing(ctx, r, px);
    this.slashes.draw(ctx, zoom, this.time);
    ctx.globalAlpha = 1;
  }

  /**
   * Persistent power-up states around each visible creature (the Surge ring is drawn by
   * the creature renderer): Surge streaks, Magnet field, Vision scans, 5X glyph.
   */
  drawStates(ctx, creatures, zoom, time) {
    const px = 1 / zoom;
    for (const c of creatures) {
      if (!c.alive) continue;
      const r = c.displayRadius || c.radius;
      if (c.isSurging) drawSurgeStreaks(ctx, c, r, px, time);
      if (c.magnetTime > 0) drawMagnetField(ctx, c, r, px, time);
      if (c.visionTime > 0 && c.isPlayer) drawVisionPulse(ctx, c, r, px, time);
      if (c.multiplierTime > 0) drawMultiplierGlyph(ctx, c, r, px, time);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- one-shot rings

function hsl(hue, l, a = 1) {
  return `hsla(${hue}, 100%, ${l}%, ${a})`;
}

function drawRing(ctx, r, px) {
  const k = r.age / r.dur;
  const fade = 1 - k;
  const radius = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) ** 2);
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.lineCap = 'round';
  switch (r.kind) {
    case 'burst': { // pickup: bright ring + short rays
      ctx.globalAlpha = fade;
      ctx.strokeStyle = 'rgba(12, 18, 32, 0.5)';
      ctx.lineWidth = 5 * px;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = hsl(r.hue, 55);
      ctx.lineWidth = 3 * px;
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const a = r.seed + (i / 10) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * radius * 0.7, Math.sin(a) * radius * 0.7);
        ctx.lineTo(Math.cos(a) * radius * 1.1, Math.sin(a) * radius * 1.1);
        ctx.strokeStyle = hsl(r.hue, 62, fade);
        ctx.lineWidth = 2 * px;
        ctx.stroke();
      }
      break;
    }
    case 'scan': { // Vision: a wide scanning pulse
      ctx.globalAlpha = fade * 0.6;
      ctx.strokeStyle = hsl(r.hue, 45);
      ctx.lineWidth = 3 * px;
      ctx.setLineDash([16 * px, 10 * px]);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case 'glyph': { // 5X activation: the glyph flares out
      ctx.globalAlpha = fade;
      ctx.rotate(k * 2);
      for (const rot of [0, Math.PI]) {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = rot - Math.PI / 2 + (i / 3) * TAU;
          if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
          else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
        }
        ctx.closePath();
        ctx.strokeStyle = hsl(r.hue, 55);
        ctx.lineWidth = 2.5 * px;
        ctx.stroke();
      }
      break;
    }
    case 'fizzle': { // expiry: a dashed ring shrinking away
      ctx.globalAlpha = fade * 0.8;
      ctx.strokeStyle = hsl(r.hue, 50);
      ctx.lineWidth = 2 * px;
      ctx.setLineDash([5 * px, 7 * px]);
      ctx.lineDashOffset = -k * 30 * px;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    default: { // contact: a small impact ring
      ctx.globalAlpha = fade * 0.9;
      ctx.strokeStyle = 'rgba(12, 18, 32, 0.6)';
      ctx.lineWidth = 2 * px;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- persistent states

function drawSurgeStreaks(ctx, c, r, px, time) {
  // Directional energy streaks trailing behind: "I'm fast right now".
  const back = Math.atan2(-c.vy, -c.vx);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(back);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const off = (i - 1.5) * r * 0.42;
    const phase = (time * 6 + i * 0.37) % 1;
    const start = r * (0.9 + phase * 0.6);
    ctx.globalAlpha = (1 - phase) * 0.85;
    ctx.strokeStyle = hsl(SURGE.HUE, 55);
    ctx.lineWidth = 2.5 * px;
    ctx.beginPath();
    ctx.moveTo(start, off);
    ctx.lineTo(start + r * (0.9 + 0.5 * (i % 2)), off);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMagnetField(ctx, c, r, px, time) {
  // A subtle attraction field: a soft ring and arcs drifting inward.
  const range = Math.min(POWER_UPS.MAGNET.RANGE, r * 7);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = hsl(POWER_UPS.MAGNET.HUE, 55);
  ctx.lineWidth = 1.5 * px;
  ctx.setLineDash([4 * px, 8 * px]);
  ctx.beginPath();
  ctx.arc(0, 0, range, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 6; i++) {
    const k = (time * 0.8 + i / 6) % 1; // 0 -> 1 as an arc travels inward
    const rr = range * (1 - k) + r * 1.3 * k;
    const a = (i / 6) * TAU + time * 0.6;
    ctx.globalAlpha = 0.6 * Math.sin(k * Math.PI);
    ctx.strokeStyle = hsl(POWER_UPS.MAGNET.HUE, 58);
    ctx.lineWidth = 2 * px;
    ctx.beginPath();
    ctx.arc(0, 0, rr, a, a + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVisionPulse(ctx, c, r, px, time) {
  // A faint repeating scan ring while Vision is active (the minimap shows the players).
  const k = (time / 1.6) % 1;
  ctx.save();
  ctx.globalAlpha = (1 - k) * 0.35;
  ctx.strokeStyle = hsl(POWER_UPS.VISION.HUE, 45);
  ctx.lineWidth = 2 * px;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r * 1.5 + k * 420, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawMultiplierGlyph(ctx, c, r, px, time) {
  // A small rotating alien glyph with "5X", orbiting above the creature.
  const hue = POWER_UPS.MULTIPLIER.HUE;
  const size = Math.max(9 * px, r * 0.42);
  const x = c.x + Math.cos(time * 2.4) * r * 1.6;
  const y = c.y - r * 1.75 + Math.sin(time * 2.4) * r * 0.25;
  ctx.save();
  ctx.translate(x, y);
  ctx.save();
  ctx.rotate(time * 1.8);
  for (const rot of [0, Math.PI]) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = rot - Math.PI / 2 + (i / 3) * TAU;
      if (i === 0) ctx.moveTo(Math.cos(a) * size * 1.25, Math.sin(a) * size * 1.25);
      else ctx.lineTo(Math.cos(a) * size * 1.25, Math.sin(a) * size * 1.25);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(36, 6, 30, 0.75)';
    ctx.fill();
    ctx.strokeStyle = hsl(hue, 62);
    ctx.lineWidth = 1.6 * px;
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = hsl(hue, 88);
  ctx.font = `900 ${size * 1.05}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('5X', 0, size * 0.05);
  ctx.restore();
}
