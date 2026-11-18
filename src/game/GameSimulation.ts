import { ARENAS } from './arenas/arenas.ts';
import { HEROES } from './heroes.ts';
import { computeBotInput } from './ai/botBrain.ts';
import { soundEngine } from './audio/soundEngine.ts';
import {
  type CombatContext,
  spawnBurst,
  spawnCallout,
  spawnRing,
  startAttackOrAction,
  updateCombatTimers,
} from './combat/combatSystem.ts';
import type {
  ArenaDefinition,
  BotDifficulty,
  FighterEntity,
  GameModeId,
  HeroId,
  LobbyParticipant,
  PlayerInputState,
  TeamId,
  WorldSnapshot,
} from './types.ts';

const GRAVITY = 2450;
const ROUND_RESET_DELAY_MS = 1850;
const COYOTE_TIME_MS = 105;
const JUMP_BUFFER_MS = 125;
const ACTION_BUFFER_MS = 135;

type BufferedCombatAction = 'light' | 'heavy' | 'dash' | 'parry' | 'counter';

interface FighterInputBuffer {
  coyoteMs: number;
  jumpBufferMs: number;
  usedGroundJump: boolean;
  actionType: BufferedCombatAction | null;
  actionBufferMs: number;
}

export class GameSimulation {
  private arena: ArenaDefinition;
  private mode: GameModeId;
  private difficulty: BotDifficulty;
  private snapshot: WorldSnapshot;
  private fxSeq = 1;
  private roundResetTimerMs = 0;
  private accumulatorStep = 0;
  private totalMatchElapsedMs = 0;
  private readonly roundDurationSec: number;
  private inputBuffers = new Map<string, FighterInputBuffer>();
  private readonly combatCtx: CombatContext;

  constructor(
    mode: GameModeId,
    arenaId: string,
    difficulty: BotDifficulty,
    participants: LobbyParticipant[]
  ) {
    this.mode = mode;
    this.arena = ARENAS[arenaId] || ARENAS.shattered_bridge;
    this.difficulty = difficulty;

    const scoreLimit =
      mode === 'dominion'
        ? 1000
        : mode === 'skirmish_3v3'
        ? 15
        : mode === 'skirmish_4v4'
        ? 20
        : 3;

    this.roundDurationSec =
      mode === 'stronghold' ? 240 : mode === 'dominion' ? 300 : 180;

    this.snapshot = {
      mode,
      arenaId: this.arena.id,
      phase: 'countdown',
      countdownSec: 3,
      matchTimerSec: this.roundDurationSec,
      ironScore: 0,
      crimsonScore: 0,
      scoreLimit,
      ironRoundWins: 0,
      crimsonRoundWins: 0,
      currentRound: 1,
      breakingTeam: null,
      fighters: this.spawnFighters(participants),
      zones: this.arena.captureZones.map((z) => ({
        ...z,
        owner: null,
        progress: 0,
        contested: false,
        boosted: false,
      })),
      gate: this.arena.gateObjective
        ? {
            x: this.arena.gateObjective.x,
            y: this.arena.gateObjective.y,
            width: this.arena.gateObjective.width,
            height: this.arena.gateObjective.height,
            hp: this.arena.gateObjective.maxHp,
            maxHp: this.arena.gateObjective.maxHp,
            breached: false,
            underAttack: false,
          }
        : null,
      particles: [],
      callouts: [],
      summary: null,
      screenShake: 0,
      hitStopMs: 0,
      ackSeqs: {},
    };

    this.combatCtx = this.createCombatContext();
  }

  private spawnFighters(participants: LobbyParticipant[]): FighterEntity[] {
    let ironIdx = 0;
    let crimsonIdx = 0;

    return participants.map((p) => {
      const hero = HEROES[p.heroId];
      const spawnPool =
        p.team === 'iron' ? this.arena.spawns.iron : this.arena.spawns.crimson;
      const idx = p.team === 'iron' ? ironIdx++ : crimsonIdx++;
      const pt = spawnPool[idx % spawnPool.length];

      return {
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        team: p.team,
        heroId: p.heroId,
        skinIndex: p.skinIndex,
        x: pt.x,
        y: pt.y,
        vx: 0,
        vy: 0,
        width: hero.hitbox.width,
        height: hero.hitbox.height,
        facing: p.team === 'iron' ? 1 : -1,
        grounded: false,
        jumpsLeft: 2,
        dropThroughTimer: 0,
        onLadder: false,

        hp: hero.maxHp,
        maxHp: hero.maxHp,
        stamina: hero.maxStamina,
        maxStamina: hero.maxStamina,
        oosExhausted: false,
        revengeCharge: 0,
        revengeShield: 0,
        revengeTimer: 0,

        guardDir: 'top',
        actionState: 'idle',
        stateTimerMs: 0,
        stateDurationMs: 0,
        attackDir: 'top',
        attackHitApplied: false,
        parryWindowOpen: false,
        counterReadyTimerMs: 0,
        feintedRecently: false,
        invulnTimerMs: 0,
        respawnTimerMs: 0,
        alive: true,

        animName: 'idle',
        animFrame: 0,
        animTick: 0,

        kills: 0,
        deaths: 0,
        parries: 0,
        counters: 0,
        captures: 0,
        damageDealt: 0,
      };
    });
  }

  getSnapshot(): WorldSnapshot {
    return this.snapshot;
  }

