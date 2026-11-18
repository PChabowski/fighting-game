import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from './roomManager';
import { ServerToClientMessage } from '../game/net/protocol';
import { emptyInput } from '../game/GameSimulation';

test('RoomManager creates room, allows joining by code, migrates host, and steps authoritative match', () => {
  const rm = new RoomManager();
  const hostInbox: ServerToClientMessage[] = [];
  const guestInbox: ServerToClientMessage[] = [];

  const hostId = rm.registerClient((m) => hostInbox.push(m), 'KuroganeHost');
  const guestId = rm.registerClient((m) => guestInbox.push(m), 'SoraGuest');

  rm.handleMessage(hostId, {
    type: 'create_room',
    name: 'KuroganeHost',
    mode: 'duel_1v1',
    arenaId: 'shattered_bridge',
    difficulty: 'veteran',
    heroId: 'kurogane',
    skinIndex: 0,
    team: 'iron',
  });

  const createdMsg = hostInbox.find((m) => m.type === 'room_state');
  assert.ok(createdMsg && createdMsg.type === 'room_state');
  const code = createdMsg.room.roomCode;
  assert.equal(code.length, 5);
  assert.equal(createdMsg.room.hostId, hostId);
  // 1v1 auto-filled 1 bot on crimson
  assert.equal(createdMsg.room.bots.length, 1);

  // Guest joins by code -> replaces crimson bot automatically in 1v1
  rm.handleMessage(guestId, {
    type: 'join_room',
    roomCode: code,
    name: 'SoraGuest',
    heroId: 'sora',
    skinIndex: 1,
    team: 'crimson',
  });

  const joinedRoom = rm.getRoomState(code);
  assert.ok(joinedRoom);
  assert.equal(joinedRoom.humans.length, 2);
  assert.equal(joinedRoom.bots.length, 0);

  // Non-host cannot start match
  rm.handleMessage(guestId, { type: 'start_match' }, 1000);
  const notHostErr = guestInbox.find((m) => m.type === 'error_msg');
  assert.ok(notHostErr && notHostErr.type === 'error_msg');
  assert.equal(notHostErr.code, 'NOT_HOST');

  // Host starts match -> authoritative simulation steps forward cleanly
  rm.handleMessage(hostId, { type: 'start_match' }, 1000);
  assert.equal(rm.getRoomState(code)?.phase, 'PLAYING');

  // Send input from guest and tick past countdown (3000ms)
  rm.handleMessage(guestId, {
    type: 'player_input',
    input: { ...emptyInput(), moveX: -1, guardDir: 'left', seq: 1 },
  });

  for (let t = 1050; t <= 4250; t += 50) {
    rm.tick(t);
  }

  const snaps = hostInbox.filter((m) => m.type === 'world_snapshot');
  assert.ok(snaps.length > 0);
  const lastSnap = snaps[snaps.length - 1];
  assert.equal(lastSnap.type, 'world_snapshot');
  if (lastSnap.type === 'world_snapshot') {
    assert.equal(lastSnap.snapshot.phase, 'active');
    assert.equal(lastSnap.snapshot.fighters.length, 2);
  }

  // Host disconnects -> guest becomes new host
  rm.unregisterClient(hostId);
  const afterHostLeave = rm.getRoomState(code);
  assert.ok(afterHostLeave);
  assert.equal(afterHostLeave.hostId, guestId);

  // Last player disconnects -> room cleaned up
  rm.unregisterClient(guestId);
  assert.equal(rm.listRooms().length, 0);
});

