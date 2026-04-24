import { DynamicPlatform } from './classes/DynamicPlatform.js';
import { Sprite } from './classes/Sprite.js';
import { Fighter } from './classes/Fighter.js';
import { Enemy } from './classes/Enemy.js';
import { Pickup } from './classes/Pickup.js';
import { rectangularCollision } from './utils/collision.js';
import { handleGamepadInput } from './utils/input.js';
import { GRAVITY, PLAYER_JUMP_POWER } from './utils/constants.js';
import { isMobile } from './utils/mobile.js';
import { alignSpriteToGround } from './utils/scale.js';
import { initResponsiveCanvas } from './utils/responsive.js';
import { onPlayerJoin, getMyPlayer, playroomRPC } from './utils/playroom.js';
import { NetworkFighter } from './classes/NetworkFighter.js';
import { globalAudioManager } from './classes/AudioManager.js';
import { ROSTER } from './utils/roster.js';
import { LEVELS, DEFAULT_LEVEL } from './scenes/index.js';
import { trackKothZoneControl } from './utils/koth.js';
import { getAIDifficultyConfig, getAIMapProfile } from './utils/aiProfiles.js';

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
let musicSyncId = null;
let playroomNetworkInitialized = false;
let remotePlayers = [];
let pickups = [];
let pickupSpawnsState = [];
let ctfFlags = [];
let currentMatchType = 'STOCK';
let currentAIMapProfile = null;
let currentMapIntelligence = null;

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

function buildMapIntelligence(levelId, levelConfig) {
    if (!levelConfig) return null;

    const sourcePlatforms = Array.isArray(levelConfig.platforms) ? levelConfig.platforms : [];
    const platformTopology = sourcePlatforms.map((platform, index) => {
        const platformId = platform.platformId || platform.id || `platform-${index}`;
        const waypoints = Array.isArray(platform.waypoints)
            ? platform.waypoints.map((point) => ({ x: point.x, y: point.y }))
            : [];
        const trajectoryPoints = [{ x: platform.x, y: platform.y }, ...waypoints];

        const bounds = trajectoryPoints.reduce((acc, point) => {
            return {
                minX: Math.min(acc.minX, point.x),
                maxX: Math.max(acc.maxX, point.x),
                minY: Math.min(acc.minY, point.y),
                maxY: Math.max(acc.maxY, point.y),
            };
        }, {
            minX: platform.x,
            maxX: platform.x,
            minY: platform.y,
            maxY: platform.y,
        });

        return {
            platformId,
            index,
            x: platform.x,
            y: platform.y,
            width: platform.width,
            height: platform.height,
            isTrigger: !!platform.isTrigger,
            triggerType: platform.triggerType || null,
            baseTeam: platform.baseTeam || null,
            isDynamic: waypoints.length > 0,
            speed: platform.speed || 0,
            waypoints,
            trajectoryBounds: bounds,
        };
    });

    return {
        levelId,
        worldWidth: levelConfig.worldWidth || null,
        worldHeight: levelConfig.worldHeight || null,
        deathZoneY: levelConfig.deathZoneY || null,
        startPositions: levelConfig.startPositions
            ? {
                player: { ...levelConfig.startPositions.player },
                enemy: { ...levelConfig.startPositions.enemy },
            }
            : null,
        flags: Array.isArray(levelConfig.flags)
            ? levelConfig.flags.map((flag) => ({ team: flag.team, x: flag.x, y: flag.y }))
            : [],
        platforms: platformTopology,
        dynamicPlatforms: platformTopology.filter((platform) => platform.isDynamic),
    };
}

function tickTimer() {
    const state = store ? store.getState() : null;
    if (!state || state.view !== 'GAME') return;
    if (globalTimer <= 0) return;

    const shouldPauseTimer = state.isPaused && !state.isMultiplayer;
    const delay = shouldPauseTimer ? 200 : 1000;
    globalTimerId = setTimeout(() => {
        const currentState = store ? store.getState() : null;
        if (!currentState || currentState.view !== 'GAME') return;

        if (!(currentState.isPaused && !currentState.isMultiplayer)) {
            globalTimer--;
            store.getState().setTimer(globalTimer);
            store.getState().setTimeRemaining(globalTimer);
            if (globalTimer === 0) {
                endGame();
                return;
            }
        }

        tickTimer();
    }, delay);
}

function clearMusicSyncInterval() {
    if (musicSyncId) {
        clearInterval(musicSyncId);
        musicSyncId = null;
    }
}

function getBattleTrackState() {
    const current = globalAudioManager.getCurrentTrackState();
    if (!current.trackName || !globalAudioManager.isTrackInCategory('battle', current.trackName)) {
        globalAudioManager.playCategory('battle');
    }
    return globalAudioManager.getCurrentTrackState();
}

function broadcastHostMusicState() {
    const state = store ? store.getState() : null;
    if (!state || state.view !== 'GAME' || !state.isMultiplayer || !state.isHost) return;

    const track = getBattleTrackState();
    if (!track.trackName) return;

    playroomRPC.call('music_sync', {
        trackName: track.trackName,
        currentTime: track.currentTime,
    }, playroomRPC.Mode.OTHERS);
}

