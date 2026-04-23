export const open_arena = {
    id: 'open_arena',
    name: 'Open Arena (CTF)',
    mode: 'CTF',
    matchDuration: 300,
    background: '/assets/images/background.png',
    music: '/music/background.mp3',
    deathZoneY: 850,
    worldWidth: 4000,
    worldHeight: 1000,
    showShop: false,
    startPositions: {
        player: { x: 500, y: 400 },
        enemy: { x: 3500, y: 400 }
    },
    platforms: [
        { x: 468, y: 821, width: 627, height: 96, texture: 'game-floor', texX: 500, texY: 832 },
        { x: 1095, y: 650, width: 250, height: 45, texture: 'game-floor', texX: 500, texY: 832, waypoints: [{ x: 1095, y: 650 }, { x: 1475, y: 650 }], speed: 3 },
        { x: 1722, y: 821, width: 627, height: 96, texture: 'game-floor', texX: 500, texY: 832 },
        { x: 2600, y: 800, width: 250, height: 45, texture: 'game-floor', texX: 500, texY: 832, waypoints: [{ x: 2600, y: 800 }, { x: 2600, y: 500 }], speed: 2 },
        { x: 2976, y: 821, width: 627, height: 96, texture: 'game-floor', texX: 500, texY: 832 },
        { x: 150, y: 650, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832, isTrigger: true, triggerType: 'CTF_BASE', baseTeam: 'A', triggerRequiredFrames: 20 },
        { x: 800, y: 515, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832 },
        { x: 1400, y: 650, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832 },
        { 
            x: 2000, y: 515, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832,
            isTrigger: true,
            triggerColor: 'rgba(50, 255, 50, 0.3)',
            triggerRequiredFrames: 60,
            onStep: (fighter, playerNum, store) => {
                if (fighter.health < 100) {
                    fighter.health = Math.min(100, fighter.health + 20);
                    store.getState().updateHealth(playerNum, fighter.health);
                }
            }
        },
        { x: 3200, y: 515, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832 },
        { x: 3600, y: 650, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832, isTrigger: true, triggerType: 'CTF_BASE', baseTeam: 'B', triggerRequiredFrames: 20 }
    ],
    flags: [
        { team: 'A', x: 285, y: 600 },
        { team: 'B', x: 3735, y: 600 }
    ],
    pickupSpawns: [
        { x: 280, y: 550, defaultType: 'HEAL' },
        { x: 930, y: 415, defaultType: 'STAMINA' },
        { x: 2130, y: 415, defaultType: 'HEAL' },
        { x: 3330, y: 415, defaultType: 'HEAL' },
        { x: 3730, y: 550, defaultType: 'STAMINA' }
    ]
};
