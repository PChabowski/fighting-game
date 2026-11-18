import test from 'node:test';
import assert from 'node:assert/strict';
import { pollXboxGamepad, type GamepadLike } from './gamepadDriver.ts';

function makePad(overrides: Partial<GamepadLike> = {}): GamepadLike {
  return {
    id: 'Xbox Wireless Controller (STANDARD GAMEPAD)',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    ...overrides,
  };
}

test('pollXboxGamepad handles deadzone and maps Right Stick to 3-way guard', () => {
  // Neutral sticks inside deadzone -> moveX = 0, guardDir = null
  const neutral = pollXboxGamepad(makePad({ axes: [0.1, -0.05, 0.1, 0.05] }), []);
  assert.equal(neutral.connected, true);
  assert.equal(neutral.moveX, 0);
  assert.equal(neutral.guardDir, null);

  // Right Stick Up -> top guard
  const topGuard = pollXboxGamepad(makePad({ axes: [0.6, 0, 0, -0.85] }), []);
  assert.equal(topGuard.moveX, 1);
  assert.equal(topGuard.guardDir, 'top');

  // Right Stick Left -> left guard
  const leftGuard = pollXboxGamepad(makePad({ axes: [-0.8, 0, -0.8, 0.1] }), []);
  assert.equal(leftGuard.moveX, -1);
  assert.equal(leftGuard.guardDir, 'left');

  // Right Stick Right -> right guard
  const rightGuard = pollXboxGamepad(makePad({ axes: [0, 0, 0.85, 0] }), []);
  assert.equal(rightGuard.guardDir, 'right');
});

test('pollXboxGamepad edge-triggers combat & lock buttons without repeat spam', () => {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  buttons[0] = { pressed: true, value: 1 }; // A -> Jump
  buttons[5] = { pressed: true, value: 1 }; // RB -> Light Attack
  buttons[4] = { pressed: true, value: 1 }; // LB -> Toggle focus (Alt)
  buttons[11] = { pressed: true, value: 1 }; // RS Click -> Cycle target (Tab)
  buttons[7] = { pressed: true, value: 0.9 }; // RT -> Heavy Attack

  const first = pollXboxGamepad(makePad({ buttons }), []);
  assert.equal(first.jumpPressed, true);
  assert.equal(first.lightPressed, true);
  assert.equal(first.heavyPressed, true);
  assert.equal(first.lockTogglePressed, true);
  assert.equal(first.lockCyclePressed, true);

  // Holding the same buttons next frame must NOT re-trigger edge pulses
  const held = pollXboxGamepad(makePad({ buttons }), first.nextButtons);
  assert.equal(held.jumpPressed, false);
  assert.equal(held.lightPressed, false);
  assert.equal(held.heavyPressed, false);
  assert.equal(held.lockTogglePressed, false);
  assert.equal(held.lockCyclePressed, false);

  // Y button -> Parry / Counter, B button -> Dodge / Feint
  const buttons2 = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  buttons2[3] = { pressed: true, value: 1 }; // Y
  buttons2[1] = { pressed: true, value: 1 }; // B
  const yAndB = pollXboxGamepad(makePad({ buttons: buttons2 }), held.nextButtons);
  assert.equal(yAndB.parryPressed, true);
  assert.equal(yAndB.counterPressed, true);
  assert.equal(yAndB.dashPressed, true);
  assert.equal(yAndB.feintPressed, true);
});
