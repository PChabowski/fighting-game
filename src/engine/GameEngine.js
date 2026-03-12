import { Sprite } from './classes/Sprite.js';
import { Fighter } from './classes/Fighter.js';
import { rectangularCollision } from './utils/collision.js';
import { handleGamepadInput } from './utils/input.js';
import { GRAVITY, START_POSITIONS } from './utils/constants.js';
import { isMobile } from './utils/mobile.js';
import { alignSpriteToGround } from './utils/scale.js';
import { initResponsiveCanvas } from './utils/responsive.js';
import { peerManager } from './utils/peer.js';
import { NetworkFighter } from './classes/NetworkFighter.js';
import { globalAudioManager } from './classes/AudioManager.js';
import { ROSTER } from './utils/roster.js';

let canvas;
let c;
let store;
let animationId;
let player = null;
let enemy = null;
let background;
let shop;

let isRoundOver = false;
let globalTimer = 60;
let globalTimerId = null;
let networkSyncId = null;

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

function tickTimer() {
    if (globalTimer > 0) {
        globalTimerId = setTimeout(() => {
            globalTimer--;
            store.getState().setTimer(globalTimer);
            if (globalTimer === 0) {
                endGame();
            } else {
                tickTimer();
            }
        }, 1000);
    }
}

function endGame() {
    if (isRoundOver) return;
    isRoundOver = true;
    if (globalTimerId) clearTimeout(globalTimerId);
    
    let winnerMsg = 'Tie';
    if (player.health > enemy.health) winnerMsg = 'Player 1';
    else if (player.health < enemy.health) winnerMsg = 'Player 2';
    
    store.getState().setWinner(winnerMsg);
}

function calculateHit(attacker, defender, playerNum) {
    defender.takeHit(attacker.damage);
    store.getState().updateHealth(playerNum, defender.health);
    if (defender.health <= 0) {
        endGame();
    }
}

export function initGameEngine(canvasElement, useGameStore) {
    canvas = canvasElement;
    c = canvas.getContext('2d');
    store = useGameStore;

    // Audio is now fully managed by React views (App.jsx) via globalAudioManager.


    initResponsiveCanvas(canvas);

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    background = new Sprite({
        position: { x: 0, y: 0 },
        imageSrc: '/assets/images/background.png',
    });

    shop = new Sprite({
        position: { x: 650, y: 160 },
        imageSrc: '/assets/images/shop.png',
        scale: 2.5,
        frameMax: 6,
    });
    shop.basePosition = { x: 650, y: 160 };
    shop.baseScale = 2.5;

    // Listen to store changes
    useGameStore.subscribe((state, prevState) => {
        if (state.view === 'GAME' && prevState.view !== 'GAME') {
            startGame(state);
        } else if (state.view !== 'GAME' && prevState.view === 'GAME') {
            // Cleanup when leaving the game to menu/lobby
            if (globalTimerId) clearTimeout(globalTimerId);
            if (networkSyncId) clearInterval(networkSyncId);
        }
        
        if (state.rematchTrigger !== prevState.rematchTrigger) {
            startGame(state);
        }
    });

    animate();
}

function handleResize() {
    if (player) alignSpriteToGround(player, canvas.height);
    if (enemy) alignSpriteToGround(enemy, canvas.height);
    if (shop) {
        shop.canvasHeight = canvas.height;
        alignSpriteToGround(shop, canvas.height);
    }
}