test('RoomManager allows joining ongoing match with bots via lobby hero selection and join_live_match', () => {
  const rm = new RoomManager();
  const hostInbox: ServerToClientMessage[] = [];
  const lateInbox: ServerToClientMessage[] = [];

  const hostId = rm.registerClient((m) => hostInbox.push(m), 'AlphaHost');
  rm.handleMessage(hostId, {
    type: 'create_room',
    name: 'AlphaHost',
    mode: 'brawl_2v2',
    arenaId: 'shattered_bridge',
    difficulty: 'veteran',
    heroId: 'kurogane',
    skinIndex: 0,
    team: 'iron',
  });

  const created = hostInbox.find((m) => m.type === 'room_state');
  assert.ok(created && created.type === 'room_state');
  const code = created.room.roomCode;
  assert.equal(created.room.bots.length, 3);

  // Start the match so room is in PLAYING phase with 1 human + 3 bots
  rm.handleMessage(hostId, { type: 'start_match' }, 1000);
  rm.tick(1100);
  assert.equal(rm.getRoomState(code)?.phase, 'PLAYING');

  // Late player joins the ongoing room -> must start in LOBBY state (inMatch === false)
  const lateId = rm.registerClient((m) => lateInbox.push(m), 'LateJoiner');
  rm.handleMessage(lateId, {
    type: 'join_room',
    roomCode: code,
    name: 'LateJoiner',
    heroId: 'sora',
    skinIndex: 0,
  });

  const roomAfterJoin = rm.getRoomState(code);
  assert.ok(roomAfterJoin);
  assert.equal(roomAfterJoin.phase, 'PLAYING');
  const lateParticipant = roomAfterJoin.humans.find((h) => h.id === lateId);
  assert.ok(lateParticipant);
  assert.equal(lateParticipant.inMatch, false);
  // Bot has not been replaced yet while still selecting hero in lobby
  assert.equal(roomAfterJoin.bots.length, 3);

  // Ticking while late player is still in lobby does NOT send world_snapshot to lateInbox
  const snapCountBeforePick = lateInbox.filter((m) => m.type === 'world_snapshot').length;
  rm.tick(1200);
  assert.equal(lateInbox.filter((m) => m.type === 'world_snapshot').length, snapCountBeforePick);

  // Player picks hero & skin in Lobby and chooses to replace the Iron team bot explicitly
  const targetIronBot = roomAfterJoin.bots.find((b) => b.team === 'iron');
  assert.ok(targetIronBot);
  rm.handleMessage(lateId, {
    type: 'update_selection',
    heroId: 'varek',
    skinIndex: 2,
    team: 'iron',
  });

  // Player clicks "Dołącz do gry / Join Game" -> replaces targetIronBot and spawns in live match
  rm.handleMessage(lateId, { type: 'join_live_match', botId: targetIronBot.id }, 1300);

  const roomAfterDeploy = rm.getRoomState(code);
  assert.ok(roomAfterDeploy);
  assert.equal(roomAfterDeploy.bots.length, 2);
  assert.equal(roomAfterDeploy.bots.some((b) => b.id === targetIronBot.id), false);
  const deployedLate = roomAfterDeploy.humans.find((h) => h.id === lateId);
  assert.ok(deployedLate);
  assert.equal(deployedLate.inMatch, true);
  assert.equal(deployedLate.team, 'iron');
  assert.equal(deployedLate.heroId, 'varek');
  assert.equal(deployedLate.skinIndex, 2);

  const joinSnaps = lateInbox.filter((m) => m.type === 'world_snapshot');
  assert.ok(joinSnaps.length >= 1);
  const lastSnap = joinSnaps[joinSnaps.length - 1];
  if (lastSnap.type === 'world_snapshot') {
    const myFighter = lastSnap.snapshot.fighters.find((f) => f.id === lateId);
    assert.ok(myFighter);
    assert.equal(myFighter.isBot, false);
    assert.equal(myFighter.team, 'iron');
    assert.equal(myFighter.heroId, 'varek');
    assert.equal(myFighter.skinIndex, 2);
    assert.equal(myFighter.alive, true);
  }
});