function startMultiplayerMusicSync() {
    const state = store ? store.getState() : null;
    if (!state || !state.isMultiplayer) return;

    clearMusicSyncInterval();

    if (state.isHost) {
        getBattleTrackState();
        broadcastHostMusicState();
        musicSyncId = setInterval(() => {
            broadcastHostMusicState();
        }, 2000);
        return;
    }

    // Klient czeka na hosta, aby uniknąć losowego tracka i desynchronizacji czasu.
    globalAudioManager.stop();
    playroomRPC.call('music_sync_request', {}, playroomRPC.Mode.OTHERS);
}

function endGame() {
    if (isRoundOver) return;
    isRoundOver = true;
    if (globalTimerId) clearTimeout(globalTimerId);
    
    let winnerMsg = 'Tie';
    const s = store.getState();
    if (s.matchType === 'CTF') {
        if (s.player1Score > s.player2Score) winnerMsg = 'Player 1';
        else if (s.player1Score < s.player2Score) winnerMsg = 'Player 2';
        else if (player.health > enemy.health) winnerMsg = 'Player 1';
        else if (player.health < enemy.health) winnerMsg = 'Player 2';
    } else {
        if (s.player1Stocks > s.player2Stocks) winnerMsg = 'Player 1';
        else if (s.player1Stocks < s.player2Stocks) winnerMsg = 'Player 2';
        else if (player.health > enemy.health) winnerMsg = 'Player 1';
        else if (player.health < enemy.health) winnerMsg = 'Player 2';
    }
    
    store.getState().setWinner(winnerMsg);
}

function getTeamByPlayer(playerNum) {
    return playerNum === 1 ? 'A' : 'B';
}

function getEnemyTeam(team) {
    return team === 'A' ? 'B' : 'A';
}

function getFlagByTeam(team) {
    return ctfFlags.find((flag) => flag.flagTeam === team);
}

function isPlayerInOwnBase(fighter, playerNum) {
    if (!fighter || !fighter.currentPlatform) return false;
    if (fighter.currentPlatform.triggerType !== 'CTF_BASE') return false;
    return fighter.currentPlatform.baseTeam === getTeamByPlayer(playerNum);
}

function isPlayerCarryingFlag(playerNum) {
    return ctfFlags.some((flag) => flag.carriedBy === playerNum);
}

function syncStoreFlagCarrier(playerNum, isCarrier) {
    store.getState().setFlagCarrier(playerNum, isCarrier);
}

function resetFlagToBase(flagTeam) {
    const flag = getFlagByTeam(flagTeam);
    if (!flag) return;

    const previousCarrier = flag.carriedBy;
    flag.carriedBy = null;
    flag.isDropped = false;
    flag.disableFloat = false;
    flag.position.x = flag.basePosition.x;
    flag.position.y = flag.basePosition.y;
    flag.baseY = flag.basePosition.y;

    if (previousCarrier === 1 || previousCarrier === 2) {
        syncStoreFlagCarrier(previousCarrier, false);
    }
}

function assignFlagCarrier(flagTeam, playerNum) {
    const flag = getFlagByTeam(flagTeam);
    if (!flag) return;

    if (flag.carriedBy === playerNum) return;
    if (flag.carriedBy === 1 || flag.carriedBy === 2) {
        syncStoreFlagCarrier(flag.carriedBy, false);
    }

    flag.carriedBy = playerNum;
    flag.isDropped = false;
    flag.disableFloat = true;
    syncStoreFlagCarrier(playerNum, true);
}

function dropPlayerFlag(playerNum, isMultiplayer = false, options = {}) {
    const carriedFlag = ctfFlags.find((flag) => flag.carriedBy === playerNum);
    if (!carriedFlag) return;

    const forceBaseReturn = !!options.forceBaseReturn;
    const dropPosition = options.dropPosition;

    if (forceBaseReturn) {
        resetFlagToBase(carriedFlag.flagTeam);
        if (isMultiplayer) {
            playroomRPC.call('ctf_flag_reset', { flagTeam: carriedFlag.flagTeam }, playroomRPC.Mode.OTHERS);
        }
        return;
    }

    const previousCarrier = carriedFlag.carriedBy;
    carriedFlag.carriedBy = null;
    carriedFlag.isDropped = true;
    carriedFlag.disableFloat = true;
    carriedFlag.position.x = dropPosition?.x ?? carriedFlag.position.x;
    carriedFlag.position.y = dropPosition?.y ?? carriedFlag.position.y;
    carriedFlag.baseY = carriedFlag.position.y;

    if (previousCarrier === 1 || previousCarrier === 2) {
        syncStoreFlagCarrier(previousCarrier, false);
    }

    if (isMultiplayer) {
        playroomRPC.call('ctf_flag_drop', {
            flagTeam: carriedFlag.flagTeam,
            x: carriedFlag.position.x,
            y: carriedFlag.position.y,
        }, playroomRPC.Mode.OTHERS);
    }
}

function tryCaptureFlagAtBase(fighter, playerNum, currentStore, isMultiplayer) {
    if (!fighter.currentPlatform || fighter.currentPlatform.triggerType !== 'CTF_BASE') return;

    const ownTeam = getTeamByPlayer(playerNum);
    if (fighter.currentPlatform.baseTeam !== ownTeam) return;

    const enemyFlagTeam = getEnemyTeam(ownTeam);
    const enemyFlag = getFlagByTeam(enemyFlagTeam);
    if (!enemyFlag || enemyFlag.carriedBy !== playerNum) return;

    const ownFlag = getFlagByTeam(ownTeam);
    if (!ownFlag) return;
    if (ownFlag.carriedBy !== null) return;
    if (ownFlag.isDropped) return;

    currentStore.addScore(playerNum);
    resetFlagToBase(enemyFlagTeam);

    if (isMultiplayer) {
        const s = store.getState();
        playroomRPC.call('ctf_score', {
            scorer: playerNum,
            player1Score: s.player1Score,
            player2Score: s.player2Score,
            capturedFlagTeam: enemyFlagTeam,
        }, playroomRPC.Mode.OTHERS);
    }
}

