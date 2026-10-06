import { HUD as HUD_CONFIG, KING, MATCH } from '../config.js';
import { paintCoinIcon } from '../render/coinSprite.js';
import { drawCrownShape } from '../render/sprites.js';
import { paintRankBadge } from '../render/rankBadge.js';
import { formatClock, formatPercent } from '../utils/math.js';

const $ = (id) => document.getElementById(id);
const OCCLUDE_PAD = 12; // px around a panel that still counts as "under it"

/** Paints the gold Canvas crown into every `.crown-icon` canvas (HUD, leaderboard, screens). */
export function paintCrownIcons() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  for (const canvas of document.querySelectorAll('canvas.crown-icon')) {
    const size = canvas.clientWidth || 18;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCrownShape(ctx, size / 2, size / 2 + size * 0.04, size * 0.86);
  }
}

export function paintCoinIcons() {
  // Icons built by ui/icons.js are painted once at a fixed size (data-fixed).
  for (const canvas of document.querySelectorAll('canvas.coin-icon:not([data-fixed])')) paintCoinIcon(canvas);
}

/**
 * DOM HUD. Hierarchy: TERRITORY → SCORE; cosmetic coins and the leaderboard stay separate.
 * Text refreshes are throttled and only touch what changed.
 */
export class HUD {
  constructor() {
    this.root = $('hud');
    this.f = {
      score: $('hud-score'),
      killsWrap: $('hud-kills-wrap'),
      kills: $('hud-kills'),
      countdown: $('match-countdown'),
      countdownTime: $('match-countdown-time'),
      lbYou: $('lb-you'),
      lbCrown: $('lb-goal'),
      lbCrownLabel: $('lb-goal-label'),
      lbCrownValue: $('lb-goal-value'),
      lbCrownFill: $('lb-goal-fill'),
      lbYouRank: $('lb-you-rank'),
      lbYouName: $('lb-you-name'),
      lbYouTerr: $('lb-you-terr'),
      leaderboardCard: $('leaderboard-card'),
      leaderboardPanel: $('leaderboard-panel'),
      leaderboardTableBody: $('leaderboard-table-body'),
      safe: $('badge-safe'),
      abilityDock: $('ability-dock'),
      powerUps: $('powerups'),
      coins: $('hud-coins'),
      coinCount: $('hud-coin-count'),
      coinGain: $('hud-coin-gain'),
      energy: $('boost-meter'),
      energyFill: $('boost-meter-fill'),
    };
    const list = $('hud-leaderboard');
    // The leaderboard shows the top five plus a separate row for the local player if needed.
    this.rows = Array.from({ length: HUD_CONFIG.LEADERBOARD_SIZE }, () => {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'lb-rank';
      const crown = document.createElement('canvas');
      crown.className = 'crown-icon lb-crown';
      crown.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'lb-name';
      const terr = document.createElement('span');
      terr.className = 'lb-terr';
      li.append(rank, crown, name, terr);
      list.appendChild(li);
      return { li, rank, crown, name, terr };
    });
    paintCrownIcons();
    this.occluders = [...this.root.querySelectorAll('[data-occlude]')];
    this.occluderRects = [];
    this.rectTimer = 0;
    this.timer = 0;
    this.boostMeterFadeTime = 0;
    this.lastKingName = null;
    this.countdownShown = false;
    this.powerUpIndicators = new Map();
    this.bindLeaderboardPanel();
  }

  /**
   * RANK UP: a short badge reveal near the top of the screen (about 2 s, never blocks
   * input): the new badge pops in with a glow, with its name.
   */
  /** The player's current rank snapshot (ProgressionSystem.snapshot). */
  setCareer(career) {
    this.career = career;
  }