  replaceBotWithHuman(botId: string, participant: LobbyParticipant): boolean {
    const idx = this.snapshot.fighters.findIndex((f) => f.id === botId && f.isBot);
    if (idx === -1) return false;

    const existing = this.snapshot.fighters[idx];
    const hero = HEROES[participant.heroId] || HEROES.kurogane;
    const spawnPool =
      participant.team === 'iron' ? this.arena.spawns.iron : this.arena.spawns.crimson;
    const pt = spawnPool[idx % spawnPool.length];

    this.inputBuffers.delete(botId);
    this.inputBuffers.delete(participant.id);

    this.snapshot.fighters[idx] = {
      ...existing,
      id: participant.id,
      name: participant.name,
      isBot: false,
      team: participant.team,
      heroId: participant.heroId,
      skinIndex: participant.skinIndex,
      x: pt.x,
      y: pt.y,
      vx: 0,
      vy: 0,
      width: hero.hitbox.width,
      height: hero.hitbox.height,
      facing: participant.team === 'iron' ? 1 : -1,
      grounded: false,
      jumpsLeft: 2,
      dropThroughTimer: 0,
      onLadder: false,
      hp: hero.maxHp,
      maxHp: hero.maxHp,
      stamina: hero.maxStamina,
      maxStamina: hero.maxStamina,
      oosExhausted: false,
      revengeCharge: 0,
      revengeShield: 0,
      revengeTimer: 0,
      guardDir: 'top',
      actionState: 'idle',
      stateTimerMs: 0,
      stateDurationMs: 0,
      attackDir: 'top',
      attackHitApplied: false,
      parryWindowOpen: false,
      counterReadyTimerMs: 0,
      feintedRecently: false,
      invulnTimerMs: 1500,
      respawnTimerMs: 0,
      alive: true,
      animName: 'idle',
      animFrame: 0,
      animTick: 0,
      kills: 0,
      deaths: 0,
      parries: 0,
      counters: 0,
      captures: 0,
      damageDealt: 0,
      aiMemory: undefined,
    };

    spawnCallout(
      this.combatCtx,
      pt.x,
      pt.y - 28,
      `${participant.name} DOŁĄCZYŁ!`,
      `${participant.name} JOINED!`,
      participant.team === 'iron' ? '#60A5FA' : '#F87171'
    );

    return true;
  }

  convertHumanToBot(humanId: string, botName?: string): FighterEntity | null {
    const fighter = this.snapshot.fighters.find((f) => f.id === humanId);
    if (!fighter) return null;

    const oldName = fighter.name;
    fighter.isBot = true;
    if (botName && botName.trim()) {
      fighter.name = botName.trim();
    }
    fighter.aiMemory = undefined;
    this.inputBuffers.delete(humanId);
    if (this.snapshot.ackSeqs) {
      delete this.snapshot.ackSeqs[humanId];
    }

    spawnCallout(
      this.combatCtx,
      fighter.x,
      fighter.y - 28,
      `${oldName} OPUŚCIŁ — BOT ${fighter.name}!`,
      `${oldName} LEFT — BOT ${fighter.name}!`,
      fighter.team === 'iron' ? '#60A5FA' : '#F87171'
    );

    return fighter;
  }

  private getOrCreateBuffer(fighterId: string): FighterInputBuffer {
    let buf = this.inputBuffers.get(fighterId);
    if (!buf) {
      buf = {
        coyoteMs: 0,
        jumpBufferMs: 0,
        usedGroundJump: false,
        actionType: null,
        actionBufferMs: 0,
      };
      this.inputBuffers.set(fighterId, buf);
    }
    return buf;
  }

  private getCombatContext(): CombatContext {
    return this.combatCtx;
  }

  private createCombatContext(): CombatContext {
    return {
      fighters: this.snapshot.fighters,
      gate: this.snapshot.gate,
      particles: this.snapshot.particles,
      callouts: this.snapshot.callouts,
      nextFxId: () => this.fxSeq++,
      addScreenShake: (amount: number) => {
        this.snapshot.screenShake = Math.min(18, this.snapshot.screenShake + amount);
      },
      triggerHitStop: (ms: number) => {
        this.snapshot.hitStopMs = Math.max(this.snapshot.hitStopMs, ms);
      },
      onKill: (killer: FighterEntity, victim: FighterEntity) => {
        killer.kills += 1;
        this.handleFighterElimination(victim, killer.team);
      },
      onGateHit: (_attacker: FighterEntity, damage: number) => {
        if (!this.snapshot.gate || this.snapshot.gate.breached) return;
        this.snapshot.gate.hp = Math.max(0, this.snapshot.gate.hp - damage);
        this.snapshot.gate.underAttack = true;
        soundEngine.playHit(true);
        if (this.snapshot.gate.hp <= 0) {
          this.snapshot.gate.breached = true;
          this.snapshot.ironScore = this.snapshot.gate.maxHp;
          spawnCallout(
            this.combatCtx,
            this.snapshot.gate.x,
            this.snapshot.gate.y - 30,
            'BRAMA PADŁA!',
            'GATE DESTROYED!',
            '#F59E0B'
          );
          this.endMatch(
            'iron',
            'Żelazny Legion zniszczył Bramę Twierdzy!',
            'Iron Legion shattered the Fortress Gate!'
          );
        }
      },
    };
  }

