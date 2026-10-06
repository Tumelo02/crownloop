import {
  AUDIO, BOOST, COMBAT, ENEMY, KILLSTREAK, REVENGE, ENERGY, FEEDBACK, FLUX_CORE, FLOW, KING, LANDMARKS, MATCH, MOMENTUM,
  PARTICLES, RIFT,
  PLAYER, POWER_UPS, RENDER, SCORE, STASIS, STARTER, SURGE, TERRITORY, TUTORIAL, WORLD,
} from '../config.js';
import { AudioManager } from '../audio/AudioManager.js';
import { CoinField } from '../entities/CoinField.js';
import { Enemy } from '../entities/Enemy.js';
import { EnergyField } from '../entities/Energy.js';
import { Player } from '../entities/Player.js';
import { CoinRewards } from '../progression/CoinRewards.js';
import { PlayerProgress } from '../progression/PlayerProgress.js';
import { ProgressionSystem } from '../progression/ProgressionSystem.js';
import {
  generatePlayerName, initialPlayerName, rememberPlayerName, sanitizePlayerName,
} from '../progression/playerName.js';
import {
  SKINS, elementColor, rivalCharacter, rivalLook, skinById,
} from '../progression/skins.js';
import { drawArenaFloor, drawWorldEdge } from '../render/ArenaRenderer.js';
import {
  drawCreature, drawCreatureIcon, drawCreatureOverlay,
} from '../render/CreatureRenderer.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { ClaimBeaconSystem } from '../systems/ClaimBeaconSystem.js';
import { EffectsSystem } from '../systems/EffectsSystem.js';
import { FluxCoreSystem } from '../systems/FluxCoreSystem.js';
import { RiftSystem } from '../systems/RiftSystem.js';
import { StasisSystem } from '../systems/StasisSystem.js';
import { StrategicLandmarkManager } from '../systems/StrategicLandmarkManager.js';
import { drawRiftArrivals, warmLandmarkRenderers, drawLandmarkPlate } from '../render/StrategicLandmarkRenderer.js';
import { ElementalEffects } from '../systems/ElementalEffects.js';
import { CombatEffectManager } from '../systems/CombatEffects.js';
import { CaptureWaves } from '../render/captureWaves.js';
import { drawExposureCue } from '../render/exposureCue.js';
import { paintDeathSnapshot } from '../render/deathSnapshot.js';
import { KingSystem } from '../systems/KingSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { TerritorySystem } from '../systems/TerritorySystem.js';
import { AnnounceStyle, Announcer } from '../ui/Announcer.js';
import { HUD, paintCoinIcons, paintCrownIcons } from '../ui/HUD.js';
import { Minimap } from '../ui/Minimap.js';
import { MobileJoystick } from '../ui/MobileJoystick.js';
import { Screens } from '../ui/Screens.js';
import { SkinPicker } from '../ui/SkinPicker.js';
import { SoundControls } from '../ui/SoundControls.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { ThemeToggle } from '../ui/ThemeToggle.js';
import { WheelPanel } from '../ui/WheelPanel.js';
import { HowToPanel } from '../ui/HowToPanel.js';
import { AccountName } from '../ui/AccountName.js';
import { DifficultyPicker } from '../ui/DifficultyPicker.js';
import { setBotDifficulty } from '../entities/Enemy.js';
import { shareGame } from '../ui/share.js';
import { POWER_UP_ITEMS } from '../progression/storeCatalog.js';
import { StorePanel } from '../ui/StorePanel.js';
import { LeaderboardPanel, MissionsPanel, StatsPanel, showMenuToast } from '../ui/MenuPanels.js';
import { ItemBar } from '../ui/ItemBar.js';
import { DEFAULT_FLOOR_ID, currentFloor, setFloor } from '../render/floorThemes.js';
import { TitleScreen } from '../ui/TitleScreen.js';
import { drawDirectionIndicator } from '../render/directionIndicator.js';
import { Tutorial } from '../ui/Tutorial.js';
import { clamp, distSq, randItem, randRange } from '../utils/math.js';
import { WorldManager } from '../world/WorldManager.js';
import { EliminationReason, MatchState } from '../world/WorldSession.js';
import { Camera, isInBounds } from './Camera.js';
import { EventBus, GameEvent } from './EventBus.js';
import { GameLoop } from './GameLoop.js';
import { Input, InputMode } from './Input.js';
import { ControllerKind, Roster } from './Roster.js';

export const GameState = Object.freeze({
  MENU: 'menu',
  PLAYING: 'playing',
  RESPAWNING: 'respawning', // normal elimination: waits for explicit rejoin
  KING_ELIMINATED: 'kingEliminated', // intercepted by the King: this world is closed to the player
  ROUND_OVER: 'roundOver',
});

const byDrawOrder = (a, b) => a.id - b.id;
const KING_GOLD_HUE = KING.INDICATOR_HUE;
const COIN_GOLD = '#ffd66b';
const EXPOSURE_NEAR_TRAIL = 120; // world units from an older part of your own trail
const EXPOSURE_SKIP_TRAIL = 220; // newest trail length ignored for that test
// Popups float over the light arena: saturated mid-tones with a dark outline read best.
const FOOD_POPUP_COLOR = '#2ee3ff';
const KILL_POPUP_COLOR = '#2fe0b0';
const LAND_POPUP_COLOR = '#2fe0b0';
const SURGE_POPUP_COLOR = `hsl(${SURGE.HUE}, 100%, 66%)`;
// What players see for each power-up (code ids stay surge / vision / ...).
const POWER_UP_LABELS = Object.freeze({
  surge: 'SPEED', magnet: 'MAGNET', vision: 'RADAR', tracker: 'TRACKER', zoom: 'ZOOM', multiplier: '5X', shield: 'SHIELD', phase: 'GHOST',
});
const POWER_UP_COLORS = Object.freeze({
  surge: SURGE_POPUP_COLOR,
  magnet: `hsl(${POWER_UPS.MAGNET.HUE}, 100%, 75%)`,
  vision: `hsl(${POWER_UPS.VISION.HUE}, 100%, 76%)`,
  tracker: `hsl(${POWER_UPS.TRACKER.HUE}, 100%, 70%)`,
  zoom: `hsl(${POWER_UPS.ZOOM.HUE}, 100%, 62%)`,
  multiplier: `hsl(${POWER_UPS.MULTIPLIER.HUE}, 100%, 72%)`,
});
const MULTIPLIER_POPUP_COLOR = `hsl(${POWER_UPS.MULTIPLIER.HUE}, 95%, 62%)`;
const POWER_UP_DURATIONS = Object.freeze({
  surge: SURGE.DURATION,
  magnet: POWER_UPS.MAGNET.DURATION,
  vision: POWER_UPS.VISION.DURATION,
  tracker: POWER_UPS.TRACKER.DURATION,
  zoom: POWER_UPS.ZOOM.DURATION,
  multiplier: POWER_UPS.MULTIPLIER.DURATION,
});
const EMPTY_ROSTER = new Roster();

