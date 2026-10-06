import { SKINS } from '../progression/skins.js';
import { drawShowcaseCreature } from '../render/CreatureRenderer.js';
import { traceOutline } from '../render/territoryShapes.js';
import { drawCrown } from '../render/sprites.js';
import { KING } from '../config.js';
import { MenuSheet } from './MenuPanels.js';

/**
 * HOW TO PLAY: an illustrated, looping guide in four little arena scenes, each acted out by
 * the real characters on a scalloped territory like the game's:
 *   1 LEAVE    your character heads out of its territory, a trail growing behind it
 *   2 LOOP     it loops back home and everything inside the loop becomes its territory
 *   3 CUT      another character is out with an open trail; yours crosses it: CUT!
 *   4 KING     your character on the biggest territory, wearing the crown
 * TRY IT NOW starts a match with the step-by-step tutorial switched on.
 * The scenes only animate while the sheet is open. Closes only with its X.
 */
const L = 200; // logical scene size
const N = 14; // cells across
const C = L / N;
const R = 15; // character radius
const TAU = Math.PI * 2;

const key = (c, r) => r * N + c;
const cellAt = (x, y) => [Math.floor(x / C), Math.floor(y / C)];

function blob(set, cx, cy, radiusCells) {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (Math.hypot(c + 0.5 - cx, r + 0.5 - cy) <= radiusCells) set.add(key(c, r));
    }
  }
  return set;
}

/** Point along a polyline at distance d: { x, y, angle }. */
function along(points, d) {
  let left = Math.max(0, d);
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (left <= len || i === points.length - 1) {
      const k = len ? Math.min(1, left / len) : 0;
      return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, angle: Math.atan2(by - ay, bx - ax) };
    }
    left -= len;
  }
  const [x, y] = points[0];
  return { x, y, angle: 0 };
}

function lengthOf(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return total;
}

/** Smooth a polyline (Chaikin) so paths read like steering, not zig-zags. */
function smooth(points, rounds = 3) {
  let pts = points;
  for (let k = 0; k < rounds; k++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

export class HowToPanel extends MenuSheet {
  /**
   * @param {() => object} getCharacter the player's selected character (a skin)
   * @param {() => void} onTry close the sheet and start a match with the tutorial on
   */
  constructor(audio, getCharacter, onTry) {
    super(audio, 'howto-button', 'howto-modal', 'howto-close');
    if (!this.modal) return;
    this.getCharacter = getCharacter;
    this.canvases = [...this.modal.querySelectorAll('canvas[data-scene]')];
    this.frame = 0;
    this.floors = new Map();
    // Sections: THE BASICS (animated scenes) | SCORE & COINS | TERRITORY | LANDMARKS.
    this.tabs = [...this.modal.querySelectorAll('[data-howto-tab]')];
    this.sections = [...this.modal.querySelectorAll('[data-howto-section]')];
    for (const tab of this.tabs) tab.addEventListener('click', () => this.show(tab.dataset.howtoTab));
    document.getElementById('howto-try')?.addEventListener('click', () => {
      this.toggle(false);
      onTry();
    });
  }

  show(id) {
    for (const tab of this.tabs) {
      const on = tab.dataset.howtoTab === id;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
    }
    for (const section of this.sections) section.hidden = section.dataset.howtoSection !== id;
  }

  onOpen() {
    const hero = this.getCharacter() || SKINS[0];
    const rival = SKINS.find((s) => s.id !== hero.id && (s.id === 'ember' || s.id === 'void')) || SKINS[1];
    this.hero = hero;
    this.rival = rival;
    this.start = performance.now();
    this.scenes = {
      leave: leaveScene(),
      loop: loopScene(),
      cut: cutScene(),
      king: kingScene(),
    };
    cancelAnimationFrame(this.frame);
    const tick = (now) => {
      if (!this.isOpen) return;
      this.draw((now - this.start) / 1000);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  draw(time) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const canvas of this.canvases) {
      const size = Math.round(canvas.clientWidth);
      if (!size) continue;
      const px = Math.round(size * dpr);
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(px / L, 0, 0, px / L, 0, 0);
      ctx.clearRect(0, 0, L, L);
      ctx.save();
      ctx.beginPath();
      ctx.arc(L / 2, L / 2, L / 2, 0, TAU);
      ctx.clip();
      ctx.drawImage(this.floor(px), 0, 0, L, L);
      const scene = this.scenes[canvas.dataset.scene];
      scene?.(ctx, time, this);
      ctx.restore();
    }
  }

  /** The arena floor (dark, one soft circle per cell), painted once per size. */
  floor(px) {
    if (this.floors.has(px)) return this.floors.get(px);
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.scale(px / L, px / L);
    const g = ctx.createRadialGradient(L / 2, L * 0.45, 10, L / 2, L / 2, L * 0.72);
    g.addColorStop(0, '#1b2c48');
    g.addColorStop(1, '#0a1222');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, L);
    ctx.strokeStyle = 'rgba(160, 200, 255, 0.07)';
    ctx.lineWidth = 0.8;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        ctx.beginPath();
        ctx.arc((c + 0.5) * C, (r + 0.5) * C, C * 0.42, 0, TAU);
        ctx.stroke();
      }
    }
    this.floors.set(px, canvas);
    return canvas;
  }
}

