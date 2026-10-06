/**
 * Store > Power-ups: consumable charges bought with coins (earned by playing; never real
 * money). Owned charges appear in the item bar during a match: click / tap / number key to
 * use one; same effect as picking it up in the arena (durations in config POWER_UPS / SURGE).
 */
export const POWER_UP_ITEMS = Object.freeze([
  Object.freeze({
    id: 'surge', name: 'Speed', price: 150, hue: 28,
    description: 'A burst of speed when you need to escape or chase.',
    effect: '×1.5 speed and acceleration for 4 s',
  }),
  Object.freeze({
    id: 'magnet', name: 'Magnet', price: 200, hue: 285,
    description: 'Energy flies to you while you claim land.',
    effect: 'Pulls nearby energy for 6 s',
  }),
  Object.freeze({
    id: 'tracker', name: 'Tracker', price: 300, hue: 352,
    description: 'Spot every rival with an open trail, the moment to strike.',
    effect: 'Marks exposed rivals on screen and minimap for 10 s',
  }),
  Object.freeze({
    id: 'zoom', name: 'Zoom', price: 220, hue: 50,
    description: 'Pull the camera back and see far more of the map.',
    effect: 'A much wider view for 10 s',
  }),
  Object.freeze({
    id: 'vision', name: 'Radar', price: 250, hue: 120,
    description: 'See every rival before you take a risk.',
    effect: 'Every rival on your minimap for 8 s',
  }),
]);

/**
 * Store > Coins: +250 coins for watching a rewarded ad. Limited per day with a short wait
 * between ads (CrazyGames: never offer rewarded ads too often, show a timer). Coins are also
 * earned by playing, missions and the daily wheel, so the ad is always optional.
 */
export const AD_COINS = Object.freeze({
  AMOUNT: 250,
  PER_DAY: 5,
  COOLDOWN_MS: 3 * 60 * 1000,
});
