// Central tuning values for the DOMINION prototype.
// Every gameplay number lives here so the feel can be tuned without touching logic.

// Development access: expose every cosmetic character without changing progression data.
// MUST stay false in any build uploaded to CrazyGames (otherwise everything is free).
export const DEV_UNLOCK_ALL_CHARACTERS = false;

// CrazyGames launch phase. Basic Launch: ads are disabled by CrazyGames, so the game shows
// NO ad buttons and asks for no ads ("no rewarded ad buttons without effect"). Set to true
// for Full Launch: the death-screen midgame ad, the wheel's WATCH AD spin and Store > Coins
// "+250 coins" offer then appear (each still hides itself when no ad can be served).
export const ADS_ENABLED = false;

// One world = one contained match. Sized so CAPACITY creatures meet regularly.
export const WORLD = Object.freeze({
  CAPACITY: 30, // players per world (here: 1 local player + AI filling the other seats)
  // The arena is a disc of RADIUS (a planet in space; no corners to camp in), centred in a
  // WIDTH x HEIGHT square that holds the territory grid. See world/arena.js.
  RADIUS: 3900, // room for 30 players: the same space per player as 20 had on 3200
  WIDTH: 7800,
  HEIGHT: 7800,
  ID_PREFIX: 'WORLD-',
  SEAT_REFILL_DELAY: 6, // seconds before a new rival takes a seat closed by the King
  SEAT_REFILL_MIN_TIME_LEFT: 60, // nobody new joins in the final minute
});

export const LOOP = Object.freeze({
  MAX_FRAME_DT: 1 / 20, // clamp long frames (tab switches, hitches)
});

export const RENDER = Object.freeze({
  MAX_DEVICE_PIXEL_RATIO: 2,
  // V10 arena: a light, calm, premium floor so elemental colours pop.
  BACKGROUND: '#070b18', // deep space beyond the arena's rim
  // (The floor colour itself is a theme: render/floorThemes.js, chosen in Settings.)
  FLOOR_LIGHT: 'rgba(255, 255, 255, 0.55)', // soft pools of light: gentle depth, not texture
  FLOOR_POOL_SIZE: 1600, // world units between light pools
  WORLD_EDGE: 'rgba(150, 230, 255, 0.9)', // the arena rim: a luminous atmosphere line
  // Particles: additive glow vanishes on a light floor, so they're drawn normally.
  PARTICLE_BLEND: 'source-over',
  PARTICLE_LIGHTNESS: 50,
  VIEW_MARGIN: 120,
});

export const CAMERA = Object.freeze({
  FOLLOW_RATE: 7,
  ZOOM_RATE: 2.5,
  BASE_VIEW_SIZE: 1100, // world units visible across the shorter screen side at start
  // Small screens see less world so creatures stay readable: view = short side × this, ≥ MIN.
  VIEW_SIZE_PER_SCREEN_PX: 1.6,
  MIN_VIEW_SIZE: 700,
  REFERENCE_RADIUS: 38.4, // = CREATURE.RADIUS, keeping camera framing unchanged as bodies scale up
  // Stable character scale: all creatures use the same camera zoom.
  ZOOM_EXPONENT: 0.4,
  MIN_ZOOM_FACTOR: 0.5,
  SHAKE_DECAY: 9,
  MAX_SHAKE: 16,
  SHAKE_EPSILON: 0.1,
});

export const CREATURE = Object.freeze({
  RADIUS: 38.4, // 20% larger body and collision radius
  BASE_SPEED: 200, // controlled movement, about 15% below the previous tuned baseline
  BASE_ACCELERATION: 9, // how fast speed (not direction) follows the target speed

  HEADING_MIN_SPEED: 8,
  HEADING_TURN_RATE: 24, // presentation: the body's facing follows the movement direction

  // Presentation
  RADIUS_ANIM_RATE: 10,
  MEMBRANE_POINTS: 22,
  MEMBRANE_WOBBLE: 0.045,
  MEMBRANE_WOBBLE_SPEED: 3.2,
  STRETCH_MAX: 0.1,
  BLINK_INTERVAL_MIN: 2.5,
  BLINK_INTERVAL_MAX: 6,
  BLINK_DURATION: 0.14,
  AURA_SCALE: 2.4,
  LABEL_MIN_SCREEN_RADIUS: 10,
  // One consistent shell/core silhouette; skins vary presentation without gameplay scaling.
  FORM_PETALS: Object.freeze([5, 5, 5]),
  FORM_CORE: Object.freeze([0.4, 0.4, 0.4]),
  LIGHT_ANGLE: -Math.PI * 0.75, // one world light, from the upper-left, for every creature
  DETAIL_MIN_SCREEN_RADIUS: 14, // below this on-screen radius, skip glint/socket/crescent
  CORE_PULSE_SPEED: 4,
  LABEL_FONT_PX: 12,
  LABEL_OFFSET_PX: 14,
  LABEL_RANGE: 1100, // rival names only show near the player (the King's always does)
});

