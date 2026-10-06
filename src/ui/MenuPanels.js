import { TIER_STYLE, paintRankBadge } from '../render/rankBadge.js';
import { RANKS, rankForXP } from '../progression/ranks.js';
import {
  formatCountdown, missionDef, missionText, msUntilNextDay, msUntilSeasonEnd, streakPowerUp, streakReward,
} from '../progression/Missions.js';
import { coinIcon, missionIcon, powerUpIcon, powerUpItem, rewardChips } from './icons.js';

/**
 * Menu screens opened from the top-left of the start screen:
 *   LEADERBOARD (podium icon)  LOCAL (your country) / WORLDWIDE tabs
 *   MY STATS                   your lifetime numbers
 * Both are modal sheets in the store's style; only their X closes them.
 */

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const fmt = (n) => Math.floor(n).toLocaleString();
const pct = (n) => `${n < 10 ? n.toFixed(1) : Math.round(n)}%`;

function formatDuration(seconds) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

function countryName(code) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([navigator.language || 'en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

/** One menu sheet: opens from its button, closes only with its X; opening one closes the others. */
export class MenuSheet {
  static all = [];

  constructor(audio, buttonId, modalId, closeId) {
    this.audio = audio;
    this.button = $(buttonId);
    this.modal = $(modalId);
    this.closeButton = $(closeId);
    if (!this.button || !this.modal) return;
    MenuSheet.all.push(this);
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle(true);
    });
    // Closes only with its X: clicking outside the sheet never closes it.
    this.closeButton.addEventListener('click', () => this.toggle(false));
  }

  get isOpen() {
    return Boolean(this.modal) && !this.modal.classList.contains('hidden');
  }

  toggle(open) {
    if (!this.modal || open === this.isOpen) return;
    this.audio.unlock();
    this.audio.play('click');
    if (open) {
      for (const other of MenuSheet.all) if (other !== this) other.toggle(false);
      this.onOpen();
    }
    this.modal.classList.toggle('hidden', !open);
    this.button.setAttribute('aria-expanded', String(open));
    if (open) this.closeButton.focus();
  }

  onOpen() {}
}

/**
 * MY STATS, two tabs:
 *   BADGES  your current badge + XP to the next, then the whole rank road: 6 themed tiers x
 *           5 divisions. Earned badges in full colour with a check, the current one glowing
 *           ("YOU ARE HERE"), future ones dimmed with a lock and the XP they need.
 *   STATS   lifetime numbers, grouped (combat / territory / matches).
 */
export class StatsPanel extends MenuSheet {
  /**
   * @param {object} audio
   * @param {import('../progression/PlayerProgress.js').PlayerProgress} progress
   * @param {() => object} getCareer current rank snapshot
   * @param {() => string} getName current player name
   */
  constructor(audio, progress, getCareer, getName) {
    super(audio, 'stats-button', 'stats-modal', 'stats-close');
    this.progress = progress;
    this.getCareer = getCareer;
    this.getName = getName;
    this.tab = 'numbers'; // STATS first, BADGES second
    this.tabs = this.modal ? [...this.modal.querySelectorAll('[data-stats-tab]')] : [];
    for (const tab of this.tabs) {
      tab.addEventListener('click', () => {
        this.audio.play('click');
        this.show(tab.dataset.statsTab);
      });
    }
    this.buildRoad();
  }

  show(id) {
    this.tab = id;
    for (const tab of this.tabs) {
      const on = tab.dataset.statsTab === id;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
    }
    for (const section of this.modal.querySelectorAll('[data-stats-section]')) {
      section.hidden = section.dataset.statsSection !== id;
    }
    if (id === 'badges') this.paintRoad();
  }

