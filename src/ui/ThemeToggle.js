/**
 * Light / dark theme. The sun/moon button next to the settings gear flips <html data-theme>;
 * the choice is saved on this device. index.html applies the saved theme before first paint,
 * so there is no flash. Every menu, popup, HUD card and end screen follows it (styles.css
 * theme tokens); the galaxy floor of the arena keeps its own colours.
 */
const STORAGE_KEY = 'dominion.theme';

export function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export class ThemeToggle {
  /**
   * @param {import('../audio/AudioManager.js').AudioManager} audio
   * @param {(theme: string) => void} [onChange] repaint anything drawn for the old theme
   */
  constructor(audio, onChange = null) {
    this.audio = audio;
    this.onChange = onChange;
    this.button = document.getElementById('theme-button');
    if (!this.button) return;
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.unlock();
      this.audio.play('click');
      this.set(currentTheme() === 'light' ? 'dark' : 'light');
    });
    this.button.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.sync();
  }

  set(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    this.sync();
    this.onChange?.(theme);
  }

  /** Button label/state describe what a click will do. */
  sync() {
    const light = currentTheme() === 'light';
    const label = light ? 'Switch to dark mode' : 'Switch to light mode';
    this.button.setAttribute('aria-label', label);
    this.button.title = label;
    this.button.setAttribute('aria-pressed', String(light));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = light ? '#eef3fa' : '#020308';
  }
}