export const PLAYER = Object.freeze({
  // Player name: editable on the start screen; default "Player NNN".
  NAME_PREFIX: 'Player',
  NAME_NUMBER_MIN: 100,
  NAME_NUMBER_MAX: 999,
  NAME_MAX_LENGTH: 20, // CrazyGames usernames are 6-20 characters
  NAME_STORAGE_KEY: 'dominion.playerName.v1',
  HUE: 162,
  SPAWN_MARGIN: 800, // keep spawns well away from the world edge
  SPAWN_ATTEMPTS: 40,
  SPAWN_THREAT_DISTANCE: 1500, // respawn this far from any rival
  HUNT_GRACE: 25, // seconds after each (re)spawn before AI will start hunting you
  // Below this many screen pixels, retain the last valid mouse movement direction.
  MIN_MOUSE_DIRECTION_DISTANCE: 8,
  // ...and never trust a direction while the cursor is on (or right next to) the body:
  // the dead zone is the body's on-screen radius times this.
  MOUSE_DEADZONE_RADIUS_FACTOR: 1.15,
});

// Direct control: the movement direction turns toward the input quickly (a small, fixed
// time constant), and speed follows separately. No rubber-band velocity blending.
export const MOVEMENT = Object.freeze({
  TURN_SMOOTHING: 0.045, // seconds (time constant) for the direction to follow the input
  BOOST_TURN_FACTOR: 0.75, // turning is a little heavier at boost speed
  INDICATOR_DISTANCE: 1.75, // direction marker sits this many radii ahead of the body
});
export const MAX_MOVEMENT_SPEED = 325; // final cap, including character modifiers, boost, and Surge

// Innate hold-to-boost resource; energy pickups refill this meter.
export const BOOST = Object.freeze({
  MAX_ENERGY: 100,
  START_ENERGY: 50,
  MINIMUM_BOOST_ENERGY: 2,
  SPEED_MULTIPLIER: 1.55,
  // Boost and Surge never multiply: the stronger one applies (see getCurrentMovementSpeed).
  ENERGY_DRAIN_PER_SECOND: 20, // a full meter = 5 s of boost
  KICK_TIME: 0.4, // seconds of the element "boost kick" window (Ember), see elementProfiles
  GLOW_FADE_RATE: 6, // visual effects fade out smoothly after release
  SPARK_INTERVAL: 0.045, // energy motes shed behind a boosting creature
  BUTTON_RADIUS: 34,
});

// Coins: a slow, cosmetic-only progression layer. Never affects gameplay stats.
export const COINS = Object.freeze({
  STARTING_COINS: 0,
  TERRITORY_CELLS_PER_COIN: 80, // cells captured by closing loops per coin
  ELIMINATION_REWARD: 3,
  SURVIVAL_INTERVAL: 60, // seconds alive in one life...
  SURVIVAL_REWARD: 1, // ...per coin
  END_GAME_REWARD: Object.freeze({
    KING: 25, // holding the crown when the round ends
    TOP_3: 10,
    FINISHED: 3, // anyone who sees the round through
  }),
  STORAGE_KEY: 'dominion.progress.v1',
});

// Coins lying in the world: rarer than food, metallic gold, picked up by the player.
export const COIN_FIELD = Object.freeze({
  MAX_ACTIVE: 22, // intentionally sparse beside the 880–1500 active energy pickups
  SPAWN_INTERVAL_MIN: 2,
  SPAWN_INTERVAL_MAX: 4.5,
  NEAR_PLAYER_CHANCE: 0.4, // some appear in the player's region so they're discoverable
  NEAR_PLAYER_MIN: 500,
  NEAR_PLAYER_MAX: 1800,
  LIFETIME: 75,
  FADE_TIME: 2,
  RADIUS: 13,
  VISUAL_SCALE: 1.35, // presentation only; pickup and magnet ranges keep using RADIUS
  GLOW_SCALE: 2.4,
  BIG_CHANCE: 0.15,
  BIG_RADIUS_SCALE: 1.35,
  VALUE: 1,
  BIG_VALUE: 5,
  SPIN_SPEED: 2.2, // radians per second
  SPRITE_FRAMES: 24,
  PICKUP_RANGE: 26, // extra reach beyond the bodies
  MAGNET_RANGE: 140,
  MAGNET_PULL_SPEED: 420,
  GLINT_INTERVAL_MIN: 1.6,
  GLINT_INTERVAL_MAX: 4,
});

export const COMBAT = Object.freeze({
  CONQUEST_FRACTION: 0.5, // share of a cut rival's land the cutter takes (nearest first); the rest goes neutral
  // Body contact (V10): on your own land you are SAFE, anywhere else you are EXPOSED.
  //   safe vs exposed  -> the exposed one is eliminated
  //   exposed vs exposed -> both are eliminated
  //   safe vs safe     -> nobody dies; they ease apart (no knockback)
  CONTACT_REACH_FACTOR: 0.85, // bodies must overlap this much (of r1 + r2) to count as contact
  SAFE_SEPARATION_RATE: 0.35, // share of the overlap corrected per pass for safe-vs-safe contact
  BUMP_COOLDOWN: 0.6, // soft contact cue (sound/AI reaction) at most this often per creature
  SEPARATION_ITERATIONS: 2, // relaxation passes: crowds and corners never lock into a block
  SEPARATION_SLOP: 1, // world units of allowed overlap
  BUMP_FEEDBACK_COOLDOWN: 0.25,
  THREAT_RING_RANGE: 900,
  CREATURE_ELIMINATION_TIME: 0.32,
});

