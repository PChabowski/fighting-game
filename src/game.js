import { Sprite } from './classes/Sprite.js';
import { Fighter } from './classes/Fighter.js';
import { rectangularCollision } from './utils/collision.js';
import { decrementTimer, whoWins, jump, restartGame } from './utils/gameLogic.js';
import { handleGamepadInput } from './utils/input.js';
import { GRAVITY, START_POSITIONS } from './utils/constants.js';
import { isMobile, initMobileControls } from './utils/mobile.js';
import { alignSpriteToGround } from './utils/scale.js';
import { initResponsiveCanvas } from './utils/responsive.js';

const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");

// Initialize responsive canvas (fixed internal resolution, CSS-scaled)
initResponsiveCanvas(canvas);

// Ensure sprites align to the ground line using internal canvas height
// (we rely on CSS scaling for display so internal resolution is stable)
window.addEventListener('resize', () => {
  // re-run CSS resize handled by initResponsiveCanvas and re-align sprites
  alignSpriteToGround(player, canvas.height);
  alignSpriteToGround(enemy, canvas.height);
  shop.canvasHeight = canvas.height;
  alignSpriteToGround(shop, canvas.height);
});

c.fillRect(0, 0, canvas.width, canvas.height);

const background = new Sprite({
  position: { x: 0, y: 0 },
  imageSrc: '../assets/images/background.png',
});

const shop = new Sprite({
  position: { x: 650, y: 160 },
  imageSrc: '../assets/images/shop.png',
  scale: 2.5,
  frameMax: 6,
});
// store base properties for responsive adjustments
shop.basePosition = { x: 650, y: 160 };
shop.baseScale = 2.5;

const player = new Fighter({
  position: START_POSITIONS.player,
  velocity: { x: 0, y: 0 },
  imageSrc: '../assets/images/Mack/Idle.png',
  scale: 2.5,
  frameMax: 8,
  offset: { x: 215, y: 155 },
  sprites: {
    idle: { imageSrc: '../assets/images/Mack/Idle.png', frameMax: 8 },
    run: { imageSrc: '../assets/images/Mack/Run.png', frameMax: 8 },
    jump: { imageSrc: '../assets/images/Mack/Jump.png', frameMax: 2 },
    fall: { imageSrc: '../assets/images/Mack/Fall.png', frameMax: 2 },
    attack: { imageSrc: '../assets/images/Mack/Attack1.png', frameMax: 6 },
    takeHit: { imageSrc: '../assets/images/Mack/Take Hit - white silhouette.png', frameMax: 4 },
    death: { imageSrc: '../assets/images/Mack/Death.png', frameMax: 6 },
  },
  attackBox: { offset: { x: 100, y: 50 }, width: 160, height: 50 },
});

const enemy = new Fighter({
  position: START_POSITIONS.enemy,
  velocity: { x: 0, y: 0 },
  color: 'yellow',
  imageSrc: '../assets/images/Kenji/Idle.png',
  scale: 2.5,
  frameMax: 4,
  offset: { x: 215, y: 170 },
  sprites: {
    idle: { imageSrc: '../assets/images/Kenji/Idle.png', frameMax: 4 },
    run: { imageSrc: '../assets/images/Kenji/Run.png', frameMax: 8 },
    jump: { imageSrc: '../assets/images/Kenji/Jump.png', frameMax: 2 },
    fall: { imageSrc: '../assets/images/Kenji/Fall.png', frameMax: 2 },
    attack: { imageSrc: '../assets/images/Kenji/Attack1.png', frameMax: 4 },
    takeHit: { imageSrc: '../assets/images/Kenji/Take hit.png', frameMax: 3 },
    death: { imageSrc: '../assets/images/Kenji/Death.png', frameMax: 7 },
  },
  attackBox: { offset: { x: 83, y: 50 }, width: 160, height: 50 },
});

// After creating scene objects, align them to the ground using internal canvas size
alignSpriteToGround(player, canvas.height);
alignSpriteToGround(enemy, canvas.height);
shop.canvasHeight = canvas.height;
alignSpriteToGround(shop, canvas.height);

const keys = {
  a: { pressed: false },
  d: { pressed: false },
  w: { pressed: false },
  s: { pressed: false },
  ArrowRight: { pressed: false },
  ArrowLeft: { pressed: false },
  ArrowUp: { pressed: false },
  ArrowDown: { pressed: false },
};

// Inicjalizacja kontroli mobilnych
const mobileControls = initMobileControls(keys, {
  jump: () => {
    if (!player.dead) {
      jump(player);
    }
  },
  attack: () => {
    if (!player.dead) {
      player.attack();
    }
  },
  attackRelease: () => {
    // zwalniamy możliwość ataku przy zwolnieniu przycisku dotykowego
    player.canAttack = true;
  }
});

// Ustawienie lastKey dla mobilnego d-pad'u
if (isMobile()) {
  const leftBtn = document.getElementById('btn-left');
  const rightBtn = document.getElementById('btn-right');
  
  if (leftBtn) {
    leftBtn.addEventListener('touchstart', () => {
      player.lastKey = 'a';
    });
    leftBtn.addEventListener('mousedown', () => {
      player.lastKey = 'a';
    });
  }
  
  if (rightBtn) {
    rightBtn.addEventListener('touchstart', () => {
      player.lastKey = 'd';
    });
    rightBtn.addEventListener('mousedown', () => {
      player.lastKey = 'd';
    });
  }
}

decrementTimer(() => whoWins(player, enemy));

