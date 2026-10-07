import { COINS, DEV_UNLOCK_ALL_CHARACTERS } from '../config.js';
import { DEFAULT_SKIN_ID, SKINS, STARTER_POOL, skinById } from './skins.js';
import { FLOORS, setFloor } from '../render/floorThemes.js';
import { AD_COINS, POWER_UP_ITEMS } from './storeCatalog.js';
import { MAX_CAREER_XP } from './ranks.js';
import {
  dayNumber, missionDef, missionsForDay, seasonNumber, seasonReward, streakPowerUp, streakReward,
} from './Missions.js';
import { WHEEL, pickSegment } from './Wheel.js';

const EMPTY_SEASON = Object.freeze({ wins: 0, kills: 0, landClaimed: 0, bestScore: 0 });

const VERSION = 1;

/** Lifetime stats shown in the menu's MY STATS screen. Counters add up; best* keep the max. */
export const EMPTY_STATS = Object.freeze({
  matches: 0, // matches played to the end
  wins: 0, // matches finished as King
  crowns: 0, // times you took the crown
  kills: 0,
  deaths: 0,
  landClaimed: 0, // tiles (40-unit cells) captured by closing loops
  timePlayed: 0, // seconds alive in matches
  bestScore: 0,
  bestTerritory: 0, // best territory % reached
  bestKills: 0, // most kills in one life
});

