import { TUTORIAL } from '../config.js';

const STEPS = Object.freeze([
  { icon: 'food', title: 'COLLECT ENERGY', text: 'Energy fuels your boost; energy collected when full adds score.' },
  { icon: 'land', title: 'CLAIM TERRITORY', text: 'Leave your territory and loop back: everything inside becomes yours.' },
  { icon: 'hunt', title: 'USE BOOST', text: 'Hold left click to use energy and move faster.' },
  { icon: 'hunt', title: 'COMPETE', text: 'Your territory is safe. Off it, a cut trail, your own trail, or touching a rival is fatal.' },
  { icon: 'crown', title: 'BECOME KING', text: 'Hold the most territory (at least 6% of the map).' },
]);

// The letters on the player's own keyboard for the movement keys (ZQSD on AZERTY, etc.).
// Movement uses physical key positions (e.code), so it already works on every layout;
// this only makes the hint show the right letters. Falls back to WASD.
let moveKeys = 'WASD';
try {
  navigator.keyboard?.getLayoutMap?.().then((map) => {
    const letters = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].map((code) => (map.get(code) || '').toUpperCase());
    if (letters.every((l) => /^[A-Z]$/.test(l))) moveKeys = letters.join('');
  }).catch(() => {});
} catch {
  // Keyboard API unavailable: keep WASD.
}

function readDone() {
  try {
    return window.localStorage.getItem(TUTORIAL.STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDone() {
  try {
    window.localStorage.setItem(TUTORIAL.STORAGE_KEY, '1');
  } catch {
    // Storage unavailable (private mode): the tutorial just shows again next time.
  }
}

/**
 * First-time, four-card tutorial. Each card advances as soon as the player does
 * the thing (or after a short timeout), so it's gone within ~20 seconds.
 * `?tutorial` in the URL forces it to show again.
 */
export class Tutorial {
  constructor() {
    this.root = document.getElementById('tutorial');
    this.icon = document.getElementById('tutorial-icon');
    this.step = document.getElementById('tutorial-step');
    this.title = document.getElementById('tutorial-title');
    this.text = document.getElementById('tutorial-text');
    this.move = document.getElementById('tutorial-move');
    this.forced = new URLSearchParams(window.location.search).has('tutorial');
    this.active = false;
    this.index = 0;
    this.stepTime = 0;
    this.moved = 0;
    this.touch = false;
    // SKIP: ends the tutorial for good (it never comes back unless ?tutorial is used).
    const skip = document.getElementById('tutorial-skip');
    if (skip) {
      skip.addEventListener('pointerdown', (e) => e.stopPropagation()); // never steers or boosts
      skip.addEventListener('click', (e) => {
        e.stopPropagation();
        this.move.classList.add('hidden');
        this.finish();
      });
    }
  }

  /** HOW TO PLAY > TRY IT NOW: show the tutorial in the next match even if it was done. */
  replayNext() {
    this.replayOnce = true;
  }

  /** Starts if this player hasn't finished it before. */
  begin(touch, mouseLocked = false) {
    this.touch = touch;
    this.active = this.forced || this.replayOnce || !readDone();
    this.replayOnce = false;
    this.root.classList.toggle('hidden', !this.active);
    if (!this.active) return;
    this.move.textContent = touch
      ? 'JOYSTICK = DIRECTION · HOLD BOOST BUTTON = USE ENERGY'
      : mouseLocked
        ? 'LOCKED MOUSE = DIRECTION · TAB = UNLOCK · HOLD CLICK OR SPACE = BOOST'
        : `MOUSE OR ${moveKeys} / ARROWS = DIRECTION · HOLD LEFT CLICK OR SPACE = BOOST`;
    this.move.classList.remove('hidden');
    this.moved = 0;
    this.show(0);
  }

  show(index) {
    this.index = index;
    this.stepTime = 0;
    const step = STEPS[index];
    this.icon.dataset.icon = step.icon;
    this.step.textContent = `${index + 1}/${STEPS.length}`;
    this.title.textContent = step.title;
    this.text.textContent = index === 2 && this.touch
      ? 'Hold the BOOST button to use energy and move faster.'
      : step.text;
    this.root.classList.remove('advance');
    void this.root.offsetWidth;
    this.root.classList.add('advance');
  }

  /**
   * @param {object} s
   * @param {number} s.moved distance travelled this frame
   * @param {number} s.collected total energy restored this life
   * @param {boolean} s.safe player is on settled home territory
   * @param {boolean} [s.captured] player closed a loop and captured land
   * @param {boolean} [s.encountered] another player is nearby
   * @param {boolean} [s.boosted] boost is active
   */
  update(dt, { moved, collected, safe, captured = false, encountered = false, boosted = false }) {
    if (!this.active) return;
    this.stepTime += dt;
    this.moved += moved;
    if (this.moved >= TUTORIAL.MOVE_DISTANCE) this.move.classList.add('hidden');

    let done = false;
    if (this.index === 0) done = collected >= TUTORIAL.COLLECT_VALUE || this.stepTime >= TUTORIAL.COLLECT_MAX_TIME;
    else if (this.index === 1) done = captured || safe || this.stepTime >= TUTORIAL.CLAIM_MAX_TIME;
    else if (this.index === 2) done = boosted || this.stepTime >= TUTORIAL.BOOST_MAX_TIME;
    else if (this.index === 3) done = encountered || this.stepTime >= TUTORIAL.HUNT_MAX_TIME;
    else done = this.stepTime >= TUTORIAL.KING_TIME;
    if (!done) return;

    if (this.index + 1 < STEPS.length) {
      this.show(this.index + 1);
    } else {
      this.finish();
    }
  }

  finish() {
    this.active = false;
    this.root.classList.add('hidden');
    writeDone();
  }

  /** Hide without marking complete (e.g. the player died mid-tutorial). */
  hide() {
    this.active = false;
    this.root.classList.add('hidden');
  }
}