test('RoomManager rejects joining ongoing match when zero bot slots remain', () => {
  const rm = new RoomManager();
  const hostInbox: ServerToClientMessage[] = [];
  const p2Inbox: ServerToClientMessage[] = [];
  const p3Inbox: ServerToClientMessage[] = [];

  const hostId = rm.registerClient((m) => hostInbox.push(m), 'H1');
  const p2Id = rm.registerClient((m) => p2Inbox.push(m), 'H2');
  const p3Id = rm.registerClient((m) => p3Inbox.push(m), 'H3');

  rm.handleMessage(hostId, {
    type: 'create_room',
    name: 'H1',
    mode: 'duel_1v1',
    arenaId: 'shattered_bridge',
    difficulty: 'veteran',
    heroId: 'kurogane',
    skinIndex: 0,
    team: 'iron',
  });
  const created = hostInbox.find((m) => m.type === 'room_state');
  assert.ok(created && created.type === 'room_state');
  const code = created.room.roomCode;

  rm.handleMessage(p2Id, {
    type: 'join_room',
    roomCode: code,
    name: 'H2',
    heroId: 'sora',
    skinIndex: 1,
    team: 'crimson',
  });
  rm.handleMessage(hostId, { type: 'start_match' }, 1000);

  // 1v1 is full (2/2 humans, 0 bots)
  rm.handleMessage(p3Id, {
    type: 'join_room',
    roomCode: code,
    name: 'H3',
    heroId: 'varek',
    skinIndex: 0,
  });
  const err = p3Inbox.find((m) => m.type === 'error_msg');
  assert.ok(err && err.type === 'error_msg');
  assert.equal(err.code, 'ROOM_FULL');
});

test('RoomManager automatically spawns Bot AI in place of leaving player/host and allows new player to take that slot', () => {
  const rm = new RoomManager();
  const hostInbox: ServerToClientMessage[] = [];
  const p2Inbox: ServerToClientMessage[] = [];
  const p3Inbox: ServerToClientMessage[] = [];

  const hostId = rm.registerClient((m) => hostInbox.push(m), 'AlphaHost');
  const p2Id = rm.registerClient((m) => p2Inbox.push(m), 'BetaGuest');

  rm.handleMessage(hostId, {
    type: 'create_room',
    name: 'AlphaHost',
    mode: 'duel_1v1',
    arenaId: 'shattered_bridge',
    difficulty: 'veteran',
    heroId: 'kurogane',
    skinIndex: 0,
    team: 'iron',
  });
  const created = hostInbox.find((m) => m.type === 'room_state');
  assert.ok(created && created.type === 'room_state');
  const code = created.room.roomCode;

  rm.handleMessage(p2Id, {
    type: 'join_room',
    roomCode: code,
    name: 'BetaGuest',
    heroId: 'sora',
    skinIndex: 1,
    team: 'crimson',
  });
  rm.handleMessage(hostId, { type: 'start_match' }, 1000);
  rm.tick(4200); // Advance past countdown into active phase

  // Host leaves mid-match -> must NOT end match, must migrate host to BetaGuest and spawn Bot AI on Iron
  rm.handleMessage(hostId, { type: 'leave_room' }, 4300);

  const afterHostLeave = rm.getRoomState(code);
  assert.ok(afterHostLeave);
  assert.equal(afterHostLeave.phase, 'PLAYING');
  assert.equal(afterHostLeave.hostId, p2Id);
  assert.equal(afterHostLeave.humans.length, 1);
  assert.equal(afterHostLeave.bots.length, 1);
  assert.equal(afterHostLeave.bots[0].team, 'iron');
  assert.notEqual(afterHostLeave.bots[0].name, 'AlphaHost');

  const p2Snaps = p2Inbox.filter((m) => m.type === 'world_snapshot');
  const latestP2Snap = p2Snaps[p2Snaps.length - 1];
  assert.ok(latestP2Snap && latestP2Snap.type === 'world_snapshot');
  const replacementBotFighter = latestP2Snap.snapshot.fighters.find((f) => f.team === 'iron');
  assert.ok(replacementBotFighter);
  assert.equal(replacementBotFighter.isBot, true);
  assert.equal(replacementBotFighter.name, afterHostLeave.bots[0].name);

  // Room summary must show 1/2 HUMAN, 1 BOT, PLAYING so a 3rd player can join in place of the bot
  const summary = rm.listRooms().find((r) => r.roomCode === code);
  assert.ok(summary);
  assert.equal(summary.humanCount, 1);
  assert.equal(summary.botCount, 1);
  assert.equal(summary.phase, 'PLAYING');

  // 3rd player joins in place of the newly spawned bot
  const p3Id = rm.registerClient((m) => p3Inbox.push(m), 'GammaNew');
  rm.handleMessage(p3Id, {
    type: 'join_room',
    roomCode: code,
    name: 'GammaNew',
    heroId: 'varek',
    skinIndex: 2,
  });
  rm.handleMessage(p3Id, { type: 'join_live_match', botId: afterHostLeave.bots[0].id }, 4500);

  const finalRoom = rm.getRoomState(code);
  assert.ok(finalRoom);
  assert.equal(finalRoom.humans.length, 2);
  assert.equal(finalRoom.bots.length, 0);
});