function drawFlagCarrierLabel(fighter, playerNum) {
    if (!fighter || !isPlayerCarryingFlag(playerNum)) return;

    c.save();
    c.fillStyle = '#ffcc00';
    c.strokeStyle = '#000000';
    c.lineWidth = 2;
    c.font = '11px "Press Start 2P", monospace';

    const labelX = fighter.position.x + fighter.width / 2 - 32;
    const labelY = fighter.position.y - 24;

    c.strokeText('FLAG', labelX, labelY);
    c.fillText('FLAG', labelX, labelY);
    c.restore();
}

function getDefaultRespawnPoint(playerNum) {
    const startKey = playerNum === 1 ? 'player' : 'enemy';
    const fallbackX = playerNum === 1 ? 150 : 800;
    const safeX = currentLevelConfig && currentLevelConfig.startPositions
        ? currentLevelConfig.startPositions[startKey].x
        : fallbackX;

    return { x: safeX, y: -150 };
}

function getControlledSingleplayerRespawnPoint(defender, playerNum, state) {
    const hasSpawnZones = !!(
        currentLevelConfig &&
        Array.isArray(currentLevelConfig.spawnZones) &&
        currentLevelConfig.spawnZones.length > 0
    );
    const isSingleplayerArcade = !state.isMultiplayer && state.gameMode === 'ARCADE';

    if (!hasSpawnZones || !isSingleplayerArcade) return null;

    const actorRole = playerNum === 1 ? 'player' : 'enemy';
    const edgeMargin = 80;
    const innerMargin = 24;
    const defenderWidth = typeof defender?.width === 'number' ? defender.width : 50;
    const defenderHeight = typeof defender?.height === 'number' ? defender.height : 120;
    const worldWidth = typeof currentLevelConfig.worldWidth === 'number'
        ? currentLevelConfig.worldWidth
        : (canvas ? canvas.width : 1024);
    const worldHeight = typeof currentLevelConfig.worldHeight === 'number'
        ? currentLevelConfig.worldHeight
        : (canvas ? canvas.height : 576);

    const candidateZones = currentLevelConfig.spawnZones
        .filter((zone) => {
            if (!zone || typeof zone.x !== 'number' || typeof zone.width !== 'number') return false;
            if (zone.width <= 0) return false;

            if (Array.isArray(zone.players) && zone.players.length > 0) {
                return zone.players.includes(actorRole) || zone.players.includes('both');
            }

            return true;
        })
        .map((zone) => {
            const paddingX = typeof zone.paddingX === 'number' ? zone.paddingX : innerMargin;
            const localMinX = zone.x + paddingX;
            const localMaxX = zone.x + zone.width - paddingX - defenderWidth;

            const minX = Math.max(edgeMargin, localMinX);
            const maxX = Math.min(worldWidth - defenderWidth - edgeMargin, localMaxX);

            if (!Number.isFinite(minX) || !Number.isFinite(maxX) || minX > maxX) {
                return null;
            }

            return {
                ...zone,
                minX,
                maxX,
                centerX: zone.x + zone.width / 2,
            };
        })
        .filter(Boolean);

    if (!candidateZones.length) return null;

    const referenceX = typeof defender?.position?.x === 'number'
        ? defender.position.x
        : candidateZones[0].centerX;

    const chosenZone = candidateZones.reduce((best, zone) => {
        if (!best) return zone;
        const bestDistance = Math.abs(best.centerX - referenceX);
        const nextDistance = Math.abs(zone.centerX - referenceX);
        return nextDistance < bestDistance ? zone : best;
    }, null);

    if (!chosenZone) return null;

    const randomX = chosenZone.minX + Math.random() * (chosenZone.maxX - chosenZone.minX);
    let spawnX = Math.round(randomX);
    spawnX = Math.max(0, Math.min(worldWidth - defenderWidth, spawnX));

    const zoneY = typeof chosenZone.y === 'number' ? chosenZone.y : 260;
    let spawnY = typeof chosenZone.spawnY === 'number'
        ? chosenZone.spawnY
        : Math.round(zoneY - Math.max(120, defenderHeight + 30));

    if (typeof currentLevelConfig.deathZoneY === 'number') {
        const maxAllowedByDeathZone = currentLevelConfig.deathZoneY - defenderHeight - 40;
        spawnY = Math.min(spawnY, maxAllowedByDeathZone);
    }

    const minAllowedY = -Math.max(220, Math.round(worldHeight * 0.5));
    const maxAllowedY = Math.max(-40, worldHeight - defenderHeight - 60);
    spawnY = Math.max(minAllowedY, Math.min(maxAllowedY, Math.round(spawnY)));

    return { x: spawnX, y: spawnY };
}

function getRespawnPoint(defender, playerNum, state) {
    return getControlledSingleplayerRespawnPoint(defender, playerNum, state) || getDefaultRespawnPoint(playerNum);
}

