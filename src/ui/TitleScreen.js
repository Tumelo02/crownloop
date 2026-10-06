import { TITLE } from '../config.js';
import { drawShowcaseCreature } from '../render/CreatureRenderer.js';
import { ElementShowcase } from '../render/elementShowcase.js';
import { MenuBackdrop } from './menuBackdrop.js';

const rand = (a, b) => a + Math.random() * (b - a);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Start-screen presentation (menu only):
 *  - the DOMINION letters drop into place one after another (CSS, staggered per letter)
 *  - the selected character drifts behind the title at reduced opacity, alive between
 *    moments (breathing, bobbing, glancing around), and every 4-8 s performs its
 *    element's showcase (elementShowcase.js), with a subtle sound
 *  - it stays inside a showcase band around the title, never over the name field or PLAY
 * Everything runs only while the start screen is visible; hide() stops the loop and
 * clears every particle.
 */
export class TitleScreen {
  /**
   * @param {() => object} getCharacter current elemental identity
   * @param {(element: string) => void} [onShowcase] the moment an element acts (sound)
   */
  constructor(getCharacter, onShowcase = null) {
    this.getCharacter = getCharacter;
    this.onShowcase = onShowcase;
    this.screen = document.getElementById('start-screen');
    this.title = this.screen.querySelector('.title');
    this.nameField = this.screen.querySelector('.name-field');
    this.canvas = document.getElementById('title-creature');
    this.ctx = this.canvas.getContext('2d');
    this.fx = new ElementShowcase();
    this.backdrop = new MenuBackdrop(document.getElementById('menu-backdrop'));
    this.running = false;
    this.frame = 0;
    this.last = 0;
    this.time = 0;
    this.region = null;
    this.regionAge = Infinity;
    this.splitTitle();
  }

  /** Wraps each letter so it can fall in on its own (slightly varied) delay. */
  splitTitle() {
    const text = this.title.textContent.trim();
    this.title.setAttribute('aria-label', text);
    this.title.textContent = '';
    [...text].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'title-letter';
      span.textContent = ch;
      span.setAttribute('aria-hidden', 'true');
      const jitter = rand(-0.03, 0.04);
      span.style.animationDelay = `${Math.max(0, TITLE.LETTER_DELAY_START + i * TITLE.LETTER_STAGGER + jitter).toFixed(3)}s`;
      this.title.appendChild(span);
    });
  }

  /** Replays the drop-in (e.g. when returning to the start screen). */
  replay() {
    this.title.classList.remove('dropping');
    void this.title.offsetWidth;
    this.title.classList.add('dropping');
  }

  show() {
    this.replay();
    this.backdrop.paint();
    if (this.running) return;
    this.running = true;
    this.time = rand(0, 100); // a different path each visit
    this.pathTime = this.time;
    this.heading = 0;
    this.look = 0;
    this.lookTarget = 0;
    this.lookTimer = rand(2, 4);
    this.regionAge = Infinity;
    this.fx.reset(null);
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.draw(dt);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  /** Leaving the menu: stop the loop, drop every particle, clear the canvas. */
  hide() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.fx.reset(null);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Where the character may roam (canvas px): the band around the title, ending well
   * above the name field, so the input and PLAY are never covered.
   */
  measureRegion(w, h, r) {
    const base = this.canvas.getBoundingClientRect();
    const title = this.title.getBoundingClientRect();
    const name = this.nameField ? this.nameField.getBoundingClientRect() : { top: h * 0.6 };
    const titleH = Math.max(1, title.height);
    let top = Math.max(r * 1.3, title.top - base.top - titleH * 0.5);
    let bottom = Math.min(name.top - base.top - r * 1.6, title.bottom - base.top + titleH * 0.7);
    if (bottom - top < r * 0.5) { // short landscape screens: hug the title line
      const mid = title.top - base.top + titleH / 2;
      top = mid - r * 0.25;
      bottom = mid + r * 0.25;
    }
    // Effects (rings, rays) may spread wider than the creature, but nothing is drawn
    // below this line: the name field and everything under it stay untouched.
    const clip = name.top - base.top - 8;
    return { left: r * 1.8, right: Math.max(r * 1.8, w - r * 1.8), top, bottom, clip };
  }

  draw(dt) {
    const canvas = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      this.regionAge = Infinity;
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const character = this.getCharacter();
    const r = Math.min(w, h) * TITLE.CREATURE_SIZE;
    this.regionAge += dt;
    if (this.regionAge > 0.5) { // layout can move (title drop, resize, scroll)
      this.region = this.measureRegion(w, h, r);
      this.regionAge = 0;
    }
    const region = this.region;
    const fx = this.fx;
    const out = fx.out;
    this.time += dt;
    const t = this.time;

    // Drift: a slow wandering path that pauses while the element performs.
    this.pathTime += dt * TITLE.CREATURE_SPEED * (1 - out.hold);
    const pos = (pt) => ({
      x: region.left + (region.right - region.left)
        * (0.5 + 0.42 * Math.sin(pt * 0.23) + 0.08 * Math.sin(pt * 0.61 + 1.3)),
      y: region.top + (region.bottom - region.top)
        * (0.5 + 0.38 * Math.sin(pt * 0.19 + 0.6) + 0.12 * Math.cos(pt * 0.47)),
    });
    const p = pos(this.pathTime);
    const q = pos(this.pathTime + 0.3);
    if (out.hold < 0.6) {
      const target = Math.atan2(q.y - p.y, q.x - p.x);
      this.heading += wrapAngle(target - this.heading) * Math.min(1, dt * 3);
    }

    // Idle life: breathing, bobbing, the occasional glance.
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      this.lookTarget = this.lookTarget === 0 ? rand(-0.7, 0.7) : 0;
      this.lookTimer = this.lookTarget === 0 ? rand(2.5, 5) : rand(0.8, 1.6);
    }
    this.look += (this.lookTarget - this.look) * Math.min(1, dt * 4);
    const breathe = 1 + 0.035 * Math.sin(t * 1.8);
    const bob = Math.sin(t * 1.25) * r * 0.1;

    const cx = p.x + out.dx;
    const cy = p.y + bob + out.dy + out.sink;
    fx.update(dt, character, cx, cy, r, this.onShowcase);

    const heading = this.heading + this.look + out.spin + Math.sin(t * 0.7) * 0.08;
    fx.drawBack(ctx);
    drawShowcaseCreature(ctx, character.look, cx, cy, r * breathe, heading, t, 1,
      0.25 + 0.75 * out.glow, character);
    fx.drawFront(ctx);

    // Effects fade out softly just above the name field and never reach it.
    const clip = Math.max(0, region.clip);
    const feather = Math.min(36, clip);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const fade = ctx.createLinearGradient(0, clip - feather, 0, clip);
    fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, clip - feather, w, feather);
    ctx.restore();
    ctx.clearRect(0, clip, w, h - clip);
  }
}