// Energy pickup spawn weights (relative): small is common, large is rare.
const ENERGY_SMALL_WEIGHT = 0.72;
const ENERGY_MEDIUM_WEIGHT = 0.22;
const ENERGY_LARGE_WEIGHT = 0.06;

// Energy cells refill boost; they never change body size or permanent stats.
export const ENERGY = Object.freeze({
  // Energy is findable without long trips, but never carpets the map.
  // (Scaled to the 7000² world: same density per screen as before.)
  INITIAL_POPULATION: 1100,
  MIN_POPULATION: 880,
  MAX_POPULATION: 1500,
  BASE_SPAWN_RATE: 4,
  MAX_SPAWN_BUDGET: 30,
  BELOW_MIN_REGEN_MULTIPLIER: 1.6,
  DEFICIT_REGEN_PER_ITEM: 0.15, // extra spawns/s per item below MIN_POPULATION, so busy matches can't starve the map
  RESPAWN_DELAY_MIN: 6, // gradual replenishment, never instant
  RESPAWN_DELAY_MAX: 12,
  DENSITY_CELL_SIZE: 750,
  DENSITY_SHIFT_INTERVAL: 75, // seconds: rich/dry zones re-roll, so a dry patch is temporary
  DRY_ZONE_THRESHOLD: 0.36,
  RICH_ZONE_THRESHOLD: 0.63,
  RICH_ZONE_MULTIPLIER: 1.9,
  NORMAL_ZONE_MULTIPLIER: 1,
  DRY_ZONE_MULTIPLIER: 0.25, // sparse, not empty
  CLUSTER_STRENGTH: 0.68,
  CLUSTER_RADIUS: 200,
  INITIAL_CLUSTER_COUNT: 20,
  INITIAL_CLUSTER_RADIUS: 500,
  SPAWN_CLUSTER_MIN_DISTANCE: 160,
  // Three fixed tiers: the size you see IS the value (small 2, medium 4, large 10).
  SMALL_WEIGHT: ENERGY_SMALL_WEIGHT,
  MEDIUM_WEIGHT: ENERGY_MEDIUM_WEIGHT,
  LARGE_WEIGHT: ENERGY_LARGE_WEIGHT,
  TIERS: Object.freeze([
    Object.freeze({ name: 'small', value: 2, radius: 4.5, hue: 192, weight: ENERGY_SMALL_WEIGHT }),
    Object.freeze({ name: 'medium', value: 4, radius: 6.5, hue: 192, weight: ENERGY_MEDIUM_WEIGHT }),
    Object.freeze({ name: 'large', value: 10, radius: 10, hue: 192, weight: ENERGY_LARGE_WEIGHT }),
  ]),
  // Energy picked up while the meter is already full becomes this much score per energy.
  OVERFLOW_ENERGY_SCORE_VALUE: 1,
  MAGNET_RANGE: 60,
  MAGNET_RADIUS_FACTOR: 0.6,
  MAGNET_PULL_SPEED: 380,
  MAGNET_MIN_STRENGTH: 0.3,
  SPAWN_IN_TIME: 0.35,
  SPRITE_SCALE: 2.6, // sprite half-size relative to the collision radius
  PULSE_SPEED: 3,
  PULSE_AMOUNT: 0.12,
  SPATIAL_CELL: 200,
  EDGE_MARGIN: 40,
  ABSORB_TIME: 0.16,
});

export const SURGE = Object.freeze({
  LIFETIME: 25,
  FADE_TIME: 1.5,
  DURATION: 4,
  SPEED_MULTIPLIER: 1.5, // never stacks with boost: the stronger of the two applies
  ACCELERATION_MULTIPLIER: 1.5,
  RADIUS: 20,
  HUE: 28, // amber: gold is reserved for coins and the King
  SPAWN_IN_TIME: 0.6,
  TRAIL_LENGTH: 10,
  TRAIL_INTERVAL: 0.025,
  SPARK_INTERVAL: 0.03,
});

export const POWER_UPS = Object.freeze({
  MAX_ACTIVE: 2, // power-ups are moments, not a carpet
  SPAWN_INTERVAL_MIN: 15,
  SPAWN_INTERVAL_MAX: 24,
  SPAWN_NEAR_PLAYER_MIN: 500,
  SPAWN_NEAR_PLAYER_MAX: 1400,
  SPAWN_WEIGHTS: Object.freeze({
    surge: 0.38,
    magnet: 0.3,
    vision: 0.14,
    tracker: 0.14,
    zoom: 0.14,
    multiplier: 0.1,
  }),
  MAGNET: Object.freeze({
    DURATION: 6,
    HUE: 285,
    RANGE: 420,
    PULL_SPEED: 320,
  }),
  VISION: Object.freeze({
    DURATION: 8,
    HUE: 120,
  }),
  // Tracker: every rival with an open trail (exposed) is marked on screen and on the minimap.
  // Without it, exposure is not highlighted at all.
  TRACKER: Object.freeze({
    DURATION: 10,
    HUE: 352,
  }),
  // Zoom: the camera pulls back so you see much more of the map (yellow).
  ZOOM: Object.freeze({
    DURATION: 10,
    HUE: 50,
    VIEW_SCALE: 1.5, // the view is this much wider while it lasts
  }),
  // 5X: pickups pay five times their value in score (energy refill is unchanged) and
  // world coins are worth five times as much, for a short window.
  MULTIPLIER: Object.freeze({
    DURATION: 10,
    HUE: 318,
    FACTOR: 5,
  }),
});