  showRankUp(career) {
    const toast = document.getElementById('rank-toast');
    if (!toast) return;
    const badge = toast.querySelector('canvas');
    paintRankBadge(badge, career.index);
    toast.querySelector('[data-rank-toast-label]').textContent = career.rank.label;
    toast.classList.remove('hidden', 'play');
    void toast.offsetWidth;
    toast.classList.add('play');
    clearTimeout(this.rankToastTimer);
    this.rankToastTimer = setTimeout(() => toast.classList.add('hidden'), 2300);
  }

  show() {
    this.root.classList.remove('hidden');
    this.f.abilityDock.classList.remove('hidden');
    this.timer = 0;
    this.rectTimer = 0;
    this.lastKingName = null;
    this.countdownShown = false;
    this.f.countdown.classList.add('hidden');
    this.boostMeterFadeTime = 0;
    this.f.energy.classList.remove('visible', 'boosting');
    this.f.energy.setAttribute('aria-hidden', 'true');
    paintCrownIcons();
    paintCoinIcons();
  }

  hide() {
    this.root.classList.add('hidden');
    this.f.abilityDock.classList.add('hidden');
    this.f.energy.classList.remove('visible', 'boosting');
    this.f.energy.setAttribute('aria-hidden', 'true');
  }

  /** Returns true when it's time to refresh, so callers only build data when needed. */
  tick(dt) {
    this.timer -= dt;
    if (this.timer > 0) return false;
    this.timer = HUD_CONFIG.UPDATE_INTERVAL;
    return true;
  }

  /**
   * Every frame: power-up timers, safe badge and the end-of-match countdown.
   * The countdown is hidden until MATCH.VISIBLE_COUNTDOWN seconds remain.
   * @returns {boolean} true on the frame the countdown first appears
   */
  renderLive({ dt = 0, timeLeft, safe, activePowerUps = [], energy = 0, maxEnergy = 1, boosting = false }) {
    if (this.f.safe) this.f.safe.classList.add('hidden'); // no safe-zone indicator
    this.renderPowerUps(activePowerUps);
    const ratio = Math.max(0, Math.min(1, energy / Math.max(1, maxEnergy)));
    this.f.energyFill.style.transform = `scaleX(${ratio})`;
    if (boosting) this.boostMeterFadeTime = 0.35;
    else this.boostMeterFadeTime = Math.max(0, this.boostMeterFadeTime - Math.max(0, dt));
    const boostMeterVisible = boosting || this.boostMeterFadeTime > 0;
    this.f.energy.classList.toggle('visible', boostMeterVisible);
    this.f.energy.classList.toggle('boosting', boosting);
    this.f.energy.setAttribute('aria-hidden', String(!boostMeterVisible));
    this.f.energy.setAttribute('aria-valuenow', String(Math.round(energy)));

    const visible = timeLeft <= MATCH.VISIBLE_COUNTDOWN;
    let appeared = false;
    if (visible !== this.countdownShown) {
      this.countdownShown = visible;
      this.f.countdown.classList.toggle('hidden', !visible);
      appeared = visible;
    }
    if (visible) {
      setText(this.f.countdownTime, formatClock(timeLeft).replace(/^0/, ''));
      this.f.countdown.classList.toggle('urgent', timeLeft <= MATCH.URGENT_COUNTDOWN);
      this.f.countdown.classList.toggle('final', timeLeft <= MATCH.FINAL_COUNTDOWN);
    }
    return appeared;
  }

  setCoins(total) {
    setText(this.f.coinCount, total.toLocaleString());
  }

  /** Subtle "+N" next to the counter; quick successive gains add up. */
  coinGained(amount) {
    const gain = this.f.coinGain;
    const now = performance.now();
    this.pendingGain = now - (this.lastGainAt || 0) < 1200 ? (this.pendingGain || 0) + amount : amount;
    this.lastGainAt = now;
    gain.textContent = `+${this.pendingGain}`;
    for (const el of [gain, this.f.coins]) {
      el.classList.remove('pop');
      void el.offsetWidth; // restart the CSS animation
      el.classList.add('pop');
    }
  }

