export type Language = 'pl' | 'en';

export type ControlScheme = 'mouse' | 'keyboard';
export type TouchControlsMode = 'auto' | 'on' | 'off';

export interface AudioMixerConfig {
  muted: boolean;
  master: number;
  music: number;
  sfx: number;
  ambient: number;
}

export type ScreenState = 'PRELOAD' | 'MENU' | 'LOBBY' | 'PLAYING';

export type GameModeId =
  | 'duel_1v1'
  | 'brawl_2v2'
  | 'skirmish_3v3'
  | 'skirmish_4v4'
  | 'dominion'
  | 'stronghold';

export type TeamId = 'iron' | 'crimson';

export type FactionId = 'iron' | 'crimson' | 'silver';

export type HeroId = 'varek' | 'kurogane' | 'sora' | 'cedric' | 'vesper' | 'astrid';

export type GuardDirection = 'top' | 'left' | 'right';

export type BotDifficulty = 'recruit' | 'veteran' | 'warlord';

export type ActionState =
  | 'idle'
  | 'windup_light'
  | 'windup_heavy'
  | 'active_light'
  | 'active_heavy'
  | 'active_counter'
  | 'recovery'
  | 'blockstun'
  | 'parry_stun'
  | 'hitstun'
  | 'dash'
  | 'dead';

export interface SpriteAnimDef {
  src: string;
  frames: number;
  hold: number;
  loop?: boolean;
}

export interface HeroSkin {
  id: string;
  namePl: string;
  nameEn: string;
  swatchHex: string;
  canvasFilter: string;
  trailHex: string;
}

export interface HeroDefinition {
  id: HeroId;
  factionId: FactionId;
  name: string;
  titlePl: string;
  titleEn: string;
  classPl: string;
  classEn: string;
  lorePl: string;
  loreEn: string;
  avatarSrc: string;
  scale: number;
  offset: { x: number; y: number };
  hitbox: { width: number; height: number };
  maxHp: number;
  maxStamina: number;
  moveSpeed: number;
  jumpVelocity: number;
  doubleJumpVelocity: number;
  lightDamage: number;
  heavyDamage: number;
  counterDamage: number;
  lightWindupMs: number;
  heavyWindupMs: number;
  lightActiveMs: number;
  heavyActiveMs: number;
  recoveryMs: number;
  attackRange: number;
  attackHeight: number;
  sprites: {
    idle: SpriteAnimDef;
    run: SpriteAnimDef;
    jump: SpriteAnimDef;
    fall: SpriteAnimDef;
    attackLight: SpriteAnimDef;
    attackHeavy: SpriteAnimDef;
    takeHit: SpriteAnimDef;
    parryFlash: SpriteAnimDef;
    death: SpriteAnimDef;
  };
  skins: HeroSkin[];
}

export interface PlatformDef {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  oneWay: boolean;
  style: 'stone' | 'timber' | 'iron';
}

export interface LadderDef {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureZoneDef {
  id: 'A' | 'B' | 'C';
  namePl: string;
  nameEn: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GateObjectiveDef {
  x: number;
  y: number;
  width: number;
  height: number;
  maxHp: number;
  defenderTeam: TeamId;
}

export interface ArenaDefinition {
  id: string;
  namePl: string;
  nameEn: string;
  descPl: string;
  descEn: string;
  supportedModes: GameModeId[];
  worldWidth: number;
  worldHeight: number;
  groundY: number;
  deathY: number;
  backgroundSrc: string;
  shrinePosition: { x: number; y: number } | null;
  spawns: {
    iron: Array<{ x: number; y: number }>;
    crimson: Array<{ x: number; y: number }>;
  };
  platforms: PlatformDef[];
  ladders: LadderDef[];
  captureZones: CaptureZoneDef[];
  gateObjective: GateObjectiveDef | null;
}

export interface PlayerInputState {
  moveX: number; // -1 | 0 | 1
  upHeld?: boolean;
  jumpPressed: boolean;
  downHeld: boolean;
  dashPressed: boolean;
  guardDir: GuardDirection;
  lightPressed: boolean;
  heavyPressed: boolean;
  parryPressed: boolean;
  feintPressed: boolean;
  counterPressed: boolean;
  lockedTargetId?: string | null;
  seq: number;
}

export interface FighterEntity {
  id: string;
  name: string;
  isBot: boolean;
  team: TeamId;
  heroId: HeroId;
  skinIndex: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  facing: 1 | -1;
  grounded: boolean;
  jumpsLeft: number;
  dropThroughTimer: number;
  onLadder?: boolean;

  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  oosExhausted: boolean;
  revengeCharge: number;
  revengeShield: number;
  revengeTimer: number;

