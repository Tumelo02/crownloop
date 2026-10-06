/**
 * Store copy per character: a short description plus its element's edge and trade-off.
 * The numbers mirror progression/elementProfiles.js (the only place elements change
 * gameplay); keep the two in step when rebalancing.
 */
export const STORE_INFO = Object.freeze({
  core: {
    description: 'The original spark of the planet: a steady pulse of living energy.',
    edge: '+8% energy from every pickup',
    tradeoff: 'None: a balanced all-rounder',
  },
  ember: {
    description: 'A living flame that thrives on the first burst of speed.',
    edge: 'Boost kick: extra speed in the first 0.4 s of every boost',
    tradeoff: 'Boosting burns energy 12% faster',
  },
  glacier: {
    description: 'Cut from alien ice, precise even at full speed.',
    edge: 'Keeps full steering while boosting (+33% turning)',
    tradeoff: '4% slower base speed',
  },
  void: {
    description: 'A tear in space that is easy to overlook.',
    edge: 'Rivals notice you 20% later (never invisible)',
    tradeoff: '5% less energy per pickup',
  },
  tidal: {
    description: 'Rolling alien water that gathers everything it touches.',
    edge: '+12% energy from every pickup',
    tradeoff: 'Energy collected when full scores 30% less',
  },
  sol: {
    description: 'A small star that burns hot and moves fast.',
    edge: '3% faster at all times',
    tradeoff: 'Rivals notice you 15% sooner',
  },
  terra: {
    description: 'Living rock: steady, stubborn and hard to move.',
    edge: 'Boosts last 11% longer; hard to shove in body contact',
    tradeoff: 'Turns 10% slower',
  },
  gale: {
    description: 'A knot of alien wind that never stops turning.',
    edge: 'Turns 15% quicker',
    tradeoff: '4% slower base speed',
  },
  verdant: {
    description: 'Alien growth that spreads wherever it settles.',
    edge: '+10% energy from every pickup and turns 6% quicker',
    tradeoff: 'Energy collected when full scores 20% less',
  },
});
