import { Game } from './core/Game.js';
import { CrazyGamesPlatform } from './platform/CrazyGamesPlatform.js';
import { GameDistributionPlatform } from './platform/GameDistributionPlatform.js';

async function startGame() {
  // The GameDistribution build's index.html defines GD_OPTIONS; every other page is CrazyGames.
  const platform = window.GD_OPTIONS ? new GameDistributionPlatform() : new CrazyGamesPlatform();
  await platform.initialize();
  platform.loadingStart();
  const game = new Game(document.getElementById('game'), {
    platform,
    progressStorage: platform.progressStorage,
  });
  platform.loadingStop(); // the menu is ready
  hideLoader();

  // `?debug` exposes the game instance for testing/tuning from the console.
  if (new URLSearchParams(window.location.search).has('debug')) {
    window.dominion = game;
  }
}

/** Fades the loading screen out once the menu is fully built (next frame, so it is painted). */
function hideLoader() {
  const loader = document.getElementById('boot-loader');
  if (!loader) return;
  requestAnimationFrame(() => {
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 600);
  });
}

startGame().catch((error) => {
  console.error('Failed to start Crownloop.', error);
  const text = document.getElementById('boot-text');
  if (text) text.textContent = 'COULD NOT LOAD · PLEASE REFRESH THE PAGE';
});
