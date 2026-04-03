export const platformer = {
    id: 'platformer',
    name: 'Open Arena',
    background: '/assets/images/background.png',
    music: '/music/background.mp3',
    deathZoneY: 850,
    worldWidth: 2000,
    worldHeight: 1000,
    startPositions: {
        player: { x: 270, y: 400 },
        enemy: { x: 1520, y: 400 }
    },
    shopPosition: { x: 950, y: 831 },
    platforms: [
        { x: 468, y: 831, width: 827, height: 50 }, // Main big floor
        // { x: 1200, y: 831, width: 500, height: 50 }, // Main big floor
        { x: 150, y: 650, width: 300, height: 20 },  // Left plat
        { x: 1400, y: 650, width: 300, height: 20 }, // Right plat
        { x: 850, y: 550, width: 300, height: 20 },  // High center
    ]
};
