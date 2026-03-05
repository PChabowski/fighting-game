import { Sprite } from './classes/Sprite.js';
import { Fighter } from './classes/Fighter.js';
import { rectangularCollision } from './utils/collision.js';
import { decrementTimer, whoWins, jump, restartGame, timer } from './utils/gameLogic.js';
import { handleGamepadInput, initGamepadMenu } from './utils/input.js';
import { GRAVITY, START_POSITIONS } from './utils/constants.js';
import { isMobile, initMobileControls } from './utils/mobile.js';
import { CharacterSelect } from './ui/CharacterSelect.js';
import { alignSpriteToGround } from './utils/scale.js';
import { initResponsiveCanvas } from './utils/responsive.js';
import { GameInterface } from './ui/GameInterface.js';
import { GameMenu } from './ui/GameMenu.js';

const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");

// Initialize responsive canvas (fixed internal resolution, CSS-scaled)
initResponsiveCanvas(canvas);

// Ensure sprites align to the ground line using internal canvas height
// (we rely on CSS scaling for display so internal resolution is stable)
window.addEventListener('resize', () => {
  // re-run CSS resize handled by initResponsiveCanvas and re-align sprites
  if (typeof player !== 'undefined' && player) try { alignSpriteToGround(player, canvas.height); } catch (e) {}
  if (typeof enemy !== 'undefined' && enemy) try { alignSpriteToGround(enemy, canvas.height); } catch (e) {}
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

let player = null;
let enemy = null;

// shop alignment
shop.canvasHeight = canvas.height;
alignSpriteToGround(shop, canvas.height);

// UI: create interface (player/enemy health + timer)
const gameInterface = new GameInterface('.interface');
gameInterface.reset();

// Start menu gamepad polling (dispatches gp-* events)
try { initGamepadMenu(); } catch (e) {}

// Game start menu: show on load and hide interface until Game Start pressed
const gameMenu = new GameMenu();
gameMenu.show(gameInterface.container.parentElement || document.body);
// keep canvas visible so background/shop remain visible; hide only overlays
let menuActive = true;
gameInterface.container.classList.add('hidden');

// When a mode is selected, show character select then initialize fighters
gameMenu.onModeSelect((mode) => {
  const charSelect = new CharacterSelect(mode);
  charSelect.show(gameInterface.container.parentElement || document.body);
  // allow returning to menu
  charSelect.onBack(() => {
    try { gameMenu.show(gameInterface.container.parentElement || document.body); } catch (e) {}
  });
  charSelect.onConfirm((choices) => {
    // choices: { player: 'Mack', enemy: 'Kenji' }
    // map to fighter configs (inline mapping)
    const roster = {
      Mack: {
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
      },
      Kenji: {
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
      }
    };

    // create fighters based on selection
    player = new Fighter(Object.assign({}, roster[choices.player] || roster.Mack));
    enemy = new Fighter(Object.assign({}, roster[choices.enemy] || roster.Kenji));

    // align to ground now that images exist
    try { alignSpriteToGround(player, canvas.height); } catch (e) {}
    try { alignSpriteToGround(enemy, canvas.height); } catch (e) {}

    // reveal interface and begin the game
    menuActive = false;
    gameInterface.container.classList.remove('hidden');

    // initialize mobile controls only after selection (done below)

    // set lastKey based on current pressed keys so movement works immediately
    if (keys.a && keys.a.pressed) player.lastKey = 'a';
    else if (keys.d && keys.d.pressed) player.lastKey = 'd';
    if (keys.ArrowLeft && keys.ArrowLeft.pressed) enemy.lastKey = 'ArrowLeft';
    else if (keys.ArrowRight && keys.ArrowRight.pressed) enemy.lastKey = 'ArrowRight';

    // initialize mobile controls now (after selection)
    if (isMobile()) {
      try {
        window.mobileControls = initMobileControls(keys, {
          jump: () => { if (player && !player.dead) jump(player); },
          attack: () => { if (player && !player.dead) player.attack(); },
          attackRelease: () => { if (player) player.canAttack = true; },
          onLeft: () => { if (player) player.lastKey = 'a'; },
          onRight: () => { if (player) player.lastKey = 'd'; }
        });
      } catch (e) {}
    }

    // start the round
    try { window.restartGame(); } catch (e) {}
  });
});

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

// Mobile controls are initialized after character selection to avoid early DOM insertion.

// Timer will be started by `restartGame()` when the player clicks Game Start.

let isRoundOver = false;

function animate() {
  window.requestAnimationFrame(animate);
  // pass a restart handler wrapper so input code can call it with (player, enemy)
  const restartHandler = (p, e) => {
    try { window.restartGame(); } catch (err) { /* ignore */ }
  };
  if (!menuActive) handleGamepadInput(player, enemy, keys, { jump, restartGame: restartHandler, allowRestart: () => isRoundOver });

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

  if (!menuActive) {
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
  }

  // Collision, attack and end-of-round logic — only when fighters exist and match is active
  if (!menuActive && player && enemy) {
    // Compute attack hit frames (use attack sprite frameMax when available, fallback to current frameMax)
    const pAttackMax = (player.sprites && player.sprites.attack && player.sprites.attack.frameMax) || player.frameMax;
    const eAttackMax = (enemy.sprites && enemy.sprites.attack && enemy.sprites.attack.frameMax) || enemy.frameMax;
    const pHitFrame = Math.floor(pAttackMax / 2);
    const eHitFrame = Math.floor(eAttackMax / 2);

    // Player attack hit
    if (
      rectangularCollision({ rectangle1: player, rectangle2: enemy }) &&
      player.isAttacking &&
      player.framesCurrent === pHitFrame
    ) {
      player.isAttacking = false;
      enemy.takeHit(5);
      if (window.gsap) {
        gameInterface.enemyUI.update(enemy.health, true);
      } else {
        gameInterface.enemyUI.update(enemy.health, false);
      }
    }

    // Reset player attack flag at end of animation to avoid repeated hits
    if (player.isAttacking && player.framesCurrent === pAttackMax - 1) {
      player.isAttacking = false;
    }

    // Enemy attack hit
    if (
      rectangularCollision({ rectangle1: enemy, rectangle2: player }) &&
      enemy.isAttacking &&
      enemy.framesCurrent === eHitFrame
    ) {
      enemy.isAttacking = false;
      player.takeHit(5);
      if (window.gsap) {
        gameInterface.playerUI.update(player.health, true);
      } else {
        gameInterface.playerUI.update(player.health, false);
      }
    }

    // Reset enemy attack flag at end of animation
    if (enemy.isAttacking && enemy.framesCurrent === eAttackMax - 1) {
      enemy.isAttacking = false;
    }

    // End game based on health
    if (player.health <= 0 || enemy.health <= 0) {
      // prevent duplicate end handling
      if (timer === 0) return;
      isRoundOver = true;
      const msg = whoWins(player, enemy);
      try { gameInterface.winModal.show(msg, gameInterface.container.parentElement || document.body); } catch (e) {}
    }
  }
}

animate();

window.addEventListener('keydown', (event) => {
  // Always update pressed flags so late-created fighters can react immediately
  switch (event.key) {
    case 'd':
      keys.d.pressed = true;
      if (player && !player.dead) player.lastKey = 'd';
      break;
    case 'a':
      keys.a.pressed = true;
      if (player && !player.dead) player.lastKey = 'a';
      break;
    case 'w':
      if (player && !player.dead) jump(player);
      break;
    case 's':
      keys.s.pressed = true;
      if (player && !player.dead) player.lastKey = 's';
      break;
    case ' ':
      if (player && !player.dead) player.attack();
      break;
    case 'ArrowRight':
      keys.ArrowRight.pressed = true;
      if (enemy && !enemy.dead) enemy.lastKey = 'ArrowRight';
      break;
    case 'ArrowLeft':
      keys.ArrowLeft.pressed = true;
      if (enemy && !enemy.dead) enemy.lastKey = 'ArrowLeft';
      break;
    case 'ArrowUp':
      if (enemy && !enemy.dead) jump(enemy);
      break;
    case 'ArrowDown':
      if (enemy && !enemy.dead) enemy.attack();
      break;
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
      if (player) player.canAttack = true; // Pozwól na kolejny atak po puszczeniu spacji
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
      if (enemy) enemy.canAttack = true; // Pozwól na kolejny atak przeciwnikowi
      break;
  }
});

// expose restartGame for the inline button in index.html
window.restartGame = () => {
  // allow restart only when fighters exist
  isRoundOver = false;
  try {
    restartGame(player, enemy, (t) => gameInterface.timer.set(t), () => {
      const msg = whoWins(player, enemy);
      try { gameInterface.winModal.show(msg, gameInterface.container.parentElement || document.body); } catch (e) {}
    });
  } catch (e) {}

  try {
    gameInterface.reset();
    try { gameInterface.winModal.remove(); } catch (e) {}
  } catch (e) {}
};

// Bind the WinModal restart button to the global restart function once available
try {
  if (gameInterface && gameInterface.winModal) {
    // Rematch -> restart the game
    gameInterface.winModal.onRematch(() => window.restartGame());

    // Return to menu -> show main menu, hide interface and reset round state
    gameInterface.winModal.onReturnToMenu(() => {
      try { gameMenu.show(gameInterface.container.parentElement || document.body); } catch (e) {}
      try { menuActive = true; gameInterface.container.classList.add('hidden'); } catch (e) {}
      try { player = null; enemy = null; } catch (e) {}
    });
  }
} catch (e) {}
