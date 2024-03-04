function rectangularCollision({ rectangle1, rectangle2 }) {
    return (
        rectangle1.attackBox.position.x + rectangle1.attackBox.width >= rectangle2.position.x &&
        rectangle1.attackBox.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.attackBox.position.y + rectangle1.attackBox.height >= rectangle2.position.y &&
        rectangle1.attackBox.position.y <= rectangle2.position.y + rectangle2.height
    )
}

function whoWins() {
    clearTimeout(stopTimer);
    document.querySelector('#whoWin').style.display = 'flex';
    if (player.health === enemy.health) {
        document.querySelector('#whoWin').innerHTML = '<div>Tie</div><div class id="restart">Restart</div>';
    } else if (player.health > enemy.health) {
        document.querySelector('#whoWin').innerHTML = '<div>Player 1 Wins</div><div class id="restart">Restart</div>';
    } else if (player.health < enemy.health) {
        document.querySelector('#whoWin').innerHTML = '<div>Player 2 Wins</div><div class id="restart">Restart</div>';
    }
}

let timer = 60;
let stopTimer;
function decrementTimer() {
    if (timer > 0) {
        stopTimer = setTimeout(decrementTimer, 1000);
        timer--
        document.querySelector('#timer').innerHTML = timer;
    }
    
    if (timer === 0) {
        whoWins();
    }
}

function jump(player) {
    if (player.velocity.y === 0) {
        player.velocity.y = -15;
    }
}