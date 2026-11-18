import type {
  ArenaDefinition,
  BotDifficulty,
  FighterEntity,
  GameModeId,
  GateRuntimeState,
  GuardDirection,
  LadderDef,
  PlayerInputState,
  ZoneRuntimeState,
} from '../types.ts';
import { HEROES } from '../heroes.ts';
import {
  findIncomingParryableAttack,
  randomGuardExcept,
} from '../combat/combatSystem.ts';

interface DifficultyProfile {
  reactionMs: number;
  parryChance: number;
  blockChance: number;
  feintChance: number;
  mixupChance: number;
  attackCadenceMs: number;
}

const PROFILES: Record<BotDifficulty, DifficultyProfile> = {
  recruit: {
    reactionMs: 390,
    parryChance: 0.14,
    blockChance: 0.48,
    feintChance: 0.05,
    mixupChance: 0.35,
    attackCadenceMs: 780,
  },
  veteran: {
    reactionMs: 210,
    parryChance: 0.44,
    blockChance: 0.74,
    feintChance: 0.22,
    mixupChance: 0.7,
    attackCadenceMs: 510,
  },
  warlord: {
    reactionMs: 110,
    parryChance: 0.76,
    blockChance: 0.9,
    feintChance: 0.38,
    mixupChance: 0.92,
    attackCadenceMs: 360,
  },
};

export interface BotContext {
  arena: ArenaDefinition;
  mode: GameModeId;
  difficulty: BotDifficulty;
  fighters: FighterEntity[];
  zones: ZoneRuntimeState[];
  gate: GateRuntimeState | null;
  dtMs: number;
}

