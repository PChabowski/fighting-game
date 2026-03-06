import { Sprite } from './classes/Sprite.js';
import { Fighter } from './classes/Fighter.js';
import { rectangularCollision } from './utils/collision.js';
import { decrementTimer, whoWins, jump, restartGame, timer } from './utils/gameLogic.js';
import { handleGamepadInput, initGamepadMenu } from './utils/input.js';
import { GRAVITY, START_POSITIONS, APP_VERSION } from './utils/constants.js';
import { isMobile, initMobileControls, removeMobileControls } from './utils/mobile.js';
import { CharacterSelect } from './ui/CharacterSelect.js';
import { alignSpriteToGround } from './utils/scale.js';
import { initResponsiveCanvas } from './utils/responsive.js';
import { GameInterface } from './ui/GameInterface.js';
import { GameMenu } from './ui/GameMenu.js';
import { MobileOrientationModal } from './ui/MobileOrientationModal.js';
import { MultiplayerMenu } from './ui/MultiplayerMenu.js';
import { JoinMenu } from './ui/JoinMenu.js';
import { MultiplayerLobby } from './ui/MultiplayerLobby.js';
import { peerManager } from './utils/peer.js';
import { NetworkFighter } from './classes/NetworkFighter.js';

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

import { ROSTER } from './utils/roster.js';

let player = null;
let enemy = null;
let isMultiplayer = false;
let isHost = false;

// shop alignment
shop.canvasHeight = canvas.height;
alignSpriteToGround(shop, canvas.height);

// UI: create interface (player/enemy health + timer)
const gameInterface = new GameInterface('.interface');
gameInterface.reset();

const mobileOrientationModal = new MobileOrientationModal();
if (isMobile()) {
  mobileOrientationModal.show(gameInterface.container.parentElement || document.body);
  mobileOrientationModal.syncWithDeviceState();
}

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
  if (mode === 'multiplayer') {
      const multiMenu = new MultiplayerMenu();
      multiMenu.show(gameInterface.container.parentElement || document.body);
      multiMenu.onSelect((type) => {
          multiMenu.hide();
          if (type === 'back') {
              gameMenu.show();
          } else if (type === 'host') {
              isHost = true;
              isMultiplayer = true;
              peerManager.initHost();
              const lobby = new MultiplayerLobby(true);
              peerManager.onOpen((id) => {
                  lobby.setPeerId(id);
                  lobby.setConnected(false);
              });
              lobby.show();
              
              peerManager.onConnection(() => {
                  lobby.setConnected(true);
              });
              
              peerManager.onData((data) => {
                  if (data.type === 'select') {
                      lobby.setRemoteSelection(data.characterId);
                  } else if (data.type === 'start') {
                      // Guest receives start signal from Host. 
                      // Host passes local/remote in its own perspective.
                      // For Guest: local choice is what they picked, remote is what host picked.
                      startMultiplayerGame(lobby.selection.local, lobby.selection.remote);
                      lobby.hide();
                  }
              });

              lobby.onSelect((charId) => {
                  peerManager.send({ type: 'select', characterId: charId });
              });

              lobby.onStart(() => {
                  peerManager.send({ type: 'start' });
                  // Host starts game: local is host's choice, remote is guest's choice.
                  startMultiplayerGame(lobby.selection.local, lobby.selection.remote);
                  lobby.hide();
              });

              lobby.onBack(() => {
                location.reload(); // Simple way to reset state
              });

          } else if (type === 'join') {
              isHost = false;
              isMultiplayer = true;
              const joinMenu = new JoinMenu();
              joinMenu.show();
              joinMenu.onConnect((id) => {
                  joinMenu.hide();
                  peerManager.connectToHost(id);
                  const lobby = new MultiplayerLobby(false);
                  lobby.show();
                  
                  peerManager.onConnection(() => {
                      lobby.setConnected(true);
                  });

                  peerManager.onData((data) => {
                    if (data.type === 'select') {
                        lobby.setRemoteSelection(data.characterId);
                    } else if (data.type === 'start') {
                        // Start received by Guest
                        // lobby.selection.local is Guest's pick
                        // lobby.selection.remote is Host's pick (synced via 'select' packet)
                        startMultiplayerGame(lobby.selection.local, lobby.selection.remote);
                        lobby.hide();
                    }
                  });

                  lobby.onSelect((charId) => {
                      peerManager.send({ type: 'select', characterId: charId });
                  });

                  lobby.onBack(() => {
                    location.reload();
                  });
              });
              joinMenu.onBack(() => {
                joinMenu.hide();
                gameMenu.show();
              });
          }
      });
      return;
  }
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
        const localFighter = player; // Single player is always P1
        window.mobileControls = initMobileControls(keys, {
          jump: () => { if (localFighter && !localFighter.dead) jump(localFighter); },
          attack: () => { if (localFighter && !localFighter.dead) localFighter.attack(); },
          attackRelease: () => { if (localFighter) localFighter.canAttack = true; },
          onLeft: () => { if (localFighter) localFighter.lastKey = 'a'; },
          onRight: () => { if (localFighter) localFighter.lastKey = 'd'; }
        });
      } catch (e) {}
    }

    // start the round
    try { window.restartGame(); } catch (e) {}
  });
});

