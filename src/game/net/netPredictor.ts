import { ARENAS } from '../arenas/arenas.ts';
import { HEROES } from '../heroes.ts';
import type {
  ActionState,
  ArenaDefinition,
  FighterEntity,
  PlayerInputState,
  WorldSnapshot,
} from '../types.ts';

const GRAVITY = 2450;
const COYOTE_TIME_MS = 105;
const INTERP_WINDOW_MS = 24;

interface UnackedInputEntry {
  seq: number;
  dtMs: number;
  input: PlayerInputState;
}

interface RemotePose {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function cloneFighter(f: FighterEntity): FighterEntity {
  return { ...f };
}

function stepLocalFighterLocally(
  f: FighterEntity,
  input: PlayerInputState,
  arena: ArenaDefinition,
  snapshot: WorldSnapshot,
  dtMs: number,
  coyoteState: { coyoteMs: number; usedGroundJump: boolean }
): void {
  if (!f.alive || snapshot.phase !== 'active') return;

  const hero = HEROES[f.heroId];
  const clampedDt = Math.min(50, Math.max(1, dtMs));
  const dtSec = clampedDt / 1000;

  if (f.dropThroughTimer > 0) f.dropThroughTimer = Math.max(0, f.dropThroughTimer - clampedDt);

  if (f.grounded) {
    coyoteState.coyoteMs = COYOTE_TIME_MS;
    coyoteState.usedGroundJump = false;
  } else if (coyoteState.coyoteMs > 0) {
    coyoteState.coyoteMs = Math.max(0, coyoteState.coyoteMs - clampedDt);
  }

  // Immediate guard switch
  if (
    f.actionState === 'idle' ||
    f.actionState === 'recovery' ||
    f.actionState === 'blockstun' ||
    f.actionState === 'dash'
  ) {
    f.guardDir = input.guardDir;
  }

  // Immediate lock-on facing
  if (input.lockedTargetId) {
    const locked = snapshot.fighters.find(
      (t) => t.id === input.lockedTargetId && t.alive && t.team !== f.team
    );
    if (
      locked &&
      (f.actionState === 'idle' ||
        f.actionState === 'recovery' ||
        f.actionState === 'blockstun' ||
        f.actionState === 'windup_light' ||
        f.actionState === 'windup_heavy')
    ) {
      f.facing = locked.x >= f.x ? 1 : -1;
    }
  }

  // Optimistic local attack windup / dash / feint start so 0ms visual latency!
  const canStart = f.actionState === 'idle' || f.actionState === 'recovery';
  if (
    input.feintPressed &&
    f.actionState === 'windup_heavy' &&
    f.stateTimerMs < f.stateDurationMs * 0.65
  ) {
    f.actionState = 'idle';
    f.stateTimerMs = 0;
    f.stateDurationMs = 0;
  } else if (canStart) {
    if (input.dashPressed && f.stamina >= 16 && !f.oosExhausted) {
      f.actionState = 'dash';
      f.stateTimerMs = 0;
      f.stateDurationMs = 210;
      const dashDir = input.moveX !== 0 ? (input.moveX > 0 ? 1 : -1) : f.facing;
      f.vx = dashDir * 680;
      f.vy = Math.min(f.vy, -40);
    } else if (
      (input.counterPressed || input.lightPressed || input.heavyPressed) &&
      f.counterReadyTimerMs > 0
    ) {
      f.actionState = 'active_counter';
      f.stateTimerMs = 0;
      f.stateDurationMs = 190;
      f.attackDir = f.guardDir;
      f.vx = f.facing * 420;
    } else if (input.lightPressed && f.stamina >= 6) {
      f.actionState = 'windup_light';
      f.stateTimerMs = 0;
      f.stateDurationMs = Math.round(hero.lightWindupMs * (f.oosExhausted ? 1.45 : 1));
      f.attackDir = f.guardDir;
    } else if (input.heavyPressed && f.stamina >= 10) {
      f.actionState = 'windup_heavy';
      f.stateTimerMs = 0;
      f.stateDurationMs = Math.round(hero.heavyWindupMs * (f.oosExhausted ? 1.45 : 1));
      f.attackDir = f.guardDir;
    }
  }

  // Advance local timer visually
  if (f.actionState !== 'idle') {
    f.stateTimerMs += clampedDt;
    if (f.stateTimerMs >= f.stateDurationMs) {
      if (f.actionState === 'windup_light') {
        f.actionState = 'active_light';
        f.stateTimerMs = 0;
        f.stateDurationMs = hero.lightActiveMs;
      } else if (f.actionState === 'windup_heavy') {
        f.actionState = 'active_heavy';
        f.stateTimerMs = 0;
        f.stateDurationMs = hero.heavyActiveMs;
      } else if (
        f.actionState === 'active_light' ||
        f.actionState === 'active_heavy' ||
        f.actionState === 'active_counter'
      ) {
        f.actionState = 'recovery';
        f.stateTimerMs = 0;
        f.stateDurationMs = hero.recoveryMs;
      } else if (f.actionState === 'dash' || f.actionState === 'recovery') {
        f.actionState = 'idle';
        f.stateTimerMs = 0;
        f.stateDurationMs = 0;
      }
    }
  }

  // Horizontal movement
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
    const reversing =
      input.moveX !== 0 && f.vx !== 0 && Math.sign(f.vx) !== Math.sign(input.moveX);
    const accelRate = f.grounded ? (reversing ? 38 : 28) : reversing ? 24 : 18;
    f.vx += (targetVx - f.vx) * Math.min(1, dtSec * accelRate);
    if (Math.abs(targetVx - f.vx) < 2) f.vx = targetVx;

    if (input.moveX !== 0 && f.actionState === 'idle' && !input.lockedTargetId) {
      f.facing = input.moveX > 0 ? 1 : -1;
    }
  } else if (f.actionState !== 'dash') {
    f.vx *= Math.pow(0.06, dtSec);
  }

