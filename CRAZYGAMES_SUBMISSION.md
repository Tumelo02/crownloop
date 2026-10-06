# Crownloop: CrazyGames submission guide (Basic Launch)

Everything you need for the CrazyGames Developer Portal (https://developer.crazygames.com), in the order the
form asks for it.

---

## 1. Files to upload

| What | File | Size |
| --- | --- | --- |
| Game build (HTML5 zip, `index.html` at the root) | `crownloop-crazygames.zip` | ~160 KB, 3 files |
| Cover: landscape 16:9 (mandatory) | `store-assets/cover-landscape-1920x1080.png` | 1920x1080 |
| Cover: portrait 2:3 (mandatory) | `store-assets/cover-portrait-800x1200.png` | 800x1200 |
| Cover: square 1:1 (mandatory) | `store-assets/cover-square-800x800.png` | 800x800 |
| Logo (extra, for socials/press) | `store-assets/logo-1024.png`, `store-assets/logo-icon-512.png` | transparent PNG |
| Screenshots (extra) | `store-assets/screenshots/1-menu.png` ... `6-knocked-out.png` | 1920x1080 |
| Preview video, landscape 1080p 16:9 (mandatory) | you record it, see section 5 | |
| Preview video, portrait 1080p 2:3 (mandatory) | you record it, see section 5 | |

Rebuild the zip after any code change: `npm run package` (writes `crownloop-crazygames.zip`).

---

## 2. Game details (copy and paste)

**Title:** Crownloop

**Short description (one line):**
Loop the land, cut the trails and take the crown in a 30-player territory war on an alien planet.

**Description:**
Crownloop is a territory war on an alien planet. Leave your land to draw a trail, loop back home and everything
inside becomes yours. But while your trail is open you are exposed: if a rival touches it, you are out, and you
can cut theirs the same way.

Hold the most land (at least 6% of the planet) to wear the crown. But be careful: if the King takes you out,
your match is over.

- 30 players per match: you against 29 AI rivals that grow empires, fight each other and hunt you down
- Three difficulty levels: Easy, Normal and Hard (a real war)
- Capture landmarks: the Bonus Tower doubles your points, the Energy Core fills your boost, the Teleporter
  takes you to your border, and the Slow Tower freezes your rivals
- Nine elemental characters, each with a real strength and weakness
- Power-ups, galaxies to unlock, a daily spin wheel, daily missions and a login streak
- Ranks from Beginner to Legendary, weekly and all-time stats

**Controls:**

- Desktop: move the mouse to steer (or WASD / arrow keys; ZQSD on AZERTY keyboards). Hold left click or Space
  to boost. Press 1-5 to use a power-up you bought. M mutes the sound.
- Mobile: drag anywhere to steer with the joystick. Hold the BOOST button to boost. Tap a power-up to use it.

**Category:** IO (alternative: Strategy / Snake-style)

**Tags (suggested):** io, territory, snake, strategy, king, casual, 2d

Don't call it a multiplayer game yet: the 29 rivals are AI. The description says "AI rivals", which is what
CrazyGames' quality rules expect.

**Orientation:** Both (landscape and portrait). The game adapts to any screen.
**Devices:** Desktop and mobile (tested at all CrazyGames iframe sizes and on Android).
**Language:** English.
**Age rating:** PEGI 12 (cartoon creatures, no blood, no real violence).
**Monetization:** None during Basic Launch (no ads, no purchases). Coins are earned by playing only.

---

## 3. Technical answers the form may ask

| Question | Answer |
| --- | --- |
| Engine | HTML5 / JavaScript (Canvas 2D), no engine |
| CrazyGames SDK integrated? | Yes (HTML5 SDK v3): `gameplayStart` / `gameplayStop`, `loadingStart` / `loadingStop`, Data module for saves, User module for the username / avatar / login prompt, invite link, friends list |
| Initial download size | ~160 KB (well under 20 MB, so eligible for the mobile homepage) |
| File count | 3 |
| Progress saving | CrazyGames Data module (falls back to the browser outside CrazyGames) |
| Ads | Not used in Basic Launch (`ADS_ENABLED = false`); no ad buttons are shown |
| External links / other logins | None |
| Fullscreen button in game | None (CrazyGames provides fullscreen) |
| Keys used | Mouse, WASD/arrows, Space, 1-5, M. Escape is never used |
| Works with AdBlock | Yes (no ads requested) |

---

## 4. Before every upload: check `src/config.js`

- `DEV_UNLOCK_ALL_CHARACTERS = false` (otherwise everything in the store is free)
- `ADS_ENABLED = false` for Basic Launch. Only set it to `true` for Full Launch (then the death-screen ad, the
  wheel's WATCH AD spin and the +250 coins ad offer appear).
- Then run `npm run package` and upload the new `crownloop-crazygames.zip`.

---

## 5. Recording the preview videos (your part)

CrazyGames rules:
- 15-20 seconds (longer is cut at 20 s), max 50 MB, **no sound**.
- Two versions: landscape 1920x1080 and portrait 1080x1620 (2:3).
- Start on the same picture as your cover (use the cover image as the very first frame).
- No black screens, no logo intros, no black bars, no "Play now" text, no social icons, no visible mouse cursor.
- Don't speed the video up (CrazyGames already speeds it up slightly).

Suggested shot list (about 18 s):
1. 0-2 s: the landscape cover as the first frame.
2. 2-7 s: a big loop closing and the land filling in (play on Normal, any galaxy).
3. 7-11 s: cutting a rival's trail (the CUT! / DOUBLE CUT! banner).
4. 11-15 s: capturing a landmark, e.g. the Slow Tower with snow and frozen rivals.
5. 15-18 s: becoming King (the crown landing on your character).

How to record: Windows key + G (Xbox Game Bar) records the browser window. Play in fullscreen (F11) so there
are no browser bars, and hide the cursor (move it to a screen edge while you steer with the keyboard). For the
portrait version, record on your phone or with a tall browser window, then crop to 1080x1620 in ClipChamp.
HandBrake converts the result to MP4 if needed.

---

## 6. Requirement checklist (all checked)

| Requirement | Status |
| --- | --- |
| Initial download <= 50 MB (<= 20 MB for the mobile homepage), <= 1500 files | ~160 KB, 3 files |
| SDK + gameplayStart / gameplayStop (never sent twice in a row) | done |
| Works with ads disabled; no ad buttons without effect | done |
| Readable at 800x450, 821x462, 907x510, 1077x606, 1080x607, 1216x684, 1280x720, 1366x768, 1536x864, 1920x1080 | checked, no overlaps |
| Mouse, keyboard and touch | done |
| Same speed on 60 / 144 / 165 Hz screens | done (time-based movement) |
| No custom fullscreen button, no external links, English, PEGI 12 | done |
| Progress saved via the CrazyGames Data module | done |
| CrazyGames username + avatar on the start screen; guests get a LOG IN button | done |
| Invite link (CrazyGames `inviteLink`), friends list (`listFriends`) | done |
| iOS audio resumes on the next touch | done |
| Lands in gameplay in one click (PLAY) | done |
| Smooth on slow phones (automatic quality lowers sharpness if frames are slow) | done |
| No errors in a full 8-minute match from the release zip; memory stays flat | checked |

---

## 7. Later, for Full Launch

- Ads: set `ADS_ENABLED = true` (midgame ad on the death screen, rewarded spins and coins).
- Online multiplayer (needs a game server; then CrazyGames rooms / `updateRoom`, friends' scores).
- Leaderboard encryption key for CrazyGames' own leaderboard (`LEADERBOARD_ENCRYPTION_KEY`).
