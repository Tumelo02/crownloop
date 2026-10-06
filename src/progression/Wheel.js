/**
 * Wheel of coins: one FREE spin every day (resets at local midnight, like missions), plus a
 * few optional bonus spins (watch an ad, or pay coins instead). Prizes are coins or a
 * power-up charge. PlayerProgress keeps the state; WheelPanel draws and spins it.
 */
export const WHEEL = Object.freeze({
  BONUS_SPINS_PER_DAY: 3, // ad or coin spins after the free one
  SPIN_PRICE: 150, // coins for a bonus spin (the alternative to watching an ad)
  HISTORY: 6, // your recent wins shown beside the wheel
  // Clockwise from the pointer. `weight` sets the odds (shown to the player as a %).
  SEGMENTS: Object.freeze([
    Object.freeze({ coins: 50, weight: 20, fill: '#1fb5c8', ink: '#ffffff' }),
    Object.freeze({ powerUp: 'surge', weight: 12, fill: '#ffffff', ink: '#c2410c' }),
    Object.freeze({ coins: 100, weight: 12, fill: '#3a8dff', ink: '#ffffff' }),
    Object.freeze({ coins: 25, weight: 24, fill: '#ffffff', ink: '#5b3b9a' }),
    Object.freeze({ coins: 250, weight: 6, fill: '#e8457a', ink: '#ffffff' }),
    Object.freeze({ powerUp: 'zoom', weight: 8, fill: '#ffffff', ink: '#a16207' }),
    Object.freeze({ coins: 75, weight: 16, fill: '#ff9a2e', ink: '#ffffff' }),
    Object.freeze({ coins: 500, weight: 2, fill: '#ffcf3a', ink: '#7a4d0e', jackpot: true }),
  ]),
});

const TOTAL_WEIGHT = WHEEL.SEGMENTS.reduce((sum, s) => sum + s.weight, 0);

/** A weighted random segment index. */
export function pickSegment(rand = Math.random) {
  let r = rand() * TOTAL_WEIGHT;
  for (let i = 0; i < WHEEL.SEGMENTS.length; i++) {
    r -= WHEEL.SEGMENTS[i].weight;
    if (r < 0) return i;
  }
  return WHEEL.SEGMENTS.length - 1;
}

/** Chance of a segment, in percent. */
export function segmentChance(index) {
  return (WHEEL.SEGMENTS[index].weight / TOTAL_WEIGHT) * 100;
}
