import { WORLD } from '../config.js';
import { Roster } from '../core/Roster.js';
import { MatchState, WorldSession } from './WorldSession.js';

function randomId() {
  try {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  } catch {
    // fall through
  }
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Who the local player is for matchmaking purposes. Session-only (not an account):
 * `eliminatedWorldIds` lists worlds whose CURRENT match this player was closed out of
 * by the King. It is cleared for a world once that world's match ends.
 */
export class PlayerIdentity {
  constructor() {
    this.playerId = randomId();
    this.eliminatedWorldIds = new Set();
  }
}

/**
 * Hands out worlds. Locally there is only ever one running world at a time, but the
 * rule a server would enforce is the same: a player goes to a world that is running,
 * has a free seat and has not closed them out; otherwise a new world opens.
 */
export class WorldManager {
  constructor() {
    this.nextNumber = 1;
    this.worlds = new Map(); // worldId → WorldSession
    this.localPlayer = new PlayerIdentity();
  }

  static formatId(n) {
    return `${WORLD.ID_PREFIX}${String(n).padStart(3, '0')}`;
  }

  createWorld() {
    const worldId = WorldManager.formatId(this.nextNumber++);
    const session = new WorldSession({ worldId, roster: new Roster() });
    this.worlds.set(worldId, session);
    return session;
  }

  /** The world this player should enter next. */
  findWorldFor(player) {
    this.pruneFinished();
    for (const session of this.worlds.values()) {
      // A local client can only run the world it is in, so abandoned worlds are never offered.
      if (session.abandonedAt !== undefined) continue;
      if (session.state === MatchState.RUNNING && !player.eliminatedWorldIds.has(session.worldId)
        && session.canAdmit(player.playerId)) {
        return session;
      }
    }
    return this.createWorld();
  }

  /** A match ended: its world (and any lock-out from it) is finished. */
  retire(session) {
    session.state = MatchState.ENDED;
    this.worlds.delete(session.worldId);
    this.localPlayer.eliminatedWorldIds.delete(session.worldId);
  }

  /**
   * Record that the King closed this player out of a world's current match. The local
   * client stops simulating that world; the lock lasts until its match clock runs out.
   */
  lockOut(player, session) {
    player.eliminatedWorldIds.add(session.worldId);
    session.abandonedAt = Date.now();
    session.endsAtMs = session.abandonedAt + session.timeLeft * 1000;
  }

  pruneFinished() {
    const now = Date.now();
    for (const session of [...this.worlds.values()]) {
      if (session.state === MatchState.ENDED || (session.endsAtMs !== undefined && now >= session.endsAtMs)) {
        this.retire(session);
      }
    }
  }
}
