export const open_arena = {
    id: 'open_arena',
    name: 'Open Arena (CTF)',
    mode: 'CTF',
    matchDuration: 300,
    background: '/assets/images/background.png',
    music: '/music/background.mp3',
    deathZoneY: 900,
    worldWidth: 2800,
    worldHeight: 1000,
    startPositions: {
        player: { x: 1200, y: 420 },
        enemy: { x: 1550, y: 420 }
    },
    shopPosition: { x: 1410, y: 831 },
    platforms: [
        { x: 300, y: 821, width: 2200, height: 96, texture: 'game-floor', texX: 500, texY: 832 },
        { x: 120, y: 700, width: 260, height: 42, texture: 'game-floor', texX: 500, texY: 832, isTrigger: true, triggerType: 'CTF_BASE', baseTeam: 'A', triggerRequiredFrames: 20 },
        { x: 2420, y: 700, width: 260, height: 42, texture: 'game-floor', texX: 500, texY: 832, isTrigger: true, triggerType: 'CTF_BASE', baseTeam: 'B', triggerRequiredFrames: 20 },
        { x: 740, y: 650, width: 260, height: 38, texture: 'game-floor', texX: 500, texY: 832 },
        { x: 1800, y: 650, width: 260, height: 38, texture: 'game-floor', texX: 500, texY: 832 },
        { x: 1320, y: 560, width: 180, height: 32, texture: 'game-floor', texX: 500, texY: 832 }
    ],
    flags: [
        { team: 'A', x: 210, y: 650 },
        { team: 'B', x: 2520, y: 650 }
    ],
    pickupSpawns: [
        { x: 620, y: 590, defaultType: 'HEAL' },
        { x: 2180, y: 590, defaultType: 'STAMINA' },
        { x: 1410, y: 500, defaultType: 'HEAL' }
    ]
};
