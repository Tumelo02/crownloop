import { WHEEL, segmentChance } from '../progression/Wheel.js';
import { formatCountdown, msUntilNextDay } from '../progression/Missions.js';
import { COIN_FRAME_PX, COIN_SPRITE_RADIUS, coinSheet } from '../render/coinSprite.js';
import { MenuSheet, showMenuToast } from './MenuPanels.js';
import { GLYPHS, coinIcon, powerUpIcon, powerUpItem } from './icons.js';

const TAU = Math.PI * 2;
const SEG = TAU / WHEEL.SEGMENTS.length;
const SPIN_SECONDS = 4.6;
const BULBS = 16;

const prizeName = (s) => (s.coins ? `${s.coins.toLocaleString()} coins` : `+1 ${powerUpItem(s.powerUp)?.name ?? s.powerUp}`);

/**
 * WHEEL OF COINS. On the menu: a small wheel (right side) that turns slowly while a free spin
 * is waiting, with FREE SPIN / a countdown under it. It opens a sheet with the big wheel:
 *   left   your recent wins
 *   centre the wheel, its pointer and the spin buttons
 *   right  every prize and its chance
 * One free spin a day; then up to WHEEL.BONUS_SPINS_PER_DAY bonus spins, each by watching an
 * ad (only when ads are available) or for WHEEL.SPIN_PRICE coins. The prize is picked by
 * PlayerProgress.startSpin and paid by finishSpin when the wheel stops (or when the sheet is
 * closed mid-spin). Closes only with its X.
 */
