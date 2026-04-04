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
    shopPosition: { x: 1050, y: 831 },
    platforms: [
        { x: 468, y: 821, width: 627, height: 96, texture: 'game-floor', texX: 500, texY: 832 }, // Main big floor with texture
        { x: 1095, y: 821, width: 627, height: 96, texture: 'game-floor', texX: 500, texY: 832 },
        // { x: 1200, y: 832, width: 500, height: 96 }, // Main big floor
        { x: 150, y: 650, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832 },  // Left plat
        { x: 1400, y: 650, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832 }, // Right plat
        { x: 850, y: 515, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832 },  // High center
    ]
};
