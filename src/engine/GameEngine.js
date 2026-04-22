import { Sprite } from './classes/Sprite.js';
import { Fighter } from './classes/Fighter.js';
import { Enemy } from './classes/Enemy.js';
import { rectangularCollision } from './utils/collision.js';
import { handleGamepadInput } from './utils/input.js';
import { GRAVITY } from './utils/constants.js';
import { isMobile } from './utils/mobile.js';
import { alignSpriteToGround } from './utils/scale.js';
import { initResponsiveCanvas } from './utils/responsive.js';
import { onPlayerJoin, getMyPlayer, playroomRPC } from './utils/playroom.js';
import { NetworkFighter } from './classes/NetworkFighter.js';
import { globalAudioManager } from './classes/AudioManager.js';
import { ROSTER } from './utils/roster.js';
import { LEVELS, DEFAULT_LEVEL } from './scenes/index.js';

let canvas;
let c;
let store;
let animationId;
let player = null;
let enemy = null;
let background;
let shop;
let currentLevelConfig;
let camera = { x: 0, y: 0, zoom: 1.0 };

let isRoundOver = false;
let globalTimer = 60;
let globalTimerId = null;
let networkSyncId = null;
let playroomNetworkInitialized = false;
let remotePlayers = [];

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

function calculateHit(attacker, defender, playerNum, damageOverride = null) {
    const finalDamage = damageOverride !== null ? damageOverride : attacker.damage;
    defender.takeHit(finalDamage);
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
            currentLevelConfig = null;
            camera = { x: 0, y: 0, zoom: 1.0 };
            background.image.src = '/assets/images/background.png'.replace(/^\.\/img\//, '../assets/images/');
            if (shop) {
                shop.position.x = shop.basePosition.x;
                handleResize();
            }
        }
        
        if (state.rematchTrigger !== prevState.rematchTrigger) {
            startGame(state);
        }
    });

    animate();
}

