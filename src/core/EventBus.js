/** Minimal synchronous pub/sub so systems don't need to know who reacts to them. */
export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(handler);
  }

  emit(type, payload) {
    const list = this.handlers.get(type);
    if (!list) return;
    for (const handler of list) handler(payload);
  }
}

export const GameEvent = Object.freeze({
  CHARACTER_SELECTED: 'characterSelected', // { skinId, element, name }
  GALAXY_EVENT_CHANGED: 'galaxyEventChanged', // { event: { id, label, blurb, ... } | null }
  ENERGY_COLLECTED: 'energyCollected',
  COIN_COLLECTED: 'coinCollected', // { creature, coin, value, multiplied }
  POWER_UP_COLLECTED: 'powerUpCollected',
  POWERUP_PICKUP: 'powerUpCollected', // (explicit alias)
  POWERUP_ACTIVATED: 'powerUpActivated', // { creature, type, x, y }
  POWERUP_EXPIRED: 'powerUpExpired', // { creature, type }
  TRAIL_CUT: 'trailCut', // any cut contact
  TRAIL_SLICED: 'trailSliced', // a LETHAL cut: { cutter, victim, x, y, heading, self }
  TERRITORY_CAPTURED: 'territoryCaptured',
  CREATURE_ELIMINATED: 'creatureEliminated',
  PLAYER_ELIMINATED: 'creatureEliminated', // (explicit alias; any creature)
  CREATURES_BUMPED: 'creaturesBumped',
  PLAYER_COLLISION: 'creaturesBumped', // (explicit alias: non-lethal contact)
  // The current King eliminated someone: that player is out of this world's match for good.
  // Payload: { eliminatedPlayerId, kingPlayerId, worldId, timestamp, reason: 'KING', victim, killer }
  KING_ELIMINATION: 'kingElimination',
  // A strategic landmark changed hands: { kind, landmark, slot } (slot 0 = released to neutral)
  LANDMARK_CLAIMED: 'landmarkClaimed',
  LANDMARK_RELEASED: 'landmarkReleased',
});
