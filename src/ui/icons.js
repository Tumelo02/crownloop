import { POWER_UP_ITEMS } from '../progression/storeCatalog.js';
import { paintCoinIcon } from '../render/coinSprite.js';

/**
 * Small reusable icons for menus: the gold coin, power-up orbs (each with its own glyph:
 * bolt, magnet, crosshair, magnifier, radar) and mission icons. Glyphs are SVG paths on a
 * 24x24 box: CSS shows them as masks, the wheel draws them with Path2D.
 */
export const GLYPHS = Object.freeze({
  // Power-ups
  surge: 'M13.5 1.5 4 13.5h6.2L9 22.5l10-12.6h-6.3z',
  magnet: 'M4 3h5v8.2a3 3 0 0 0 6 0V3h5v8.4a8 8 0 0 1-16 0zM4 4.6v2.6h5V4.6zm11 0v2.6h5V4.6z',
  tracker: 'M11 1h2v4.1A7 7 0 0 1 18.9 11H23v2h-4.1A7 7 0 0 1 13 18.9V23h-2v-4.1A7 7 0 0 1 5.1 13H1v-2h4.1A7 7 0 0 1 11 5.1zm1 6.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2zm0 2.6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  zoom: 'M10 2.5a7.5 7.5 0 0 1 6.1 11.9l5.5 5.5-1.8 1.8-5.5-5.5A7.5 7.5 0 1 1 10 2.5zm0 2.6a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8zM9 7h2v2h2v2h-2v2H9v-2H7V9h2z',
  vision: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2.4a7.6 7.6 0 1 0 7.6 7.6H12zm0 4.4a3.2 3.2 0 1 0 3.2 3.2H12z',
  // Missions (by the event they count)
  claim: 'M5 2h2.2v20H5zM8.4 3H20l-3.2 4.4L20 11.8H8.4z',
  kills: 'M12 2.5C7 2.5 3.5 5.9 3.5 10.5c0 2.6 1.1 4.5 2.9 5.7v2.8c0 .8.7 1.5 1.5 1.5H9v-2h1.6v2h2.8v-2H15v2h1.1c.8 0 1.5-.7 1.5-1.5v-2.8c1.8-1.2 2.9-3.1 2.9-5.7 0-4.6-3.5-8-8.5-8zM8.7 9.2a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4zM15.3 9.2a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4zM12 13.8l-1.2 2.1h2.4z', // skull: the kill icon everywhere
  king: 'M2.5 7.5 7.5 11 12 4l4.5 7 5-3.5-1.5 10.5H4zM4 19.5h16V22H4z',
  energy: 'M12 1.5l2.8 7.7 7.7 2.8-7.7 2.8-2.8 7.7-2.8-7.7L1.5 12l7.7-2.8z',
  matches: 'M6 2h12v2.5h3.5V8a5 5 0 0 1-5.2 5A6 6 0 0 1 13.3 16v3h4v3H6.7v-3h4v-3A6 6 0 0 1 7.7 13 5 5 0 0 1 2.5 8V4.5H6zM5 7v1a2.5 2.5 0 0 0 1.4 2.2A9 9 0 0 1 6 7zm13 0a9 9 0 0 1-.4 3.2A2.5 2.5 0 0 0 19 8V7z',
  survive: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM10.8 6.5h2.4v5l3.6 2.2-1.2 2-4.8-2.9z',
  landmark: 'M8.5 2h7l1 3.5h-9zM8 7h8l2.2 13H5.8zM3 20.5h18V23H3z',
  powerup: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm1.3 3.5-6 8.2h4.2l-.8 4.8 6-8.2h-4.2z',
  streak: 'M8 2h3.2L6.4 22H3.2zm8 0h3.2l-4.8 20h-3.2z',
});

const glyphUrl = (id) => GLYPHS[id]
  ? `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill-rule='evenodd' d='${GLYPHS[id]}'/></svg>`)}")`
  : 'none';

export function powerUpItem(id) {
  return POWER_UP_ITEMS.find((item) => item.id === id) || null;
}

/** A power-up orb with its glyph. */
export function powerUpIcon(id, className = '') {
  const icon = document.createElement('span');
  icon.className = `pu-icon ${className}`.trim();
  icon.dataset.pu = id;
  const item = powerUpItem(id);
  if (item) icon.style.setProperty('--pu-hue', item.hue);
  icon.style.setProperty('--glyph', glyphUrl(id));
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

/** The gold coin (painted once on a small canvas). */
export function coinIcon(className = '', size = 32) {
  const coin = document.createElement('canvas');
  coin.className = `coin-icon ${className}`.trim();
  coin.setAttribute('aria-hidden', 'true');
  coin.dataset.fixed = '1';
  paintCoinIcon(coin, size);
  return coin;
}

/** A mission's icon (by the event it counts: claim, kills, king, ...). */
export function missionIcon(event) {
  const icon = document.createElement('span');
  icon.className = 'mission-icon';
  icon.dataset.icon = event;
  icon.style.setProperty('--glyph', glyphUrl(event));
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

/** Reward chips: [coin] +40   +25 XP   [orb] +1 Speed */
export function rewardChips({ coins = 0, xp = 0, powerUp = null } = {}) {
  const row = document.createElement('span');
  row.className = 'reward-chips';
  if (coins > 0) {
    const chip = document.createElement('span');
    chip.className = 'reward-chip reward-coins';
    chip.append(coinIcon(), document.createTextNode(`+${coins.toLocaleString()}`));
    row.appendChild(chip);
  }
  if (xp > 0) {
    const chip = document.createElement('span');
    chip.className = 'reward-chip reward-xp';
    chip.textContent = `+${xp} XP`;
    row.appendChild(chip);
  }
  const item = powerUp && powerUpItem(powerUp);
  if (item) {
    const chip = document.createElement('span');
    chip.className = 'reward-chip reward-powerup';
    chip.append(powerUpIcon(item.id), document.createTextNode(`+1 ${item.name}`));
    row.appendChild(chip);
  }
  return row;
}
