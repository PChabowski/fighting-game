import { HEROES } from '../heroes.ts';
import type {
  FighterEntity,
  FloatingCallout,
  GateRuntimeState,
  GuardDirection,
  ParticleFX,
  PlayerInputState,
} from '../types.ts';
import { soundEngine } from '../audio/soundEngine.ts';

export interface CombatContext {
  fighters: FighterEntity[];
  gate: GateRuntimeState | null;
  particles: ParticleFX[];
  callouts: FloatingCallout[];
  nextFxId: () => number;
  addScreenShake: (amount: number) => void;
  triggerHitStop: (ms: number) => void;
  onKill: (killer: FighterEntity, victim: FighterEntity) => void;
  onGateHit: (attacker: FighterEntity, damage: number) => void;
}

const LIGHT_STAMINA_COST = 12;
const HEAVY_STAMINA_COST = 24;
const DASH_STAMINA_COST = 16;
const BLOCK_STAMINA_COST = 10;
const PARRY_STAMINA_DRAIN = 36;
const PARRY_WINDOW_MS = 235;

export function startAttackOrAction(
  fighter: FighterEntity,
  input: PlayerInputState,
  ctx: CombatContext
): void {
  if (!fighter.alive) return;

  const hero = HEROES[fighter.heroId];
  const canStartAction =
    fighter.actionState === 'idle' || fighter.actionState === 'recovery';

  // Feint: cancel heavy windup early into idle + guard switch
  if (
    input.feintPressed &&
    fighter.actionState === 'windup_heavy' &&
    fighter.stateTimerMs < fighter.stateDurationMs * 0.65
  ) {
    fighter.actionState = 'idle';
    fighter.stateTimerMs = 0;
    fighter.stateDurationMs = 0;
    fighter.parryWindowOpen = false;
    fighter.feintedRecently = true;
    fighter.stamina = Math.max(0, fighter.stamina - 6);
    spawnCallout(ctx, fighter.x, fighter.y - 35, 'ZMYŁKA', 'FEINT', '#94A3B8');
    return;
  }

  // Dedicated Parry input (or Heavy press while enemy attack is flashing in parry window)
  if ((input.parryPressed || input.heavyPressed) && fighter.actionState === 'idle') {
    const incomingThreat = findIncomingParryableAttack(fighter, ctx.fighters);
    if (incomingThreat && fighter.guardDir === incomingThreat.attackDir) {
      executeParry(fighter, incomingThreat, ctx);
      return;
    }
  }

  // Counter-Attack / Riposte (available after Parry!)
  if (
    (input.counterPressed || input.lightPressed || input.heavyPressed) &&
    fighter.counterReadyTimerMs > 0 &&
    canStartAction
  ) {
    fighter.counterReadyTimerMs = 0;
    fighter.actionState = 'active_counter';
    fighter.stateTimerMs = 0;
    fighter.stateDurationMs = 190;
    fighter.attackDir = fighter.guardDir;
    fighter.attackHitApplied = false;
    fighter.vx = fighter.facing * 420;
    soundEngine.playSwing(true);
    spawnCallout(ctx, fighter.x, fighter.y - 45, 'KONTRA!', 'COUNTER!', '#F59E0B');
    return;
  }

  // Dash / Dodge
  if (
    input.dashPressed &&
    canStartAction &&
    fighter.stamina >= DASH_STAMINA_COST &&
    !fighter.oosExhausted
  ) {
    fighter.stamina -= DASH_STAMINA_COST;
    fighter.actionState = 'dash';
    fighter.stateTimerMs = 0;
    fighter.stateDurationMs = 210;
    fighter.invulnTimerMs = 180;
    const dashDir = input.moveX !== 0 ? (input.moveX > 0 ? 1 : -1) : fighter.facing;
    fighter.vx = dashDir * 680;
    fighter.vy = Math.min(fighter.vy, -40);
    spawnBurst(ctx, fighter.x, fighter.y + fighter.height * 0.7, '#94A3B8', 6, 'dust');
    return;
  }

  if (!canStartAction) return;

  // Light Attack
  if (input.lightPressed && fighter.stamina >= 6) {
    const speedMult = fighter.oosExhausted ? 1.45 : 1;
    fighter.stamina = Math.max(0, fighter.stamina - LIGHT_STAMINA_COST);
    if (fighter.stamina === 0) fighter.oosExhausted = true;
    fighter.actionState = 'windup_light';
    fighter.stateTimerMs = 0;
    fighter.stateDurationMs = Math.round(hero.lightWindupMs * speedMult);
    fighter.attackDir = fighter.guardDir;
    fighter.attackHitApplied = false;
    fighter.feintedRecently = false;
    soundEngine.playReadyCue(false);
    return;
  }

  // Heavy Attack
  if (input.heavyPressed && fighter.stamina >= 10) {
    const speedMult = fighter.oosExhausted ? 1.45 : 1;
    fighter.stamina = Math.max(0, fighter.stamina - HEAVY_STAMINA_COST);
    if (fighter.stamina === 0) fighter.oosExhausted = true;
    fighter.actionState = 'windup_heavy';
    fighter.stateTimerMs = 0;
    fighter.stateDurationMs = Math.round(hero.heavyWindupMs * speedMult);
    fighter.attackDir = fighter.guardDir;
    fighter.attackHitApplied = false;
    fighter.feintedRecently = false;
    soundEngine.playReadyCue(true);
  }
}

