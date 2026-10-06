/**
 * Sound settings, shown on menu screens only (never on the gameplay HUD): an ON/OFF toggle
 * plus Music and SFX volume sliders. The M key toggles mute anywhere. Everything drives the
 * one AudioManager, which persists the preferences.
 */
export class SoundControls {
  /** @param {import('../audio/AudioManager.js').AudioManager} audio */
  constructor(audio) {
    this.audio = audio;
    this.toggles = [...document.querySelectorAll('[data-sound-toggle]')];
    this.sliders = [...document.querySelectorAll('[data-volume]')];

    for (const button of this.toggles) {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        audio.unlock();
        audio.toggleMute();
        audio.play('click');
      });
    }
    for (const slider of this.sliders) {
      const channel = slider.dataset.volume; // 'music' | 'sfx'
      slider.addEventListener('input', () => {
        audio.unlock();
        if (channel === 'music') audio.setMusicVolume(Number(slider.value) / 100);
        else audio.setSfxVolume(Number(slider.value) / 100);
      });
      slider.addEventListener('change', () => {
        if (channel === 'sfx') audio.play('click');
      });
    }
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'm' || e.key === 'M') && !(e.target instanceof HTMLInputElement)) {
        audio.unlock();
        audio.toggleMute();
      }
    });

    audio.onChange(() => this.render());
    this.render();
  }

  render() {
    const { muted, musicVolume, sfxVolume } = this.audio;
    for (const button of this.toggles) {
      button.classList.toggle('off', muted);
      button.setAttribute('aria-pressed', String(!muted));
      const label = button.querySelector('.sound-label');
      if (label) label.textContent = muted ? 'Sound off' : 'Sound on';
      button.title = muted ? 'Sound off (M)' : 'Sound on (M)';
    }
    for (const slider of this.sliders) {
      const value = slider.dataset.volume === 'music' ? musicVolume : sfxVolume;
      slider.value = String(Math.round(value * 100));
    }
  }
}