  /** One themed card per tier, five badge slots each (built once). */
  buildRoad() {
    const road = $('badge-road');
    if (!road) return;
    this.slots = [];
    for (let tier = 0; tier < TIER_STYLE.length; tier++) {
      const st = TIER_STYLE[tier];
      const card = el('div', 'tier-card');
      card.style.setProperty('--tier-light', st.light);
      card.style.setProperty('--tier-mid', st.mid);
      card.style.setProperty('--tier-dark', st.dark);
      card.style.setProperty('--tier-glow', st.glow);
      const head = el('div', 'tier-head');
      const name = el('strong', 'tier-name', st.name);
      const state = el('span', 'tier-state');
      head.append(name, state);
      const row = el('div', 'tier-badges');
      for (let division = 0; division < 5; division++) {
        const index = tier * 5 + division;
        const rank = RANKS[index];
        const slot = el('div', 'badge-slot');
        const canvas = el('canvas', 'badge-slot-art');
        canvas.setAttribute('aria-hidden', 'true');
        const label = el('span', 'badge-slot-label', rank.division);
        const need = el('span', 'badge-slot-need');
        const mark = el('span', 'badge-slot-mark');
        mark.setAttribute('aria-hidden', 'true');
        slot.append(mark, canvas, label, need);
        slot.title = `${rank.label}: ${rank.minimumXP.toLocaleString()} XP`;
        row.appendChild(slot);
        this.slots.push({ index, rank, slot, canvas, need, mark, painted: false });
      }
      card.append(head, row);
      road.appendChild(card);
      card.dataset.tier = String(tier);
      card.stateEl = state;
    }
  }

  /** Badge canvases are painted once they are laid out (a hidden canvas has no size). */
  paintRoad() {
    requestAnimationFrame(() => {
      for (const s of this.slots || []) {
        if (s.painted || s.canvas.clientWidth === 0) continue;
        paintRankBadge(s.canvas, s.index);
        s.painted = true;
      }
    });
  }

  onOpen() {
    const career = this.getCareer();
    setText('stats-name', this.getName());
    setText('stats-rank', career.rank.label);
    setText('stats-xp', career.next
      ? `${fmt(career.currentXP)} / ${fmt(career.requiredXP)} XP to ${career.next.label}`
      : 'MAX RANK REACHED');
    const fill = $('stats-progress-fill');
    if (fill) fill.style.width = `${Math.round(career.progress * 100)}%`;
    const badge = $('stats-badge');
    if (badge) requestAnimationFrame(() => paintRankBadge(badge, career.index));

    // Rank road state.
    const xp = career.totalXP;
    for (const s of this.slots || []) {
      const earned = s.index < career.index;
      const current = s.index === career.index;
      s.slot.classList.toggle('earned', earned);
      s.slot.classList.toggle('current', current);
      s.slot.classList.toggle('locked', !earned && !current);
      s.mark.textContent = earned ? '✓' : current ? 'YOU ARE HERE' : '🔒';
      s.need.textContent = earned || current ? '' : `${fmt(Math.max(0, s.rank.minimumXP - xp))} XP to go`;
    }
    for (const card of document.querySelectorAll('#badge-road .tier-card')) {
      const tier = Number(card.dataset.tier);
      const first = tier * 5;
      const last = first + 4;
      const done = career.index > last || (career.index === last && !career.next);
      const inTier = career.index >= first && career.index <= last;
      card.classList.toggle('done', done);
      card.classList.toggle('here', inTier && !done);
      card.classList.toggle('ahead', career.index < first);
      card.stateEl.textContent = done ? 'COMPLETE' : inTier ? 'IN PROGRESS' : `UNLOCKS AT ${fmt(RANKS[first].minimumXP)} XP`;
    }

    this.renderNumbers();
    this.show(this.tab);
  }

  renderNumbers() {
    const s = this.progress.stats;
    const kd = s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(0);
    const groups = [
      ['COMBAT', [['Kills', fmt(s.kills)], ['Deaths', fmt(s.deaths)], ['K / D', kd], ['Most kills in a life', fmt(s.bestKills)]]],
      ['TERRITORY', [['Land claimed', `${fmt(s.landClaimed)} tiles`], ['Best territory', pct(s.bestTerritory)], ['Crowns taken', fmt(s.crowns)]]],
      ['MATCHES', [['Matches played', fmt(s.matches)], ['Won as King', fmt(s.wins)], ['Best score', fmt(s.bestScore)], ['Time played', formatDuration(s.timePlayed)]]],
    ];
    const root = $('stats-groups');
    if (!root) return;
    root.textContent = '';
    for (const [title, rows] of groups) {
      const group = el('div', 'stats-group');
      group.appendChild(el('h3', 'stats-group-title', title));
      const list = el('dl', 'stats-list');
      for (const [label, value] of rows) {
        const row = el('div', 'stats-row');
        row.append(el('dt', '', label), el('dd', '', value));
        list.appendChild(row);
      }
      group.appendChild(list);
      root.appendChild(group);
    }
  }
}

