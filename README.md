# DOMINION — gameplay prototype

Single-player territory-control prototype: move well, claim land, and become King.

## Run it

The game uses ES modules, so it must be served over HTTP (opening `index.html` directly from disk won't work).

1. Open a terminal in this folder (the one containing `index.html`).
2. Run: `python -m http.server 8000` (or `npx serve .`)
3. Open http://localhost:8000 in your browser.

Add `?debug` to the URL (http://localhost:8000/?debug) to expose the game as `window.dominion` in the console for tuning.

## Controls

- Desktop: the mouse or WASD/arrow keys set direction only (distance never changes speed). Hold left click or
  Space to boost. Outside CrazyGames mouse lock, the system cursor stays visible; a small chevron ahead of your
  character shows the direction you are steering. With the cursor on or right
  next to your body, the last valid direction is kept (no jitter). On CrazyGames desktop, the mouse is confined
  during play; press Tab to unlock it.
- On CrazyGames, a midgame ad may be requested after elimination. The match pauses while the SDK resolves it;
  rejoining becomes available when the ad finishes or is unavailable.
- Touch: drag the on-screen MOVE joystick to steer; hold the separate BOOST control to spend energy. Lifting
  your thumb keeps you moving the way you last steered, like the mouse. The controls stay inside the screen
  edges in portrait and landscape layouts.
- Name: type it on the start screen (a "Player NNN" default is filled in; Enter plays). A name you choose is
  remembered on this device.
- Sound: mute, music volume and effects volume are on the start screen only (never on elimination or result
  screens, or in the gameplay HUD). M toggles mute. Music starts after your first click or key press.

## Rules

DOMINION is a territory-control survival game. Every character has the same fixed size: energy powers a
temporary boost, territory decides dominance, and whoever holds the most territory is King.

- Matches: each match is one world (WORLD-001, WORLD-002, ...) with up to 20 players (here: 1 player + AI).
  A match lasts 5 minutes (development setting, `MATCH.DURATION`); the clock appears for the last 3:00. At
  0:00 the player with the most territory wins and a results screen shows the King, territory, score and coins.
  PLAY AGAIN starts a fresh match: no territory, score, energy, power-ups or match coins carry over (your
  character, name and career XP do). After a normal elimination, choose REJOIN MATCH to continue in the same
  world; elimination by the King closes that world to you.
- Career progression: match XP persists on this device and advances through 30 career ranks. XP comes from
  active play, captures, energy, trail cuts, territory holding, King time, and match completion, with per-source
  match caps. Rank is cosmetic only and does not change gameplay. Elimination and match result screens show
  XP earned and current rank progress.
- Claiming land (same rule for everyone): leave your land, your trail marks the path, reconnect with your
  land, and the trail plus everything it encloses becomes yours, including rival land.
- Safe vs exposed: standing on your own land you are SAFE; anywhere else you are EXPOSED.
  - Body contact, safe vs exposed: the exposed one is eliminated (the safe one is untouched).
  - Body contact, exposed vs exposed: both are eliminated and both territories go neutral.
  - Body contact, safe vs safe: nobody dies; they ease apart (there is no knockback anywhere).
- Trail cuts: crossing a rival's open trail eliminates its owner; crossing your own trail eliminates you.
  Collision is swept (the whole movement since the last frame is checked against the visible trail
  geometry), so fast movement or a low frame rate can't skip over a trail. One cut is resolved exactly once.
- Movement speed is decided in one place (`Creature.getCurrentMovementSpeed`): normal speed is tuned about
  15% lower than the previous baseline; boost (1.55x) and Surge (1.5x) never multiply. Character modifiers
  are included under the shared hard cap (`MAX_MOVEMENT_SPEED`).
- Energy pickups come in three fixed tiers: small = 2, medium = 4 (less common), large = 10 (rare). The size
  you see is the value. Energy caps at 100%; pickups at full energy give a little score instead.
- Power-ups are deliberately scarce (at most 2 on the map): Surge, Magnet, Vision (shows active players on
  the minimap) and 5X (10 s: each pickup also pays 5x its value in
  score, e.g. 2 -> +10, and world coins are worth 5x; the energy refill itself is unchanged). Pickups use
  glowing colored orbs matching the store art and the energy pickups; Shield and Phase have been removed.
- The King is whoever holds the most scored domain after reaching 5% of the playable arena; overtaking passes the
  crown at once. Players waiting to respawn still count (their land persists) toward the leaderboard and crown.
- A Claim Beacon prefers neutral ground near claimed territory. Captures made inside its
  influence earn temporary 2× leaderboard/King domain value while the beacon is active; the capture still claims
  only its normal cells, and all score bonuses are funded from neutral arena so domain shares stay within 100%.
  Beacons are permanent physical structures: cover one with your domain and hold it to claim it — a growing
  organic boundary marks it as yours until a rival takes it back. Rivals may opportunistically approach it.
- A Flux Core is a permanent alien energy generator on neutral ground. While active it emits up to five ordinary,
  shared flux pickups every six seconds. Any player or rival can collect them; they refill the normal boost
  meter and never bypass its population cap. The three major nodes take turns, so only one is active at a time.
- A Rift is a single physical gate: two alien pylons framing one spatial tear. There is no exit portal and no
  destination marker anywhere. Step in with no open tether and, after a short recognition pulse, you are absorbed
  and reappear at a random valid point deep inside your own domain — never at a fixed spot, never outside it.
  Rift travel grants no land and never carries a trail across the jump.
- A Stasis structure is a permanent alien motion-control device near claimed territory. While active it slows
  rival players and bots within its radius by 35%. The local player is unaffected. The effect is sourced from
  the structure itself; it is never shown as an arena circle and never appears on the minimap.
- Landmarks are discovered by exploring: they have no minimap icons, compass markers, labels, or effect-radius
  rings while unclaimed. Claiming one also plays a short power-up sequence, a domain-coloured boundary growing
  out from the structure, and a distinct alien sound; each structure also hums quietly when you are near it.
- The world is walled: the static dark edge stops you, never kills you, and the camera never shows past it.
  The minimap shows the King crown and reveals rival markers only while Vision is active.
- Coins lie around the world and are also earned by playing. Cosmetic purchases remain part of progression,
  but are bypassed while development character access is enabled.

## Characters and elements

Nine elemental characters: Core, Ember, Glacier, Void, Tidal, Sol, Terra, Gale and Verdant. Each is a full
identity: 2D body style, colours (territory and trail colours follow the element; a second player of the same
element gets the closest free variation in the same colour family), trail accent, boost look, trail-cut effect
(always the attacker's element), elimination effect (the victim's element), sounds and title-screen showcase.

Elements also have a SMALL, situational gameplay specialisation, centralised and capped in
`src/progression/elementProfiles.js` (gameplay code never checks element names):

| Element | Advantage | Limitation |
|---|---|---|
| Core | +8% energy per pickup | none defensive |
| Ember | short extra kick when a boost starts | boost drains 12% faster |
| Glacier | keeps full turning control while boosting | 4% lower base speed |
| Tidal | +12% energy per pickup | 30% less overflow score |
| Sol | its own land and captures read brighter | no movement edge |
| Terra | boosts last 11% longer, hard to shove | 10% slower turning |
| Gale | 15% quicker turning | 4% lower base speed |
| Verdant | +6% energy per pickup | no combat edge |
| Void | rivals notice it ~15% later (never invisible) | 7% less energy per pickup |

## Rendering

Domain %: territory stats (HUD, leaderboard, death card, results) measure a player's domain against the WHOLE
playable arena (`TerritorySystem.percentFor`). The leaderboard shows the top five plus your own rank if you fall
outside them. The local player's displayed domain doubles their actual share, taking the additional percentage
only from unclaimed arena; the displayed shares plus the remaining unclaimed area still account for 100%.
Leaderboard rank and the King threshold use this displayed domain, so 5% actual ownership can count as 10%
when enough arena is unclaimed. A live Claim Beacon adds temporary score value only for newly captured cells in
its influence, also allocated from remaining neutral arena; the map itself always shows actual ownership. A tie does
not arbitrarily move the crown. Flux Core drops are regular shared energy pickups and do not modify domain or boost
rules. Rift travel grants no land and never allows an existing tether to be continued across the jump. Slices: the
attacker's signature slash
lands on the creature being severed (the cut point, where the attacker stands, only gets a small snap ring).

Player-facing words are kept plain so everyone understands them: territory, energy, coins, trail, cut /
eliminated / kills, speed (power-up), radar, ghost, strength / weakness (store). Landmarks: Bonus Tower, Energy Core,
Teleporter, Slow Tower. Code identifiers still use their original names (domain, flux, surge, vision, rift, ...).
King: you need the most territory AND at least `KING.MINIMUM_ARENA_PERCENT` (5%); the crown bar under the leaderboard shows who is King and your
progress ("NO KING YET · 3.1% / 5%", gold "YOU ARE KING" when it is you).

Floors (`render/floorThemes.js`, Settings > Floor, remembered per browser). Dark: Abyssal Shelf (default), Eclipse
Plain, Nebula Bloom, Midnight Reef, Obsidian Wastes, Crimson Basalt, Verdigris Hollow. Light: Frost Plains, Ochre
Dunes, Lichen Moor, Amethyst Flats. A theme is the ground colour, its haze tints and its circle colour; on dark floors
domains get stronger fills and lighter borders. Domains are outlined along their exact cells, each outer edge bumping
softly over its floor circle (`render/territoryShapes.js`), so a closed loop fills exactly the circles it enclosed;
edges shared with another domain stay straight. Every floor shows one soft circle per 40-unit domain cell, exactly on the
gameplay grid, so the ground you are about to claim is readable (one cached pattern fill; fades out when zoomed far
out). Characters use a 32-unit body radius (collision matches the body; the camera's reference radius matches it, so
the zoom did not change). The four distinct silhouettes (Sol, Terra, Gale, Verdant) are drawn 1.25-1.45x so every
character covers about the same area on screen (`DISTINCT_FORM_SCALE` in CreatureRenderer).

The arena is a disc (`WORLD.RADIUS` 3200, centred in a 6400 x 6400 square that holds the territory grid): a pale
planet surface floating in deep space, with no corners to camp in. `world/arena.js` keeps movement (you slide along
the rim), bot waypoints and wall avoidance, spawns, energy, coins and power-ups inside it; cells outside the rim can
never be owned and count as open space for the capture fill. Beyond the rim: dark space, faint stars and an
atmospheric halo; just inside it the ground shades toward a lit edge. The minimap is round to match.

The arena and characters are rendered in Canvas 2D. The floor has no visible grid; territory retains its
existing capture cells but uses softer fills and frontiers. Each character uses the stylized body, shading, animation,
and elemental detailing in `src/render/CreatureRenderer.js`; SOL, TERRA, GALE, and VERDANT have distinct
element-specific silhouettes. Trails, elemental effects, crowns, and names share the same lightweight canvas
rendering path. Add `?silhouette` to preview the character shapes without their colors or effects.

Development character access is controlled by `DEV_UNLOCK_ALL_CHARACTERS` in `src/config.js` (enabled).
When enabled, the picker exposes all nine characters without spending coins; press `[` or `]` on the start
screen to cycle through them, or click/tap a character directly.

Adding a character: add one definition to `src/progression/skins.js` (palette, `look`, `visual` styles,
territory colour, effects, sound set, rarity, unlock) and, if it needs a gameplay specialisation, one entry in
`elementProfiles.js`. Reusing existing styles needs no other change; a new body shape is added to
`render/CreatureRenderer.js`, a new trail/cut/elimination style one case in `render/elementalTrail.js` or
`systems/ElementalEffects.js`, a new sound texture one case in `elementTexture` (`audio/sounds.js`).

## Combat moments and power-up effects

Every important event has a visual AND an audio response, owned by one event-driven module,
`src/systems/CombatEffects.js` (gameplay code only emits events from `core/EventBus.js`):

| Event | Response |
|---|---|
| `TRAIL_SLICED` (lethal cut) | the ATTACKER's signature slash at the exact cut point (`render/signatureSlash.js`: a distinct shape language per element) + `AudioManager.playTrailSliceSound(element)` (element-specific, panned) |
| `PLAYER_ELIMINATED` | the VICTIM's own element elimination ~0.09 s later (attack -> slice -> elimination); body hits get a smaller attacker slash at the contact point |
| `PLAYER_COLLISION` (non-lethal) | a small contact ring and sparks, never the lethal slash |
| `POWERUP_ACTIVATED` | burst in the power-up's colour + its own sound; states while active: Surge streaks, Magnet field, Vision scans, 5X glyph |
| `POWERUP_EXPIRED` | a short fizzle + expiry sound; the indicator disappears |

A lethal slice opens a short "combat quiet" window so low-priority pickup effects never drown it out.

HUD: the leaderboard shows the top five by domain and, when you are outside the top five, a separate row with your
actual rank and domain percentage. Displayed percentages are normalized against the full arena so the visible
leaderboard totals add up to 100%. No world/galaxy name or player count is shown (the world id stays internal;
"galaxy" is the player-facing term where one is needed).

Development: add `?fxtest` to the URL for an effect test panel (every elemental slice and elimination, each
power-up, contact, expire all). It does not exist without the parameter.

## Ranks, galaxy and HUD

- Rank badges (`render/rankBadge.js`): 6 tiers x 5 divisions, procedural metallic insignia with a DOMINION glyph.
  Each tier has its own silhouette (steel shield -> bronze hex -> winged cobalt -> violet crest -> crimson crowned
  crest -> iridescent alien crystal with halo and shards); divisions add 1-5 marks, an inner chevron (III), a trim
  ring (IV) and a completed frame with crest spike (V). Shown beside the rank name, XP bar and `x / y XP` on the
  start, respawn, King and results screens. A rank-up shows a ~2 s badge-reveal toast with a short fanfare.
- Galaxy atmosphere (`render/galaxyAtmosphere.js`): tinted haze pools, barely visible drifting energy currents,
  sparse cosmic dust with slight parallax, and a slowly flowing organic texture inside territory with a soft
  frontier glow. All cached tiles drawn as patterns. No grid.
- Minimap: a translucent, softly rounded tactical projection with a luminous rim and cell-accurate territory
  coverage. Every territory cell is retained when drawing the map, with stronger ownership contrast so small
  domains stay visible at minimap scale. It shows
  your arrow, the King as the custom crown only, and rivals only while Vision is active (with a scan pulse).
- Leaderboard on phones: a compact, scrollable version showing every player's territory share.
- No safe-zone badge/popup/ring and no return arrow: land and trails speak for themselves.

## Capture feel, danger and bots

- Auto-fill (`TerritorySystem.capture`): when you return to your domain, the fill floods in from the edge of a box
  around ALL your land plus the tether (one cell wider); every cell it cannot reach (walls = your land + tether)
  becomes yours, so bays of your own domain closed by a short tether fill completely. The tether records every cell
  a move crosses (a 4-connected walk, `addTrailCells`), so diagonal runs leave no corner gaps. Verified against a
  whole-grid reference on 300 random domains/loops (0 mismatches, ~0.04 ms per capture).
- Smooth territory (`render/territoryShapes.js`): gameplay stays on the 40-unit cell grid; only drawing changes.
  Each owner's cells are traced with marching squares through cell-edge midpoints and rounded with two Chaikin
  passes, cached per view window as `Path2D` and rebuilt only when a cell inside the window changes owner
  (`touch`) or the camera leaves the window. `traceOutline()` is reused by the capture wave, the death snapshot and
  the menu backdrop.
- Capture waves (`render/captureWaves.js`): from where the loop closed, a wave in the capturer's element crosses
  exactly the newly claimed area (clipped to a smooth outline of the claimed cells), then the new border flashes.
  EMBER sparks on a warm front · GLACIER frost ring with crystals · VERDANT wavy growth + leaves · VOID an inward
  collapse that darkens · TIDAL rings · SOL rays · TERRA cracks · GALE wind streaks · CORE an electric front.
  Bigger captures last longer, hit harder, brighten the whole area, shake more and play a fuller `capture` sound.
- Exposure (no instructions): off your land your outline pulses slightly unsteadily, the trail glows and the screen
  edge closes in a little. Circling back near an OLDER part of your own trail (the stretch right behind you does
  not count) turns the pulse into a heartbeat rhythm, warms the edge and adds a quiet low `heartbeat` sound.
- Bot profiles (`ENEMY.PERSONAS`, assigned by seat): aggressive (hunts any exposed rival, short cooldown),
  opportunist (only long open trails or very close prey), explorer (big loops, rarely hunts), defensive (small loops
  near home, hunts only intruders). Just numbers: no memory, no grudges.

## Menu: leaderboard and my stats

- Top-left of the menu: STORE, LEADERBOARD (podium icon) and MY STATS (`ui/MenuPanels.js`). The in-game profile
  card was removed.
- MY STATS: lifetime numbers saved with your progress (`PlayerProgress.stats`, `recordStats`): land claimed (tiles),
  best territory, kills, deaths, K/D, most kills in a life, matches, wins as King, crowns taken, best score, time played.
- LEADERBOARD: LOCAL (your country: CrazyGames `systemInfo.countryCode`, else the browser locale) and WORLDWIDE tabs.
  The CrazyGames SDK can only SUBMIT scores (rankings show in CrazyGames' own leaderboard drawer; the feature is
  invite-only), so the list shows your own best entry and says where live rankings will appear; no invented players.
  `LeaderboardPanel.setSource(async (scope, country) => entries)` plugs in a server later. Scores (best match score)
  are submitted at death and match end once `LEADERBOARD_ENCRYPTION_KEY` (in `platform/CrazyGamesPlatform.js`) is set.

## Self-cuts, landmarks, rank badges

- Your OWN trail only counts as cut when the core of your body crosses it (`SELF_CUT_RADIUS_FACTOR` 0.55), and the
  stretch right behind your head that can never cut you scales with body size (`SELF_CUT_SAFE_LENGTH_RADII`), so bigger
  characters stop clipping their own trail. Cutting a rival's trail still uses your full body.
- Landmarks stand upright: their claimed boundaries are drawn on the ground, while the structures are drawn in a
  depth-sorted pass with the creatures (by base y), so you walk behind and in front of them. A structure that would hide
  you turns see-through. `warmLandmarkRenderers()` draws each type once at match start to avoid a first-view hitch.
- Rank badges are drawn with depth: cast shadow, slab thickness, shaded lower side, recessed bevel, specular glare and
  shadowed wings and glyph.

## HUD, percentages, power-ups, Teleporter

- In-match HUD: a plain score card (top-left), coins, and a plain top-5 leaderboard (no colour bars or pills).
- Percentages are realistic: each player's actual land over all land players own (counted once, no bonuses), so all
  players add up to 100% (`TerritorySystem.scoreCounts`). The King needs the most land and at least 5% of the map. The
  Bonus Tower now pays score (bonus tiles x `SCORE.PER_CELL`), the same for everyone.
- Power-ups bought in the store (Speed, Magnet, Tracker, Radar; 5X removed) show in the item bar during a match (bottom centre;
  a row under the coins on phones): click / tap or press its number key to use one (`ui/ItemBar.js`, `Game.useStoredPowerUp`).
  Active power-up timers sit at the top centre.
- Teleporter: open during its active window, shuts the moment anyone travels through and stays shut for
  `RIFT.USE_COOLDOWN` (18 s); the door animates open and closed. Captures announce the landmark by name
  ("TELEPORTER CAPTURED").
- Landmarks are a bit smaller (`LANDMARKS.SCALE` 0.74) and lean slightly away from the screen centre
  (`LANDMARKS.LEAN`, `RISE`), base planted, so moving around one shows its sides.

## Panels, Tracker, landmark areas

- Store, Leaderboard, My Stats and Settings close ONLY with their X (no backdrop click, no Escape; Escape is also a
  restricted key on CrazyGames).
- MY STATS: BADGES tab (current badge + XP bar, then the rank road: 6 themed tiers x 5 badges; earned = full colour +
  check, current = glowing "YOU ARE HERE", future = dimmed with a lock and XP to go) and STATS tab (combat / territory /
  matches).
- Tracker power-up (arena pickup + store, 300 coins): for 10 s every exposed rival gets the red ring and EXPOSED tag
  and shows red on the minimap. Without it, exposure is not highlighted at all (`relationTo`).
- Leaderboard % = your land / the WHOLE map (unclaimed land counts), so 5% for the crown means 5% of the planet.
- Landmarks on the minimap (beacon diamond, energy core dot, teleporter oval, slow tower square; dim when off, ringed when
  yours). Landmarks of the same kind are at least 2,200 units apart.
- Ground areas only where they do something, at the exact gameplay radius and nearly circular: Bonus Tower = double-value
  capture area while online (the bonus now only applies while online); Slow Tower = slow field while active. Energy
  Core and Teleporter have none; a captured Teleporter alerts its owner when it opens ("YOUR TELEPORTER IS OPEN").

## Ranks curve, leaderboard categories, Zoom, home button

- XP curve (`progression/ranks.js`): small, gently growing steps inside a tier, a big promotion jump between tiers, each
  tier much longer than the last (Amateur I 603 XP, Pro I 2,267, Expert I 5,831, Master I 12,799, Legendary I 25,943,
  Legendary V 41,047).
- Badges: 1-5 shaded stars per division, a faceted gem in a bevelled ring, rivets, glints on Master+.
- Leaderboard: categories are the main tabs (CROWNS = matches won as King, first; TERRITORY = land claimed; KILLS;
  SCORE = best match), LOCAL / WORLDWIDE on the left; rows show rank, country flag (Twemoji flag font, falls back to
  letters), name, current character and value. `LeaderboardPanel.setSource(async (category, scope, country) => entries)`
  for the multiplayer back-end.
- Zoom power-up (yellow; arena + store, 220 coins): the camera pulls back 1.5x for 10 s (`camera.viewScale`).
- Home button (top-left) on the screens shown after you die: back to the main menu (`Game.goHome`).
- My Stats opens on STATS; BADGES is the second tab. The "players per galaxy" line was removed.

## Come-back systems (progression/Missions.js)

- Killstreaks: kills within 8 s of each other: DOUBLE CUT!, TRIPLE CUT!, QUAD CUT!, RAMPAGE! with a coin bonus
  (`KILLSTREAK`).
- Near-miss on the death screen: "Only N XP to <next rank>!", "You were X% away from the crown!", or a revenge hint.
- Revenge: the rival who took you out is marked (minimap crosshair + REVENGE tag) for 60 s after you rejoin; taking them
  out pays a bonus (`REVENGE`).
- Login streak: first visit of each local day pays 20 x day coins (day 7+ = 140); missing a day restarts it.
- Weekly season (resets Monday 09:00 UTC like CrazyGames' leaderboards): the leaderboard shows this week's numbers;
  last week's crowns pay 30 coins each (max 300) when the new week starts. Top-3 season prizes need the game server.
- Daily missions: three different goals per day (claim land, kills, wear the crown, collect energy, finish matches,
  stay alive, capture a landmark, use power-ups, get a DOUBLE CUT), each paying coins + XP; MISSIONS button on the menu
  with a badge when rewards are ready.

## Store

A gold STORE button in the menu's top-left corner opens the store (`ui/StorePanel.js`), in three sections. Everything
is paid in sigils earned by playing (never real money). Closes with X, Escape or a click on the backdrop.

- CHARACTERS: live preview, element and rarity, description, element EDGE and TRADE-OFF (`progression/storeInfo.js`,
  numbers mirroring `elementProfiles.js`), price, EQUIP / UNLOCK / NEED n MORE (cards built by `SkinPicker`).
  Prices (`skins.js`): Core free; Ember 12,000; Glacier 15,000; Tidal 16,500; Void 18,000; Sol 22,000;
  Terra 24,000; Gale 26,000; Verdant 32,000.
- FLOORS (moved here from Settings): preview (floor, circles and a domain), dark/light, price (`floorThemes.js`):
  Abyssal Shelf and Frost Plains free; 2,500-6,000 for the others. Owned floors are saved in `PlayerProgress`.
- POWER-UPS (`progression/storeCatalog.js`): single-use charges (Surge 150, Magnet 200, Vision 250,
  5X 400). One owned charge can be set to USE NEXT LIFE: it fires as your next life starts
  (`Game.applyLoadout`), exactly like picking it up in the arena, and is consumed.

`DEV_UNLOCK_ALL_CHARACTERS` (config) also unlocks every floor while developing.

## Results card and HUD touches

- After an elimination: what happened and by whom, a snapshot of your domain at that moment
  (`render/deathSnapshot.js`: your land, open trail, where you fell, the rival's position), tiles for time alive,
  peak land, land claimed and interceptions, each with the XP it earned this life, score, XP this life, and the
  rank bar from your badge to the next one. One big REJOIN.
- Names sit in pills of the owner's colour (gold for the King; your own has a light rim). Leaderboard rows carry a
  bar in the owner's land colour, sized against the leader. An interceptions counter appears beside your score
  after your first one.
- Menu: a dim backdrop of organic territories and open trails (`ui/menuBackdrop.js`, painted once per size, no grid)
  and, on wide screens, a four-step HOW TO PLAY card.

## Tuning

Every gameplay number lives in `src/config.js`.

## Structure

```
index.html, styles.css
src/
  main.js               entry point
  config.js             all tuning constants
  core/                 Game (composition root), GameLoop, Input, Camera, EventBus, Roster
  world/                arena (disc helpers), WorldSession (one match: id, capacity, clock, seats, closed-to list),
                        WorldManager (which world a player enters; lock-outs by the King)
  entities/             Creature (shared base), Player, Enemy (AI), Energy, CoinField, PowerUp
  systems/              Collision, Territory, Spawn, King, Particle, Effects, ElementalEffects,
                        CombatEffects (all gameplay-moment visuals + audio)
  render/               ArenaRenderer (disc floor, space, rim), CreatureRenderer (characters), signatureSlash, directionIndicator,
                        elementalTrail, elementShowcase, sprites, territoryShapes, captureWaves, exposureCue,
                        deathSnapshot, rankBadge, galaxyAtmosphere
  audio/                AudioManager (the only Web Audio user; SFX and music buses), procedural sounds,
                        music (menu/game/end step sequencer) and synth
  progression/          PlayerProgress (coins and skins, localStorage), CoinRewards, skins,
                        elementProfiles (element gameplay modifiers), playerName
  ui/                   HUD, Minimap, MobileJoystick, Screens, TitleScreen, Tutorial, Announcer,
                        SkinPicker, SoundControls, menuBackdrop
  utils/                math, SpatialHash
```

Every creature is driven only through `setIntent(x, y, throttle)`. Local input, the AI, or a future network message can supply that intent.

## Light / dark theme

- A sun/moon button beside the settings gear switches between dark (default) and light (`ui/ThemeToggle.js`).
  The choice is saved per device (`localStorage` `dominion.theme`) and applied in `index.html` before first paint.
- It applies everywhere: menu, popups, HUD cards, item bar, death and match-end screens. Only the galaxy floor
  of the arena keeps its own colours. `styles.css` uses theme tokens (`--tint`, `--glass`, `--text-rgb`,
  `--muted-rgb`, `--gold-text`, `--gold-strong`, `--mint-text`) that `[data-theme="light"]` redefines.
- Store > Floors is now called GALAXIES (the code still calls them floors: `floorThemes.js`).

## Wheel of coins

- A small wheel on the menu (right side; under the gear on phones) turns while a free spin is waiting and shows
  FREE SPIN, or the time to the next one. It opens the wheel sheet: your recent wins (left), the wheel (centre),
  every prize with its chance (right).
- One FREE spin per local day. After it, up to 3 bonus spins a day: WATCH AD (CrazyGames rewarded ad, only shown
  when ads are available; an ad error never pays) or 150 coins (the required non-ad alternative).
- Prizes (`progression/Wheel.js`): 25/50/75/100/250/500 coins, +1 Speed, +1 Zoom, weighted (500 = 2%).
  `PlayerProgress.startSpin` picks and saves the prize as owed; `finishSpin` pays it when the wheel stops, when the
  sheet closes mid-spin, or on the next visit if the page closed.

## Mission icons and daily rewards

- Each mission has an icon (by what it counts) and reward chips: coin + amount, XP, and a power-up on harder ones
  (kill 5: Tracker, wear the crown: Zoom, landmark: Magnet, DOUBLE CUT: Speed).
- The login streak road (now DAILY REWARDS) shows coin icons; day 3 adds +1 Speed, day 5 +1 Tracker, day 7+ +1 Zoom.
- Power-ups everywhere (store, item bar, missions, wheel) use the same glyph orbs (`ui/icons.js`).

## Main menu layout and HOW TO PLAY

- Menu buttons are big colour tiles with a label, in three corners: STORE and MISSIONS top-left (a column on
  desktop, a row on phones), LEADERBOARD and MY STATS bottom-left, THEME and SETTINGS bottom-right (Settings now
  opens upward). Coins sit top-right in the same pill as in the match (coin + amount, no word), the wheel on the right.
- Coin pills are bigger everywhere (28px coin on desktop, 22px on phones); store and wheel wallets show coin + amount.
- HOW TO PLAY (button under PLAY) opens an illustrated guide (`ui/HowToPanel.js`): four looping mini arena scenes
  acted out by the real characters on scalloped territory: your character leaves its territory (trail), loops back
  home (the loop fills, +N TILES), cuts a rival character's open trail (CUT!), and wears the crown on the biggest
  territory. TRY IT NOW starts a match with the step-by-step tutorial shown once more (`Tutorial.replayNext`).

## Store > Coins (+ beside the menu coins)

- The gold + on the menu coin pill opens Store > COINS. +250 coins for a CrazyGames rewarded ad (`AD_COINS` in
  `storeCatalog.js`: 5 a day, 3 minutes between ads with a countdown; only a finished ad pays, an error never does;
  disabled with "NO ADS RIGHT NOW" when ads are unavailable). Cards also link to the free ways to earn: the daily
  wheel and missions. State: `PlayerProgress.adCoins` (`adCoinsStatus`, `grantAdCoins`).
- The MISSIONS tile uses a clipboard-with-check icon.

## Characters: random starter, one look, honest strengths, prices

- New players get ONE random character from `STARTER_POOL` (Common + Rare: Core, Void, Ember, Glacier, Gale) and
  one random galaxy (`PlayerProgress.giveStarter`); the store marks it YOUR STARTER. Old saves keep Core.
- Sol, Terra, Gale and Verdant now use the same shell + glowing core + eye style as the others (their old one-off
  forms were removed from `CreatureRenderer.js`); each keeps its own colours, core mark and motif.
- Every strength is a real gameplay effect (`elementProfiles.js`, text in `storeInfo.js`). Sol's old "brighter
  territory" was visual only; it is now +3% speed (rivals notice it 15% sooner). Terra: boosts last 11% longer +
  hard to shove, turns 10% slower. Verdant: +10% energy, turns 6% quicker, overflow scores 20% less. Void: noticed
  20% later, 5% less energy. Note: "noticed" (Void/Sol) affects bots today; with real players it changes nothing.
- Prices by strength: Common 12,000 (Core, Void) · Rare 15,000 (Ember, Glacier, Gale) · Epic 20,000 (Tidal,
  Terra) · Legendary 28,000 Verdant, 30,000 Sol. The store lists them cheapest first.

## Reachable crown (5%, smaller map, progress bar)

- Crown minimum lowered from 10% to 5% of the map (still needs the most territory): with 20 seats an even split of
  the whole map is 5% each, so the King holds at least an even share while leading.
- Map radius 3700 -> 3200 (25% less area): 5% is ~990 tiles instead of ~2,690 for 10% before (2.7x easier),
  and players meet more often. Landmarks and spawn distances still fit (checked).
- Crown bar under the in-match leaderboard (`HUD.renderCrownProgress`, `.lb-goal`): who is King + your share toward
  the minimum; pulses once you pass it, gold when you are King. The match stays 5 minutes during development.

## Bots: territory war

- From their own land, bots keep a GOAL for a few seconds (`ENEMY.GOAL_TIME`): EXPAND (loop out past their border,
  away from their land's centre), RAID (loop through a nearby rival's land to steal it; big, close empires are
  raided most, so leaders get attacked) or FORAGE. Odds per persona: `expand` / `raid` in `ENEMY.PERSONAS`.
- Bigger empires take bigger loops (x up to 2.6, `LOOP_GROWTH`), bots hurry while their trail is open
  (`EXPOSED_THROTTLE`) and boost home once the loop is long (`RETURN_BOOST_SHARE`).
- Measured over 7 simulated 5-minute matches (19 bots, player parked): before, the top bot peaked at 3.7-4.8% and no
  bot was ever crowned; now bots are crowned in 6 of 7 matches (first King around 2:00), peaks reach 4.3-10.4%,
  the crown changes hands up to 5 times, and kills roughly doubled.

## Phone testing and production build

- Development is unchanged: serve the project folder (`python -m http.server 8000`) and open `index.html`; it loads
  the 85 ES-module files straight from `src/`. That is fine on a PC but slow over a tunnel or mobile data (87
  requests, ~950 KB uncompressed: 7-13 s to start on a slow link; on a phone it can look like the game "doesn't play").
- `npm run build` (esbuild, `build.mjs`) writes `dist/`: one minified `game.js`, one `styles.css`, `index.html`
  (~150 KB gzipped, 4 requests: ~3 s on the same slow link). Targets Android Chrome 84+ / iOS Safari 15+. This `dist/`
  is also what you upload to CrazyGames.
- `npm run serve` = `python serve.py dist 8000`: serves `dist/` on every interface with gzip. Forward port 8000
  (VS Code Ports tab: set visibility to Public) and open the link on the phone. Re-run `npm run build` after code
  changes: `dist/` is generated, never edit it. Add `?debug` to the URL to expose `window.dominion`.

## Release polish (landmarks, captures, borders, kills, crown bar, CrazyGames)

- Minimap landmarks are badges (dark disc, coloured ring, white symbol: tower / bolt / portal / snowflake),
  pulsing while active, white ring if yours, red if a rival's; a ripple spreads when one switches on. The
  announcements use the plain names ("BONUS TOWER IS ON ... see your minimap").
- Captures fill only the pocket the new trail closes (`TerritorySystem.capture`): old gaps elsewhere in your
  domain stay open until a loop goes around them.
- Borders between two domains are curved too (`territoryShapes.js`): the lower slot bulges out, the other
  follows the same curve in, so stolen land keeps the round look (no square/triangle staircases).
- Kill icon: a skull (score card, leaderboard KILLS tab, death screen, kill missions).
- The crown bar under the in-match leaderboard hides once you reach the minimum or wear the crown.
- CrazyGames: `ADS_ENABLED` (config) = false for Basic Launch hides every ad button and skips the death ad;
  `DEV_UNLOCK_ALL_CHARACTERS` = false; SDK loadingStart/Stop added; `npm run package` builds
  `dominion-crazygames.zip`. See CRAZYGAMES_SUBMISSION.md.

## Leaderboard periods, landmark clarity, guide

- Leaderboard: WEEKLY (this season) / ALL-TIME switch; every value has the player's rank badge in front of it.
  The source signature is now `(category, scope, countryCode, period)` and entries may carry `rank` (badge index).
- Country: CrazyGames' country is trusted only on the live site; otherwise the device time zone
  (`TIMEZONE_COUNTRY` in `CrazyGamesPlatform.js`), then the browser language. A South African device set to
  en-US now shows ZA.
- Landmarks stand upright (`LANDMARKS.LEAN`/`RISE` = 0), each has a name plate in the world (name, what it does,
  ON 0:25 / OFF 0:41, YOURS), and each cycles ON/OFF on its own clock (no longer paused by other landmarks),
  staggered at the start. Switch-ons are announced only near you or for your own (`ANNOUNCE_RANGE`, `ANNOUNCE_GAP`).
- Teleporter: reopens after every trip (18 s) and drops you on YOUR BORDER: next to the nearest rival trail
  attacking your land (facing it), otherwise the edge with the most open land, far from the gate, facing outward
  (`RiftSystem.borderDestination`).
- HOW TO PLAY has tabs: THE BASICS, SCORE & COINS (exact rules), TERRITORY (grow fast, stay alive), LANDMARKS.
- Death screen: crossing your own trail now correctly says your territory went neutral (it always did).
- New icons: glossy tiles for Time Alive (stopwatch), Peak Territory (mountain + flag), Land Claimed (claimed
  tile + plus) and Kills; mission icons are glossy colour tiles with a light sweep and pulse when ready to claim.

## Crownloop (rename) and match rules

- The game is now called Crownloop (title, menu, announcer, submission). Internal storage keys keep the
  `dominion.*` names so nobody loses progress.
- King needs 8% (`KING.MINIMUM_ARENA_PERCENT`); matches last 8 minutes (`MATCH.DURATION`).
- Taken out by the King = out of that match for good (only PLAY AGAIN, a new match). Their seat is never
  refilled (`WorldSession.closeOut`), so when the King is the last one left the match ends at once and the King
  is crowned (`Game.lastKingStanding` / `finishByLastKing`).
- Name: on CrazyGames the start screen shows the CrazyGames username + avatar ("PLAYING AS"), guests get a
  generated name and a LOG IN button (`ui/AccountName.js`); elsewhere the name stays editable.
- Sharing: INVITE tile on the menu and INVITE FRIENDS on the leaderboard (`ui/share.js`: CrazyGames invite link,
  the phone share sheet or the clipboard). Leaderboard: WORLDWIDE and ALL-TIME are first and default; a FRIENDS view
  lists CrazyGames friends (their scores need online play).
- How to Play tabs rewritten in short, simple sentences.

## 30 players, bots that fight back, difficulty, hosting

- `WORLD.CAPACITY` 30 on a `WORLD.RADIUS` 3900 planet (the same space per player as 20 had on 3200).
- Bots fight back (`ENEMY.DEFEND_*`, `GRUDGE_*`, `DANGER_RANGE`): a rival trail inside a bot's land gets hunted,
  a bot hunts whoever knocked it out last (`Participant.grudgeSlot`), and an exposed bot with a rival close runs
  home boosting.
- EASY / NORMAL / HARD above PLAY (`DIFFICULTY` in config, `ui/DifficultyPicker.js`, `Enemy.setBotDifficulty`):
  multipliers on aggression, notice range, reaction time, chase time, turning and fighting back. Saved per device.
- Hosting: `vercel.json` runs `npm run build` and serves `dist/`. Push to GitHub, import the repo in Vercel.

## Difficulty rework (crown 6%)

- Crown at 6% (`KING.MINIMUM_ARENA_PERCENT`). Levels (`DIFFICULTY.LEVELS`): EASY = the old Normal, NORMAL = the old
  Hard, HARD = new, extreme: "you against the planet".
- Bots never cross their own trail any more (`Enemy.avoidOwnTrail` simulates the turning arc; self-crossings were a
  third of all bot deaths), flee with a wide swing (no U-turn) and never chase something behind them while exposed.
- Per level: `infight` (bots fight each other less, so they grow), `apex`/`apexHunt` (a bot holding that % turns
  predator: hunts and raids smaller bots, so empires snowball), `hunters` (bots that track the player anywhere),
  `playerSense`/`playerFocus` (bots notice and target you first), `beef` (a bot you knocked out comes for you),
  `loops`/`growth`, `aim`, `speed`, `boost`, `caution`.
- Simulated 8-minute, 30-player matches (player idle): bot peaks EASY 6-9%, NORMAL 9-17%, HARD 11-14%, bot Kings in
  every match (3-8 crown changes). Pressure on a looping player: chases per minute EASY 0, NORMAL 1.7, HARD 8.2;
  bots stalking you EASY 0, NORMAL 2.4, HARD 5.
