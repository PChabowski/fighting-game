export const AI_DIFFICULTY_ORDER = [
  'rookie',
  'cadet',
  'veteran',
  'elite',
  'nightmare',
];

export const DEFAULT_AI_DIFFICULTY = 'veteran';

export const AI_DIFFICULTY_PROFILES = {
  rookie: {
    label: 'Rookie',
    reactionTime: 32,
    attackChance: 0.42,
    heavyAttackChance: 0.08,
    dodgeReactChance: 0.18,
    retreatHealthThreshold: 0.22,
    defensiveHealthThreshold: 20,
    objectiveCommitment: 0.45,
    pressureRange: 96,
    visionRange: 170,
    edgeProbeStep: 28,
    maxSafeDrop: 52,
  },
  cadet: {
    label: 'Cadet',
    reactionTime: 26,
    attackChance: 0.52,
    heavyAttackChance: 0.12,
    dodgeReactChance: 0.24,
    retreatHealthThreshold: 0.26,
    defensiveHealthThreshold: 26,
    objectiveCommitment: 0.58,
    pressureRange: 110,
    visionRange: 195,
    edgeProbeStep: 26,
    maxSafeDrop: 58,
  },
  veteran: {
    label: 'Veteran',
    reactionTime: 20,
    attackChance: 0.67,
    heavyAttackChance: 0.2,
    dodgeReactChance: 0.34,
    retreatHealthThreshold: 0.3,
    defensiveHealthThreshold: 35,
    objectiveCommitment: 0.72,
    pressureRange: 130,
    visionRange: 235,
    edgeProbeStep: 24,
    maxSafeDrop: 68,
  },
  elite: {
    label: 'Elite',
    reactionTime: 15,
    attackChance: 0.78,
    heavyAttackChance: 0.28,
    dodgeReactChance: 0.42,
    retreatHealthThreshold: 0.34,
    defensiveHealthThreshold: 42,
    objectiveCommitment: 0.84,
    pressureRange: 150,
    visionRange: 270,
    edgeProbeStep: 22,
    maxSafeDrop: 74,
  },
  nightmare: {
    label: 'Nightmare',
    reactionTime: 11,
    attackChance: 0.9,
    heavyAttackChance: 0.36,
    dodgeReactChance: 0.52,
    retreatHealthThreshold: 0.38,
    defensiveHealthThreshold: 48,
    objectiveCommitment: 0.93,
    pressureRange: 175,
    visionRange: 300,
    edgeProbeStep: 20,
    maxSafeDrop: 82,
  },
};

const DEFAULT_MAP_AI_PROFILE = {
  id: 'default',
  style: 'duel',
  combatBias: 0.7,
  objectiveBias: 0.4,
  defendBias: 0.45,
  platformBias: 0.5,
  preferredCombatRange: 120,
  patrolAnchors: [],
};

export const MAP_AI_PROFILES = {
  dojo: {
    id: 'dojo',
    style: 'duel',
    combatBias: 0.92,
    objectiveBias: 0.1,
    defendBias: 0.15,
    platformBias: 0.05,
    preferredCombatRange: 105,
    patrolAnchors: [],
  },
  platformer: {
    id: 'platformer',
    style: 'duel-platform',
    combatBias: 0.8,
    objectiveBias: 0.2,
    defendBias: 0.3,
    platformBias: 0.76,
    preferredCombatRange: 120,
    patrolAnchors: [
      { x: 900, y: 500 },
      { x: 1450, y: 640 },
    ],
  },
  open_arena: {
    id: 'open_arena',
    style: 'ctf',
    combatBias: 0.74,
    objectiveBias: 0.9,
    defendBias: 0.86,
    platformBias: 0.8,
    preferredCombatRange: 135,
    // Lane ordered from Team A flag side (left) to Team B flag side (right).
    // Bots use these anchors as intermediate traversal goals to cross large gaps safely.
    ctfLane: [
      { x: 285, y: 600 },
      { x: 560, y: 640 },
      { x: 950, y: 515 },
      { x: 1280, y: 650 },
      { x: 1550, y: 650 },
      { x: 2130, y: 515 },
      { x: 2600, y: 510 },
      { x: 3330, y: 515 },
      { x: 3735, y: 600 },
    ],
    patrolAnchors: [
      { x: 2600, y: 650 },
      { x: 3200, y: 520 },
      { x: 3520, y: 620 },
    ],
  },
};

export function getAIDifficultyConfig(level) {
  const key = AI_DIFFICULTY_PROFILES[level] ? level : DEFAULT_AI_DIFFICULTY;
  return {
    key,
    ...AI_DIFFICULTY_PROFILES[key],
  };
}

export function getAIMapProfile(levelId, levelConfig = null) {
  const fromLevel = levelConfig && levelConfig.aiProfile ? levelConfig.aiProfile : null;
  if (fromLevel) {
    return {
      ...DEFAULT_MAP_AI_PROFILE,
      ...fromLevel,
      id: fromLevel.id || levelId || DEFAULT_MAP_AI_PROFILE.id,
    };
  }

  const builtIn = MAP_AI_PROFILES[levelId] || DEFAULT_MAP_AI_PROFILE;
  return {
    ...DEFAULT_MAP_AI_PROFILE,
    ...builtIn,
    id: levelId || builtIn.id,
  };
}

export function getAIDifficultyLabel(level) {
  return getAIDifficultyConfig(level).label;
}
