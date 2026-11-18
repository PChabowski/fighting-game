import test from 'node:test';
import assert from 'node:assert/strict';
import { getArenasForMode } from './arenas.ts';
import { detectMobileEnvironment } from '../../utils/mobileFullscreen.ts';

test('getArenasForMode returns only arenas available for the selected mode', () => {
  const duelArenas = getArenasForMode('duel_1v1').map((a) => a.id);
  assert.deepEqual(duelArenas, ['shattered_bridge']);

  const brawlArenas = getArenasForMode('brawl_2v2').map((a) => a.id);
  assert.deepEqual(brawlArenas, ['shattered_bridge', 'crimson_pagoda']);

  const skirmish3Arenas = getArenasForMode('skirmish_3v3').map((a) => a.id);
  assert.deepEqual(skirmish3Arenas, ['shattered_bridge', 'crimson_pagoda']);

  const skirmish4Arenas = getArenasForMode('skirmish_4v4').map((a) => a.id);
  assert.deepEqual(skirmish4Arenas, ['crimson_pagoda']);

  const dominionArenas = getArenasForMode('dominion').map((a) => a.id);
  assert.deepEqual(dominionArenas, ['iron_sanctum']);

  const strongholdArenas = getArenasForMode('stronghold').map((a) => a.id);
  assert.deepEqual(strongholdArenas, ['bastion_keep']);
});

test('detectMobileEnvironment remains true in both portrait and horizontal landscape mobile sizes', () => {
  // Mobile portrait (390x844)
  assert.equal(
    detectMobileEnvironment({ coarsePointer: true, maxTouchPoints: 5, width: 390, height: 844 }),
    true
  );
  // Mobile landscape on large phone (932x430) even when width > 900
  assert.equal(
    detectMobileEnvironment({ coarsePointer: true, maxTouchPoints: 5, width: 932, height: 430 }),
    true
  );
  // Emulated horizontal phone viewport with fine pointer
  assert.equal(
    detectMobileEnvironment({ coarsePointer: false, maxTouchPoints: 0, width: 844, height: 390 }),
    true
  );
  // Desktop 1440x900
  assert.equal(
    detectMobileEnvironment({ coarsePointer: false, maxTouchPoints: 0, width: 1440, height: 900 }),
    false
  );
});
