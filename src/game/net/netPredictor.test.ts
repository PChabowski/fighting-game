import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation, emptyInput } from '../GameSimulation.ts';
import { NetPredictor } from './netPredictor.ts';
import type { LobbyParticipant } from '../types.ts';

function makeParticipants(): LobbyParticipant[] {
  return [
    {
      id: 'p1',
      name: 'Hero1',
      isBot: false,
      isLocal: true,
      team: 'iron',
      heroId: 'kurogane',
      skinIndex: 0,
      ready: true,
    },
    {
      id: 'p2',
      name: 'Rival2',
      isBot: false,
      isLocal: false,
      team: 'crimson',
      heroId: 'varek',
      skinIndex: 0,
      ready: true,
    },
  ];
}

test('NetPredictor predicts local movement immediately at 0ms and interpolates remote fighters smoothly', () => {
  const sim = new GameSimulation('duel_1v1', 'shattered_bridge', 'veteran', makeParticipants());
  for (let i = 0; i < 190; i++) sim.step(16.67, {});

  const initialSnap = structuredClone(sim.getSnapshot());
  assert.equal(initialSnap.phase, 'active');

  const predictor = new NetPredictor('p1');
  predictor.onServerSnapshot(initialSnap);

  const startLocalX = initialSnap.fighters.find((f) => f.id === 'p1')!.x;

  // Local player presses move right & switches guard left -> immediate 0ms local prediction!
  predictor.predictLocalStep(16.67, {
    ...emptyInput(),
    moveX: 1,
    guardDir: 'left',
    lightPressed: true,
    seq: 1,
  });

  const predictedSnap = predictor.buildRenderSnapshot(16.67)!;
  const predLocal = predictedSnap.fighters.find((f) => f.id === 'p1')!;
  assert.ok(predLocal.x > startLocalX, 'Predicted local x should move immediately before server ack');
  assert.equal(predLocal.guardDir, 'left');
  assert.equal(predLocal.actionState, 'windup_light');

  // Server processes p2 moving right and p1 seq 1
  for (let s = 0; s < 2; s++) {
    sim.step(16.67, {
      p1: { ...emptyInput(), moveX: 1, guardDir: 'left', lightPressed: s === 0, seq: 1 },
      p2: { ...emptyInput(), moveX: 1, seq: 1 },
    });
  }
  const serverSnap2 = structuredClone(sim.getSnapshot());
  const prevP2X = initialSnap.fighters.find((f) => f.id === 'p2')!.x;
  const targetP2X = serverSnap2.fighters.find((f) => f.id === 'p2')!.x;

  predictor.onServerSnapshot(serverSnap2);
  // Halfway through 24ms interpolation window -> remote fighter p2 should be smoothly between prev and target
  const midSnap = predictor.buildRenderSnapshot(12)!;
  const midP2X = midSnap.fighters.find((f) => f.id === 'p2')!.x;
  assert.ok(
    midP2X > prevP2X && midP2X < targetP2X + 1,
    `Expected interpolated remote x between ${prevP2X} and ${targetP2X}, got ${midP2X}`
  );
});
