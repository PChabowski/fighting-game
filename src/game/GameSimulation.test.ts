import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation, emptyInput } from './GameSimulation';
import { LobbyParticipant } from './types';

function makeDuelParticipants(): LobbyParticipant[] {
  return [
    {
      id: 'p1',
      name: 'Player',
      isBot: false,
      isLocal: true,
      team: 'iron',
      heroId: 'kurogane',
      skinIndex: 0,
      ready: true,
    },
    {
      id: 'e1',
      name: 'Enemy',
      isBot: false,
      isLocal: false,
      team: 'crimson',
      heroId: 'varek',
      skinIndex: 0,
      ready: true,
    },
  ];
}

test('GameSimulation auto-faces lockedTargetId even when strafing away', () => {
  const sim = new GameSimulation('duel_1v1', 'shattered_bridge', 'veteran', makeDuelParticipants());
  // Advance past 3s countdown
  for (let i = 0; i < 200; i++) {
    sim.step(16.67, {});
  }
  const snap = sim.getSnapshot();
  assert.equal(snap.phase, 'active');

  const p1 = snap.fighters.find((f) => f.id === 'p1')!;
  const e1 = snap.fighters.find((f) => f.id === 'e1')!;
  p1.x = 700;
  e1.x = 900;

  // Move left while locked onto e1 (who is to the right) -> facing must stay +1!
  sim.step(16.67, {
    p1: { ...emptyInput(), moveX: -1, lockedTargetId: 'e1' },
    e1: emptyInput(),
  });
  assert.equal(p1.facing, 1);

  // Move e1 to the left of p1 -> facing flips automatically to -1
  e1.x = 500;
  sim.step(16.67, {
    p1: { ...emptyInput(), moveX: 1, lockedTargetId: 'e1' },
    e1: emptyInput(),
  });
  assert.equal(p1.facing, -1);
});

test('Directional block mitigates damage while mismatched guard takes full hit', () => {
  const sim = new GameSimulation('duel_1v1', 'shattered_bridge', 'veteran', makeDuelParticipants());
  for (let i = 0; i < 200; i++) sim.step(16.67, {});

  const snap = sim.getSnapshot();
  const p1 = snap.fighters.find((f) => f.id === 'p1')!;
  const e1 = snap.fighters.find((f) => f.id === 'e1')!;
  p1.x = 600;
  p1.y = 500;
  p1.facing = 1;
  e1.x = 670;
  e1.y = 500;
  e1.facing = -1;

  const startHp = e1.hp;

  // p1 throws light top, e1 guards top -> blocked (chip <= 5)
  sim.step(16.67, {
    p1: { ...emptyInput(), guardDir: 'top', lightPressed: true },
    e1: { ...emptyInput(), guardDir: 'top' },
  });
  for (let i = 0; i < 25; i++) {
    sim.step(16.67, {
      p1: { ...emptyInput(), guardDir: 'top' },
      e1: { ...emptyInput(), guardDir: 'top' },
    });
  }
  assert.ok(startHp - e1.hp <= 5, 'Matched guard should block attack with minor chip');

  // Recover & throw left light while e1 guards right -> full direct damage
  for (let i = 0; i < 35; i++) sim.step(16.67, {});
  const preHitHp = e1.hp;
  sim.step(16.67, {
    p1: { ...emptyInput(), guardDir: 'left', lightPressed: true },
    e1: { ...emptyInput(), guardDir: 'right' },
  });
  for (let i = 0; i < 25; i++) {
    sim.step(16.67, {
      p1: { ...emptyInput(), guardDir: 'left' },
      e1: { ...emptyInput(), guardDir: 'right' },
    });
  }
  assert.ok(preHitHp - e1.hp >= 10, 'Unmatched guard should take full light attack damage');
});

test('Match timer advances 1:1 with elapsed simulation ms even during heavy hits', () => {
  const sim = new GameSimulation('duel_1v1', 'shattered_bridge', 'veteran', makeDuelParticipants());
  // Clear 3-second countdown (12 x 250ms = 3000ms)
  for (let i = 0; i < 12; i++) {
    sim.step(250, {});
  }
  const activeSnap = sim.getSnapshot();
  assert.equal(activeSnap.phase, 'active');
  const startTimer = activeSnap.matchTimerSec;

  const p1 = activeSnap.fighters.find((f) => f.id === 'p1')!;
  const e1 = activeSnap.fighters.find((f) => f.id === 'e1')!;
  p1.x = 600;
  p1.facing = 1;
  e1.x = 660;
  e1.facing = -1;

  // Simulate 5.0 seconds in 20ms steps while throwing heavy hits
  for (let i = 0; i < 250; i++) {
    sim.step(20, {
      p1: { ...emptyInput(), guardDir: 'left', heavyPressed: i === 5 || i === 80 },
      e1: { ...emptyInput(), guardDir: 'right' },
    });
  }

  assert.equal(sim.getSnapshot().matchTimerSec, startTimer - 5);
});

