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
    spawnZones: [
        { id: 'player-home', x: 180, y: 280, width: 780, height: 280, spawnY: 110, players: ['player'] },
        { id: 'player-mid', x: 1180, y: 240, width: 620, height: 260, spawnY: 90, players: ['player'] },
        { id: 'enemy-mid', x: 2200, y: 240, width: 620, height: 260, spawnY: 90, players: ['enemy'] },
        { id: 'enemy-home', x: 3060, y: 280, width: 780, height: 280, spawnY: 110, players: ['enemy'] }
    ],
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
            triggerType: 'KOTH_ZONE',
            triggerColor: 'rgba(50, 255, 50, 0.3)',
            triggerRequiredFrames: 60
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
