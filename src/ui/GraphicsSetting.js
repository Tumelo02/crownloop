/**
 * Settings > GRAPHICS: HIGH (always full sharpness) or AUTO (draws a little less sharp when
 * a device can't keep up). Saved per device. Default: HIGH on computers, AUTO on touch phones.
 */
const STORAGE_KEY = 'crownloop.graphics';

export class GraphicsSetting {
  /** @param {(mode: string) => void} onChange */
  constructor(audio, onChange) {
    this.audio = audio;
    this.onChange = onChange;
    this.root = document.getElementById('graphics-setting');
    const phone = window.matchMedia?.('(pointer: coarse)').matches;
    this.mode = phone ? 'auto' : 'high';
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'high' || saved === 'auto') this.mode = saved;
    } catch {
      // storage unavailable: device default
    }
    if (!this.root) return;
    for (const button of this.root.querySelectorAll('[data-graphics]')) {
      button.addEventListener('click', () => this.set(button.dataset.graphics));
    }
    this.render();
  }

  get high() {
    return this.mode === 'high';
  }

  set(mode) {
    if (mode === this.mode || (mode !== 'high' && mode !== 'auto')) return;
    this.mode = mode;
    this.audio.play('click');
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* not saved */ }
    this.render();
    this.onChange(mode);
  }

  render() {
    for (const button of this.root.querySelectorAll('[data-graphics]')) {
      const on = button.dataset.graphics === this.mode;
      button.classList.toggle('active', on);
      button.setAttribute('aria-checked', String(on));
    }
  }
}
