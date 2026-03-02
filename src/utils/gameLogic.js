export let timer = 60;
let stopTimer;

export function whoWins(player, enemy) {
    clearTimeout(stopTimer);
    const whoWin = document.querySelector('#whoWin');
    const win = document.querySelector('#win');
    whoWin.style.display = 'flex';
    if (player.health === enemy.health) {
        win.innerHTML = 'Tie';
    } else if (player.health > enemy.health) {
        win.innerHTML = 'Player 1 Wins';
    } else if (player.health < enemy.health) {
        win.innerHTML = 'Player 2 Wins';
    }
}

export function decrementTimer(onEnd) {
    if (timer > 0) {
        stopTimer = setTimeout(() => decrementTimer(onEnd), 1000);
        timer--;
        document.querySelector('#timer').innerHTML = timer;
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

export function restartGame(player, enemy) {
    document.querySelector('#whoWin').style.display = 'none';
    timer = 60;
    decrementTimer(() => whoWins(player, enemy));
    
    if (typeof player.restart === 'function') player.restart({ x: 200, y: 330 });
    if (typeof enemy.restart === 'function') enemy.restart({ x: 700, y: 330 });

    document.querySelector('#playerHealth').style.width = '100%';
    document.querySelector('#enemyHealth').style.width = '100%';
}