export function computeBotInput(
  bot: FighterEntity,
  ctx: BotContext
): PlayerInputState {
  if (!bot.aiMemory) {
    bot.aiMemory = {
      targetId: null,
      goalZoneId: null,
      reactionTimerMs: 0,
      pendingGuard: bot.guardDir,
      feintCooldownMs: 0,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      strafeSwapMs: 1200,
      attackCooldownMs: 0,
      lastX: bot.x,
      stuckTimerMs: 0,
    };
  }

  const mem = bot.aiMemory;
  const profile = PROFILES[ctx.difficulty];
  const hero = HEROES[bot.heroId];

  const input: PlayerInputState = {
    moveX: 0,
    upHeld: false,
    jumpPressed: false,
    downHeld: false,
    dashPressed: false,
    guardDir: bot.guardDir,
    lightPressed: false,
    heavyPressed: false,
    parryPressed: false,
    feintPressed: false,
    counterPressed: false,
    seq: 0,
  };

  if (!bot.alive) return input;

  mem.reactionTimerMs = Math.max(0, mem.reactionTimerMs - ctx.dtMs);
  mem.feintCooldownMs = Math.max(0, mem.feintCooldownMs - ctx.dtMs);
  mem.attackCooldownMs = Math.max(0, mem.attackCooldownMs - ctx.dtMs);
  mem.strafeSwapMs -= ctx.dtMs;
  if (mem.strafeSwapMs <= 0) {
    mem.strafeDir = mem.strafeDir === 1 ? -1 : 1;
    mem.strafeSwapMs = 900 + Math.random() * 1100;
  }

  // 1. IMMEDIATE COUNTER-ATTACK IF PARRIED AN ENEMY!
  if (bot.counterReadyTimerMs > 0) {
    input.counterPressed = true;
    return input;
  }

  // 2. DEFENSIVE REACTION LAYER (Guard matching + Timed Parry + Feint out of bad heavies)
  const threat = findNearestThreat(bot, ctx.fighters);
  const incomingParryable = findIncomingParryableAttack(bot, ctx.fighters);

  if (incomingParryable) {
    if (mem.reactionTimerMs <= 0) {
      if (Math.random() < profile.parryChance && !bot.oosExhausted) {
        input.guardDir = incomingParryable.attackDir;
        input.parryPressed = true;
        mem.reactionTimerMs = profile.reactionMs;
        return input;
      } else if (Math.random() < profile.blockChance) {
        input.guardDir = incomingParryable.attackDir;
        mem.pendingGuard = incomingParryable.attackDir;
        mem.reactionTimerMs = profile.reactionMs;
      }
    }
  } else if (threat) {
    const distToThreat = Math.hypot(threat.x - bot.x, threat.y - bot.y);
    if (distToThreat < 240 && mem.reactionTimerMs <= 0) {
      const threatAttacking =
        threat.actionState === 'windup_light' || threat.actionState === 'windup_heavy';
      if (threatAttacking && Math.random() < profile.blockChance) {
        mem.pendingGuard = threat.attackDir;
        mem.reactionTimerMs = profile.reactionMs;
      }
    }
  }

  input.guardDir = mem.pendingGuard;

  // Smart Feint: If bot started a heavy windup and opponent matched its guard, feint on Veteran/Warlord!
  if (
    bot.actionState === 'windup_heavy' &&
    threat &&
    threat.guardDir === bot.attackDir &&
    mem.feintCooldownMs <= 0 &&
    bot.stateTimerMs > bot.stateDurationMs * 0.3 &&
    bot.stateTimerMs < bot.stateDurationMs * 0.58 &&
    Math.random() < profile.feintChance
  ) {
    input.feintPressed = true;
    mem.feintCooldownMs = 1500;
    mem.pendingGuard = randomGuardExcept(threat.guardDir);
    input.guardDir = mem.pendingGuard;
    return input;
  }

  // 3. STRATEGIC OBJECTIVE & TARGET SELECTION
  const goal = chooseStrategicGoal(bot, threat, ctx);

  // 4. PLATFORM NAVIGATION & LADDER PATHFINDING
  if (goal.kind === 'move' || (goal.kind === 'fight' && goal.dist > hero.attackRange * 0.85)) {
    const nav = navigateToward(bot, goal.x, goal.y, ctx.arena);
    input.moveX = nav.moveX;
    input.upHeld = nav.upHeld;
    input.jumpPressed = nav.jumpPressed;
    input.downHeld = nav.downHeld;
    input.dashPressed = nav.dashPressed;
  }

  // 5. DUEL / SIEGE COMBAT EXECUTION
  if (goal.kind === 'gate' && ctx.gate && !ctx.gate.breached) {
    const dx = ctx.gate.x + ctx.gate.width / 2 - bot.x;
    const dy = Math.abs(ctx.gate.y + ctx.gate.height - (bot.y + bot.height));
    if (Math.abs(dx) < hero.attackRange + 55 && dy < 120) {
      input.moveX = 0;
      if (mem.attackCooldownMs <= 0 && bot.stamina > 28) {
        input.heavyPressed = true;
        mem.attackCooldownMs = profile.attackCadenceMs;
      }
    } else {
      const nav = navigateToward(bot, ctx.gate.x - 30, ctx.gate.y + ctx.gate.height - 80, ctx.arena);
      input.moveX = nav.moveX;
      input.upHeld = nav.upHeld;
      input.jumpPressed = nav.jumpPressed;
      input.downHeld = nav.downHeld;
    }
    return input;
  }

  if (threat) {
    const dx = threat.x - bot.x;
    const dy = threat.y - bot.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Retreat / recover stamina if exhausted or very low stamina
    if (bot.oosExhausted || bot.stamina < 18) {
      input.moveX = dx > 0 ? -1 : 1;
      if (absDx < 95 && bot.stamina >= 16 && !bot.oosExhausted) {
        input.dashPressed = true;
      }
      return input;
    }

    // In melee duel range!
    if (absDx <= hero.attackRange + 10 && absDy <= 85) {
      // Face target by nudging slightly if needed
      if (Math.sign(dx) !== 0 && Math.sign(dx) !== bot.facing) {
        input.moveX = dx > 0 ? 1 : -1;
      } else if (absDx < 58) {
        // Micro spacing
        input.moveX = dx > 0 ? -1 : 1;
      } else if (Math.random() < 0.15) {
        input.moveX = mem.strafeDir;
      }

      if (mem.attackCooldownMs <= 0 && bot.actionState === 'idle') {
        // Stance Mix-up: switch to unguarded direction before swinging!
        const nextDir: GuardDirection =
          Math.random() < profile.mixupChance
            ? randomGuardExcept(threat.guardDir)
            : bot.guardDir;
        input.guardDir = nextDir;
        mem.pendingGuard = nextDir;

        // Punish staggered/parry-stunned enemy with Heavy!
        if (threat.actionState === 'parry_stun' || threat.actionState === 'hitstun') {
          input.heavyPressed = true;
        } else if (Math.random() < 0.34 && bot.stamina >= 32) {
          input.heavyPressed = true;
        } else {
          input.lightPressed = true;
        }
        mem.attackCooldownMs = profile.attackCadenceMs + Math.random() * 180;
      }
    }
  }

  return input;
}

