import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampVirtualCursor,
  cycleLockTarget,
  resolveGuardFromVector,
  resolveValidLockTarget,
  toggleFocusTarget,
} from './targeting';

test('cycleLockTarget focuses nearest alive enemy and cycles through enemies', () => {
  const local = { id: 'p1', team: 'iron' as const, x: 500, y: 500 };
  const fighters = [
    { id: 'p1', team: 'iron' as const, x: 500, y: 500, alive: true },
    { id: 'ally1', team: 'iron' as const, x: 520, y: 500, alive: true },
    { id: 'e_far', team: 'crimson' as const, x: 900, y: 500, alive: true },
    { id: 'e_dead', team: 'crimson' as const, x: 510, y: 500, alive: false },
    { id: 'e_near', team: 'crimson' as const, x: 600, y: 500, alive: true },
  ];

  // First Tab press selects nearest alive enemy (ignores ally & dead enemy)
  const first = cycleLockTarget(local, fighters, null);
  assert.equal(first, 'e_near');

  // Second Tab press switches to next alive enemy
  const second = cycleLockTarget(local, fighters, first);
  assert.equal(second, 'e_far');

  // Third Tab press wraps back to nearest enemy
  const third = cycleLockTarget(local, fighters, second);
  assert.equal(third, 'e_near');
});

test('cycleLockTarget keeps the only alive enemy selected', () => {
  const local = { id: 'p1', team: 'iron' as const, x: 500, y: 500 };
  const fighters = [
    { id: 'p1', team: 'iron' as const, x: 500, y: 500, alive: true },
    { id: 'e1', team: 'crimson' as const, x: 650, y: 500, alive: true },
  ];

  assert.equal(cycleLockTarget(local, fighters, 'e1'), 'e1');
});

test('toggleFocusTarget selects nearest enemy and toggles a valid target off', () => {
  const local = { id: 'p1', team: 'iron' as const, x: 500, y: 500 };
  const fighters = [
    { id: 'p1', team: 'iron' as const, x: 500, y: 500, alive: true },
    { id: 'e_far', team: 'crimson' as const, x: 900, y: 500, alive: true },
    { id: 'e_near', team: 'crimson' as const, x: 600, y: 500, alive: true },
  ];

  assert.equal(toggleFocusTarget(local, fighters, null), 'e_near');
  assert.equal(toggleFocusTarget(local, fighters, 'e_near'), null);
});

test('toggleFocusTarget replaces an invalid target with nearest living enemy', () => {
  const local = { id: 'p1', team: 'iron' as const, x: 500, y: 500 };
  const fighters = [
    { id: 'p1', team: 'iron' as const, x: 500, y: 500, alive: true },
    { id: 'e_dead', team: 'crimson' as const, x: 510, y: 500, alive: false },
    { id: 'e_live', team: 'crimson' as const, x: 650, y: 500, alive: true },
  ];

  assert.equal(toggleFocusTarget(local, fighters, 'e_dead'), 'e_live');
});

test('resolveValidLockTarget clears target when focused enemy dies', () => {
  const local = { team: 'iron' as const };
  const fighters = [
    { id: 'e1', team: 'crimson' as const, alive: false },
    { id: 'e2', team: 'crimson' as const, alive: true },
  ];

  assert.equal(resolveValidLockTarget(local, fighters, 'e1'), null);
  assert.equal(resolveValidLockTarget(local, fighters, 'e2'), 'e2');
});

test('clampVirtualCursor keeps virtual mouse guard centered within radius', () => {
  const clamped = clampVirtualCursor(200, 0, 28);
  assert.ok(Math.hypot(clamped.x, clamped.y) <= 28.001);
  assert.equal(Math.round(clamped.x), 28);

  const inside = clampVirtualCursor(10, -12, 28);
  assert.deepEqual(inside, { x: 10, y: -12 });
});

test('resolveGuardFromVector maps centered mouse deltas to top/left/right', () => {
  assert.equal(resolveGuardFromVector(0, 0, 10), null);
  assert.equal(resolveGuardFromVector(0, -20, 10), 'top');
  assert.equal(resolveGuardFromVector(-18, 4, 10), 'left');
  assert.equal(resolveGuardFromVector(18, 4, 10), 'right');
});