function handleDeathCheck(defender, playerNum) {
    if (defender.health <= 0) {
        const state = store.getState();

        if (state.matchType === 'CTF') {
            const diedInDeathZone = !!(currentLevelConfig && typeof currentLevelConfig.deathZoneY === 'number' && defender.position.y > currentLevelConfig.deathZoneY);
            const dropX = defender.position.x + Math.max(0, (defender.width - 28) / 2);
            const dropY = defender.position.y - 20;
            dropPlayerFlag(playerNum, state.isMultiplayer, {
                forceBaseReturn: diedInDeathZone,
                dropPosition: { x: dropX, y: dropY },
            });
            const respawnPoint = getRespawnPoint(defender, playerNum, state);
            defender.respawn(respawnPoint.x, respawnPoint.y);
            state.updateHealth(playerNum, 100);
            state.updateStamina(playerNum, 100);
            return;
        }

        const pStocks = playerNum === 1 ? state.player1Stocks : state.player2Stocks;
        
        if (pStocks > 1) {
            state.loseStock(playerNum);
            const respawnPoint = getRespawnPoint(defender, playerNum, state);
            defender.respawn(respawnPoint.x, respawnPoint.y);
            state.updateHealth(playerNum, 100);
        } else {
            state.loseStock(playerNum);
            endGame();
        }
    }
}

function calculateHit(attacker, defender, playerNum, damageOverride = null) {
    const finalDamage = damageOverride !== null ? damageOverride : attacker.damage;
    defender.takeHit(finalDamage);
    store.getState().updateHealth(playerNum, defender.health);
    handleDeathCheck(defender, playerNum);
}

function applyPickup(fighter, playerNum, type, currentStore) {
    if (type === 'HEAL') {
        fighter.health = Math.min(100, fighter.health + 30);
        currentStore.updateHealth(playerNum, fighter.health);
    } else if (type === 'STAMINA') {
        fighter.stamina = Math.min(100, fighter.stamina + 50);
        currentStore.updateStamina(playerNum, fighter.stamina);
    } else if (type === 'STOCK') {
        if (playerNum === 1) currentStore.addStock(1);
        else currentStore.addStock(2);
    }
}

function canCollectPickup(fighter, playerNum, type, currentStore) {
    if (type === 'STOCK' && currentStore.matchType === 'CTF') return false;
    if (type === 'HEAL') return fighter.health < 100;
    if (type === 'STAMINA') return fighter.stamina < 100;
    if (type === 'STOCK') {
        const currentStocks = playerNum === 1 ? currentStore.player1Stocks : currentStore.player2Stocks;
        return currentStocks < 3;
    }
    return true;
}

function fighterTouchesObject(fighter, object) {
    return (
        fighter.position.x + fighter.width >= object.position.x &&
        fighter.position.x <= object.position.x + object.width &&
        fighter.position.y + fighter.height >= object.position.y &&
        fighter.position.y <= object.position.y + object.height
    );
}

function canPickupFlag(fighter, playerNum, pickup) {
    if (!pickup.isFlag || pickup.carriedBy) return false;
    const ownTeam = getTeamByPlayer(playerNum);
    if (pickup.flagTeam === ownTeam) return !!pickup.isDropped;
    if (isPlayerInOwnBase(fighter, playerNum)) return false;
    if (isPlayerCarryingFlag(playerNum)) return false;
    return true;
}

function updatePickupSpawns(isMultiplayer, isHost) {
    if (isMultiplayer && !isHost) return; // Only host handles respawn timer and rolls

    const now = Date.now();
    pickupSpawnsState.forEach(spawn => {
        if (!spawn.active && now >= spawn.nextSpawnTime) {
            spawn.active = true;
            const types = store.getState().matchType === 'CTF'
                ? ['HEAL', 'STAMINA']
                : ['HEAL', 'STAMINA', 'STOCK'];
            const randomType = types[Math.floor(Math.random() * types.length)];
            
            const p = new Pickup({ position: { x: spawn.x, y: spawn.y }, type: randomType });
            p.spawnId = spawn.id;
            pickups.push(p);
            
            if (isMultiplayer && isHost) {
                playroomRPC.call('pickup_spawn', { spawnId: spawn.id, x: spawn.x, y: spawn.y, type: randomType }, playroomRPC.Mode.OTHERS);
            }
        }
    });
}

function markPickupConsumed(spawnId) {
    const sp = pickupSpawnsState.find(s => s.id === spawnId);
    if (sp) {
        sp.active = false;
        // Respawn "najszybciej to minuta" -> od 60s do 90s
        sp.nextSpawnTime = Date.now() + 60000 + Math.random() * 30000;
    }
}

