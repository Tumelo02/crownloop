import { ADS_ENABLED } from '../config.js';
/** Time zone -> country for the most common zones (fallback when the SDK has no country). */
const TIMEZONE_COUNTRY = Object.freeze({
  'Africa/Johannesburg': 'ZA', 'Africa/Maseru': 'LS', 'Africa/Mbabane': 'SZ', 'Africa/Gaborone': 'BW',
  'Africa/Windhoek': 'NA', 'Africa/Harare': 'ZW', 'Africa/Maputo': 'MZ', 'Africa/Lusaka': 'ZM',
  'Africa/Lagos': 'NG', 'Africa/Accra': 'GH', 'Africa/Nairobi': 'KE', 'Africa/Cairo': 'EG',
  'Africa/Casablanca': 'MA', 'Africa/Algiers': 'DZ', 'Africa/Tunis': 'TN', 'Africa/Addis_Ababa': 'ET',
  'Africa/Dar_es_Salaam': 'TZ', 'Africa/Kampala': 'UG', 'Africa/Kinshasa': 'CD', 'Africa/Luanda': 'AO',
  'Africa/Abidjan': 'CI', 'Africa/Dakar': 'SN', 'Africa/Kigali': 'RW',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES', 'Europe/Lisbon': 'PT', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Sofia': 'BG',
  'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR', 'Europe/Kiev': 'UA', 'Europe/Kyiv': 'UA',
  'Europe/Moscow': 'RU', 'Europe/Belgrade': 'RS', 'Europe/Zagreb': 'HR',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Phoenix': 'US',
  'America/Los_Angeles': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA',
  'America/Halifax': 'CA', 'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR', 'America/Manaus': 'BR',
  'America/Argentina/Buenos_Aires': 'AR', 'America/Buenos_Aires': 'AR', 'America/Santiago': 'CL',
  'America/Bogota': 'CO', 'America/Lima': 'PE', 'America/Caracas': 'VE', 'America/Montevideo': 'UY',
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD',
  'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Jakarta': 'ID',
  'Asia/Manila': 'PH', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA', 'Asia/Tehran': 'IR', 'Asia/Jerusalem': 'IL', 'Asia/Baghdad': 'IQ',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU', 'Pacific/Auckland': 'NZ',
});

const SDK_INIT_TIMEOUT_MS = 4000; // never let a slow/unreachable SDK keep the game from starting

/**
 * CrazyGames leaderboard (invite-only; one per game). Paste the 32-byte base64 Encryption Key
 * from the Developer Portal here once the leaderboard is enabled. Empty = scores are not sent.
 * Score = best match score (POINTS, DESC, not incremental).
 */
export const LEADERBOARD_ENCRYPTION_KEY = '';

