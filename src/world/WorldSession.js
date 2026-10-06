import { MATCH, WORLD } from '../config.js';

export const MatchState = Object.freeze({
  WAITING: 'waiting',
  RUNNING: 'running',
  ENDED: 'ended',
});

export const EliminationReason = Object.freeze({
  KING: 'KING',
});

let matchCounter = 0;

/**
 * One world = one contained match with a fixed number of seats.
 *
 * This is the shape a future server would own: worldId, matchId, capacity, match state
 * and clock, the seated players, the King, the world bounds, and which players are
 * permanently closed out of THIS match (eliminated by the King). Locally the Game drives
 * it; nothing here talks to a network.
 */
export class WorldSession {
  /**
   * @param {object} o
   * @param {string} o.worldId e.g. "WORLD-001"
   * @param {import('../core/Roster.js').Roster} o.roster the seats in this world
   */
  constructor({ worldId, roster, capacity = WORLD.CAPACITY, duration = MATCH.DURATION }) {
    this.worldId = worldId;
    this.matchId = `${worldId}#${++matchCounter}`;
    this.capacity = capacity;
    this.duration = duration;
    this.timeLeft = duration;
    this.state = MatchState.WAITING;
    this.roster = roster;
    this.king = null; // participant currently holding the crown
    this.bounds = { left: 0, top: 0, right: WORLD.WIDTH, bottom: WORLD.HEIGHT };
    this.closedTo = new Set(); // playerIds permanently eliminated from this match
    this.vacancies = []; // { slot, timer }: seats waiting for a new player to join
  }

  /** Seats currently taken by players still in this match (alive or respawning). */
  get playerCount() {
    let n = 0;
    for (const p of this.roster.list) if (!p.removed) n++;
    return n;
  }

  get activePlayers() {
    return this.roster.list.filter((p) => !p.removed);
  }

  get hasSeat() {
    return this.playerCount < this.capacity;
  }

  /** Can this player join (or rejoin) this world right now? */
  canAdmit(playerId) {
    return this.state !== MatchState.ENDED && this.hasSeat && !this.closedTo.has(playerId);
  }

  start() {
    this.state = MatchState.RUNNING;
    this.timeLeft = this.duration;
  }

  /** @returns {boolean} true when the match just ran out of time */
  tick(dt) {
    if (this.state !== MatchState.RUNNING) return false;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft > 0) return false;
    this.state = MatchState.ENDED;
    return true;
  }

  /**
   * The King eliminated this participant: they are out of THIS match for good, and their
   * seat stays empty (nobody replaces them), so a King who takes everyone out wins early.
   */
  closeOut(participant, reason) {
    participant.removed = true;
    participant.removedReason = reason;
    this.closedTo.add(participant.playerId);
  }

  /** Counts down open seats; returns the slots ready to be filled this frame. */
  readyVacancies(dt, out) {
    out.length = 0;
    for (let i = this.vacancies.length - 1; i >= 0; i--) {
      const v = this.vacancies[i];
      v.timer -= dt;
      if (v.timer > 0) continue;
      this.vacancies.splice(i, 1);
      if (this.timeLeft > WORLD.SEAT_REFILL_MIN_TIME_LEFT) out.push(v.slot);
    }
    return out;
  }
}