/**
 * LEADERBOARD. Main headings = what you compete on:
 *   CROWNS (matches won as King) | TERRITORY (land claimed) | KILLS | SCORE (best match)
 * Region on the left: LOCAL (your country) | WORLDWIDE. Period: WEEKLY (this season, resets
 * Monday 09:00 UTC) | ALL-TIME. Each row: rank, country flag, name, the character they play,
 * their rank badge and the value.
 * Entries come from `source`, an async (category, scope, countryCode, period) -> [{ name,
 * country, character (skin id), rank (badge index), value }] from the multiplayer back-end. Until it is plugged in
 * (the CrazyGames SDK can only SUBMIT scores), the list shows your own entry and says that
 * rankings fill in as players join. No invented players are ever shown.
 */
const CATEGORIES = Object.freeze({
  crowns: { title: 'CROWNS', explain: 'Matches won as King. The crown is the top prize.', stat: 'wins' },
  territory: { title: 'TERRITORY', explain: 'Total land claimed, in tiles.', stat: 'landClaimed' },
  kills: { title: 'KILLS', explain: 'Rivals taken out by cutting their trail or catching them.', stat: 'kills' },
  score: { title: 'SCORE', explain: 'Best score in a single match.', stat: 'bestScore' },
});

/** Country code -> flag emoji (rendered by the Twemoji flag font where the OS has none). */
export function flagOf(code) {
  if (!code || !/^[A-Z]{2}$/i.test(code)) return '';
  const base = 0x1f1e6;
  const up = code.toUpperCase();
  return String.fromCodePoint(base + up.charCodeAt(0) - 65, base + up.charCodeAt(1) - 65);
}

export class LeaderboardPanel extends MenuSheet {
  /**
   * @param {object} audio
   * @param {import('../progression/PlayerProgress.js').PlayerProgress} progress
   * @param {object} platform country + score submission
   * @param {() => string} getName
   * @param {(ctx: CanvasRenderingContext2D, skinId: string, size: number) => void} drawCharacter
   */
  constructor(audio, progress, platform, getName, drawCharacter = null) {
    super(audio, 'ranking-button', 'ranking-modal', 'ranking-close');
    this.progress = progress;
    this.platform = platform;
    this.getName = getName;
    this.drawCharacter = drawCharacter;
    this.source = null;
    this.scope = 'world';
    this.category = 'crowns';
    this.period = 'alltime';
    if (!this.modal) return;
    $('ranking-invite')?.addEventListener('click', () => this.onInvite?.());
    for (const button of this.modal.querySelectorAll('[data-ranking-period]')) {
      button.addEventListener('click', () => {
        this.period = button.dataset.rankingPeriod;
        this.audio.play('click');
        this.render();
      });
    }
    for (const tab of this.modal.querySelectorAll('[data-ranking-cat]')) {
      tab.addEventListener('click', () => {
        this.category = tab.dataset.rankingCat;
        this.audio.play('click');
        this.render();
      });
    }
    for (const button of this.modal.querySelectorAll('[data-ranking-scope]')) {
      button.addEventListener('click', () => {
        this.scope = button.dataset.rankingScope;
        this.audio.play('click');
        this.render();
      });
    }
  }

  /** Plug in the multiplayer data source: async (category, scope, countryCode) => entries. */
  setSource(source) {
    this.source = source;
  }

  onOpen() {
    this.render();
  }

  async render() {
    const { scope, category, period } = this;
    const cat = CATEGORIES[category];
    for (const button of this.modal.querySelectorAll('[data-ranking-period]')) {
      const on = button.dataset.rankingPeriod === period;
      button.classList.toggle('active', on);
      button.setAttribute('aria-selected', String(on));
    }
    for (const tab of this.modal.querySelectorAll('[data-ranking-cat]')) {
      const on = tab.dataset.rankingCat === category;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
    }
    for (const button of this.modal.querySelectorAll('[data-ranking-scope]')) {
      button.classList.toggle('active', button.dataset.rankingScope === scope);
    }
    const code = this.platform?.countryCode || null;
    const country = countryName(code);
    setText('ranking-local-flag', code ? `${flagOf(code)} ${code}` : '');
    setText('ranking-scope-title', scope === 'friends' ? 'You and your CrazyGames friends'
      : scope === 'local' ? (country ? `Top players in ${country}` : 'Top players in your region')
        : 'Top players worldwide');
    setText('ranking-explain', cat.explain);
    setText('ranking-season', period === 'weekly' ? seasonLine() : 'ALL-TIME · everything since your first match');
    this.progress.checkSeason();
    setText('ranking-value-head', cat.title);

    const list = $('ranking-list');
    list.textContent = '';
    let entries = [];
    const note = $('ranking-note');
    if (scope === 'friends') {
      this.renderYou(cat, period, code);
      await this.renderFriends(list, note);
      return;
    }
    if (this.source) {
      list.appendChild(el('li', 'ranking-loading', 'Loading…'));
      try {
        entries = (await this.source(category, scope, code, period)) || [];
      } catch (error) {
        console.error('Leaderboard source failed', error);
      }
      if (scope !== this.scope || category !== this.category || period !== this.period) return; // changed while loading
      list.textContent = '';
    }
    entries.slice(0, 50).forEach((entry, i) => list.appendChild(this.row(i + 1, entry)));
    this.renderYou(cat, period, code);
    note.hidden = entries.length > 0;
    note.textContent = 'Rankings fill in as players join Crownloop. Win crowns, claim land and take rivals out to climb.';
  }