async function encryptScore(score, encryptionKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const algorithm = { name: 'AES-GCM', iv };
  const keyBytes = new Uint8Array(atob(encryptionKey).split('').map((c) => c.charCodeAt(0)));
  const cryptoKey = await window.crypto.subtle.importKey('raw', keyBytes, algorithm, false, ['encrypt']);
  const data = new TextEncoder().encode(score.toString());
  const encrypted = await window.crypto.subtle.encrypt(algorithm, cryptoKey, data);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

function logPlatformError(action, error) {
  console.error(`CrazyGames ${action} failed`, error);
}

export class CrazyGamesPlatform {
  constructor(platform = window.CrazyGames) {
    this.platform = platform;
    this.sdk = null;
    this.audio = null;
    this.progressStorage = window.localStorage;
    this.settingsListener = null;
    this.progressWarningShown = false;
    this.allowLegacyMigration = false;
    this.requiresMouseLock = false;
    this.settingsMuted = false;
    this.adAudioMuted = false;
    this.adRequestPending = false;
  }

  async initialize() {
    const sdk = this.platform && this.platform.SDK;
    if (!sdk || typeof sdk.init !== 'function') return false;

    try {
      let timer = 0;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${SDK_INIT_TIMEOUT_MS} ms`)), SDK_INIT_TIMEOUT_MS);
      });
      try {
        await Promise.race([sdk.init(), timeout]);
      } finally {
        clearTimeout(timer);
      }
      if (!['local', 'crazygames'].includes(sdk.environment)) return false;
      this.sdk = sdk;
      this.requiresMouseLock = sdk.environment === 'crazygames'
        && sdk.user?.systemInfo?.device?.type === 'desktop';
      this.allowLegacyMigration = sdk.environment === 'local';
      if (sdk.environment === 'crazygames' && sdk.user && typeof sdk.user.getUser === 'function') {
        try {
          this.allowLegacyMigration = !(await sdk.user.getUser());
        } catch (error) {
          logPlatformError('user lookup for progress migration', error);
        }
      }
      this.progressStorage = this.createProgressStorage(sdk.data, this.allowLegacyMigration);
      return true;
    } catch (error) {
      logPlatformError('SDK initialization', error);
      return false;
    }
  }

  /**
   * Two-letter country of the player: CrazyGames system info, else the device's time zone
   * (a South African phone set to "en-US" is still in Africa/Johannesburg), else the locale.
   */
  get countryCode() {
    // Only the live CrazyGames site reports a real country (local test mode reports a placeholder).
    const fromSdk = this.sdk?.environment === 'crazygames' ? this.sdk?.user?.systemInfo?.countryCode : null;
    if (typeof fromSdk === 'string' && /^[A-Z]{2}$/i.test(fromSdk)) return fromSdk.toUpperCase();
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (zone && TIMEZONE_COUNTRY[zone]) return TIMEZONE_COUNTRY[zone];
    } catch {
      // no Intl time zone: fall through to the locale
    }
    const locale = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    const region = locale.split(/[-_]/)[1];
    return region && /^[A-Z]{2}$/i.test(region) ? region.toUpperCase() : null;
  }

  /** The CrazyGames username when the player is logged in, else null. */
  async getUsername() {
    try {
      const user = this.sdk?.user && typeof this.sdk.user.getUser === 'function' ? await this.sdk.user.getUser() : null;
      return user && user.username ? user.username : null;
    } catch (error) {
      logPlatformError('user lookup', error);
      return null;
    }
  }

  /** True on the live CrazyGames site (or its local test mode) with the SDK ready. */
  get onCrazyGames() {
    return Boolean(this.sdk);
  }

  /** The logged-in CrazyGames user ({ username, profilePictureUrl }) or null for guests. */
  async getUser() {
    try {
      const user = this.sdk?.user && typeof this.sdk.user.getUser === 'function' ? await this.sdk.user.getUser() : null;
      return user && user.username ? { username: user.username, avatar: user.profilePictureUrl || null } : null;
    } catch (error) {
      logPlatformError('user lookup', error);
      return null;
    }
  }

  /** Called with the new user when the player logs in on CrazyGames. */
  onLogin(listener) {
    try {
      this.sdk?.user?.addAuthListener?.((user) => {
        if (user && user.username) listener({ username: user.username, avatar: user.profilePictureUrl || null });
      });
    } catch (error) {
      logPlatformError('auth listener', error);
    }
  }

  /** CrazyGames' own log-in / register popup. Resolves to the user, or null if cancelled. */
  async showLogin() {
    try {
      const user = await this.sdk?.user?.showAuthPrompt?.();
      return user && user.username ? { username: user.username, avatar: user.profilePictureUrl || null } : null;
    } catch {
      return null;
    }
  }

  /** The player's CrazyGames friends ([{ username, avatar }]), or null when unavailable. */
  async listFriends() {
    if (typeof this.sdk?.user?.listFriends !== 'function') return null;
    try {
      const page = await this.sdk.user.listFriends({ page: 1, size: 50 });
      return (page?.friends || []).map((f) => ({ username: f.username, avatar: f.profilePictureUrl || null }));
    } catch (error) {
      logPlatformError('friends list', error);
      return null;
    }
  }

  /** A link to share: the CrazyGames invite link on CrazyGames, else this page's address. */
  inviteLink(params = { from: 'invite' }) {
    try {
      const link = this.sdk?.game?.inviteLink?.(params);
      if (typeof link === 'string' && link) return link;
    } catch (error) {
      logPlatformError('invite link', error);
    }
    return `${window.location.origin}${window.location.pathname}`;
  }

  /** Whether scores can be sent to the CrazyGames leaderboard right now. */
  get leaderboardEnabled() {
    return Boolean(LEADERBOARD_ENCRYPTION_KEY && this.sdk?.user && typeof this.sdk.user.submitScore === 'function');
  }

  /** Sends a match score to the CrazyGames leaderboard (no-op until the key is configured). */
  async submitScore(score) {
    if (!this.leaderboardEnabled || !(score > 0)) return false;
    try {
      const value = Math.floor(score);
      const encryptedScore = await encryptScore(value, LEADERBOARD_ENCRYPTION_KEY);
      this.sdk.user.submitScore({ encryptedScore, score: value });
      return true;
    } catch (error) {
      logPlatformError('leaderboard score submission', error);
      return false;
    }
  }

  bindAudio(audio) {
    this.audio = audio;
    if (!this.sdk || !this.sdk.game) return;
    try {
      this.applyAudioSetting(this.sdk.game.settings);
      if (typeof this.sdk.game.addSettingsChangeListener !== 'function') return;
      this.settingsListener = (nextSettings) => this.applyAudioSetting(nextSettings);
      this.sdk.game.addSettingsChangeListener(this.settingsListener);
    } catch (error) {
      logPlatformError('game settings setup', error);
    }
  }

  applyAudioSetting(settings) {
    if (settings && typeof settings.muteAudio === 'boolean') this.settingsMuted = settings.muteAudio;
    this.applyPlatformMute();
  }

  applyPlatformMute() {
    this.audio?.setPlatformMuted(this.settingsMuted || this.adAudioMuted);
  }

  requestMidgameAd(onComplete) {
    if (!ADS_ENABLED) return false;
    return this.requestAd('midgame', onComplete);
  }

  /** True when a rewarded ad can be asked for (the SDK is up and no ad is playing). */
  get canRequestRewardedAd() {
    return ADS_ENABLED && !this.adRequestPending && typeof this.sdk?.ad?.requestAd === 'function';
  }

  /**
   * Rewarded ad: onComplete('finished') means reward the player; 'error' (no fill, blocked,
   * closed early) means do NOT reward.
   */
  requestRewardedAd(onComplete) {
    if (!ADS_ENABLED) return false;
    return this.requestAd('rewarded', onComplete);
  }

  requestAd(type, onComplete) {
    const ad = this.sdk?.ad;
    if (this.adRequestPending || !ad || typeof ad.requestAd !== 'function') return false;

    this.adRequestPending = true;
    let completed = false;
    const complete = (result, error) => {
      if (completed) return;
      completed = true;
      this.adRequestPending = false;
      this.adAudioMuted = false;
      this.applyPlatformMute();
      if (result === 'error') logPlatformError(`${type} ad request`, error);
      onComplete?.(result);
    };

    try {
      const request = ad.requestAd(type, {
        adStarted: () => {
          if (completed) return;
          this.adAudioMuted = true;
          this.applyPlatformMute();
        },
        adFinished: () => complete('finished'),
        adError: (error) => complete('error', error),
      });
      if (request && typeof request.catch === 'function') {
        request.catch((error) => complete('error', error));
      }
      return true;
    } catch (error) {
      complete('error', error);
      return false;
    }
  }

  /** Optional SDK loading events: CrazyGames measures in-game loading time and fail rate. */
  loadingStart() {
    this.callGameMethod('loadingStart');
  }

  loadingStop() {
    this.callGameMethod('loadingStop');
  }

  gameplayStart() {
    this.callGameMethod('gameplayStart');
  }

  gameplayStop() {
    this.callGameMethod('gameplayStop');
  }

  callGameMethod(method) {
    if (!this.sdk || !this.sdk.game || typeof this.sdk.game[method] !== 'function') return;
    try {
      this.sdk.game[method]();
    } catch (error) {
      logPlatformError(`game.${method}`, error);
    }
  }

  createProgressStorage(data, allowLegacyMigration) {
    if (!data || typeof data.getItem !== 'function' || typeof data.setItem !== 'function') {
      console.error('CrazyGames Data module is unavailable; using browser-local progression storage.');
      return window.localStorage;
    }

    const local = window.localStorage;
    return {
      getItem: (key) => {
        try {
          const saved = data.getItem(key);
          if (saved !== null) return saved;
          if (!allowLegacyMigration) return null;
          const existing = local.getItem(key);
          if (existing !== null) data.setItem(key, existing);
          return existing;
        } catch (error) {
          this.warnProgressFallback('read', error);
          return local.getItem(key);
        }
      },
      setItem: (key, value) => {
        try {
          data.setItem(key, value);
          return;
        } catch (error) {
          this.warnProgressFallback('save', error);
        }
        try {
          local.setItem(key, value);
        } catch (error) {
          this.warnProgressFallback('browser-local fallback save', error);
          throw error;
        }
      },
      removeItem: (key) => {
        try {
          if (typeof data.removeItem === 'function') data.removeItem(key);
          local.removeItem(key);
        } catch (error) {
          this.warnProgressFallback('remove', error);
          local.removeItem(key);
        }
      },
    };
  }

  warnProgressFallback(action, error) {
    if (this.progressWarningShown) return;
    this.progressWarningShown = true;
    logPlatformError(`progress ${action}; falling back to browser-local storage`, error);
  }
}
