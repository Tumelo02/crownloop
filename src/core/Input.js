import { PLAYER } from '../config.js';

export const InputMode = Object.freeze({ MOUSE: 'mouse', TOUCH: 'touch', KEYBOARD: 'keyboard' });

const KEY_DIRECTIONS = Object.freeze({
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  KeyZ: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  KeyQ: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
});

function prefersTouch() {
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
  return 'ontouchstart' in window && navigator.maxTouchPoints > 0
    && !(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
}

/**
 * Turns mouse or touch into one movement intent: { x, y } direction + throttle 0..1.
 * Input only ever chooses DIRECTION: throttle is 1 whenever a direction is given, so
 * cursor distance (or how far the joystick is pushed) never changes speed.
 * Mouse, keyboard, and touch feed the same intent, so gameplay never branches on platform.
 * The mode starts from device detection and switches to whatever was used last,
 * which also covers touchscreen laptops.
 */
export class Input {
  constructor(element, joystick, cursorElement) {
    this.element = element;
    this.joystick = joystick;
    this.cursorElement = cursorElement;
    this.mouseLockRequired = false;
    this.mouseLocked = false;
    this.pointerX = 0;
    this.pointerY = 0;
    this.hasPointer = false;
    this.pointerInside = false;
    this.intent = { x: 0, y: 0, throttle: 0 };
    this.lastMovementDirection = { x: 1, y: 0 };
    this.cursorAngle = 0;
    this.hasCursorAngle = false;
    this.enabled = false;
    this.boostHeld = false;
    this.boostPointerId = null;
    this.pointerBoostHeld = false;
    this.keyboardBoostHeld = false;
    this.touchSteered = false;
    this.pressedKeys = new Set();
    this.setMode(prefersTouch() ? InputMode.TOUCH : InputMode.MOUSE);

    element.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    element.addEventListener('pointermove', (e) => this.onPointerMove(e));
    element.addEventListener('pointerenter', (e) => this.onPointerEnter(e));
    element.addEventListener('pointerleave', (e) => this.onPointerLeave(e));
    window.addEventListener('pointermove', (e) => this.onWindowPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    window.addEventListener('blur', () => {
      this.clearBoost();
      this.pointerInside = false;
      this.updateCursorVisibility();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearBoost();
        this.pointerInside = false;
        this.updateCursorVisibility();
      }
    });
    window.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget && e.pointerType !== 'touch') {
        this.clearBoost();
        this.pointerInside = false;
        this.updateCursorVisibility();
      }
    });
    element.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setMode(mode) {
    this.mode = mode;
    this.joystick.visible = mode === InputMode.TOUCH;
    this.updateCursorVisibility();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.clearBoost();
      this.joystick.end(this.joystick.pointerId);
      if (document.pointerLockElement === this.element && document.exitPointerLock) {
        document.exitPointerLock();
      }
    }
    this.updateCursorVisibility();
  }

  setMouseLockRequired(required) {
    this.mouseLockRequired = Boolean(required);
  }

  requestMouseLock() {
    if (!this.enabled || !this.mouseLockRequired || !this.element.requestPointerLock
      || document.pointerLockElement === this.element) return;
    try {
      const request = this.element.requestPointerLock();
      if (request && typeof request.catch === 'function') {
        request.catch((error) => console.warn('Pointer lock was unavailable; mouse steering remains enabled.', error));
      }
    } catch (error) {
      console.warn('Pointer lock was unavailable; mouse steering remains enabled.', error);
    }
  }

  onPointerLockChange() {
    this.mouseLocked = document.pointerLockElement === this.element;
    if (this.mouseLocked) {
      const rect = this.element.getBoundingClientRect();
      this.pointerX = Math.max(0, Math.min(rect.width, this.hasPointer ? this.pointerX : rect.width / 2));
      this.pointerY = Math.max(0, Math.min(rect.height, this.hasPointer ? this.pointerY : rect.height / 2));
      this.hasPointer = true;
      this.pointerInside = true;
      this.positionCustomPointer();
    } else {
      this.pointerInside = false;
    }
    this.updateCursorVisibility();
  }

  localX(e) {
    return e.clientX - this.element.getBoundingClientRect().left;
  }

  localY(e) {
    return e.clientY - this.element.getBoundingClientRect().top;
  }

  onPointerDown(e) {
    if (e.pointerType === 'touch') {
      e.preventDefault();
      this.setMode(InputMode.TOUCH);
      if (!this.enabled) return;
      const x = this.localX(e);
      const y = this.localY(e);
      if (this.joystick.isBoostButtonAt(x, y)) {
        this.boostPointerId = e.pointerId;
        this.beginBoost();
        this.capture(e.pointerId);
        return;
      }
      if (!this.joystick.active) {
        this.joystick.begin(e.pointerId, x, y);
        this.capture(e.pointerId);
      }
      return;
    }
    this.setMode(InputMode.MOUSE);
    this.trackPointer(e);
    const rect = this.element.getBoundingClientRect();
    this.pointerInside = e.clientX >= rect.left && e.clientX <= rect.right
      && e.clientY >= rect.top && e.clientY <= rect.bottom;
    this.updateCursorVisibility();
    if (e.button === 0) {
      e.preventDefault();
      if (this.enabled) this.beginBoost();
    }
  }

  onPointerMove(e) {
    if (e.pointerType === 'touch') {
      if (e.pointerId === this.joystick.pointerId) {
        e.preventDefault();
        this.joystick.move(this.localX(e), this.localY(e));
      }
      return;
    }
    if (this.mode !== InputMode.MOUSE) this.setMode(InputMode.MOUSE);
    this.trackPointer(e);
    // Safety net: if a mouseup was missed (released outside the page), the button state says so.
    if (this.boostHeld && this.boostPointerId === null && (e.buttons & 1) === 0) {
      this.releaseBoost();
    }
  }

  onPointerEnter(e) {
    if (e.pointerType === 'touch') return;
    this.setMode(InputMode.MOUSE);
    this.trackPointer(e);
    this.pointerInside = true;
    this.updateCursorVisibility();
  }

  onPointerLeave(e) {
    if (e.pointerType === 'touch') return;
    this.pointerInside = false;
    this.releaseBoost();
    this.updateCursorVisibility();
  }

  onWindowPointerMove(e) {
    if (e.pointerType === 'touch') return;
    if (this.mouseLocked) return;
    if (this.mode !== InputMode.MOUSE) this.setMode(InputMode.MOUSE);
    this.trackPointer(e);
    const rect = this.element.getBoundingClientRect();
    this.pointerInside = e.clientX >= rect.left && e.clientX <= rect.right
      && e.clientY >= rect.top && e.clientY <= rect.bottom;
    this.updateCursorVisibility();
  }

  onPointerUp(e) {
    if (e.pointerType === 'touch') this.joystick.end(e.pointerId);
    if (e.pointerId === this.boostPointerId || e.pointerType !== 'touch' && e.button === 0) {
      this.releaseBoost();
    }
  }

  onKeyDown(e) {
    if (e.code === 'Tab' && this.mouseLocked) {
      e.preventDefault();
      document.exitPointerLock();
      return;
    }
    if (!this.enabled || e.ctrlKey || e.metaKey || e.altKey
      || e.target instanceof HTMLElement
        && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))) return;

    if (e.code === 'Space') {
      e.preventDefault();
      this.keyboardBoostHeld = true;
      this.syncBoostHeld();
      return;
    }
    if (!KEY_DIRECTIONS[e.code]) return;
    e.preventDefault();
    this.pressedKeys.add(e.code);
    this.setMode(InputMode.KEYBOARD);
  }

  onKeyUp(e) {
    if (e.code === 'Space') {
      this.keyboardBoostHeld = false;
      this.syncBoostHeld();
    }
    this.pressedKeys.delete(e.code);
  }

  /** Keeps a finger's events coming to the canvas; harmless if the pointer is already gone. */
  capture(pointerId) {
    try {
      if (this.element.setPointerCapture) this.element.setPointerCapture(pointerId);
    } catch {
      // The pointer ended before capture (fast tap): nothing to capture.
    }
  }

  beginBoost() {
    this.pointerBoostHeld = true;
    this.syncBoostHeld();
  }

  clearBoost() {
    this.pointerBoostHeld = false;
    this.keyboardBoostHeld = false;
    this.boostPointerId = null;
    this.pressedKeys.clear();
    this.syncBoostHeld();
  }

  releaseBoost() {
    this.pointerBoostHeld = false;
    this.boostPointerId = null;
    this.syncBoostHeld();
  }

  syncBoostHeld() {
    this.boostHeld = this.pointerBoostHeld || this.keyboardBoostHeld;
  }

  trackPointer(e) {
    if (this.mouseLocked) {
      const rect = this.element.getBoundingClientRect();
      this.pointerX = Math.max(0, Math.min(rect.width, this.pointerX + e.movementX));
      this.pointerY = Math.max(0, Math.min(rect.height, this.pointerY + e.movementY));
      this.hasPointer = true;
      this.positionCustomPointer();
      return;
    }
    this.pointerX = this.localX(e);
    this.pointerY = this.localY(e);
    this.hasPointer = true;
    if (this.cursorElement) {
      this.cursorElement.style.left = `${e.clientX}px`;
      this.cursorElement.style.top = `${e.clientY}px`;
    }
  }

  /** Clears transient input while retaining the last valid direction and pointer position. */
  reset() {
    this.joystick.end(this.joystick.pointerId);
    this.clearBoost();
    this.updateCursorVisibility();
  }

  updateCursorVisibility() {
    const visible = this.enabled && this.mode === InputMode.MOUSE && this.pointerInside;
    document.body.classList.toggle('mouse-game-active', visible);
    document.body.classList.toggle('mouse-pointer-locked', this.enabled && this.mouseLocked);
    if (this.cursorElement) this.cursorElement.classList.toggle('visible', this.enabled && this.mouseLocked);
  }

  positionCustomPointer() {
    if (!this.cursorElement) return;
    this.cursorElement.style.left = `${this.pointerX}px`;
    this.cursorElement.style.top = `${this.pointerY}px`;
  }

  /** Smooth only the cursor artwork; movement uses the direction without visual lag. */
  updateCursor(boosting, dt) {
    if (!this.cursorElement) return;
    const direction = this.lastMovementDirection;
    const target = Math.atan2(direction.y, direction.x);
    if (!this.hasCursorAngle) {
      this.cursorAngle = target;
      this.hasCursorAngle = true;
    } else {
      const fullTurn = Math.PI * 2;
      const difference = ((target - this.cursorAngle + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
      this.cursorAngle += difference * (1 - Math.exp(-16 * dt));
    }
    this.cursorElement.style.setProperty('--direction-angle', `${this.cursorAngle}rad`);
    this.cursorElement.classList.toggle('boosting', Boolean(boosting));
  }

  /**
   * Direction from the player's on-screen position to the cursor (both in canvas CSS px,
   * the same space Camera.worldToScreen uses, so DPR / browser zoom / window size don't
   * matter). Inside the dead zone (the cursor on or right next to the body) the tiny
   * vector would flip and jitter, so the last valid direction is kept instead.
   */
  updateMouseDirection(originX, originY, deadzone = 0) {
    if (!this.hasPointer) return this.lastMovementDirection;
    const dx = this.pointerX - originX;
    const dy = this.pointerY - originY;
    const distance = Math.hypot(dx, dy);
    if (distance > Math.max(PLAYER.MIN_MOUSE_DIRECTION_DISTANCE, deadzone)) {
      this.lastMovementDirection.x = dx / distance;
      this.lastMovementDirection.y = dy / distance;
    }
    return this.lastMovementDirection;
  }

  /**
   * @param {number} originX player's on-screen x
   * @param {number} originY player's on-screen y
   * @param {number} [deadzone] screen px around the player where the mouse can't steer
   */
  readIntent(originX, originY, deadzone = 0) {
    const out = this.intent;
    out.x = out.y = out.throttle = 0;

    if (this.mode === InputMode.KEYBOARD) {
      let x = 0;
      let y = 0;
      for (const code of this.pressedKeys) {
        const direction = KEY_DIRECTIONS[code];
        if (!direction) continue;
        x += direction[0];
        y += direction[1];
      }
      const length = Math.hypot(x, y);
      if (length > 0) {
        out.x = x / length;
        out.y = y / length;
        out.throttle = 1;
        this.lastMovementDirection.x = out.x;
        this.lastMovementDirection.y = out.y;
      }
      return out;
    }

    if (this.joystick.active && this.joystick.magnitude > 0) {
      this.lastMovementDirection.x = this.joystick.dirX;
      this.lastMovementDirection.y = this.joystick.dirY;
      this.touchSteered = true;
    }

    if (this.mode === InputMode.TOUCH) {
      // Like the mouse, touch only sets direction: lifting the thumb (or resting it in the
      // dead zone) keeps the creature going the last way it was pointed. It waits only
      // until the first steer, so a new player isn't moved before touching the screen.
      if (this.touchSteered) {
        out.x = this.lastMovementDirection.x;
        out.y = this.lastMovementDirection.y;
        out.throttle = 1;
      }
      return out;
    }

    if (this.mode === InputMode.MOUSE) {
      const direction = this.updateMouseDirection(originX, originY, deadzone);
      out.x = direction.x;
      out.y = direction.y;
      out.throttle = 1;
    }
    return out;
  }
}
