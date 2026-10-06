/**
 * Daily missions, the login streak and the weekly crown season: everything that brings a
 * player back tomorrow and next week. Pure data + date helpers; PlayerProgress stores the
 * state and the Game reports events (missionEvent).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
// Weekly seasons end Monday 09:00 UTC, like CrazyGames' weekly leaderboard seasons.
const SEASON_EPOCH = Date.UTC(2024, 0, 1, 9, 0, 0); // a Monday, 09:00 UTC

/** Local calendar day number (changes at the player's local midnight). */
export function dayNumber(now = Date.now()) {
  return Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / DAY_MS);
}

/** Milliseconds until the player's next local midnight (new missions). */
export function msUntilNextDay(now = Date.now()) {
  const offset = new Date(now).getTimezoneOffset() * 60000;
  return DAY_MS - ((now - offset) % DAY_MS);
}

export function seasonNumber(now = Date.now()) {
  return Math.floor((now - SEASON_EPOCH) / WEEK_MS);
}

export function msUntilSeasonEnd(now = Date.now()) {
  return WEEK_MS - ((now - SEASON_EPOCH) % WEEK_MS);
}

export function formatCountdown(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${m % 60}m`;
}

/** Login streak reward: grows each consecutive day, capped at day 7. */
export function streakReward(day) {
  return 20 * Math.min(7, Math.max(1, day));
}

/** Login streak bonus power-up on days 3, 5 and 7+ (null on the other days). */
export function streakPowerUp(day) {
  if (day >= 7) return 'zoom';
  if (day === 5) return 'tracker';
  if (day === 3) return 'surge';
  return null;
}

/** Weekly season reward for the crowns you won last week (paid when the new week starts). */
export function seasonReward(crowns) {
  return Math.min(300, crowns * 30);
}

/**
 * Mission pool. `event` is what the game reports; goals are per day. Rewards scale with
 * difficulty; harder ones also pay a power-up charge (`powerUp`). Text uses {n} for the goal.
 */
export const MISSION_POOL = Object.freeze([
  { id: 'claim-s', event: 'claim', goal: 300, text: 'Claim {n} tiles of land', coins: 40, xp: 25 },
  { id: 'claim-l', event: 'claim', goal: 900, text: 'Claim {n} tiles of land', coins: 90, xp: 50 },
  { id: 'kills-s', event: 'kills', goal: 2, text: 'Take out {n} rivals', coins: 50, xp: 30 },
  { id: 'kills-l', event: 'kills', goal: 5, text: 'Take out {n} rivals', coins: 100, xp: 60, powerUp: 'tracker' },
  { id: 'king', event: 'king', goal: 1, text: 'Wear the crown', coins: 100, xp: 60, powerUp: 'zoom' },
  { id: 'energy', event: 'energy', goal: 120, text: 'Collect {n} energy', coins: 40, xp: 25 },
  { id: 'matches', event: 'matches', goal: 2, text: 'Finish {n} matches', coins: 60, xp: 35 },
  { id: 'survive', event: 'survive', goal: 6, text: 'Stay alive for {n} minutes in total', coins: 50, xp: 30 },
  { id: 'landmark', event: 'landmark', goal: 1, text: 'Capture a landmark', coins: 70, xp: 40, powerUp: 'magnet' },
  { id: 'powerup', event: 'powerup', goal: 3, text: 'Use {n} power-ups', coins: 40, xp: 25 },
  { id: 'streak', event: 'streak', goal: 1, text: 'Get a DOUBLE CUT (2 quick kills)', coins: 80, xp: 45, powerUp: 'surge' },
]);

/** Three different missions for a given day (same for that day on this device). */
export function missionsForDay(day) {
  let seed = (day * 2654435761) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const picks = [];
  const usedEvents = new Set();
  let guard = 0;
  while (picks.length < 3 && guard++ < 100) {
    const m = MISSION_POOL[Math.floor(rand() * MISSION_POOL.length)];
    if (usedEvents.has(m.event)) continue; // never two missions of the same kind
    usedEvents.add(m.event);
    picks.push({ id: m.id, progress: 0, claimed: false });
  }
  return picks;
}

export function missionDef(id) {
  return MISSION_POOL.find((m) => m.id === id) || null;
}

export function missionText(def) {
  return def.text.replace('{n}', def.goal.toLocaleString());
}