// ---------------------------------------------------------------- drawing helpers

function drawTerritory(ctx, cells, tone, { alpha = 1, glow = 0, gold = 0 } = {}) {
  if (!cells.size) return;
  const shape = traceOutline((c, r) => cells.has(key(c, r)), 0, N - 1, 0, N - 1, C);
  if (shape.minX === Infinity) return;
  const { hue, sat } = tone.territory;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = `hsla(${hue}, ${Math.max(45, sat)}%, 52%, ${0.4 + glow * 0.35})`;
  ctx.fill(shape.path, 'evenodd');
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = gold > 0
    ? `rgba(255, 211, 77, ${0.6 + 0.4 * gold})`
    : `hsla(${hue}, ${Math.max(50, sat)}%, 70%, 0.95)`;
  ctx.stroke(shape.path);
  ctx.restore();
}

function drawTrail(ctx, points, tone, alpha = 1, dashed = false) {
  if (points.length < 2) return;
  const { hue, sat } = tone.territory;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points) ctx.lineTo(x, y);
  ctx.strokeStyle = `hsla(${hue}, ${Math.max(60, sat)}%, 60%, 0.35)`;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = `hsla(${hue}, ${Math.max(70, sat)}%, 66%, 1)`;
  ctx.lineWidth = 3;
  if (dashed) ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.restore();
}

function drawHero(ctx, skin, x, y, angle, time) {
  drawShowcaseCreature(ctx, skin.look, x, y, R * (1 + 0.03 * Math.sin(time * 3)), angle, time, 1, 0.4, skin);
}