test('RoomManager rebalances bots automatically on lobby team swaps to prevent 5v3 imbalance', () => {
  const rm = new RoomManager();
  const hostInbox: ServerToClientMessage[] = [];
  const guestInbox: ServerToClientMessage[] = [];

  const hostId = rm.registerClient((m) => hostInbox.push(m), 'IronCaptain');
  const guestId = rm.registerClient((m) => guestInbox.push(m), 'CrimsonGuest');

  rm.handleMessage(hostId, {
    type: 'create_room',
    name: 'IronCaptain',
    mode: 'skirmish_4v4',
    arenaId: 'shattered_bridge',
    difficulty: 'veteran',
    heroId: 'kurogane',
    skinIndex: 0,
    team: 'iron',
  });

  const created = hostInbox.find((m) => m.type === 'room_state');
  assert.ok(created && created.type === 'room_state');
  const code = created.room.roomCode;

  const countTeams = (room: NonNullable<ReturnType<RoomManager['getRoomState']>>) => ({
    iron:
      room.humans.filter((h) => h.team === 'iron').length +
      room.bots.filter((b) => b.team === 'iron').length,
    crimson:
      room.humans.filter((h) => h.team === 'crimson').length +
      room.bots.filter((b) => b.team === 'crimson').length,
  });

  // Initially 4v4 (1 human + 3 bots Iron, 4 bots Crimson)
  assert.deepEqual(countTeams(rm.getRoomState(code)!), { iron: 4, crimson: 4 });

  // Host swaps from Iron -> Crimson: must stay 4v4, NOT 5v3!
  rm.handleMessage(hostId, {
    type: 'update_selection',
    heroId: 'kurogane',
    skinIndex: 0,
    team: 'crimson',
  });
  let state = rm.getRoomState(code)!;
  assert.equal(state.humans.find((h) => h.id === hostId)?.team, 'crimson');
  assert.deepEqual(countTeams(state), { iron: 4, crimson: 4 });

  // Guest joins onto Crimson (2 humans + 2 bots Crimson, 4 bots Iron) -> still 4v4
  rm.handleMessage(guestId, {
    type: 'join_room',
    roomCode: code,
    name: 'CrimsonGuest',
    heroId: 'sora',
    skinIndex: 1,
    team: 'crimson',
  });
  state = rm.getRoomState(code)!;
  assert.deepEqual(countTeams(state), { iron: 4, crimson: 4 });

  // Guest swaps to Iron multiple times -> always stays 4v4
  rm.handleMessage(guestId, { type: 'update_selection', team: 'iron' });
  assert.deepEqual(countTeams(rm.getRoomState(code)!), { iron: 4, crimson: 4 });

  rm.handleMessage(guestId, { type: 'update_selection', team: 'crimson' });
  assert.deepEqual(countTeams(rm.getRoomState(code)!), { iron: 4, crimson: 4 });
});

