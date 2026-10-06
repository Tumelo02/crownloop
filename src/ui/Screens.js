import { paintRankBadge } from '../render/rankBadge.js';
import { KING } from '../config.js';
import { formatPercent } from '../utils/math.js';

const $ = (id) => document.getElementById(id);
const setText = (element, value) => { element.textContent = value; };

/** Start, respawn, King-elimination and match-end overlays (plain DOM, no framework). */
export class Screens {
  constructor() {
    this.start = $('start-screen');
    this.respawn = $('respawn-screen');
    this.kingOut = $('king-screen');
    this.round = $('round-screen');
    this.playButton = $('play-button');
    this.againButton = $('again-button');
    this.kingButton = $('king-button');
    this.rejoinButton = $('rejoin-button');
    this.nameInput = $('player-name');
    this.respawnFields = {
      title: $('respawn-title'),
      reason: $('respawn-reason'),
      killer: $('respawn-killer'),
      context: $('respawn-context'),
      lost: $('respawn-lost'),
      territory: $('respawn-territory'),
      score: $('respawn-score'),
      xpEarned: $('respawn-xp-earned'),
      time: $('respawn-time'),
      peak: $('respawn-peak'),
      claimed: $('respawn-claimed'),
      kills: $('respawn-kills'),
      xpSurvival: $('respawn-xp-survival'),
      xpHold: $('respawn-xp-hold'),
      xpCapture: $('respawn-xp-capture'),
      xpCut: $('respawn-xp-cut'),
    };
    this.respawnSnapshot = $('respawn-snapshot');
    this.kingFields = {
      name: $('king-out-name'),
      world: $('king-out-world'),
      xpEarned: $('king-xp-earned'),
    };
    this.roundFields = {
      winner: $('round-winner'),
      winnerTerritory: $('round-winner-territory'),
      rank: $('round-rank'),
      territory: $('round-territory'),
      score: $('round-score'),
      coins: $('round-coins'),
      xpEarned: $('round-xp-earned'),
    };
    this.wallets = [...document.querySelectorAll('.wallet-coins')];
  }

  /** PLAY on the start screen. */
  onPlay(handler) {
    this.playButton.addEventListener('click', handler);
  }

  /** "ENTER NEW WORLD": after a match ends, or after the King closed this world to you. */
  onNewWorld(handler) {
    this.againButton.addEventListener('click', handler);
    this.kingButton.addEventListener('click', handler);
  }

  /** The home buttons on the screens shown after you die: back to the main menu. */
  onHome(handler) {
    for (const button of document.querySelectorAll('[data-home]')) button.addEventListener('click', handler);
  }

  onRejoin(handler) {
    this.rejoinButton.addEventListener('click', handler);
  }

