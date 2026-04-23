import { START_POSITIONS, LARGE_MAP_WIDTH_THRESHOLD, SPAWN_RADIUS_DEFAULT, SPAWN_RADIUS_LARGE_MAP, SPAWN_RADIUS_SINGLEPLAYER } from './constants.js';

export let timer = 60;
let timerId = null;

export function whoWins(player, enemy) {
    if (timerId) { clearTimeout(timerId); timerId = null; }
    if (player.health === enemy.health) return 'Tie';
    if (player.health > enemy.health) return 'Player 1 Wins';
    return 'Player 2 Wins';
}

export function determineWinner({ player, enemy, timerId: existingTimerId, winModal }) {
    if (existingTimerId) clearTimeout(existingTimerId);
    if (timerId) {
        clearTimeout(timerId);
        timerId = null;
    }
    
    let message = 'Tie';
    if (player.health === enemy.health) {
        message = 'Tie';
    } else if (player.health > enemy.health) {
        message = 'Player 1 Wins';
    } else if (player.health < enemy.health) {
        message = 'Player 2 Wins';
    }

    if (winModal) {
        winModal.show(message);
    }
    return message;
}

export function decrementTimer(onEnd, onTick) {
    if (timer > 0) {
        if (timerId) { clearTimeout(timerId); timerId = null; }
        timerId = setTimeout(() => {
            timer--;
            if (typeof onTick === 'function') onTick(timer);
            decrementTimer(onEnd, onTick);
        }, 1000);
    } else if (timer === 0 && typeof onEnd === 'function') {
        onEnd();
    }
}

export function jump(player) {
    if (player.velocity.y === 0) {
        player.velocity.y = -15;
    }
}

export function restartGame(player, enemy, onTick, onEnd) {
    if (timerId) { clearTimeout(timerId); timerId = null; }
    timer = 60;
    
    if (typeof onTick === 'function') onTick(timer);
    
    decrementTimer(onEnd || (() => {}), onTick);

    if (player && typeof player.restart === 'function') player.restart(START_POSITIONS.player);
    if (enemy && typeof enemy.restart === 'function') enemy.restart(START_POSITIONS.enemy);
}

/**
 * Zwraca bezpieczną pozycję X do respawnu opierając się o konfigurację mapy,
 * ostatnią pozycję zgonu oraz tryb gry.
 * mapConfig: obiekt poziomu (may contain worldWidth)
 * lastX: ostatnia pozycja X gracza przy zgonie
 * mode: string, np. 'ARCADE' (singleplayer) lub inne
 */
export function getSafeRespawnX(mapConfig, lastX = 0, mode = 'MULTIPLAYER') {
    const worldWidth = mapConfig && mapConfig.worldWidth ? mapConfig.worldWidth : null;
    let radius = SPAWN_RADIUS_DEFAULT;

    if (worldWidth && worldWidth >= LARGE_MAP_WIDTH_THRESHOLD) {
        radius = SPAWN_RADIUS_LARGE_MAP;
    }

    if (mode === 'ARCADE' || mode === 'SINGLEPLAYER') {
        // singleplayer respawns should be closer to keep player near action
        radius = SPAWN_RADIUS_SINGLEPLAYER;
    }

    // Prefer respawn near lastX but clamp to world boundaries and within radius
    let desiredX = lastX || (mapConfig && mapConfig.startPositions ? mapConfig.startPositions.player.x : START_POSITIONS.player.x);

    if (worldWidth) {
        // Ensure within [radius, worldWidth - radius]
        const minX = Math.max(0, radius);
        const maxX = Math.max(radius, worldWidth - radius);
        // Clamp desiredX first
        desiredX = Math.min(Math.max(desiredX, minX), maxX);
        return desiredX;
    }

    // If no worldWidth, just clamp to reasonable canvas-like widths
    return Math.max(50, Math.min(desiredX, 1000));
}