  const overlappingLadder = arena.ladders.find((l) => {
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
    coyoteState.coyoteMs = COYOTE_TIME_MS;
    coyoteState.usedGroundJump = false;

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
    if (input.downHeld && f.grounded) {
      f.dropThroughTimer = 220;
      f.grounded = false;
      coyoteState.coyoteMs = 0;
    }

    const canCoyoteGroundJump =
      (f.grounded || coyoteState.coyoteMs > 0) && !coyoteState.usedGroundJump;
    if (
      input.jumpPressed &&
      (canCoyoteGroundJump || f.jumpsLeft > 0) &&
      f.actionState !== 'hitstun' &&
      f.actionState !== 'parry_stun'
    ) {
      if (canCoyoteGroundJump) {
        f.vy = hero.jumpVelocity;
        f.jumpsLeft = 1;
        coyoteState.usedGroundJump = true;
      } else {
        f.vy = hero.doubleJumpVelocity;
        f.jumpsLeft = Math.max(0, f.jumpsLeft - 1);
      }
      f.grounded = false;
      f.onLadder = false;
      coyoteState.coyoteMs = 0;
    }

    f.vy += GRAVITY * dtSec;
    f.vy = Math.min(f.vy, 1180);
  }

  const prevBottom = f.y + f.height;
  f.x += f.vx * dtSec;
  f.y += f.vy * dtSec;

  if (f.onLadder && overlappingLadder && wantsClimbUp && f.y + f.height <= overlappingLadder.y + 4) {
    f.y = overlappingLadder.y - f.height;
    f.vy = 0;
    f.grounded = true;
    f.onLadder = false;
    f.jumpsLeft = 2;
    coyoteState.usedGroundJump = false;
  }

  f.x = Math.max(40, Math.min(arena.worldWidth - 40, f.x));

  if (snapshot.gate && !snapshot.gate.breached && f.team === 'iron') {
    const gate = snapshot.gate;
    if (
      f.x + f.width / 2 > gate.x &&
      f.x - f.width / 2 < gate.x + gate.width &&
      f.y + f.height > gate.y + 10
    ) {
      f.x = gate.x - f.width / 2;
      if (f.vx > 0) f.vx = 0;
    }
  }

  if (!(f.onLadder && overlappingLadder && wantsClimbUp && f.grounded)) {
    f.grounded = false;
    const newBottom = f.y + f.height;
    if (f.vy >= 0) {
      for (const plat of arena.platforms) {
        if (plat.oneWay && (f.dropThroughTimer > 0 || f.onLadder)) continue;
        const withinX =
          f.x + f.width * 0.35 > plat.x && f.x - f.width * 0.35 < plat.x + plat.width;
        if (withinX && prevBottom <= plat.y + 14 && newBottom >= plat.y) {
          f.y = plat.y - f.height;
          f.vy = 0;
          f.grounded = true;
          f.onLadder = false;
          f.jumpsLeft = 2;
          coyoteState.usedGroundJump = false;
          break;
        }
      }
    }
  }

  // Sync optimistic animation state so sprite switches immediately!
  let desiredAnim: FighterEntity['animName'] = 'idle';
  if (f.actionState === 'hitstun' || f.actionState === 'parry_stun') {
    desiredAnim = f.actionState === 'parry_stun' ? 'parryFlash' : 'takeHit';
  } else if (f.actionState === 'windup_light' || f.actionState === 'active_light') {
    desiredAnim = 'attackLight';
  } else if (
    f.actionState === 'windup_heavy' ||
    f.actionState === 'active_heavy' ||
    f.actionState === 'active_counter'
  ) {
    desiredAnim = 'attackHeavy';
  } else if (f.onLadder) {
    desiredAnim = Math.abs(f.vy) > 10 ? 'run' : 'idle';
  } else if (!f.grounded) {
    desiredAnim = f.vy < 0 ? 'jump' : 'fall';
  } else if (Math.abs(f.vx) > 25) {
    desiredAnim = 'run';
  }

  if (f.animName !== desiredAnim) {
    f.animName = desiredAnim;
    f.animFrame = 0;
    f.animTick = 0;
  }
}

export class NetPredictor {
  private localPlayerId: string;
  private latestServerSnap: WorldSnapshot | null = null;
  private predictedLocal: FighterEntity | null = null;
  private coyoteState = { coyoteMs: 0, usedGroundJump: false };
  private unackedInputs: UnackedInputEntry[] = [];
  private errX = 0;
  private errY = 0;

