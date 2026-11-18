import { FighterEntity, GuardDirection } from '../types';

export function cycleLockTarget(
  localFighter: Pick<FighterEntity, 'id' | 'team' | 'x' | 'y'>,
  fighters: Array<Pick<FighterEntity, 'id' | 'team' | 'x' | 'y' | 'alive'>>,
  currentTargetId: string | null
): string | null {
  const enemies = fighters
    .filter((f) => f.alive && f.team !== localFighter.team)
    .sort(
      (a, b) =>
        Math.hypot(a.x - localFighter.x, a.y - localFighter.y) -
        Math.hypot(b.x - localFighter.x, b.y - localFighter.y)
    );

  if (enemies.length === 0) return null;

  if (!currentTargetId) {
    return enemies[0].id;
  }

  const idx = enemies.findIndex((e) => e.id === currentTargetId);
  if (idx === -1) {
    return enemies[0].id;
  }

  return enemies[(idx + 1) % enemies.length].id;
}

export function toggleFocusTarget(
  localFighter: Pick<FighterEntity, 'id' | 'team' | 'x' | 'y'>,
  fighters: Array<Pick<FighterEntity, 'id' | 'team' | 'x' | 'y' | 'alive'>>,
  currentTargetId: string | null
): string | null {
  if (resolveValidLockTarget(localFighter, fighters, currentTargetId)) return null;
  return cycleLockTarget(localFighter, fighters, null);
}

export function resolveValidLockTarget(
  localFighter: Pick<FighterEntity, 'team'> | undefined,
  fighters: Array<Pick<FighterEntity, 'id' | 'team' | 'alive'>>,
  currentTargetId: string | null
): string | null {
  if (!localFighter || !currentTargetId) return null;
  const stillAlive = fighters.some(
    (f) => f.id === currentTargetId && f.alive && f.team !== localFighter.team
  );
  return stillAlive ? currentTargetId : null;
}

export function clampVirtualCursor(
  x: number,
  y: number,
  maxRadius = 28
): { x: number; y: number } {
  const dist = Math.hypot(x, y);
  if (dist <= maxRadius || dist === 0) return { x, y };
  const scale = maxRadius / dist;
  return { x: x * scale, y: y * scale };
}

export function resolveGuardFromVector(
  dx: number,
  dy: number,
  deadzone = 10
): GuardDirection | null {
  if (Math.hypot(dx, dy) < deadzone) return null;
  if (dy < -deadzone * 0.7 && Math.abs(dy) >= Math.abs(dx) * 0.72) {
    return 'top';
  }
  return dx < 0 ? 'left' : 'right';
}
