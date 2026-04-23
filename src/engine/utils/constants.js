export const GRAVITY = 0.7;

export const START_POSITIONS = {
  player: { x: 200, y: 330 },
  enemy: { x: 700, y: 330 },
};

// Map / spawn related constants
export const LARGE_MAP_WIDTH_THRESHOLD = 1200; // px
export const SPAWN_RADIUS_DEFAULT = 200; // default radius to pick respawn near death point
export const SPAWN_RADIUS_LARGE_MAP = 500; // wider radius for long maps (but we'll clamp to bounds)
export const SPAWN_RADIUS_SINGLEPLAYER = 150; // closer respawns for singleplayer mode
