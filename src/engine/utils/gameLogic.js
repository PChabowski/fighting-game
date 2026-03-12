import { START_POSITIONS } from './constants.js';

export let timer = 60;
let timerId = null;

export function whoWins(player, enemy) {
    if (timerId) { clearTimeout(timerId); timerId = null; }
    if (player.health === enemy.health) return 'Tie';
    if (player.health > enemy.health) return 'Player 1 Wins';
    return 'Player 2 Wins';
}

export function determineWinner({ player, enemy, timerId: existingTimerId, winModal }) {
    if (existingTimerId) clearTimeout(existingTimerId);
    if (timerId) {
        clearTimeout(timerId);
        timerId = null;
    }
    
    let message = 'Tie';
    if (player.health === enemy.health) {
        message = 'Tie';
    } else if (player.health > enemy.health) {
        message = 'Player 1 Wins';
    } else if (player.health < enemy.health) {
        message = 'Player 2 Wins';
    }

    if (winModal) {
        winModal.show(message);
    }
    return message;
}

export function decrementTimer(onEnd, onTick) {
    if (timer > 0) {
        if (timerId) { clearTimeout(timerId); timerId = null; }
        timerId = setTimeout(() => {
            timer--;
            if (typeof onTick === 'function') onTick(timer);
            decrementTimer(onEnd, onTick);
        }, 1000);
    } else if (timer === 0 && typeof onEnd === 'function') {
        onEnd();
    }
}

export function jump(player) {
    if (player.velocity.y === 0) {
        player.velocity.y = -15;
    }
}

export function restartGame(player, enemy, onTick, onEnd) {
    if (timerId) { clearTimeout(timerId); timerId = null; }
    timer = 60;
    
    if (typeof onTick === 'function') onTick(timer);
    
    decrementTimer(onEnd || (() => {}), onTick);

    if (player && typeof player.restart === 'function') player.restart(START_POSITIONS.player);
    if (enemy && typeof enemy.restart === 'function') enemy.restart(START_POSITIONS.enemy);
}
