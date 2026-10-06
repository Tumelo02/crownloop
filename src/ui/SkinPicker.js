import { drawCreatureIcon } from '../render/CreatureRenderer.js';
import { SKINS } from '../progression/skins.js';
import { DEV_UNLOCK_ALL_CHARACTERS } from '../config.js';
import { CharacterAudioSystem } from '../audio/characterAudio.js';
import { STORE_INFO } from '../progression/storeInfo.js';

const ICON_PX = 56;
const CARD_ICON_PX = 76;
const priceOf = (skin) => (skin.unlock.type === 'coins' ? skin.unlock.cost : 0);
// Store order: cheapest (Common) to most expensive (Legendary).
const BY_PRICE = Object.freeze([...SKINS].sort((a, b) => priceOf(a) - priceOf(b)));

/**
 * Character picker with a live preview from the 2D creature renderer. Can be mounted in
 * several screens; every copy re-renders when progress changes. A container with
 * data-layout="cards" (the store) gets full cards: description, element edge and
 * trade-off, price, and an EQUIP / UNLOCK action.
 */
export class SkinPicker {
  /**
   * @param {HTMLElement[]} containers
   * @param {import('../progression/PlayerProgress.js').PlayerProgress} progress
   */
  constructor(containers, progress, audio = null, eventBus = null) {
    this.progress = progress;
    this.audio = audio;
    this.characterAudio = audio ? new CharacterAudioSystem(audio, eventBus) : null;
    this.views = containers.map((root) => this.build(root));
    progress.onChange(() => this.render());
    this.render();
    if (DEV_UNLOCK_ALL_CHARACTERS) window.addEventListener('keydown', (event) => this.handleCycleKey(event));
  }

  build(root) {
    if (root.dataset.layout === 'cards') return this.buildCards(root);
    const chips = SKINS.map((skin) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'skin-chip';
      const canvas = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.height = ICON_PX * dpr;
      canvas.style.width = canvas.style.height = `${ICON_PX}px`;
      const name = document.createElement('span');
      name.className = 'skin-name';
      name.textContent = skin.name;
      const identity = document.createElement('span');
      identity.className = 'skin-element';
      identity.textContent = `${skin.element} · ${skin.rarity}`;
      const status = document.createElement('span');
      status.className = 'skin-status';
      button.append(canvas, name, identity, status);
      button.addEventListener('click', () => this.choose(skin));
      root.appendChild(button);

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const silhouette = new URLSearchParams(window.location.search).has('silhouette');
      drawCreatureIcon(
        ctx, skin.look, ICON_PX / 2, ICON_PX / 2 + 2, ICON_PX * 0.3, 1, 0, skin, { silhouette },
      );
      return { skin, button, status, canvas };
    });
    return { root, chips };
  }

  buildCards(root) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const chips = BY_PRICE.map((skin) => {
      const info = STORE_INFO[skin.id] || {};
      const card = el('article', `store-card rarity-${skin.rarity.toLowerCase()}`);
      card.style.setProperty('--accent', skin.palette.primary);
      const canvas = document.createElement('canvas');
      canvas.className = 'store-preview';
      canvas.width = canvas.height = CARD_ICON_PX * dpr;
      canvas.style.width = canvas.style.height = `${CARD_ICON_PX}px`;
      const head = el('div', 'store-card-head');
      head.append(el('h3', 'store-name', skin.name), el('span', 'store-identity', `${skin.element} · ${skin.rarity}`));
      const traits = el('ul', 'store-traits');
      const edge = el('li', 'store-edge');
      edge.append(el('span', 'store-trait-tag', 'STRENGTH'), document.createTextNode(info.edge || ''));
      const trade = el('li', 'store-tradeoff');
      trade.append(el('span', 'store-trait-tag', 'WEAKNESS'), document.createTextNode(info.tradeoff || ''));
      traits.append(edge, trade);
      const cost = priceOf(skin);
      const foot = el('div', 'store-card-foot');
      const price = el('span', 'store-price');
      if (skin.id === this.progress.starterSkin) {
        price.textContent = 'YOUR STARTER';
      } else if (cost > 0) {
        const coin = el('canvas', 'coin-icon');
        coin.setAttribute('aria-hidden', 'true');
        price.append(coin, document.createTextNode(cost.toLocaleString()));
      } else {
        price.textContent = 'STARTER';
      }
      const action = el('button', 'store-action');
      action.type = 'button';
      action.addEventListener('click', () => this.choose(skin));
      foot.append(price, action);
      card.append(canvas, head, el('p', 'store-description', info.description || ''), traits, foot);
      root.appendChild(card);

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCreatureIcon(ctx, skin.look, CARD_ICON_PX / 2, CARD_ICON_PX / 2 + 2, CARD_ICON_PX * 0.3, 1, 0, skin);
      return { skin, button: card, status: action, canvas };
    });
    return { root, chips, cards: true };
  }

  handleCycleKey(event) {
    if ((event.key !== '[' && event.key !== ']')
      || (event.target instanceof HTMLElement
        && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
    if (!this.views.some(({ root }) => root.getClientRects().length > 0)) return;
    const index = SKINS.findIndex((skin) => skin.id === this.progress.selectedSkin);
    const direction = event.key === ']' ? 1 : -1;
    const next = (index + direction + SKINS.length) % SKINS.length;
    const nextSkin = SKINS[next];
    const previousSkinId = this.progress.selectedSkin;
    const changed = this.progress.selectSkin(nextSkin.id);
    if (changed && this.characterAudio && nextSkin.id !== previousSkinId) {
      this.characterAudio.playSelection(nextSkin.id);
    }
  }

  choose(skin) {
    const previousSkinId = this.progress.selectedSkin;
    const isUnlocked = this.progress.isUnlocked(skin.id);
    const changed = isUnlocked ? this.progress.selectSkin(skin.id) : this.progress.unlockSkin(skin.id);
    if (changed && this.characterAudio && skin.id !== previousSkinId) {
      this.characterAudio.playSelection(skin.id);
    }
    this.render();
  }

  render() {
    const { progress } = this;
    for (const view of this.views) {
      for (const { skin, button, status } of view.chips) {
        const owned = progress.isUnlocked(skin.id);
        const selected = progress.selectedSkin === skin.id;
        const cost = skin.unlock.type === 'coins' ? skin.unlock.cost : 0;
        const affordable = progress.coins >= cost;
        button.classList.toggle('selected', selected);
        button.classList.toggle('locked', !owned);
        button.classList.toggle('affordable', !owned && affordable);
        if (view.cards) {
          status.textContent = selected ? 'EQUIPPED' : owned ? 'EQUIP' : affordable ? 'UNLOCK' : `NEED ${(cost - progress.coins).toLocaleString()} MORE`;
          status.disabled = selected || (!owned && !affordable);
          button.classList.toggle('owned', owned);
          continue;
        }
        button.setAttribute('aria-pressed', String(selected));
        status.textContent = selected ? 'EQUIPPED' : owned ? 'SELECT' : affordable ? `UNLOCK ◎${cost}` : `◎${cost}`;
        button.title = owned ? skin.name : `${skin.name}: ${cost} coins (store)`;
      }
    }
  }
}
