# Crownloop: CrazyGames submission (Basic Launch)

## Upload

1. `npm run package` → `crownloop-crazygames.zip` (index.html at the root, ~150 KB).
2. Upload the zip in the CrazyGames Developer Portal as an HTML5 game.
3. Supported devices: desktop + mobile. Orientation: both (the game adapts to portrait and landscape).

Before every upload, check `src/config.js`:

- `DEV_UNLOCK_ALL_CHARACTERS = false` (otherwise every character and galaxy is free)
- `ADS_ENABLED = false` for Basic Launch (CrazyGames disables ads then; the game shows no ad buttons).
  Set it to `true` only for Full Launch.

## Game description (draft, edit freely)

Crownloop: loop the land, cut the trails, take the crown. Leave your territory to draw a trail, loop back
home and everything inside becomes yours. While your trail is open you are exposed: any rival who touches
it takes you out, and you can cut theirs the same way. Hold the most land (at least 6% of the planet) to
wear the crown, but beware: if the King takes you out, your match is over. Unlock nine elemental
characters, spin the daily wheel, complete daily missions and invite your friends.

## Controls

- Desktop: mouse (or WASD / arrow keys) to steer · hold left click or Space to boost ·
  1–5 to use a stored power-up.
- Mobile: drag anywhere to steer with the joystick · hold the boost button · tap a power-up to use it.

## Requirements checklist

| Requirement | Status |
| --- | --- |
| Initial download ≤ 50 MB (≤ 20 MB for the mobile homepage), ≤ 1500 files | ~150 KB, 3 files |
| SDK + gameplayStart / gameplayStop (+ optional loadingStart / loadingStop) | done |
| Works with ads disabled; no rewarded-ad buttons without effect | `ADS_ENABLED = false` hides them all |
| Readable at 800x450, 821x462, 907x510, 1216x684, 1920x1080 | checked, no overlaps |
| Mouse, keyboard and touch | done |
| No custom fullscreen button, no external links, English, PEGI 12 | done |
| Progress saved via the CrazyGames Data module (localStorage outside CrazyGames) | done |
| iOS audio resumes on the next touch | done |
| CrazyGames username + avatar on the start screen; guests get a LOG IN button | done |
| Invite link (CrazyGames `inviteLink`), friends list (`listFriends`) | done |
| Readable at 1077x606, 1080x607, 1280x720, 1366x768, 1536x864 too | checked, no overlaps |
| No Escape key use; WASD follows the keyboard layout (AZERTY = ZQSD) | done |

## Still to do (yours)

- Game covers (images, and a short video if possible): required by the submission form.
- Later (Full Launch): leaderboard encryption key, `ADS_ENABLED = true`, and online multiplayer
  (needs a game server; then CrazyGames rooms/updateRoom and friends' scores).