  guardDir: GuardDirection;
  actionState: ActionState;
  stateTimerMs: number;
  stateDurationMs: number;
  attackDir: GuardDirection;
  attackHitApplied: boolean;
  parryWindowOpen: boolean;
  counterReadyTimerMs: number;
  feintedRecently: boolean;
  invulnTimerMs: number;
  respawnTimerMs: number;
  alive: boolean;

  animName: keyof HeroDefinition['sprites'];
  animFrame: number;
  animTick: number;

  kills: number;
  deaths: number;
  parries: number;
  counters: number;
  captures: number;
  damageDealt: number;

  // Internal Bot AI runtime memory
  aiMemory?: {
    targetId: string | null;
    goalZoneId: string | null;
    reactionTimerMs: number;
    pendingGuard: GuardDirection;
    feintCooldownMs: number;
    strafeDir: 1 | -1;
    strafeSwapMs: number;
    attackCooldownMs: number;
    lastX: number;
    stuckTimerMs: number;
  };
}

export interface ZoneRuntimeState {
  id: 'A' | 'B' | 'C';
  namePl: string;
  nameEn: string;
  x: number;
  y: number;
  width: number;
  height: number;
  owner: TeamId | null;
  progress: number; // -100 (crimson) to +100 (iron)
  contested: boolean;
  boosted: boolean;
}

export interface GateRuntimeState {
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  breached: boolean;
  underAttack: boolean;
}

export interface ParticleFX {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  lifeMs: number;
  maxLifeMs: number;
  kind: 'spark' | 'ring' | 'slash' | 'dust';
}

export interface FloatingCallout {
  id: number;
  x: number;
  y: number;
  textPl: string;
  textEn: string;
  color: string;
  lifeMs: number;
  maxLifeMs: number;
}

export interface MatchSummary {
  winnerTeam: TeamId | 'draw';
  reasonPl: string;
  reasonEn: string;
  durationSec: number;
  ironScore: number;
  crimsonScore: number;
}

export interface WorldSnapshot {
  mode: GameModeId;
  arenaId: string;
  phase: 'countdown' | 'active' | 'ended';
  countdownSec: number;
  matchTimerSec: number;
  ironScore: number;
  crimsonScore: number;
  scoreLimit: number;
  ironRoundWins: number;
  crimsonRoundWins: number;
  currentRound: number;
  breakingTeam: TeamId | null;
  fighters: FighterEntity[];
  zones: ZoneRuntimeState[];
  gate: GateRuntimeState | null;
  particles: ParticleFX[];
  callouts: FloatingCallout[];
  summary: MatchSummary | null;
  screenShake: number;
  hitStopMs: number;
  ackSeqs?: Record<string, number>;
  serverTimeMs?: number;
}

export interface LobbyParticipant {
  id: string;
  name: string;
  isBot: boolean;
  isLocal: boolean;
  team: TeamId;
  heroId: HeroId;
  skinIndex: number;
  ready: boolean;
  inMatch?: boolean;
}

export interface ModeMetadata {
  id: GameModeId;
  teamSize: number;
  defaultArenaId: string;
  namePl: string;
  nameEn: string;
  subtitlePl: string;
  subtitleEn: string;
  rulesPl: string;
  rulesEn: string;
}