function handleTriggers(fighter, playerNum, currentStore, isMultiplayer) {
    if (fighter.currentPlatform && fighter.currentPlatform.isTrigger) {
        trackKothZoneControl(fighter, playerNum, currentStore);

        if (!fighter.triggerTimer) fighter.triggerTimer = 0;
        
        if (fighter.lastPlatform !== fighter.currentPlatform) {
            fighter.triggerTimer = 0;
        }

        fighter.triggerTimer++;
        fighter.lastPlatform = fighter.currentPlatform;

        const reqFrames = fighter.currentPlatform.triggerRequiredFrames || 60;
        
        if (fighter.triggerTimer % reqFrames === 0) {
            if (currentStore.getState().matchType === 'CTF' && fighter.currentPlatform.triggerType === 'CTF_BASE') {
                tryCaptureFlagAtBase(fighter, playerNum, currentStore.getState(), isMultiplayer);
            }
            if (typeof fighter.currentPlatform.onStep === 'function') {
                fighter.currentPlatform.onStep(fighter, playerNum, currentStore);
            }
        }
    } else {
        fighter.triggerTimer = 0;
        fighter.lastPlatform = null;
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
            clearMusicSyncInterval();
            store.getState().setIsPaused(false);
            currentLevelConfig = null;
            ctfFlags = [];
            currentMatchType = 'STOCK';
            currentAIMapProfile = null;
            currentMapIntelligence = null;
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
    if (globalTimerId) clearTimeout(globalTimerId);
    if (networkSyncId) clearInterval(networkSyncId);
    clearMusicSyncInterval();
    store.getState().setIsPaused(false);
    
    pickups = [];
    pickupSpawnsState = [];
    ctfFlags = [];

    // Initialize Level
    const levelId = state.selectedLevel || DEFAULT_LEVEL;
    const baseConfig = LEVELS[levelId] || LEVELS[DEFAULT_LEVEL];
    currentAIMapProfile = getAIMapProfile(levelId, baseConfig);
    currentMatchType = baseConfig.mode === 'CTF' ? 'CTF' : 'STOCK';
    globalTimer = currentMatchType === 'CTF' ? (baseConfig.matchDuration || 300) : 60;

    if (!state.isMultiplayer) {
        // Fallback dla trybów lokalnych, gdy widok nie przełącza się ponownie na GAME.
        globalAudioManager.playCategory('battle');
    }

    store.getState().resetGame();
    store.getState().setMatchType(currentMatchType);
    store.getState().setTimer(globalTimer);
    store.getState().setTimeRemaining(globalTimer);
    store.getState().setFlagCarrier(1, false);
    store.getState().setFlagCarrier(2, false);
    
    currentLevelConfig = { ...baseConfig };
    if (baseConfig.platforms) {
        currentLevelConfig.platforms = baseConfig.platforms.map((p, idx) => {
            const platformId = p.id || `platform-${idx}`;
            if (p.waypoints && p.waypoints.length > 0) {
                const dynamicPlatform = new DynamicPlatform({
                    position: { x: p.x, y: p.y },
                    width: p.width,
                    height: p.height,
                    texture: p.texture,
                    texX: p.texX,
                    texY: p.texY,
                    waypoints: p.waypoints,
                    speed: p.speed || 2
                });
                dynamicPlatform.platformId = platformId;
                dynamicPlatform.id = platformId;
                return dynamicPlatform;
            }
            return { ...p, platformId, id: platformId }; // Plain platforms
        });
    }

    currentMapIntelligence = buildMapIntelligence(levelId, currentLevelConfig);

    if (currentLevelConfig.pickupSpawns) {
        currentLevelConfig.pickupSpawns.forEach((spawn, idx) => {
            pickupSpawnsState.push({
                id: idx,
                x: spawn.x,
                y: spawn.y,
                active: true,
                nextSpawnTime: 0
            });
            const p = new Pickup({ position: { x: spawn.x, y: spawn.y }, type: spawn.defaultType || 'HEAL' });
            p.spawnId = idx;
            pickups.push(p);
        });
    }

    if (currentMatchType === 'CTF' && currentLevelConfig.flags) {
        currentLevelConfig.flags.forEach((flagCfg) => {
            const flag = new Pickup({
                position: { x: flagCfg.x, y: flagCfg.y },
                type: `FLAG_${flagCfg.team}`,
            });
            flag.isFlag = true;
            flag.flagTeam = flagCfg.team;
            flag.basePosition = { x: flagCfg.x, y: flagCfg.y };
            flag.carriedBy = null;
            flag.isDropped = false;
            flag.width = 28;
            flag.height = 36;
            pickups.push(flag);
            ctfFlags.push(flag);
        });
    }

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
        player = new NetworkFighter(getFighterConfig(ROSTER[p1Choice], currentLevelConfig.startPositions.player, { isRemote: !isHost, jumpPower: PLAYER_JUMP_POWER }));
        enemy = new NetworkFighter(getFighterConfig(ROSTER[p2Choice], currentLevelConfig.startPositions.enemy, { isRemote: isHost, colorFilter: enemyFilterStyle, jumpPower: PLAYER_JUMP_POWER }));
        
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
                    handleDeathCheck(player, 1);
                } else if (data.target === 2 && enemy) {
                    enemy.takeHit(data.damage);
                    store.getState().updateHealth(2, enemy.health);
                    handleDeathCheck(enemy, 2);
                }
            });

            playroomRPC.register('pickup_spawn', (data) => {
                if (!isHost) {
                    const pickup = new Pickup({
                        position: { x: data.x, y: data.y },
                        type: data.type,
                    });
                    pickup.spawnId = data.spawnId;
                    pickups.push(pickup);
                    
                    const sp = pickupSpawnsState.find(s => s.id === data.spawnId);
                    if (sp) sp.active = true;
                }
            });

            playroomRPC.register('pickup_consumed', (data) => {
                const pickupIndex = pickups.findIndex(p => p.spawnId === data.spawnId);
                if (pickupIndex !== -1) {
                    pickups.splice(pickupIndex, 1);
                }
                const targetFighter = data.target === 1 ? player : enemy;
                if (targetFighter) {
                    applyPickup(targetFighter, data.target, data.type, store.getState());
                    markPickupConsumed(data.spawnId);
                }
            });

            playroomRPC.register('ctf_flag_pick', (data) => {
                if (currentMatchType !== 'CTF') return;
                assignFlagCarrier(data.flagTeam, data.carrier);
            });

            playroomRPC.register('ctf_flag_reset', (data) => {
                if (currentMatchType !== 'CTF') return;
                resetFlagToBase(data.flagTeam);
            });

            playroomRPC.register('ctf_flag_drop', (data) => {
                if (currentMatchType !== 'CTF') return;
                const flag = getFlagByTeam(data.flagTeam);
                if (!flag) return;

                const previousCarrier = flag.carriedBy;
                flag.carriedBy = null;
                flag.isDropped = true;
                flag.disableFloat = true;
                flag.position.x = data.x;
                flag.position.y = data.y;
                flag.baseY = data.y;

                if (previousCarrier === 1 || previousCarrier === 2) {
                    syncStoreFlagCarrier(previousCarrier, false);
                }
            });

            playroomRPC.register('ctf_score', (data) => {
                if (currentMatchType !== 'CTF') return;
                if (typeof data.player1Score === 'number') store.getState().setScore(1, data.player1Score);
                if (typeof data.player2Score === 'number') store.getState().setScore(2, data.player2Score);
                if (data.capturedFlagTeam) resetFlagToBase(data.capturedFlagTeam);
            });
            
            playroomRPC.register('rematch', () => {
                store.getState().triggerRematch();
            });
            
            playroomRPC.register('main_menu', () => {
                store.getState().setMultiplayer(false);
                store.getState().resetGame();
                window.location.href = window.location.pathname; // czysty URL by uniknąć zapętleń Playroom 
            });

            playroomRPC.register('music_sync', (data) => {
                const currentState = store ? store.getState() : null;
                if (!currentState || currentState.view !== 'GAME' || !currentState.isMultiplayer) return;
                if (!data || !data.trackName) return;

                const seekTime = Number.isFinite(data.currentTime) ? data.currentTime : 0;
                globalAudioManager.play(data.trackName, { seekTime });
            });

            playroomRPC.register('music_sync_request', () => {
                const currentState = store ? store.getState() : null;
                if (!currentState || !currentState.isHost || currentState.view !== 'GAME') return;
                broadcastHostMusicState();
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

        startMultiplayerMusicSync();
        
        networkSyncId = setInterval(() => {
            // 1. Nadawanie stanu lokalnego fightera
            const localFighter = isHost ? player : enemy;
            if (localFighter && !isRoundOver) {
                const s = store.getState();
                const networkState = localFighter.getState();
                networkState.stocks = isHost ? s.player1Stocks : s.player2Stocks;
                getMyPlayer().setState('fighterState', networkState, false); // Send with reliable: false
            }
            
            // 2. Odbieranie i aktualizacja z serwera dla drugiego gracza
            remotePlayers.forEach(p => {
                const state = p.getState('fighterState');
                if (state) {
                    if (isHost && enemy) {
                        enemy.receiveState(state);
                        // Korekta na wypadek błędu/rozjazdu po stronie UI
                        const s = store.getState();
                        if (s.enemyHealth !== enemy.health) {
                            s.updateHealth(2, enemy.health);
                        }
                        if (typeof state.stamina === 'number' && Math.floor(s.player2Stamina) !== Math.floor(state.stamina)) {
                            s.updateStamina(2, state.stamina);
                        }
                        // Synchronizacja zapasowych żyć dla klienta
                        if (typeof state.stocks === 'number' && s.player2Stocks !== state.stocks) {
                            // Preferujemy ilość żyć wskazywaną przez właściciela (autora stanu)
                            if (s.player2Stocks > state.stocks) s.setStocks(2, state.stocks);
                        }
                    }
                    if (!isHost && player) {
                        player.receiveState(state);
                        // Korekta na wypadek błędu/rozjazdu po stronie UI
                        const s = store.getState();
                        if (s.playerHealth !== player.health) {
                            s.updateHealth(1, player.health);
                        }
                        if (typeof state.stamina === 'number' && Math.floor(s.player1Stamina) !== Math.floor(state.stamina)) {
                            s.updateStamina(1, state.stamina);
                        }
                        // Synchronizacja zapasowych żyć dla hosta
                        if (typeof state.stocks === 'number' && s.player1Stocks !== state.stocks) {
                            // Preferujemy ilość żyć wskazywaną przez właściciela (autora stanu)
                            if (s.player1Stocks > state.stocks) s.setStocks(1, state.stocks);
                        }
                    }
                }
            });
        }, 1000 / 30);
    } else {
        player = new Fighter(getFighterConfig(ROSTER[p1Choice], currentLevelConfig.startPositions.player, { jumpPower: PLAYER_JUMP_POWER }));
        
        if (state.gameMode === 'ARCADE') {
            const difficultyCfg = getAIDifficultyConfig(state.aiDifficulty);
            enemy = new Enemy(getFighterConfig(ROSTER[p2Choice], currentLevelConfig.startPositions.enemy, {
                reactionTime: difficultyCfg.reactionTime,
                attackChance: difficultyCfg.attackChance,
                heavyAttackChance: difficultyCfg.heavyAttackChance,
                dodgeReactChance: difficultyCfg.dodgeReactChance,
                retreatHealthThreshold: difficultyCfg.retreatHealthThreshold,
                defensiveHealthThreshold: difficultyCfg.defensiveHealthThreshold,
                objectiveCommitment: difficultyCfg.objectiveCommitment,
                pressureRange: difficultyCfg.pressureRange,
                visionRange: difficultyCfg.visionRange,
                edgeProbeStep: difficultyCfg.edgeProbeStep,
                maxSafeDrop: difficultyCfg.maxSafeDrop,
                jumpPower: PLAYER_JUMP_POWER,
                aiDifficulty: difficultyCfg.key,
                aiMapProfile: currentAIMapProfile,
                mapIntelligence: currentMapIntelligence,
                colorFilter: enemyFilterStyle,
                team: 'B',
            }));
        } else {
            enemy = new Fighter(getFighterConfig(ROSTER[p2Choice], currentLevelConfig.startPositions.enemy, { colorFilter: enemyFilterStyle, jumpPower: PLAYER_JUMP_POWER }));
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
    const isPaused = !!(state && state.isPaused);
    const shouldFreezeSimulation = !!(state && isPaused && !state.isMultiplayer);
    
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
        const shouldRenderShop = !currentLevelConfig || currentLevelConfig.showShop !== false;
        if (shouldRenderShop) {
            if (currentLevelConfig && currentLevelConfig.shopPosition && shop.image.complete) {
                shop.position.x = currentLevelConfig.shopPosition.x;
                shop.position.y = currentLevelConfig.shopPosition.y - (shop.image.height * shop.scale);
            } else if (!currentLevelConfig) {
                // fall back to default behavior for main menu
                shop.position.x = shop.basePosition.x;
            }
            shop.update(c);
        }
    }
    
    // Rysowanie platform (wraz z obsługą wycinków tekstur z tła)
    if (currentLevelConfig && currentLevelConfig.platforms) {
        for (let p of currentLevelConfig.platforms) {
            if (p.update && !shouldFreezeSimulation) p.update();
            
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

    if (state && state.view === 'GAME' && shouldFreezeSimulation && player && enemy) {
        player.draw(c);
        enemy.draw(c);

        for (const pickup of pickups) {
            pickup.update(c);
        }

        if (state.matchType === 'CTF') {
            drawFlagCarrierLabel(player, 1);
            drawFlagCarrierLabel(enemy, 2);
        }

        c.restore();
        c.fillStyle = 'rgba(255, 255, 255, 0.5)';
        c.font = '10px "Press Start 2P", monospace';
        c.fillText('v' + (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0.0'), 10, canvas.height - 10);
        return;
    }

    if (state && state.view === 'GAME' && player && enemy) {
        player.update(c, currentLevelConfig, GRAVITY);
        enemy.update(c, currentLevelConfig, GRAVITY);

        // Sync stamina to store (throttled to integer changes for performance)
        const currentStoreState = store.getState();
        if (player.stamina !== undefined && Math.floor(currentStoreState.player1Stamina) !== Math.floor(player.stamina)) {
            currentStoreState.updateStamina(1, player.stamina);
        }
        if (enemy.stamina !== undefined && Math.floor(currentStoreState.player2Stamina) !== Math.floor(enemy.stamina)) {
            currentStoreState.updateStamina(2, enemy.stamina);
        }

        player.stopHorizontal();
        enemy.stopHorizontal();

        const isMultiplayer = state.isMultiplayer;
        const isHost = state.isHost;
        const isP1Local = !isMultiplayer || isHost;
        const isP2Local = !isMultiplayer || !isHost;

        if (isP1Local) handleTriggers(player, 1, store, isMultiplayer);
        if (isP2Local) handleTriggers(enemy, 2, store, isMultiplayer);

        // Pickups logic
        updatePickupSpawns(isMultiplayer, isHost);
        const currentStoreStateObj = store.getState();
        for (let i = pickups.length - 1; i >= 0; i--) {
            let p = pickups[i];

            if (p.isFlag && p.carriedBy) {
                const carrier = p.carriedBy === 1 ? player : enemy;
                if (carrier) {
                    p.disableFloat = true;
                    p.isDropped = false;
                    p.position.x = carrier.position.x + (carrier.width - p.width) / 2;
                    p.position.y = carrier.position.y - 44;
                    p.baseY = p.position.y;
                } else {
                    resetFlagToBase(p.flagTeam);
                }
            } else if (p.isFlag) {
                p.disableFloat = !!p.isDropped;
                p.baseY = p.isDropped ? p.position.y : p.basePosition.y;
            }

            p.update(c);
            
            // Kolizja tylko w locie / w grze jeśli runda trwa.
            if (!isRoundOver) {
                if (p.isFlag) {
                    if (isP1Local && fighterTouchesObject(player, p) && canPickupFlag(player, 1, p)) {
                        if (p.flagTeam === getTeamByPlayer(1)) {
                            resetFlagToBase(p.flagTeam);
                            if (isMultiplayer) {
                                playroomRPC.call('ctf_flag_reset', { flagTeam: p.flagTeam }, playroomRPC.Mode.OTHERS);
                            }
                        } else {
                            assignFlagCarrier(p.flagTeam, 1);
                            if (isMultiplayer) {
                                playroomRPC.call('ctf_flag_pick', { flagTeam: p.flagTeam, carrier: 1 }, playroomRPC.Mode.OTHERS);
                            }
                        }
                    } else if (isP2Local && fighterTouchesObject(enemy, p) && canPickupFlag(enemy, 2, p)) {
                        if (p.flagTeam === getTeamByPlayer(2)) {
                            resetFlagToBase(p.flagTeam);
                            if (isMultiplayer) {
                                playroomRPC.call('ctf_flag_reset', { flagTeam: p.flagTeam }, playroomRPC.Mode.OTHERS);
                            }
                        } else {
                            assignFlagCarrier(p.flagTeam, 2);
                            if (isMultiplayer) {
                                playroomRPC.call('ctf_flag_pick', { flagTeam: p.flagTeam, carrier: 2 }, playroomRPC.Mode.OTHERS);
                            }
                        }
                    }
                    continue;
                }

                if (isP1Local && fighterTouchesObject(player, p) && canCollectPickup(player, 1, p.type, currentStoreStateObj)) {
                    applyPickup(player, 1, p.type, currentStoreStateObj);
                    markPickupConsumed(p.spawnId);
                    pickups.splice(i, 1);
                    if (isMultiplayer) playroomRPC.call('pickup_consumed', { spawnId: p.spawnId, index: i, type: p.type, target: 1 }, playroomRPC.Mode.OTHERS);
                    continue;
                } else if (isP2Local && fighterTouchesObject(enemy, p) && canCollectPickup(enemy, 2, p.type, currentStoreStateObj)) {
                    applyPickup(enemy, 2, p.type, currentStoreStateObj);
                    markPickupConsumed(p.spawnId);
                    pickups.splice(i, 1);
                    if (isMultiplayer) playroomRPC.call('pickup_consumed', { spawnId: p.spawnId, index: i, type: p.type, target: 2 }, playroomRPC.Mode.OTHERS);
                    continue;
                }
            }
        }

        if (currentStoreStateObj.matchType === 'CTF') {
            drawFlagCarrierLabel(player, 1);
            drawFlagCarrierLabel(enemy, 2);
        }

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
                    enemy.updateAI([player], currentLevelConfig.platforms, {
                        matchType: currentStoreStateObj.matchType,
                        ctfFlags,
                        ownTeam: 'B',
                        enemyTeam: 'A',
                        levelId: currentLevelConfig.id,
                        levelMode: currentLevelConfig.mode || 'STOCK',
                        mapProfile: currentAIMapProfile,
                        mapIntelligence: currentMapIntelligence,
                        aiDifficulty: currentStoreStateObj.aiDifficulty,
                        timeRemaining: currentStoreStateObj.timeRemaining,
                        player1CarriesFlag: currentStoreStateObj.player1CarriesFlag,
                        player2CarriesFlag: currentStoreStateObj.player2CarriesFlag,
                    });
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
            const pIsAttackingAnim = player.sprites && ((player.sprites.attack && player.image === player.sprites.attack.image) || (player.sprites.heavyAttack && player.image === player.sprites.heavyAttack.image));
            const eIsAttackingAnim = enemy.sprites && ((enemy.sprites.attack && enemy.image === enemy.sprites.attack.image) || (enemy.sprites.heavyAttack && enemy.image === enemy.sprites.heavyAttack.image));

            const pAttackMax = pIsAttackingAnim ? player.frameMax : ((player.sprites && player.sprites.attack && player.sprites.attack.frameMax) || player.frameMax);
            const eAttackMax = eIsAttackingAnim ? enemy.frameMax : ((enemy.sprites && enemy.sprites.attack && enemy.sprites.attack.frameMax) || enemy.frameMax);
            
            if (rectangularCollision({ rectangle1: player, rectangle2: enemy }) &&
                player.isAttacking && pIsAttackingAnim && player.framesCurrent === Math.floor(pAttackMax / 2)) {
                player.isAttacking = false;
                if (!isMultiplayer || isP1Local) {
                    const dmg = player.isHeavyAttack ? player.damage * 2 : player.damage;
                    calculateHit(player, enemy, 2, dmg);
                    if (isMultiplayer) playroomRPC.call('hit', { target: 2, damage: dmg }, playroomRPC.Mode.OTHERS);
                }
            }
            if (player.isAttacking && player.framesCurrent === pAttackMax - 1) player.isAttacking = false;

            if (rectangularCollision({ rectangle1: enemy, rectangle2: player }) &&
                enemy.isAttacking && eIsAttackingAnim && enemy.framesCurrent === Math.floor(eAttackMax / 2)) {
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
    clearMusicSyncInterval();
}

function handleKeyDown(event) {
    if (event.key === 'Escape') {
        const currentState = store ? store.getState() : null;
        if (!currentState || currentState.view !== 'GAME' || currentState.winner) return;

        const nextPaused = !currentState.isPaused;
        currentState.setIsPaused(nextPaused);

        if (nextPaused) {
            Object.values(keys).forEach((keyState) => {
                keyState.pressed = false;
            });
            if (player) player.stopHorizontal();
            if (enemy) enemy.stopHorizontal();
        }
        return;
    }

    if (event.repeat) return; // Zapobiega powielaniu komend przez przytrzymany klawisz (tzw. spam systemowy)
    if (!player || !enemy || isRoundOver) return;
    const state = store.getState();
    if (state.isPaused) return;
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
    if (event.key === 'Escape') return;
    if (state && state.isPaused) return;
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