  private handleFighterElimination(victim: FighterEntity, killerTeam?: TeamId): void {
    victim.deaths += 1;
    victim.alive = false;
    victim.actionState = 'dead';
    victim.stateTimerMs = 0;
    victim.stateDurationMs = 900;
    victim.animName = 'death';
    victim.animFrame = 0;
    victim.animTick = 0;

    if (this.mode === 'duel_1v1' || this.mode === 'brawl_2v2') {
      // Round-based elimination (no respawn mid-round)
      victim.respawnTimerMs = 999999;
      this.checkRoundEnd();
      return;
    }

    if (this.mode === 'skirmish_3v3' || this.mode === 'skirmish_4v4') {
      const scoringTeam: TeamId =
        killerTeam ?? (victim.team === 'iron' ? 'crimson' : 'iron');
      if (scoringTeam === 'iron') this.snapshot.ironScore += 1;
      else this.snapshot.crimsonScore += 1;

      if (this.snapshot.ironScore >= this.snapshot.scoreLimit) {
        this.endMatch(
          'iron',
          'Żelazny Legion osiągnął limit eliminacji!',
          'Iron Legion reached the elimination target!'
        );
        return;
      }
      if (this.snapshot.crimsonScore >= this.snapshot.scoreLimit) {
        this.endMatch(
          'crimson',
          'Szkarłatny Świt osiągnął limit eliminacji!',
          'Crimson Dawn reached the elimination target!'
        );
        return;
      }
      victim.respawnTimerMs = 3200;
      return;
    }

    if (this.mode === 'dominion') {
      const scoringTeam: TeamId =
        killerTeam ?? (victim.team === 'iron' ? 'crimson' : 'iron');
      if (scoringTeam === 'iron') this.snapshot.ironScore += 20;
      else this.snapshot.crimsonScore += 20;

      // Check Breaking!
      if (this.snapshot.breakingTeam === victim.team) {
        victim.respawnTimerMs = 999999;
        const aliveLeft = this.snapshot.fighters.some(
          (f) => f.team === victim.team && f.alive
        );
        if (!aliveLeft) {
          const winner: TeamId = victim.team === 'iron' ? 'crimson' : 'iron';
          this.endMatch(
            winner,
            winner === 'iron'
              ? 'Żelazny Legion przełamał i wyeliminował wroga!'
              : 'Szkarłatny Świt przełamał i wyeliminował wroga!',
            winner === 'iron'
              ? 'Iron Legion broke and eliminated the enemy!'
              : 'Crimson Dawn broke and eliminated the enemy!'
          );
        }
      } else {
        victim.respawnTimerMs = 3500;
      }
      return;
    }

    if (this.mode === 'stronghold') {
      victim.respawnTimerMs = 3600;
    }
  }

  private checkRoundEnd(): void {
    if (this.roundResetTimerMs > 0 || this.snapshot.phase === 'ended') return;
    const ironAlive = this.snapshot.fighters.some((f) => f.team === 'iron' && f.alive);
    const crimsonAlive = this.snapshot.fighters.some(
      (f) => f.team === 'crimson' && f.alive
    );
    if (ironAlive && crimsonAlive) return;

    if (ironAlive) this.snapshot.ironRoundWins += 1;
    else if (crimsonAlive) this.snapshot.crimsonRoundWins += 1;

    this.snapshot.ironScore = this.snapshot.ironRoundWins;
    this.snapshot.crimsonScore = this.snapshot.crimsonRoundWins;

    if (this.snapshot.ironRoundWins >= 3) {
      this.endMatch(
        'iron',
        'Żelazny Legion wygrał 3 rundy na arenie!',
        'Iron Legion claimed 3 arena rounds!'
      );
      return;
    }
    if (this.snapshot.crimsonRoundWins >= 3) {
      this.endMatch(
        'crimson',
        'Szkarłatny Świt wygrał 3 rundy na arenie!',
        'Crimson Dawn claimed 3 arena rounds!'
      );
      return;
    }

    this.roundResetTimerMs = ROUND_RESET_DELAY_MS;
  }

  private resetRound(): void {
    this.snapshot.currentRound += 1;
    this.snapshot.phase = 'countdown';
    this.snapshot.countdownSec = 2;
    this.snapshot.matchTimerSec = this.roundDurationSec;
    this.accumulatorStep = 0;
    this.roundResetTimerMs = 0;
    this.inputBuffers.clear();

    let ironIdx = 0;
    let crimsonIdx = 0;
    for (const f of this.snapshot.fighters) {
      const hero = HEROES[f.heroId];
      const pool =
        f.team === 'iron' ? this.arena.spawns.iron : this.arena.spawns.crimson;
      const idx = f.team === 'iron' ? ironIdx++ : crimsonIdx++;
      const pt = pool[idx % pool.length];
      f.x = pt.x;
      f.y = pt.y;
      f.vx = 0;
      f.vy = 0;
      f.grounded = false;
      f.jumpsLeft = 2;
      f.dropThroughTimer = 0;
      f.onLadder = false;
      f.hp = hero.maxHp;
      f.stamina = hero.maxStamina;
      f.oosExhausted = false;
      f.revengeCharge = 0;
      f.revengeShield = 0;
      f.revengeTimer = 0;
      f.alive = true;
      f.actionState = 'idle';
      f.stateTimerMs = 0;
      f.stateDurationMs = 0;
      f.counterReadyTimerMs = 0;
      f.respawnTimerMs = 0;
      f.facing = f.team === 'iron' ? 1 : -1;
      f.animName = 'idle';
      f.animFrame = 0;
    }
  }

  private endMatch(winner: TeamId | 'draw', reasonPl: string, reasonEn: string): void {
    if (this.snapshot.phase === 'ended') return;
    this.snapshot.phase = 'ended';
    this.snapshot.summary = {
      winnerTeam: winner,
      reasonPl,
      reasonEn,
      durationSec: Math.max(1, Math.round(this.totalMatchElapsedMs / 1000)),
      ironScore: Math.round(this.snapshot.ironScore),
      crimsonScore: Math.round(this.snapshot.crimsonScore),
    };
  }