// Bot difficulty (chosen on the start screen, saved per device). Multipliers on bot behaviour:
//   aggression: chance to start a chase · sense: how far they notice you · think: seconds between
//   decisions (lower = faster reactions) · chase: how long they keep chasing · turn: turn rate ·
//   speed: chase speed (x CHASE_THROTTLE, capped at full) · boost: boost earlier (x boostMin) ·
//   playerBonus: extra interest in the human player · fight: fighting back (defend + grudge) ·
//   expand: expansion drive · infight: how much bots go after OTHER bots (low = they gang up
//   on you and grow big) · caution: how early an exposed bot runs home (x DANGER_RANGE) ·
//   growth: how big a big empire's loops get (x LOOP_GROWTH_MAX) · beef: chance per decision that
//   a bot you knocked out comes looking for you (anywhere on the map) · aim: how close behind
//   your head they cut your trail (trail points; fewer = harder to outrun) · loops: size of each loop ·
//   apex: a bot holding at least this % of the map turns predator (0 = off): it hunts and raids
//   smaller bots (apexHunt x) and takes their land, so a few empires snowball · hunters: bots whose
//   job is to track YOU down anywhere on the map · playerSense: how far bots notice you (x) ·
//   playerFocus: every bot is willing to hunt you (ignores its cautious persona).
export const DIFFICULTY = Object.freeze({
  DEFAULT: 'normal',
  STORAGE_KEY: 'crownloop.difficulty',
  LEVELS: Object.freeze({
    easy: Object.freeze({
      label: 'EASY', aggression: 1, sense: 1, think: 1, chase: 1, turn: 1, speed: 1, boost: 1, playerBonus: 0,
      fight: 1, expand: 1, infight: 1, caution: 1, growth: 1, loops: 1, apex: 0, apexHunt: 1, beef: 0.15, aim: 10, hunters: 0, playerSense: 1, playerFocus: false,
    }),
    normal: Object.freeze({
      label: 'NORMAL', aggression: 1.45, sense: 1.3, think: 0.6, chase: 1.5, turn: 1.15, speed: 1.03, boost: 0.7,
      playerBonus: 0.2, fight: 1.3, expand: 1.5, infight: 0.45, caution: 1.2, growth: 1.6, loops: 1.3, apex: 3.5, apexHunt: 1.2, beef: 0.45, aim: 7, hunters: 2, playerSense: 1.5, playerFocus: true,
    }),
    hard: Object.freeze({
      label: 'HARD', aggression: 2.1, sense: 1.7, think: 0.35, chase: 2.4, turn: 1.3, speed: 1.08, boost: 0.35,
      playerBonus: 0.55, fight: 1.6, expand: 2, infight: 0.25, caution: 1.4, growth: 2.2, loops: 1.7, apex: 2, apexHunt: 5, beef: 0.85, aim: 4, hunters: 5, playerSense: 2.2, playerFocus: true,
    }),
  }),
});