export class WheelPanel extends MenuSheet {
  constructor(audio, progress, platform) {
    super(audio, 'wheel-button', 'wheel-modal', 'wheel-close');
    if (!this.modal) return;
    this.progress = progress;
    this.platform = platform;
    this.canvas = document.getElementById('wheel-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.mini = document.getElementById('wheel-mini');
    this.miniLabel = document.getElementById('wheel-button-label');
    this.actions = document.getElementById('wheel-actions');
    this.note = document.getElementById('wheel-note');
    this.result = document.getElementById('wheel-result');
    this.rotation = 0;
    this.spin = null; // { from, to, start, segment }
    this.frame = 0;
    this.lastTick = 0;
    this.highlight = -1;
    this.adBusy = false;

    this.buildPrizes();
    this.paintMini();
    progress.onChange(() => {
      this.renderButton();
      if (this.isOpen && !this.spin) this.renderActions();
      if (this.isOpen) this.renderHistory();
    });
    // Countdown text on the menu button.
    setInterval(() => this.renderButton(), 30000);
    this.renderButton();
  }

  /** Closing (X, or another sheet opening) never loses a prize: it is paid right away. */
  toggle(open) {
    super.toggle(open);
    if (!open) this.settle();
  }

  onOpen() {
    this.size = 0;
    this.highlight = -1;
    this.result.textContent = '';
    this.renderActions();
    this.renderHistory();
    cancelAnimationFrame(this.frame);
    const loop = (now) => {
      if (!this.isOpen) return;
      this.update(now);
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ menu button

  renderButton() {
    const ready = this.progress.freeSpinReady;
    this.button.classList.toggle('ready', ready);
    this.miniLabel.textContent = ready ? 'FREE SPIN' : formatCountdown(msUntilNextDay());
    this.button.setAttribute('aria-label', ready ? 'Wheel of coins: free spin ready' : 'Wheel of coins');
  }

  paintMini() {
    const size = 96;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.mini.width = size * dpr;
    this.mini.height = size * dpr;
    const ctx = this.mini.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWheel(ctx, size, 0, { labels: false, bulbs: 10, time: 0 });
  }

  // ------------------------------------------------------------ sheet

  buildPrizes() {
    const list = document.getElementById('wheel-prizes');
    const order = WHEEL.SEGMENTS.map((s, i) => i).sort((a, b) => WHEEL.SEGMENTS[a].weight - WHEEL.SEGMENTS[b].weight);
    for (const i of order) {
      const s = WHEEL.SEGMENTS[i];
      const li = document.createElement('li');
      li.className = `wheel-prize${s.jackpot ? ' jackpot' : ''}`;
      li.append(s.coins ? coinIcon() : powerUpIcon(s.powerUp));
      const name = document.createElement('span');
      name.textContent = prizeName(s);
      const chance = document.createElement('strong');
      const pct = segmentChance(i);
      chance.textContent = `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
      li.append(name, chance);
      list.appendChild(li);
    }
  }

  renderHistory() {
    const list = document.getElementById('wheel-history');
    list.textContent = '';
    const history = this.progress.wheel.history;
    if (!history.length) {
      const empty = document.createElement('li');
      empty.className = 'wheel-empty';
      empty.textContent = 'Your prizes will show up here.';
      list.appendChild(empty);
      return;
    }
    for (const h of history) {
      const s = WHEEL.SEGMENTS[h.segment];
      const li = document.createElement('li');
      li.className = `wheel-win${s.jackpot ? ' jackpot' : ''}`;
      li.append(s.coins ? coinIcon() : powerUpIcon(s.powerUp));
      const name = document.createElement('span');
      name.textContent = prizeName(s);
      const when = document.createElement('small');
      when.textContent = timeAgo(h.at);
      li.append(name, when);
      list.appendChild(li);
    }
  }

  renderActions() {
    const p = this.progress;
    this.actions.textContent = '';
    const spinning = Boolean(this.spin) || this.adBusy;
    if (p.freeSpinReady) {
      this.actions.append(this.action('wheel-spin wheel-spin-free', 'SPIN · FREE', spinning, () => this.start('free')));
      this.note.textContent = 'One free spin every day.';
      return;
    }
    const left = p.bonusSpinsLeft;
    if (left > 0) {
      if (this.platform?.canRequestRewardedAd || this.adBusy) {
        const ad = this.action('wheel-spin wheel-spin-ad', 'WATCH AD · SPIN', spinning, () => this.watchAd());
        ad.prepend(iconSpan('wheel-video'));
        this.actions.append(ad);
      }
      const coins = this.action('wheel-spin wheel-spin-coins', `${WHEEL.SPIN_PRICE} · SPIN`, spinning || p.coins < WHEEL.SPIN_PRICE, () => this.start('coins'));
      coins.prepend(coinIcon());
      this.actions.append(coins);
      this.note.textContent = `Bonus spins left today: ${left} · Free spin in ${formatCountdown(msUntilNextDay())}`;
      return;
    }
    this.actions.append(this.action('wheel-spin', `FREE SPIN IN ${formatCountdown(msUntilNextDay())}`, true, null));
    this.note.textContent = 'No spins left today. Come back tomorrow!';
  }

  action(className, label, disabled, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `store-action ${className}`;
    button.append(document.createTextNode(label));
    button.disabled = disabled;
    if (onClick) button.addEventListener('click', onClick);
    return button;
  }

  /** Bonus spin by rewarded ad: only an ad that finished pays the spin. */
  watchAd() {
    if (this.spin || this.adBusy) return;
    this.adBusy = true;
    this.renderActions();
    const asked = this.platform.requestRewardedAd((result) => {
      this.adBusy = false;
      if (result === 'finished') {
        this.start('ad');
      } else {
        this.result.textContent = 'No ad is available right now. Try again later, or spin with coins.';
        this.renderActions();
      }
    });
    if (!asked) {
      this.adBusy = false;
      this.renderActions();
    }
  }

  start(kind) {
    if (this.spin) return;
    this.audio.unlock();
    const segment = this.progress.startSpin(kind);
    if (segment === null) {
      this.renderActions();
      return;
    }
    this.audio.play('play');
    this.highlight = -1;
    this.result.textContent = '';
    // Land the chosen segment under the pointer (top), a little off its centre, after a few turns.
    const jitter = (Math.random() - 0.5) * SEG * 0.7;
    const target = -(segment * SEG + SEG / 2 + jitter);
    const base = this.rotation - (this.rotation % TAU);
    let to = base + 5 * TAU + mod(target, TAU);
    if (to - this.rotation < 4 * TAU) to += TAU;
    this.spin = { from: this.rotation, to, start: performance.now(), segment };
    this.renderActions();
  }

  /** The wheel stopped (or the sheet closed mid-spin): pay the prize. */
  settle() {
    const spinning = this.spin;
    if (spinning) {
      this.rotation = spinning.to % TAU;
      this.spin = null;
    }
    const prize = this.progress.finishSpin();
    if (!prize) return;
    const text = prize.jackpot ? `JACKPOT! +${prize.coins.toLocaleString()} coins` : `You won ${prizeName(prize)}!`;
    this.audio.play(prize.jackpot ? 'victory' : 'rankUp');
    if (this.isOpen) {
      this.highlight = spinning ? spinning.segment : -1;
      this.result.textContent = text;
      this.renderActions();
    } else {
      showMenuToast(`WHEEL · ${text}`);
    }
  }

  // ------------------------------------------------------------ drawing

  update(now) {
    const canvas = this.canvas;
    const size = Math.round(canvas.clientWidth);
    if (!size) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.size !== size) {
      this.size = size;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
    }
    if (this.spin) {
      const t = Math.min(1, (now - this.spin.start) / (SPIN_SECONDS * 1000));
      const eased = 1 - (1 - t) ** 4;
      this.rotation = this.spin.from + (this.spin.to - this.spin.from) * eased;
      // A tick each time a divider passes the pointer.
      const passed = Math.floor(this.rotation / SEG);
      if (passed !== this.lastTick) {
        this.lastTick = passed;
        this.audio.play('click');
      }
      if (t >= 1) this.settle();
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawWheel(ctx, size, this.rotation, {
      labels: true,
      bulbs: BULBS,
      time: now / 1000,
      spinning: Boolean(this.spin),
      highlight: this.highlight,
    });
  }
}

function mod(a, n) {
  return ((a % n) + n) % n;
}

function iconSpan(className) {
  const span = document.createElement('span');
  span.className = className;
  span.setAttribute('aria-hidden', 'true');
  return span;
}

function timeAgo(at) {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const glyphPaths = {};
function glyph(id) {
  if (!glyphPaths[id] && GLYPHS[id]) glyphPaths[id] = new Path2D(GLYPHS[id]);
  return glyphPaths[id];
}

/**
 * The wheel: a red rim with light bulbs, segments (0 rad = pointer at the top, clockwise),
 * labels (coin + amount, or a power-up orb + name) and a gold hub.
 */
function drawWheel(ctx, size, rotation, { labels, bulbs, time, spinning = false, highlight = -1 }) {
  const c = size / 2;
  const rimOuter = c * 0.98;
  const rimInner = c * 0.86;
  const r = rimInner - c * 0.015;

  // Rim
  const rim = ctx.createRadialGradient(c, c, rimInner, c, c, rimOuter);
  rim.addColorStop(0, '#b5123a');
  rim.addColorStop(0.5, '#ef2d56');
  rim.addColorStop(1, '#9c0f31');
  ctx.beginPath();
  ctx.arc(c, c, rimOuter, 0, TAU);
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, size * 0.008);
  ctx.strokeStyle = '#ffd34d';
  ctx.stroke();

  // Segments
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(rotation);
  WHEEL.SEGMENTS.forEach((s, i) => {
    const a0 = -Math.PI / 2 + i * SEG;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a0, a0 + SEG);
    ctx.closePath();
    ctx.fillStyle = s.fill;
    ctx.fill();
    if (i === highlight) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.2 * Math.sin(time * 8)})`;
      ctx.fill();
    }
  });
  // Gold dividers
  ctx.strokeStyle = '#f2bd3a';
  ctx.lineWidth = Math.max(1.5, size * 0.012);
  for (let i = 0; i < WHEEL.SEGMENTS.length; i++) {
    const a = -Math.PI / 2 + i * SEG;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  // Inner shading for depth
  const shade = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(0.85, 'rgba(0, 0, 0, 0.04)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = shade;
  ctx.fill();

  if (labels) {
    const sheet = coinSheet();
    WHEEL.SEGMENTS.forEach((s, i) => {
      ctx.save();
      ctx.rotate(i * SEG + SEG / 2); // label axis points from the centre to the rim
      const text = s.coins ? s.coins.toLocaleString() : (powerUpItem(s.powerUp)?.name ?? '').toUpperCase();
      const fontPx = Math.max(10, size * (s.coins ? (s.coins >= 100 ? 0.066 : 0.074) : 0.05));
      ctx.font = `900 ${fontPx}px system-ui, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      // Amount near the rim; turned the right way up on the lower half of the wheel.
      ctx.save();
      ctx.translate(0, -r * 0.74);
      if (Math.cos(rotation + i * SEG + SEG / 2) < 0) ctx.rotate(Math.PI);
      ctx.lineWidth = fontPx * 0.18;
      ctx.strokeStyle = s.ink === '#ffffff' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.6)';
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = s.ink;
      ctx.fillText(text, 0, 0);
      ctx.restore();
      // Icon below the amount.
      const iconR = size * 0.05;
      ctx.translate(0, -r * 0.5);
      if (s.coins) {
        const d = (COIN_FRAME_PX * iconR) / COIN_SPRITE_RADIUS;
        ctx.drawImage(sheet, 0, 0, COIN_FRAME_PX, COIN_FRAME_PX, -d / 2, -d / 2, d, d);
      } else {
        const hue = powerUpItem(s.powerUp)?.hue ?? 200;
        const orb = ctx.createRadialGradient(-iconR * 0.3, -iconR * 0.35, iconR * 0.1, 0, 0, iconR);
        orb.addColorStop(0, '#ffffff');
        orb.addColorStop(0.3, `hsl(${hue}, 90%, 60%)`);
        orb.addColorStop(1, `hsl(${hue}, 70%, 30%)`);
        ctx.beginPath();
        ctx.arc(0, 0, iconR, 0, TAU);
        ctx.fillStyle = orb;
        ctx.fill();
        const path = glyph(s.powerUp);
        if (path) {
          const k = (iconR * 1.25) / 24;
          ctx.save();
          ctx.rotate(-(rotation + i * SEG + SEG / 2)); // glyph stays upright
          ctx.scale(k, k);
          ctx.translate(-12, -12);
          ctx.fillStyle = '#ffffff';
          ctx.fill(path, 'evenodd');
          ctx.restore();
        }
      }
      ctx.restore();
    });
  }
  ctx.restore();

  // Light bulbs on the rim: chase while spinning, slow twinkle otherwise.
  const bulbR = Math.max(2, size * 0.018);
  for (let i = 0; i < bulbs; i++) {
    const a = (i / bulbs) * TAU;
    const x = c + Math.cos(a) * (rimInner + rimOuter) / 2;
    const y = c + Math.sin(a) * (rimInner + rimOuter) / 2;
    const on = spinning ? (Math.floor(time * 12) + i) % 3 === 0 : (Math.floor(time * 1.5) + i) % 2 === 0;
    const g = ctx.createRadialGradient(x - bulbR * 0.3, y - bulbR * 0.3, 0, x, y, bulbR);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, on ? '#fff3a8' : '#f4d9ff');
    g.addColorStop(1, on ? '#f2bd3a' : '#b98bd6');
    ctx.beginPath();
    ctx.arc(x, y, bulbR, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // Hub
  const hubR = size * 0.075;
  const hub = ctx.createRadialGradient(c - hubR * 0.3, c - hubR * 0.4, hubR * 0.1, c, c, hubR);
  hub.addColorStop(0, '#fff6c9');
  hub.addColorStop(0.45, '#ffb72e');
  hub.addColorStop(1, '#c46a00');
  ctx.beginPath();
  ctx.arc(c, c, hubR, 0, TAU);
  ctx.fillStyle = hub;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c, c, hubR * 0.45, 0, TAU);
  ctx.fillStyle = '#e8213f';
  ctx.fill();
}