export function findIncomingParryableAttack(
  defender: FighterEntity,
  fighters: FighterEntity[]
): FighterEntity | null {
  for (const other of fighters) {
    if (!other.alive || other.team === defender.team) continue;
    const isWindup =
      other.actionState === 'windup_light' || other.actionState === 'windup_heavy';
    if (!isWindup && other.actionState !== 'active_light' && other.actionState !== 'active_heavy') {
      continue;
    }

    const hero = HEROES[other.heroId];
    const dx = defender.x - other.x;
    const dy = Math.abs(defender.y - other.y);
    if (Math.abs(dx) > hero.attackRange + 32 || dy > hero.attackHeight + 30) continue;

    // Must be facing toward defender
    if (dx * other.facing < -20) continue;

    if (other.parryWindowOpen) {
      return other;
    }
  }
  return null;
}

export function executeParry(
  defender: FighterEntity,
  attacker: FighterEntity,
  ctx: CombatContext
): void {
  attacker.actionState = 'parry_stun';
  attacker.stateTimerMs = 0;
  attacker.stateDurationMs = 780;
  attacker.parryWindowOpen = false;
  attacker.vx = -attacker.facing * 240;
  attacker.stamina = Math.max(0, attacker.stamina - PARRY_STAMINA_DRAIN);
  if (attacker.stamina === 0) attacker.oosExhausted = true;

  defender.counterReadyTimerMs = 1050;
  defender.parries += 1;
  defender.stamina = Math.min(defender.maxStamina, defender.stamina + 18);
  defender.revengeCharge = Math.min(100, defender.revengeCharge + 24);

  soundEngine.playParry();
  ctx.triggerHitStop(85);
  ctx.addScreenShake(9);
  spawnRing(ctx, (defender.x + attacker.x) / 2, defender.y + 42, '#F59E0B', 58);
  spawnBurst(ctx, (defender.x + attacker.x) / 2, defender.y + 42, '#FBBF24', 14, 'spark');
  spawnCallout(ctx, defender.x, defender.y - 45, 'PAROWANIE!', 'PARRY!', '#F59E0B');
}

export function updateCombatTimers(
  fighter: FighterEntity,
  dtMs: number,
  ctx: CombatContext
): void {
  if (!fighter.alive) {
    if (fighter.respawnTimerMs > 0) {
      fighter.respawnTimerMs = Math.max(0, fighter.respawnTimerMs - dtMs);
    }
    return;
  }

  const hero = HEROES[fighter.heroId];

  if (fighter.invulnTimerMs > 0) {
    fighter.invulnTimerMs = Math.max(0, fighter.invulnTimerMs - dtMs);
  }
  if (fighter.counterReadyTimerMs > 0) {
    fighter.counterReadyTimerMs = Math.max(0, fighter.counterReadyTimerMs - dtMs);
  }
  if (fighter.revengeTimer > 0) {
    fighter.revengeTimer = Math.max(0, fighter.revengeTimer - dtMs);
    if (fighter.revengeTimer === 0) {
      fighter.revengeShield = 0;
    }
  }

  // Passive stamina regeneration when idle/moving
  if (fighter.actionState === 'idle') {
    const regenRate = fighter.oosExhausted ? 20 : 32;
    fighter.stamina = Math.min(
      fighter.maxStamina,
      fighter.stamina + (regenRate * dtMs) / 1000
    );
    if (fighter.oosExhausted && fighter.stamina >= fighter.maxStamina * 0.45) {
      fighter.oosExhausted = false;
    }
  }

  if (fighter.actionState === 'idle') {
    fighter.parryWindowOpen = false;
    return;
  }

  fighter.stateTimerMs += dtMs;

  // Update parry flash window during attack windups
  if (
    fighter.actionState === 'windup_light' ||
    fighter.actionState === 'windup_heavy'
  ) {
    const remaining = fighter.stateDurationMs - fighter.stateTimerMs;
    fighter.parryWindowOpen = remaining <= PARRY_WINDOW_MS && remaining >= 0;
  } else {
    fighter.parryWindowOpen = false;
  }

  // Resolve active hit frames
  if (
    (fighter.actionState === 'active_light' ||
      fighter.actionState === 'active_heavy' ||
      fighter.actionState === 'active_counter') &&
    !fighter.attackHitApplied
  ) {
    applyAttackHitbox(fighter, ctx);
    fighter.attackHitApplied = true;
  }

  if (fighter.stateTimerMs >= fighter.stateDurationMs) {
    fighter.stateTimerMs = 0;
    if (fighter.actionState === 'windup_light') {
      fighter.actionState = 'active_light';
      fighter.stateDurationMs = hero.lightActiveMs;
      fighter.attackHitApplied = false;
      fighter.vx = fighter.facing * 170;
      soundEngine.playSwing(false);
    } else if (fighter.actionState === 'windup_heavy') {
      fighter.actionState = 'active_heavy';
      fighter.stateDurationMs = hero.heavyActiveMs;
      fighter.attackHitApplied = false;
      fighter.vx = fighter.facing * 230;
      soundEngine.playSwing(true);
    } else if (
      fighter.actionState === 'active_light' ||
      fighter.actionState === 'active_heavy' ||
      fighter.actionState === 'active_counter'
    ) {
      const wasCounter = fighter.actionState === 'active_counter';
      fighter.actionState = 'recovery';
      fighter.stateDurationMs = wasCounter ? 140 : hero.recoveryMs;
    } else {
      fighter.actionState = 'idle';
      fighter.stateDurationMs = 0;
    }
  }
}

