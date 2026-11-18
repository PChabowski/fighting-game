import { resolveGuardFromVector } from '../combat/targeting.ts';
import type { GuardDirection } from '../types.ts';

export interface GamepadButtonLike {
  pressed: boolean;
  value?: number;
}

export interface GamepadLike {
  id: string;
  connected: boolean;
  axes: readonly number[];
  buttons: readonly GamepadButtonLike[];
}

export interface GamepadPollResult {
  connected: boolean;
  gamepadName: string;
  hasActivity: boolean;
  moveX: number;
  upHeld: boolean;
  downHeld: boolean;
  guardDir: GuardDirection | null;
  jumpPressed: boolean;
  dashPressed: boolean;
  lightPressed: boolean;
  heavyPressed: boolean;
  parryPressed: boolean;
  feintPressed: boolean;
  counterPressed: boolean;
  lockTogglePressed: boolean;
  lockClearPressed: boolean;
  menuTogglePressed: boolean;
  nextButtons: boolean[];
}

// Standard Xbox / W3C Gamepad API indices:
// Buttons: 0:A, 1:B, 2:X, 3:Y, 4:LB, 5:RB, 6:LT, 7:RT, 8:View/Back, 9:Menu/Start,
// 10:LS, 11:RS, 12:DPadUp, 13:DPadDown, 14:DPadLeft, 15:DPadRight
// Axes: 0:LS_X, 1:LS_Y, 2:RS_X, 3:RS_Y
export function pollXboxGamepad(
  pad: GamepadLike | null | undefined,
  prevButtons: boolean[]
): GamepadPollResult {
  if (!pad || !pad.connected) {
    return {
      connected: false,
      gamepadName: '',
      hasActivity: false,
      moveX: 0,
      upHeld: false,
      downHeld: false,
      guardDir: null,
      jumpPressed: false,
      dashPressed: false,
      lightPressed: false,
      heavyPressed: false,
      parryPressed: false,
      feintPressed: false,
      counterPressed: false,
      lockTogglePressed: false,
      lockClearPressed: false,
      menuTogglePressed: false,
      nextButtons: [],
    };
  }

  const buttons = pad.buttons || [];
  const axes = pad.axes || [];

  const isDown = (idx: number, threshold = 0.4): boolean => {
    const b = buttons[idx];
    if (!b) return false;
    return Boolean(b.pressed || (typeof b.value === 'number' && b.value > threshold));
  };

  const nextButtons: boolean[] = [];
  for (let i = 0; i < Math.max(16, buttons.length); i++) {
    nextButtons[i] = isDown(i, i === 6 || i === 7 ? 0.35 : 0.45);
  }

  const justPressed = (idx: number): boolean => Boolean(nextButtons[idx] && !prevButtons[idx]);

  const lsX = axes[0] ?? 0;
  const lsY = axes[1] ?? 0;
  const rsX = axes[2] ?? 0;
  const rsY = axes[3] ?? 0;

  let moveX = 0;
  if (nextButtons[14] || lsX < -0.24) moveX -= 1;
  if (nextButtons[15] || lsX > 0.24) moveX += 1;

  const downHeld = Boolean(nextButtons[13] || lsY > 0.56);

  // Jump & Ladder Climb: A (0), DPad Up (12), or LS Up
  const lsUpActive = lsY < -0.6;
  const upHeld = Boolean(nextButtons[12] || lsUpActive);
  const prevLsUpActive = Boolean(prevButtons[16]);
  nextButtons[16] = lsUpActive;
  const jumpPressed =
    justPressed(0) || justPressed(12) || (lsUpActive && !prevLsUpActive);

  // Right Stick controls 3-Way Art of Battle Guard (Top / Left / Right)
  const guardDir = resolveGuardFromVector(rsX, rsY, 0.28);

  // Combat buttons tuned to For Honor Xbox layout:
  // RB (5) or X (2) -> Light Attack
  // RT (7) -> Heavy Attack / Parry
  // Y (3) -> Dedicated Parry / Counter Riposte
  // B (1) -> Dodge / Dash (also Feint if pressed mid-heavy windup)
  // LB (4) or RS Click (11) -> Focus / Switch Enemy (Alt)
  // View (8) -> Clear Focus
  // Start (9) -> Toggle Settings Modal
  const lightPressed = justPressed(5) || justPressed(2);
  const heavyPressed = justPressed(7);
  const parryPressed = justPressed(3);
  const counterPressed = justPressed(3);
  const dashPressed = justPressed(1);
  const feintPressed = justPressed(1);
  const lockTogglePressed = justPressed(4) || justPressed(11);
  const lockClearPressed = justPressed(8);
  const menuTogglePressed = justPressed(9);

  const hasActivity =
    moveX !== 0 ||
    downHeld ||
    guardDir !== null ||
    jumpPressed ||
    lightPressed ||
    heavyPressed ||
    parryPressed ||
    dashPressed ||
    lockTogglePressed ||
    lockClearPressed ||
    menuTogglePressed;

  return {
    connected: true,
    gamepadName: pad.id || 'Xbox Controller',
    hasActivity,
    moveX,
    upHeld,
    downHeld,
    guardDir,
    jumpPressed,
    dashPressed,
    lightPressed,
    heavyPressed,
    parryPressed,
    feintPressed,
    counterPressed,
    lockTogglePressed,
    lockClearPressed,
    menuTogglePressed,
    nextButtons,
  };
}

export function findActiveGamepad(): Gamepad | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return null;
  }
  const pads = navigator.getGamepads();
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    if (p && p.connected) return p;
  }
  return null;
}

export function triggerGamepadRumble(
  intensity = 0.45,
  durationMs = 95
): void {
  const pad = findActiveGamepad() as
    | (Gamepad & {
        vibrationActuator?: {
          playEffect?: (
            type: string,
            params: {
              startDelay: number;
              duration: number;
              weakMagnitude: number;
              strongMagnitude: number;
            }
          ) => Promise<void>;
        };
      })
    | null;
  if (!pad?.vibrationActuator?.playEffect) return;
  try {
    pad.vibrationActuator
      .playEffect('dual-rumble', {
        startDelay: 0,
        duration: durationMs,
        weakMagnitude: Math.min(1, intensity),
        strongMagnitude: Math.min(1, intensity * 0.75),
      })
      .catch(() => {});
  } catch {
    // ignore unsupported vibration API
  }
}
