import { COINS } from '../config.js';

/**
 * Turns one run's gameplay into coins using the rates in config COINS.
 * Gameplay events award only cosmetic coins, banked immediately in PlayerProgress.
 */
export class CoinRewards {
  /**
   * @param {import('./PlayerProgress.js').PlayerProgress} progress
   * @param {(amount: number, reason: string) => void} onEarn presentation hook
   */
  constructor(progress, onEarn) {
    this.progress = progress;
    this.onEarn = onEarn;
    this.startRun();
  }

  startRun() {
    this.earned = 0;
    this.territoryProgress = 0;
    this.aliveProgress = 0;
  }

  /** New life: survival time counts per life, not across deaths. */
  startLife() {
    this.aliveProgress = 0;
  }

  grant(amount, reason) {
    const banked = this.progress.addCoins(amount);
    if (banked > 0) {
      this.earned += banked;
      this.onEarn(banked, reason);
    }
  }

  onTerritoryCapture(cells) {
    this.territoryProgress += cells;
    const coins = Math.floor(this.territoryProgress / COINS.TERRITORY_CELLS_PER_COIN);
    if (coins > 0) {
      this.territoryProgress -= coins * COINS.TERRITORY_CELLS_PER_COIN;
      this.grant(coins, 'territory');
    }
    if (cells >= 150) {
      const bigBonus = Math.min(3, Math.floor((cells - 150) / 200) + 1);
      this.grant(bigBonus, 'territory-bonus');
    }
  }

  /** A coin picked up in the world. */
  onPickup(value) {
    this.grant(value, 'pickup');
  }

  onElimination() {
    this.grant(COINS.ELIMINATION_REWARD, 'elimination');
  }

  tickAlive(dt) {
    this.aliveProgress += dt;
    if (this.aliveProgress >= COINS.SURVIVAL_INTERVAL) {
      this.aliveProgress -= COINS.SURVIVAL_INTERVAL;
      this.grant(COINS.SURVIVAL_REWARD, 'survival');
    }
  }

  /** @param {{isKing: boolean, rank: number}} result */
  endRound({ isKing, rank }) {
    const reward = isKing ? COINS.END_GAME_REWARD.KING
      : rank > 0 && rank <= 3 ? COINS.END_GAME_REWARD.TOP_3
        : COINS.END_GAME_REWARD.FINISHED;
    this.grant(reward, 'round');
    return reward;
  }
}