  step(
    dtMs: number,
    humanInputs: Record<string, PlayerInputState>
  ): void {
    const clampedDt = Math.min(250, Math.max(1, dtMs));

    // Decay screen shake & hitstop visually without freezing world simulation or match clock
    this.snapshot.screenShake = Math.max(0, this.snapshot.screenShake - clampedDt * 0.035);
    if (this.snapshot.hitStopMs > 0) {
      this.snapshot.hitStopMs = Math.max(0, this.snapshot.hitStopMs - clampedDt);
    }
    this.updateParticlesAndCallouts(clampedDt);

    if (this.snapshot.phase === 'ended') {
      const dtSec = clampedDt / 1000;
      for (const fighter of this.snapshot.fighters) {
        if (!fighter.alive) {
          this.syncAnimationState(fighter);
          this.applyDeadPhysics(fighter, dtSec);
          this.advanceSpriteAnimation(fighter, clampedDt);
        }
      }
      return;
    }

    // Countdown phase
    if (this.snapshot.phase === 'countdown') {
      this.accumulatorStep += clampedDt;
      while (this.accumulatorStep >= 1000) {
        this.accumulatorStep -= 1000;
        this.snapshot.countdownSec -= 1;
        if (this.snapshot.countdownSec <= 0) {
          this.snapshot.phase = 'active';
          break;
        }
      }
      // Still animate idle sprites during countdown
      for (const f of this.snapshot.fighters) {
        this.advanceSpriteAnimation(f, clampedDt);
      }
      return;
    }

    // Round transition timer (for 1v1 / 2v2)
    if (this.roundResetTimerMs > 0) {
      this.roundResetTimerMs -= clampedDt;
      if (this.roundResetTimerMs <= 0) {
        this.resetRound();
        return;
      }
    }

    // Match timer (strict 1:1 wall-clock seconds)
    this.totalMatchElapsedMs += clampedDt;
    this.accumulatorStep += clampedDt;
    while (this.accumulatorStep >= 1000) {
      this.accumulatorStep -= 1000;
      this.snapshot.matchTimerSec = Math.max(0, this.snapshot.matchTimerSec - 1);
      if (this.snapshot.matchTimerSec === 0) {
        this.handleMatchTimeout();
        return;
      }
    }

    const dtSec = clampedDt / 1000;
    const combatCtx = this.getCombatContext();

    // Update each fighter
    for (const fighter of this.snapshot.fighters) {
      if (!fighter.alive) {
        this.syncAnimationState(fighter);
        this.applyDeadPhysics(fighter, dtSec);
        this.advanceSpriteAnimation(fighter, clampedDt);
        updateCombatTimers(fighter, clampedDt, combatCtx);
        if (fighter.respawnTimerMs === 0 && this.mode !== 'duel_1v1' && this.mode !== 'brawl_2v2') {
          if (this.snapshot.breakingTeam !== fighter.team) {
            this.respawnFighter(fighter);
          }
        }
        continue;
      }

      const rawInput = fighter.isBot
        ? computeBotInput(fighter, {
            arena: this.arena,
            mode: this.mode,
            difficulty: this.difficulty,
            fighters: this.snapshot.fighters,
            zones: this.snapshot.zones,
            gate: this.snapshot.gate,
            dtMs: clampedDt,
          })
        : humanInputs[fighter.id] || emptyInput();

      if (!fighter.isBot && rawInput.seq > 0) {
        if (!this.snapshot.ackSeqs) this.snapshot.ackSeqs = {};
        this.snapshot.ackSeqs[fighter.id] = rawInput.seq;
      }

      const buf = this.getOrCreateBuffer(fighter.id);
      if (buf.jumpBufferMs > 0) buf.jumpBufferMs = Math.max(0, buf.jumpBufferMs - clampedDt);
      if (buf.actionBufferMs > 0) {
        buf.actionBufferMs = Math.max(0, buf.actionBufferMs - clampedDt);
        if (buf.actionBufferMs === 0) buf.actionType = null;
      }

      if (rawInput.jumpPressed) {
        buf.jumpBufferMs = JUMP_BUFFER_MS;
      }

      const canStartCombat =
        fighter.actionState === 'idle' || fighter.actionState === 'recovery';

      // Buffer combat one-shots if pressed slightly early before recovery/hitstun ends
      if (!canStartCombat && !rawInput.feintPressed) {
        if (rawInput.counterPressed) {
          buf.actionType = 'counter';
          buf.actionBufferMs = ACTION_BUFFER_MS;
        } else if (rawInput.parryPressed) {
          buf.actionType = 'parry';
          buf.actionBufferMs = ACTION_BUFFER_MS;
        } else if (rawInput.dashPressed) {
          buf.actionType = 'dash';
          buf.actionBufferMs = ACTION_BUFFER_MS;
        } else if (rawInput.heavyPressed) {
          buf.actionType = 'heavy';
          buf.actionBufferMs = ACTION_BUFFER_MS;
        } else if (rawInput.lightPressed) {
          buf.actionType = 'light';
          buf.actionBufferMs = ACTION_BUFFER_MS;
        }
      }

      const input: PlayerInputState =
        canStartCombat &&
        buf.actionType &&
        !rawInput.lightPressed &&
        !rawInput.heavyPressed &&
        !rawInput.dashPressed &&
        !rawInput.parryPressed &&
        !rawInput.counterPressed
          ? {
              ...rawInput,
              lightPressed: buf.actionType === 'light',
              heavyPressed: buf.actionType === 'heavy',
              dashPressed: buf.actionType === 'dash',
              parryPressed: buf.actionType === 'parry',
              counterPressed: buf.actionType === 'counter',
            }
          : rawInput;

      if (canStartCombat && buf.actionType) {
        buf.actionType = null;
        buf.actionBufferMs = 0;
      }

      // Update guard direction immediately whenever not actively swinging
      if (
        fighter.actionState === 'idle' ||
        fighter.actionState === 'recovery' ||
        fighter.actionState === 'blockstun' ||
        fighter.actionState === 'dash'
      ) {
        fighter.guardDir = input.guardDir;
      }

      // Face locked-on target if active
      const lockedEnemy = input.lockedTargetId
        ? this.snapshot.fighters.find(
            (t) => t.id === input.lockedTargetId && t.alive && t.team !== fighter.team
          )
        : undefined;
      if (
        lockedEnemy &&
        (fighter.actionState === 'idle' ||
          fighter.actionState === 'recovery' ||
          fighter.actionState === 'blockstun' ||
          fighter.actionState === 'windup_light' ||
          fighter.actionState === 'windup_heavy')
      ) {
        fighter.facing = lockedEnemy.x >= fighter.x ? 1 : -1;
      }

      // Movement physics (includes coyote time & buffered jump)
      this.applyMovement(fighter, input, buf, dtSec, clampedDt, Boolean(lockedEnemy));

      // Combat actions
      startAttackOrAction(fighter, input, combatCtx);
      updateCombatTimers(fighter, clampedDt, combatCtx);

      // Animation selection
      this.syncAnimationState(fighter);
      this.advanceSpriteAnimation(fighter, clampedDt);
    }

    // Mode objectives (Dominion zones & Stronghold gate/ramparts)
    this.updateObjectives(dtSec, combatCtx);
  }

