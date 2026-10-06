import { PLAYER } from '../config.js';

/**
 * Player names: a generated default ("Player 284") or the player's own, validated.
 * Names are only ever rendered with textContent / fillText, never as HTML.
 */

function readSaved() {
  try {
    return window.localStorage.getItem(PLAYER.NAME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** A "Player NNN" name not already used in `taken` (case-insensitive). */
export function generatePlayerName(taken = new Set()) {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  const { NAME_NUMBER_MIN: min, NAME_NUMBER_MAX: max } = PLAYER;
  for (let attempt = 0; attempt < 50; attempt++) {
    const name = `${PLAYER.NAME_PREFIX} ${min + Math.floor(Math.random() * (max - min + 1))}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  return `${PLAYER.NAME_PREFIX} ${Date.now() % 100000}`;
}

/**
 * Cleans a typed name: strips control characters and angle brackets, collapses whitespace,
 * trims, and limits the length. Keeps the player's capitalisation. Returns '' if nothing's left.
 */
export function sanitizePlayerName(raw) {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PLAYER.NAME_MAX_LENGTH)
    .trim();
}

/** The name to prefill: the last name this player chose, or a fresh generated one. */
export function initialPlayerName() {
  const saved = sanitizePlayerName(readSaved());
  return saved || generatePlayerName();
}

/** Remember a name the player typed themselves (generated defaults aren't saved). */
export function rememberPlayerName(name) {
  try {
    window.localStorage.setItem(PLAYER.NAME_STORAGE_KEY, name);
  } catch {
    // Storage unavailable: the name lasts for this page only.
  }
}

export function forgetPlayerName() {
  try {
    window.localStorage.removeItem(PLAYER.NAME_STORAGE_KEY);
  } catch {
    // ignore
  }
}
