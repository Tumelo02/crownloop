import { DIFFICULTY } from '../config.js';

/**
 * EASY / NORMAL / HARD above the PLAY button: how sharp the bots are. Saved per device;
 * the choice applies from the next match (Enemy.setBotDifficulty).
 */
export class DifficultyPicker {
  constructor(audio) {
    this.audio = audio;
    this.root = document.getElementById('difficulty');
    this.level = DIFFICULTY.DEFAULT;
    try {
      const saved = localStorage.getItem(DIFFICULTY.STORAGE_KEY);
      if (DIFFICULTY.LEVELS[saved]) this.level = saved;
    } catch {
      // storage unavailable: NORMAL
    }
    if (!this.root) return;
    for (const button of this.root.querySelectorAll('[data-level]')) {
      button.addEventListener('click', () => this.set(button.dataset.level));
    }
    this.render();
  }

  set(level) {
    if (!DIFFICULTY.LEVELS[level] || level === this.level) return;
    this.level = level;
    this.audio.play('click');
    try { localStorage.setItem(DIFFICULTY.STORAGE_KEY, level); } catch { /* not saved */ }
    this.render();
  }

  render() {
    for (const button of this.root.querySelectorAll('[data-level]')) {
      const on = button.dataset.level === this.level;
      button.classList.toggle('active', on);
      button.setAttribute('aria-checked', String(on));
    }
  }
}