  renderYou(cat, period, code) {
    const you = $('ranking-you');
    you.textContent = '';
    you.appendChild(this.row(null, {
      name: this.getName(),
      country: code,
      character: this.progress.selectedSkin,
      rank: rankForXP(this.progress.experience).index,
      value: (period === 'weekly' ? this.progress.season : this.progress.stats)[cat.stat] || 0,
      isYou: true,
    }));
  }

  /**
   * FRIENDS: the player's CrazyGames friends (name + avatar). Their scores need online play,
   * so until then the value column says so instead of inventing numbers.
   */
  async renderFriends(list, note) {
    note.hidden = false;
    const platform = this.platform;
    if (!platform?.onCrazyGames) {
      note.textContent = 'Friends come from your CrazyGames account. Play Crownloop on CrazyGames to see them here.';
      return;
    }
    const user = await platform.getUser();
    if (this.scope !== 'friends') return;
    if (!user) {
      note.textContent = 'Log in to CrazyGames to see your friends here, then invite them to play!';
      return;
    }
    list.appendChild(el('li', 'ranking-loading', 'Loading friends…'));
    const friends = (await platform.listFriends()) || [];
    if (this.scope !== 'friends') return;
    list.textContent = '';
    for (const friend of friends) {
      const li = el('li', 'ranking-row');
      const avatar = document.createElement('img');
      avatar.className = 'ranking-friend-avatar';
      avatar.alt = '';
      if (friend.avatar) avatar.src = friend.avatar;
      li.append(el('span', 'ranking-pos', '·'), avatar, el('span', 'ranking-name', friend.username), el('span', ''), el('span', 'ranking-score', '–'));
      list.appendChild(li);
    }
    note.textContent = friends.length
      ? "Your friends' scores appear here once online matches go live. Invite them to play!"
      : 'No CrazyGames friends yet. Tap INVITE FRIENDS to bring yours in!';
  }

  row(rank, entry) {
    const li = el('li', `ranking-row${entry.isYou ? ' you' : ''}${rank && rank <= 3 ? ` top${rank}` : ''}`);
    const flag = el('span', 'ranking-flag', flagOf(entry.country) || '·');
    flag.title = entry.country || '';
    const character = el('canvas', 'ranking-character');
    character.width = character.height = 64;
    if (this.drawCharacter && entry.character) {
      const ctx = character.getContext('2d');
      this.drawCharacter(ctx, entry.character, 64);
    }
    // Value with the player's rank badge in front of it (Beginner, Amateur, ...).
    const value = el('span', 'ranking-score');
    if (Number.isInteger(entry.rank) && RANKS[entry.rank]) {
      const badge = el('canvas', 'ranking-badge');
      badge.setAttribute('width', '26');
      badge.setAttribute('height', '26');
      badge.title = RANKS[entry.rank].label;
      value.appendChild(badge);
      requestAnimationFrame(() => paintRankBadge(badge, entry.rank));
    }
    value.appendChild(document.createTextNode(entry.value > 0 ? fmt(entry.value) : '0'));
    li.append(
      el('span', 'ranking-pos', rank ? `${rank}` : 'YOU'),
      flag,
      el('span', 'ranking-name', entry.name || 'Player'),
      character,
      value,
    );
    return li;
  }
}

function setText(id, text) {
  const node = $(id);
  if (node && node.textContent !== text) node.textContent = text;
}

