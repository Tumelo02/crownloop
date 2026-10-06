import { showMenuToast } from './MenuPanels.js';

/**
 * Share Crownloop with friends: the CrazyGames invite link (on CrazyGames) or this page's
 * address. Phones get the system share sheet; elsewhere the link is copied to the clipboard.
 */
export async function shareGame(platform) {
  const url = platform?.inviteLink ? platform.inviteLink() : `${window.location.origin}${window.location.pathname}`;
  const text = 'Loop the land, cut the trails, take the crown. Play Crownloop with me!';
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Crownloop', text, url });
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return; // the player closed the share sheet
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showMenuToast('INVITE LINK COPIED · send it to your friends');
  } catch {
    showMenuToast(`SHARE THIS LINK · ${url}`, 7000);
  }
}
