/**
 * The gear button on the start screen opens a small Settings panel (sound lives there;
 * floors are in the store).
 * Closes only with its X (or the gear button).
 */
export class SettingsPanel {
  /** @param {import('../audio/AudioManager.js').AudioManager} audio */
  constructor(audio) {
    this.audio = audio;
    this.button = document.getElementById('settings-button');
    this.panel = document.getElementById('settings-panel');
    this.close = document.getElementById('settings-close');
    if (!this.button || !this.panel) return;

    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle(this.panel.classList.contains('hidden'));
    });
    this.close.addEventListener('click', () => this.toggle(false));
    // Closes only with its X (or the gear again): clicking elsewhere never closes it.
    this.panel.addEventListener('click', (e) => e.stopPropagation());
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  get isOpen() {
    return !this.panel.classList.contains('hidden');
  }

  toggle(open) {
    if (open === this.isOpen) return;
    this.audio.unlock();
    this.audio.play('click');
    this.panel.classList.toggle('hidden', !open);
    this.button.classList.toggle('active', open);
    this.button.setAttribute('aria-expanded', String(open));
    if (open) this.panel.querySelector('[data-sound-toggle]').focus();
  }
}