  /**
   * Panels fade to see-through while the player is underneath them (e.g. pressed into a
   * corner of the world), so the HUD never hides your own creature.
   */
  updateOcclusion(dt, screenX, screenY, screenRadius) {
    this.rectTimer -= dt;
    if (this.rectTimer <= 0) {
      this.rectTimer = 1;
      this.occluderRects = this.occluders.map((el) => el.getBoundingClientRect());
    }
    for (let i = 0; i < this.occluders.length; i++) {
      const r = this.occluderRects[i];
      const pad = OCCLUDE_PAD + screenRadius;
      const under = r && r.width > 0 && screenX > r.left - pad && screenX < r.right + pad
        && screenY > r.top - pad && screenY < r.bottom + pad;
      this.occluders[i].classList.toggle('see-through', Boolean(under));
    }
  }

  renderPowerUps(activePowerUps) {
    const root = this.f.powerUps;
    const activeIds = new Set();
    root.classList.toggle('hidden', activePowerUps.length === 0);

    for (const powerUp of activePowerUps) {
      activeIds.add(powerUp.id);
      let elements = this.powerUpIndicators.get(powerUp.id);
      if (!elements) {
        const item = document.createElement('div');
        item.className = 'powerup-indicator';
        const ring = document.createElement('div');
        ring.className = 'powerup-ring';
        const shape = document.createElement('span');
        shape.className = `powerup-shape ${powerUp.id}`;
        ring.appendChild(shape);
        const label = document.createElement('div');
        label.className = 'powerup-label';
        const time = document.createElement('div');
        time.className = 'powerup-time';
        item.append(ring, label, time);
        elements = { item, ring, label, time };
        this.powerUpIndicators.set(powerUp.id, elements);
        root.appendChild(item);
      }
      const progress = powerUp.charges !== undefined
        ? 1
        : Math.max(0, Math.min(1, (powerUp.remainingTime ?? 0) / Math.max(1e-4, powerUp.duration ?? 1)));
      elements.ring.style.setProperty('--progress', `${progress * 100}`);
      elements.ring.style.setProperty('--ring-color', powerUp.color || 'hsl(28, 100%, 62%)');
      elements.label.textContent = powerUp.name || 'POWER';
      elements.time.textContent = powerUp.charges !== undefined
        ? `x${powerUp.charges}`
        : `${(powerUp.remainingTime ?? 0).toFixed(1)}s`;
    }

    for (const [id, elements] of this.powerUpIndicators) {
      if (activeIds.has(id)) continue;
      elements.item.remove();
      this.powerUpIndicators.delete(id);
    }
  }

  /**
   * @param {object} stats player: { territory, rank, score, alive, players }
   * @param {object|null} king { name, territory, isPlayer }
   * @param {object[]} ranking sorted by territory: { name, territory, isPlayer, isKing }
   * @param {{worldId:string, playerCount:number, capacity:number}} world
   */
  render(stats, king, ranking, world) {
    const f = this.f;
    setText(f.score, Math.floor(stats.score).toLocaleString());
    const kills = stats.kills || 0;
    if (f.killsWrap.hidden !== (kills === 0)) f.killsWrap.hidden = kills === 0;
    setText(f.kills, String(kills));
    this.renderLeaderboard(ranking, king ? king.name : null);
  }