function startGame(state) {
    isRoundOver = false;
    globalTimer = 60;
    if (globalTimerId) clearTimeout(globalTimerId);
    if (networkSyncId) clearInterval(networkSyncId);
    
    store.getState().resetGame();
    store.getState().setTimer(globalTimer);

    // Initialize players based on selection
    const p1Choice = state.p1Character || 'Mack';
    const p2Choice = state.p2Character || 'Kenji';

    const getFighterConfig = (rosterConfig, startPos, additionalOpts = {}) => {
        // Deep clone properties to prevent referencing the exact same object from ROSTER
        // which causes both players moving at the same time if they selected same character.
        return {
            ...rosterConfig,
            position: { ...startPos },
            velocity: { x: 0, y: 0 },
            offset: { ...rosterConfig.offset },
            sprites: { ...rosterConfig.sprites },
            attackBox: { 
                offset: { ...rosterConfig.attackBox.offset }, 
                width: rosterConfig.attackBox.width, 
                height: rosterConfig.attackBox.height 
            },
            ...additionalOpts
        };
    };

    if (state.isMultiplayer) {
        const isHost = state.isHost;
        player = new NetworkFighter(getFighterConfig(ROSTER[p1Choice], START_POSITIONS.player, { isRemote: !isHost }));
        enemy = new NetworkFighter(getFighterConfig(ROSTER[p2Choice], START_POSITIONS.enemy, { isRemote: isHost }));
        
        peerManager.onData((data) => {
            if (data.type === 'stateUpdate') {
                if (isHost && enemy) enemy.receiveState(data.state);
                if (!isHost && player) player.receiveState(data.state);
            } else if (data.type === 'attack') {
                if (isHost && enemy) { enemy.attack(); enemy.isAttacking = true; }
                if (!isHost && player) { player.attack(); player.isAttacking = true; }
            } else if (data.type === 'hit') {
                if (data.target === 1 && player) {
                    player.takeHit(data.damage);
                    store.getState().updateHealth(1, player.health);
                    if (player.health <= 0) endGame();
                } else if (data.target === 2 && enemy) {
                    enemy.takeHit(data.damage);
                    store.getState().updateHealth(2, enemy.health);
                    if (enemy.health <= 0) endGame();
                }
            } else if (data.type === 'rematch') {
                store.getState().triggerRematch();
            } else if (data.type === 'main_menu') {
                peerManager.disconnect();
                store.getState().setMultiplayer(false);
                store.getState().resetGame();
                store.getState().setView('MENU');
            }
        });
        
        networkSyncId = setInterval(() => {
            const localFighter = isHost ? player : enemy;
            if (localFighter && !isRoundOver) {
                peerManager.send({
                    type: 'stateUpdate',
                    state: localFighter.getState()
                });
            }
        }, 1000 / 30);
    } else {
        player = new Fighter(getFighterConfig(ROSTER[p1Choice], START_POSITIONS.player));
        enemy = new Fighter(getFighterConfig(ROSTER[p2Choice], START_POSITIONS.enemy));
    }

    alignSpriteToGround(player, canvas.height);
    alignSpriteToGround(enemy, canvas.height);

    tickTimer();
}

