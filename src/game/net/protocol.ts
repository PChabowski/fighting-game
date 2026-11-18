import type {
  BotDifficulty,
  GameModeId,
  HeroId,
  LobbyParticipant,
  PlayerInputState,
  TeamId,
  WorldSnapshot,
} from '../types.ts';

export interface RoomSummary {
  roomCode: string;
  hostName: string;
  mode: GameModeId;
  arenaId: string;
  difficulty: BotDifficulty;
  phase: 'LOBBY' | 'PLAYING';
  humanCount: number;
  botCount: number;
  maxPlayers: number;
  createdAt: number;
}

export interface RoomStatePayload {
  roomCode: string;
  hostId: string;
  mode: GameModeId;
  arenaId: string;
  difficulty: BotDifficulty;
  phase: 'LOBBY' | 'PLAYING';
  humans: LobbyParticipant[];
  bots: LobbyParticipant[];
  rematchVotes?: string[];
  rematchEligibleCount?: number;
}

export type ClientToServerMessage =
  | { type: 'ping' }
  | { type: 'hello'; name?: string }
  | { type: 'list_rooms' }
  | {
      type: 'create_room';
      name?: string;
      mode: GameModeId;
      arenaId: string;
      difficulty: BotDifficulty;
      heroId: HeroId;
      skinIndex: number;
      team: TeamId;
    }
  | {
      type: 'join_room';
      roomCode: string;
      name?: string;
      heroId: HeroId;
      skinIndex: number;
      team?: TeamId;
    }
  | { type: 'leave_room' }
  | {
      type: 'update_selection';
      name?: string;
      heroId?: HeroId;
      skinIndex?: number;
      team?: TeamId;
    }
  | {
      type: 'update_room_config';
      mode?: GameModeId;
      arenaId?: string;
      difficulty?: BotDifficulty;
      bots?: LobbyParticipant[];
    }
  | { type: 'auto_fill_bots' }
  | { type: 'add_bot'; team: TeamId }
  | { type: 'remove_bot'; botId: string }
  | { type: 'start_match' }
  | { type: 'join_live_match'; botId?: string }
  | { type: 'rematch' }
  | { type: 'return_lobby' }
  | { type: 'player_input'; input: PlayerInputState };

export type ServerErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'MATCH_IN_PROGRESS'
  | 'NOT_HOST'
  | 'BAD_REQUEST';

export type ServerToClientMessage =
  | { type: 'pong' }
  | { type: 'welcome'; playerId: string }
  | { type: 'room_list'; rooms: RoomSummary[] }
  | { type: 'room_state'; room: RoomStatePayload }
  | { type: 'left_room' }
  | { type: 'world_snapshot'; snapshot: WorldSnapshot }
  | { type: 'error_msg'; code: ServerErrorCode; message: string };