function applyAttackHitbox(attacker: FighterEntity, ctx: CombatContext): void {
  const hero = HEROES[attacker.heroId];
  const isHeavy = attacker.actionState === 'active_heavy';
  const isCounter = attacker.actionState === 'active_counter';

  const reach = hero.attackRange + (isCounter ? 28 : isHeavy ? 14 : 0);
  const boxX =
    attacker.facing === 1 ? attacker.x + 12 : attacker.x - reach - 12;
  const boxY = attacker.y + 8;
  const boxW = reach;
  const boxH = hero.attackHeight;

  // Check Fortress Gate damage in Stronghold mode
  if (ctx.gate && !ctx.gate.breached && attacker.team === 'iron') {
    const gx = ctx.gate.x;
    const gy = ctx.gate.y;
    if (
      boxX < gx + ctx.gate.width &&
      boxX + boxW > gx &&
      boxY < gy + ctx.gate.height &&
      boxY + boxH > gy
    ) {
      const gateDmg = isCounter ? hero.counterDamage : isHeavy ? hero.heavyDamage * 1.4 : hero.lightDamage;
      ctx.onGateHit(attacker, Math.round(gateDmg));
      spawnBurst(ctx, gx + 12, attacker.y + 40, '#F59E0B', 10, 'spark');
    }
  }

  for (const target of ctx.fighters) {
    if (!target.alive || target.team === attacker.team) continue;
    if (target.invulnTimerMs > 0) continue;

    const tx = target.x - target.width / 2;
    const ty = target.y;
    const overlaps =
      boxX < tx + target.width &&
      boxX + boxW > tx &&
      boxY < ty + target.height &&
      boxY + boxH > ty;

    if (!overlaps) continue;

    // Auto-orient target's visual guard check: directional block works when defender faces attacker OR matches guard
    const canBlock =
      target.actionState === 'idle' ||
      target.actionState === 'blockstun' ||
      target.actionState === 'recovery';

    const guardMatches = target.guardDir === attacker.attackDir;

    // Counter attacks are UNBLOCKABLE!
    if (!isCounter && canBlock && guardMatches && !target.oosExhausted) {
      const chip = isHeavy ? 5 : 2;
      target.stamina = Math.max(0, target.stamina - BLOCK_STAMINA_COST);
      if (target.stamina === 0) target.oosExhausted = true;
      target.hp = Math.max(1, target.hp - chip);
      target.actionState = 'blockstun';
      target.stateTimerMs = 0;
      target.stateDurationMs = isHeavy ? 210 : 130;
      target.vx = attacker.facing * (isHeavy ? 220 : 130);
      target.revengeCharge = Math.min(100, target.revengeCharge + 14);

      // Check Revenge Fury trigger when outnumbered
      maybeTriggerRevenge(target, ctx);

      soundEngine.playBlock();
      ctx.addScreenShake(3);
      spawnBurst(ctx, (attacker.x + target.x) / 2, target.y + 42, '#93C5FD', 8, 'spark');
      spawnCallout(ctx, target.x, target.y - 32, 'BLOK', 'BLOCK', '#60A5FA');
      continue;
    }

    // Direct Hit!
    const rawDamage = isCounter
      ? hero.counterDamage
      : isHeavy
      ? hero.heavyDamage
      : hero.lightDamage;
    const furyMult = attacker.revengeTimer > 0 ? 1.25 : 1;
    const finalDamage = Math.round(rawDamage * furyMult);

    applyDamage(attacker, target, finalDamage, isHeavy || isCounter, isCounter, ctx);
  }
}