test('GameSimulation buffers attack pressed right before recovery ends and executes on first idle frame', () => {
  const sim = new GameSimulation('duel_1v1', 'shattered_bridge', 'veteran', makeDuelParticipants());
  for (let i = 0; i < 200; i++) sim.step(16.67, {});

  const snap = sim.getSnapshot();
  const p1 = snap.fighters.find((f) => f.id === 'p1')!;
  // Put p1 in recovery with 50ms remaining
  p1.actionState = 'recovery';
  p1.stateTimerMs = 140;
  p1.stateDurationMs = 190;

  // Player clicks light attack 50ms early (during recovery!)
  sim.step(16.67, {
    p1: { ...emptyInput(), guardDir: 'right', lightPressed: true, seq: 1 },
    e1: emptyInput(),
  });

  // Still in recovery for ~33ms more, then finishes recovery -> buffered light attack must fire automatically!
  for (let i = 0; i < 4; i++) {
    sim.step(16.67, {
      p1: { ...emptyInput(), guardDir: 'right', seq: i + 2 },
      e1: emptyInput(),
    });
  }

  assert.equal(
    p1.actionState,
    'windup_light',
    'Buffered light attack should execute automatically when recovery completes'
  );
});

test('Lethal hit immediately triggers death animation, advances all death frames, and lands corpse on floor', () => {
  const sim = new GameSimulation('duel_1v1', 'shattered_bridge', 'veteran', makeDuelParticipants());
  for (let i = 0; i < 200; i++) sim.step(16.67, {});

  const snap = sim.getSnapshot();
  const p1 = snap.fighters.find((f) => f.id === 'p1')!;
  const e1 = snap.fighters.find((f) => f.id === 'e1')!;
  p1.x = 300;
  p1.y = 622;
  p1.facing = 1;
  e1.x = 365;
  e1.y = 622;
  e1.facing = -1;
  e1.hp = 5;

  // p1 delivers lethal left light attack while e1 guards right
  sim.step(16.67, {
    p1: { ...emptyInput(), guardDir: 'left', lightPressed: true, seq: 1 },
    e1: { ...emptyInput(), guardDir: 'right', seq: 1 },
  });

  // Step until hit connects
  for (let i = 0; i < 16; i++) {
    sim.step(16.67, {
      p1: { ...emptyInput(), guardDir: 'left', seq: i + 2 },
      e1: { ...emptyInput(), guardDir: 'right', seq: i + 2 },
    });
    if (!e1.alive) break;
  }

  assert.equal(e1.alive, false);
  assert.equal(e1.actionState, 'dead');
  assert.equal(e1.animName, 'death');

  // Advance ~750ms across death animation playback
  for (let i = 0; i < 45; i++) {
    sim.step(16.67, {});
  }

  assert.equal(e1.animName, 'death');
  assert.equal(e1.animFrame, 5, 'Varek death animation should advance through final frame (5)');
  assert.equal(e1.grounded, true, 'Defeated fighter knocked upward should land cleanly on floor');
});

test('1v1 duel resets matchTimerSec to full 180s at the start of every new round', () => {
  const sim = new GameSimulation('duel_1v1', 'shattered_bridge', 'veteran', makeDuelParticipants());
  // Clear 3-second countdown (12 x 250ms = 3000ms)
  for (let i = 0; i < 12; i++) sim.step(250, {});
  assert.equal(sim.getSnapshot().phase, 'active');
  assert.equal(sim.getSnapshot().currentRound, 1);

  // Advance 25 seconds in Round 1 -> matchTimerSec should drop to 155
  for (let i = 0; i < 100; i++) sim.step(250, {});
  assert.equal(sim.getSnapshot().matchTimerSec, 155);

  // Eliminate e1 by void fall to end Round 1
  const e1 = sim.getSnapshot().fighters.find((f) => f.id === 'e1')!;
  e1.y = 990;
  sim.step(16.67, {});
  assert.equal(sim.getSnapshot().ironRoundWins, 1);

  // Advance through 1.85s round transition delay + 2s countdown into Round 2
  for (let i = 0; i < 10; i++) sim.step(250, {});
  const round2Snap = sim.getSnapshot();
  assert.equal(round2Snap.currentRound, 2);
  assert.equal(
    round2Snap.matchTimerSec,
    180,
    'Round 2 must reset matchTimerSec back to full 180 seconds (3:00)'
  );
});

test('Fighter climbs up a ladder with upHeld and steps cleanly onto the upper platform', () => {
  const sim = new GameSimulation('duel_1v1', 'shattered_bridge', 'veteran', makeDuelParticipants());
  for (let i = 0; i < 12; i++) sim.step(250, {});

  const p1 = sim.getSnapshot().fighters.find((f) => f.id === 'p1')!;
  // Position p1 standing on left_base floor directly at ladder lad_left_mid (x=245, y=550, w=48, h=190)
  p1.x = 269;
  p1.y = 740 - p1.height;
  p1.grounded = true;

  // Hold W / touch analog up while climbing (even if jumpPressed is pulsed at start)
  for (let i = 0; i < 50; i++) {
    sim.step(20, {
      p1: { ...emptyInput(), upHeld: true, jumpPressed: i === 0, seq: i + 1 },
      e1: emptyInput(),
    });
  }

  assert.equal(p1.grounded, true, 'Fighter should step onto upper platform at top of ladder');
  assert.ok(
    Math.abs(p1.y + p1.height - 550) <= 2,
    `Fighter feet should rest on left_mid platform (y=550), got ${p1.y + p1.height}`
  );
  assert.equal(p1.onLadder, false);
});



