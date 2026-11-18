import type { ArenaDefinition, GameModeId } from '../types.ts';

export const ARENAS: Record<string, ArenaDefinition> = {
  shattered_bridge: {
    id: 'shattered_bridge',
    namePl: 'Złamany Most',
    nameEn: 'Shattered Bridge',
    descPl: 'Symetryczna arena 1v1 i 2v2 z drewnianymi drabinami i górną kładką.',
    descEn: 'Symmetric 1v1 and 2v2 arena with climbable ladders and a high timber overpass.',
    supportedModes: ['duel_1v1', 'brawl_2v2', 'skirmish_3v3'],
    worldWidth: 1600,
    worldHeight: 900,
    groundY: 740,
    deathY: 960,
    backgroundSrc: '/assets/environment/backgrounds/layer_3.png',
    shrinePosition: { x: 800, y: 740 },
    spawns: {
      iron: [
        { x: 260, y: 600 },
        { x: 350, y: 450 },
        { x: 210, y: 600 },
        { x: 420, y: 600 },
      ],
      crimson: [
        { x: 1340, y: 600 },
        { x: 1250, y: 450 },
        { x: 1390, y: 600 },
        { x: 1180, y: 600 },
      ],
    },
    platforms: [
      { id: 'left_base', x: 90, y: 740, width: 610, height: 70, oneWay: false, style: 'stone' },
      { id: 'right_base', x: 900, y: 740, width: 610, height: 70, oneWay: false, style: 'stone' },
      { id: 'mid_bridge', x: 675, y: 710, width: 250, height: 28, oneWay: true, style: 'timber' },
      { id: 'left_mid', x: 220, y: 550, width: 280, height: 24, oneWay: true, style: 'timber' },
      { id: 'right_mid', x: 1100, y: 550, width: 280, height: 24, oneWay: true, style: 'timber' },
      { id: 'top_sanctuary', x: 590, y: 390, width: 420, height: 26, oneWay: true, style: 'iron' },
    ],
    ladders: [
      { id: 'lad_left_mid', x: 245, y: 550, width: 48, height: 190 },
      { id: 'lad_right_mid', x: 1307, y: 550, width: 48, height: 190 },
      { id: 'lad_top_l', x: 616, y: 390, width: 48, height: 350 },
      { id: 'lad_top_r', x: 936, y: 390, width: 48, height: 350 },
    ],
    captureZones: [],
    gateObjective: null,
  },

  crimson_pagoda: {
    id: 'crimson_pagoda',
    namePl: 'Szkarłatna Pagoda',
    nameEn: 'Crimson Pagoda',
    descPl: 'Wielopoziomowa arena 3v3 i 4v4 z systemem drabin i bocznymi flankami.',
    descEn: 'Multi-tier 3v3 and 4v4 arena featuring climbable ladders and vertical flank ledges.',
    supportedModes: ['brawl_2v2', 'skirmish_3v3', 'skirmish_4v4'],
    worldWidth: 2100,
    worldHeight: 1000,
    groundY: 820,
    deathY: 1050,
    backgroundSrc: '/assets/environment/backgrounds/layer_3.png',
    shrinePosition: { x: 1050, y: 820 },
    spawns: {
      iron: [
        { x: 220, y: 680 },
        { x: 320, y: 680 },
        { x: 280, y: 460 },
        { x: 420, y: 680 },
      ],
      crimson: [
        { x: 1880, y: 680 },
        { x: 1780, y: 680 },
        { x: 1820, y: 460 },
        { x: 1680, y: 680 },
      ],
    },
    platforms: [
      { id: 'floor_left', x: 80, y: 820, width: 580, height: 70, oneWay: false, style: 'stone' },
      { id: 'floor_mid', x: 760, y: 820, width: 580, height: 70, oneWay: false, style: 'stone' },
      { id: 'floor_right', x: 1440, y: 820, width: 580, height: 70, oneWay: false, style: 'stone' },
      { id: 'tier1_l', x: 210, y: 620, width: 320, height: 24, oneWay: true, style: 'timber' },
      { id: 'tier1_r', x: 1570, y: 620, width: 320, height: 24, oneWay: true, style: 'timber' },
      { id: 'tier2_mid', x: 800, y: 540, width: 500, height: 26, oneWay: true, style: 'iron' },
      { id: 'tier3_l', x: 440, y: 400, width: 260, height: 24, oneWay: true, style: 'timber' },
      { id: 'tier3_r', x: 1400, y: 400, width: 260, height: 24, oneWay: true, style: 'timber' },
      { id: 'apex', x: 890, y: 310, width: 320, height: 24, oneWay: true, style: 'iron' },
    ],
    ladders: [
      { id: 'lad_fl', x: 240, y: 620, width: 48, height: 200 },
      { id: 'lad_fr', x: 1812, y: 620, width: 48, height: 200 },
      { id: 'lad_tier3_l', x: 465, y: 400, width: 48, height: 220 },
      { id: 'lad_tier3_r', x: 1587, y: 400, width: 48, height: 220 },
      { id: 'lad_mid', x: 830, y: 540, width: 48, height: 280 },
      { id: 'lad_apex', x: 1122, y: 310, width: 48, height: 230 },
    ],
    captureZones: [],
    gateObjective: null,
  },

  iron_sanctum: {
    id: 'iron_sanctum',
    namePl: 'Żelazne Sanktuarium',
    nameEn: 'Iron Sanctum',
    descPl: 'Mapa trybu Dominacja z 3 punktami strategicznymi (A, B, C) na różnych wysokościach.',
    descEn: 'Dominion battleground featuring 3 strategic capture zones (A, B, C) across vertical tiers.',
    supportedModes: ['dominion'],
    worldWidth: 2300,
    worldHeight: 1020,
    groundY: 840,
    deathY: 1080,
    backgroundSrc: '/assets/environment/backgrounds/layer_3.png',
    shrinePosition: { x: 1150, y: 840 },
    spawns: {
      iron: [
        { x: 180, y: 700 },
        { x: 260, y: 700 },
        { x: 340, y: 700 },
        { x: 220, y: 500 },
      ],
      crimson: [
        { x: 2120, y: 700 },
        { x: 2040, y: 700 },
        { x: 1960, y: 700 },
        { x: 2080, y: 500 },
      ],
    },
    platforms: [
      { id: 'base_l', x: 60, y: 840, width: 520, height: 70, oneWay: false, style: 'stone' },
      { id: 'mid_pit', x: 740, y: 840, width: 820, height: 70, oneWay: false, style: 'stone' },
      { id: 'base_r', x: 1720, y: 840, width: 520, height: 70, oneWay: false, style: 'stone' },
      { id: 'zone_a_plat', x: 210, y: 590, width: 340, height: 26, oneWay: true, style: 'timber' },
      { id: 'zone_c_plat', x: 1750, y: 590, width: 340, height: 26, oneWay: true, style: 'timber' },
      { id: 'bridge_l', x: 640, y: 630, width: 250, height: 22, oneWay: true, style: 'timber' },
      { id: 'bridge_r', x: 1410, y: 630, width: 250, height: 22, oneWay: true, style: 'timber' },
      { id: 'upper_watch', x: 930, y: 440, width: 440, height: 26, oneWay: true, style: 'iron' },
    ],
    ladders: [
      { id: 'lad_dom_l1', x: 480, y: 590, width: 48, height: 250 },
      { id: 'lad_dom_r1', x: 1772, y: 590, width: 48, height: 250 },
      { id: 'lad_dom_mid_l', x: 810, y: 630, width: 48, height: 210 },
      { id: 'lad_dom_mid_r', x: 1442, y: 630, width: 48, height: 210 },
      { id: 'lad_dom_watch', x: 970, y: 440, width: 48, height: 400 },
    ],
    captureZones: [
      { id: 'A', namePl: 'Kapliczka Zachodnia', nameEn: 'West Shrine', x: 240, y: 450, width: 280, height: 140 },
      { id: 'B', namePl: 'Dziedziniec Kuźni', nameEn: 'Forge Courtyard', x: 990, y: 700, width: 320, height: 140 },
      { id: 'C', namePl: 'Strażnica Wschodnia', nameEn: 'East Watchtower', x: 1780, y: 450, width: 280, height: 140 },
    ],
    gateObjective: null,
  },

  bastion_keep: {
    id: 'bastion_keep',
    namePl: 'Bastion Twierdzy',
    nameEn: 'Bastion Keep',
    descPl: 'Asymetryczna twierdza oblężnicza z drabinami na mury i potężną Bramą Twierdzy.',
    descEn: 'Asymmetric siege keep with wall ladders and the Iron Fortress Gate.',
    supportedModes: ['stronghold'],
    worldWidth: 2500,
    worldHeight: 1020,
    groundY: 840,
    deathY: 1080,
    backgroundSrc: '/assets/environment/backgrounds/layer_3.png',
    shrinePosition: { x: 1320, y: 840 },
    spawns: {
      // Iron = Attackers (left -> right siege)
      iron: [
        { x: 160, y: 700 },
        { x: 240, y: 700 },
        { x: 320, y: 700 },
        { x: 210, y: 520 },
      ],
      // Crimson = Defenders (holding keep & gate on right)
      crimson: [
        { x: 2050, y: 700 },
        { x: 2160, y: 700 },
        { x: 1920, y: 450 },
        { x: 2260, y: 700 },
      ],
    },
    platforms: [
      { id: 'siege_camp', x: 40, y: 840, width: 720, height: 70, oneWay: false, style: 'stone' },
      { id: 'moat_bridge', x: 870, y: 840, width: 660, height: 70, oneWay: false, style: 'stone' },
      { id: 'keep_courtyard', x: 1640, y: 840, width: 820, height: 70, oneWay: false, style: 'iron' },
      { id: 'siege_tower', x: 320, y: 640, width: 280, height: 24, oneWay: true, style: 'timber' },
      { id: 'rampart_a', x: 960, y: 580, width: 340, height: 26, oneWay: true, style: 'iron' },
      { id: 'inner_wall', x: 1680, y: 560, width: 360, height: 26, oneWay: true, style: 'iron' },
      { id: 'high_catwalk', x: 1340, y: 420, width: 320, height: 24, oneWay: true, style: 'timber' },
    ],
    ladders: [
      { id: 'lad_siege_1', x: 520, y: 640, width: 48, height: 200 },
      { id: 'lad_siege_2', x: 1000, y: 580, width: 48, height: 260 },
      { id: 'lad_keep_def', x: 1960, y: 560, width: 48, height: 280 },
      { id: 'lad_catwalk', x: 1430, y: 420, width: 48, height: 420 },
    ],
    captureZones: [
      { id: 'A', namePl: 'Przedmurze', nameEn: 'Outer Rampart', x: 990, y: 440, width: 280, height: 140 },
      { id: 'B', namePl: 'Baszta Wewnętrzna', nameEn: 'Inner Bastion', x: 1710, y: 420, width: 300, height: 140 },
    ],
    gateObjective: {
      x: 2210,
      y: 590,
      width: 110,
      height: 250,
      maxHp: 1200,
      defenderTeam: 'crimson',
    },
  },
};

export const ARENA_LIST: ArenaDefinition[] = Object.values(ARENAS);

export function getArenasForMode(mode: GameModeId): ArenaDefinition[] {
  const matches = ARENA_LIST.filter((arena) => arena.supportedModes.includes(mode));
  return matches.length > 0 ? matches : [ARENAS.shattered_bridge];
}