export const ENEMY = Object.freeze({
  // Rival count = WORLD.CAPACITY - 1 (every other seat in the world).
  RESPAWN_DELAY: 3,
  SPAWN_SAFE_DISTANCE: 1400, // never (re)spawn on top of the player
  REGION_SPAWN_CHANCE: 0.5, // otherwise spawn anywhere in the world
  REGION_SPAWN_MAX: 3000, // "the player's region": off-screen, but close enough to meet
  SPAWN_MARGIN: 200,
  SPAWN_ATTEMPTS: 20,
  SENSE_RANGE: 650,
  ENERGY_SEARCH_RANGE: 450,
  DECISION_INTERVAL_MIN: 0.35,
  DECISION_INTERVAL_MAX: 0.9,
  PLAYER_INTEREST_BONUS: 0.15,
  CHASE_THROTTLE: 0.93,
  WANDER_THROTTLE: 0.7,
  EXPOSED_THROTTLE: 0.9, // trail open: hurry (a real player doesn't dawdle while exposed)
  RETURN_BOOST_SHARE: 0.7, // boost home once the trail is this share of its loop limit
  // Territory war: from its own land a bot picks a GOAL every few seconds: push its border
  // outward (expand), loop through a neighbour's land to steal it (raid), or forage energy.
  GOAL_TIME: 4, // seconds a goal is kept before re-deciding
  EXPAND_REACH: Object.freeze([320, 660]), // how far past its border an expansion loop reaches
  RAID_RANGE: 1700, // neighbours whose land centre is this close can be raided
  RAID_MIN_CELLS: 40, // ...if they hold at least this much
  // Bigger empires take bigger bites: loop limits grow with sqrt(owned cells) / LOOP_GROWTH,
  // by at most LOOP_GROWTH_MAX extra (x2.6 for a large empire).
  LOOP_GROWTH: 14,
  LOOP_GROWTH_MAX: 1.6,
  // Fighting back. A rival's open trail inside (or right at) a bot's land is an invasion: the
  // bot goes after it. A bot remembers who knocked it out last and hunts them on sight. An
  // exposed bot with a rival bearing down on it runs home with boost instead of dawdling.
  DEFEND_RANGE: 900, // invaders whose trail is this close to the bot are fought
  DEFEND_CHANCE: 0.85, // per decision, scaled by difficulty
  GRUDGE_CHANCE: 0.7,
  GRUDGE_SENSE: 1.5, // the grudge target is noticed from this much farther
  // Never run over its own trail: look this far ahead and turn away if the line would cross it.
  SELF_TRAIL_LOOKAHEAD: 170,
  DANGER_RANGE: 650, // a rival this close while the bot's trail is open = run home

  MAX_CHASE_TIME: 3.5,
  WAYPOINT_REACHED: 60,
  // Per-profile aggression, loop sizes, home range etc. live in PERSONAS below.
  ROAM_RANGE: 3200,
  RETURN_SEARCH_CELLS: 40, // how far to look for the nearest owned cell
  WALL_AVOID_DISTANCE: 250,
  // After a bump, an AI heads off elsewhere instead of grinding against its rival.
  BUMP_RETREAT_MIN: 350,
  BUMP_RETREAT_MAX: 800,
  BUMP_COMMIT_TIME: 1.2, // seconds before it re-decides
  WALL_AVOID_STRENGTH: 1.5,
  MAX_TURN_RATE: 3.2, // rad/s: bots turn in arcs (players have no cap)
  // Four simple behaviour profiles (no memory, no grudges): just different numbers.
  //   hunt: 'any' = any exposed rival in range; 'guard' = only rivals near its home;
  //         'easy' = rivals with a long open trail, or very close ones
  PERSONAS: Object.freeze({
    aggressive: Object.freeze({
      aggression: [0.55, 0.8], sense: 1.25, hunt: 'any', chaseCooldown: 1.5,
      loopCells: [10, 26], loopPoints: [70, 130], homeRange: 1300, roamChance: 0.15, boostMin: 20,
      expand: 0.5, raid: 0.35,
    }),
    defensive: Object.freeze({
      aggression: [0.5, 0.7], sense: 1, hunt: 'guard', guardRange: 700, chaseCooldown: 3,
      loopCells: [8, 20], loopPoints: [55, 110], homeRange: 650, roamChance: 0.04, boostMin: 45,
      expand: 0.75, raid: 0.08,
    }),
    explorer: Object.freeze({
      aggression: [0.08, 0.2], sense: 0.8, hunt: 'any', chaseCooldown: 5,
      loopCells: [26, 52], loopPoints: [140, 240], homeRange: 1700, roamChance: 0.3, boostMin: 60,
      expand: 0.8, raid: 0.05,
    }),
    opportunist: Object.freeze({
      aggression: [0.5, 0.75], sense: 1.15, hunt: 'easy', minPreyTrail: 12, easyRange: 320, chaseCooldown: 2,
      loopCells: [10, 30], loopPoints: [60, 140], homeRange: 1100, roamChance: 0.12, boostMin: 25,
      expand: 0.55, raid: 0.25,
    }),
  }),
  PERSONA_ORDER: Object.freeze(['aggressive', 'opportunist', 'explorer', 'defensive']), // by seat
  TURN_SLOWDOWN_ANGLE: 0.6, // radians off-target before a bot slows into the turn...
  TURN_SLOWDOWN_MIN: 0.3, // ...down to this share of its speed for a full reversal
  EXPOSED_WAYPOINT_SPREAD: 0.9, // radians either side of its heading while its trail is open
  // Exposed AI keeps its distance from other bodies (contact would be lethal)...
  CONTACT_AVOID_DISTANCE: 170,
  CONTACT_AVOID_STRENGTH: 3,
  // Going home to close a loop: keep this much clearance from its own trail, detouring if needed.
  RETURN_CLEARANCE: 12,
  // When it decides to go home, it first swings sideways this far (a wide loop, not a hairpin).
  WIDEN_MIN: 140,
  WIDEN_MAX: 320,
  WIDEN_TIME: 2.2, // seconds at most
  RETURN_DETOUR_ANGLE: 1.1, // radians off the direct line
  RETURN_DETOUR_DISTANCE: 220,
  // ...and aims at a point this many path points behind the prey's head to cut its trail.
  TRAIL_AIM_POINTS: 10,
  NAMES: Object.freeze([
    'VEX', 'NYX', 'ORBIS', 'KAEL', 'ZYRA', 'QUILL', 'MOTH', 'IONIS', 'RIFT', 'SOL',
    'TARN', 'ECHO', 'VANTA', 'KRILL', 'HALO', 'ZEN', 'AXIOM', 'BLITZ', 'CINDER', 'DRIFT',
    'EMBER', 'FANG', 'GLYPH', 'HEX', 'ION', 'JINX', 'KITE', 'LUMEN', 'MIRA', 'NEON',
    'OPAL', 'PRISM', 'QUARK', 'RUNE', 'SPARK', 'TIDE', 'UMBRA', 'VOLT', 'WISP', 'XENO',
    'ZEPH', 'ASTRA', 'BOLT', 'COMET', 'DUNE', 'ONYX', 'RAZE', 'SABLE', 'TALON', 'LYNX',
  ]),
  // Rival colours come from their element (skins.elementColor), quieter than the player's.
  SATURATION: 0.62, // rivals are less saturated than the player
});

