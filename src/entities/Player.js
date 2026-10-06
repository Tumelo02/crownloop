import { PLAYER } from '../config.js';
import { Creature } from './Creature.js';

/** The locally controlled creature. Only difference from others: its intent comes from Input. */
export class Player extends Creature {
  constructor(options) {
    super({ ...options, hue: options.hue ?? PLAYER.HUE, isPlayer: true });
    this.screenPosition = { x: 0, y: 0 };
  }

  readInput(input, camera) {
    if (!this.alive) return;
    const screen = camera.worldToScreen(this.x, this.y, this.screenPosition);
    const deadzone = this.displayRadius * camera.zoom * PLAYER.MOUSE_DEADZONE_RADIUS_FACTOR;
    const intent = input.readIntent(screen.x, screen.y, deadzone);
    this.setIntent(intent.x, intent.y, intent.throttle);
  }
}
