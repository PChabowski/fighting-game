export function handleGamepadInput(player, enemy, keys, { jump, restartGame, allowRestart } = {}) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const roundOver = typeof allowRestart === 'function' ? allowRestart() : false;
    
    // Obsługa Gracza 1 (Gamepad 0)
    if (gamepads[0] && !player.dead) {
        const gp = gamepads[0];
        // Allow only restart/confirm when round is over
        if (!roundOver) {
            // Lewy drążek lub D-pad (Ruch)
            const xAxis = gp.axes[0]; // -1 lewo, 1 prawo
            const dpadLeft = gp.buttons[14].pressed;
            const dpadRight = gp.buttons[15].pressed;

            if (xAxis < -0.2 || dpadLeft) {
                keys.a.pressed = true;
                player.lastKey = 'a';
            } else if (xAxis > 0.2 || dpadRight) {
                keys.d.pressed = true;
                player.lastKey = 'd';
            } else {
                keys.a.pressed = false;
                keys.d.pressed = false;
            }

            // Przycisk A lub D-pad góra (Skok)
            if (gp.buttons[0].pressed || gp.buttons[12].pressed) {
                jump(player);
            }

            // Przycisk X lub B (Atak)
            if (gp.buttons[2].pressed || gp.buttons[1].pressed) {
                player.attack();
            } else {
                player.canAttack = true; // Resetowanie możliwości ataku (zastępuje keyup)
            }
        } else {
            // when round is over, ensure movement flags are cleared
            keys.a.pressed = false;
            keys.d.pressed = false;
        }

        // Przycisk Start (Restart gry - tylko kiedy dozwolone)
        if (gp.buttons[9].pressed) {
            const allowed = typeof allowRestart === 'function' ? allowRestart() : true;
            if (allowed && typeof restartGame === 'function') restartGame(player, enemy);
        }
    }

    // Obsługa Gracza 2 (Gamepad 1)
    if (gamepads[1] && !enemy.dead) {
        const gp = gamepads[1];
        if (!roundOver) {
            const xAxis = gp.axes[0];
            const dpadLeft = gp.buttons[14].pressed;
            const dpadRight = gp.buttons[15].pressed;

            if (xAxis < -0.2 || dpadLeft) {
                keys.ArrowLeft.pressed = true;
                enemy.lastKey = 'ArrowLeft';
            } else if (xAxis > 0.2 || dpadRight) {
                keys.ArrowRight.pressed = true;
                enemy.lastKey = 'ArrowRight';
            } else {
                keys.ArrowLeft.pressed = false;
                keys.ArrowRight.pressed = false;
            }

            if (gp.buttons[0].pressed || gp.buttons[12].pressed) {
                jump(enemy);
            }

            if (gp.buttons[2].pressed || gp.buttons[1].pressed) {
                enemy.attack();
            } else {
                enemy.canAttack = true;
            }
        } else {
            keys.ArrowLeft.pressed = false;
            keys.ArrowRight.pressed = false;
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
