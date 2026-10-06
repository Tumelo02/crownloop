import { Game } from './core/Game.js';
import { CrazyGamesPlatform } from './platform/CrazyGamesPlatform.js';

async function startGame() {
  const platform = new CrazyGamesPlatform();
  await platform.initialize();
  platform.loadingStart();
  const game = new Game(document.getElementById('game'), {
    platform,
    progressStorage: platform.progressStorage,
  });
  platform.loadingStop(); // the menu is ready

  // `?debug` exposes the game instance for testing/tuning from the console.
  if (new URLSearchParams(window.location.search).has('debug')) {
    window.dominion = game;
  }
}

startGame().catch((error) => {
  console.error('Failed to start Crownloop.', error);
});
