/**
 * The name on the start screen, CrazyGames-style:
 *   - logged-in CrazyGames player: their CrazyGames username + avatar, not editable
 *     ("PLAYING AS"); updates live when they log in.
 *   - CrazyGames guest: a generated name, not editable, and a LOG IN button that opens
 *     CrazyGames' own log-in popup (their username is used from then on).
 *   - anywhere else (local development, other sites): the old editable name field.
 */
export class AccountName {
  /**
   * @param {object} platform CrazyGamesPlatform
   * @param {(name: string) => void} onName called whenever the account name changes
   */
  constructor(platform, onName) {
    this.platform = platform;
    this.onName = onName;
    this.field = document.querySelector('.name-field');
    this.label = this.field?.querySelector('.name-label');
    this.input = document.getElementById('player-name');
    this.avatar = document.getElementById('player-avatar');
    this.login = document.getElementById('player-login');
    this.user = null;
    if (!this.field || !this.input || !platform?.onCrazyGames) return; // editable field stays
    this.input.readOnly = true;
    this.input.tabIndex = -1;
    this.field.classList.add('account');
    this.login?.addEventListener('click', async (e) => {
      e.preventDefault();
      const user = await platform.showLogin();
      if (user) this.setUser(user);
    });
    platform.onLogin((user) => this.setUser(user));
    this.showGuest();
    platform.getUser().then((user) => { if (user) this.setUser(user); });
  }

  /** Account names are fixed: the start screen never overwrites them with a typed name. */
  get locked() {
    return Boolean(this.platform?.onCrazyGames);
  }

  showGuest() {
    if (this.label) this.label.textContent = 'PLAYING AS GUEST';
    if (this.login) this.login.hidden = typeof this.platform.sdk?.user?.showAuthPrompt !== 'function';
    if (this.avatar) this.avatar.hidden = true;
  }

  setUser(user) {
    this.user = user;
    if (this.label) this.label.textContent = 'PLAYING AS';
    if (this.login) this.login.hidden = true;
    this.input.value = user.username;
    if (this.avatar && user.avatar) {
      this.avatar.src = user.avatar;
      this.avatar.hidden = false;
    }
    this.onName(user.username);
  }
}