  private prevRemote = new Map<string, RemotePose>();
  private targetRemote = new Map<string, RemotePose>();
  private interpElapsedMs = 0;

  constructor(localPlayerId: string) {
    this.localPlayerId = localPlayerId;
  }

  reset(localPlayerId: string): void {
    this.localPlayerId = localPlayerId;
    this.latestServerSnap = null;
    this.predictedLocal = null;
    this.unackedInputs = [];
    this.errX = 0;
    this.errY = 0;
    this.prevRemote.clear();
    this.targetRemote.clear();
    this.interpElapsedMs = 0;
  }

  onServerSnapshot(serverSnap: WorldSnapshot): void {
    const prevLatest = this.latestServerSnap;
    this.latestServerSnap = serverSnap;

    // Store interpolation endpoints for remote fighters
    if (prevLatest) {
      for (const prevF of prevLatest.fighters) {
        if (prevF.id === this.localPlayerId) continue;
        const currTarget = this.targetRemote.get(prevF.id);
        const alpha = Math.min(1, this.interpElapsedMs / INTERP_WINDOW_MS);
        const prevFrom = this.prevRemote.get(prevF.id);
        if (prevFrom && currTarget) {
          this.prevRemote.set(prevF.id, {
            x: prevFrom.x + (currTarget.x - prevFrom.x) * alpha,
            y: prevFrom.y + (currTarget.y - prevFrom.y) * alpha,
            vx: currTarget.vx,
            vy: currTarget.vy,
          });
        } else {
          this.prevRemote.set(prevF.id, {
            x: prevF.x,
            y: prevF.y,
            vx: prevF.vx,
            vy: prevF.vy,
          });
        }
      }
    }

    for (const f of serverSnap.fighters) {
      if (f.id === this.localPlayerId) continue;
      if (!this.prevRemote.has(f.id)) {
        this.prevRemote.set(f.id, { x: f.x, y: f.y, vx: f.vx, vy: f.vy });
      }
      this.targetRemote.set(f.id, { x: f.x, y: f.y, vx: f.vx, vy: f.vy });
    }
    this.interpElapsedMs = 0;

    // Reconcile local fighter
    const authLocal = serverSnap.fighters.find((f) => f.id === this.localPlayerId);
    if (!authLocal) {
      this.predictedLocal = null;
      return;
    }

    const ackSeq = serverSnap.ackSeqs?.[this.localPlayerId] ?? 0;
    if (ackSeq > 0) {
      this.unackedInputs = this.unackedInputs.filter((entry) => entry.seq > ackSeq);
    }

    const prevPred = this.predictedLocal;
    const reconciled = cloneFighter(authLocal);

    // If knocked into stun or dead or round countdown, trust server state immediately
    const authoritativeLockStates: ActionState[] = ['hitstun', 'parry_stun', 'dead'];
    if (
      serverSnap.phase === 'active' &&
      reconciled.alive &&
      !authoritativeLockStates.includes(reconciled.actionState)
    ) {
      const arena = ARENAS[serverSnap.arenaId] || ARENAS.shattered_bridge;
      const replayCoyote = { ...this.coyoteState };
      for (const entry of this.unackedInputs) {
        stepLocalFighterLocally(
          reconciled,
          entry.input,
          arena,
          serverSnap,
          entry.dtMs,
          replayCoyote
        );
      }
      this.coyoteState = replayCoyote;
    } else {
      this.unackedInputs = [];
    }

    if (prevPred && prevPred.alive && reconciled.alive) {
      const dx = prevPred.x - reconciled.x;
      const dy = prevPred.y - reconciled.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2 && dist < 140) {
        this.errX = dx;
        this.errY = dy;
      } else {
        this.errX = 0;
        this.errY = 0;
      }
    } else {
      this.errX = 0;
      this.errY = 0;
    }