function shuffled(items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

/** Composition root: owns the current world, wires systems together, runs update/render. */
/** Banner + sound when a landmark near you (or yours) switches on. */
const LANDMARK_ANNOUNCE = Object.freeze({
  beacon: { title: 'BONUS TOWER IS ON', sub: 'Land you capture in its ring scores double', sound: 'claimBeacon' },
  flux: { title: 'ENERGY CORE IS ON', sub: 'It sprays free energy every few seconds', sound: 'fluxCoreOnline' },
  rift: { title: 'TELEPORTER IS OPEN', sub: 'Step in (trail closed) to jump to your border', sound: 'riftOnline' },
  stasis: { title: 'SLOW TOWER IS ON', sub: 'Rivals in its ring move 35% slower (not you)', sound: 'stasisOnline' },
});

export class Game {
  constructor(canvas, { platform = null, progressStorage = window.localStorage } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = 1;
    this.width = 0;
    this.height = 0;

    this.events = new EventBus();
    this.camera = new Camera();
    this.joystick = new MobileJoystick();
    this.input = new Input(canvas, this.joystick, document.getElementById('mouse-pointer'));
    this.hud = new HUD();
    this.screens = new Screens();
    this.announcer = new Announcer();
    this.tutorial = new Tutorial();
    this.vignette = document.getElementById('vignette');

    // All sound goes through one manager; it starts on the first PLAY click (autoplay rules).
    this.platform = platform;
    this.input.setMouseLockRequired(Boolean(platform?.requiresMouseLock));
    this.audio = new AudioManager();
    this.platform?.bindAudio(this.audio);
    this.soundControls = new SoundControls(this.audio);
    this.settings = new SettingsPanel(this.audio);
    this.theme = new ThemeToggle(this.audio, () => this.title?.backdrop.repaint());
    document.addEventListener('click', (e) => {
      const button = e.target.closest && e.target.closest('button');
      if (!button || button.matches('#play-button, #again-button, #king-button, [data-sound-toggle]')) return;
      this.audio.unlock();
      this.audio.play('click');
    });
    this.foodStreak = 0;
    this.foodStreakAt = -Infinity;
    this.momentumChain = 0;
    this.momentumLastActionAt = -Infinity;
    this.wasBoosting = false;
    this.activePowerUpIds = new Set();

    // Persistent cosmetic progression, independent of any run, world or creature.
    this.progress = new PlayerProgress(progressStorage);
    this.career = new ProgressionSystem(this.progress);
    this.coins = new CoinRewards(this.progress, (amount) => this.hud.coinGained(amount));
    this.skinPicker = new SkinPicker(
      [document.getElementById('start-skins')],
      this.progress,
      this.audio,
      this.events,
    );
    // A floor you no longer own (or a saved id that no longer exists) falls back to the default.
    if (!this.progress.isFloorUnlocked(currentFloor().id)) setFloor(DEFAULT_FLOOR_ID);
    this.store = new StorePanel(this.audio, this.settings, this.progress, this.platform);
    // Menu: LEADERBOARD (local / worldwide) and MY STATS sheets, beside the store button.
    const menuName = () => sanitizePlayerName(this.screens.typedName) || this.playerName || 'Player';
    this.statsPanel = new StatsPanel(this.audio, this.progress, () => this.career.snapshot, menuName);
    this.leaderboardPanel = new LeaderboardPanel(this.audio, this.progress, this.platform, menuName,
      (ctx, skinId, size) => {
        const skin = skinById(skinId);
        drawCreatureIcon(ctx, skin.look, size / 2, size / 2 + 2, size * 0.3, 1, 0, skin);
      });
    this.missionsPanel = new MissionsPanel(this.audio, this.progress);
    // Invite: menu tile and the leaderboard's INVITE FRIENDS button share the game link.
    const invite = () => shareGame(this.platform);
    document.getElementById('invite-button')?.addEventListener('click', invite);
    this.leaderboardPanel.onInvite = invite;
    this.wheelPanel = new WheelPanel(this.audio, this.progress, this.platform);
    this.difficulty = new DifficultyPicker(this.audio);
    this.howToPanel = new HowToPanel(this.audio, () => this.progress.selectedCharacter, () => {
      this.tutorial.replayNext();
      document.getElementById('play-button')?.click();
    });
    for (const sheet of [this.statsPanel, this.leaderboardPanel, this.missionsPanel]) {
      sheet.button?.addEventListener('click', () => {
        this.store.toggle(false);
        this.settings.toggle(false);
      });
    }
    document.getElementById('store-button')?.addEventListener('click', () => {
      this.statsPanel.toggle(false);
      this.leaderboardPanel.toggle(false);
      this.missionsPanel.toggle(false);
    });
    this.statTime = 0; // seconds alive not yet written to the lifetime stats
    this.welcomeBack();
    // Bought power-ups, usable during a match (bottom bar; number keys).
    this.itemBar = new ItemBar(this.progress, (type) => this.useStoredPowerUp(type));
    this.itemBarShown = false;
    this.progress.onChange((p) => {
      this.showCoins(p.coins);
      this.screens.renderCareer(document.getElementById('start-career'), this.career.snapshot);
      this.hud.setCareer(this.career.snapshot);
    });
    this.hud.setCareer(this.career.snapshot);
    this.showCoins(this.progress.coins);

    // Worlds: one contained match at a time locally, but shaped for a future server.
    this.worlds = new WorldManager();
    this.identity = this.worlds.localPlayer;
    this.world = null;

    this.energy = new EnergyField();
    this.coinField = new CoinField();
    this.territory = new TerritorySystem(WORLD.WIDTH, WORLD.HEIGHT);
    this.particles = new ParticleSystem();
    this.effects = new EffectsSystem();
    this.elementalEffects = new ElementalEffects();
    this.captureWaves = new CaptureWaves();
    this.collisions = new CollisionSystem(this.events);
    this.kings = new KingSystem();
    this.claimBeacon = new ClaimBeaconSystem();
    this.fluxCore = new FluxCoreSystem();
    this.rift = new RiftSystem();
    this.stasis = new StasisSystem();
    // Shared claim/ownership state across the four landmark systems (event-driven).
    this.landmarkManager = new StrategicLandmarkManager();
    this.landmarkSystems = {
      beacon: this.claimBeacon, flux: this.fluxCore, rift: this.rift, stasis: this.stasis,
    };
    this.landmarkAmbienceTimer = 0;
    this.lastLandmarkClaimAt = -Infinity;
    this.domainScores = new Float64Array(TERRITORY.MAX_SLOTS);
    this.minimap = new Minimap(document.getElementById('minimap'), this.territory);
    this.spawner = new SpawnSystem({
      getPlayer: () => this.player,
      getCreatures: () => this.creatures,
      ownerAt: (x, y) => this.territory.ownerAt(x, y),
      addPowerUp: (powerUp) => this.powerUps.push(powerUp),
      countPowerUps: () => this.powerUps.length,
    });

    this.creatures = [];
    this.visibleCreatures = [];
    this.powerUps = [];
    this.player = null;
    this.local = null; // the local participant
    // Name shown on the start screen: the last one this player typed, or a generated default.
    this.playerName = initialPlayerName();
    this.prefilledName = this.playerName;
    // On CrazyGames the name is the player's CrazyGames username (guests get a generated one).
    this.account = new AccountName(this.platform, (name) => {
      this.playerName = name;
      this.prefilledName = name;
    });
    this.initialPlayerSpawn = true;
    this.state = GameState.MENU;
    this.time = 0;
    this.nextId = 1;
    this.deathTimer = 0;
    this.deathResult = null;
    this.kingOut = null;
    this.bumpCooldown = 0;
    this.sparkTimer = 0;
    this.hintTime = 0;
    this.foodPopup = null;
    this.foodPopupAt = 0;
    this.collectedThisLife = 0;
    this.wasSafe = false;
    this.dangerNearby = false;
    this.capturedThisFrame = false;
    this.cameraTarget = null;
    this.lastTickSecond = -1;
    this.vacantSlots = [];
    this.playerScreen = { x: 0, y: 0 };
    this.aiWorld = {
      creatures: this.creatures, energy: this.energy, territory: this.territory,
      claimBeacon: this.claimBeacon, fluxCore: this.fluxCore, rift: this.rift,
    };

    this.loop = new GameLoop((dt) => this.update(dt), (dt) => this.render(dt));

    this.bindEvents();
    // Every gameplay MOMENT (slices, eliminations, contact, power-ups) gets its
    // visual + audio response from one place: systems/CombatEffects.js.
    this.combat = new CombatEffectManager(this);
    // Development-only effect test panel (`?fxtest`); absent in normal play.
    if (new URLSearchParams(window.location.search).has('fxtest')) {
      import('../ui/EffectTestPanel.js').then(({ EffectTestPanel }) => { this.fxTest = new EffectTestPanel(this); });
    }
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.screens.onPlay(() => this.enterWorld(true));
    this.screens.onNameEnter(() => { if (this.state === GameState.MENU) this.enterWorld(true); });
    this.screens.onNewWorld(() => this.enterWorld(false));
    this.screens.onRejoin(() => this.rejoinMatch());
    this.screens.onHome(() => this.goHome());
    this.screens.showStart(this.playerName, WORLD.CAPACITY, this.career.snapshot);
    this.paintIcons();

    // Menu showcase: the selected character performs its element every few seconds,
    // with a soft cue (SFX volume and mute apply; silent until audio is unlocked).
    this.title = new TitleScreen(
      () => this.progress.selectedCharacter,
      (element) => this.audio.play('showcase', { element }),
    );
    this.title.show();
    // Music is asked for now and starts on the first interaction (browser autoplay rules).
    this.audio.playMusic('menu');
    // Some mobile browsers (iOS Safari) only allow audio from touchend/click, not
    // pointerdown, so keep trying on each kind of gesture until the context is running.
    const gestures = ['pointerdown', 'touchend', 'click', 'keydown'];
    const firstGesture = () => {
      this.audio.unlock();
      if (this.audio.ctx && this.audio.ctx.state !== 'running') return;
      for (const type of gestures) window.removeEventListener(type, firstGesture, true);
    };
    for (const type of gestures) window.addEventListener(type, firstGesture, true);
  }

  /**
   * The name to play with: what the player typed (validated), or a generated "Player NNN"
   * if the field is blank. A name the player chose is remembered; untouched defaults aren't.
   */
  resolvePlayerName() {
    if (this.account?.locked) return sanitizePlayerName(this.screens.typedName) || this.playerName;
    const typed = sanitizePlayerName(this.screens.typedName);
    if (!typed) return generatePlayerName();
    if (typed !== this.prefilledName || !typed.startsWith(`${PLAYER.NAME_PREFIX} `)) rememberPlayerName(typed);
    return typed;
  }

  /** Canvas coin/crown icons are painted at their on-screen size, so repaint when screens change. */
  paintIcons() {
    paintCrownIcons();
    paintCoinIcons();
  }

  /** The seats of the world being played (empty before the first world). */
  get roster() {
    return this.world ? this.world.roster : EMPTY_ROSTER;
  }

  // ---------------------------------------------------------------- lifecycle

  showCoins(total) {
    this.hud.setCoins(total);
    this.screens.setWallet(total);
  }

  awardProgress(result) {
    if (result.rankUp) {
      // A quick badge reveal (HUD toast) + a short sound; gameplay is never interrupted.
      this.hud.showRankUp(this.career.snapshot);
      this.audio.play('rankUp');
    }
  }

  /**
   * Joins a world. From the start screen that's the first world; afterwards ("ENTER NEW
   * WORLD") the WorldManager picks a running world with a free seat that hasn't closed this
   * player out, otherwise it opens a new one.
   */
  enterWorld(first) {
    setBotDifficulty(this.difficulty.level); // bots spawned in this match use the chosen level
    this.audio.unlock();
    this.audio.play(first ? 'play' : 'worldTransition');
    if (first) {
      this.playerName = this.resolvePlayerName();
      this.title.hide();
    }
    this.audio.playMusic('game');
    this.audio.setMusicIntensity(0);
    if (this.world && this.world.state === MatchState.ENDED) this.worlds.retire(this.world);

    this.world = this.worlds.findWorldFor(this.identity);
    this.world.start();
    this.wasBoosting = false;
    this.activePowerUpIds.clear();
    this.coins.startRun();
    this.career.resetMatch();
    this.resetWorld();
    warmLandmarkRenderers();
    this.state = GameState.PLAYING;
    this.input.setEnabled(true);
    this.input.requestMouseLock();
    this.platform?.gameplayStart();
    this.screens.hideAll();
    this.hud.show();
    this.minimap.resize(this.dpr);
    this.tutorial.begin(
      this.input.mode === InputMode.TOUCH,
      this.input.mouseLockRequired,
    );
    // No world / galaxy identifier on screen: it's an internal concept.
    this.announcer.show('CROWNLOOP', 'Hold the most territory',
      AnnounceStyle.GROW, FLOW.WORLD_INTRO_TIME);
    this.loop.start();
  }

  resetWorld() {
    this.creatures.length = 0;
    this.powerUps.length = 0;
    const roster = this.roster;
    roster.reset();

    this.time = 0;
    this.deathTimer = 0;
    this.deathResult = null;
    this.kingOut = null;
    this.bumpCooldown = 0;
    this.hintTime = TUTORIAL.HINT_TAG_TIME;
    this.initialPlayerSpawn = true;
    this.lastTickSecond = -1;
    this.input.setEnabled(false);
    this.input.reset();
    this.territory.reset();
    this.claimBeacon.reset(this.territory);
    this.fluxCore.reset(this.territory);
    this.rift.reset(this.territory);
    this.stasis.reset(this.territory);
    this.landmarkManager.reset();
    this.landmarkAmbienceTimer = 0;
    this.lastLandmarkClaimAt = -Infinity;
    this.domainScores.fill(0);
    this.energy.reset();
    this.coinField.reset();
    this.particles.clear();
    this.effects.clear();
    this.elementalEffects.clear();
    this.combat.clear();
    this.captureWaves.clear();
    this.spawner.reset();
    this.kings.reset();
    this.minimap.reset();
    this.announcer.clear();

    // Seats: slot 1 is the local player, the rest are AI (later: remote players).
    // Colours follow the element: the player gets its element's exact hue, rivals the
    // closest free variation of theirs (skins.elementColor).
    const mine = elementColor(this.progress.selectedCharacter, []);
    this.local = roster.add({
      slot: 1, name: this.playerName, hue: mine.hue, kind: ControllerKind.LOCAL, playerId: this.identity.playerId,
    });
    this.territory.registerSlot(1, mine.hue, true, this.progress.selectedCharacter, mine.sat);
    // Generated defaults never collide with anyone in the world; a typed name is kept and
    // rivals simply avoid it. Rivals are never named after a character ("EMBER" playing
    // Glacier would be confusing).
    const reserved = new Set([this.playerName, ...SKINS.map((skin) => skin.name)].map((n) => n.toLowerCase()));
    this.rivalNames = shuffled(ENEMY.NAMES.filter((n) => !reserved.has(n.toLowerCase())));
    const rivals = Math.min(this.world.capacity - 1, TERRITORY.MAX_SLOTS - 2);
    for (let i = 0; i < rivals; i++) this.seatRival(i + 2);

    this.spawnLocalPlayer();
    this.populateRivals();
    this.refreshDomainScores();
    this.camera.snapTo(this.player);
  }

  /** Puts a new AI rival in a seat (a fresh identity: name, colour, playerId). */
  seatRival(slot) {
    this.claimBeacon.bonusCounts[slot] = 0;
    const used = new Set(this.roster.list.map((p) => p.name.toLowerCase()));
    const name = this.rivalNames.find((n) => !used.has(n.toLowerCase())) || randItem(this.rivalNames);
    const character = rivalCharacter(slot);
    const usedHues = this.roster.list.filter((p) => p.slot !== slot && !p.removed).map((p) => p.hue);
    const { hue, sat } = elementColor(character, usedHues);
    const participant = this.roster.get(slot)
      ? this.roster.replace(slot, { name, hue, kind: ControllerKind.AI })
      : this.roster.add({ slot, name, hue, kind: ControllerKind.AI });
    this.territory.registerSlot(slot, hue, false, character, sat);
    return participant;
  }

  /**
   * The first minute is staged: energy nearby, several local rivals, and the rest spread out.
   */
  populateRivals() {
    const rivals = this.roster.list.filter((p) => !p.isLocal);
    const { x, y } = this.player;
    let i = 0;
    for (let n = 0; n < STARTER.LOCAL_RIVAL_COUNT && i < rivals.length; n++, i++) {
      const p = this.spawner.pointNear(x, y, STARTER.LOCAL_RIVAL_DISTANCE_MIN, STARTER.LOCAL_RIVAL_DISTANCE_MAX);
      this.spawnParticipant(rivals[i], p.x, p.y, {
        forageDelay: STARTER.LOCAL_RIVAL_WANDER_DELAY,
      });
    }
    if (i < rivals.length) {
      const p = this.spawner.pointNear(x, y, STARTER.FAR_RIVAL_DISTANCE_MIN, STARTER.FAR_RIVAL_DISTANCE_MAX);
      this.spawnParticipant(rivals[i++], p.x, p.y, { chaseGrace: STARTER.FAR_RIVAL_GRACE });
    }
    for (let n = 0; n < STARTER.NEIGHBOURS && i < rivals.length; n++, i++) {
      const p = this.spawner.enemyPoint(1, STARTER.NEIGHBOUR_DISTANCE_MIN);
      this.spawnParticipant(rivals[i], p.x, p.y);
    }
    for (; i < rivals.length; i++) {
      const p = this.spawner.enemyPoint(0);
      this.spawnParticipant(rivals[i], p.x, p.y);
    }
  }

  spawnParticipant(participant, x, y, extra = {}) {
    const CreatureClass = participant.isLocal ? Player : Enemy;
    const id = this.nextId++;
    // Character identity and look are presentation-only; all creatures keep the same rules.
    const character = participant.isLocal ? this.progress.selectedCharacter : rivalCharacter(participant.slot);
    const look = participant.isLocal
      ? character.look
      : { ...rivalLook(participant.hue, participant.slot), ...character.look, sat: ENEMY.SATURATION };
    const creature = new CreatureClass({
      id, slot: participant.slot, name: participant.name, hue: participant.hue, x, y, look, character,
      grudgeSlot: participant.grudgeSlot || 0, ...extra,
    });
    participant.creature = creature;
    participant.respawnTimer = 0;
    // Every life starts with the same small home base to loop out from and back to.
    this.territory.claimCircle(x, y, TERRITORY.START_RADIUS, participant.slot);
    this.creatures.push(creature);
    return creature;
  }

  /** (Re)joins the local player somewhere safe, with energy around them. */
  spawnLocalPlayer() {
    const point = this.spawner.playerPoint();
    this.player = this.spawnParticipant(this.local, point.x, point.y, { huntGrace: PLAYER.HUNT_GRACE });
    if (this.initialPlayerSpawn) {
      this.energy.scatterAround(point.x, point.y, ENERGY.INITIAL_CLUSTER_COUNT, ENERGY.INITIAL_CLUSTER_RADIUS);
      this.initialPlayerSpawn = false;
    }
    this.cameraTarget = this.player;
    this.coins.startLife();
    this.collectedThisLife = 0;
    this.foodStreak = 0;
    this.foodStreakAt = -Infinity;
    this.foodPopup = null;
    this.wasSafe = false;
    this.wasBoosting = false;
    this.activePowerUpIds.clear();
    // Per-life stats for the results card (XP is diffed against the match totals).
    this.life = {
      start: this.time,
      peak: 0,
      claimed: 0,
      kills: this.local.kills,
      xp: { ...this.career.earnedBySource },
      xpTotal: this.career.matchEarned,
    };
    if (this.revenge && !this.revenge.active) {
      this.revenge.active = true;
      this.revenge.until = this.time + REVENGE.DURATION;
    }
  }

  /** Every landmark for the minimap, tagged with its kind. */
  minimapLandmarks() {
    const out = this.minimapLandmarkList || (this.minimapLandmarkList = []);
    out.length = 0;
    for (const [kind, system] of [['beacon', this.claimBeacon], ['flux', this.fluxCore], ['rift', this.rift], ['stasis', this.stasis]]) {
      for (const lm of system.landmarks) {
        lm.kind = kind;
        out.push(lm);
      }
    }
    return out;
  }

  /**
   * Item bar: uses one bought charge right now, exactly like picking the power-up up in the
   * arena. Only while you are alive in a running match.
   */
  useStoredPowerUp(type) {
    const player = this.player;
    if (this.state !== GameState.PLAYING || !player || !player.alive) return false;
    if (!this.progress.usePowerUp(type)) return false;
    if (!player.applyPowerUp(type)) return false;
    this.activePowerUpIds.add(type);
    this.progress.missionEvent('powerup', 1);
    this.audio.unlock();
    this.events.emit(GameEvent.POWERUP_ACTIVATED, { creature: player, type, x: player.x, y: player.y });
    this.effects.popup(0, 0, `${POWER_UP_LABELS[type] || type.toUpperCase()}!`, POWER_UP_COLORS[type], {
      anchor: player, sizePx: 18, life: 1.3, rise: 44,
    });
    return true;
  }

  rejoinMatch() {
    if (this.state !== GameState.RESPAWNING || !this.world || this.world.state !== MatchState.RUNNING
      || this.local.removed || this.local.creature) return;
    this.territory.releaseAll(this.local.slot);
    this.local.kills = 0;
    this.local.deaths = 0;
    this.local.respawnTimer = 0;
    this.input.reset();
    this.spawnLocalPlayer();
    this.camera.snapTo(this.player);
    this.screens.hideRespawn();
    this.audio.play('respawn');
    this.state = GameState.PLAYING;
    this.input.setEnabled(true);
    this.input.requestMouseLock();
    this.platform?.gameplayStart();
  }

  removeEliminated() {
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const creature = this.creatures[i];
      if (creature.alive) continue;
      const participant = this.roster.get(creature.slot);
      if (participant && participant.creature === creature) participant.creature = null;
      this.creatures.splice(i, 1);
    }
  }

  /** AI respawn automatically. A local player must explicitly rejoin after elimination. */
  updateRespawns(dt) {
    for (const p of this.roster.list) {
      if (p.creature || p.removed) continue;
      if (p.isLocal) continue;
      p.respawnTimer -= dt;
      if (p.respawnTimer > 0) continue;
      const point = this.spawner.enemyPoint();
      this.spawnParticipant(p, point.x, point.y);
    }

    // Seats the King closed get a newcomer after a short delay (as players would join online).
    for (const slot of this.world.readyVacancies(dt, this.vacantSlots)) {
      const participant = this.seatRival(slot);
      const point = this.spawner.enemyPoint();
      this.spawnParticipant(participant, point.x, point.y);
    }
  }

  endRound() {
    this.state = GameState.ROUND_OVER;
    this.input.setEnabled(false);
    this.platform?.gameplayStop();
    const ranking = this.ranking();
    const king = this.kings.king;
    const me = ranking.findIndex((r) => r.isPlayer);
    const playerWon = Boolean(king && king.isLocal);
    this.coins.endRound({ isKing: playerWon, rank: me + 1 });
    const finalScore = this.scoreFor(this.player);
    this.flushPlayTime();
    this.progress.recordStats(
      { matches: 1, wins: playerWon ? 1 : 0 },
      { bestScore: finalScore, bestTerritory: this.domainPercentFor(this.local.slot) },
    );
    this.platform?.submitScore(finalScore);
    this.progress.missionEvent('matches', 1);
    this.career.onMatchComplete(playerWon);
    this.screens.showRoundOver({
      coinsEarned: this.coins.earned,
      winnerName: king ? king.name : null,
      winnerTerritory: king ? this.domainPercentFor(king.slot) : 0,
      playerWon,
      rank: me + 1,
      territory: this.domainPercentFor(this.local.slot),
      score: this.scoreFor(this.player), // also counts if the player was mid-respawn
    }, this.career, this.career.snapshot);
    this.audio.play(playerWon ? 'victory' : 'matchEnd');
    this.audio.playMusic('end', { variant: playerWon ? 'victory' : 'result' });
    this.paintIcons();
    this.hud.hide();
    this.tutorial.hide();
    this.announcer.clear();
  }

  /** Adds the seconds played since the last write to the lifetime stats. */
  flushPlayTime() {
    if (this.statTime <= 0) return;
    const seconds = this.statTime;
    this.statTime = 0;
    this.progress.recordStats({ timePlayed: seconds });
    this.progress.missionEvent('survive', seconds / 60);
  }

  scoreFor(creature) {
    return this.territory.countFor(creature.slot) * SCORE.PER_CELL
      + creature.kills * SCORE.PER_ELIMINATION
      + creature.bonusScore;
  }

  refreshDomainScores() {
    this.territory.scoreCounts(this.claimBeacon.bonusCounts, this.local ? this.local.slot : 0, this.domainScores);
  }

  /**
   * Strategic landmark ownership: when a domain's land actually covers a
   * structure (held through the manager's hysteresis), the landmark is claimed —
   * driving the claim sequence, the organic boundary, audio and announcements.
   */
  updateLandmarkClaims(dt) {
    const events = this.landmarkManager.update(dt, this.territory, this.landmarkSystems);
    for (const event of events) {
      this.events.emit(
        event.type === 'claimed' ? GameEvent.LANDMARK_CLAIMED : GameEvent.LANDMARK_RELEASED,
        event,
      );
      const { landmark } = event;
      if (event.type === 'claimed') {
        if (this.inView(landmark.x, landmark.y, 320)) {
          const owner = this.roster.get(event.slot);
          this.particles.emit(landmark.x, landmark.y, owner ? owner.hue : 186, PARTICLES.CAPTURE, 1.5);
        }
        if (event.slot === this.local?.slot) {
          this.progress.missionEvent('landmark', 1);
          this.audio.play('landmarkClaim');
          if (this.time - this.lastLandmarkClaimAt >= LANDMARKS.CLAIM_ANNOUNCE_COOLDOWN) {
            this.lastLandmarkClaimAt = this.time;
            this.announcer.show(`${event.label} CAPTURED`, 'It is now part of your territory',
              AnnounceStyle.SURGE, 1.6);
          }
        }
      } else if (event.previous === this.local?.slot) {
        this.audio.play('landmarkLost');
      }
    }
  }

  domainPercentFor(slot) {
    return (this.domainScores[slot] / this.territory.playableCount) * 100;
  }

  // ---------------------------------------------------------------- events

  /**
   * Volume for a world-space sound: full near the player, softer toward the screen edge
   * (never silent: anything on screen is still heard). Never 0, which synth would ignore.
   */
  soundLevelAt(x, y) {
    const p = this.player;
    if (!p) return 1;
    const reach = Math.hypot(this.width, this.height) / (2 * this.camera.zoom);
    const d = Math.hypot(x - p.x, y - p.y);
    return clamp(1 - (d / reach) * 0.65, 0.35, 1);
  }

  inView(x, y, radius) {
    return isInBounds(this.camera.getBounds(), x, y, radius);
  }

  bindEvents() {
    this.events.on(GameEvent.ENERGY_COLLECTED, ({ creature, energy, amount, points, multiplied }) => {
      const quiet = this.combat && this.combat.isCombatQuiet() && !creature.isPlayer;
      if (!quiet && this.inView(energy.x, energy.y, energy.radius)) {
        this.effects.absorbFood(energy, creature);
        this.particles.emit(energy.x, energy.y, energy.hue, PARTICLES.COLLECT);
      }
      if (creature.isPlayer) {
        this.onEnergyCollected(energy, amount, points, multiplied);
      }
    });

    this.events.on(GameEvent.POWER_UP_COLLECTED, ({ creature, powerUp }) => {
      if (!creature.applyPowerUp(powerUp.type)) {
        throw new Error(`Unsupported power-up type: ${powerUp.type}`);
      }
      const hue = powerUp.type === 'surge' ? SURGE.HUE : POWER_UPS[powerUp.type.toUpperCase()].HUE;
      const duration = POWER_UP_DURATIONS[powerUp.type];
      const pickupText = `+ ${POWER_UP_LABELS[powerUp.type] || powerUp.type.toUpperCase()} · ${duration}s`;
      if (this.inView(powerUp.x, powerUp.y, powerUp.radius)) {
        this.particles.emit(powerUp.x, powerUp.y, hue, PARTICLES.SURGE, 0.9);
      }
      this.events.emit(GameEvent.POWERUP_ACTIVATED, { creature, type: powerUp.type, x: powerUp.x, y: powerUp.y });
      if (creature.isPlayer) {
        this.activePowerUpIds.add(powerUp.type);
        this.progress.missionEvent('powerup', 1);
        this.effects.popup(0, 0, powerUp.type === 'multiplier' ? '5X MULTIPLIER' : pickupText, POWER_UP_COLORS[powerUp.type], {
          anchor: creature, sizePx: powerUp.type === 'multiplier' ? 22 : 18, life: 1.3, rise: 44,
        });
      }
    });

    this.events.on(GameEvent.TERRITORY_CAPTURED, ({ creature, capture }) => {
      // The capturer's element floods through the newly claimed land, starting where the
      // loop closed (render/captureWaves.js). Rivals' waves are a little quieter.
      const reach = Math.sqrt(capture.count) * TERRITORY.CELL_SIZE;
      if (!this.inView(capture.x, capture.y, reach + 100)) return;
      this.captureWaves.emit(creature.character || skinById('core'), capture, creature.x, creature.y,
        this.territory, creature.isPlayer ? 1 : 0.65);
    });

    this.events.on(GameEvent.CREATURE_ELIMINATED, ({ killer, victim, reason }) => this.onEliminated(killer, victim, reason));
    this.events.on(GameEvent.KING_ELIMINATION, (e) => this.onKingElimination(e));
    // Non-lethal contact (PLAYER_COLLISION): its ring, sparks and sound live in CombatEffects.
  }

  /**
   * Every elimination: trail cuts (by a rival or your own trail) and body contact
   * ('collision': exposed vs safe; 'collision-mutual': both exposed, both out).
   */
  onEliminated(killer, victim, reason = null) {
    const victimSeat = this.roster.get(victim.slot);
    const killerSeat = this.roster.get(killer.slot);
    const mutual = reason === 'collision-mutual';
    // The King's lock-out needs a King that survived the encounter.
    const byKing = Boolean(killerSeat && victimSeat && killerSeat !== victimSeat
      && this.kings.king === killerSeat && !mutual);
    const hadTerritory = this.territory.countFor(victim.slot) > 0;
    const selfTrailCut = reason === 'self-trail-cut';

    if (victim.isPlayer) {
      // Snapshot before the territory changes hands.
      this.deathResult = {
        killerName: selfTrailCut ? 'YOUR OWN TRAIL' : killer.name,
        territory: this.domainPercentFor(victim.slot),
        score: this.scoreFor(victim),
        lostTerritory: hadTerritory && !selfTrailCut && !mutual,
        selfTrailCut,
        reason,
        life: this.lifeSummary(),
      };
      const lifeStats = this.deathResult.life;
      // Revenge: the rival who took you out is marked once you rejoin.
      this.revenge = killer !== victim && !selfTrailCut && !mutual && killerSeat && killerSeat !== victimSeat
        ? { seat: killerSeat, active: false, until: 0 } : null;
      this.deathResult.revengeName = this.revenge ? killerSeat.name : null;
      this.killStreak = 0;
      this.flushPlayTime();
      this.progress.recordStats({ deaths: 1 }, {
        bestScore: this.deathResult.score,
        bestTerritory: lifeStats ? lifeStats.peak : 0,
        bestKills: lifeStats ? lifeStats.kills : 0,
      });
      this.platform?.submitScore(this.deathResult.score);
      // The shape of what you held, painted before it changes hands.
      paintDeathSnapshot(this.screens.respawnSnapshot, this.territory, {
        slot: victim.slot,
        x: victim.x,
        y: victim.y,
        killer: killer !== victim && !selfTrailCut ? { slot: killer.slot, x: killer.x, y: killer.y } : null,
      });
    }

    this.territory.clearTrail(victim.slot);
    if (mutual || selfTrailCut) {
      // No one inherits territory on a mutual crash or a self-inflicted elimination.
      this.territory.releaseAll(victim.slot);
    } else if (killer !== victim) {
      this.territory.conquer(victim.slot, killer.slot, COMBAT.CONQUEST_FRACTION, victim.x, victim.y);
    }
    if (killerSeat && killerSeat !== victimSeat) killerSeat.kills++;
    // A bot remembers who knocked it out and goes after them next life.
    if (victimSeat && !victim.isPlayer && killer !== victim) victimSeat.grudgeSlot = killer.slot;
    if (victimSeat) {
      victimSeat.deaths++;
      victimSeat.respawnTimer = victim.isPlayer ? 0 : ENEMY.RESPAWN_DELAY;
    }

    // (The victim's elemental elimination effect + sound: CombatEffects.onEliminated.)

    if (byKing) {
      this.events.emit(GameEvent.KING_ELIMINATION, {
        eliminatedPlayerId: victimSeat.playerId,
        kingPlayerId: killerSeat.playerId,
        worldId: this.world.worldId,
        timestamp: Date.now(),
        reason: EliminationReason.KING,
        victim,
        killer,
      });
    } else if (victim.isPlayer) {
      this.input.setEnabled(false);
      this.state = GameState.RESPAWNING;
      this.platform?.gameplayStop();
      this.deathTimer = FLOW.RESPAWN_OVERLAY_DELAY;
      this.cameraTarget = killer; // watch who got you
      this.camera.shake(FEEDBACK.SHAKE_PLAYER_ELIMINATED);
      this.tutorial.hide();
      this.announcer.clear();
    }

    if (killer.isPlayer && killer !== victim) {
      this.progress.recordStats({ kills: 1 });
      this.progress.missionEvent('kills', 1);
      this.onPlayerKill(victimSeat);
      if (reason === 'trail-cut') this.awardProgress(this.career.onTrailCut());
      this.coins.onElimination();
      this.audio.play('intercept');
      if (hadTerritory) this.audio.play('territory', { size: 2 }); // their nearby land is now yours
      this.camera.shake(FEEDBACK.SHAKE_PLAYER_KILL);
      const text = hadTerritory ? `ELIMINATED ${victim.name} · +TERRITORY` : `ELIMINATED ${victim.name}`;
      this.effects.popup(0, 0, text, KILL_POPUP_COLOR, { anchor: killer, sizePx: 18, life: 1.3, rise: 46 });
    }
  }

  /** What this life earned, per source (results card tiles). */
  lifeSummary() {
    const life = this.life;
    if (!life) return null;
    const earned = this.career.earnedBySource;
    const xp = (...keys) => keys.reduce((sum, k) => sum + (earned[k] - (life.xp[k] || 0)), 0);
    return {
      seconds: this.time - life.start,
      peak: life.peak,
      claimed: life.claimed,
      kills: this.local.kills - life.kills,
      xpSurvival: xp('survival', 'energy'),
      xpHold: xp('territoryHold', 'kingTime'),
      xpCapture: xp('capture'),
      xpCut: xp('trailCut'),
      xpTotal: this.career.matchEarned - life.xpTotal,
    };
  }

  /**
   * KING INTERCEPTS PLAYER → player permanently removed from this world's match → no respawn
   * here → King screen → "ENTER NEW WORLD" goes to a different world.
   */
  onKingElimination({ worldId, victim, killer }) {
    const seat = this.roster.get(victim.slot);
    if (!seat || worldId !== this.world.worldId) return;
    this.world.closeOut(seat, EliminationReason.KING);
    this.claimBeacon.bonusCounts[victim.slot] = 0;
    this.territory.releaseAll(victim.slot); // a departing player's leftover land goes neutral

    const seen = this.inView(victim.x, victim.y, victim.radius * 3);
    if (seen) {
      this.particles.emit(victim.x, victim.y, KING_GOLD_HUE, PARTICLES.KING_CLAIM, Math.min(2.2, 0.8 + victim.radius / 60));
    }
    if (victim.isPlayer || killer.isPlayer || seen) this.audio.play('kingClaim');

    if (victim.isPlayer) {
      this.worlds.lockOut(this.identity, this.world);
      this.state = GameState.KING_ELIMINATED;
      this.input.setEnabled(false);
      this.platform?.gameplayStop();
      this.cameraTarget = killer;
      this.camera.shake(FEEDBACK.SHAKE_PLAYER_ELIMINATED * 1.2);
      this.tutorial.hide();
      this.announcer.clear();
      this.kingOut = { timer: FLOW.KING_SCREEN_DELAY, kingName: killer.name, worldId };
    } else if (killer.isPlayer) {
      this.camera.shake(FEEDBACK.SHAKE_PLAYER_KILL);
      this.effects.popup(0, 0, `THE KING CLAIMS ${victim.name}`, COIN_GOLD, { anchor: killer, sizePx: 19, life: 1.6, rise: 64 });
    }
  }

  /** Pickups refill boost, or convert to score when the meter was already full. */
  onEnergyCollected(energy, amount, points = 0, multiplied = false) {
    this.awardProgress(this.career.onEnergyCollected());
    this.progress.missionEvent('energy', Math.max(1, Math.round(amount)));
    if (multiplied) {
      // 5X: the pickup flashes and the number shows the multiplied value (2 -> +10).
      this.effects.popup(energy.x, energy.y, `+${points}`, MULTIPLIER_POPUP_COLOR, { sizePx: 16 + energy.tier * 3, life: 0.7, rise: 30 });
      this.multiplierStreak = this.time - (this.multiplierStreakAt ?? -Infinity) < 0.6 ? (this.multiplierStreak || 0) + 1 : 0;
      this.multiplierStreakAt = this.time;
      this.audio.play('multiplierPickup', { streak: this.multiplierStreak });
      this.particles.emit(energy.x, energy.y, POWER_UPS.MULTIPLIER.HUE, PARTICLES.COIN, 0.8);
      return;
    }
    if (points > 0) {
      this.effects.popup(0, 0, `+${points} SCORE`, FOOD_POPUP_COLOR, {
        anchor: this.player, sizePx: 17, life: 0.8, rise: 34,
      });
      this.audio.play('food', { tier: energy.tier, streak: 0 });
      return;
    }
    this.collectedThisLife += amount;
    const popup = this.foodPopup;
    if (popup && popup.life > 0 && this.time - this.foodPopupAt < FEEDBACK.FOOD_POPUP_MERGE_TIME) {
      popup.value += amount;
      popup.text = `+${Math.max(1, Math.round(popup.value))} ENERGY`;
      popup.life = popup.maxLife;
      popup.sizePx = Math.min(24, popup.sizePx + 0.6);
    } else {
      this.foodPopup = this.effects.popup(0, 0, `+${Math.max(1, Math.round(amount))} ENERGY`, FOOD_POPUP_COLOR, {
        anchor: this.player, sizePx: 14 + energy.tier * 2, life: 0.8, rise: 34,
      });
      this.foodPopup.value = amount;
    }
    this.foodPopupAt = this.time;

    // One light blip per pickup (throttled by the manager); a quick streak climbs in pitch.
    this.foodStreak = this.time - this.foodStreakAt < AUDIO.FOOD_STREAK_WINDOW ? this.foodStreak + 1 : 0;
    this.foodStreakAt = this.time;
    this.audio.play('food', { tier: energy.tier, streak: this.foodStreak });
  }

  /** Momentum chain: successive captures within a short window create a readable combo. */
  applyMomentumCapture(capture) {
    const now = this.time;
    const inWindow = now - this.momentumLastActionAt <= MOMENTUM.WINDOW;
    const chain = inWindow ? Math.min(MOMENTUM.MAX_CHAIN, this.momentumChain + 1) : 1;
    this.momentumChain = chain;
    this.momentumLastActionAt = now;
    if (chain < 2) return 0;

    const bonus = Math.min(8, MOMENTUM.FLOOR + (chain - 2) * MOMENTUM.CHAIN_BONUS + (capture.count >= TERRITORY.CAPTURE_TIERS.BIG ? MOMENTUM.BIG_CAPTURE_REWARD : 0));
    if (bonus > 0) {
      this.coins.grant(bonus, 'momentum');
      this.effects.popup(capture.x, capture.y, `COMBO x${chain} · +${bonus}`, chain >= 4 ? '#ffd66b' : '#7ce6ff', {
        sizePx: chain >= 4 ? 22 : 18, life: 1.2, rise: 76,
      });
      this.audio.play('territory', { size: Math.min(4, chain) });
    }
    return bonus;
  }

  /** Loop closed: the enclosed land sweeps to the player's colour. */
  onPlayerCapture(capture, beaconBonus = 0) {
    this.capturedThisFrame = true;
    if (this.life) this.life.claimed += capture.count;
    this.progress.recordStats({ landClaimed: capture.count });
    this.progress.missionEvent('claim', capture.count);
    this.awardProgress(this.career.onTerritoryCaptured(capture.count));
    this.coins.onTerritoryCapture(capture.count);
    const momentumBonus = this.applyMomentumCapture(capture);
    const big = capture.count >= TERRITORY.CAPTURE_TIERS.BIG;
    const huge = capture.count >= TERRITORY.CAPTURE_TIERS.HUGE;
    const rewardScale = huge ? TERRITORY.CAPTURE_REWARD_SCALING.HUGE
      : big ? TERRITORY.CAPTURE_REWARD_SCALING.BIG
        : TERRITORY.CAPTURE_REWARD_SCALING.BASE;
    const bonusText = rewardScale > 1 ? ` · +${Math.round((rewardScale - 1) * 100)}% RISK/REWARD` : '';
    const character = this.player.character || skinById('core');
    // Match the sound and reaction size to how much territory changed hands, while keeping
    // the ruleset unchanged: it's only presentation and feedback, not a stat bump.
    this.audio.play('capture', { element: character.element, size: capture.count });
    this.camera.shake(huge ? FEEDBACK.SHAKE_PLAYER_KILL * 1.4 : big ? FEEDBACK.SHAKE_PLAYER_KILL : FEEDBACK.SHAKE_SURGE);
    this.particles.emit(capture.x, capture.y, this.local.hue, PARTICLES.CAPTURE, Math.min(2.8, 0.8 + capture.count / 180));
    const beaconText = beaconBonus > 0 ? ` · BONUS +${beaconBonus}` : '';
    this.effects.popup(capture.x, capture.y, `+${capture.count} TERRITORY${bonusText}${beaconText}${momentumBonus > 0 ? ` · +${momentumBonus} COMBO` : ''}`, LAND_POPUP_COLOR, {
      sizePx: huge ? 30 : big ? 24 : 19, life: huge ? 1.8 : big ? 1.45 : 1.2, rise: huge ? 62 : 50,
    });
    if (huge) {
      this.effects.popup(capture.x, capture.y, 'MAJESTY', LAND_POPUP_COLOR, {
        sizePx: 18, life: 1.4, rise: 84,
      });
    }
    this.vignette.classList.remove('capture-pulse');
    void this.vignette.offsetWidth;
    this.vignette.classList.add('capture-pulse');
  }

  onPlayerCoin(coin) {
    // 5X: world coins are worth five times as much while the multiplier is active (1 -> +5).
    const multiplied = this.player.alive && this.player.multiplierTime > 0;
    const value = coin.value * (multiplied ? POWER_UPS.MULTIPLIER.FACTOR : 1);
    this.coins.onPickup(value);
    this.audio.play(multiplied ? 'multiplierPickup' : 'coin', { big: coin.big, streak: 6 });
    this.particles.emit(coin.x, coin.y, multiplied ? POWER_UPS.MULTIPLIER.HUE : KING_GOLD_HUE, PARTICLES.COIN, coin.big ? 1.4 : 1);
    this.effects.popup(coin.x, coin.y, `+${value}`, multiplied ? MULTIPLIER_POPUP_COLOR : COIN_GOLD, {
      sizePx: (coin.big ? 18 : 14) + (multiplied ? 4 : 0), life: 0.8, rise: 30,
    });
    this.events.emit(GameEvent.COIN_COLLECTED, { creature: this.player, coin, value, multiplied });
  }

  onKingChanged({ previous, next }) {
    this.territory.kingSlot = next ? next.slot : 0;
    if (next && next.isLocal) {
      this.progress.recordStats({ crowns: 1 });
      this.progress.missionEvent('king', 1);
    }
    this.world.king = next;
    this.crownSince = this.time;
    const old = previous && previous.creature;
    if (old && old.alive && this.inView(old.x, old.y, old.radius)) {
      this.particles.emit(old.x, old.y - old.radius, KING_GOLD_HUE, PARTICLES.COIN, 1.2);
    }
    // The crown always moves at once (the leaderboard and the crown follow it); only the
    // big announcements are throttled, so near-equal opening land can't spam them.
    const announce = this.time >= KING.ANNOUNCE_GRACE
      && this.time - (this.crownAnnouncedAt ?? -Infinity) >= KING.ANNOUNCE_COOLDOWN;
    if (announce && ((next && next.isLocal) || (previous && previous.isLocal))) this.crownAnnouncedAt = this.time;
    if (!announce && ((next && next.isLocal) || (previous && previous.isLocal))) {
      this.audio.play('crownShift');
    } else if (next && next.isLocal) {
      this.announcer.show('YOU ARE KING', 'Hold the most territory to keep the crown', AnnounceStyle.KING, KING.ANNOUNCE_TIME);
      this.particles.emit(this.player.x, this.player.y, KING_GOLD_HUE, PARTICLES.SURGE, 1.4);
      this.camera.shake(FEEDBACK.SHAKE_SURGE);
      this.audio.play('king');
    } else if (previous && previous.isLocal && this.player.alive) {
      this.announcer.show('CROWN LOST', next ? `${next.name} took it` : '', AnnounceStyle.LOSS, KING.ANNOUNCE_TIME);
      this.audio.play('kingLost');
    } else if (next) {
      // The crown moved between rivals: a quiet cue, and a flash if you can see the new King.
      this.audio.play('crownShift');
      const c = next.creature;
      if (c && this.inView(c.x, c.y, c.radius)) this.particles.emit(c.x, c.y, KING_GOLD_HUE, PARTICLES.SURGE, 1);
    }
  }

  // ---------------------------------------------------------------- frame

  update(dt) {
    if (this.state === GameState.MENU) return;
    if (this.state === GameState.ROUND_OVER) {
      this.particles.update(dt);
      this.effects.update(dt);
      this.elementalEffects.update(dt);
    this.combat.update(dt);
    this.captureWaves.update(dt);
      return;
    }

    this.time += dt;
    const showItems = this.state === GameState.PLAYING && Boolean(this.player && this.player.alive);
    if (showItems !== this.itemBarShown) {
      this.itemBarShown = showItems;
      this.itemBar.setVisible(showItems);
    }
    if (this.state === GameState.PLAYING && this.player && this.player.alive) {
      this.statTime += dt;
      if (this.statTime >= 30) this.flushPlayTime();
    }
    const matchOver = this.world.tick(dt);
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    this.capturedThisFrame = false;
    // Landmarks: each runs its own ON/OFF clock. A switch-on is announced (banner + sound) only
    // when it is near you or yours, at most every LANDMARKS.ANNOUNCE_GAP seconds.
    this.claimBeacon.update(dt);
    const fluxCoreEvent = this.fluxCore.update(dt, this.territory, this.energy);
    if (fluxCoreEvent === 'pulse' && this.fluxCore.lastEmission > 0) {
      const core = this.fluxCore.active;
      if (core && this.inView(core.x, core.y, FLUX_CORE.BURST_RADIUS)) {
        this.audio.play('fluxCorePulse');
        this.particles.emit(core.x, core.y, FLUX_CORE.HUE, PARTICLES.SURGE, 0.9);
      }
    }
    this.rift.update(dt);
    this.stasis.update(dt, this.territory, this.creatures, this.player);
    this.announceLandmarks(dt);

    const player = this.player;
    const startX = player.x;
    const startY = player.y;
    if (player.alive) {
      player.updateBoost(dt, this.state === GameState.PLAYING && this.input.boostHeld);
      if (player.isBoosting) this.emitBoostMotes(dt, player);
      player.readInput(this.input, this.camera);
      this.input.updateCursor(this.state === GameState.PLAYING && player.isBoosting, dt);
    }
    for (const creature of this.creatures) {
      if (!creature.isPlayer) {
        creature.think(dt, this.aiWorld);
        creature.updateBoost(dt, creature.ai.boostHeld);
        if (creature.isBoosting) this.emitBoostMotes(dt, creature);
      }
    }
    for (const creature of this.creatures) {
      creature.update(dt);
      for (const type of creature.expired) this.events.emit(GameEvent.POWERUP_EXPIRED, { creature, type });
    }
    const travelers = this.rift.traverse(this.creatures, this.territory, dt);
    for (const traveler of travelers) {
      // Absorption at the gate, materialization at the destination (renderer FX
      // on the gates themselves), particles at both ends, spatial audio.
      this.particles.emit(traveler.fromX, traveler.fromY, RIFT.HUE, PARTICLES.SURGE, 1.1);
      this.particles.emit(traveler.x, traveler.y, RIFT.HUE, PARTICLES.SURGE, 1.3);
      this.effects.popup(0, 0, 'TELEPORTED HOME', `hsl(${RIFT.HUE}, 100%, 72%)`, {
        anchor: traveler.creature, sizePx: 17, life: 1.1, rise: 38,
      });
      this.audio.play('riftEnter');
      this.audio.play('riftTransit');
      this.audio.play('riftArrive');
      if (traveler.creature.isPlayer) {
        this.camera.snapTo(traveler.creature);
        this.camera.shake(FEEDBACK.SHAKE_SURGE * 0.5);
      }
    }
    for (const powerUp of this.powerUps) powerUp.update(dt);

    this.energy.update(dt);
    for (const capture of this.territory.update(dt, this.creatures)) {
      const beaconBonus = this.claimBeacon.recordCapture(capture, this.territory, this.local.slot);
      const creature = this.roster.get(capture.slot)?.creature;
      if (creature && beaconBonus > 0) creature.bonusScore += beaconBonus * SCORE.PER_CELL;
      if (creature) this.events.emit(GameEvent.TERRITORY_CAPTURED, { creature, capture });
      if (capture.slot === this.local.slot && player.alive) this.onPlayerCapture(capture, beaconBonus);
    }
    this.updateLandmarkClaims(dt);
    this.refreshDomainScores();
    this.collisions.resolveTrailCuts(this.territory.trailCuts, this.territory);
    this.collisions.update(dt, this.creatures, this.energy, this.powerUps);
    const magnet = player.alive && player.magnetTime > 0 ? POWER_UPS.MAGNET.RANGE : 0;
    this.coinField.update(dt, player.alive ? player : null, magnet, (coin) => this.onPlayerCoin(coin));
    this.removeEliminated();
    this.removeInactivePowerUps();
    this.updateRespawns(dt);
    this.spawner.update(dt);

    this.refreshDomainScores();
    const kingChange = this.kings.update(this.roster.list, this.territory, this.domainScores);
    if (kingChange) this.onKingChanged(kingChange);

    this.emitSurgeSparks(dt);
    this.particles.update(dt);
    this.effects.update(dt);
    this.elementalEffects.update(dt);
    this.combat.update(dt);
    this.captureWaves.update(dt);
    this.announcer.update(dt);

    if (this.cameraTarget && !this.cameraTarget.alive) this.cameraTarget = this.player.alive ? this.player : null;
    // Zoom power-up: the camera pulls back while it lasts (only for your own view).
    this.camera.viewScale = this.player && this.player.alive && this.player.zoomTime > 0 ? POWER_UPS.ZOOM.VIEW_SCALE : 1;
    this.camera.update(dt, this.cameraTarget);

    if (this.player.alive) {
      this.coins.tickAlive(dt);
      const moved = Math.hypot(this.player.x - startX, this.player.y - startY);
      this.updatePlayerFeedback(dt, moved);
      for (const rankUp of this.career.update(dt, {
        alive: true,
        moved,
        territoryCells: this.territory.countFor(this.local.slot),
        isKing: this.kings.king === this.local,
      })) this.awardProgress({ rankUp });
    }
    this.updateRespawnOverlay(dt);
    this.updateKingOut(dt);

    if (this.hud.tick(dt)) {
      this.hud.render(this.playerStats(), this.kingInfo(), this.ranking(), {
        worldId: this.world.worldId, playerCount: this.world.playerCount, capacity: this.world.capacity,
      });
    }
    const activePowerUps = this.activePowerUps();
    const countdownAppeared = this.hud.renderLive({
      dt,
      timeLeft: this.world.timeLeft,
      safe: this.player.alive && this.player.inSafeArea,
      activePowerUps,
      energy: this.player.alive ? this.player.energy : 0,
      maxEnergy: BOOST.MAX_ENERGY,
      boosting: this.player.alive && this.player.isBoosting,
    });
    this.updateMatchClockCues(countdownAppeared);
    this.updateSoundCues(dt, activePowerUps);
    this.updateHudOcclusion(dt);

    if (matchOver && this.state !== GameState.KING_ELIMINATED) this.endRound();
    else if (this.lastKingStanding()) this.finishByLastKing();
  }

  /** True when the King is the only participant still in the match (everyone else is out for good). */
  lastKingStanding() {
    const king = this.kings.king;
    if (!king || !this.world || this.world.state !== MatchState.RUNNING) return false;
    return this.roster.list.every((seat) => seat === king || seat.removed);
  }

  /** Everyone else is out: the match ends now and the King is crowned, whatever the clock says. */
  finishByLastKing() {
    this.world.state = MatchState.ENDED;
    this.world.timeLeft = 0;
    if (this.state === GameState.KING_ELIMINATED) return; // you are already out: the King screen stays
    this.endRound();
  }

  /** "DOMINION ENDS IN 3:00" when the countdown first appears; soft ticks for the last seconds. */
  updateMatchClockCues(appeared) {
    if (appeared && this.state !== GameState.KING_ELIMINATED) {
      this.audio.setMusicIntensity(1);
      this.announcer.show('MATCH ENDS IN 3:00', 'Hold the most territory when the clock runs out', AnnounceStyle.KING, 1.8);
      this.audio.play('tick', { final: false });
    }
    const seconds = Math.ceil(this.world.timeLeft);
    if (seconds <= MATCH.FINAL_COUNTDOWN && seconds !== this.lastTickSecond && seconds > 0) {
      this.lastTickSecond = seconds;
      this.audio.play('tick', { final: seconds <= 3 });
    }
  }

  /** HUD panels go see-through while the player is underneath them. */
  updateHudOcclusion(dt) {
    const p = this.player;
    if (!p || !p.alive) {
      this.hud.updateOcclusion(dt, -9999, -9999, 0);
      return;
    }
    this.camera.worldToScreen(p.x, p.y, this.playerScreen);
    this.hud.updateOcclusion(dt, this.playerScreen.x, this.playerScreen.y, p.displayRadius * this.camera.zoom);
  }

  /** Sounds driven by state changes rather than events: boost on/off, power-up expiry, landmark ambience. */
  updateSoundCues(dt, activePowerUps) {
    const player = this.player;
    const boosting = player.alive && player.isBoosting;
    if (boosting !== this.wasBoosting) {
      if (boosting) {
        const character = player.character || skinById('core');
        this.audio.play(character.soundSet.boost, { element: character.element });
      } else {
        this.audio.play('boostOff');
      }
    }
    this.wasBoosting = boosting;

    for (const id of this.activePowerUpIds) {
      if (!activePowerUps.some((p) => p.id === id)) {
        this.activePowerUpIds.delete(id);
        // (expiry sound + fizzle: CombatEffects, via POWERUP_EXPIRED)
      }
    }

    // Landmarks audible by proximity: a restrained alien hum that tracks state
    // (active = noticeable, cooldown = quieter) — discovery through the ears too.
    this.landmarkAmbienceTimer -= dt;
    if (this.landmarkAmbienceTimer <= 0) {
      let played = false;
      if (player.alive) {
        const range = LANDMARKS.AMBIENCE_RANGE;
        const rangeSq = range * range;
        let nearest = null;
        let nearestKind = null;
        let nearestDist = Infinity;
        for (const kind of ['beacon', 'flux', 'rift', 'stasis']) {
          for (const lm of this.landmarkSystems[kind].landmarks) {
            const d = distSq(player.x, player.y, lm.x, lm.y);
            if (d <= rangeSq && d < nearestDist) {
              nearestDist = d;
              nearest = lm;
              nearestKind = kind;
            }
          }
        }
        if (nearest) {
          const proximity = 1 - Math.min(1, Math.sqrt(nearestDist) / range);
          const intensity = (0.45 + 0.55 * proximity) * (nearest.active ? 1 : 0.5);
          if (nearestKind === 'rift') {
            this.audio.play('riftAmbient', { intensity });
          } else {
            const base = nearestKind === 'flux' ? 147 : nearestKind === 'stasis' ? 262 : 196;
            this.audio.play('landmarkHum', { intensity, base });
          }
          played = true;
        }
      }
      this.landmarkAmbienceTimer = played ? LANDMARKS.AMBIENCE_INTERVAL : 0.5;
    }
  }

  /**
   * Off your land the game FEELS dangerous without saying anything: your outline pulses
   * (render/exposureCue.js), the screen edge closes in a little, and near your own trail
   * a quiet heartbeat sets in. Nothing tells you where to go.
   */
  updateExposure(dt, player) {
    const exposed = player.alive && player.isExposed && this.state === GameState.PLAYING;
    // "Near your own trail" = close to an OLDER part of it (the stretch right behind you
    // doesn't count), i.e. you're circling back toward something you could run into.
    const near = exposed && this.territory.distanceToOlderTrail(player.slot, player.x, player.y,
      EXPOSURE_SKIP_TRAIL) < EXPOSURE_NEAR_TRAIL;
    this.playerNearTrail = near;
    const target = near ? 1 : exposed ? 0.45 : 0;
    this.exposure = (this.exposure || 0) + (target - (this.exposure || 0)) * Math.min(1, dt * 5);
    this.vignette.classList.toggle('exposed', this.exposure > 0.2);
    this.vignette.classList.toggle('near-trail', near);
    // The heartbeat sound follows the outline's rhythm (a beat every 0.8 s).
    if (near) {
      const beat = Math.floor(this.time * 1.25);
      if (beat !== this.lastHeartbeat) {
        this.lastHeartbeat = beat;
        this.audio.play('heartbeat');
      }
    }
  }

  /** Safe-zone feedback, territory-combat awareness, home pointer, tutorial. */
  updatePlayerFeedback(dt, moved) {
    const player = this.player;
    this.hintTime = Math.max(0, this.hintTime - dt);

    // (No "SAFE ZONE" popup or badge: the clean HUD shows safety through the land itself.)

    this.updateExposure(dt, player);
    if (player.alive && this.life) {
      this.life.peak = Math.max(this.life.peak, this.domainPercentFor(player.slot));
    }

    // Warn when a nearby opponent could physically reach the player's open trail.
    this.dangerNearby = false;
    if (player.isExposed) {
      for (const c of this.creatures) {
        if (c === player || !c.alive) continue;
        const warn = (c.radius + player.radius) * AUDIO.DANGER_WARN_REACHES;
        const dx = c.x - player.x;
        const dy = c.y - player.y;
        if (dx * dx + dy * dy < warn * warn) {
          this.audio.play('danger');
          this.dangerNearby = true;
          break;
        }
      }
    }

    // (No travel/return arrow: finding the way home is part of the territory game.)

    this.tutorial.update(dt, {
      moved,
      collected: this.collectedThisLife,
      safe: false,
      captured: this.capturedThisFrame,
      encountered: this.creatures.some((c) => c !== player && c.alive
        && (c.x - player.x) ** 2 + (c.y - player.y) ** 2 < 700 ** 2),
      boosted: player.isBoosting,
    });
  }

  updateRespawnOverlay(dt) {
    if (this.state !== GameState.RESPAWNING) return;
    if (this.deathResult) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.screens.showRespawn(this.deathResult, this.career, this.career.snapshot);
        this.deathResult = null;
        this.startMidgameAd();
      }
    }
  }

  /**
   * Quick kills in a row pay a bonus with a big callout (DOUBLE CUT!, TRIPLE CUT!, ...);
   * taking out the rival who last got you pays a REVENGE bonus.
   */
  onPlayerKill(victimSeat) {
    const now = this.time;
    this.killStreak = now - (this.lastKillAt ?? -Infinity) <= KILLSTREAK.WINDOW ? (this.killStreak || 0) + 1 : 1;
    this.lastKillAt = now;
    if (this.killStreak >= 2) {
      const names = KILLSTREAK.NAMES;
      const title = names[Math.min(this.killStreak, names.length - 1)];
      const bonus = KILLSTREAK.COINS_PER_STEP * (this.killStreak - 1);
      this.coins.grant(bonus, 'streak');
      this.announcer.show(title, `${this.killStreak} quick kills · +${bonus} coins`, AnnounceStyle.SURGE, 1.3);
      this.audio.play('multiplier');
      this.progress.missionEvent('streak', 1);
    }
    if (this.revenge && this.revenge.active && victimSeat && victimSeat === this.revenge.seat) {
      this.coins.grant(REVENGE.COINS, 'revenge');
      this.announcer.show('REVENGE!', `You got ${victimSeat.name} back · +${REVENGE.COINS} coins`, AnnounceStyle.KING, 1.5);
      this.audio.play('rankUp');
      this.revenge = null;
    }
  }

  /** The rival marked for revenge (alive, mark active), or null. */
  revengeTarget() {
    const r = this.revenge;
    if (!r || !r.active) return null;
    if (this.time > r.until || r.seat.removed) {
      this.revenge = null;
      return null;
    }
    const c = r.seat.creature;
    return c && c.alive ? c : null;
  }

  /** Opening the game: pay the login streak and last week's season reward, then show them. */
  welcomeBack() {
    const messages = [];
    const season = this.progress.checkSeason();
    if (season) messages.push(`SEASON REWARD · ${season.crowns} crowns last week · +${season.coins} coins`);
    const daily = this.progress.checkDailyLogin();
    if (daily) {
      const bonus = daily.powerUp ? ` · +1 ${POWER_UP_ITEMS.find((i) => i.id === daily.powerUp)?.name}` : '';
      messages.push(`DAY ${daily.streak} LOGIN STREAK · +${daily.coins} coins${bonus}`);
    }
    // A wheel prize still owed from last time (the page closed mid-spin).
    const owed = this.progress.finishSpin();
    if (owed) messages.push(`WHEEL PRIZE · +${owed.coins ? `${owed.coins} coins` : `1 ${POWER_UP_ITEMS.find((i) => i.id === owed.powerUp)?.name}`}`);
    this.progress.refreshMissions();
    messages.forEach((text, i) => setTimeout(() => showMenuToast(text), 900 + i * 4200));
  }

  /**
   * A landmark that just switched ON is announced when it matters to you: within
   * LANDMARKS.ANNOUNCE_RANGE, or yours. Everyone still sees it ripple on the minimap.
   */
  announceLandmarks(dt) {
    this.landmarkAnnounceGap = Math.max(0, (this.landmarkAnnounceGap || 0) - dt);
    const player = this.player;
    for (const lm of this.minimapLandmarks()) {
      const switchedOn = lm.active && lm.wasOn === false;
      lm.wasOn = Boolean(lm.active);
      if (!switchedOn || this.state !== GameState.PLAYING || !player || !player.alive) continue;
      const yours = lm.ownerSlot && lm.ownerSlot === this.local.slot;
      const near = Math.hypot(lm.x - player.x, lm.y - player.y) <= LANDMARKS.ANNOUNCE_RANGE;
      if ((!yours && !near) || this.landmarkAnnounceGap > 0) continue;
      const text = LANDMARK_ANNOUNCE[lm.kind];
      if (!text) continue;
      this.landmarkAnnounceGap = LANDMARKS.ANNOUNCE_GAP;
      this.audio.play(text.sound);
      this.announcer.show(yours ? `YOUR ${text.title}` : text.title, text.sub, AnnounceStyle.SURGE, 1.8);
    }
  }

  /** Death screens' home button: leave the match and return to the main menu. */
  goHome() {
    if (this.state === GameState.MENU) return;
    this.audio.unlock();
    this.audio.play('click');
    this.flushPlayTime();
    this.platform?.gameplayStop();
    this.loop.stop();
    this.state = GameState.MENU;
    this.input.setEnabled(false);
    this.hud.hide();
    this.tutorial.hide();
    this.announcer.clear();
    this.itemBarShown = false;
    this.itemBar.setVisible(false);
    this.screens.showStart(this.playerName, WORLD.CAPACITY, this.career.snapshot);
    this.paintIcons();
    this.title.show();
    this.audio.playMusic('menu');
    this.missionsPanel.renderBadge();
  }

  startMidgameAd() {
    if (!this.platform?.requestMidgameAd || this.state !== GameState.RESPAWNING
      || !this.world || this.world.state !== MatchState.RUNNING) return;

    this.screens.setRejoinPending(true);
    this.loop.stop();
    const requested = this.platform.requestMidgameAd(() => {
      this.screens.setRejoinPending(false);
      if (this.state === GameState.RESPAWNING) this.loop.start();
    });
    if (!requested) {
      this.screens.setRejoinPending(false);
      this.loop.start();
    }
  }

  updateKingOut(dt) {
    if (this.state !== GameState.KING_ELIMINATED || !this.kingOut || this.kingOut.timer <= 0) return;
    this.kingOut.timer -= dt;
    if (this.kingOut.timer <= 0) {
      this.screens.showKingElimination(this.kingOut, this.career, this.career.snapshot);
      this.hud.hide();
      this.audio.playMusic('end', { variant: 'result' });
      this.paintIcons();
    }
  }

  /** Boosting burns energy: small motes of the creature's own colour stream off behind it. */
  emitBoostMotes(dt, creature) {
    this.boostMoteTimer = (this.boostMoteTimer || 0) - dt;
    if (this.boostMoteTimer > 0) return;
    this.boostMoteTimer = BOOST.SPARK_INTERVAL;
    const back = creature.heading + Math.PI + randRange(-0.5, 0.5);
    const hue = creature.look ? creature.look.coreHue : creature.hue;
    this.particles.emit(creature.x + Math.cos(back) * creature.radius, creature.y + Math.sin(back) * creature.radius, hue, PARTICLES.SURGE_SPARK, 0.8);
  }

  emitSurgeSparks(dt) {
    this.sparkTimer -= dt;
    if (this.sparkTimer > 0) return;
    this.sparkTimer = SURGE.SPARK_INTERVAL;
    const bounds = this.camera.getBounds();
    for (const c of this.creatures) {
      if (!c.isSurging || !isInBounds(bounds, c.x, c.y, c.radius)) continue;
      const back = c.heading + Math.PI + randRange(-0.6, 0.6);
      this.particles.emit(c.x + Math.cos(back) * c.radius, c.y + Math.sin(back) * c.radius, SURGE.HUE, PARTICLES.SURGE_SPARK);
    }
  }

  removeInactivePowerUps() {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      if (!this.powerUps[i].active) this.powerUps.splice(i, 1);
    }
  }

  activePowerUps() {
    const player = this.player;
    if (!player || !player.alive) return [];
    const effects = [
      { id: 'surge', name: POWER_UP_LABELS.surge, duration: SURGE.DURATION, remainingTime: player.surgeTime },
      { id: 'magnet', name: 'MAGNET', duration: POWER_UPS.MAGNET.DURATION, remainingTime: player.magnetTime },
      { id: 'vision', name: POWER_UP_LABELS.vision, duration: POWER_UPS.VISION.DURATION, remainingTime: player.visionTime },
      { id: 'tracker', name: POWER_UP_LABELS.tracker, duration: POWER_UPS.TRACKER.DURATION, remainingTime: player.trackerTime },
      { id: 'zoom', name: POWER_UP_LABELS.zoom, duration: POWER_UPS.ZOOM.DURATION, remainingTime: player.zoomTime },
      { id: 'multiplier', name: '5X', duration: POWER_UPS.MULTIPLIER.DURATION, remainingTime: player.multiplierTime },
    ];
    return effects
      .filter((effect) => effect.remainingTime > 0 || effect.charges > 0)
      .map((effect) => ({ ...effect, color: POWER_UP_COLORS[effect.id] }));
  }

  boostStatus() {
    const player = this.player;
    if (!player || !player.alive || !player.isBoosting) return null;
    // Only the mobile boost button uses this; nothing is shown while the boost is idle.
    return {
      state: 'boosting',
      progress: player.energyRatio,
      remainingTime: player.energy,
      active: true,
    };
  }

  playerStats() {
    const p = this.player;
    const ranking = this.ranking();
    return {
      territory: this.domainPercentFor(this.local.slot),
      rank: ranking.findIndex((r) => r.isPlayer) + 1,
      score: p.alive ? this.scoreFor(p) : 0,
      energy: p.alive ? p.energy : 0,
      alive: p.alive,
      kills: this.life && p.alive ? this.local.kills - this.life.kills : 0,
    };
  }

  kingInfo() {
    const king = this.kings.king;
    if (!king) return null;
    return {
      name: king.name,
      territory: this.domainPercentFor(king.slot),
      isPlayer: king.isLocal,
    };
  }

  /** Territory determines rank; seats closed by the King are gone. */
  ranking() {
    const king = this.kings.king;
    const rows = [];
    for (const p of this.roster.list) {
      if (p.removed) continue;
      const cells = this.territory.countFor(p.slot);
      rows.push({
        name: p.name,
        cells,
        territory: this.territory.percentFor(p.slot),
        displayTerritory: this.domainPercentFor(p.slot),
        isPlayer: p.isLocal,
        isKing: p === king,
        alive: p.alive,
        rgb: this.territory.rgb[p.slot], // presentation: the row's land-colour bar
      });
    }
    // Display domain determines rank and crown; on a tie the current King stays on top.
    return rows.sort((a, b) => b.displayTerritory - a.displayTerritory
      || Number(b.isKing) - Number(a.isKing));
  }

  render(dt = 0) {
    const { ctx, camera, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = RENDER.BACKGROUND;
    ctx.fillRect(0, 0, this.width, this.height);
    if (this.state === GameState.MENU) return;

    camera.applyTransform(ctx, dpr);
    const bounds = camera.getBounds(RENDER.VIEW_MARGIN);
    const zoom = camera.zoom;

    drawArenaFloor(ctx, bounds, zoom, camera, this.time);
    this.territory.draw(ctx, bounds, zoom, (c) => this.captureWaves.draw(c, zoom, this.territory, bounds));
    drawWorldEdge(ctx, bounds, zoom);
    // Landmarks: their claimed boundaries lie on the ground; the structures themselves
    // stand upright and are drawn with the creatures below, sorted by depth.
    const landmarkSystems = [this.claimBeacon, this.fluxCore, this.rift, this.stasis];
    for (const system of landmarkSystems) system.drawGround(ctx, this.time, zoom, bounds);
    this.energy.draw(ctx, bounds);
    this.coinField.draw(ctx, bounds, this.time);

    for (const powerUp of this.powerUps) {
      if (isInBounds(bounds, powerUp.x, powerUp.y, powerUp.radius * 4)) powerUp.draw(ctx);
    }

    // Draw in deterministic order; all characters share one gameplay size.
    this.creatures.sort(byDrawOrder);
    const visible = this.visibleCreatures;
    visible.length = 0;
    for (const creature of this.creatures) {
      if (isInBounds(bounds, creature.x, creature.y, creature.displayRadius * KING.AURA_SCALE)) visible.push(creature);
    }
    const king = this.kings.king && this.kings.king.alive ? this.kings.king.creature : null;
    const view = {
      viewer: this.player && this.player.alive ? this.player : null,
      zoom,
      king,
      hints: this.hintTime > 0,
      crownAge: this.time - (this.crownSince ?? -Infinity),
      revenge: this.revengeTarget(),
    };
    // Depth pass: creatures and standing landmarks, back (north) to front (south). A
    // structure that would hide the player turns see-through so you never lose yourself.
    const structures = this.structureDrawables || (this.structureDrawables = []);
    structures.length = 0;
    for (const system of landmarkSystems) system.collectStructures(bounds, structures);
    if (structures.length === 0) {
      for (const creature of visible) drawCreature(ctx, creature, this.time, view);
    } else {
      const depth = this.depthDrawables || (this.depthDrawables = []);
      depth.length = 0;
      for (const creature of visible) depth.push(creature);
      for (const s of structures) depth.push(s);
      depth.sort((a, b) => a.y - b.y || (a.id || 0) - (b.id || 0));
      const me = view.viewer;
      for (const item of depth) {
        if (!item.lm) {
          drawCreature(ctx, item, this.time, view);
          continue;
        }
        const lm = item.lm;
        const S = LANDMARKS.SCALE;
        const hides = Boolean(me && me.y < lm.y && Math.abs(me.x - lm.x) < 95 * S + me.radius
          && me.y > lm.y - 250 * S - me.radius);
        lm.occlusionFade = (lm.occlusionFade || 0) + ((hides ? 1 : 0) - (lm.occlusionFade || 0)) * Math.min(1, dt * 10 || 0.2);
        if (lm.occlusionFade > 0.01) ctx.globalAlpha = 1 - 0.55 * lm.occlusionFade;
        // Perspective: the top leans away from the screen centre, the base stays planted,
        // so moving around a structure shows its sides like a real upright object.
        const halfW = Math.max(1, (bounds.right - bounds.left) / 2);
        const halfH = Math.max(1, (bounds.bottom - bounds.top) / 2);
        const lean = Math.max(-1.2, Math.min(1.2, (lm.x - camera.x) / halfW)) * LANDMARKS.LEAN;
        const rise = 1 + Math.max(-1, Math.min(1, (lm.y - camera.y) / halfH)) * LANDMARKS.RISE;
        ctx.save();
        ctx.translate(lm.x, lm.y);
        ctx.transform(1, 0, -lean, rise, 0, 0);
        ctx.translate(-lm.x, -lm.y);
        item.draw(ctx, lm, this.time);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
    // Name plates: what each landmark is, does, and when it is ON (above everything else).
    for (const st of structures) drawLandmarkPlate(ctx, st.lm, zoom, this.local ? this.local.slot : 0);
    this.combat.drawStates(ctx, visible, zoom, this.time);
    if (view.viewer && this.exposure > 0.01) {
      drawExposureCue(ctx, this.player, (this.player.character || skinById('core')).palette.primary,
        this.exposure, this.playerNearTrail, this.time, zoom);
    }
    this.effects.draw(ctx, zoom);
    this.elementalEffects.draw(ctx, zoom);
    this.combat.draw(ctx, zoom);
    // Rift materialization reads on top of the creature that just arrived.
    drawRiftArrivals(ctx, this.rift.landmarks, bounds);

    ctx.globalCompositeOperation = RENDER.PARTICLE_BLEND;
    this.particles.draw(ctx);
    ctx.globalCompositeOperation = 'source-over';

    for (const creature of visible) drawCreatureOverlay(ctx, creature, this.time, view);
    if (view.viewer && this.state === GameState.PLAYING) {
      const color = (this.player.character || skinById('core')).palette.primary;
      drawDirectionIndicator(ctx, this.player, this.input.lastMovementDirection, color, zoom, this.time);
    }
    this.effects.drawPopups(ctx, zoom);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.state === GameState.PLAYING) {
      this.joystick.draw(ctx, this.boostStatus(), this.time);
    }

    this.minimap.draw({
      dt,
      player: this.player,
      playerSlot: this.local.slot,
      creatures: this.creatures,
      king,
      landmarks: this.minimapLandmarks(),
      revenge: this.revengeTarget(),
    });
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, RENDER.MAX_DEVICE_PIXEL_RATIO);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.camera.setViewport(this.width, this.height);
    this.joystick.setViewport(this.width, this.height);
    this.minimap.resize(this.dpr);
    if (!this.loop.running) this.render();
  }
}
