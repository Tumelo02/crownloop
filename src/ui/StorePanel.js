import { FLOORS, currentFloor, setFloor } from '../render/floorThemes.js';
import { ADS_ENABLED } from '../config.js';
import { AD_COINS, POWER_UP_ITEMS } from '../progression/storeCatalog.js';
import { paintCoinIcon } from '../render/coinSprite.js';
import { powerUpIcon } from './icons.js';
import { showMenuToast } from './MenuPanels.js';

const TAU = Math.PI * 2;

/**
 * The STORE button (top-left of the menu) opens the store, in sections:
 *   CHARACTERS  preview, description, element edge + trade-off, price (cards by SkinPicker)
 *   GALAXIES    the arena floor themes ("galaxies" to players): preview, price, EQUIP / UNLOCK
 *   POWER-UPS   consumable charges: buy, then set one to fire when your next life starts
 *   COINS       +250 coins for a rewarded ad (a few a day, timer between), plus links to the
 *               free ways to earn (daily wheel, missions). The + beside the menu coins opens it.
 * Everything is paid in coins earned by playing. Closes only with its X (never by a click on
 * the dimmed backdrop.
 */
export class StorePanel {
  /**
   * @param {import('../audio/AudioManager.js').AudioManager} audio
   * @param {{ toggle: (open: boolean) => void } | null} settings closed when the store opens
   * @param {import('../progression/PlayerProgress.js').PlayerProgress} progress
   * @param {object} [platform] CrazyGames wrapper (rewarded ads)
   */
  constructor(audio, settings, progress, platform = null) {
    this.audio = audio;
    this.settings = settings;
    this.progress = progress;
    this.platform = platform;
    this.adBusy = false;
    this.button = document.getElementById('store-button');
    this.modal = document.getElementById('store-modal');
    this.close = document.getElementById('store-close');
    if (!this.button || !this.modal) return;

    this.tabs = [...this.modal.querySelectorAll('[data-store-tab]')];
    this.sections = [...this.modal.querySelectorAll('[data-store-section]')];
    for (const tab of this.tabs) tab.addEventListener('click', () => this.show(tab.dataset.storeTab));
    this.buildFloors(document.getElementById('store-floors'));
    this.buildPowerUps(document.getElementById('store-powerups'));
    this.buildCoins();
    progress.onChange(() => this.render());
    this.render();

    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle(true);
    });
    // Closes only with its X: clicking outside the sheet never closes it.
    this.close.addEventListener('click', () => this.toggle(false));
    // The + beside the menu coins: straight to Store > Coins.
    document.getElementById('coins-plus')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle(true);
      this.show('coins');
    });
  }

  get isOpen() {
    return Boolean(this.modal) && !this.modal.classList.contains('hidden');
  }

  toggle(open) {
    if (open === this.isOpen) return;
    this.audio.unlock();
    this.audio.play('click');
    if (open && this.settings) this.settings.toggle(false);
    this.modal.classList.toggle('hidden', !open);
    this.button.setAttribute('aria-expanded', String(open));
    // The ad timer counts down while the store is open.
    clearInterval(this.timer);
    if (open) {
      this.renderCoins();
      this.timer = setInterval(() => this.renderCoins(), 1000);
    }
    if (open) (this.tabs.find((t) => t.classList.contains('active')) || this.close).focus();
  }

  /** Switch section (characters / floors / powerups / coins). */
  show(id) {
    for (const tab of this.tabs) {
      const on = tab.dataset.storeTab === id;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
    }
    for (const section of this.sections) section.hidden = section.dataset.storeSection !== id;
    this.audio.play('click');
  }

  // ------------------------------------------------------------ floors

  buildFloors(root) {
    if (!root) return;
    this.floorCards = FLOORS.map((floor) => {
      const card = el('article', 'store-card store-floor-card');
      card.style.setProperty('--accent', `hsl(${floor.haze[0]}, 70%, 60%)`);
      const preview = document.createElement('canvas');
      preview.className = 'store-floor-preview';
      paintFloorPreview(preview, floor);
      const head = el('div', 'store-card-head');
      head.append(el('h3', 'store-name', floor.name), el('span', 'store-identity', floor.dark ? 'DARK GALAXY' : 'LIGHT GALAXY'));
      const foot = el('div', 'store-card-foot');
      const action = el('button', 'store-action');
      action.type = 'button';
      action.addEventListener('click', () => this.chooseFloor(floor));
      foot.append(priceTag(floor.price, 'FREE'), action);
      card.append(preview, head, foot);
      root.appendChild(card);
      return { floor, card, action };
    });
  }

  chooseFloor(floor) {
    const owned = this.progress.isFloorUnlocked(floor.id);
    if (!owned && !this.progress.unlockFloor(floor.id)) return;
    setFloor(floor.id);
    this.audio.play('click');
    this.render();
  }

  // ------------------------------------------------------------ power-ups

  buildPowerUps(root) {
    if (!root) return;
    this.powerUpCards = POWER_UP_ITEMS.map((item) => {
      const card = el('article', 'store-card store-powerup-card');
      card.style.setProperty('--accent', `hsl(${item.hue}, 90%, 62%)`);
      const icon = powerUpIcon(item.id, `store-powerup-icon powerup-${item.id}`);
      const head = el('div', 'store-card-head');
      const owned = el('span', 'store-owned');
      head.append(el('h3', 'store-name', item.name), owned);
      const traits = el('ul', 'store-traits');
      const effect = el('li', 'store-edge');
      effect.append(el('span', 'store-trait-tag', 'EFFECT'), document.createTextNode(item.effect));
      traits.append(effect);
      const foot = el('div', 'store-card-foot');
      const actions = el('div', 'store-actions');
      const buy = el('button', 'store-action store-buy');
      buy.type = 'button';
      buy.addEventListener('click', () => {
        if (this.progress.buyPowerUp(item.id)) this.audio.play('click');
      });
      actions.append(buy);
      foot.append(priceTag(item.price), actions);
      card.append(icon, head, el('p', 'store-description', item.description), traits, foot);
      root.appendChild(card);
      return { item, card, owned, buy };
    });
  }

  // ------------------------------------------------------------ coins

  buildCoins() {
    this.adButton = document.getElementById('ad-coins-watch');
    this.adLabel = document.getElementById('ad-coins-label');
    this.adStatus = document.getElementById('ad-coins-status');
    if (!this.adButton) return;
    if (!ADS_ENABLED && !this.platform?.adsEnabled) {
      // Basic Launch: no ads at all, so no ad offer. The free ways to earn stay.
      this.adButton.closest('.coin-offer')?.remove();
      this.adButton = null;
      const note = this.modal.querySelector('[data-store-section="coins"] .store-section-note');
      if (note) note.textContent = 'Coins are earned by playing. Here are more ways to earn them, free.';
    }
    for (const coin of this.modal.querySelectorAll('.coin-offer-art .coin-icon')) paintCoinIcon(coin, 56);
    this.adButton?.addEventListener('click', () => this.watchAd());
    // Other ways to earn: close the store and open the wheel / missions.
    for (const link of this.modal.querySelectorAll('[data-open]')) {
      link.addEventListener('click', () => {
        this.toggle(false);
        document.getElementById(link.dataset.open)?.click();
      });
    }
    this.renderCoins();
  }

  /** Rewarded ad: only an ad that finished pays (an error or a skipped ad never does). */
  watchAd() {
    const { left, waitMs } = this.progress.adCoinsStatus();
    if (this.adBusy || left <= 0 || waitMs > 0 || !this.platform?.canRequestRewardedAd) return;
    this.adBusy = true;
    this.adError = '';
    this.renderCoins();
    const asked = this.platform.requestRewardedAd((result) => {
      this.adBusy = false;
      const paid = result === 'finished' ? this.progress.grantAdCoins() : 0;
      if (paid) {
        this.audio.play('rankUp');
        showMenuToast(`THANKS FOR WATCHING · +${paid} coins`);
      } else {
        this.adError = 'No ad is available right now. Try again in a little while.';
      }
      this.renderCoins();
    });
    if (!asked) {
      this.adBusy = false;
      this.renderCoins();
    }
  }

  renderCoins() {
    if (!this.adButton) return;
    const { left, waitMs } = this.progress.adCoinsStatus();
    const adsReady = Boolean(this.platform?.canRequestRewardedAd);
    let label = `WATCH AD · +${AD_COINS.AMOUNT}`;
    let status = `${left} of ${AD_COINS.PER_DAY} left today`;
    let disabled = false;
    if (this.adBusy) {
      label = 'LOADING AD…';
      disabled = true;
    } else if (left <= 0) {
      label = 'COME BACK TOMORROW';
      status = 'All 5 used today';
      disabled = true;
    } else if (waitMs > 0) {
      const s = Math.ceil(waitMs / 1000);
      label = `NEXT AD IN ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      disabled = true;
    } else if (!adsReady) {
      label = 'NO ADS RIGHT NOW';
      status = 'Ads are not available here';
      disabled = true;
    }
    if (this.adError && !this.adBusy) status = this.adError;
    this.adLabel.textContent = label;
    this.adButton.disabled = disabled;
    this.adStatus.textContent = status;
  }

  // ------------------------------------------------------------ state

  render() {
    const p = this.progress;
    this.renderCoins();
    const floorId = currentFloor().id;
    for (const { floor, card, action } of this.floorCards || []) {
      const owned = p.isFloorUnlocked(floor.id);
      const equipped = floor.id === floorId;
      const affordable = p.coins >= floor.price;
      card.classList.toggle('selected', equipped);
      card.classList.toggle('locked', !owned);
      action.textContent = equipped ? 'EQUIPPED' : owned ? 'EQUIP' : affordable ? 'UNLOCK' : `NEED ${(floor.price - p.coins).toLocaleString()} MORE`;
      action.disabled = equipped || (!owned && !affordable);
    }
    for (const { item, owned, buy } of this.powerUpCards || []) {
      const count = p.powerUpCount(item.id);
      owned.textContent = count > 0 ? `OWNED ×${count}` : 'NONE OWNED';
      owned.classList.toggle('has', count > 0);
      const affordable = p.coins >= item.price;
      buy.textContent = affordable ? 'BUY' : `NEED ${(item.price - p.coins).toLocaleString()}`;
      buy.disabled = !affordable;
    }
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function priceTag(price, freeLabel = 'FREE') {
  const tag = el('span', 'store-price');
  if (price > 0) {
    const coin = el('canvas', 'coin-icon');
    coin.setAttribute('aria-hidden', 'true');
    paintCoinIcon(coin);
    tag.append(coin, document.createTextNode(price.toLocaleString()));
  } else {
    tag.textContent = freeLabel;
  }
  return tag;
}

/** A small view of the floor: base, haze pools, the cell circles and a scalloped domain. */
function paintFloorPreview(canvas, floor) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = 240;
  const h = 96;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = '100%';
  canvas.style.aspectRatio = `${w} / ${h}`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = floor.base;
  ctx.fillRect(0, 0, w, h);
  floor.haze.forEach((hue, i) => {
    const x = [50, 170, 120][i];
    const y = [30, 70, 20][i];
    const g = ctx.createRadialGradient(x, y, 0, x, y, 70);
    g.addColorStop(0, `hsla(${hue}, ${floor.hazeSat}%, ${floor.hazeLight}%, ${floor.hazeAlpha * 1.6})`);
    g.addColorStop(1, `hsla(${hue}, ${floor.hazeSat}%, ${floor.hazeLight}%, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const cell = 16;
  ctx.strokeStyle = floor.cell;
  ctx.lineWidth = 1;
  for (let y = cell / 2; y < h; y += cell) {
    for (let x = cell / 2; x < w; x += cell) {
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.4, 0, TAU);
      ctx.stroke();
    }
  }
  // A small scalloped domain, so you see how land sits on this floor.
  const cells = [[9, 2], [10, 2], [8, 3], [9, 3], [10, 3], [11, 3], [9, 4], [10, 4], [11, 4]];
  const hue = 172;
  const union = (radius) => {
    const path = new Path2D();
    for (const [c, r] of cells) {
      path.moveTo(c * cell + cell / 2 + radius, r * cell + cell / 2);
      path.arc(c * cell + cell / 2, r * cell + cell / 2, radius, 0, TAU);
    }
    return path;
  };
  // Border = a slightly larger union underneath; then the floor and the tint on top.
  ctx.fillStyle = `hsla(${hue}, 90%, ${floor.dark ? 68 : 44}%, 0.95)`;
  ctx.fill(union(cell * 0.62 + 1.5));
  const inner = union(cell * 0.62);
  ctx.fillStyle = floor.base;
  ctx.fill(inner);
  ctx.fillStyle = `hsla(${hue}, 80%, 54%, ${floor.dark ? 0.4 : 0.3})`;
  ctx.fill(inner);
}
