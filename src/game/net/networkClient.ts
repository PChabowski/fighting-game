import {
  BotDifficulty,
  GameModeId,
  HeroId,
  LobbyParticipant,
  PlayerInputState,
  TeamId,
  WorldSnapshot,
} from '../types';
import {
  ClientToServerMessage,
  RoomStatePayload,
  RoomSummary,
  ServerErrorCode,
  ServerToClientMessage,
} from './protocol';

export type NetworkTransport = 'idle' | 'online' | 'local';

export interface RoomConnectionResult {
  mode: 'online' | 'local';
  roomCode: string;
  localId: string;
  errorMessage?: string;
}

class ArenaNetworkClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectPromise: Promise<string> | null = null;
  private transport: NetworkTransport = 'idle';
  private localId = 'local-player-1';
  private playerName = 'Wojownik';
  private roomState: RoomStatePayload | null = null;
  private rooms: RoomSummary[] = [];
  private latestSnapshot: WorldSnapshot | null = null;
  private lastError: { code: ServerErrorCode; message: string } | null = null;

  private roomStateListeners = new Set<(room: RoomStatePayload | null) => void>();
  private roomListListeners = new Set<(rooms: RoomSummary[]) => void>();
  private snapshotListeners = new Set<(snap: WorldSnapshot) => void>();
  private errorListeners = new Set<(err: { code: ServerErrorCode; message: string }) => void>();

  private pendingActionResolvers: Array<{
    onRoom: (room: RoomStatePayload) => void;
    onError: (err: { code: ServerErrorCode; message: string }) => void;
  }> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const notifyLeave = () => {
        if (this.transport === 'online' && this.roomState && this.ws?.readyState === WebSocket.OPEN) {
          this.send({ type: 'leave_room' });
        }
      };
      window.addEventListener('pagehide', notifyLeave);
      window.addEventListener('beforeunload', notifyLeave);
    }
  }

  getTransport(): NetworkTransport {
    return this.transport;
  }

  getLocalPlayerId(): string {
    return this.localId;
  }

  getRoomState(): RoomStatePayload | null {
    return this.roomState;
  }

  getRooms(): RoomSummary[] {
    return this.rooms;
  }

  getLatestSnapshot(): WorldSnapshot | null {
    return this.latestSnapshot;
  }

  isOnline(): boolean {
    return this.transport === 'online';
  }

  isAuthoritativeHost(): boolean {
    if (this.transport !== 'online') return true;
    return this.roomState?.hostId === this.localId;
  }

  getActiveRoomCode(): string {
    if (this.transport === 'online' && this.roomState) {
      return this.roomState.roomCode;
    }
    return 'LOCAL';
  }

  setPlayerName(name: string): void {
    const clean = name.trim().slice(0, 20);
    if (!clean) return;
    this.playerName = clean;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: 'update_selection', name: clean });
    }
  }

  getPlayerName(): string {
    return this.playerName;
  }

  subscribeRoomState(cb: (room: RoomStatePayload | null) => void): () => void {
    this.roomStateListeners.add(cb);
    return () => this.roomStateListeners.delete(cb);
  }

  subscribeRoomList(cb: (rooms: RoomSummary[]) => void): () => void {
    this.roomListListeners.add(cb);
    return () => this.roomListListeners.delete(cb);
  }

  subscribeSnapshots(cb: (snap: WorldSnapshot) => void): () => void {
    this.snapshotListeners.add(cb);
    return () => this.snapshotListeners.delete(cb);
  }

  subscribeErrors(cb: (err: { code: ServerErrorCode; message: string }) => void): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  private getWsUrl(): string {
    if (typeof window === 'undefined') return 'ws://localhost:3000/ws';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  async ensureSocketConnected(): Promise<string> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.localId;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<string>((resolve, reject) => {
      const url = this.getWsUrl();
      const ws = new WebSocket(url);
      this.ws = ws;
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          this.connectPromise = null;
          try {
            ws.close();
          } catch {
            // ignore
          }
          reject(new Error('WebSocket connection timeout'));
        }
      }, 6000);

      ws.onopen = () => {
        this.startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as ServerToClientMessage;
          if (msg.type === 'pong') return;
          if (msg.type === 'welcome') {
            this.localId = msg.playerId;
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              this.connectPromise = null;
              resolve(msg.playerId);
            }
            return;
          }
          this.handleServerMessage(msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          this.connectPromise = null;
          reject(new Error('WebSocket error'));
        }
      };

      ws.onclose = () => {
        if (this.ws === ws) {
          this.ws = null;
          this.stopHeartbeat();
        }
        this.connectPromise = null;
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          reject(new Error('WebSocket closed before welcome'));
        }
        const pending = this.pendingActionResolvers.splice(0);
        pending.forEach((p) =>
          p.onError({ code: 'BAD_REQUEST', message: 'Connection closed' })
        );
      };
    });

    return this.connectPromise;
  }

  private handleServerMessage(msg: ServerToClientMessage): void {
    switch (msg.type) {
      case 'pong': {
        break;
      }
      case 'room_list': {
        this.rooms = msg.rooms;
        this.roomListListeners.forEach((cb) => cb(msg.rooms));
        break;
      }
      case 'room_state': {
        this.roomState = msg.room;
        this.transport = 'online';
        this.roomStateListeners.forEach((cb) => cb(msg.room));
        const pending = this.pendingActionResolvers.splice(0);
        pending.forEach((p) => p.onRoom(msg.room));
        break;
      }
      case 'left_room': {
        this.roomState = null;
        this.latestSnapshot = null;
        this.transport = 'idle';
        this.roomStateListeners.forEach((cb) => cb(null));
        break;
      }
      case 'world_snapshot': {
        this.latestSnapshot = msg.snapshot;
        this.snapshotListeners.forEach((cb) => cb(msg.snapshot));
        break;
      }
      case 'error_msg': {
        this.lastError = { code: msg.code, message: msg.message };
        this.errorListeners.forEach((cb) => cb(this.lastError!));
        const pending = this.pendingActionResolvers.splice(0);
        pending.forEach((p) => p.onError(this.lastError!));
        break;
      }
    }
  }

  private send(msg: ClientToServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  async refreshRoomList(): Promise<RoomSummary[]> {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'list_rooms' });
      }
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = (await res.json()) as { rooms?: RoomSummary[] };
        if (Array.isArray(data.rooms)) {
          this.rooms = data.rooms;
          this.roomListListeners.forEach((cb) => cb(this.rooms));
        }
      }
    } catch {
      // ignore network error while polling
    }
    return this.rooms;
  }

  createLocalRoomSession(): RoomConnectionResult {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.roomState) {
      this.send({ type: 'leave_room' });
    }
    this.transport = 'local';
    this.localId = 'local-player-1';
    this.roomState = null;
    this.latestSnapshot = null;
    return {
      mode: 'local',
      roomCode: 'LOCAL-BOT',
      localId: this.localId,
    };
  }

  async createOnlineRoom(options: {
    name?: string;
    mode: GameModeId;
    arenaId: string;
    difficulty: BotDifficulty;
    heroId: HeroId;
    skinIndex: number;
    team: TeamId;
  }): Promise<RoomConnectionResult> {
    await this.ensureSocketConnected();
    this.latestSnapshot = null;
    if (options.name) this.playerName = options.name;

    return new Promise<RoomConnectionResult>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Create room timeout')), 5000);
      this.pendingActionResolvers.push({
        onRoom: (room) => {
          clearTimeout(timer);
          resolve({
            mode: 'online',
            roomCode: room.roomCode,
            localId: this.localId,
          });
        },
        onError: (err) => {
          clearTimeout(timer);
          reject(new Error(err.message));
        },
      });
      this.send({
        type: 'create_room',
        name: this.playerName,
        mode: options.mode,
        arenaId: options.arenaId,
        difficulty: options.difficulty,
        heroId: options.heroId,
        skinIndex: options.skinIndex,
        team: options.team,
      });
    });
  }

  async joinOnlineRoom(options: {
    roomCode: string;
    name?: string;
    heroId: HeroId;
    skinIndex: number;
    team?: TeamId;
  }): Promise<RoomConnectionResult> {
    await this.ensureSocketConnected();
    this.latestSnapshot = null;
    if (options.name) this.playerName = options.name;

    return new Promise<RoomConnectionResult>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Join room timeout')), 5000);
      this.pendingActionResolvers.push({
        onRoom: (room) => {
          clearTimeout(timer);
          resolve({
            mode: 'online',
            roomCode: room.roomCode,
            localId: this.localId,
          });
        },
        onError: (err) => {
          clearTimeout(timer);
          reject(new Error(err.message));
        },
      });
      this.send({
        type: 'join_room',
        roomCode: options.roomCode.trim().toUpperCase(),
        name: this.playerName,
        heroId: options.heroId,
        skinIndex: options.skinIndex,
        team: options.team,
      });
    });
  }

  disconnectRoom(): void {
    if (this.transport === 'online' && this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'leave_room' });
    }
    this.roomState = null;
    this.latestSnapshot = null;
    this.transport = 'idle';
  }

  setMyLobbySelection(heroId: HeroId, skinIndex: number, team: TeamId, name?: string): void {
    if (name) this.playerName = name;
    if (this.transport !== 'online') return;
    this.send({ type: 'update_selection', heroId, skinIndex, team, name });
  }

  pushHostRoomConfig(patch: {
    mode?: GameModeId;
    arenaId?: string;
    difficulty?: BotDifficulty;
    bots?: LobbyParticipant[];
  }): void {
    if (this.transport !== 'online' || !this.isAuthoritativeHost()) return;
    this.send({ type: 'update_room_config', ...patch });
  }

  requestAutoFillBots(): void {
    if (this.transport !== 'online' || !this.isAuthoritativeHost()) return;
    this.send({ type: 'auto_fill_bots' });
  }

  requestAddBot(team: TeamId): void {
    if (this.transport !== 'online' || !this.isAuthoritativeHost()) return;
    this.send({ type: 'add_bot', team });
  }

  requestRemoveBot(botId: string): void {
    if (this.transport !== 'online' || !this.isAuthoritativeHost()) return;
    this.send({ type: 'remove_bot', botId });
  }

  requestStartMatch(): void {
    if (this.transport !== 'online' || !this.isAuthoritativeHost()) return;
    this.send({ type: 'start_match' });
  }

  requestJoinLiveMatch(botId?: string): void {
    if (this.transport !== 'online') return;
    this.send({ type: 'join_live_match', botId });
  }

  requestRematch(): void {
    if (this.transport !== 'online') return;
    this.send({ type: 'rematch' });
  }

  requestReturnLobby(): void {
    if (this.transport !== 'online' || !this.isAuthoritativeHost()) return;
    this.send({ type: 'return_lobby' });
  }

  sendPlayerInput(input: PlayerInputState): void {
    if (this.transport !== 'online') return;
    this.send({ type: 'player_input', input });
  }
}

export const networkClient = new ArenaNetworkClient();
