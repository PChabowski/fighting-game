const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");

canvas.width = 1024;
canvas.height = 576;

c.fillRect(0, 0, canvas.width, canvas.height);

const gravity = 0.7;

const background = new Sprite({
  position: {
    x: 0,
    y: 0,
  },
  imageSrc: "./img/background.png",
});

const shop = new Sprite({
  position: {
    x: 650,
    y: 160,
  },
  imageSrc: "./img/shop.png",
  scale: 2.5,
  frameMax: 6,
});

const player = new Fighter({
  position: {
    x: 200,
    y: 330,
  },
  velocity: {
    x: 0,
    y: 0,
  },
  imageSrc: "./img/Mack/Idle.png",
  scale: 2.5,
  frameMax: 8,
  offset: {
    x: 215,
    y: 155,
  },
  sprites: {
    idle: {
      imageSrc: "./img/Mack/Idle.png",
      frameMax: 8,
    },
    run: {
      imageSrc: "./img/Mack/Run.png",
      frameMax: 8,
    },
    jump: {
      imageSrc: "./img/Mack/Jump.png",
      frameMax: 2,
    },
    fall: {
      imageSrc: "./img/Mack/Fall.png",
      frameMax: 2,
    },
    attack: {
      imageSrc: "./img/Mack/Attack1.png",
      frameMax: 6,
    },
    takeHit: {
      imageSrc: "./img/Mack/Take Hit - white silhouette.png",
      frameMax: 4,
    },
    death: {
      imageSrc: "./img/Mack/Death.png",
      frameMax: 6,
    },
  },
  attackBox: {
    offset: {
      x: 100,
      y: 50,
    },
    width: 160,
    height: 50,
  },
});

const enemy = new Fighter({
  position: {
    x: 700,
    y: 330,
  },
  velocity: {
    x: 0,
    y: 0,
  },
  color: "yellow",
  imageSrc: "./img/Kenji/Idle.png",
  scale: 2.5,
  frameMax: 4,
  offset: {
    x: 215,
    y: 170,
  },
  sprites: {
    idle: {
      imageSrc: "./img/Kenji/Idle.png",
      frameMax: 4,
    },
    run: {
      imageSrc: "./img/Kenji/Run.png",
      frameMax: 8,
    },
    jump: {
      imageSrc: "./img/Kenji/Jump.png",
      frameMax: 2,
    },
    fall: {
      imageSrc: "./img/Kenji/Fall.png",
      frameMax: 2,
    },
    attack: {
      imageSrc: "./img/Kenji/Attack1.png",
      frameMax: 4,
    },
    takeHit: {
      imageSrc: "./img/Kenji/Take hit.png",
      frameMax: 3,
    },
    death: {
      imageSrc: "./img/Kenji/Death.png",
      frameMax: 7,
    },
  },
  attackBox: {
    offset: {
      x: 83,
      y: 50,
    },
    width: 160,
    height: 50,
  },
});

const keys = {
  a: {
    pressed: false,
  },
  d: {
    pressed: false,
  },
  w: {
    pressed: false,
  },
  d: {
    pressed: false,
  },
  ArrowRight: {
    pressed: false,
  },
  ArrowLeft: {
    pressed: false,
  },
  ArrowUp: {
    pressed: false,
  },
  ArrowDown: {
    pressed: false,
  },
};

decrementTimer();

