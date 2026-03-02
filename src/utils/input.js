export function handleGamepadInput(player, enemy, keys, { jump, restartGame }) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    // Obsługa Gracza 1 (Gamepad 0)
    if (gamepads[0] && !player.dead) {
        const gp = gamepads[0];
        
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

        // Przycisk Start (Restart gry - opcjonalnie)
        if (gp.buttons[9].pressed) {
            if (typeof restartGame === 'function') restartGame(player, enemy);
        }
    }

    // Obsługa Gracza 2 (Gamepad 1)
    if (gamepads[1] && !enemy.dead) {
        const gp = gamepads[1];
        
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
    }
}
