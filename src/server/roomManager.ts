import { GameSimulation, emptyInput } from '../game/GameSimulation.ts';
import { getArenasForMode } from '../game/arenas/arenas.ts';
import type {
  BotDifficulty,
  GameModeId,
  HeroId,
  LobbyParticipant,
  PlayerInputState,
  TeamId,
  WorldSnapshot,
} from '../game/types.ts';
import type {
  ClientToServerMessage,
  RoomStatePayload,
  RoomSummary,
  ServerToClientMessage,
} from '../game/net/protocol.ts';

const TEAM_SIZE_BY_MODE: Record<GameModeId, number> = {
  duel_1v1: 1,
  brawl_2v2: 2,
  skirmish_3v3: 3,
  skirmish_4v4: 4,
  dominion: 4,
  stronghold: 4,
};

const BOT_NAMES_IRON = ['Takeda', 'Ragnar', 'Valkyr', 'Kage', 'Garrick', 'Soren'];
const BOT_NAMES_CRIMSON = ['Akuma', 'Draven', 'Yuki', 'Mordecai', 'Hana', 'Vex'];
const HERO_ROTATION: HeroId[] = ['varek', 'kurogane', 'sora', 'cedric', 'vesper', 'astrid'];
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface ClientConnection {
  id: string;
  name: string;
  roomCode: string | null;
  send: (msg: ServerToClientMessage) => void;
}

interface ManagedRoom {
  roomCode: string;
  hostId: string;
  mode: GameModeId;
  arenaId: string;
  difficulty: BotDifficulty;
  phase: 'LOBBY' | 'PLAYING';
  humans: Map<string, LobbyParticipant>;
  bots: LobbyParticipant[];
  customBotConfig: boolean;
  rematchVotes: Set<string>;
  sim: GameSimulation | null;
  inputs: Map<string, PlayerInputState>;
  createdAt: number;
  lastStepAt: number;
  lastBroadcastAt: number;
  endedBroadcasted: boolean;
}