  private handleMatchTimeout(): void {
    if (this.mode === 'duel_1v1' || this.mode === 'brawl_2v2') {
      const ironAlive = this.snapshot.fighters.filter((f) => f.team === 'iron' && f.alive);
      const crimsonAlive = this.snapshot.fighters.filter((f) => f.team === 'crimson' && f.alive);
      const ironHpRatio = ironAlive.reduce((acc, f) => acc + f.hp / f.maxHp, 0);
      const crimsonHpRatio = crimsonAlive.reduce((acc, f) => acc + f.hp / f.maxHp, 0);

      if (
        ironAlive.length > crimsonAlive.length ||
        (ironAlive.length === crimsonAlive.length && ironHpRatio > crimsonHpRatio + 0.001)
      ) {
        this.snapshot.ironRoundWins += 1;
      } else if (
        crimsonAlive.length > ironAlive.length ||
        (ironAlive.length === crimsonAlive.length && crimsonHpRatio > ironHpRatio + 0.001)
      ) {
        this.snapshot.crimsonRoundWins += 1;
      }

      this.snapshot.ironScore = this.snapshot.ironRoundWins;
      this.snapshot.crimsonScore = this.snapshot.crimsonRoundWins;

      if (this.snapshot.ironRoundWins >= 3) {
        this.endMatch(
          'iron',
          'Żelazny Legion wygrał 3 rundy na arenie!',
          'Iron Legion claimed 3 arena rounds!'
        );
        return;
      }
      if (this.snapshot.crimsonRoundWins >= 3) {
        this.endMatch(
          'crimson',
          'Szkarłatny Świt wygrał 3 rundy na arenie!',
          'Crimson Dawn claimed 3 arena rounds!'
        );
        return;
      }

      this.resetRound();
      return;
    }

    if (this.mode === 'stronghold') {
      this.endMatch(
        'crimson',
        'Obrońcy odparli oblężenie Twierdzy do końca czasu!',
        'Defenders held the Fortress Gate until time expired!'
      );
      return;
    }
    if (this.snapshot.ironScore > this.snapshot.crimsonScore) {
      this.endMatch('iron', 'Żelazny Legion zwyciężył przewagą punktów!', 'Iron Legion won on points!');
    } else if (this.snapshot.crimsonScore > this.snapshot.ironScore) {
      this.endMatch('crimson', 'Szkarłatny Świt zwyciężył przewagą punktów!', 'Crimson Dawn won on points!');
    } else {
      this.endMatch('draw', 'Czas minął — remis na arenie!', 'Time expired — arena draw!');
    }
  }

  private respawnFighter(fighter: FighterEntity): void {
    const hero = HEROES[fighter.heroId];
    const pool =
      fighter.team === 'iron' ? this.arena.spawns.iron : this.arena.spawns.crimson;
    const pt = pool[Math.floor(Math.random() * pool.length)];
    fighter.x = pt.x;
    fighter.y = pt.y;
    fighter.vx = 0;
    fighter.vy = 0;
    fighter.onLadder = false;
    fighter.hp = hero.maxHp;
    fighter.stamina = hero.maxStamina;
    fighter.oosExhausted = false;
    fighter.alive = true;
    fighter.actionState = 'idle';
    fighter.stateTimerMs = 0;
    fighter.stateDurationMs = 0;
    fighter.invulnTimerMs = 1000;
    fighter.counterReadyTimerMs = 0;
    fighter.animName = 'idle';
    fighter.animFrame = 0;
    this.inputBuffers.delete(fighter.id);
  }