function startMultiplayerGame(localChoice, remoteChoice) {
    // localChoice = choice of current player (Host or Guest)
    // remoteChoice = choice of the partner
    
    // For Host: P1=Host(local), P2=Guest(remote)
    // For Guest: P1=Host(remote), P2=Guest(local)
    const hostChoice = isHost ? localChoice : remoteChoice;
    const guestChoice = isHost ? remoteChoice : localChoice;

    const p1Config = Object.assign({}, ROSTER[hostChoice]);
    const p2Config = Object.assign({}, ROSTER[guestChoice]);

    player = new NetworkFighter({
        ...p1Config,
        position: START_POSITIONS.player,
        isRemote: !isHost // Host controls player, Guest updates via state
    });
    
    enemy = new NetworkFighter({
        ...p2Config,
        position: START_POSITIONS.enemy,
        isRemote: isHost // Guest controls enemy, Host updates via state
    });

    // align to ground
    try { alignSpriteToGround(player, canvas.height); } catch (e) {}
    try { alignSpriteToGround(enemy, canvas.height); } catch (e) {}

    menuActive = false;
    gameInterface.container.classList.remove('hidden');

    // Start timer and game logic for both
    try { 
        window.restartGame(player, enemy, (time) => {
            gameInterface.timerUI.update(time);
        }, () => {
            // End of game logic
            isRoundOver = true;
            const result = window.whoWins(player, enemy);
            gameInterface.winModal.show(result);
        });
    } catch (err) {}

    // Network Loop
    peerManager.onData((data) => {
        if (data.type === 'state') {
            if (isHost) {
                // Host receives Guest state (Guest is P2)
                enemy.receiveState(data.state);
            } else {
                // Guest receives Host state (Host is P1)
                player.receiveState(data.state);
            }
        } else if (data.type === 'rematch') {
            // Signal from peer to restart the game
            window.restartGame(false); // Don't send back to avoid loop
        }
    });

    // Initialize mobile controls for multiplayer
    if (isMobile()) {
        try {
            const localFighter = isHost ? player : enemy;
            window.mobileControls = initMobileControls(keys, {
                jump: () => { if (localFighter && !localFighter.dead) jump(localFighter); },
                attack: () => { if (localFighter && !localFighter.dead) localFighter.attack(); },
                attackRelease: () => { if (localFighter) localFighter.canAttack = true; },
                onLeft: () => { if (localFighter) localFighter.lastKey = 'a'; },
                onRight: () => { if (localFighter) localFighter.lastKey = 'd'; }
            });
        } catch (e) {
            console.error('Error initializing multiplayer mobile controls:', e);
        }
    }
}

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
    
    // Broadcast state if in multiplayer
    if (isMultiplayer) {
        if (isHost) {
            peerManager.send({ type: 'state', state: player.getState() });
        } else {
            peerManager.send({ type: 'state', state: enemy.getState() });
        }
    }

    player.stopHorizontal();
    enemy.stopHorizontal();

    // Player movment - local only or PvP or Multiplayer (Local is always P1/P2 depending on role)
    const localFighter = isHost ? player : enemy;
    const remoteFighter = isHost ? enemy : player;

    if (!isMultiplayer) {
        // PvP / Arcade
        if (keys.a.pressed && player.lastKey === 'a' && !player.dead) {
            player.moveLeft(5);
            player.switchSprite('run');
        } else if (keys.d.pressed && player.lastKey === 'd' && !player.dead) {
            player.moveRight(5);
            player.switchSprite('run');
        } else {
            player.switchSprite('idle');
        }

        // Jump animation
        if (player.velocity.y < 0 && !player.dead) {
            player.switchSprite('jump');
        } else if (player.velocity.y > 0 && !player.dead) {
            player.switchSprite('fall');
        }

        // Enemy movment
        if (keys.ArrowLeft.pressed && enemy.lastKey === 'ArrowLeft' && !enemy.dead) {
            enemy.moveLeft(5);
            enemy.switchSprite('run');
        } else if (keys.ArrowRight.pressed && enemy.lastKey === 'ArrowRight' && !enemy.dead) {
            enemy.moveRight(5);
            enemy.switchSprite('run');
        } else {
            enemy.switchSprite('idle');
        }

        // Jump animation
        if (enemy.velocity.y < 0 && !enemy.dead) {
            enemy.switchSprite('jump');
        } else if (enemy.velocity.y > 0 && !enemy.dead) {
            enemy.switchSprite('fall');
        }
    } else {
        // Multiplayer: Both players use WSAD + Space for their locally controlled fighter
        if (keys.a.pressed && localFighter.lastKey === 'a' && !localFighter.dead) {
            localFighter.moveLeft(5);
            localFighter.switchSprite('run');
        } else if (keys.d.pressed && localFighter.lastKey === 'd' && !localFighter.dead) {
            localFighter.moveRight(5);
            localFighter.switchSprite('run');
        } else {
            localFighter.switchSprite('idle');
        }

        if (localFighter.velocity.y < 0 && !localFighter.dead) {
            localFighter.switchSprite('jump');
        } else if (localFighter.velocity.y > 0 && !localFighter.dead) {
            localFighter.switchSprite('fall');
        }
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
      if (isRoundOver) return; // prevent duplicate end handling
      isRoundOver = true;
      
      // Stop the timer
      if (typeof timerId !== 'undefined') {
        clearInterval(timerId);
      }

      const msg = whoWins(player, enemy);
      try { 
        gameInterface.winModal.show(msg, gameInterface.container.parentElement || document.body, isMultiplayer); 
      } catch (e) {
        console.error('Error showing win modal:', e);
      }
    }
  }

    // Render app version in bottom-left corner (logical resolution-aware)
    try {
      c.save();
      // Prefer 'Press Start 2P' if available, fallback to Arial
      c.font = '10px "Press Start 2P", Arial';
      c.textBaseline = 'bottom';
      c.fillStyle = 'rgba(255, 255, 255, 0.5)';
      const verText = `v${APP_VERSION.version} (${APP_VERSION.branch})`;
      // margin from logical canvas edges
      const x = 10;
      const y = canvas.height - 10;
      c.fillText(verText, x, y);
      c.restore();
    } catch (e) {}
}