function popText(ctx, text, x, y, t, color = '#ffffff', size = 15) {
  if (t < 0 || t > 1) return;
  ctx.save();
  ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.6) / 0.4);
  ctx.font = `900 ${size * (0.8 + 0.3 * Math.min(1, t * 5))}px system-ui, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.strokeText(text, x, y - t * 14);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y - t * 14);
  ctx.restore();
}

/** Positions along a path, split into "inside home" and "trail" (outside home). */
function trailUpTo(path, d, home, step = 3) {
  const trail = [];
  for (let s = 0; s <= d; s += step) {
    const p = along(path, s);
    const [c, r] = cellAt(p.x, p.y);
    if (home.has(key(c, r))) trail.length = 0; // back home: the trail starts over
    else trail.push([p.x, p.y]);
  }
  return trail;
}

// ---------------------------------------------------------------- the four scenes

/** 1: head out of your territory; a trail grows behind you. */
function leaveScene() {
  const home = blob(new Set(), 4.2, 7.6, 2.7);
  const path = smooth([[60, 108], [96, 104], [124, 90], [146, 96], [160, 120], [150, 146]]);
  const total = lengthOf(path);
  const PERIOD = 4.4;
  return (ctx, time, panel) => {
    const t = time % PERIOD;
    const d = total * ease(clamp01((t - 0.4) / 3));
    drawTerritory(ctx, home, panel.hero);
    const trail = trailUpTo(path, d, home);
    const blink = t > 3.4 ? 0.65 + 0.35 * Math.sin(time * 10) : 1;
    drawTrail(ctx, trail, panel.hero, blink);
    const p = along(path, d);
    drawHero(ctx, panel.hero, p.x, p.y, p.angle, time);
    if (trail.length > 8 && t > 3.4) popText(ctx, 'TRAIL', trail[Math.floor(trail.length / 2)][0], trail[Math.floor(trail.length / 2)][1] - 16, (t - 3.4) / 1, '#ffffff', 13);
  };
}

/** 2: loop back home; everything inside the loop joins your territory. */
function loopScene() {
  const startHome = blob(new Set(), 4.2, 7.6, 2.7);
  const path = smooth([[60, 108], [104, 112], [150, 104], [166, 70], [140, 38], [96, 34], [66, 56], [58, 96]]);
  const total = lengthOf(path);
  // Where the loop closes, and what it captures.
  let closeAt = total;
  let loop = [];
  {
    let out = false;
    const pts = [];
    for (let s = 0; s <= total; s += 2) {
      const p = along(path, s);
      const [c, r] = cellAt(p.x, p.y);
      const home = startHome.has(key(c, r));
      if (!home) {
        out = true;
        pts.push([p.x, p.y]);
      } else if (out) {
        closeAt = s;
        break;
      }
    }
    loop = pts;
  }
  const after = new Set(startHome);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (inside(loop, (c + 0.5) * C, (r + 0.5) * C)) after.add(key(c, r));
    }
  }
  for (const [x, y] of loop) {
    const [c, r] = cellAt(x, y);
    after.add(key(c, r));
  }
  const gained = after.size - startHome.size;
  const PERIOD = 5.6;
  const MOVE = 3.4;
  return (ctx, time, panel) => {
    const t = time % PERIOD;
    const d = Math.min(total, closeAt + 6) * ease(clamp01((t - 0.3) / MOVE));
    const closed = d >= closeAt;
    const since = closed ? t - (0.3 + MOVE * inverseEaseApprox(closeAt / Math.min(total, closeAt + 6))) : -1;
    drawTerritory(ctx, closed ? after : startHome, panel.hero, { glow: closed ? Math.max(0, 1 - since * 1.2) : 0 });
    if (!closed) drawTrail(ctx, trailUpTo(path, d, startHome), panel.hero);
    const p = along(path, d);
    drawHero(ctx, panel.hero, p.x, p.y, p.angle, time);
    if (closed) popText(ctx, `+${gained} TILES`, 112, 78, since / 1.6, '#7dffdc', 15);
  };
}

/** Rough inverse of `ease` for timing the capture pop (good enough for a 0..1 value). */
function inverseEaseApprox(v) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < v) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** 3: a rival is out with an open trail; you cross it and take them out. */
function cutScene() {
  const rivalHome = blob(new Set(), 10.4, 3.2, 2.4);
  const heroHome = blob(new Set(), 3.0, 10.8, 2.4);
  const rivalPath = smooth([[146, 46], [150, 78], [136, 104], [106, 118], [80, 112]]);
  const heroPath = smooth([[42, 152], [62, 134], [92, 118], [124, 84], [150, 60]]);
  const rivalTotal = lengthOf(rivalPath);
  const heroTotal = lengthOf(heroPath);
  const PERIOD = 5;
  const rivalDist = (t) => rivalTotal * clamp01((t - 0.1) / 2.6);
  const heroDist = (t) => heroTotal * clamp01((t - 1.2) / 2.6);
  // The cut: the first moment your character touches the rival's open trail (worked out once).
  let cutTime = Infinity;
  let cutPoint = null;
  for (let t = 1.2; t <= 3.8; t += 0.02) {
    const p = along(heroPath, heroDist(t));
    if (trailUpTo(rivalPath, rivalDist(t), rivalHome).some(([x, y]) => Math.hypot(x - p.x, y - p.y) < 6)) {
      cutTime = t;
      cutPoint = p;
      break;
    }
  }
  return (ctx, time, panel) => {
    const t = time % PERIOD;
    const cut = t >= cutTime;
    const since = cut ? t - cutTime : 0;
    const rd = rivalDist(cut ? cutTime : t);
    const rivalTrail = trailUpTo(rivalPath, rd, rivalHome);
    const hp = along(heroPath, heroDist(t));
    drawTerritory(ctx, rivalHome, panel.rival, { alpha: cut ? Math.max(0.35, 1 - since) : 1 });
    drawTerritory(ctx, heroHome, panel.hero);
    if (!cut) {
      drawTrail(ctx, rivalTrail, panel.rival);
      const rp = along(rivalPath, rd);
      drawHero(ctx, panel.rival, rp.x, rp.y, rp.angle, time);
    } else {
      // Burst where the rival was.
      const rp = along(rivalPath, rd);
      const k = clamp01(since / 0.7);
      if (k < 1) {
        drawTrail(ctx, rivalTrail, panel.rival, 1 - k);
        ctx.save();
        ctx.globalAlpha = 1 - k;
        drawHero(ctx, panel.rival, rp.x, rp.y, rp.angle, time);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.strokeStyle = '#ff6b7a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, R + k * 26, 0, TAU);
      ctx.stroke();
      ctx.restore();
      popText(ctx, 'CUT!', cutPoint.x, cutPoint.y - 18, since / 1.5, '#ff6b7a', 20);
    }
    drawHero(ctx, panel.hero, hp.x, hp.y, hp.angle, time);
  };
}

/** 4: hold the most territory and wear the crown. */
function kingScene() {
  const kingdom = blob(new Set(), 7, 7.4, 5.2);
  const small1 = blob(new Set(), 1.6, 2.2, 1.6);
  const small2 = blob(new Set(), 12.6, 12.4, 1.5);
  for (const k of small1) kingdom.delete(k);
  for (const k of small2) kingdom.delete(k);
  const others = SKINS.filter((s) => s.id === 'glacier' || s.id === 'sol');
  return (ctx, time, panel) => {
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
    drawTerritory(ctx, small1, others[0] || panel.rival, { alpha: 0.85 });
    drawTerritory(ctx, small2, others[1] || panel.rival, { alpha: 0.85 });
    drawTerritory(ctx, kingdom, panel.hero, { glow: 0.2 * pulse, gold: pulse });
    // The King strolls a small circle in the middle of the kingdom.
    const a = time * 0.9;
    const x = L / 2 + Math.cos(a) * 18;
    const y = L * 0.56 + Math.sin(a) * 10;
    drawHero(ctx, panel.hero, x, y, a + Math.PI / 2, time);
    drawCrown(ctx, x, y - R * 0.95 + Math.sin(time * 3) * 1.5, R * 2.1, Math.sin(time * 1.6) * 0.08, 0.5 + 0.5 * Math.sin(time * 2));
    // Sparkles around the crown.
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const s = (time * 0.8 + i / 3) % 1;
      const sa = i * 2.1 + time * 0.5;
      ctx.globalAlpha = Math.sin(s * Math.PI);
      ctx.fillStyle = '#fff3a8';
      const sx = x + Math.cos(sa) * 26;
      const sy = y - R * 2 + Math.sin(sa) * 10 - s * 6;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx + 1.2, sy - 1.2);
      ctx.lineTo(sx + 4, sy);
      ctx.lineTo(sx + 1.2, sy + 1.2);
      ctx.lineTo(sx, sy + 4);
      ctx.lineTo(sx - 1.2, sy + 1.2);
      ctx.lineTo(sx - 4, sy);
      ctx.lineTo(sx - 1.2, sy - 1.2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // "KING" banner under the territory's heart.
    ctx.save();
    ctx.font = '900 14px system-ui, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(60, 35, 0, 0.75)';
    const label = `KING · ${KING.MINIMUM_ARENA_PERCENT}%+`;
    ctx.strokeText(label, L / 2, L * 0.86);
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(label, L / 2, L * 0.86);
    ctx.restore();
  };
}