  private applyDeadPhysics(f: FighterEntity, dtSec: number): void {
    if (f.y > this.arena.deathY + 120) return;

    const prevBottom = f.y + f.height;
    f.vx *= Math.pow(f.grounded ? 0.002 : 0.15, dtSec);
    if (Math.abs(f.vx) < 3) f.vx = 0;
    f.vy = Math.min(1180, f.vy + GRAVITY * dtSec);

    f.x += f.vx * dtSec;
    f.y += f.vy * dtSec;
    f.x = Math.max(40, Math.min(this.arena.worldWidth - 40, f.x));

    f.grounded = false;
    const newBottom = f.y + f.height;
    if (f.vy >= 0) {
      for (const plat of this.arena.platforms) {
        const withinX =
          f.x + f.width * 0.35 > plat.x && f.x - f.width * 0.35 < plat.x + plat.width;
        if (withinX && prevBottom <= plat.y + 14 && newBottom >= plat.y) {
          f.y = plat.y - f.height;
          f.vy = 0;
          f.grounded = true;
          break;
        }
      }
    }
  }

  private applyMovement(
    f: FighterEntity,
    input: PlayerInputState,
    buf: FighterInputBuffer,
    dtSec: number,
    dtMs: number,
    isLockedOn: boolean
  ): void {
    const hero = HEROES[f.heroId];

    if (f.dropThroughTimer > 0) f.dropThroughTimer = Math.max(0, f.dropThroughTimer - dtMs);

    if (f.grounded) {
      buf.coyoteMs = COYOTE_TIME_MS;
      buf.usedGroundJump = false;
    } else if (buf.coyoteMs > 0) {
      buf.coyoteMs = Math.max(0, buf.coyoteMs - dtMs);
    }

    const canControlHoriz =
      f.actionState === 'idle' ||
      f.actionState === 'windup_light' ||
      f.actionState === 'windup_heavy' ||
      f.actionState === 'recovery';

    if (canControlHoriz) {
      const slowFactor =
        f.actionState === 'windup_light' || f.actionState === 'windup_heavy'
          ? 0.45
          : f.oosExhausted
          ? 0.72
          : 1;
      const targetVx = input.moveX * hero.moveSpeed * slowFactor;
      const reversing = input.moveX !== 0 && f.vx !== 0 && Math.sign(f.vx) !== Math.sign(input.moveX);
      const accelRate = f.grounded ? (reversing ? 38 : 28) : reversing ? 24 : 18;
      f.vx += (targetVx - f.vx) * Math.min(1, dtSec * accelRate);
      if (Math.abs(targetVx - f.vx) < 2) f.vx = targetVx;

      if (input.moveX !== 0 && f.actionState === 'idle' && !isLockedOn) {
        f.facing = input.moveX > 0 ? 1 : -1;
      }
    } else if (f.actionState !== 'dash') {
      f.vx *= Math.pow(0.06, dtSec);
    }

    // Climbable Ladders overlap detection
    const overlappingLadder = this.arena.ladders.find((l) => {
      const ladCx = l.x + l.width / 2;
      const withinX = Math.abs(f.x - ladCx) <= l.width * 0.72;
      const feetY = f.y + f.height;
      const withinY = feetY >= l.y - 6 && f.y <= l.y + l.height;
      return withinX && withinY;
    });

    const feetY = f.y + f.height;
    const canClimbState = f.actionState === 'idle' || f.actionState === 'recovery';
    const wantsClimbUp = Boolean(
      overlappingLadder && input.upHeld && feetY > overlappingLadder.y + 4
    );
    const wantsClimbDown = Boolean(
      overlappingLadder &&
        input.downHeld &&
        feetY < overlappingLadder.y + overlappingLadder.height - 4
    );
    const explicitJumpOffLadder = Boolean(f.onLadder && input.jumpPressed && !input.upHeld);

    if (!canClimbState || !overlappingLadder || explicitJumpOffLadder) {
      f.onLadder = false;
    } else if (wantsClimbUp || wantsClimbDown) {
      f.onLadder = true;
    }

    if (f.onLadder && overlappingLadder) {
      f.grounded = false;
      f.jumpsLeft = 2;
      buf.coyoteMs = COYOTE_TIME_MS;
      buf.usedGroundJump = false;
      buf.jumpBufferMs = 0;

      const climbSpeed = 310;
      if (wantsClimbUp) {
        f.vy = -climbSpeed;
      } else if (wantsClimbDown) {
        f.vy = climbSpeed;
      } else {
        f.vy = 0;
      }

      if (input.moveX === 0) {
        const ladCx = overlappingLadder.x + overlappingLadder.width / 2;
        f.x += (ladCx - f.x) * Math.min(1, dtSec * 8);
      }
    } else {
      // Drop through one-way platforms (only when not grabbing a ladder downward)
      if (input.downHeld && f.grounded) {
        f.dropThroughTimer = 220;
        f.grounded = false;
        buf.coyoteMs = 0;
      }

      // Jump / Double Jump with Coyote Time + Input Buffer
      const canCoyoteGroundJump = (f.grounded || buf.coyoteMs > 0) && !buf.usedGroundJump;
      if (
        buf.jumpBufferMs > 0 &&
        (canCoyoteGroundJump || f.jumpsLeft > 0) &&
        f.actionState !== 'hitstun' &&
        f.actionState !== 'parry_stun'
      ) {
        if (canCoyoteGroundJump) {
          f.vy = hero.jumpVelocity;
          f.jumpsLeft = 1;
          buf.usedGroundJump = true;
        } else {
          f.vy = hero.doubleJumpVelocity;
          f.jumpsLeft = Math.max(0, f.jumpsLeft - 1);
        }
        f.grounded = false;
        f.onLadder = false;
        buf.coyoteMs = 0;
        buf.jumpBufferMs = 0;
        spawnBurst(this.getCombatContext(), f.x, f.y + f.height, '#CBD5E1', 5, 'dust');
      }

      // Gravity
      f.vy += GRAVITY * dtSec;
      f.vy = Math.min(f.vy, 1180);
    }

    const prevBottom = f.y + f.height;
    f.x += f.vx * dtSec;
    f.y += f.vy * dtSec;

    // Snap onto upper platform smoothly when finishing an upward ladder climb
    if (f.onLadder && overlappingLadder && wantsClimbUp && f.y + f.height <= overlappingLadder.y + 4) {
      f.y = overlappingLadder.y - f.height;
      f.vy = 0;
      f.grounded = true;
      f.onLadder = false;
      f.jumpsLeft = 2;
      buf.usedGroundJump = false;
    }

    // Arena horizontal boundaries
    f.x = Math.max(40, Math.min(this.arena.worldWidth - 40, f.x));

    // Gate collision barrier (defenders can pass through behind/inside, attackers hit gate front)
    if (this.snapshot.gate && !this.snapshot.gate.breached && f.team === 'iron') {
      const gate = this.snapshot.gate;
      if (
        f.x + f.width / 2 > gate.x &&
        f.x - f.width / 2 < gate.x + gate.width &&
        f.y + f.height > gate.y + 10
      ) {
        f.x = gate.x - f.width / 2;
        if (f.vx > 0) f.vx = 0;
      }
    }

    // Platform collisions (skip one-way ledges when descending down a ladder)
    if (!(f.onLadder && overlappingLadder && wantsClimbUp && f.grounded)) {
      f.grounded = false;
      const newBottom = f.y + f.height;

      if (f.vy >= 0) {
        for (const plat of this.arena.platforms) {
          if (plat.oneWay && (f.dropThroughTimer > 0 || f.onLadder)) continue;
          const withinX =
            f.x + f.width * 0.35 > plat.x && f.x - f.width * 0.35 < plat.x + plat.width;
          if (withinX && prevBottom <= plat.y + 14 && newBottom >= plat.y) {
            f.y = plat.y - f.height;
            f.vy = 0;
            f.grounded = true;
            f.onLadder = false;
            f.jumpsLeft = 2;
            buf.usedGroundJump = false;
            break;
          }
        }
      }
    }

    // Void pit death
    if (f.y > this.arena.deathY) {
      f.hp = 0;
      f.onLadder = false;
      spawnBurst(this.getCombatContext(), f.x, this.arena.deathY - 30, '#EF4444', 12, 'spark');
      this.handleFighterElimination(f);
    }
  }