  /** Pressing Enter in the name field plays, like the PLAY button. */
  onNameEnter(handler) {
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handler();
    });
  }

  get typedName() {
    return this.nameInput.value;
  }

  showStart(playerName, capacity, career) {
    this.nameInput.value = playerName;
    this.renderCareer($('start-career'), career);
    this.hideAll();
    this.start.classList.remove('hidden');
    this.playButton.focus();
  }

  /** @param {{killerName:string, territory:number, score:number, lostTerritory:boolean}} result */
  showRespawn(result, progression, career) {
    const f = this.respawnFields;
    const mutual = result.reason === 'collision-mutual';
    const contact = result.reason === 'collision';
    // Headline: what happened, then who. One plain line of context below it.
    f.title.textContent = result.selfTrailCut ? 'OWN TRAIL CUT'
      : result.reason === 'trail-cut' ? 'TRAIL CUT'
      : mutual ? 'HEAD-ON CRASH' : 'ELIMINATED';
    f.reason.textContent = result.selfTrailCut ? '' : mutual ? 'with' : 'by';
    f.killer.textContent = result.selfTrailCut ? 'Your own trail' : result.killerName;
    f.context.textContent = result.selfTrailCut ? 'You crossed the line you were drawing.'
      : mutual ? 'Both of you were outside your territories.'
      : contact ? 'You touched them outside your territory while they were inside theirs.'
      : 'They crossed your open trail.';
    f.lost.textContent = result.selfTrailCut ? 'Your territory went back to neutral.'
      : mutual ? 'Both territories went neutral.'
      : result.lostTerritory ? `${result.killerName} seized the nearest half of your territory.` : '';
    f.territory.textContent = formatPercent(result.territory);
    f.score.textContent = Math.floor(result.score).toLocaleString();
    const life = result.life;
    const xpText = (n) => `+${n} XP`;
    if (life) {
      const s = Math.max(0, Math.floor(life.seconds));
      f.time.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      f.peak.textContent = formatPercent(life.peak);
      f.claimed.textContent = life.claimed.toLocaleString();
      f.kills.textContent = String(life.kills);
      f.xpSurvival.textContent = xpText(life.xpSurvival);
      f.xpHold.textContent = xpText(life.xpHold);
      f.xpCapture.textContent = xpText(life.xpCapture);
      f.xpCut.textContent = xpText(life.xpCut);
      for (const el of [f.xpSurvival, f.xpHold, f.xpCapture, f.xpCut]) {
        el.classList.toggle('zero', el.textContent === '+0 XP');
      }
    }
    f.xpEarned.textContent = xpText(life ? life.xpTotal : progression.matchEarned);
    this.renderCareer($('respawn-career'), career, progression.rankUps);
    // "Almost there": the closest goal, so pressing REJOIN feels worth it.
    const almost = $('respawn-almost');
    if (almost) {
      const msg = almostThere(career, life, result);
      almost.textContent = msg || '';
      almost.classList.toggle('hidden', !msg);
    }
    this.respawn.classList.remove('hidden');
    this.rejoinButton.focus();
  }

  hideRespawn() {
    this.respawn.classList.add('hidden');
  }

  setRejoinPending(pending) {
    this.rejoinButton.disabled = pending;
    this.rejoinButton.textContent = pending ? 'AD BREAK…' : 'REJOIN';
    this.rejoinButton.setAttribute('aria-busy', String(pending));
  }

  /** @param {{kingName:string, worldId:string}} info */
  showKingElimination(info, progression, career) {
    this.kingFields.name.textContent = info.kingName;
    this.kingFields.world.textContent = info.worldId;
    this.kingFields.xpEarned.textContent = `+${progression.matchEarned} XP`;
    this.renderCareer($('king-career'), career, progression.rankUps);
    this.respawn.classList.add('hidden');
    this.kingOut.classList.remove('hidden');
    this.kingButton.focus();
  }

  /**
   * @param {{winnerName:string|null, winnerTerritory:number, playerWon:boolean,
   *   rank:number, territory:number, score:number, coinsEarned:number}} result
   */
  showRoundOver(result, progression, career) {
    const f = this.roundFields;
    f.winner.textContent = result.winnerName ? (result.playerWon ? `${result.winnerName} (YOU)` : result.winnerName) : 'No King';
    // Nobody crowned: no crown and no "KING" label above "No King".
    for (const el of this.round.querySelectorAll('.crown-hero, .round-label')) el.hidden = !result.winnerName;
    f.winnerTerritory.textContent = result.winnerName ? `${result.winnerTerritory.toFixed(1)}% TERRITORY` : 'Nobody held the crown';
    this.round.classList.toggle('won', Boolean(result.playerWon));
    f.rank.textContent = result.rank > 0 ? `#${result.rank}` : '—';
    f.territory.textContent = formatPercent(result.territory);
    f.score.textContent = Math.floor(result.score).toLocaleString();
    f.coins.textContent = `+${result.coinsEarned || 0}`;
    f.xpEarned.textContent = `+${progression.matchEarned} XP`;
    this.renderCareer($('round-career'), career, progression.rankUps);
    this.respawn.classList.add('hidden');
    this.kingOut.classList.add('hidden');
    this.round.classList.remove('hidden');
    this.againButton.focus();
  }

  renderCareer(container, career, rankUps = []) {
    if (!container || !career) return;
    // The badge sits beside the rank name and XP bar (created once per panel).
    let badge = container.querySelector('canvas[data-rank-badge]');
    if (!badge) {
      badge = document.createElement('canvas');
      badge.className = 'rank-badge';
      badge.setAttribute('data-rank-badge', '');
      badge.setAttribute('aria-hidden', 'true');
      container.prepend(badge);
    }
    if (badge.dataset.rankIndex !== String(career.index)) paintRankBadge(badge, career.index);
    // Optional: the next rank's badge at the far end of the bar ("where you're heading").
    const nextBadge = container.querySelector('canvas[data-rank-next-badge]');
    if (nextBadge) {
      nextBadge.hidden = !career.next;
      if (career.next && nextBadge.dataset.rankIndex !== String(career.index + 1)) {
        paintRankBadge(nextBadge, career.index + 1);
      }
    }
    const gainedNow = rankUps.length > 0;
    badge.classList.toggle('revealed', gainedNow);
    const label = container.querySelector('[data-rank-label]');
    const fill = container.querySelector('[data-rank-fill]');
    const bar = fill.parentElement;
    const xp = container.querySelector('[data-rank-xp]');
    const next = container.querySelector('[data-rank-next]');
    setText(label, career.rank.label);
    fill.style.width = `${Math.round(career.progress * 100)}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(career.progress * 100)));
    setText(xp, career.next
      ? `${career.currentXP.toLocaleString()} / ${career.requiredXP.toLocaleString()} XP`
      : `${career.totalXP.toLocaleString()} XP · MAX RANK`);
    setText(next, career.next ? `NEXT: ${career.next.label}` : 'MAX RANK');
    const rankUp = container.querySelector('[data-rank-up]');
    if (rankUp) {
      const gained = rankUps.length > 0;
      rankUp.classList.toggle('hidden', !gained);
      setText(rankUp, gained
        ? `RANK UP · ${rankUps[0].from} → ${rankUps[rankUps.length - 1].to}`
        : '');
    }
  }

  setWallet(coins) {
    const text = coins.toLocaleString();
    for (const el of this.wallets) el.textContent = text;
  }

  hideAll() {
    this.start.classList.add('hidden');
    this.respawn.classList.add('hidden');
    this.kingOut.classList.add('hidden');
    this.round.classList.add('hidden');
  }
}

/** The most motivating near-miss after a death: next rank, the crown, or revenge. */
function almostThere(career, life, result) {
  if (career && career.next) {
    const left = career.requiredXP - career.currentXP;
    if (left > 0 && left <= Math.max(30, career.requiredXP * 0.25)) {
      return `Only ${left.toLocaleString()} XP to ${career.next.label}!`;
    }
  }
  const peak = life ? life.peak : 0;
  const goal = KING.MINIMUM_ARENA_PERCENT;
  if (peak >= goal * 0.5 && peak < goal) {
    return `You were ${(goal - peak).toFixed(1)}% away from the crown!`;
  }
  if (result.revengeName) return `${result.revengeName} is marked on your minimap. Get revenge!`;
  return null;
}
