export let timer = 60;
let stopTimer;

export function whoWins(player, enemy) {
    // Compute result string and stop the timer. UI should be handled by a component.
    clearTimeout(stopTimer);
    if (player.health === enemy.health) return 'Tie';
    if (player.health > enemy.health) return 'Player 1 Wins';
    return 'Player 2 Wins';
}

export function decrementTimer(onEnd, onTick) {
    if (timer > 0) {
        stopTimer = setTimeout(() => decrementTimer(onEnd, onTick), 1000);
        timer--;
        if (typeof onTick === 'function') onTick(timer);
    }
    if (timer === 0 && typeof onEnd === 'function') {
        onEnd();
    }
}

export function jump(player) {
    if (player.velocity.y === 0) {
        player.velocity.y = -15;
    }
}

export function restartGame(player, enemy, onTick, onEnd) {
    timer = 60;
    decrementTimer(onEnd || (() => {}), onTick);
    
    if (typeof player.restart === 'function') player.restart({ x: 200, y: 330 });
    if (typeof enemy.restart === 'function') enemy.restart({ x: 700, y: 330 });

}