function findNearestThreat(
  bot: FighterEntity,
  fighters: FighterEntity[]
): FighterEntity | null {
  let best: FighterEntity | null = null;
  let bestScore = Infinity;

  for (const other of fighters) {
    if (!other.alive || other.team === bot.team) continue;
    const dist = Math.hypot(other.x - bot.x, (other.y - bot.y) * 1.4);
    // Prioritize wounded enemies slightly
    const hpBonus = (other.hp / other.maxHp) * 140;
    const score = dist + hpBonus;
    if (score < bestScore) {
      bestScore = score;
      best = other;
    }
  }
  return best;
}

function chooseStrategicGoal(
  bot: FighterEntity,
  nearestEnemy: FighterEntity | null,
  ctx: BotContext
): { kind: 'fight' | 'move' | 'gate'; x: number; y: number; dist: number } {
  const enemyDist = nearestEnemy
    ? Math.hypot(nearestEnemy.x - bot.x, nearestEnemy.y - bot.y)
    : Infinity;

  // DOMINION STRATEGY
  if (ctx.mode === 'dominion' && ctx.zones.length > 0) {
    // If an enemy is right next to bot or contesting same zone, fight!
    if (nearestEnemy && enemyDist < 230) {
      return { kind: 'fight', x: nearestEnemy.x, y: nearestEnemy.y, dist: enemyDist };
    }

    let bestZone: ZoneRuntimeState | null = null;
    let bestUtility = -Infinity;

    for (const z of ctx.zones) {
      const zx = z.x + z.width / 2;
      const zy = z.y + z.height - 70;
      const dist = Math.hypot(zx - bot.x, zy - bot.y);
      const alliesInZone = ctx.fighters.filter(
        (f) =>
          f.alive &&
          f.id !== bot.id &&
          f.team === bot.team &&
          f.x >= z.x &&
          f.x <= z.x + z.width &&
          Math.abs(f.y - zy) < 130
      ).length;

      let utility = 0;
      if (z.owner !== bot.team) {
        utility += 320; // Unowned / enemy zone high priority!
      } else if (z.contested) {
        utility += 280; // Defend contested zone!
      } else {
        utility += 70; // Boost owned zone if nobody else is boosting
      }

      utility -= alliesInZone * 130;
      utility -= dist * 0.14;

      if (utility > bestUtility) {
        bestUtility = utility;
        bestZone = z;
      }
    }

    if (bestZone) {
      const zx = bestZone.x + bestZone.width / 2;
      const zy = bestZone.y + bestZone.height - 60;
      return {
        kind: 'move',
        x: zx,
        y: zy,
        dist: Math.hypot(zx - bot.x, zy - bot.y),
      };
    }
  }

  // STRONGHOLD DEFENSE STRATEGY
  if (ctx.mode === 'stronghold' && ctx.gate) {
    if (bot.team === 'iron') {
      // Attackers: if nearby defender threatens, engage; else push rampart or hit gate!
      if (nearestEnemy && enemyDist < 210) {
        return { kind: 'fight', x: nearestEnemy.x, y: nearestEnemy.y, dist: enemyDist };
      }

      // Check uncaptured rampart zones near path
      const unownedZone = ctx.zones.find((z) => z.owner !== 'iron');
      if (unownedZone && Math.random() < 0.7) {
        const zx = unownedZone.x + unownedZone.width / 2;
        const zy = unownedZone.y + unownedZone.height - 60;
        if (Math.hypot(zx - bot.x, zy - bot.y) < 750) {
          return { kind: 'move', x: zx, y: zy, dist: Math.hypot(zx - bot.x, zy - bot.y) };
        }
      }

      return {
        kind: 'gate',
        x: ctx.gate.x - 20,
        y: ctx.gate.y + ctx.gate.height - 60,
        dist: Math.abs(ctx.gate.x - bot.x),
      };
    } else {
      // Defenders: intercept nearest attacker or defend gate/ramparts
      if (nearestEnemy && enemyDist < 420) {
        return { kind: 'fight', x: nearestEnemy.x, y: nearestEnemy.y, dist: enemyDist };
      }
      const gateDefX = ctx.gate.x - 160;
      const gateDefY = ctx.gate.y + ctx.gate.height - 60;
      return {
        kind: 'move',
        x: gateDefX,
        y: gateDefY,
        dist: Math.hypot(gateDefX - bot.x, gateDefY - bot.y),
      };
    }
  }

  // ARENA DUEL / BRAWL / SKIRMISH
  if (nearestEnemy) {
    return {
      kind: 'fight',
      x: nearestEnemy.x,
      y: nearestEnemy.y,
      dist: enemyDist,
    };
  }

  return { kind: 'move', x: ctx.arena.worldWidth / 2, y: ctx.arena.groundY - 60, dist: 0 };
}

