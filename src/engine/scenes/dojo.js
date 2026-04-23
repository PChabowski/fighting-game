export const dojo = {
    id: 'dojo',
    name: 'The Dojo',
    background: '/assets/images/background.png',
    music: '/music/background.mp3', // Example, we can change later
    deathZoneY: 850,
    worldWidth: 1024,
    worldHeight: 576,
    startPositions: {
        player: { x: 280, y: 0 },
        enemy: { x: 680, y: 0 }
    },
    shopPosition: { x: 650, y: 480 },
    shopPosition: { x: 250, y: 480 },
    platforms: [
        { x: -500, y: 480, width: 2024, height: 96, texture: 'game-floor' } // Floor texture assigned
    ],
    pickupSpawns: [
        { x: 512, y: 380, defaultType: 'HEAL' }
    ]
};