    this.predictedLocal = reconciled;
  }

  predictLocalStep(dtMs: number, input: PlayerInputState): void {
    const snap = this.latestServerSnap;
    if (!snap) return;

    if (!this.predictedLocal) {
      const auth = snap.fighters.find((f) => f.id === this.localPlayerId);
      if (!auth) return;
      this.predictedLocal = cloneFighter(auth);
    }

    const clampedDt = Math.min(50, Math.max(1, dtMs));
    this.unackedInputs.push({
      seq: input.seq,
      dtMs: clampedDt,
      input: { ...input },
    });
    if (this.unackedInputs.length > 60) {
      this.unackedInputs.shift();
    }

    const arena = ARENAS[snap.arenaId] || ARENAS.shattered_bridge;
    stepLocalFighterLocally(
      this.predictedLocal,
      input,
      arena,
      snap,
      clampedDt,
      this.coyoteState
    );
  }

  buildRenderSnapshot(dtMs: number): WorldSnapshot | null {
    const snap = this.latestServerSnap;
    if (!snap) return null;

    this.interpElapsedMs += dtMs;
    const rawAlpha = this.interpElapsedMs / INTERP_WINDOW_MS;
    const alpha = Math.min(1, rawAlpha);
    const extraSec = rawAlpha > 1 ? Math.min(0.016, (this.interpElapsedMs - INTERP_WINDOW_MS) / 1000) : 0;

    // Decay reconciliation blend error smoothly
    const errDecay = Math.exp(-dtMs * 0.024);
    this.errX *= errDecay;
    this.errY *= errDecay;
    if (Math.abs(this.errX) < 0.25) this.errX = 0;
    if (Math.abs(this.errY) < 0.25) this.errY = 0;

    const fighters = snap.fighters.map((f) => {
      if (f.id === this.localPlayerId && this.predictedLocal) {
        return {
          ...this.predictedLocal,
          x: this.predictedLocal.x + this.errX,
          y: this.predictedLocal.y + this.errY,
        };
      }

      const prev = this.prevRemote.get(f.id);
      const target = this.targetRemote.get(f.id);
      if (prev && target && Math.hypot(target.x - prev.x, target.y - prev.y) < 220) {
        return {
          ...f,
          x: prev.x + (target.x - prev.x) * alpha + target.vx * extraSec,
          y: prev.y + (target.y - prev.y) * alpha + target.vy * extraSec,
        };
      }
      return f;
    });

    return {
      ...snap,
      fighters,
    };
  }
}