function readStored(storage) {
  try {
    const raw = storage.getItem(COINS.STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Persistent, account-free progression: sigils (coins), characters, floors, and power-up
 * charges bought in the store (consumables: one charge, set to fire at your next spawn). Lives outside any creature
 * or run, so dying or restarting never loses coins. Persistence uses the CrazyGames Data
 * module when available and browser-local storage elsewhere.
 */
export class PlayerProgress {
  constructor(storage = window.localStorage) {
    this.storage = storage;
    this.coins = COINS.STARTING_COINS;
    this.experience = 0;
    this.unlockedSkins = new Set();
    this.selectedSkin = DEFAULT_SKIN_ID;
    this.starterSkin = null; // the character this player was given on their first visit
    this.unlockedFloors = new Set(FLOORS.filter((f) => f.price === 0).map((f) => f.id));
    this.powerUps = {}; // type -> charges owned
    this.loadout = null; // power-up type that fires at the start of your next life
    this.stats = { ...EMPTY_STATS };
    // Come-back systems: login streak, this week's season counters, today's missions.
    this.daily = { lastDay: null, streak: 0 };
    this.season = { number: null, ...EMPTY_SEASON };
    this.missions = { day: null, list: [] };
    // Wheel of coins: today's free spin, bonus spins used, a prize still owed, recent wins.
    this.wheel = { day: null, freeUsed: false, bonusSpins: 0, pending: null, history: [] };
    // Store > Coins: rewarded ads watched today and when the last one paid.
    this.adCoins = { day: null, count: 0, lastAt: 0 };
    this.saveTimer = 0;
    this.listeners = [];
    this.writeTimer = 0;
    // Never lose a pending save: write it when the tab is hidden or closed.
    const flush = () => { if (this.writeTimer) this.flushSave(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    if (!this.load()) this.giveStarter();
  }

  /**
   * First visit: one random character from the starter pool (so players don't all look the
   * same) and one random galaxy, both theirs to keep.
   */
  giveStarter(rand = Math.random) {
    const skinId = STARTER_POOL[Math.floor(rand() * STARTER_POOL.length)] || DEFAULT_SKIN_ID;
    this.unlockedSkins.add(skinId);
    this.selectedSkin = skinId;
    this.starterSkin = skinId;
    const floor = FLOORS[Math.floor(rand() * FLOORS.length)] || FLOORS[0];
    this.unlockedFloors.add(floor.id);
    setFloor(floor.id);
    this.save();
  }

  load() {
    const data = readStored(this.storage);
    if (!data || data.version !== VERSION) return false;
    if (Number.isFinite(data.coins) && data.coins >= 0) this.coins = Math.floor(data.coins);
    if (Number.isFinite(data.experience) && data.experience >= 0) {
      this.experience = Math.min(MAX_CAREER_XP, Math.floor(data.experience));
    }
    if (Array.isArray(data.unlockedSkins)) {
      for (const id of data.unlockedSkins) {
        if (SKINS.some((skin) => skin.id === id)) this.unlockedSkins.add(id);
      }
    }
    // Saves from before random starters: everyone owned Core.
    if (this.unlockedSkins.size === 0) this.unlockedSkins.add(DEFAULT_SKIN_ID);
    if (SKINS.some((s) => s.id === data.starterSkin)) this.starterSkin = data.starterSkin;
    if (this.isUnlocked(data.selectedSkin)) this.selectedSkin = data.selectedSkin;
    else if (!this.isUnlocked(this.selectedSkin)) this.selectedSkin = [...this.unlockedSkins][0];
    if (Array.isArray(data.unlockedFloors)) {
      for (const id of data.unlockedFloors) if (FLOORS.some((f) => f.id === id)) this.unlockedFloors.add(id);
    }
    if (data.powerUps && typeof data.powerUps === 'object') {
      for (const item of POWER_UP_ITEMS) {
        const n = Math.floor(data.powerUps[item.id]);
        if (n > 0) this.powerUps[item.id] = n;
      }
    }
    if (this.powerUps[data.loadout] > 0) this.loadout = data.loadout;
    if (data.daily && Number.isFinite(data.daily.lastDay)) {
      this.daily = { lastDay: data.daily.lastDay, streak: Math.max(0, Math.floor(data.daily.streak) || 0) };
    }
    if (data.season && Number.isFinite(data.season.number)) {
      this.season = { number: data.season.number, ...EMPTY_SEASON };
      for (const key of Object.keys(EMPTY_SEASON)) {
        const value = Number(data.season[key]);
        if (Number.isFinite(value) && value >= 0) this.season[key] = value;
      }
    }
    if (data.missions && Number.isFinite(data.missions.day) && Array.isArray(data.missions.list)) {
      const list = data.missions.list
        .filter((m) => m && missionDef(m.id))
        .map((m) => ({ id: m.id, progress: Math.max(0, Number(m.progress) || 0), claimed: Boolean(m.claimed) }));
      if (list.length) this.missions = { day: data.missions.day, list };
    }
    if (data.wheel && typeof data.wheel === 'object') {
      const w = data.wheel;
      const valid = (i) => Number.isInteger(i) && i >= 0 && i < WHEEL.SEGMENTS.length;
      this.wheel = {
        day: Number.isFinite(w.day) ? w.day : null,
        freeUsed: Boolean(w.freeUsed),
        bonusSpins: Math.max(0, Math.floor(w.bonusSpins) || 0),
        pending: valid(w.pending) ? w.pending : null,
        history: Array.isArray(w.history)
          ? w.history.filter((h) => h && valid(h.segment)).slice(0, WHEEL.HISTORY).map((h) => ({ segment: h.segment, at: Number(h.at) || 0 }))
          : [],
      };
    }
    if (data.adCoins && Number.isFinite(data.adCoins.day)) {
      this.adCoins = {
        day: data.adCoins.day,
        count: Math.max(0, Math.floor(data.adCoins.count) || 0),
        lastAt: Number(data.adCoins.lastAt) || 0,
      };
    }
    if (data.stats && typeof data.stats === 'object') {
      for (const key of Object.keys(EMPTY_STATS)) {
        const value = Number(data.stats[key]);
        if (Number.isFinite(value) && value >= 0) this.stats[key] = value;
      }
    }
    return true;
  }

  save() {
    try {
      this.storage.setItem(COINS.STORAGE_KEY, JSON.stringify({
        version: VERSION,
        coins: this.coins,
        experience: this.experience,
        unlockedSkins: [...this.unlockedSkins],
        selectedSkin: this.selectedSkin,
        starterSkin: this.starterSkin,
        unlockedFloors: [...this.unlockedFloors],
        powerUps: this.powerUps,
        loadout: this.loadout,
        stats: this.stats,
        daily: this.daily,
        season: this.season,
        missions: this.missions,
        wheel: this.wheel,
        adCoins: this.adCoins,
      }));
    } catch (error) {
      console.error('Failed to save player progression.', error);
    }
  }

  onChange(listener) {
    this.listeners.push(listener);
  }

  /**
   * Something changed: menus update now; the save is batched (at most ~once a second, so a
   * shower of coins mid-match is one cloud save, not dozens), and flushed when the page hides.
   */
  changed() {
    if (!this.writeTimer) this.writeTimer = setTimeout(() => this.flushSave(), 1000);
    for (const listener of this.listeners) listener(this);
  }

  flushSave() {
    clearTimeout(this.writeTimer);
    this.writeTimer = 0;
    this.save();
  }

  addCoins(amount) {
    const whole = Math.floor(amount);
    if (whole <= 0) return 0;
    this.coins += whole;
    this.changed();
    return whole;
  }

  addExperience(amount) {
    const whole = Math.floor(amount);
    if (whole <= 0 || this.experience >= MAX_CAREER_XP) return 0;
    const added = Math.min(whole, MAX_CAREER_XP - this.experience);
    this.experience += added;
    this.changed();
    return added;
  }

  setExperience(amount) {
    const value = Number.isFinite(amount) ? Math.floor(amount) : 0;
    this.experience = Math.max(0, Math.min(MAX_CAREER_XP, value));
    this.changed();
  }

  isUnlocked(skinId) {
    return SKINS.some((skin) => skin.id === skinId)
      && (DEV_UNLOCK_ALL_CHARACTERS || this.unlockedSkins.has(skinId));
  }

  /** Spends coins on a skin. Returns false if unknown, already owned, or unaffordable. */
  unlockSkin(skinId) {
    const skin = SKINS.find((s) => s.id === skinId);
    if (!skin || this.isUnlocked(skinId)) return false;
    const cost = skin.unlock.type === 'coins' ? skin.unlock.cost : 0;
    if (this.coins < cost) return false;
    this.coins -= cost;
    this.unlockedSkins.add(skinId);
    this.selectedSkin = skinId;
    this.changed();
    return true;
  }

  selectSkin(skinId) {
    if (!this.isUnlocked(skinId) || this.selectedSkin === skinId) return false;
    this.selectedSkin = skinId;
    this.changed();
    return true;
  }

  // ---- Lifetime stats (menu > MY STATS)

  /**
   * @param {object} add counters to add, e.g. { kills: 1 }
   * @param {object} [best] values to keep if higher, e.g. { bestScore: 1200 }
   */
  recordStats(add = {}, best = {}) {
    let changed = false;
    this.checkSeason();
    for (const [key, value] of Object.entries(add)) {
      if (!(key in EMPTY_STATS) || !(value > 0)) continue;
      this.stats[key] += value;
      if (key in EMPTY_SEASON) this.season[key] += value; // this week's leaderboard
      changed = true;
    }
    for (const [key, value] of Object.entries(best)) {
      if (!(key in EMPTY_STATS) || !(value > this.stats[key])) {
        if (key in EMPTY_SEASON && value > this.season[key]) { this.season[key] = value; changed = true; }
        continue;
      }
      this.stats[key] = value;
      if (key in EMPTY_SEASON && value > this.season[key]) this.season[key] = value;
      changed = true;
    }
    if (changed) this.changed();
  }

  // ---- Login streak (once per local day)

  /** First visit of a new day: extends (or restarts) the streak and pays it. */
  checkDailyLogin(now = Date.now()) {
    const today = dayNumber(now);
    if (this.daily.lastDay === today) return null;
    const streak = this.daily.lastDay === today - 1 ? this.daily.streak + 1 : 1;
    this.daily = { lastDay: today, streak };
    const coins = streakReward(streak);
    this.coins += coins;
    const powerUp = streakPowerUp(streak);
    if (powerUp) this.powerUps[powerUp] = this.powerUpCount(powerUp) + 1;
    this.changed();
    return { streak, coins, powerUp };
  }

  // ---- Weekly crown season (ends Monday 09:00 UTC)

  /** A new week: last week's crowns pay a season reward, then the counters reset. */
  checkSeason(now = Date.now()) {
    const number = seasonNumber(now);
    if (this.season.number === number) return null;
    const previous = this.season;
    this.season = { number, ...EMPTY_SEASON };
    let result = null;
    if (previous.number !== null && previous.wins > 0) {
      const coins = seasonReward(previous.wins);
      this.coins += coins;
      result = { crowns: previous.wins, coins };
    }
    this.changed();
    return result;
  }

  // ---- Daily missions

  /** Today's three missions (a fresh set every local day). */
  refreshMissions(now = Date.now()) {
    const today = dayNumber(now);
    if (this.missions.day === today) return false;
    this.missions = { day: today, list: missionsForDay(today) };
    this.changed();
    return true;
  }

  /** The game reports something that happened ('claim', 'kills', ...); amount adds up. */
  missionEvent(event, amount = 1) {
    if (!(amount > 0)) return;
    this.refreshMissions();
    let changed = false;
    for (const m of this.missions.list) {
      const def = missionDef(m.id);
      if (!def || m.claimed || def.event !== event || m.progress >= def.goal) continue;
      m.progress = Math.min(def.goal, m.progress + amount);
      changed = true;
    }
    if (changed) this.saveSoon();
  }

  /** Missions that are complete but not yet claimed. */
  get claimableMissions() {
    return this.missions.list.filter((m) => !m.claimed && m.progress >= (missionDef(m.id)?.goal ?? Infinity)).length;
  }

  /** Pays a completed mission (coins + XP). */
  claimMission(id) {
    const m = this.missions.list.find((x) => x.id === id);
    const def = m && missionDef(m.id);
    if (!def || m.claimed || m.progress < def.goal) return null;
    m.claimed = true;
    this.coins += def.coins;
    this.experience = Math.min(MAX_CAREER_XP, this.experience + def.xp);
    if (def.powerUp) this.powerUps[def.powerUp] = this.powerUpCount(def.powerUp) + 1;
    this.changed();
    return { coins: def.coins, xp: def.xp, powerUp: def.powerUp || null };
  }

  // ---- Wheel of coins (one free spin a day + a few bonus spins)

  /** A new local day: the free spin and the bonus spins come back. */
  refreshWheel(now = Date.now()) {
    const today = dayNumber(now);
    if (this.wheel.day === today) return false;
    this.wheel = { ...this.wheel, day: today, freeUsed: false, bonusSpins: 0 };
    this.changed();
    return true;
  }

  get freeSpinReady() {
    this.refreshWheel();
    return !this.wheel.freeUsed;
  }

  get bonusSpinsLeft() {
    this.refreshWheel();
    return Math.max(0, WHEEL.BONUS_SPINS_PER_DAY - this.wheel.bonusSpins);
  }

  /**
   * Starts a spin: 'free' (once a day), 'ad' (after a finished rewarded ad) or 'coins'
   * (pays WHEEL.SPIN_PRICE). The prize is chosen now and saved as owed, so it is paid even if
   * the page closes before the wheel stops. Returns the segment index, or null if not allowed.
   */
  startSpin(kind) {
    this.refreshWheel();
    const w = this.wheel;
    if (w.pending !== null) return null;
    if (kind === 'free') {
      if (w.freeUsed) return null;
      w.freeUsed = true;
    } else if (kind === 'ad' || kind === 'coins') {
      if (!w.freeUsed || w.bonusSpins >= WHEEL.BONUS_SPINS_PER_DAY) return null;
      if (kind === 'coins') {
        if (this.coins < WHEEL.SPIN_PRICE) return null;
        this.coins -= WHEEL.SPIN_PRICE;
      }
      w.bonusSpins++;
    } else {
      return null;
    }
    w.pending = pickSegment();
    this.changed(); // the prize itself is only paid by finishSpin
    return w.pending;
  }

  /** Pays the owed prize (wheel stopped, sheet closed, or next visit). Returns the segment, or null. */
  finishSpin(now = Date.now()) {
    const index = this.wheel.pending;
    if (index === null) return null;
    const segment = WHEEL.SEGMENTS[index];
    if (segment.coins) this.coins += segment.coins;
    if (segment.powerUp) this.powerUps[segment.powerUp] = this.powerUpCount(segment.powerUp) + 1;
    this.wheel.pending = null;
    this.wheel.history = [{ segment: index, at: now }, ...this.wheel.history].slice(0, WHEEL.HISTORY);
    this.changed();
    return segment;
  }

  // ---- Store > Coins: +250 coins for a rewarded ad (a few a day, with a wait between)

  /** { left: ads still allowed today, waitMs: time until the next one may be offered } */
  adCoinsStatus(now = Date.now()) {
    const today = dayNumber(now);
    const count = this.adCoins.day === today ? this.adCoins.count : 0;
    const waitMs = Math.max(0, this.adCoins.lastAt + AD_COINS.COOLDOWN_MS - now);
    return { left: Math.max(0, AD_COINS.PER_DAY - count), waitMs };
  }

  /** Pays a FINISHED rewarded ad. Returns the coins paid (0 if not allowed right now). */
  grantAdCoins(now = Date.now()) {
    const { left, waitMs } = this.adCoinsStatus(now);
    if (left <= 0 || waitMs > 0) return 0;
    const today = dayNumber(now);
    this.adCoins = { day: today, count: (this.adCoins.day === today ? this.adCoins.count : 0) + 1, lastAt: now };
    this.coins += AD_COINS.AMOUNT;
    this.changed();
    return AD_COINS.AMOUNT;
  }

  /** Frequent small updates (mission progress) are saved at most every few seconds. */
  saveSoon() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = 0;
      this.changed();
    }, 4000);
  }

  // ---- Floors (Store > Floors)

  isFloorUnlocked(floorId) {
    return FLOORS.some((f) => f.id === floorId)
      && (DEV_UNLOCK_ALL_CHARACTERS || this.unlockedFloors.has(floorId));
  }

  /** Spends sigils on a floor. Returns false if unknown, already owned, or unaffordable. */
  unlockFloor(floorId) {
    const floor = FLOORS.find((f) => f.id === floorId);
    if (!floor || this.isFloorUnlocked(floorId) || this.coins < floor.price) return false;
    this.coins -= floor.price;
    this.unlockedFloors.add(floorId);
    this.changed();
    return true;
  }

  // ---- Power-ups (Store > Power-ups): consumable charges

  powerUpCount(type) {
    return this.powerUps[type] || 0;
  }

  buyPowerUp(type) {
    const item = POWER_UP_ITEMS.find((i) => i.id === type);
    if (!item || this.coins < item.price) return false;
    this.coins -= item.price;
    this.powerUps[type] = this.powerUpCount(type) + 1;
    this.changed();
    return true;
  }

  /** Uses one owned charge right now (item bar). Returns whether one was available. */
  usePowerUp(type) {
    if (this.powerUpCount(type) <= 0) return false;
    this.powerUps[type]--;
    if (this.powerUps[type] <= 0) delete this.powerUps[type];
    this.changed();
    return true;
  }

  /** Which owned power-up fires at your next spawn (null = none). */
  setLoadout(type) {
    const next = type && this.powerUpCount(type) > 0 ? type : null;
    if (next === this.loadout) return false;
    this.loadout = next;
    this.changed();
    return true;
  }

  /** Uses one charge of the loadout power-up (at spawn). Returns its type, or null. */
  consumeLoadout() {
    const type = this.loadout;
    if (!type || this.powerUpCount(type) <= 0) {
      this.loadout = null;
      return null;
    }
    this.powerUps[type]--;
    if (this.powerUps[type] <= 0) {
      delete this.powerUps[type];
      this.loadout = null;
    }
    this.changed();
    return type;
  }

  get selectedLook() {
    return skinById(this.selectedSkin).look;
  }

  get selectedCharacter() {
    return skinById(this.selectedSkin);
  }
}