/**
 * DAILY MISSIONS: today's three goals with progress bars and a CLAIM button each (coins + XP),
 * a countdown to tomorrow's set, and the login-streak reward road (day 1..7).
 */
export class MissionsPanel extends MenuSheet {
  constructor(audio, progress) {
    super(audio, 'missions-button', 'missions-modal', 'missions-close');
    this.progress = progress;
    this.badge = $('missions-badge');
    progress.onChange(() => {
      this.renderBadge();
      if (this.isOpen) this.render();
    });
    this.renderBadge();
  }

  onOpen() {
    this.progress.refreshMissions();
    this.render();
  }

  renderBadge() {
    if (!this.badge) return;
    this.progress.refreshMissions();
    const n = this.progress.claimableMissions;
    this.badge.textContent = String(n);
    this.badge.classList.toggle('hidden', n === 0);
  }

  render() {
    setText('missions-refresh', `New missions in ${formatCountdown(msUntilNextDay())}`);
    const streak = this.progress.daily.streak || 0;
    setText('streak-chip', streak > 0 ? `DAY ${streak} STREAK` : '');
    const list = $('missions-list');
    list.textContent = '';
    for (const m of this.progress.missions.list) {
      const def = missionDef(m.id);
      if (!def) continue;
      const done = m.progress >= def.goal;
      const li = el('li', `mission${done ? ' done' : ''}${m.claimed ? ' claimed' : ''}`);
      const text = el('div', 'mission-text');
      text.append(el('strong', '', missionText(def)), rewardChips(def));
      const bar = el('div', 'mission-bar');
      const fill = el('span', '');
      fill.style.width = `${Math.round((Math.min(m.progress, def.goal) / def.goal) * 100)}%`;
      bar.appendChild(fill);
      const count = el('span', 'mission-count', `${fmt(Math.min(m.progress, def.goal))} / ${fmt(def.goal)}`);
      const action = el('button', 'store-action mission-claim', m.claimed ? 'CLAIMED' : done ? 'CLAIM' : 'IN PROGRESS');
      action.type = 'button';
      action.disabled = m.claimed || !done;
      action.addEventListener('click', () => {
        const reward = this.progress.claimMission(m.id);
        if (reward) {
          this.audio.play('rankUp');
          const bonus = reward.powerUp ? ` · +1 ${powerUpItem(reward.powerUp)?.name}` : '';
          showMenuToast(`MISSION COMPLETE · +${reward.coins} coins · +${reward.xp} XP${bonus}`);
        }
      });
      li.append(missionIcon(def.event), text, bar, count, action);
      list.appendChild(li);
    }
    // Login streak road: day 1..7 (day 7+ keeps paying the top reward).
    const road = $('streak-road');
    road.textContent = '';
    road.appendChild(el('p', 'streak-title', 'DAILY REWARDS · come back every day for bigger rewards'));
    const row = el('div', 'streak-days');
    const shown = Math.min(Math.max(streak, 1), 7);
    for (let d = 1; d <= 7; d++) {
      const day = el('div', `streak-day${d < shown ? ' past' : d === shown ? ' today' : ''}`);
      const prize = el('span', 'streak-prize');
      prize.append(coinIcon('streak-coin'));
      const bonus = streakPowerUp(d);
      if (bonus) prize.append(powerUpIcon(bonus, 'streak-pu'));
      const item = bonus && powerUpItem(bonus);
      day.title = `Day ${d}: +${streakReward(d)} coins${item ? ` and +1 ${item.name}` : ''}`;
      day.append(el('span', 'streak-day-label', d === 7 ? 'DAY 7+' : `DAY ${d}`), prize, el('strong', '', `+${streakReward(d)}`));
      if (item) day.append(el('span', 'streak-bonus', `+${item.name}`));
      row.appendChild(day);
    }
    road.appendChild(row);
  }
}

let toastTimer = 0;
/** A short message on the menu (streak reward, season reward, mission complete). */
export function showMenuToast(text, ms = 3800) {
  const toast = $('menu-toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.remove('hidden', 'play');
  void toast.offsetWidth;
  toast.classList.add('play');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), ms);
}

/** Season countdown text for the leaderboard. */
export function seasonLine() {
  return `WEEKLY SEASON · resets in ${formatCountdown(msUntilSeasonEnd())} · last week's crowns pay a reward`;
}
