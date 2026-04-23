export const platformer_long = {
    id: 'platformer_long',
    name: 'Open Arena (Long)',
    background: '/assets/images/background.png',
    music: '/music/background.mp3',
    deathZoneY: 850,
    worldWidth: 4000,
    worldHeight: 1000,
    startPositions: {
        player: { x: 500, y: 400 },
        enemy: { x: 3500, y: 400 }
    },
    shopPosition: { x: 2000, y: 831 },
    platforms: [
        { x: 468, y: 821, width: 627, height: 96, texture: 'game-floor', texX: 500, texY: 832 },
        // Przepaść: 1095 do 1722. Dodajemy ruchomą platformę:
        { x: 1095, y: 650, width: 250, height: 45, texture: 'game-floor', texX: 500, texY: 832, waypoints: [{ x: 1095, y: 650 }, { x: 1475, y: 650 }], speed: 3 },
        { x: 1722, y: 821, width: 627, height: 96, texture: 'game-floor', texX: 500, texY: 832 },
        // Przepaść: 2349 do 2976. Dodajemy platformę pionową:
        { x: 2600, y: 800, width: 250, height: 45, texture: 'game-floor', texX: 500, texY: 832, waypoints: [{ x: 2600, y: 800 }, { x: 2600, y: 500 }], speed: 2 },
        { x: 2976, y: 821, width: 627, height: 96, texture: 'game-floor', texX: 500, texY: 832 },
        
        { x: 150, y: 650, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832 },
        { x: 800, y: 515, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832 },
        { x: 1400, y: 650, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832 },
        
        { x: 2000, y: 515, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832 },
        
        { x: 3200, y: 515, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832 },
        { x: 3600, y: 650, width: 300, height: 45, texture: 'game-floor', texX: 500, texY: 832 },
    ]
};
