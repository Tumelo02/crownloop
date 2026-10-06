import { MAX_CAREER_XP, rankForXP } from './ranks.js';

const MATCH_CAPS = Object.freeze({
  capture: 60,
  energy: 12,
  trailCut: 30,
  survival: 30,
  territoryHold: 25,
  kingTime: 20,
  completion: 15,
  victory: 35,
});

/** Match-scoped reward limits around persistent career XP. Rank never affects gameplay. */
export class ProgressionSystem {
  constructor(playerProgress) {
    this.playerProgress = playerProgress;
    this.resetMatch();
  }

  resetMatch() {
    this.matchEarned = 0;
    this.earnedBySource = Object.fromEntries(Object.keys(MATCH_CAPS).map((key) => [key, 0]));
    this.activeSeconds = 0;
    this.holdingSeconds = 0;
    this.kingSeconds = 0;
    this.rankUps = [];
  }

  get snapshot() {
    return rankForXP(this.playerProgress.experience);
  }

  award(source, requested) {
    const cap = MATCH_CAPS[source];
    if (!cap || requested <= 0) return { amount: 0, rankUp: null };
    const amount = Math.min(Math.max(0, Math.floor(requested)), cap - this.earnedBySource[source],
      MAX_CAREER_XP - this.playerProgress.experience);
    if (amount <= 0) return { amount: 0, rankUp: null };

    const previous = this.snapshot;
    this.earnedBySource[source] += amount;
    this.matchEarned += amount;
    this.playerProgress.addExperience(amount);
    const current = this.snapshot;
    const rankUp = current.index > previous.index
      ? { from: previous.rank.label, to: current.rank.label }
      : null;
    if (rankUp) this.rankUps.push(rankUp);
    return { amount, rankUp };
  }

  onTerritoryCaptured(cells) {
    if (cells < 10) return { amount: 0, rankUp: null };
    const hugeBonus = Math.max(0, Math.floor((cells - 150) / 80));
    const reward = Math.min(22, 2 + Math.floor(Math.sqrt(cells)) + hugeBonus);
    return this.award('capture', reward);
  }

  onEnergyCollected() {
    return this.award('energy', 1);
  }

  onTrailCut() {
    return this.award('trailCut', 8);
  }

  update(dt, { alive, moved, territoryCells, isKing }) {
    if (!alive || moved < 8) return [];
    const rankUps = [];
    this.activeSeconds += dt;
    this.holdingSeconds += territoryCells >= 30 ? dt : 0;
    this.kingSeconds += isKing ? dt : 0;

    while (this.activeSeconds >= 30) {
      this.activeSeconds -= 30;
      const result = this.award('survival', 2);
      if (result.rankUp) rankUps.push(result.rankUp);
    }
    while (this.holdingSeconds >= 30) {
      this.holdingSeconds -= 30;
      const result = this.award('territoryHold', 1);
      if (result.rankUp) rankUps.push(result.rankUp);
    }
    while (this.kingSeconds >= 30) {
      this.kingSeconds -= 30;
      const result = this.award('kingTime', 2);
      if (result.rankUp) rankUps.push(result.rankUp);
    }
    return rankUps;
  }

  onMatchComplete(won) {
    const rankUps = [];
    const completion = this.award('completion', 15);
    if (completion.rankUp) rankUps.push(completion.rankUp);
    if (won) {
      const victory = this.award('victory', 35);
      if (victory.rankUp) rankUps.push(victory.rankUp);
    }
    return rankUps;
  }
}
