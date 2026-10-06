import { GameEvent } from '../core/EventBus.js';
import { SKINS } from '../progression/skins.js';

/**
 * DEVELOPMENT ONLY (`?fxtest` in the URL; never shown otherwise): buttons that fire each
 * combat / power-up effect next to the player, so visuals and sounds can be checked
 * without playing a match. It only emits the same events gameplay emits.
 */
export class EffectTestPanel {
  constructor(game) {
    this.game = game;
    const panel = document.createElement('div');
    panel.className = 'fx-test-panel';
    panel.innerHTML = '<div class="fx-test-title">EFFECT TEST (dev)</div>';
    const group = (label) => {
      const g = document.createElement('div');
      g.className = 'fx-test-group';
      g.innerHTML = `<span>${label}</span>`;
      panel.appendChild(g);
      return g;
    };
    const button = (parent, text, fn, { requireAlive = true } = {}) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (requireAlive && (!game.player || !game.player.alive)) return; // only during play
        game.audio.unlock();
        fn();
      });
      parent.appendChild(b);
    };
    const slices = group('SLICE');
    const elims = group('ELIM');
    for (const skin of SKINS) {
      button(slices, skin.name, () => this.slice(skin));
      button(elims, skin.name, () => this.eliminate(skin));
    }
    button(slices, 'ALL', () => SKINS.forEach((s, i) => setTimeout(() => { if (game.player && game.player.alive) this.slice(s, i); }, i * 260)));
    const character = group('CHARACTER');
    for (const skin of SKINS) {
      button(character, skin.name, () => this.characterSelection(skin), { requireAlive: false });
    }
    button(character, 'ALL', () => SKINS.forEach((skin, index) => setTimeout(() => this.characterSelection(skin), index * 240)), { requireAlive: false });
    const powers = group('POWER');
    for (const type of ['surge', 'magnet', 'vision', 'tracker', 'zoom', 'multiplier']) {
      button(powers, ({ surge: 'SPEED', vision: 'RADAR', multiplier: '5X' })[type] || type.toUpperCase(), () => this.powerUp(type));
    }
    const misc = group('OTHER');
    button(misc, 'CONTACT', () => this.contact());
    button(misc, 'EXPIRE ALL', () => this.expireAll());
    document.body.appendChild(panel);
  }

  /** A stand-in attacker/victim near the player (presentation only). */
  dummy(skin, dx = 140, dy = 0) {
    const p = this.game.player;
    return {
      character: skin, hue: skin.territory ? skin.territory.hue : 180, isPlayer: false, alive: true,
      x: p.x + dx, y: p.y + dy, radius: 32, displayRadius: 32, slot: 0,
    };
  }

  slice(skin, index = 0) {
    const p = this.game.player;
    const dx = 140 + (index % 3) * 60;
    const d = this.dummy(skin, dx, -40 + (index % 2) * 80);
    this.game.events.emit(GameEvent.TRAIL_SLICED, { cutter: d, victim: d, x: p.x + dx, y: p.y - 30 + (index % 2) * 60, heading: -0.4 + index * 0.3 });
  }

  eliminate(skin) {
    const d = this.dummy(skin, 150, 0);
    this.game.combat.playVictim({ victim: d, x: d.x, y: d.y });
  }

  characterSelection(skin) {
    const audio = this.game.skinPicker && this.game.skinPicker.characterAudio;
    if (!audio) return;
    this.game.audio.unlock();
    audio.playSelection(skin.id, { force: true });
  }

  powerUp(type) {
    const p = this.game.player;
    if (!p.alive) return;
    p.applyPowerUp(type);
    this.game.activePowerUpIds.add(type);
    this.game.events.emit(GameEvent.POWERUP_ACTIVATED, { creature: p, type, x: p.x, y: p.y });
  }

  contact() {
    const p = this.game.player;
    const d = this.dummy(SKINS[1], 40, 0);
    this.game.events.emit(GameEvent.PLAYER_COLLISION, { a: p, b: d, x: p.x + 22, y: p.y, strength: 0.6 });
  }

  expireAll() {
    const p = this.game.player;
    for (const type of ['surge', 'magnet', 'vision', 'multiplier']) {
      const key = type === 'surge' ? 'surgeTime' : `${type}Time`;
      if (p[key] > 0) p[key] = 0.0001;
    }
  }
}
