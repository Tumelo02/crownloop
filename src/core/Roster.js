/** Who drives a slot. REMOTE is reserved for networked players. */
export const ControllerKind = Object.freeze({
  LOCAL: 'local',
  AI: 'ai',
  REMOTE: 'remote',
});

let aiCounter = 0;

/**
 * A seat in the match. It outlives any one creature: AI participants respawn after a
 * countdown, while the local player chooses when to rejoin. A King elimination marks the
 * participant `removed`: out of this world's match for good.
 * A real multiplayer player would occupy a participant the same way the AI does today,
 * by swapping `kind` and the controller feeding intents.
 */
export class Participant {
  constructor({ slot, name, hue, kind, playerId }) {
    this.slot = slot;
    this.name = name;
    this.hue = hue;
    this.kind = kind;
    this.playerId = playerId || `ai-${++aiCounter}`;
    this.creature = null;
    this.respawnTimer = 0;
    this.kills = 0;
    this.deaths = 0;
    this.removed = false;
    this.removedReason = null;
  }

  get alive() {
    return this.creature !== null && this.creature.alive;
  }

  get isLocal() {
    return this.kind === ControllerKind.LOCAL;
  }
}

/** Fixed list of participants indexed by territory slot (slot 0 means "unowned"). */
export class Roster {
  constructor() {
    this.list = [];
    this.bySlot = [];
  }

  reset() {
    this.list.length = 0;
    this.bySlot.length = 0;
  }

  add(options) {
    const participant = new Participant(options);
    this.list.push(participant);
    this.bySlot[participant.slot] = participant;
    return participant;
  }

  /** A new player takes over an empty seat (same slot, new identity). */
  replace(slot, options) {
    const participant = new Participant({ ...options, slot });
    const index = this.list.findIndex((p) => p.slot === slot);
    if (index >= 0) this.list[index] = participant;
    else this.list.push(participant);
    this.bySlot[slot] = participant;
    return participant;
  }

  get(slot) {
    return this.bySlot[slot] || null;
  }
}