  private updateObjectives(dtSec: number, ctx: CombatContext): void {
    if (this.snapshot.zones.length === 0 && !this.snapshot.gate) return;

    if (this.snapshot.gate) {
      this.snapshot.gate.underAttack = false;
    }

    let ironZones = 0;
    let crimsonZones = 0;

    for (const zone of this.snapshot.zones) {
      const ironInside = this.snapshot.fighters.filter(
        (f) =>
          f.alive &&
          f.team === 'iron' &&
          f.x >= zone.x &&
          f.x <= zone.x + zone.width &&
          f.y + f.height >= zone.y &&
          f.y <= zone.y + zone.height + 24
      );
      const crimsonInside = this.snapshot.fighters.filter(
        (f) =>
          f.alive &&
          f.team === 'crimson' &&
          f.x >= zone.x &&
          f.x <= zone.x + zone.width &&
          f.y + f.height >= zone.y &&
          f.y <= zone.y + zone.height + 24
      );

      zone.contested = ironInside.length > 0 && crimsonInside.length > 0;
      zone.boosted =
        !zone.contested &&
        ((zone.owner === 'iron' && ironInside.length > 0) ||
          (zone.owner === 'crimson' && crimsonInside.length > 0));

      if (!zone.contested) {
        if (ironInside.length > 0 && zone.owner !== 'iron') {
          const rate = 34 + (ironInside.length - 1) * 14;
          zone.progress = Math.min(100, zone.progress + rate * dtSec);
          if (zone.progress >= 100) {
            zone.owner = 'iron';
            ironInside.forEach((f) => (f.captures += 1));
            this.snapshot.ironScore += 35;
            soundEngine.playZoneCapture();
            spawnCallout(
              ctx,
              zone.x + zone.width / 2,
              zone.y - 10,
              `STREFA ${zone.id} PRZEJĘTA!`,
              `ZONE ${zone.id} CAPTURED!`,
              '#3B82F6'
            );
          }
        } else if (crimsonInside.length > 0 && zone.owner !== 'crimson') {
          const rate = 34 + (crimsonInside.length - 1) * 14;
          zone.progress = Math.max(-100, zone.progress - rate * dtSec);
          if (zone.progress <= -100) {
            zone.owner = 'crimson';
            crimsonInside.forEach((f) => (f.captures += 1));
            this.snapshot.crimsonScore += 35;
            soundEngine.playZoneCapture();
            spawnCallout(
              ctx,
              zone.x + zone.width / 2,
              zone.y - 10,
              `STREFA ${zone.id} PRZEJĘTA!`,
              `ZONE ${zone.id} CAPTURED!`,
              '#EF4444'
            );
          }
        }
      }

      if (zone.owner === 'iron') ironZones++;
      if (zone.owner === 'crimson') crimsonZones++;
    }

    if (this.mode === 'dominion') {
      // Score accrual per held zone (+3/sec base, +5/sec if boosted, x1.5 if holding all 3 zones!)
      for (const zone of this.snapshot.zones) {
        if (zone.owner === 'iron') {
          const mult = ironZones === 3 ? 1.5 : 1;
          this.snapshot.ironScore += (zone.boosted ? 6.5 : 3.5) * mult * dtSec;
        } else if (zone.owner === 'crimson') {
          const mult = crimsonZones === 3 ? 1.5 : 1;
          this.snapshot.crimsonScore += (zone.boosted ? 6.5 : 3.5) * mult * dtSec;
        }
      }

      // Trigger Breaking at 1000 points OR if one team captures & holds all 3 zones past 750!
      if (!this.snapshot.breakingTeam) {
        if (this.snapshot.ironScore >= this.snapshot.scoreLimit) {
          this.snapshot.ironScore = this.snapshot.scoreLimit;
          this.snapshot.breakingTeam = 'crimson';
        } else if (this.snapshot.crimsonScore >= this.snapshot.scoreLimit) {
          this.snapshot.crimsonScore = this.snapshot.scoreLimit;
          this.snapshot.breakingTeam = 'iron';
        }
      } else {
        // Also end immediately if breaking team has 0 alive fighters
        const aliveLeft = this.snapshot.fighters.some(
          (f) => f.team === this.snapshot.breakingTeam && f.alive
        );
        if (!aliveLeft) {
          const winner: TeamId =
            this.snapshot.breakingTeam === 'iron' ? 'crimson' : 'iron';
          this.endMatch(
            winner,
            winner === 'iron'
              ? 'Żelazny Legion zdobył dominację nad areną!'
              : 'Szkarłatny Świt zdobył dominację nad areną!',
            winner === 'iron'
              ? 'Iron Legion achieved total Dominion!'
              : 'Crimson Dawn achieved total Dominion!'
          );
        }
      }
    }

    // Stronghold Rampart siege bonus: if Attackers hold ramparts A/B, siege ballistas chip the Gate
    if (this.mode === 'stronghold' && this.snapshot.gate && !this.snapshot.gate.breached) {
      if (ironZones > 0) {
        const siegeChip = ironZones * 7 * dtSec;
        this.snapshot.gate.hp = Math.max(0, this.snapshot.gate.hp - siegeChip);
        this.snapshot.ironScore = Math.round(
          this.snapshot.gate.maxHp - this.snapshot.gate.hp
        );
        if (this.snapshot.gate.hp <= 0) {
          this.snapshot.gate.breached = true;
          this.endMatch(
            'iron',
            'Machiny oblężnicze zburzyły Bramę Twierdzy!',
            'Siege engines shattered the Fortress Gate!'
          );
        }
      }
    }
  }