// A deliberate first encounter: energy at your feet, an opponent nearby, then more rivals.
export const STARTER = Object.freeze({
  LOCAL_RIVAL_COUNT: 3,
  LOCAL_RIVAL_DISTANCE_MIN: 1000, // first minute: energy first, then a meeting around 30-50 s
  LOCAL_RIVAL_DISTANCE_MAX: 1400,
  LOCAL_RIVAL_WANDER_DELAY: 45,
  FAR_RIVAL_DISTANCE_MIN: 1700,
  FAR_RIVAL_DISTANCE_MAX: 2100,
  FAR_RIVAL_GRACE: 35,
  NEIGHBOURS: 6, // extra rivals placed in the player's region
  NEIGHBOUR_DISTANCE_MIN: 2400, // ...but far enough that they don't arrive in the first seconds
});

export const TERRITORY = Object.freeze({
  CELL_SIZE: 40,
  CLAIM_RADIUS_FACTOR: 1.35,
  MAX_SLOTS: 64, // owner ids are stored in a Uint8Array
  SETTLE_TIME: 3, // land counts as a safe home once you've held it this long
  START_RADIUS: 120, // home base on every (re)spawn: something to loop out from and back to
  // Loop capture: leave your land → your trail marks the path → reconnect → the enclosed area is yours.
  CAPTURE_TIERS: Object.freeze({
    BIG: 150,
    HUGE: 450,
  }),
  CAPTURE_REWARD_SCALING: Object.freeze({
    BASE: 1,
    BIG: 1.35,
    HUGE: 1.75,
  }),
  BIG_CAPTURE_CELLS: 150, // captures this large get the bigger sound / pulse
  HUGE_CAPTURE_CELLS: 450, // larger captures trigger the full-area spectacle + bigger screen response
  RIVAL_SATURATION_FACTOR: 0.68, // rival land is quieter than the player's (× element saturation)
  FILL_ALPHA: 0.14,
  PLAYER_FILL_ALPHA: 0.23,
  BORDER_ALPHA: 0.42,
  PLAYER_BORDER_ALPHA: 0.72,
  BORDER_LIGHTNESS: 44, // darker edges read on the light floor
  BORDER_LIGHTNESS_DARK: 68, // lighter edges on dark floors (render/floorThemes.js)
  FILL_LIGHTNESS: 54,
  TRAIL_LIGHTNESS: 46,
  TRAIL_OUTLINE: 'rgba(20, 28, 45, 0.28)',
  KING_BORDER: 'rgba(255, 211, 77, 0.9)', // the King's frontier uses the crown identification color
  KING_BORDER_WIDTH_PX: 1.8,
  TRAIL_ALPHA_PLAYER: 0.9,
  TRAIL_ALPHA_RIVAL: 0.6,
  TRAIL_WIDTH: 8,
  TRAIL_OUTLINE_WIDTH: 4,
  TRAIL_POINT_SPACING: 8,
  TRAIL_SELF_CUT_EXCLUSION_SEGMENTS: 8,
  // Your OWN trail only counts as cut when the core of your body crosses it, so bigger
  // characters don't clip their own trail on tight turns (rival cuts still use the full body).
  SELF_CUT_RADIUS_FACTOR: 0.55,
  // The stretch right behind your head that can never cut you, in body radii.
  SELF_CUT_SAFE_LENGTH_RADII: 2.6,
  TRAIL_WARNING_DISTANCE: 72,
  HOME_POINTER_TRAIL_CELLS: 6, // show "back to your land" arrow once the player's trail is this long
  BORDER_WIDTH_PX: 1.1,
  PLAYER_BORDER_WIDTH_PX: 1.8,
  FLASH_ALPHA: 0.32,
  FLASH_DURATION: 0.6,
});

export const MOMENTUM = Object.freeze({
  WINDOW: 3.8,
  CHAIN_BONUS: 1,
  BIG_CAPTURE_REWARD: 2,
  FLOOR: 2,
  MAX_CHAIN: 6,
});


export const STRATEGIC_LANDMARKS = Object.freeze({
  CLAIM_BEACON: 3,
  FLUX_CORE: 3,
  RIFT: 2,
  STASIS: 2,
  TOTAL: 10,
});

// Shared tuning for the four strategic landmarks. Gameplay numbers live in each
// landmark's own block; everything presentation/claim related lives here.
export const LANDMARKS = Object.freeze({
  SCALE: 0.74, // keep strategic structures as major world anchors without dominating the arena
  LEAN: 0, // upright: no sideways shear (structures stand straight wherever they are on screen)
  RISE: 0,
  // Each landmark cycles ON/OFF on its own (staggered at the start). Its switch-on is announced
  // only when it is this close to you (or yours), at most every ANNOUNCE_GAP seconds.
  ANNOUNCE_RANGE: 1900,
  ANNOUNCE_GAP: 8,
  GLOW: 1, // global glow intensity multiplier
  PARTICLE_DENSITY: 1, // multiplier on each structure's ambient mote count
  CLAIM_TAKE_TIME: 1.6, // seconds a slot must hold the landmark's cell to claim it
  CLAIM_RELEASE_TIME: 5, // seconds neutral must hold it before it releases
  CLAIM_SEQUENCE_TIME: 1.5, // claim power-up + boundary growth animation
  CLAIM_PULSE_TIME: 0.9, // the bright pulse fired when a claim lands
  CLAIM_ANNOUNCE_COOLDOWN: 4, // min seconds between "LANDMARK SECURED" banners
  BOUNDARY_PULSES: 2, // bright pulses traveling along a claimed boundary
  BOUNDARY_PULSE_SPEED: 140, // world units per second along the edge
  AMBIENCE_RANGE: 620, // world units within which structures are audible
  AMBIENCE_INTERVAL: 2.6, // seconds between ambient landmark hums
});