function animate() {
    animationId = window.requestAnimationFrame(animate);
    
    const state = store ? store.getState() : null;
    const isGameActive = state && state.view === 'GAME' && !isRoundOver;
    
    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    if (background && background.image && background.image.complete && background.image.naturalWidth) {
        const img = background.image;
        const scale = canvas.height / img.height;
        const scaledWidth = Math.round(img.width * scale);
        if (scaledWidth > 0) {
            for (let x = 0; x < canvas.width; x += scaledWidth) {
                c.drawImage(img, 0, 0, img.width, img.height, x, 0, scaledWidth, canvas.height);
            }
        }
    }

    if (shop) shop.update(c);
    
    c.fillStyle = 'rgba(255, 255, 255, 0.15)';
    c.fillRect(0, 0, canvas.width, canvas.height);

    if (state && state.view === 'GAME' && player && enemy) {
        player.update(c, canvas, GRAVITY);
        enemy.update(c, canvas, GRAVITY);

        player.stopHorizontal();
        enemy.stopHorizontal();

        const isMultiplayer = state.isMultiplayer;
        const isHost = state.isHost;
        const isP1Local = !isMultiplayer || isHost;
        const isP2Local = !isMultiplayer || !isHost;

        handleGamepadInput(player, enemy, keys, {
            jump: (fighter) => {
                if (fighter.velocity.y === 0) fighter.velocity.y = -15;
            },
            restartGame: () => {
                if (isMultiplayer) {
                    peerManager.send({ type: 'rematch' });
                }
                store.getState().triggerRematch();
            },
            allowRestart: () => isRoundOver,
            isMultiplayer,
            localFighter: isHost ? player : enemy
        });

        // Local PvP Movment logic
        if (!isRoundOver) {
            if (isP1Local) {
                if (keys.a.pressed && player.lastKey === 'a') {
                    player.moveLeft(5);
                    player.switchSprite('run');
                } else if (keys.d.pressed && player.lastKey === 'd') {
                    player.moveRight(5);
                    player.switchSprite('run');
                } else {
                    player.switchSprite('idle');
                }

                if (player.velocity.y < 0) player.switchSprite('jump');
                else if (player.velocity.y > 0) player.switchSprite('fall');
            }

            if (isP2Local) {
                if (keys.ArrowLeft.pressed && enemy.lastKey === 'ArrowLeft') {
                    enemy.moveLeft(5);
                    enemy.switchSprite('run');
                } else if (keys.ArrowRight.pressed && enemy.lastKey === 'ArrowRight') {
                    enemy.moveRight(5);
                    enemy.switchSprite('run');
                } else {
                    enemy.switchSprite('idle');
                }

                if (enemy.velocity.y < 0) enemy.switchSprite('jump');
                else if (enemy.velocity.y > 0) enemy.switchSprite('fall');
            }

            // Attacks
            const pAttackMax = (player.sprites && player.sprites.attack && player.sprites.attack.frameMax) || player.frameMax;
            const eAttackMax = (enemy.sprites && enemy.sprites.attack && enemy.sprites.attack.frameMax) || enemy.frameMax;
            
            if (rectangularCollision({ rectangle1: player, rectangle2: enemy }) &&
                player.isAttacking && player.framesCurrent === Math.floor(pAttackMax / 2)) {
                player.isAttacking = false;
                if (!isMultiplayer || isP1Local) {
                    calculateHit(player, enemy, 2);
                    if (isMultiplayer) peerManager.send({ type: 'hit', target: 2, damage: player.damage });
                }
            }
            if (player.isAttacking && player.framesCurrent === pAttackMax - 1) player.isAttacking = false;

            if (rectangularCollision({ rectangle1: enemy, rectangle2: player }) &&
                enemy.isAttacking && enemy.framesCurrent === Math.floor(eAttackMax / 2)) {
                enemy.isAttacking = false;
                if (!isMultiplayer || isP2Local) {
                    calculateHit(enemy, player, 1);
                    if (isMultiplayer) peerManager.send({ type: 'hit', target: 1, damage: enemy.damage });
                }
            }
            if (enemy.isAttacking && enemy.framesCurrent === eAttackMax - 1) enemy.isAttacking = false;
        } else {
            // Po zakonczeniu rundy upewniamy sie, ze postacie dokoncza swoje animacje (smierc, hit lub atak) 
            // i powroca do staniu idle (lub zatrzymaja sie całkowicie po smierci).
            player.switchSprite('idle');
            enemy.switchSprite('idle');
        }
    }

    // Draw Version in bottom-left corner
    c.fillStyle = 'rgba(255, 255, 255, 0.5)';
    c.font = '10px "Press Start 2P", monospace';
    c.fillText('v' + (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0.0'), 10, canvas.height - 10);
}

export function simulateVirtualInput(key, isPressed) {
    const event = { key };
    if (isPressed) {
        handleKeyDown(event);
    } else {
        handleKeyUp(event);
    }
}

export function destroyGameEngine() {
    window.cancelAnimationFrame(animationId);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    if (globalTimerId) clearTimeout(globalTimerId);
    if (networkSyncId) clearInterval(networkSyncId);
}

function handleKeyDown(event) {
    if (!player || !enemy || isRoundOver) return;
    const state = store.getState();
    const isMultiplayer = state.isMultiplayer;
    const isHost = state.isHost;

    switch (event.key) {
        case 'd': if (isMultiplayer && !isHost) break; keys.d.pressed = true; player.lastKey = 'd'; break;
        case 'a': if (isMultiplayer && !isHost) break; keys.a.pressed = true; player.lastKey = 'a'; break;
        case 'w': if (isMultiplayer && !isHost) break; if (player.velocity.y === 0) player.velocity.y = -15; break;
        case 's': if (isMultiplayer && !isHost) break; keys.s.pressed = true; player.lastKey = 's'; break;
        case ' ': 
            if (isMultiplayer && !isHost) break; 
            player.attack(); 
            if (isMultiplayer) peerManager.send({ type: 'attack' });
            break;

        case 'ArrowRight': if (isMultiplayer && isHost) break; keys.ArrowRight.pressed = true; enemy.lastKey = 'ArrowRight'; break;
        case 'ArrowLeft': if (isMultiplayer && isHost) break; keys.ArrowLeft.pressed = true; enemy.lastKey = 'ArrowLeft'; break;
        case 'ArrowUp': if (isMultiplayer && isHost) break; if (enemy.velocity.y === 0) enemy.velocity.y = -15; break;
        case 'ArrowDown': 
            if (isMultiplayer && isHost) break; 
            enemy.select ? enemy.select() : enemy.attack(); 
            if (isMultiplayer) peerManager.send({ type: 'attack' });
            break;
    }
}

function handleKeyUp(event) {
    const state = store ? store.getState() : null;
    const isMultiplayer = state ? state.isMultiplayer : false;
    const isHost = state ? state.isHost : true;

    switch (event.key) {
        case 'd': if (isMultiplayer && !isHost) break; keys.d.pressed = false; break;
        case 'a': if (isMultiplayer && !isHost) break; keys.a.pressed = false; break;
        case 'w': if (isMultiplayer && !isHost) break; keys.w.pressed = false; break;
        case 's': if (isMultiplayer && !isHost) break; keys.s.pressed = false; break;
        case ' ': if (isMultiplayer && !isHost) break; if (player) player.canAttack = true; break;

        case 'ArrowRight': if (isMultiplayer && isHost) break; keys.ArrowRight.pressed = false; break;
        case 'ArrowLeft': if (isMultiplayer && isHost) break; keys.ArrowLeft.pressed = false; break;
        case 'ArrowUp': if (isMultiplayer && isHost) break; keys.ArrowUp.pressed = false; break;
        case 'ArrowDown': if (isMultiplayer && isHost) break; if (enemy) enemy.canAttack = true; break;
    }
}