  private syncAnimationState(f: FighterEntity): void {
    let desired: FighterEntity['animName'] = 'idle';

    if (!f.alive || f.actionState === 'dead') {
      desired = 'death';
    } else if (f.actionState === 'hitstun' || f.actionState === 'parry_stun') {
      desired = f.actionState === 'parry_stun' ? 'parryFlash' : 'takeHit';
    } else if (f.actionState === 'windup_light' || f.actionState === 'active_light') {
      desired = 'attackLight';
    } else if (
      f.actionState === 'windup_heavy' ||
      f.actionState === 'active_heavy' ||
      f.actionState === 'active_counter'
    ) {
      desired = 'attackHeavy';
    } else if (f.onLadder) {
      desired = Math.abs(f.vy) > 10 ? 'run' : 'idle';
    } else if (!f.grounded) {
      desired = f.vy < 0 ? 'jump' : 'fall';
    } else if (Math.abs(f.vx) > 25) {
      desired = 'run';
    }

    if (f.animName !== desired) {
      f.animName = desired;
      f.animFrame = 0;
      f.animTick = 0;
    }
  }

  private advanceSpriteAnimation(f: FighterEntity, dtMs: number): void {
    const hero = HEROES[f.heroId];
    const anim = hero.sprites[f.animName];
    const frameDurationMs = anim.hold * 14;
    f.animTick += dtMs;
    while (f.animTick >= frameDurationMs) {
      f.animTick -= frameDurationMs;
      if (f.animFrame < anim.frames - 1) {
        f.animFrame += 1;
      } else if (anim.loop !== false) {
        f.animFrame = 0;
      }
    }
  }

  private updateParticlesAndCallouts(dtMs: number): void {
    for (let i = this.snapshot.particles.length - 1; i >= 0; i--) {
      const p = this.snapshot.particles[i];
      p.lifeMs += dtMs;
      if (p.lifeMs >= p.maxLifeMs) {
        this.snapshot.particles.splice(i, 1);
        continue;
      }
      const dtSec = dtMs / 1000;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      if (p.kind === 'spark') p.vy += 450 * dtSec;
      p.alpha = 1 - p.lifeMs / p.maxLifeMs;
    }

    for (let i = this.snapshot.callouts.length - 1; i >= 0; i--) {
      const c = this.snapshot.callouts[i];
      c.lifeMs += dtMs;
      if (c.lifeMs >= c.maxLifeMs) {
        this.snapshot.callouts.splice(i, 1);
        continue;
      }
      c.y -= (dtMs / 1000) * 34;
    }
  }
}

export function emptyInput(): PlayerInputState {
  return {
    moveX: 0,
    upHeld: false,
    jumpPressed: false,
    downHeld: false,
    dashPressed: false,
    guardDir: 'top',
    lightPressed: false,
    heavyPressed: false,
    parryPressed: false,
    feintPressed: false,
    counterPressed: false,
    seq: 0,
  };
}
