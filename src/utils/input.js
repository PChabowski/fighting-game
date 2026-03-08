export function handleGamepadInput(player, enemy, keys, { jump, restartGame, allowRestart, isMultiplayer, localFighter } = {}) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const roundOver = typeof allowRestart === 'function' ? allowRestart() : false;
    
    // Helper to process gamepad input avoiding keyboard conflicts
    const processGamepad = (gp, fighter, keyLeft, keyRight) => {
        if (!gp || fighter.dead) return;

        if (!roundOver) {
            const xAxis = gp.axes[0] || 0;
            const dpadLeft = gp.buttons[14] && gp.buttons[14].pressed;
            const dpadRight = gp.buttons[15] && gp.buttons[15].pressed;

            let isMoving = false;

            if (xAxis < -0.2 || dpadLeft) {
                keys[keyLeft].pressed = true;
                fighter.lastKey = keyLeft;
                isMoving = true;
            } else if (xAxis > 0.2 || dpadRight) {
                keys[keyRight].pressed = true;
                fighter.lastKey = keyRight;
                isMoving = true;
            }

            // Only clear keys if the gamepad was actually moving in the previous frame
            // This prevents gamepad idle state from constantly overriding keyboard inputs
            if (!isMoving) {
                if (fighter.gpMoved) {
                    keys[keyLeft].pressed = false;
                    keys[keyRight].pressed = false;
                    fighter.gpMoved = false;
                }
            } else {
                fighter.gpMoved = true;
            }

            // Jump
            if ((gp.buttons[0] && gp.buttons[0].pressed) || (gp.buttons[12] && gp.buttons[12].pressed)) {
                jump(fighter);
            }

            // Attack
            if ((gp.buttons[2] && gp.buttons[2].pressed) || (gp.buttons[1] && gp.buttons[1].pressed)) {
                fighter.attack();
            } else {
                fighter.canAttack = true; // Zastępuje keyup
            }

        } else {
            if (fighter.gpMoved) {
                keys[keyLeft].pressed = false;
                keys[keyRight].pressed = false;
                fighter.gpMoved = false;
            }
            if (!(gp.buttons[2] && gp.buttons[2].pressed) && !(gp.buttons[1] && gp.buttons[1].pressed)) {
                fighter.canAttack = true; // Ensure attack is ready for next round
            }
        }

        // Restart
        if (gp.buttons[9] && gp.buttons[9].pressed) {
            const allowed = typeof allowRestart === 'function' ? allowRestart() : true;
            if (allowed && typeof restartGame === 'function') restartGame(player, enemy);
        }
    };

    if (isMultiplayer) {
        // Online Multiplayer Mode: Only Gamepad 0 controls the localFighter using 'a' and 'd' mapped keys
        if (gamepads[0] && localFighter) {
            processGamepad(gamepads[0], localFighter, 'a', 'd');
        }
    } else {
        // Local PvP / Arcade Mode: Gamepad 0 controls player, Gamepad 1 controls enemy
        if (gamepads[0]) {
            processGamepad(gamepads[0], player, 'a', 'd');
        }
        if (gamepads[1]) {
            processGamepad(gamepads[1], enemy, 'ArrowLeft', 'ArrowRight');
        }
    }
}

// Start a lightweight gamepad menu poller that dispatches custom events
// 'gp-up', 'gp-down', 'gp-left', 'gp-right', 'gp-confirm', 'gp-back'
export function initGamepadMenu() {
    const lastByIndex = {};

    const threshold = 0.5;
    const moveDelay = 180; // ms between directional repeats

    function dispatch(name, index) {
        try { document.dispatchEvent(new CustomEvent(name, { detail: { index } })); } catch (e) {}
    }

    function loop() {
        const gps = navigator.getGamepads ? navigator.getGamepads() : [];
        const now = performance.now();
        for (let i = 0; i < gps.length; i++) {
            const gp = gps[i];
            if (!gp) continue;
            let last = lastByIndex[i];
            if (!last) last = { lastMove: 0, btn0: false, btn1: false };

            const dpadUp = gp.buttons[12] && gp.buttons[12].pressed;
            const dpadDown = gp.buttons[13] && gp.buttons[13].pressed;
            const dpadLeft = gp.buttons[14] && gp.buttons[14].pressed;
            const dpadRight = gp.buttons[15] && gp.buttons[15].pressed;
            const xAxis = (gp.axes && gp.axes[0]) || 0;
            const yAxis = (gp.axes && gp.axes[1]) || 0;

            if ((dpadUp || yAxis < -threshold) && now - last.lastMove > moveDelay) {
                dispatch('gp-up', i); last.lastMove = now;
            } else if ((dpadDown || yAxis > threshold) && now - last.lastMove > moveDelay) {
                dispatch('gp-down', i); last.lastMove = now;
            }

            if ((dpadLeft || xAxis < -threshold) && now - last.lastMove > moveDelay) {
                dispatch('gp-left', i); last.lastMove = now;
            } else if ((dpadRight || xAxis > threshold) && now - last.lastMove > moveDelay) {
                dispatch('gp-right', i); last.lastMove = now;
            }

            // confirm (A / button0)
            if (gp.buttons[0] && gp.buttons[0].pressed) {
                if (!last.btn0) dispatch('gp-confirm', i);
                last.btn0 = true;
            } else last.btn0 = false;

            // back (B / button1)
            if (gp.buttons[1] && gp.buttons[1].pressed) {
                if (!last.btn1) dispatch('gp-back', i);
                last.btn1 = true;
            } else last.btn1 = false;

            lastByIndex[i] = last;
        }
        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
}