animate();

window.addEventListener('keydown', (event) => {
  // Determine which fighter is local in multiplayer mode
  const localFighter = isMultiplayer ? (isHost ? player : enemy) : player;
  const isGuest = isMultiplayer && !isHost;

  // Always update pressed flags so late-created fighters can react immediately
  switch (event.key) {
    case 'd':
      keys.d.pressed = true;
      if (localFighter && !localFighter.dead) localFighter.lastKey = 'd';
      break;
    case 'a':
      keys.a.pressed = true;
      if (localFighter && !localFighter.dead) localFighter.lastKey = 'a';
      break;
    case 'w':
      if (localFighter && !localFighter.dead) jump(localFighter);
      break;
    case 's':
      keys.s.pressed = true;
      if (localFighter && !localFighter.dead) localFighter.lastKey = 's';
      break;
    case ' ':
      if (localFighter && !localFighter.dead) localFighter.attack();
      break;
    case 'ArrowRight':
      if (isMultiplayer) break; // Disable arrows in multiplayer to avoid double controls
      keys.ArrowRight.pressed = true;
      if (enemy && !enemy.dead) enemy.lastKey = 'ArrowRight';
      break;
    case 'ArrowLeft':
      if (isMultiplayer) break;
      keys.ArrowLeft.pressed = true;
      if (enemy && !enemy.dead) enemy.lastKey = 'ArrowLeft';
      break;
    case 'ArrowUp':
      if (isMultiplayer) break;
      if (enemy && !enemy.dead) jump(enemy);
      break;
    case 'ArrowDown':
      if (isMultiplayer) break;
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
      // If we used a localFighter reference here, we could reset attack logic if needed
      if (!isMultiplayer && player) player.canAttack = true;
      else if (isMultiplayer) {
         const localFighter = isHost ? player : enemy;
         if (localFighter) localFighter.canAttack = true;
      }
      break;

    //enemy
    case 'ArrowRight':
      if (isMultiplayer) break;
      keys.ArrowRight.pressed = false;
      break;
    case 'ArrowLeft':
      if (isMultiplayer) break;
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
window.restartGame = (sendPacket = true) => {
  // allow restart only when fighters exist
  isRoundOver = false;

  // If in multiplayer, we need to notify the peer or handle the received signal
  if (isMultiplayer && sendPacket) {
    peerManager.send({ type: 'rematch' });
  }

  try {
    restartGame(player, enemy, (t) => {
      if (gameInterface.timer) gameInterface.timer.set(t);
      else if (gameInterface.timerUI) gameInterface.timerUI.update(t);
    }, () => {
      isRoundOver = true;
      const msg = whoWins(player, enemy);
      try { 
        gameInterface.winModal.show(msg, gameInterface.container.parentElement || document.body, isMultiplayer); 
      } catch (e) {}
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
      if (isMobile()) removeMobileControls();
      try { gameMenu.show(gameInterface.container.parentElement || document.body); } catch (e) {}
      try { menuActive = true; gameInterface.container.classList.add('hidden'); } catch (e) {}
      try { player = null; enemy = null; } catch (e) {}
    });
  }
} catch (e) {}