function maybeTriggerRevenge(target: FighterEntity, ctx: CombatContext): void {
  if (target.revengeCharge < 100 || target.revengeTimer > 0) return;
  const nearbyEnemies = ctx.fighters.filter(
    (f) => f.alive && f.team !== target.team && Math.hypot(f.x - target.x, f.y - target.y) < 260
  ).length;
  if (nearbyEnemies < 2) return;

  target.revengeCharge = 0;
  target.revengeShield = 50;
  target.revengeTimer = 6000;
  target.stamina = target.maxStamina;
  target.oosExhausted = false;
  spawnRing(ctx, target.x, target.y + 50, '#F97316', 75);
  spawnCallout(ctx, target.x, target.y - 54, 'ZEMSTA!', 'REVENGE!', '#FB923C');
}

function applyDamage(
  attacker: FighterEntity,
  target: FighterEntity,
  damage: number,
  heavy: boolean,
  isCounter: boolean,
  ctx: CombatContext
): void {
  let remaining = damage;
  if (target.revengeShield > 0) {
    const absorbed = Math.min(target.revengeShield, remaining);
    target.revengeShield -= absorbed;
    remaining -= absorbed;
  }

  target.hp = Math.max(0, target.hp - remaining);
  attacker.damageDealt += damage;
  if (isCounter) attacker.counters += 1;
  target.revengeCharge = Math.min(100, target.revengeCharge + 10);

  if (target.hp <= 0) {
    target.alive = false;
    target.actionState = 'dead';
    target.stateTimerMs = 0;
    target.stateDurationMs = 900;
    target.vx = attacker.facing * 240;
    target.vy = -210;
    target.grounded = false;
    target.animName = 'death';
    target.animFrame = 0;
    target.animTick = 0;
    ctx.triggerHitStop(isCounter ? 95 : 65);
    ctx.addScreenShake(10);
    soundEngine.playCounterHit();
    spawnBurst(ctx, target.x, target.y + 45, '#EF4444', 18, 'spark');
    ctx.onKill(attacker, target);
    return;
  }

  // Hyper-armor during revenge doesn't get interrupted
  if (target.revengeTimer <= 0) {
    target.actionState = 'hitstun';
    target.stateTimerMs = 0;
    target.stateDurationMs = heavy ? 320 : 210;
    target.vx = attacker.facing * (heavy ? 280 : 165);
    target.vy = heavy ? -160 : -70;
  }

  if (isCounter) {
    soundEngine.playCounterHit();
    ctx.triggerHitStop(70);
    ctx.addScreenShake(8);
  } else {
    soundEngine.playHit(heavy);
    if (heavy) {
      ctx.triggerHitStop(45);
      ctx.addScreenShake(6);
    }
  }

  spawnBurst(
    ctx,
    target.x,
    target.y + 48,
    isCounter ? '#F59E0B' : '#EF4444',
    heavy ? 12 : 7,
    'spark'
  );
  spawnCallout(
    ctx,
    target.x,
    target.y - 26,
    `-${damage}`,
    `-${damage}`,
    isCounter ? '#F59E0B' : '#F87171'
  );
}

export function spawnBurst(
  ctx: CombatContext,
  x: number,
  y: number,
  color: string,
  count: number,
  kind: ParticleFX['kind']
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 260;
    ctx.particles.push({
      id: ctx.nextFxId(),
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      size: 3 + Math.random() * 4,
      color,
      alpha: 1,
      lifeMs: 0,
      maxLifeMs: 280 + Math.random() * 200,
      kind,
    });
  }
}

export function spawnRing(
  ctx: CombatContext,
  x: number,
  y: number,
  color: string,
  maxRadius: number
): void {
  ctx.particles.push({
    id: ctx.nextFxId(),
    x,
    y,
    vx: 0,
    vy: 0,
    size: maxRadius,
    color,
    alpha: 1,
    lifeMs: 0,
    maxLifeMs: 320,
    kind: 'ring',
  });
}

export function spawnCallout(
  ctx: CombatContext,
  x: number,
  y: number,
  textPl: string,
  textEn: string,
  color: string
): void {
  ctx.callouts.push({
    id: ctx.nextFxId(),
    x,
    y,
    textPl,
    textEn,
    color,
    lifeMs: 0,
    maxLifeMs: 850,
  });
}

export function randomGuardExcept(exclude: GuardDirection): GuardDirection {
  const dirs: GuardDirection[] = ['top', 'left', 'right'];
  const filtered = dirs.filter((d) => d !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
}