function navigateToward(
  bot: FighterEntity,
  targetX: number,
  targetY: number,
  arena: ArenaDefinition
): { moveX: number; upHeld: boolean; jumpPressed: boolean; downHeld: boolean; dashPressed: boolean } {
  const dx = targetX - bot.x;
  const dy = targetY - bot.y;
  let moveX = Math.abs(dx) > 22 ? (dx > 0 ? 1 : -1) : 0;
  let upHeld = false;
  let jumpPressed = false;
  let downHeld = false;
  let dashPressed = false;

  // Stuck detection: if trying to walk horizontally but x didn't change, jump!
  if (bot.aiMemory) {
    if (moveX !== 0 && Math.abs(bot.x - bot.aiMemory.lastX) < 1.2 && !bot.onLadder) {
      bot.aiMemory.stuckTimerMs += 16;
      if (bot.aiMemory.stuckTimerMs > 240) {
        jumpPressed = true;
        bot.aiMemory.stuckTimerMs = 0;
      }
    } else {
      bot.aiMemory.stuckTimerMs = 0;
    }
    bot.aiMemory.lastX = bot.x;
  }

  // Need to go UP (target is higher) -> climb nearest accessible ladder!
  if (dy < -85 || bot.onLadder) {
    const ladder = findBestLadder(bot, targetX, targetY, arena.ladders);
    if (ladder) {
      const ladCenter = ladder.x + ladder.width / 2;
      const onX = Math.abs(ladCenter - bot.x) <= ladder.width * 0.6;
      if (!onX) {
        moveX = ladCenter > bot.x ? 1 : -1;
      } else {
        moveX = 0;
        upHeld = true;
      }
    } else if (dy < -85 && (bot.grounded || (bot.jumpsLeft > 0 && bot.vy > -40))) {
      jumpPressed = true;
    }
  }

  // Need to go DOWN through a one-way platform
  if (dy > 85 && bot.grounded) {
    const standingPlat = arena.platforms.find(
      (p) =>
        p.oneWay &&
        bot.x >= p.x &&
        bot.x <= p.x + p.width &&
        Math.abs(bot.y + bot.height - p.y) < 16
    );
    if (standingPlat) {
      downHeld = true;
    }
  }

  // Gap / void edge safety check: if walking toward a pit with no floor ahead, jump across!
  if (bot.grounded && moveX !== 0) {
    const probeX = bot.x + moveX * 52;
    const probeY = bot.y + bot.height + 24;
    const hasSupport = arena.platforms.some(
      (p) => probeX >= p.x - 12 && probeX <= p.x + p.width + 12 && probeY >= p.y && probeY <= p.y + 80
    );
    if (!hasSupport) {
      jumpPressed = true;
      if (Math.abs(dx) > 180 && bot.stamina > 30) {
        dashPressed = true;
      }
    }
  }

  return { moveX, upHeld, jumpPressed, downHeld, dashPressed };
}

function findBestLadder(
  bot: FighterEntity,
  targetX: number,
  targetY: number,
  ladders: LadderDef[]
): LadderDef | null {
  let best: LadderDef | null = null;
  let bestScore = Infinity;
  const feetY = bot.y + bot.height;

  for (const lad of ladders) {
    const ladBottom = lad.y + lad.height;
    // Bot must be able to reach the ladder vertically
    if (feetY > ladBottom + 36 || feetY < lad.y - 10) continue;
    const ladCx = lad.x + lad.width / 2;
    const distFromBot = Math.abs(ladCx - bot.x);
    if (distFromBot > 480) continue;
    const distToGoal = Math.hypot(ladCx - targetX, lad.y - targetY);
    const score = distFromBot * 0.9 + distToGoal * 0.55;
    if (score < bestScore) {
      bestScore = score;
      best = lad;
    }
  }
  return best;
}
