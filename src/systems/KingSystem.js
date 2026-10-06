import { KING } from '../config.js';

/**
 * The King has the highest scored domain and at least the minimum displayed share of the
 * playable arena. The local player's score includes their neutral-funded display bonus.
 */
export class KingSystem {
  constructor() {
    this.king = null; // participant
  }

  reset() {
    this.king = null;
  }

  /**
   * @returns {{previous: object|null, next: object|null}|null} the change, if any
   */
  update(participants, territory, scoreCounts = null) {
    let best = null;
    let bestScore = 0;
    let secondCount = 0;
    // Everyone still in the match counts, including players waiting to respawn: their land
    // persists and remains part of the leaderboard's claimed-land total.
    for (const p of participants) {
      if (p.removed) continue;
      const actualCount = territory.countFor(p.slot);
      const score = scoreCounts
        ? scoreCounts[p.slot]
        : p.isLocal ? territory.displayPercentFor(p.slot) * territory.playableCount / 100 : actualCount;
      if (score > bestScore) {
        best = p;
        secondCount = bestScore;
        bestScore = score;
      } else if (score > secondCount) {
        secondCount = score;
      }
    }

    const current = this.king;
    const currentActualCount = current && !current.removed ? territory.countFor(current.slot) : -1;
    const currentScore = currentActualCount >= 0
      ? scoreCounts
        ? scoreCounts[current.slot]
        : current.isLocal
          ? territory.displayPercentFor(current.slot) * territory.playableCount / 100
          : currentActualCount
      : -1;
    const minimumArenaScore = territory.playableCount * KING.MINIMUM_ARENA_PERCENT / 100;
    let next = current;
    if (!best || bestScore < minimumArenaScore) next = null;
    else if (best !== current) {
      const currentQualified = currentScore >= minimumArenaScore;
      if (!currentQualified && bestScore > secondCount) {
        next = best;
      } else if (currentQualified
        && bestScore > currentScore * (1 + KING.TAKEOVER_MARGIN_RATIO) + KING.TAKEOVER_MARGIN_CELLS) {
        next = best;
      } else if (!currentQualified) {
        next = null;
      }
    }

    if (next === current) return null;
    this.king = next;
    return { previous: current, next };
  }
}
