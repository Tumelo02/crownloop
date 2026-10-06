import { CAMERA, WORLD } from '../config.js';
import { clamp, damp } from '../utils/math.js';

/**
 * Smooth follow camera with a stable view scale for the fixed-size character.
 * The view is clamped to the world: the edge of the world stops the camera, so
 * nothing outside the playable area is ever on screen (shake included).
 */
export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.viewportWidth = 1;
    this.viewportHeight = 1;
    this.shakeAmount = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.bounds = { left: 0, top: 0, right: 0, bottom: 0 };
  }

  setViewport(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  zoomFor(radius) {
    const short = Math.min(this.viewportWidth, this.viewportHeight);
    const viewSize = Math.min(CAMERA.BASE_VIEW_SIZE, Math.max(CAMERA.MIN_VIEW_SIZE, short * CAMERA.VIEW_SIZE_PER_SCREEN_PX));
    const base = short / viewSize;
    const factor = clamp(
      Math.pow(CAMERA.REFERENCE_RADIUS / radius, CAMERA.ZOOM_EXPONENT),
      CAMERA.MIN_ZOOM_FACTOR,
      1,
    );
    // Never zoom out so far that the view is bigger than the world itself.
    const fitWorld = Math.max(this.viewportWidth / WORLD.WIDTH, this.viewportHeight / WORLD.HEIGHT);
    return Math.max(base * factor, fitWorld);
  }

  /** Keeps the view rectangle inside the playable world: nothing beyond it is ever shown. */
  clampToWorld() {
    const halfW = this.viewportWidth / 2 / this.zoom;
    const halfH = this.viewportHeight / 2 / this.zoom;
    this.x = halfW <= WORLD.WIDTH - halfW ? clamp(this.x, halfW, WORLD.WIDTH - halfW) : WORLD.WIDTH / 2;
    this.y = halfH <= WORLD.HEIGHT - halfH ? clamp(this.y, halfH, WORLD.HEIGHT - halfH) : WORLD.HEIGHT / 2;
  }

  snapTo(target) {
    this.x = target.x;
    this.y = target.y;
    this.zoom = this.zoomFor(target.displayRadius);
    this.shakeAmount = 0;
    this.shakeX = this.shakeY = 0;
    this.clampToWorld();
  }

  update(dt, target) {
    if (target) {
      const follow = damp(CAMERA.FOLLOW_RATE, dt);
      this.x += (target.x - this.x) * follow;
      this.y += (target.y - this.y) * follow;
      // viewScale > 1 (Zoom power-up) pulls the camera back; it eases in and out.
      const goal = this.zoomFor(target.displayRadius) / (this.viewScale || 1);
      this.zoom += (goal - this.zoom) * damp(CAMERA.ZOOM_RATE, dt);
    }

    this.shakeAmount *= Math.exp(-CAMERA.SHAKE_DECAY * dt);
    if (this.shakeAmount < CAMERA.SHAKE_EPSILON) this.shakeAmount = 0;
    this.clampToWorld();
    // Shake is in screen pixels; limit it so it can't peek past the edge either.
    const halfW = this.viewportWidth / 2 / this.zoom;
    const halfH = this.viewportHeight / 2 / this.zoom;
    const roomLeft = Math.max(0, (this.x - halfW) * this.zoom);
    const roomRight = Math.max(0, (WORLD.WIDTH - this.x - halfW) * this.zoom);
    const roomTop = Math.max(0, (this.y - halfH) * this.zoom);
    const roomBottom = Math.max(0, (WORLD.HEIGHT - this.y - halfH) * this.zoom);
    // Positive shakeX moves the world right, revealing more on the left.
    this.shakeX = clamp((Math.random() * 2 - 1) * this.shakeAmount, -roomRight, roomLeft);
    this.shakeY = clamp((Math.random() * 2 - 1) * this.shakeAmount, -roomBottom, roomTop);
  }

  shake(amount) {
    this.shakeAmount = Math.min(CAMERA.MAX_SHAKE, this.shakeAmount + amount);
  }

  /** Sets the context transform so world coordinates can be drawn directly. */
  applyTransform(ctx, dpr) {
    const scale = dpr * this.zoom;
    ctx.setTransform(
      scale, 0, 0, scale,
      dpr * (this.viewportWidth / 2 + this.shakeX - this.x * this.zoom),
      dpr * (this.viewportHeight / 2 + this.shakeY - this.y * this.zoom),
    );
  }

  worldToScreen(wx, wy, out) {
    out.x = (wx - this.x) * this.zoom + this.viewportWidth / 2;
    out.y = (wy - this.y) * this.zoom + this.viewportHeight / 2;
    return out;
  }

  /** Visible world rectangle (plus margin). Returns a reused object. */
  getBounds(margin = 0) {
    const halfW = this.viewportWidth / 2 / this.zoom + margin;
    const halfH = this.viewportHeight / 2 / this.zoom + margin;
    const b = this.bounds;
    b.left = this.x - halfW;
    b.right = this.x + halfW;
    b.top = this.y - halfH;
    b.bottom = this.y + halfH;
    return b;
  }
}

export function isInBounds(bounds, x, y, radius) {
  return x + radius >= bounds.left && x - radius <= bounds.right
    && y + radius >= bounds.top && y - radius <= bounds.bottom;
}