  /**
   * The top five plus your own rank when you fall outside them. Use the shared displayed
   * percentage supplied by the territory system so every domain readout matches.
   */
  renderLeaderboard(ranking, kingName) {
    const localIndex = ranking.findIndex((entry) => entry.isPlayer);
    const localEntry = localIndex >= 0 ? ranking[localIndex] : null;
    const displayedPercent = (entry) => entry.displayTerritory;
    this.renderCrownProgress(localEntry ? displayedPercent(localEntry) : 0, kingName, Boolean(localEntry?.isKing));
    const topPercent = Math.max(0, ...ranking.map(displayedPercent));

    this.f.leaderboardTableBody.innerHTML = '';
    ranking.forEach((entry, index) => {
      const tr = document.createElement('tr');
      tr.classList.toggle('me', entry.isPlayer);
      tr.classList.toggle('king', Boolean(entry.isKing));
      // Names are typed by players: always text, never HTML.
      for (const text of [`#${index + 1}`, entry.name, formatPercent(displayedPercent(entry))]) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      }
      this.f.leaderboardTableBody.appendChild(tr);
    });

    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const entry = ranking[i];
      if (!entry) { row.li.hidden = true; continue; }
      row.li.hidden = false;
      row.li.classList.toggle('me', entry.isPlayer);
      row.li.classList.toggle('king', Boolean(entry.isKing));
      row.crown.classList.toggle('shown', Boolean(entry.isKing));
      setText(row.rank, `${i + 1}`);
      setText(row.name, entry.name);
      const percent = displayedPercent(entry);
      setText(row.terr, formatPercent(percent));
      const share = `${Math.round(Math.max(0.06, percent / (topPercent || 1)) * 100)}%`;
      if (row.share !== share) { row.share = share; row.li.style.setProperty('--share', share); }
      const rgb = entry.rgb ? entry.rgb.join(', ') : '120, 140, 170';
      if (row.rgb !== rgb) { row.rgb = rgb; row.li.style.setProperty('--lb-rgb', rgb); }
    }
    const localOutsideTopFive = localEntry && localIndex >= this.rows.length;
    this.f.lbYou.classList.toggle('hidden', !localOutsideTopFive);
    if (localOutsideTopFive) {
      setText(this.f.lbYouRank, `#${localIndex + 1}`);
      setText(this.f.lbYouName, localEntry.name);
      setText(this.f.lbYouTerr, formatPercent(displayedPercent(localEntry)));
    }

    if (kingName !== this.lastKingName) {
      const kingRow = this.rows.find((r) => r.li.classList.contains('king'));
      if (this.lastKingName !== null && kingRow) {
        kingRow.li.classList.remove('crown-changed');
        void kingRow.li.offsetWidth;
        kingRow.li.classList.add('crown-changed');
      }
      this.lastKingName = kingName;
    }
  }

  /**
   * Crown progress under the leaderboard: who wears it, and your share toward the minimum
   * (KING.MINIMUM_ARENA_PERCENT of the map, with the most territory). Hidden once you have
   * reached the minimum or wear the crown: the leaderboard's crown says the rest.
   */
  renderCrownProgress(percent, kingName, youAreKing) {
    const f = this.f;
    if (!f.lbCrown) return;
    const goal = KING.MINIMUM_ARENA_PERCENT;
    const reached = youAreKing || percent >= goal;
    if (f.lbCrown.hidden !== reached) f.lbCrown.hidden = reached;
    if (reached) return;
    const fill = youAreKing ? 1 : Math.min(1, percent / goal);
    f.lbCrown.classList.toggle('is-king', youAreKing);
    f.lbCrown.classList.toggle('ready', !youAreKing && percent >= goal);
    setText(f.lbCrownLabel, youAreKing ? 'YOU ARE KING' : kingName ? `KING: ${kingName}` : 'NO KING YET');
    setText(f.lbCrownValue, youAreKing ? formatPercent(percent) : `${formatPercent(percent)} / ${goal}%`);
    const width = `${(fill * 100).toFixed(1)}%`;
    if (f.lbCrownFill.style.width !== width) f.lbCrownFill.style.width = width;
  }

  bindLeaderboardPanel() {
    this.f.leaderboardCard.addEventListener('click', () => this.f.leaderboardPanel.classList.toggle('hidden'));
    this.f.leaderboardPanel.querySelector('#leaderboard-panel-close').addEventListener('click', () => this.f.leaderboardPanel.classList.add('hidden'));
    this.f.leaderboardCard.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.f.leaderboardPanel.classList.toggle('hidden');
      }
    });
  }
}

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}
