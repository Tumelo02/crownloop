import { POWER_UP_ITEMS } from '../progression/storeCatalog.js';
import { powerUpIcon } from './icons.js';

/**
 * The power-ups you bought in the store, shown during a match (bottom centre; right side on
 * phones). Click / tap one, or press its number key, to use a charge right away.
 */
export class ItemBar {
  /**
   * @param {import('../progression/PlayerProgress.js').PlayerProgress} progress
   * @param {(type: string) => boolean} use fires the power-up; returns whether it was used
   */
  constructor(progress, use) {
    this.progress = progress;
    this.use = use;
    this.root = document.getElementById('item-bar');
    this.visible = false;
    if (!this.root) return;
    this.buttons = POWER_UP_ITEMS.map((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'item-slot';
      button.style.setProperty('--item-hue', item.hue);
      button.title = `${item.name}: ${item.effect} (key ${index + 1})`;
      const orb = powerUpIcon(item.id, 'item-orb');
      const name = document.createElement('span');
      name.className = 'item-name';
      name.textContent = item.name;
      const count = document.createElement('span');
      count.className = 'item-count';
      const key = document.createElement('span');
      key.className = 'item-key';
      key.textContent = String(index + 1);
      button.append(orb, key, count, name);
      button.addEventListener('pointerdown', (e) => e.stopPropagation()); // never steers / boosts
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.fire(item.id);
      });
      this.root.appendChild(button);
      return { item, button, count };
    });
    window.addEventListener('keydown', (e) => {
      if (!this.visible || e.repeat || e.target instanceof HTMLInputElement) return;
      const index = Number(e.key) - 1;
      const slot = this.buttons[index];
      if (slot && !slot.button.hidden) this.fire(slot.item.id);
    });
    progress.onChange(() => this.render());
    this.render();
  }

  fire(type) {
    if (this.use(type)) this.render();
  }

  /** Only shown while a match is being played. */
  setVisible(visible) {
    this.visible = visible;
    this.render();
  }

  render() {
    if (!this.root) return;
    let any = false;
    for (const { item, button, count } of this.buttons) {
      const n = this.progress.powerUpCount(item.id);
      button.hidden = n === 0;
      count.textContent = `×${n}`;
      any = any || n > 0;
    }
    this.root.classList.toggle('hidden', !this.visible || !any);
  }
}
