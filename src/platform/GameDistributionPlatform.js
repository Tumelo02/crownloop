import { CrazyGamesPlatform } from './CrazyGamesPlatform.js';

/** GameDistribution game ID (Developer Portal → the game → UPLOAD tab). */
export const GD_GAME_ID = '27f0b6a651fa4d2487940b39194abb78';

const SDK_READY_TIMEOUT_MS = 4000; // never let a slow/blocked SDK keep the game from starting
const AD_FAILSAFE_MS = 75000; // an ad that never reports back must not leave the game stuck
// Break ads (PLAY / PLAY AGAIN / REJOIN) at most this often; the first PLAY always asks.
const BREAK_AD_GAP_MS = 3 * 60 * 1000;

function logPlatformError(action, error) {
  console.error(`GameDistribution ${action} failed`, error);
}

/**
 * GameDistribution build. GD_OPTIONS and the SDK loader live in the build's index.html (the SDK
 * must load with the page, never on a click); their onEvent pushes into window.__gdEvents and
 * calls window.__gdListener, which this class takes over. GameDistribution's rules: ads only
 * after a player's tap, never during gameplay, with the game paused and muted while one plays.
 * Progress is saved in the browser (GameDistribution has no cloud save). Everything
 * CrazyGames-only (account, friends, leaderboard) stays off because there is no CrazyGames SDK.
 */
export class GameDistributionPlatform extends CrazyGamesPlatform {
  constructor() {
    super(null);
    this.gdReady = false;
    this.adsEnabled = true;
    this.lastBreakAdAt = -Infinity;
    this.breakAdsShown = 0;
    this.rewardWatched = false;
    this.pauseHandler = null;
    this.resumeHandler = null;
    this.readyWaiters = [];
    const queued = window.__gdEvents || [];
    window.__gdListener = (event) => this.onSdkEvent(event);
    for (const event of queued) this.onSdkEvent(event);
  }

  get gdsdk() {
    return window.gdsdk && typeof window.gdsdk.showAd === 'function' ? window.gdsdk : null;
  }

  async initialize() {
    if (this.gdReady) return true;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, SDK_READY_TIMEOUT_MS);
      this.readyWaiters.push(() => { clearTimeout(timer); resolve(); });
    });
    return this.gdReady;
  }

  onSdkEvent(event) {
    const name = event && event.name;
    switch (name) {
      case 'SDK_READY':
        this.gdReady = true;
        for (const done of this.readyWaiters.splice(0)) done();
        break;
      case 'SDK_GAME_PAUSE':
        // An ad is starting: pause the game and mute it.
        this.adAudioMuted = true;
        this.applyPlatformMute();
        this.pauseHandler?.();
        break;
      case 'SDK_GAME_START':
        // The ad is over: unmute and carry on.
        this.adAudioMuted = false;
        this.applyPlatformMute();
        this.resumeHandler?.();
        break;
      case 'SDK_REWARDED_WATCH_COMPLETE':
        this.rewardWatched = true;
        break;
      default:
        break;
    }
  }

  /** The game's pause/resume, used while an ad plays. */
  bindPause(pause, resume) {
    this.pauseHandler = pause;
    this.resumeHandler = resume;
  }

  // No CrazyGames SDK here: these are deliberately inert.
  loadingStart() {}
  loadingStop() {}
  gameplayStart() {}
  gameplayStop() {}

  /** The respawn screen's automatic ad: never here (GameDistribution ads need a tap). */
  requestMidgameAd() {
    return false;
  }

  /**
   * A break ad before PLAY / PLAY AGAIN / REJOIN (always called from that button's click).
   * `then` runs once the ad is over, or right away when no ad is due or the SDK is missing.
   */
  showBreakAd(then) {
    const sdk = this.gdsdk;
    const now = performance.now();
    const due = this.breakAdsShown === 0 || now - this.lastBreakAdAt >= BREAK_AD_GAP_MS;
    if (!sdk || !this.gdReady || !due || this.adRequestPending) {
      then();
      return;
    }
    this.breakAdsShown++;
    this.lastBreakAdAt = now;
    this.runAd(() => sdk.showAd(), () => then());
  }

  get canRequestRewardedAd() {
    return Boolean(this.gdsdk && this.gdReady && !this.adRequestPending);
  }

  /** Rewarded ad: 'finished' only when GameDistribution says it was watched to the end. */
  requestRewardedAd(onComplete) {
    const sdk = this.gdsdk;
    if (!sdk || !this.gdReady || this.adRequestPending) return false;
    this.rewardWatched = false;
    this.runAd(() => sdk.showAd('rewarded'), () => onComplete?.(this.rewardWatched ? 'finished' : 'error'));
    return true;
  }

  /** Shows one ad and calls `done` exactly once when it has finished (or failed). */
  runAd(show, done) {
    this.adRequestPending = true;
    let finished = false;
    let failsafe = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(failsafe);
      this.adRequestPending = false;
      if (this.adAudioMuted) {
        this.adAudioMuted = false;
        this.applyPlatformMute();
      }
      done();
    };
    failsafe = setTimeout(finish, AD_FAILSAFE_MS);
    try {
      const request = show();
      if (request && typeof request.then === 'function') {
        request.then(finish, (error) => {
          logPlatformError('ad', error);
          finish();
        });
      } else {
        finish();
      }
    } catch (error) {
      logPlatformError('ad', error);
      finish();
    }
  }
}