function handleResize() {
    // With platforms and death zones we no longer rely strictly on aligning everyone to canvas.height floor 
    if (shop && !currentLevelConfig) {
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

    // Initialize Level
    const levelId = state.selectedLevel || DEFAULT_LEVEL;
    currentLevelConfig = LEVELS[levelId] || LEVELS[DEFAULT_LEVEL];
    
    background = new Sprite({
        position: { x: 0, y: 0 },
        imageSrc: currentLevelConfig.background,
    });
    
    // Play level music if requested and audio manager exists
    // (Assuming `globalAudioManager` has playMusic method, or React handles it. 
    // Wait, earlier code said "Audio is now fully managed by React views", so let's stick to doing nothing or play via global param)
    // if (globalAudioManager) globalAudioManager.playMusic('background');

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

    const isSameCharacter = p1Choice === p2Choice;
    const enemyFilterStyle = isSameCharacter ? 'grayscale(100%) brightness(75%) contrast(120%)' : 'none';

    if (state.isMultiplayer) {
        const isHost = state.isHost;
        player = new NetworkFighter(getFighterConfig(ROSTER[p1Choice], currentLevelConfig.startPositions.player, { isRemote: !isHost }));
        enemy = new NetworkFighter(getFighterConfig(ROSTER[p2Choice], currentLevelConfig.startPositions.enemy, { isRemote: isHost, colorFilter: enemyFilterStyle }));
        
        // Zamiast onData z PeerJS, Playroom API opiera się na RPC do eventów wysyłanych ad-hoc
        // i stanie synchronizowanym przez onPlayerJoin dla każdej klatki (na graczu).
        
        if (!playroomNetworkInitialized) {
            playroomRPC.register('jump', () => {
                if (isHost && enemy) enemy.jump();
                if (!isHost && player) player.jump();
            });
            
            playroomRPC.register('attack', () => {
                const target = (isHost ? enemy : player);
                if (target) target.attack();
            });
            
            playroomRPC.register('heavyAttack', () => {
                const target = (isHost ? enemy : player);
                if (target && target.heavyAttack) target.heavyAttack();
            });
            
            playroomRPC.register('dodge', () => {
                if (isHost && enemy) { enemy.dodge && enemy.dodge(); }
                if (!isHost && player) { player.dodge && player.dodge(); }
            });
            
            playroomRPC.register('hit', (data) => {
                if (data.target === 1 && player) {
                    player.takeHit(data.damage);
                    store.getState().updateHealth(1, player.health);
                    if (player.health <= 0) endGame();
                } else if (data.target === 2 && enemy) {
                    enemy.takeHit(data.damage);
                    store.getState().updateHealth(2, enemy.health);
                    if (enemy.health <= 0) endGame();
                }
            });
            
            playroomRPC.register('rematch', () => {
                store.getState().triggerRematch();
            });
            
            playroomRPC.register('main_menu', () => {
                store.getState().setMultiplayer(false);
                store.getState().resetGame();
                window.location.href = window.location.pathname; // czysty URL by uniknąć zapętleń Playroom 
            });

            // Odbieranie synchronizacji stanu z pętli (w Playroom robimy to przez polling co klatkę)
            const myId = getMyPlayer().id;
            onPlayerJoin((p) => {
                if (p.id !== myId) {
                    remotePlayers.push(p);
                }
            });
            playroomNetworkInitialized = true;
        }
        
        networkSyncId = setInterval(() => {
            // 1. Nadawanie stanu lokalnego fightera
            const localFighter = isHost ? player : enemy;
            if (localFighter && !isRoundOver) {
                getMyPlayer().setState('fighterState', localFighter.getState(), false); // Send with reliable: false
            }
            
            // 2. Odbieranie i aktualizacja z serwera dla drugiego gracza
            remotePlayers.forEach(p => {
                const state = p.getState('fighterState');
                if (state) {
                    if (isHost && enemy) enemy.receiveState(state);
                    if (!isHost && player) player.receiveState(state);
                }
            });
        }, 1000 / 30);
    } else {
        player = new Fighter(getFighterConfig(ROSTER[p1Choice], currentLevelConfig.startPositions.player));
        
        if (state.gameMode === 'ARCADE') {
            enemy = new Enemy(getFighterConfig(ROSTER[p2Choice], currentLevelConfig.startPositions.enemy, { reactionTime: 20, colorFilter: enemyFilterStyle }));
        } else {
            enemy = new Fighter(getFighterConfig(ROSTER[p2Choice], currentLevelConfig.startPositions.enemy, { colorFilter: enemyFilterStyle }));
        }
    }

    // No longer snap to ground automatically, allow levels to spawn mid air
    // alignSpriteToGround(player, canvas.height);
    // alignSpriteToGround(enemy, canvas.height);

    tickTimer();
}

function animate() {
    animationId = window.requestAnimationFrame(animate);
    
    const state = store ? store.getState() : null;
    const isGameActive = state && state.view === 'GAME' && !isRoundOver;
    
    // Calculate Camera Position
    if (player && enemy && currentLevelConfig) {
        const isMultiplayer = state ? state.isMultiplayer : false;
        const isHost = state ? state.isHost : true;
        const localFighter = (isMultiplayer && !isHost) ? enemy : player;

        let targetCamX = 0;
        let targetCamY = 0;
        let targetZoom = 1.0;

        if (isMultiplayer || (state && state.gameMode === 'ARCADE')) {
            // Singleplayer vs Bot lub Online Multiplayer - śledzenie wyłącznie lokalnego gracza
            targetCamX = (localFighter.position.x + localFighter.width/2) - canvas.width / 2;
            const targetY = (localFighter.position.y + localFighter.height/2);
            targetCamY = targetY - canvas.height / 2;
        } else {
            // Lokalny multiplayer: Środek obu graczy
            const midX = (player.position.x + player.width/2 + enemy.position.x + enemy.width/2) / 2;
            const maxHeelsY = Math.max(player.position.y + player.height, enemy.position.y + enemy.height);
            
            // Dystans do wyliczenia skalowania (zoom out) jeżeli gracze są daleko oddaleni i jeżeli mapa jest wystarczająco duża
            const dx = Math.abs(player.position.x - enemy.position.x);
            const zoomBase = canvas.width * 0.5;
            
            if (dx > zoomBase && (!currentLevelConfig.worldWidth || currentLevelConfig.worldWidth >= 1200)) {
                targetZoom = Math.max(0.6, zoomBase / dx);
            }
            
            targetCamX = midX - (canvas.width / 2) / targetZoom;
            targetCamY = maxHeelsY - (canvas.height * 0.75) / targetZoom;
        }
        
        // Simple lerp for smooth camera
        camera.x += (targetCamX - camera.x) * 0.1;
        camera.y += (targetCamY - camera.y) * 0.1;
        camera.zoom += (targetZoom - camera.zoom) * 0.05;
        
        const z = camera.zoom;
        
        // Clamp to level boundaries (optional but good practice)
        if (camera.x < 0) camera.x = 0;
        if (camera.y < 0) camera.y = 0;
        if (currentLevelConfig.worldWidth && camera.x + (canvas.width / z) > currentLevelConfig.worldWidth) 
            camera.x = currentLevelConfig.worldWidth - (canvas.width / z);
        if (currentLevelConfig.worldHeight && camera.y + (canvas.height / z) > currentLevelConfig.worldHeight) 
            camera.y = currentLevelConfig.worldHeight - (canvas.height / z);
    }

    c.fillStyle = 'black';
    c.fillRect(0, 0, canvas.width, canvas.height);

    c.save();
    c.scale(camera.zoom, camera.zoom);
    c.translate(-Math.floor(camera.x), -Math.floor(camera.y));

    if (background && background.image && background.image.complete && background.image.naturalWidth) {
        const img = background.image;
        const worldHeight = currentLevelConfig ? currentLevelConfig.worldHeight : canvas.height;
        const worldWidth = currentLevelConfig ? currentLevelConfig.worldWidth : canvas.width;
        
        const scale = worldHeight ? (worldHeight / img.height) : (canvas.height / img.height);
        const scaledWidth = Math.round(img.width * scale);
        const drawHeight = worldHeight || canvas.height;
        const drawWidth = worldWidth || canvas.width;
        
        if (scaledWidth > 0) {
            for (let x = 0; x < drawWidth; x += scaledWidth) {
                c.drawImage(img, 0, 0, img.width, img.height, x, 0, scaledWidth, drawHeight);
            }
        }
    }

    if (shop) {
        if (currentLevelConfig && currentLevelConfig.shopPosition && shop.image.complete) {
            shop.position.x = currentLevelConfig.shopPosition.x;
            shop.position.y = currentLevelConfig.shopPosition.y - (shop.image.height * shop.scale);
        } else if (!currentLevelConfig) {
            // fall back to default behavior for main menu
            shop.position.x = shop.basePosition.x;
        }
        shop.update(c);
    }
    
    // Rysowanie platform (wraz z obsługą wycinków tekstur z tła)
    if (currentLevelConfig && currentLevelConfig.platforms) {
        for (let p of currentLevelConfig.platforms) {
            if (p.texture && background && background.image && background.image.complete) {
                const img = background.image;
                
                // Konwersja skali świata by zaaplikować odpowiedni wycinek tła
                const worldHeight = currentLevelConfig.worldHeight || canvas.height;
                const scale = worldHeight / img.height;
                
                const srcX = p.texX !== undefined ? p.texX / scale : 0;
                const srcY = p.texY !== undefined ? p.texY / scale : (img.height - (p.height / scale));
                
                const srcW = p.width / scale;
                const srcH = p.height / scale;

                c.drawImage(img, srcX, srcY, srcW, srcH, p.x, p.y, p.width, p.height);
            } else {
                c.fillStyle = 'rgba(100, 100, 100, 0.8)';
                c.fillRect(p.x, p.y, p.width, p.height);
            }
        }
    }
    
    // Overlay semi-transparent
    c.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const overlayWidth = currentLevelConfig ? (currentLevelConfig.worldWidth || canvas.width) : canvas.width;
    const overlayHeight = currentLevelConfig ? (currentLevelConfig.worldHeight || canvas.height) : canvas.height;
    c.fillRect(0, 0, overlayWidth, overlayHeight);

    if (state && state.view === 'GAME' && player && enemy) {
        player.update(c, currentLevelConfig, GRAVITY);
        enemy.update(c, currentLevelConfig, GRAVITY);

        player.stopHorizontal();
        enemy.stopHorizontal();

        const isMultiplayer = state.isMultiplayer;
        const isHost = state.isHost;
        const isP1Local = !isMultiplayer || isHost;
        const isP2Local = !isMultiplayer || !isHost;

        // Death Zone check properly hitting health points & UI
        if (!isRoundOver) {
            if (currentLevelConfig && currentLevelConfig.deathZoneY) {
                if (isP1Local && player.position.y > currentLevelConfig.deathZoneY && player.health > 0) {
                    calculateHit({ damage: 9999 }, player, 1, 9999);
                    if (isMultiplayer) playroomRPC.call('hit', { target: 1, damage: 9999 }, playroomRPC.Mode.OTHERS);
                }
                if (isP2Local && enemy.position.y > currentLevelConfig.deathZoneY && enemy.health > 0) {
                    calculateHit({ damage: 9999 }, enemy, 2, 9999);
                    if (isMultiplayer) playroomRPC.call('hit', { target: 2, damage: 9999 }, playroomRPC.Mode.OTHERS);
                }
            }
        }

        handleGamepadInput(player, enemy, keys, {
            jump: (fighter) => {
                fighter.jump();
            },
            restartGame: () => {
                if (isMultiplayer) {
                    playroomRPC.call('rematch', {}, playroomRPC.Mode.OTHERS);
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
                if (state.gameMode === 'ARCADE' && typeof enemy.updateAI === 'function') {
                    // AI controls itself
                    enemy.updateAI([player], currentLevelConfig.platforms);
                } else {
                    const leftKey = isMultiplayer ? 'a' : 'ArrowLeft';
                    const rightKey = isMultiplayer ? 'd' : 'ArrowRight';

                    if (keys[leftKey].pressed && enemy.lastKey === leftKey) {
                        enemy.moveLeft(5);
                        enemy.switchSprite('run');
                    } else if (keys[rightKey].pressed && enemy.lastKey === rightKey) {
                        enemy.moveRight(5);
                        enemy.switchSprite('run');
                    } else {
                        enemy.switchSprite('idle');
                    }
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
                    const dmg = player.isHeavyAttack ? player.damage * 2 : player.damage;
                    calculateHit(player, enemy, 2, dmg);
                    if (isMultiplayer) playroomRPC.call('hit', { target: 2, damage: dmg }, playroomRPC.Mode.OTHERS);
                }
            }
            if (player.isAttacking && player.framesCurrent === pAttackMax - 1) player.isAttacking = false;

            if (rectangularCollision({ rectangle1: enemy, rectangle2: player }) &&
                enemy.isAttacking && enemy.framesCurrent === Math.floor(eAttackMax / 2)) {
                enemy.isAttacking = false;
                if (!isMultiplayer || isP2Local) {
                    const dmg = enemy.isHeavyAttack ? enemy.damage * 2 : enemy.damage;
                    calculateHit(enemy, player, 1, dmg);
                    if (isMultiplayer) playroomRPC.call('hit', { target: 1, damage: dmg }, playroomRPC.Mode.OTHERS);
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

    c.restore();

    // Draw Version in bottom-left corner (Overlay UI fixed on screen)
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
    if (event.repeat) return; // Zapobiega powielaniu komend przez przytrzymany klawisz (tzw. spam systemowy)
    if (!player || !enemy || isRoundOver) return;
    const state = store.getState();
    const isMultiplayer = state.isMultiplayer;
    const isHost = state.isHost;

    const localFighter = (isMultiplayer && !isHost) ? enemy : player;

    switch (event.key) {
        case 'd': keys.d.pressed = true; localFighter.lastKey = 'd'; break;
        case 'a': keys.a.pressed = true; localFighter.lastKey = 'a'; break;
        case 'w': 
            localFighter.jump(); 
            if (isMultiplayer) playroomRPC.call('jump', {}, playroomRPC.Mode.OTHERS);
            break;
        case 's': keys.s.pressed = true; localFighter.lastKey = 's'; break;
        case ' ': 
            localFighter.attack(); 
            if (isMultiplayer) playroomRPC.call('attack', {}, playroomRPC.Mode.OTHERS);
            break;
        case 'e':
            localFighter.heavyAttack && localFighter.heavyAttack();
            if (isMultiplayer) playroomRPC.call('heavyAttack', {}, playroomRPC.Mode.OTHERS);
            break;
        case 'f':
            localFighter.dodge && localFighter.dodge();
            if (isMultiplayer) playroomRPC.call('dodge', {}, playroomRPC.Mode.OTHERS);
            break;

        case 'ArrowRight': if (isMultiplayer) break; keys.ArrowRight.pressed = true; enemy.lastKey = 'ArrowRight'; break;
        case 'ArrowLeft': if (isMultiplayer) break; keys.ArrowLeft.pressed = true; enemy.lastKey = 'ArrowLeft'; break;
        case 'ArrowUp': if (isMultiplayer) break; enemy.jump(); break;
        case 'ArrowDown': 
            if (isMultiplayer) break; 
            enemy.select ? enemy.select() : enemy.attack(); 
            break;
        case 'm':
            if (isMultiplayer) break;
            enemy.heavyAttack && enemy.heavyAttack();
            break;
        case 'n':
            if (isMultiplayer) break;
            enemy.dodge && enemy.dodge();
            break;
    }
}

function handleKeyUp(event) {
    const state = store ? store.getState() : null;
    const isMultiplayer = state ? state.isMultiplayer : false;
    const isHost = state ? state.isHost : true;

    const localFighter = (isMultiplayer && !isHost) ? enemy : player;

    switch (event.key) {
        case 'd': keys.d.pressed = false; break;
        case 'a': keys.a.pressed = false; break;
        case 'w': keys.w.pressed = false; break;
        case 's': keys.s.pressed = false; break;
        case ' ': if (localFighter) localFighter.canAttack = true; break;
        case 'e': if (localFighter) localFighter.canAttack = true; break;
        case 'f': if (localFighter) localFighter.canAttack = true; break;

        case 'ArrowRight': if (isMultiplayer) break; keys.ArrowRight.pressed = false; break;
        case 'ArrowLeft': if (isMultiplayer) break; keys.ArrowLeft.pressed = false; break;
        case 'ArrowUp': if (isMultiplayer) break; keys.ArrowUp.pressed = false; break;
        case 'ArrowDown': if (isMultiplayer) break; if (enemy) enemy.canAttack = true; break;
        case 'm': if (isMultiplayer) break; if (enemy) enemy.canAttack = true; break;
        case 'n': if (isMultiplayer) break; if (enemy) enemy.canAttack = true; break;
    }
}