test('RoomManager preserves equal bot counts across repeated rematches and uses multiplayer rematch voting', () => {
  const rm = new RoomManager();
  const hostInbox: ServerToClientMessage[] = [];
  const guestInbox: ServerToClientMessage[] = [];

  const hostId = rm.registerClient((m) => hostInbox.push(m), 'HostWarrior');
  const guestId = rm.registerClient((m) => guestInbox.push(m), 'GuestWarrior');

  rm.handleMessage(hostId, {
    type: 'create_room',
    name: 'HostWarrior',
    mode: 'skirmish_4v4',
    arenaId: 'shattered_bridge',
    difficulty: 'veteran',
    heroId: 'varek',
    skinIndex: 0,
    team: 'iron',
  });
  const created = hostInbox.find((m) => m.type === 'room_state');
  assert.ok(created && created.type === 'room_state');
  const code = created.room.roomCode;

  rm.handleMessage(guestId, {
    type: 'join_room',
    roomCode: code,
    name: 'GuestWarrior',
    heroId: 'sora',
    skinIndex: 1,
    team: 'crimson',
  });

  rm.handleMessage(hostId, { type: 'start_match' }, 1000);
  rm.tick(4500);

  // Guest votes first (even though Guest is not host) -> vote recorded (1/2), match has NOT reset yet
  rm.handleMessage(guestId, { type: 'rematch' }, 5000);
  let state = rm.getRoomState(code)!;
  assert.deepEqual(state.rematchVotes, [guestId]);
  assert.equal(state.rematchEligibleCount, 2);

  // Guest toggles vote off -> vote removed (0/2)
  rm.handleMessage(guestId, { type: 'rematch' }, 5100);
  state = rm.getRoomState(code)!;
  assert.deepEqual(state.rematchVotes, []);

  // Guest votes again (1/2), then Host votes (2/2) -> triggers fresh rematch with 4v4 balanced fighters
  rm.handleMessage(guestId, { type: 'rematch' }, 5200);
  rm.handleMessage(hostId, { type: 'rematch' }, 5300);
  state = rm.getRoomState(code)!;
  assert.deepEqual(state.rematchVotes, []);
  assert.equal(state.bots.filter((b) => b.team === 'iron').length, 3);
  assert.equal(state.bots.filter((b) => b.team === 'crimson').length, 3);

  const rematchSnap = hostInbox.filter((m) => m.type === 'world_snapshot').pop();
  assert.ok(rematchSnap && rematchSnap.type === 'world_snapshot');
  assert.equal(rematchSnap.snapshot.phase, 'countdown');
  assert.equal(rematchSnap.snapshot.fighters.filter((f) => f.team === 'iron').length, 4);
  assert.equal(rematchSnap.snapshot.fighters.filter((f) => f.team === 'crimson').length, 4);

  // Repeat multiple consecutive rematches + simulated leave on summary screen: never drops a bot
  rm.handleMessage(hostId, { type: 'rematch' }, 6000);
  rm.handleMessage(guestId, { type: 'rematch' }, 6100);
  state = rm.getRoomState(code)!;
  assert.equal(state.bots.filter((b) => b.team === 'iron').length, 3);
  assert.equal(state.bots.filter((b) => b.team === 'crimson').length, 3);

  // Simulate Host leaving after match ends when Guest already voted -> Guest immediately triggers solo rematch with 4v4
  const guestSoloSnapsBefore = guestInbox.filter((m) => m.type === 'world_snapshot').length;
  rm.handleMessage(guestId, { type: 'rematch' }, 7000);
  rm.handleMessage(hostId, { type: 'leave_room' }, 7100);

  const soloState = rm.getRoomState(code)!;
  assert.equal(soloState.humans.length, 1);
  assert.equal(soloState.bots.filter((b) => b.team === 'iron').length, 4);
  assert.equal(soloState.bots.filter((b) => b.team === 'crimson').length, 3);
  assert.ok(guestInbox.filter((m) => m.type === 'world_snapshot').length > guestSoloSnapsBefore);
});