function generateRoomCode(existing: Map<string, ManagedRoom>): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
    }
    if (!existing.has(code)) return code;
  }
  return `AR${Date.now().toString(36).slice(-3).toUpperCase()}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function compactSnapshot(snapshot: WorldSnapshot, nowMs = Date.now()): WorldSnapshot {
  return {
    ...snapshot,
    serverTimeMs: nowMs,
    fighters: snapshot.fighters.map(({ aiMemory: _ai, x, y, vx, vy, ...rest }) => ({
      ...rest,
      x: round1(x),
      y: round1(y),
      vx: round1(vx),
      vy: round1(vy),
    })),
    particles: snapshot.particles.slice(0, 24),
    callouts: snapshot.callouts.slice(0, 10),
  };
}

export class RoomManager {
  private clients = new Map<string, ClientConnection>();
  private rooms = new Map<string, ManagedRoom>();
  private clientSeq = 1;
  private botSeq = 1;

  registerClient(
    send: (msg: ServerToClientMessage) => void,
    initialName?: string
  ): string {
    const id = `p-${this.clientSeq++}-${Math.random().toString(36).slice(2, 6)}`;
    const client: ClientConnection = {
      id,
      name: (initialName || `Warrior ${this.clientSeq - 1}`).slice(0, 20),
      roomCode: null,
      send,
    };
    this.clients.set(id, client);
    send({ type: 'welcome', playerId: id });
    send({ type: 'room_list', rooms: this.listRooms() });
    return id;
  }

  unregisterClient(playerId: string): void {
    const client = this.clients.get(playerId);
    if (!client) return;
    if (client.roomCode) {
      this.removeClientFromRoom(client);
    }
    this.clients.delete(playerId);
  }

  listRooms(): RoomSummary[] {
    const out: RoomSummary[] = [];
    for (const room of this.rooms.values()) {
      const host = room.humans.get(room.hostId);
      const teamSize = TEAM_SIZE_BY_MODE[room.mode] ?? 4;
      out.push({
        roomCode: room.roomCode,
        hostName: host?.name || 'Host',
        mode: room.mode,
        arenaId: room.arenaId,
        difficulty: room.difficulty,
        phase: room.phase,
        humanCount: room.humans.size,
        botCount: room.bots.length,
        maxPlayers: Math.max(2, teamSize * 2),
        createdAt: room.createdAt,
      });
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  }

  getRoomState(roomCode: string): RoomStatePayload | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return null;
    const eligibleHumans = Array.from(room.humans.values()).filter((h) => h.inMatch !== false);
    return {
      roomCode: room.roomCode,
      hostId: room.hostId,
      mode: room.mode,
      arenaId: room.arenaId,
      difficulty: room.difficulty,
      phase: room.phase,
      humans: Array.from(room.humans.values()).map((h) => ({ ...h, isLocal: false })),
      bots: room.bots.map((b) => ({ ...b })),
      rematchVotes: Array.from(room.rematchVotes),
      rematchEligibleCount: eligibleHumans.length,
    };
  }

  handleMessage(playerId: string, msg: ClientToServerMessage, nowMs = Date.now()): void {
    const client = this.clients.get(playerId);
    if (!client) return;

    switch (msg.type) {
      case 'hello': {
        if (msg.name && msg.name.trim()) {
          client.name = msg.name.trim().slice(0, 20);
        }
        client.send({ type: 'room_list', rooms: this.listRooms() });
        return;
      }

      case 'list_rooms': {
        client.send({ type: 'room_list', rooms: this.listRooms() });
        return;
      }

      case 'create_room': {
        if (client.roomCode) {
          this.removeClientFromRoom(client);
        }
        if (msg.name && msg.name.trim()) {
          client.name = msg.name.trim().slice(0, 20);
        }
        const roomCode = generateRoomCode(this.rooms);
        const creator: LobbyParticipant = {
          id: client.id,
          name: client.name,
          isBot: false,
          isLocal: false,
          team: msg.team,
          heroId: msg.heroId,
          skinIndex: msg.skinIndex,
          ready: true,
          inMatch: false,
        };
        const allowedArenas = getArenasForMode(msg.mode);
        const resolvedArenaId = allowedArenas.some((a) => a.id === msg.arenaId)
          ? msg.arenaId
          : allowedArenas[0].id;
        const room: ManagedRoom = {
          roomCode,
          hostId: client.id,
          mode: msg.mode,
          arenaId: resolvedArenaId,
          difficulty: msg.difficulty,
          phase: 'LOBBY',
          humans: new Map([[client.id, creator]]),
          bots: [],
          customBotConfig: false,
          rematchVotes: new Set(),
          sim: null,
          inputs: new Map(),
          createdAt: nowMs,
          lastStepAt: nowMs,
          lastBroadcastAt: 0,
          endedBroadcasted: false,
        };
        this.applyAutoFillBots(room);
        this.rooms.set(roomCode, room);
        client.roomCode = roomCode;
        this.broadcastRoomState(room);
        this.broadcastRoomList();
        return;
      }

      case 'join_room': {
        const cleanCode = (msg.roomCode || '').trim().toUpperCase();
        const room = this.rooms.get(cleanCode);
        if (!room) {
          client.send({
            type: 'error_msg',
            code: 'ROOM_NOT_FOUND',
            message: `Room ${cleanCode} does not exist.`,
          });
          return;
        }
        const baseMax = Math.max(2, (TEAM_SIZE_BY_MODE[room.mode] ?? 4) * 2);
        const maxPlayers = Math.max(baseMax, room.humans.size + room.bots.length);
        if (room.humans.size >= maxPlayers) {
          client.send({
            type: 'error_msg',
            code: 'ROOM_FULL',
            message: `Room ${cleanCode} is full.`,
          });
          return;
        }

        if (room.phase === 'PLAYING') {
          const pendingLobbyHumans = Array.from(room.humans.values()).filter(
            (h) => !h.inMatch
          ).length;
          const availableBotSlots = room.bots.length - pendingLobbyHumans;
          if (availableBotSlots <= 0) {
            client.send({
              type: 'error_msg',
              code: 'MATCH_IN_PROGRESS',
              message: `Match in room ${cleanCode} is already in progress.`,
            });
            return;
          }
        }

        if (client.roomCode && client.roomCode !== cleanCode) {
          this.removeClientFromRoom(client);
        }
        if (msg.name && msg.name.trim()) {
          client.name = msg.name.trim().slice(0, 20);
        }

        const teamSize = TEAM_SIZE_BY_MODE[room.mode] ?? 4;
        const ironHumans = Array.from(room.humans.values()).filter((h) => h.team === 'iron').length;
        const crimsonHumans = Array.from(room.humans.values()).filter((h) => h.team === 'crimson').length;
        let assignedTeam: TeamId =
          msg.team ?? (ironHumans <= crimsonHumans ? 'iron' : 'crimson');

        if (room.phase === 'LOBBY') {
          if (assignedTeam === 'iron' && ironHumans >= teamSize && crimsonHumans < teamSize) {
            assignedTeam = 'crimson';
          } else if (assignedTeam === 'crimson' && crimsonHumans >= teamSize && ironHumans < teamSize) {
            assignedTeam = 'iron';
          }
        } else if (room.phase === 'PLAYING') {
          const ironBots = room.bots.filter((b) => b.team === 'iron').length;
          const crimsonBots = room.bots.filter((b) => b.team === 'crimson').length;
          if (!msg.team || (assignedTeam === 'iron' && ironBots === 0 && crimsonBots > 0) || (assignedTeam === 'crimson' && crimsonBots === 0 && ironBots > 0)) {
            assignedTeam = ironBots >= crimsonBots && ironBots > 0 ? 'iron' : 'crimson';
          }
        }

        const participant: LobbyParticipant = {
          id: client.id,
          name: client.name,
          isBot: false,
          isLocal: false,
          team: assignedTeam,
          heroId: msg.heroId,
          skinIndex: msg.skinIndex,
          ready: true,
          inMatch: false,
        };
        room.humans.set(client.id, participant);
        client.roomCode = cleanCode;

        // In pre-match LOBBY, rebalance bots so teams stay balanced at teamSize
        if (room.phase === 'LOBBY') {
          if (!room.customBotConfig) {
            this.rebalanceRoomBots(room);
          } else {
            const teamHumanCount = Array.from(room.humans.values()).filter(
              (h) => h.team === assignedTeam
            ).length;
            const teamBots = room.bots.filter((b) => b.team === assignedTeam);
            if (teamHumanCount + teamBots.length > teamSize && teamBots.length > 0) {
              const botToDrop = teamBots[teamBots.length - 1];
              room.bots = room.bots.filter((b) => b.id !== botToDrop.id);
            }
          }
        }

        this.broadcastRoomState(room);
        this.broadcastRoomList();
        return;
      }

      case 'leave_room': {
        this.removeClientFromRoom(client);
        client.send({ type: 'left_room' });
        this.broadcastRoomList();
        return;
      }

      case 'update_selection': {
        const room = client.roomCode ? this.rooms.get(client.roomCode) : undefined;
        if (!room) return;
        const participant = room.humans.get(client.id);
        if (!participant) return;
        if (msg.name && msg.name.trim()) {
          client.name = msg.name.trim().slice(0, 20);
          participant.name = client.name;
        }
        if (msg.heroId) participant.heroId = msg.heroId;
        if (typeof msg.skinIndex === 'number') participant.skinIndex = msg.skinIndex;

        if (msg.team && msg.team !== participant.team) {
          const prevTeam = participant.team;
          const nextTeam = msg.team;
          if (room.phase === 'LOBBY') {
            const teamSize = TEAM_SIZE_BY_MODE[room.mode] ?? 4;
            const destHumans = Array.from(room.humans.values()).filter(
              (h) => h.team === nextTeam
            ).length;
            if (destHumans < teamSize) {
              participant.team = nextTeam;
              if (!room.customBotConfig) {
                this.rebalanceRoomBots(room);
              } else {
                this.rebalanceAfterTeamSwap(room, prevTeam, nextTeam);
              }
            }
          } else {
            participant.team = nextTeam;
          }
        }
        this.broadcastRoomState(room);
        this.broadcastRoomList();
        return;
      }

      case 'update_room_config': {
        const room = client.roomCode ? this.rooms.get(client.roomCode) : undefined;
        if (!room) return;
        if (room.hostId !== client.id) {
          client.send({
            type: 'error_msg',
            code: 'NOT_HOST',
            message: 'Only the room host can update room configuration.',
          });
          return;
        }
        if (msg.mode && msg.mode !== room.mode) {
          room.mode = msg.mode;
          room.customBotConfig = false;
          this.applyAutoFillBots(room);
        }
        if (msg.arenaId) room.arenaId = msg.arenaId;
        if (msg.difficulty) room.difficulty = msg.difficulty;
        if (Array.isArray(msg.bots)) {
          room.bots = msg.bots.map((b) => ({ ...b, isBot: true }));
          room.customBotConfig = true;
        }
        this.broadcastRoomState(room);
        this.broadcastRoomList();
        return;
      }

      case 'auto_fill_bots': {
        const room = client.roomCode ? this.rooms.get(client.roomCode) : undefined;
        if (!room || room.hostId !== client.id) return;
        room.customBotConfig = false;
        this.applyAutoFillBots(room);
        this.broadcastRoomState(room);
        this.broadcastRoomList();
        return;
      }

      case 'add_bot': {
        const room = client.roomCode ? this.rooms.get(client.roomCode) : undefined;
        if (!room || room.hostId !== client.id) return;
        const teamCount =
          Array.from(room.humans.values()).filter((h) => h.team === msg.team).length +
          room.bots.filter((b) => b.team === msg.team).length;
        if (teamCount >= 4) return;
        room.customBotConfig = true;
        const botCountInTeam = room.bots.filter((b) => b.team === msg.team).length;
        const pool = msg.team === 'iron' ? BOT_NAMES_IRON : BOT_NAMES_CRIMSON;
        const usedNames = new Set(room.bots.map((b) => b.name));
        const botName = pool.find((n) => !usedNames.has(n)) ?? pool[botCountInTeam % pool.length];
        room.bots.push({
          id: `bot-${msg.team}-${this.botSeq++}`,
          name: botName,
          isBot: true,
          isLocal: false,
          team: msg.team,
          heroId: HERO_ROTATION[botCountInTeam % HERO_ROTATION.length],
          skinIndex: (botCountInTeam + (msg.team === 'crimson' ? 1 : 0)) % 4,
          ready: true,
        });
        this.broadcastRoomState(room);
        this.broadcastRoomList();
        return;
      }

      case 'remove_bot': {
        const room = client.roomCode ? this.rooms.get(client.roomCode) : undefined;
        if (!room || room.hostId !== client.id) return;
        room.customBotConfig = true;
        room.bots = room.bots.filter((b) => b.id !== msg.botId);
        this.broadcastRoomState(room);
        this.broadcastRoomList();
        return;
      }

      case 'start_match': {
        const room = client.roomCode ? this.rooms.get(client.roomCode) : undefined;
        if (!room) return;
        if (room.hostId !== client.id) {
          client.send({
            type: 'error_msg',
            code: 'NOT_HOST',
            message: 'Only the room host can launch the battle.',
          });
          return;
        }
        this.launchRoomMatch(room, nowMs);
        return;
      }

      case 'rematch': {
        const room = client.roomCode ? this.rooms.get(client.roomCode) : undefined;
        if (!room) return;
        const participant = room.humans.get(client.id);
        if (!participant || participant.inMatch === false) return;

        const eligibleHumans = Array.from(room.humans.values()).filter((h) => h.inMatch !== false);
        if (eligibleHumans.length <= 1) {
          this.launchRoomMatch(room, nowMs);
          return;
        }

        if (room.rematchVotes.has(client.id)) {
          room.rematchVotes.delete(client.id);
        } else {
          room.rematchVotes.add(client.id);
        }

        const allVoted = eligibleHumans.every((h) => room.rematchVotes.has(h.id));
        if (allVoted) {
          this.launchRoomMatch(room, nowMs);
        } else {
          this.broadcastRoomState(room);
        }
        return;
      }

      case 'join_live_match': {
        const room = client.roomCode ? this.rooms.get(client.roomCode) : undefined;
        if (!room || room.phase !== 'PLAYING' || !room.sim) return;
        const participant = room.humans.get(client.id);
        if (!participant || participant.inMatch) return;

        const targetBot =
          (msg.botId ? room.bots.find((b) => b.id === msg.botId) : undefined) ??
          room.bots.find((b) => b.team === participant.team) ??
          room.bots[room.bots.length - 1];

        if (!targetBot) {
          client.send({
            type: 'error_msg',
            code: 'MATCH_IN_PROGRESS',
            message: 'No bot slots remaining in this ongoing match.',
          });
          return;
        }

        participant.team = targetBot.team;
        participant.inMatch = true;
        room.bots = room.bots.filter((b) => b.id !== targetBot.id);
        room.sim.replaceBotWithHuman(targetBot.id, participant);

        client.send({
          type: 'world_snapshot',
          snapshot: compactSnapshot(room.sim.getSnapshot(), nowMs),
        });
        this.broadcastRoomState(room);
        this.broadcastRoomList();
        return;
      }

      case 'return_lobby': {
        const room = client.roomCode ? this.rooms.get(client.roomCode) : undefined;
        if (!room) return;
        if (room.hostId !== client.id) {
          client.send({
            type: 'error_msg',
            code: 'NOT_HOST',
            message: 'Only the room host can return the room to lobby.',
          });
          return;
        }
        room.phase = 'LOBBY';
        room.sim = null;
        room.inputs.clear();
        room.rematchVotes.clear();
        room.endedBroadcasted = false;
        for (const h of room.humans.values()) {
          h.inMatch = false;
        }
        if (!room.customBotConfig) {
          this.rebalanceRoomBots(room);
        }
        this.broadcastRoomState(room);
        this.broadcastRoomList();
        return;
      }

      case 'player_input': {
        const room = client.roomCode ? this.rooms.get(client.roomCode) : undefined;
        if (!room || room.phase !== 'PLAYING' || !msg.input) return;
        const prev = room.inputs.get(client.id);
        const nextInp: PlayerInputState = prev
          ? {
              ...msg.input,
              jumpPressed: prev.jumpPressed || msg.input.jumpPressed,
              dashPressed: prev.dashPressed || msg.input.dashPressed,
              lightPressed: prev.lightPressed || msg.input.lightPressed,
              heavyPressed: prev.heavyPressed || msg.input.heavyPressed,
              parryPressed: prev.parryPressed || msg.input.parryPressed,
              feintPressed: prev.feintPressed || msg.input.feintPressed,
              counterPressed: prev.counterPressed || msg.input.counterPressed,
            }
          : { ...msg.input };
        room.inputs.set(client.id, nextInp);
        if (
          msg.input.jumpPressed ||
          msg.input.dashPressed ||
          msg.input.lightPressed ||
          msg.input.heavyPressed ||
          msg.input.parryPressed ||
          msg.input.feintPressed ||
          msg.input.counterPressed ||
          !prev ||
          prev.moveX !== msg.input.moveX ||
          prev.guardDir !== msg.input.guardDir
        ) {
          room.lastBroadcastAt = 0;
        }
        return;
      }
    }
  }

  tick(nowMs = Date.now()): void {
    for (const room of this.rooms.values()) {
      if (room.phase !== 'PLAYING' || !room.sim) continue;

      const rawDt = nowMs - room.lastStepAt;
      if (rawDt <= 0) continue;
      const dtMs = Math.min(200, rawDt);
      room.lastStepAt = nowMs;

      const subSteps = Math.max(1, Math.ceil(dtMs / 20));
      const subDt = dtMs / subSteps;

      for (let s = 0; s < subSteps; s++) {
        const stepInputs: Record<string, PlayerInputState> = {};
        for (const humanId of room.humans.keys()) {
          const inp = room.inputs.get(humanId);
          if (!inp) {
            stepInputs[humanId] = emptyInput();
            continue;
          }
          if (s === 0) {
            stepInputs[humanId] = { ...inp };
            // Clear edge-triggered actions once consumed by substep 0
            inp.jumpPressed = false;
            inp.dashPressed = false;
            inp.lightPressed = false;
            inp.heavyPressed = false;
            inp.parryPressed = false;
            inp.feintPressed = false;
            inp.counterPressed = false;
          } else {
            stepInputs[humanId] = {
              ...inp,
              jumpPressed: false,
              dashPressed: false,
              lightPressed: false,
              heavyPressed: false,
              parryPressed: false,
              feintPressed: false,
              counterPressed: false,
            };
          }
        }
        room.sim.step(subDt, stepInputs);
      }

      const snap = room.sim.getSnapshot();
      const shouldBroadcastEnded = snap.phase === 'ended' && !room.endedBroadcasted;
      if (shouldBroadcastEnded || nowMs - room.lastBroadcastAt >= 16) {
        room.lastBroadcastAt = nowMs;
        if (snap.phase === 'ended') room.endedBroadcasted = true;
        const compact = compactSnapshot(snap, nowMs);
        this.broadcastToMatchPlayers(room, { type: 'world_snapshot', snapshot: compact });
      }
    }
  }

  private launchRoomMatch(room: ManagedRoom, nowMs: number): void {
    const teamSize = TEAM_SIZE_BY_MODE[room.mode] ?? 4;

    // Normalize pending lobby humans so none enter rematch with duplicate bot slots
    for (const h of room.humans.values()) {
      h.inMatch = true;
    }

    if (!room.customBotConfig) {
      this.rebalanceRoomBots(room);
    } else {
      const ironCount =
        Array.from(room.humans.values()).filter((h) => h.team === 'iron').length +
        room.bots.filter((b) => b.team === 'iron').length;
      const crimsonCount =
        Array.from(room.humans.values()).filter((h) => h.team === 'crimson').length +
        room.bots.filter((b) => b.team === 'crimson').length;

      if (ironCount === 0 || crimsonCount === 0) {
        this.rebalanceRoomBots(room);
      } else if (ironCount !== crimsonCount) {
        const target = Math.min(teamSize, Math.max(ironCount, crimsonCount));
        this.rebalanceTeamToTarget(room, 'iron', target);
        this.rebalanceTeamToTarget(room, 'crimson', target);
      }
    }

    const roster: LobbyParticipant[] = [
      ...Array.from(room.humans.values()).map((h) => ({ ...h })),
      ...room.bots.map((b) => ({ ...b })),
    ];

    room.phase = 'PLAYING';
    room.inputs.clear();
    room.rematchVotes.clear();
    room.endedBroadcasted = false;
    room.lastStepAt = nowMs;
    room.lastBroadcastAt = nowMs;
    room.sim = new GameSimulation(room.mode, room.arenaId, room.difficulty, roster);

    this.broadcastRoomState(room);
    this.broadcastRoomList();
    this.broadcastToMatchPlayers(room, {
      type: 'world_snapshot',
      snapshot: compactSnapshot(room.sim.getSnapshot(), nowMs),
    });
  }

  private createBotForTeam(room: ManagedRoom, team: TeamId, indexHint: number): LobbyParticipant {
    const botName = this.pickAvailableBotName(room, team);
    return {
      id: `bot-${team}-${this.botSeq++}`,
      name: botName,
      isBot: true,
      isLocal: false,
      team,
      heroId: HERO_ROTATION[(indexHint + (team === 'iron' ? 1 : 0)) % HERO_ROTATION.length],
      skinIndex: (indexHint + (team === 'crimson' ? 1 : 0)) % 4,
      ready: true,
    };
  }

  private rebalanceTeamToTarget(room: ManagedRoom, team: TeamId, targetTotal: number): void {
    const humansInTeam = Array.from(room.humans.values()).filter((h) => h.team === team).length;
    const desiredBots = Math.max(0, targetTotal - humansInTeam);
    const teamBots = room.bots.filter((b) => b.team === team);
    const otherBots = room.bots.filter((b) => b.team !== team);

    if (teamBots.length > desiredBots) {
      room.bots = [...otherBots, ...teamBots.slice(0, desiredBots)];
      return;
    }

    const nextBots = [...otherBots, ...teamBots];
    while (nextBots.filter((b) => b.team === team).length < desiredBots) {
      const idx = nextBots.filter((b) => b.team === team).length;
      const newBot = this.createBotForTeam(
        { ...room, bots: nextBots },
        team,
        idx
      );
      nextBots.push(newBot);
    }
    room.bots = nextBots;
  }

  private rebalanceRoomBots(room: ManagedRoom): void {
    const teamSize = TEAM_SIZE_BY_MODE[room.mode] ?? 4;
    this.rebalanceTeamToTarget(room, 'iron', teamSize);
    this.rebalanceTeamToTarget(room, 'crimson', teamSize);
  }

  private rebalanceAfterTeamSwap(room: ManagedRoom, prevTeam: TeamId, nextTeam: TeamId): void {
    const teamSize = TEAM_SIZE_BY_MODE[room.mode] ?? 4;
    const prevBots = room.bots.filter((b) => b.team === prevTeam);
    const nextBots = room.bots.filter((b) => b.team === nextTeam);
    const nextHumans = Array.from(room.humans.values()).filter((h) => h.team === nextTeam).length;

    if ((nextHumans + nextBots.length > teamSize || prevBots.length < teamSize) && nextBots.length > 0) {
      const drop = nextBots[nextBots.length - 1];
      room.bots = room.bots.filter((b) => b.id !== drop.id);
    }

    const prevHumans = Array.from(room.humans.values()).filter((h) => h.team === prevTeam).length;
    if (prevHumans + prevBots.length < teamSize) {
      room.bots.push(this.createBotForTeam(room, prevTeam, prevBots.length));
    }
  }

  private applyAutoFillBots(room: ManagedRoom): void {
    room.bots = [];
    this.rebalanceRoomBots(room);
  }

  private pickAvailableBotName(room: ManagedRoom, team: TeamId): string {
    const pool = team === 'iron' ? BOT_NAMES_IRON : BOT_NAMES_CRIMSON;
    const usedNames = new Set<string>();
    for (const b of room.bots) {
      usedNames.add(b.name);
    }
    if (room.sim) {
      for (const f of room.sim.getSnapshot().fighters) {
        usedNames.add(f.name);
      }
    }
    for (const candidate of pool) {
      if (!usedNames.has(candidate)) return candidate;
    }
    return `${pool[0]} ${this.botSeq++}`;
  }

  private removeClientFromRoom(client: ClientConnection): void {
    const code = client.roomCode;
    if (!code) return;
    client.roomCode = null;
    const room = this.rooms.get(code);
    if (!room) return;

    const leavingParticipant = room.humans.get(client.id);
    room.humans.delete(client.id);
    room.inputs.delete(client.id);
    room.rematchVotes.delete(client.id);

    if (room.humans.size === 0) {
      room.sim = null;
      this.rooms.delete(code);
      this.broadcastRoomList();
      return;
    }

    if (room.hostId === client.id) {
      const nextActiveHost = Array.from(room.humans.values()).find((h) => h.inMatch)?.id;
      const nextHost = nextActiveHost ?? room.humans.keys().next().value;
      if (nextHost) room.hostId = nextHost;
    }

    if (room.phase === 'LOBBY' && leavingParticipant) {
      if (!room.customBotConfig) {
        this.rebalanceRoomBots(room);
      } else {
        const teamSize = TEAM_SIZE_BY_MODE[room.mode] ?? 4;
        const leftTeam = leavingParticipant.team;
        const teamHumans = Array.from(room.humans.values()).filter((h) => h.team === leftTeam).length;
        const teamBots = room.bots.filter((b) => b.team === leftTeam).length;
        if (teamHumans + teamBots < teamSize) {
          room.bots.push(this.createBotForTeam(room, leftTeam, teamBots));
        }
      }
    }

    // If disconnecting during active match, convert remaining fighter entity to Bot AI so teams stay balanced
    if (room.sim) {
      const snap = room.sim.getSnapshot();
      const existingFighter = snap.fighters.find((f) => f.id === client.id);
      if (existingFighter) {
        const botName = this.pickAvailableBotName(room, existingFighter.team);
        const botFighter = room.sim.convertHumanToBot(client.id, botName);
        if (botFighter && !room.bots.some((b) => b.id === botFighter.id)) {
          room.bots.push({
            id: botFighter.id,
            name: botFighter.name,
            isBot: true,
            isLocal: false,
            team: botFighter.team,
            heroId: botFighter.heroId,
            skinIndex: botFighter.skinIndex,
            ready: true,
            inMatch: true,
          });
        }
        room.lastBroadcastAt = 0;
        this.broadcastToMatchPlayers(room, {
          type: 'world_snapshot',
          snapshot: compactSnapshot(room.sim.getSnapshot(), Date.now()),
        });
      }

      if (snap.phase === 'ended') {
        const eligibleHumans = Array.from(room.humans.values()).filter((h) => h.inMatch !== false);
        if (
          eligibleHumans.length > 0 &&
          room.rematchVotes.size > 0 &&
          eligibleHumans.every((h) => room.rematchVotes.has(h.id))
        ) {
          this.launchRoomMatch(room, Date.now());
          return;
        }
      }
    }

    this.broadcastRoomState(room);
    this.broadcastRoomList();
  }

  private broadcastToRoom(room: ManagedRoom, msg: ServerToClientMessage): void {
    for (const humanId of room.humans.keys()) {
      const conn = this.clients.get(humanId);
      if (conn) conn.send(msg);
    }
  }

  private broadcastToMatchPlayers(room: ManagedRoom, msg: ServerToClientMessage): void {
    for (const [humanId, participant] of room.humans.entries()) {
      if (participant.inMatch === false) continue;
      const conn = this.clients.get(humanId);
      if (conn) conn.send(msg);
    }
  }

  private broadcastRoomState(room: ManagedRoom): void {
    const state = this.getRoomState(room.roomCode);
    if (!state) return;
    this.broadcastToRoom(room, { type: 'room_state', room: state });
  }

  private broadcastRoomList(): void {
    const rooms = this.listRooms();
    for (const client of this.clients.values()) {
      if (!client.roomCode) {
        client.send({ type: 'room_list', rooms });
      }
    }
  }
}