export const CLAIM_BEACON = Object.freeze({
  INITIAL_DELAY_MIN: 24,
  INITIAL_DELAY_MAX: 36,
  RESPAWN_DELAY_MIN: 68,
  RESPAWN_DELAY_MAX: 92,
  NO_NEUTRAL_RETRY_DELAY: 5,
  ACTIVE_DURATION: 38,
  COOLDOWN: 30,
  INFLUENCE_RADIUS: 300,
  CLAIM_RADIUS: 280, // radius of the claimed territory boundary
  CAPTURE_VALUE_MULTIPLIER: 2,
  PLACEMENT_ATTEMPTS: 64,
  BOT_INTEREST_CHANCE: 0.24,
  BOT_INTEREST_RANGE: 1500,
  HUE: 186,
  LANDMARK_MIN_DISTANCE: 2200, // two landmarks of the same kind are never close together
});

export const FLUX_CORE = Object.freeze({
  INITIAL_DELAY_MIN: 48,
  INITIAL_DELAY_MAX: 62,
  RESPAWN_DELAY_MIN: 82,
  RESPAWN_DELAY_MAX: 104,
  NO_NEUTRAL_RETRY_DELAY: 5,
  ACTIVE_DURATION: 42,
  COOLDOWN: 30,
  PULSE_INTERVAL: 6,
  FIRST_PULSE_DELAY: 1.5,
  PICKUPS_PER_PULSE: 5,
  BURST_RADIUS: 180,
  CLAIM_RADIUS: 220,
  PLACEMENT_ATTEMPTS: 64,
  BOT_INTEREST_CHANCE: 0.22,
  BOT_INTEREST_RANGE: 1500,
  HUE: 30, // orange energy generator
  LANDMARK_MIN_DISTANCE: 2200, // two landmarks of the same kind are never close together
});

export const RIFT = Object.freeze({
  ACTIVE_DURATION: 38,
  COOLDOWN: 20,
  ENTRY_PLACEMENT_RADIUS: 70,
  ENTRY_RADIUS: 92, // how close a creature must be to engage the gate
  ACTIVATION_TIME: 0.5, // the gate "recognizes" a creature before it is absorbed
  ENTER_FX_TIME: 0.7, // absorption flare at the gate
  ARRIVAL_TIME: 0.85, // materialization effect at the destination
  // Destination: the BORDER of the traveller's own territory where it helps most: next to a
  // rival's open trail on/near its land (to cut it), else the edge facing open land, far from
  // the gate. Always on its own ground, facing outward.
  THREAT_RANGE: 520, // a rival trail this close to your border counts as an attack
  BORDER_GATE_MIN: 600, // border arrivals stay at least this far from the gate used
  ARRIVAL_CLEARANCE: 46, // owned ground around the arrival point
  TELEPORT_EDGE_MARGIN: 220, // never this close to the arena rim
  TELEPORT_CLEARANCE: 150, // owned ground that must surround the arrival point
  TELEPORT_CREATURE_GAP: 110, // clear space around other bodies on arrival
  TELEPORT_ATTEMPTS: 64,
  BOT_INTEREST_CHANCE: 0.18,
  BOT_INTEREST_RANGE: 1500,
  HUE: 272, // violet spatial tear
  LANDMARK_MIN_DISTANCE: 2200, // two landmarks of the same kind are never close together
  CLAIM_RADIUS: 260, // radius of the claimed boundary drawn around an owned gate
  USE_COOLDOWN: 18, // the gate shuts the moment someone travels through, for this long
});

export const STASIS = Object.freeze({
  INITIAL_DELAY_MIN: 156,
  INITIAL_DELAY_MAX: 176,
  RESPAWN_DELAY_MIN: 132,
  RESPAWN_DELAY_MAX: 156,
  NO_NEUTRAL_RETRY_DELAY: 6,
  ACTIVE_DURATION: 40,
  COOLDOWN: 30,
  SLOW_RADIUS: 420,
  CLAIM_RADIUS: 320,
  SPEED_MULTIPLIER: 0.65,
  PLACEMENT_ATTEMPTS: 64,
  HUE: 198,
  LANDMARK_MIN_DISTANCE: 2200, // two landmarks of the same kind are never close together
});

// Quick kills in a row: DOUBLE CUT, TRIPLE CUT, ... each pays a coin bonus.
export const KILLSTREAK = Object.freeze({
  WINDOW: 8, // seconds between kills to keep the streak going
  COINS_PER_STEP: 5, // bonus = this x (streak - 1)
  NAMES: Object.freeze(['', '', 'DOUBLE CUT!', 'TRIPLE CUT!', 'QUAD CUT!', 'RAMPAGE!']),
});

// Revenge: whoever took you out is marked for you after you rejoin.
export const REVENGE = Object.freeze({
  DURATION: 60, // seconds the mark lasts after you rejoin
  COINS: 15, // bonus for taking them out
});