function animate() {
  window.requestAnimationFrame(animate);
  c.fillStyle = "black";
  c.fillRect(0, 0, canvas.width, canvas.height);

  handleGamepadInput(player, enemy, keys);

  background.update();
  shop.update();
  c.fillStyle = "rgba(255, 255, 255, 0.15)";
  c.fillRect(0, 0, canvas.width, canvas.height);
  player.update();
  enemy.update();

  player.velocity.x = 0;
  enemy.velocity.x = 0;

  // Player movment
  if (keys.a.pressed && player.lastKey === "a") {
    player.velocity.x = -5;
    player.switchSprite("run");
  } else if (keys.d.pressed && player.lastKey === "d") {
    player.velocity.x = 5;
    player.switchSprite("run");
  } else {
    player.switchSprite("idle");
  }

  // Jump animation
  if (player.velocity.y < 0) {
    player.switchSprite("jump");
  } else if (player.velocity.y > 0) {
    player.switchSprite("fall");
  }

  // Enemy movment
  if (keys.ArrowLeft.pressed && enemy.lastKey === "ArrowLeft") {
    enemy.velocity.x = -5;
    enemy.switchSprite("run");
  } else if (keys.ArrowRight.pressed && enemy.lastKey === "ArrowRight") {
    enemy.velocity.x = 5;
    enemy.switchSprite("run");
  } else {
    enemy.switchSprite("idle");
  }

  // Jump animation
  if (enemy.velocity.y < 0) {
    enemy.switchSprite("jump");
  } else if (enemy.velocity.y > 0) {
    enemy.switchSprite("fall");
  }

  // Detect for colission
  if (
    rectangularCollision({
      rectangle1: player,
      rectangle2: enemy,
    }) &&
    player.isAttacking &&
    player.framesCurrent === 4
  ) {
    player.isAttacking = false;
    enemy.takeHit(5);
    document.querySelector("#enemyHealth").style.width = enemy.health + "%";

    gsap.to("#enemyHealth", {
      width: enemy.health + "%",
    });
  }

  // if player misses
  if (player.isAttacking && player.framesCurrent === 4) {
    player.isAttacking = false;
  }

  if (
    rectangularCollision({
      rectangle1: enemy,
      rectangle2: player,
    }) &&
    enemy.isAttacking &&
    enemy.framesCurrent === 2
  ) {
    enemy.isAttacking = false;
    player.takeHit(5);
    document.querySelector("#playerHealth").style.width = player.health + "%";

    gsap.to("#playerHealth", {
      width: player.health + "%",
    });
  }

  // if enemy misses
  if (enemy.isAttacking && enemy.framesCurrent === 2) {
    enemy.isAttacking = false;
  }

  // End game base on health
  if (player.health <= 0 || enemy.health <= 0) {
    if (timer === 0) return;
    whoWins();
  }
}

animate();

window.addEventListener("keydown", (event) => {
  if (!player.dead) {
    switch (event.key) {
      case "d":
        keys.d.pressed = true;
        player.lastKey = "d";
        break;
      case "a":
        keys.a.pressed = true;
        player.lastKey = "a";
        break;
      case "w":
        jump(player);
        break;
      case "s":
        keys.s.pressed = true;
        player.lastKey = "s";
        break;
      case " ":
        player.attack();
        break;
    }
  }

  if (!enemy.dead) {
    switch (event.key) {
      case "ArrowRight":
        keys.ArrowRight.pressed = true;
        enemy.lastKey = "ArrowRight";
        break;
      case "ArrowLeft":
        keys.ArrowLeft.pressed = true;
        enemy.lastKey = "ArrowLeft";
        break;
      case "ArrowUp":
        jump(enemy);
        break;
      case "ArrowDown":
        enemy.attack();
        break;
    }
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.key) {
    case "d":
      keys.d.pressed = false;
      break;
    case "a":
      keys.a.pressed = false;
      break;
    case "w":
      keys.w.pressed = false;
      break;
    case "s":
      keys.s.pressed = false;
      break;
    case " ":
      player.canAttack = true; // Pozwól na kolejny atak po puszczeniu spacji
      break;

    //enemy
    case "ArrowRight":
      keys.ArrowRight.pressed = false;
      break;
    case "ArrowLeft":
      keys.ArrowLeft.pressed = false;
      break;
    case "ArrowUp":
      keys.ArrowUp.pressed = false;
      break;
    case "ArrowDown":
      keys.ArrowDown.pressed = false;
      enemy.canAttack = true; // Pozwól na kolejny atak przeciwnikowi
      break;
  }
});
