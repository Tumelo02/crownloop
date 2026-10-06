import { LOOP } from '../config.js';

/**
 * requestAnimationFrame loop with a clamped variable timestep.
 * Variable steps keep motion smooth on 60/120/144 Hz displays; the clamp keeps
 * physics stable after hitches. A server-authoritative multiplayer build would
 * run its own fixed-rate simulation, so determinism isn't needed here.
 */
export class GameLoop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.running = false;
    this.lastTime = 0;
    this.frameId = 0;
    this.generation = 0;
    this.tick = this.tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.generation++;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    this.generation++;
    cancelAnimationFrame(this.frameId);
  }

  tick(now) {
    if (!this.running) return;
    const generation = this.generation;
    // Clamp both ways: long hitches, and the tiny negative step a (re)started loop can see.
    const dt = Math.max(0, Math.min((now - this.lastTime) / 1000, LOOP.MAX_FRAME_DT));
    this.lastTime = now;
    // One bad frame must never freeze the game: the next frame is always scheduled, and the
    // error is still reported (rethrown asynchronously, so it shows in the console).
    try {
      this.update(dt);
      if (!this.running || generation !== this.generation) return;
      this.render(dt);
    } catch (error) {
      setTimeout(() => { throw error; });
    }
    if (!this.running || generation !== this.generation) return;
    this.frameId = requestAnimationFrame(this.tick);
  }
}