export const SCORE = Object.freeze({
  PER_CELL: 10,
  PER_ELIMINATION: 25,
});

export const KING = Object.freeze({
  INDICATOR_COLOR: '#ffd34d',
  INDICATOR_HUE: 46,
  MINIMUM_ARENA_PERCENT: 6, // share of the whole map required to be crowned (with the most territory)
  // Passes the crown at once; one cell of margin only stops flicker on an exact tie.
  TAKEOVER_MARGIN_CELLS: 1,
  TAKEOVER_MARGIN_RATIO: 0,
  AURA_SCALE: 3.4,
  CROWN_SCREEN_PX: 24, // minimum on-screen width
  CROWN_RADIUS_FACTOR: 0.95, // crown width relative to the creature's radius
  CROWN_SEAT: 0.86, // band rests this far up the body (×radius): worn, not floating
  CROWN_LEAN: 0.22, // radians of lean at full sideways speed
  CROWN_SWAY: 0.035,
  CROWN_APPEAR_TIME: 0.45,
  ANNOUNCE_TIME: 1.1,
  ANNOUNCE_GRACE: 6, // no "YOU ARE KING" / "CROWN LOST" banners in the opening seconds
  ANNOUNCE_COOLDOWN: 4, // ...and at most one such banner every few seconds
});

export const MATCH = Object.freeze({
  DURATION: 8 * 60, // seconds; most territory at 00:00 wins (or the King, once everyone else is out)
  VISIBLE_COUNTDOWN: 3 * 60, // the timer stays hidden until this much time is left
  URGENT_COUNTDOWN: 60, // stronger styling for the last minute
  FINAL_COUNTDOWN: 10, // ticking sound and pulse for the last seconds
});

export const MINIMAP = Object.freeze({
  // Rivals are shown only while Vision is active; the King is always shown.
  CELLS_PER_PIXEL: 1, // retain every owned grid cell so minimap coverage matches domain area
  TEXTURE_REFRESH: 0.5,
});

export const PARTICLES = Object.freeze({
  MAX: 500,
  DRAG: 3,
  COLLECT: Object.freeze({ count: 4, speed: 90, life: 0.3, size: 2.2 }),
  ELIMINATION: Object.freeze({ count: 40, speed: 380, life: 0.9, size: 4 }),
  BUMP: Object.freeze({ count: 8, speed: 200, life: 0.3, size: 2.5 }),
  SURGE: Object.freeze({ count: 34, speed: 320, life: 0.6, size: 3.4 }),
  SURGE_SPARK: Object.freeze({ count: 1, speed: 60, life: 0.45, size: 3 }),
  CAPTURE: Object.freeze({ count: 30, speed: 260, life: 0.7, size: 3.2 }),
  COIN: Object.freeze({ count: 10, speed: 140, life: 0.45, size: 2.4 }),
  KING_CLAIM: Object.freeze({ count: 60, speed: 460, life: 1.1, size: 4.5 }),
});

export const FEEDBACK = Object.freeze({
  SHAKE_PLAYER_ELIMINATED: 16,
  SHAKE_PLAYER_KILL: 6,
  SHAKE_SURGE: 3,
  SHAKE_BUMP: 2,
  FOOD_POPUP_MERGE_TIME: 0.45, // energy pickups in quick succession share one "+N"
});

export const HUD = Object.freeze({
  UPDATE_INTERVAL: 0.2,
  LEADERBOARD_SIZE: 5,
});

export const FLOW = Object.freeze({
  RESPAWN_OVERLAY_DELAY: 0.7, // let the elimination animation play before the overlay
  KING_SCREEN_DELAY: 1.1, // let the King's elimination animation play before the screen
  WORLD_INTRO_TIME: 1.6, // "WORLD-002" callout when entering a world
});

export const AUDIO = Object.freeze({
  STORAGE_KEY: 'dominion.audio.v1',
  DEFAULT_SFX_VOLUME: 0.7,
  DEFAULT_MUSIC_VOLUME: 0.5,
  SFX_LEVEL: 0.9,
  MUSIC_LEVEL: 0.55, // music sits under the effects
  MAX_VOICES: 14, // hard cap on overlapping sounds
  PRIORITY_VOICES: 4, // extra headroom reserved for important cues
  FOOD_STREAK_WINDOW: 0.6, // pickups within this many seconds climb in pitch
  DANGER_WARN_REACHES: 2.2, // warn when an interceptor is within this many body widths
});

// Start screen: letters drop in one by one; a creature wanders behind the title.
export const TITLE = Object.freeze({
  LETTER_DELAY_START: 0.15,
  LETTER_STAGGER: 0.09,
  CREATURE_OPACITY: 0.5,
  CREATURE_SIZE: 0.09, // radius as a share of the screen's short side
  CREATURE_SPEED: 1,
});

export const TUTORIAL = Object.freeze({
  STORAGE_KEY: 'dominion.tutorialDone.v9',
  MOVE_DISTANCE: 160,
  COLLECT_VALUE: 10,
  COLLECT_MAX_TIME: 9,
  CLAIM_MAX_TIME: 14,
  BOOST_MAX_TIME: 8,
  HUNT_MAX_TIME: 8,
  KING_TIME: 5,
  HINT_TAG_TIME: 90, // in-world "SEVER" / "EXPOSED" tags during the first minute and a half
});
