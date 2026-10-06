export const AnnounceStyle = Object.freeze({
  KING: 'king',
  GROW: 'grow',
  LOSS: 'loss',
  SURGE: 'surge',
});

/**
 * Big centre-screen callouts ("YOU ARE KING", "WORLD-001").
 * Never blocks input and clears itself after about a second.
 */
export class Announcer {
  constructor() {
    this.root = document.getElementById('announce');
    this.title = document.getElementById('announce-title');
    this.sub = document.getElementById('announce-sub');
    this.timer = 0;
  }

  show(title, sub, style, duration = 1.1) {
    this.title.textContent = title;
    this.sub.textContent = sub || '';
    this.root.className = `announce ${style}`;
    void this.root.offsetWidth; // restart the CSS animation
    this.root.classList.add('show');
    this.root.style.setProperty('--duration', `${duration}s`);
    this.timer = duration;
  }

  update(dt) {
    if (this.timer <= 0) return;
    this.timer -= dt;
    if (this.timer <= 0) this.clear();
  }

  clear() {
    this.timer = 0;
    this.root.classList.remove('show');
  }
}
