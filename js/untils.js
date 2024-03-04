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
        document.querySelector('#whoWin').innerHTML = 'Tie';
    } else if (player.health > enemy.health) {
        document.querySelector('#whoWin').innerHTML = 'Player 1 Wins';
    } else if (player.health < enemy.health) {
        document.querySelector('#whoWin').innerHTML = 'Player 2 Wins';
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