function animate() {
  window.requestAnimationFrame(animate);
  handleGamepadInput(player, enemy, keys, { jump, restartGame });

  // Draw background as a repeating pattern that fills the entire canvas width
  if (background.image && background.image.complete && background.image.naturalWidth) {
    // Scale background to fully fill canvas height, tile horizontally (repeat-x)
    const img = background.image;
    const scale = canvas.height / img.height;
    const scaledWidth = Math.round(img.width * scale);

    // Guard against zero width
    if (scaledWidth > 0) {
      for (let x = 0; x < canvas.width; x += scaledWidth) {
        c.drawImage(
          img,
          0,
          0,
          img.width,
          img.height,
          x,
          0,
          scaledWidth,
          canvas.height
        );
      }
    } else {
      c.fillStyle = 'black';
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
  } else {
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);
  }

  shop.update(c);
  c.fillStyle = 'rgba(255, 255, 255, 0.15)';
  c.fillRect(0, 0, canvas.width, canvas.height);
  player.update(c, canvas, GRAVITY);
  enemy.update(c, canvas, GRAVITY);

  player.stopHorizontal();
  enemy.stopHorizontal();

  // Player movment
  if (keys.a.pressed && player.lastKey === 'a') {
    player.moveLeft(5);
    player.switchSprite('run');
  } else if (keys.d.pressed && player.lastKey === 'd') {
    player.moveRight(5);
    player.switchSprite('run');
  } else {
    player.switchSprite('idle');
  }

  // Jump animation
  if (player.velocity.y < 0) {
    player.switchSprite('jump');
  } else if (player.velocity.y > 0) {
    player.switchSprite('fall');
  }

  // Enemy movment
  if (keys.ArrowLeft.pressed && enemy.lastKey === 'ArrowLeft') {
    enemy.moveLeft(5);
    enemy.switchSprite('run');
  } else if (keys.ArrowRight.pressed && enemy.lastKey === 'ArrowRight') {
    enemy.moveRight(5);
    enemy.switchSprite('run');
  } else {
    enemy.switchSprite('idle');
  }

  // Jump animation
  if (enemy.velocity.y < 0) {
    enemy.switchSprite('jump');
  } else if (enemy.velocity.y > 0) {
    enemy.switchSprite('fall');
  }

  // Detect for colission
  if (
    rectangularCollision({ rectangle1: player, rectangle2: enemy }) &&
    player.isAttacking &&
    player.framesCurrent === 4
  ) {
    player.isAttacking = false;
    enemy.takeHit(5);
    document.querySelector('#enemyHealth').style.width = enemy.health + '%';

    if (window.gsap) {
      gsap.to('#enemyHealth', { width: enemy.health + '%' });
    }
  }

  // if player misses
  if (player.isAttacking && player.framesCurrent === 4) {
    player.isAttacking = false;
  }

  if (
    rectangularCollision({ rectangle1: enemy, rectangle2: player }) &&
    enemy.isAttacking &&
    enemy.framesCurrent === 2
  ) {
    enemy.isAttacking = false;
    player.takeHit(5);
    document.querySelector('#playerHealth').style.width = player.health + '%';

    if (window.gsap) {
      gsap.to('#playerHealth', { width: player.health + '%' });
    }
  }

  // if enemy misses
  if (enemy.isAttacking && enemy.framesCurrent === 2) {
    enemy.isAttacking = false;
  }

  // End game base on health
  if (player.health <= 0 || enemy.health <= 0) {
    if (typeof timer !== 'undefined' && timer === 0) return;
    whoWins(player, enemy);
  }
}

animate();

window.addEventListener('keydown', (event) => {
  if (!player.dead) {
    switch (event.key) {
      case 'd':
        keys.d.pressed = true;
        player.lastKey = 'd';
        break;
      case 'a':
        keys.a.pressed = true;
        player.lastKey = 'a';
        break;
      case 'w':
        jump(player);
        break;
      case 's':
        keys.s.pressed = true;
        player.lastKey = 's';
        break;
      case ' ':
        player.attack();
        break;
    }
  }

  if (!enemy.dead) {
    switch (event.key) {
      case 'ArrowRight':
        keys.ArrowRight.pressed = true;
        enemy.lastKey = 'ArrowRight';
        break;
      case 'ArrowLeft':
        keys.ArrowLeft.pressed = true;
        enemy.lastKey = 'ArrowLeft';
        break;
      case 'ArrowUp':
        jump(enemy);
        break;
      case 'ArrowDown':
        enemy.attack();
        break;
    }
  }
});

window.addEventListener('keyup', (event) => {
  switch (event.key) {
    case 'd':
      keys.d.pressed = false;
      break;
    case 'a':
      keys.a.pressed = false;
      break;
    case 'w':
      keys.w.pressed = false;
      break;
    case 's':
      keys.s.pressed = false;
      break;
    case ' ':
      player.canAttack = true; // Pozwól na kolejny atak po puszczeniu spacji
      break;

    //enemy
    case 'ArrowRight':
      keys.ArrowRight.pressed = false;
      break;
    case 'ArrowLeft':
      keys.ArrowLeft.pressed = false;
      break;
    case 'ArrowUp':
      keys.ArrowUp.pressed = false;
      break;
    case 'ArrowDown':
      keys.ArrowDown.pressed = false;
      enemy.canAttack = true; // Pozwól na kolejny atak przeciwnikowi
      break;
  }
});

// expose restartGame for the inline button in index.html
window.restartGame = () => restartGame(player, enemy);
