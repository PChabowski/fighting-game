import { create } from 'zustand';
import { MODES } from '../i18n/translations';
import { getArenasForMode } from '../game/arenas/arenas';
import {
  AudioMixerConfig,
  BotDifficulty,
  ControlScheme,
  GameModeId,
  HeroId,
  Language,
  LobbyParticipant,
  ScreenState,
  TeamId,
  TouchControlsMode,
  WorldSnapshot,
} from '../game/types';
import { soundEngine } from '../game/audio/soundEngine';

const BOT_NAMES_IRON = ['Takeda', 'Ragnar', 'Valkyr', 'Kage', 'Garrick', 'Soren'];
const BOT_NAMES_CRIMSON = ['Akuma', 'Draven', 'Yuki', 'Mordecai', 'Hana', 'Vex'];
const HERO_ROTATION: HeroId[] = ['varek', 'kurogane', 'sora'];

export type NetworkStatus = 'idle' | 'connecting' | 'online' | 'local';

interface AppStore {
  language: Language;
  screen: ScreenState;
  preloadProgress: number;

  selectedMode: GameModeId;
  selectedArenaId: string;
  botDifficulty: BotDifficulty;
  controlScheme: ControlScheme;
  playerName: string;

  localHeroId: HeroId;
  localSkinIndex: number;
  localTeam: TeamId;

  networkStatus: NetworkStatus;
  networkError: string | null;
  roomCode: string;
  localPlayerId: string;
  bots: LobbyParticipant[];
  matchRunId: number;

  audioMixer: AudioMixerConfig;
  audioModalOpen: boolean;
  touchControlsMode: TouchControlsMode;
  gamepadConnected: boolean;
  gamepadName: string;
  snapshot: WorldSnapshot | null;

  setLanguage: (lang: Language) => void;
  setScreen: (screen: ScreenState) => void;
  setPreloadProgress: (pct: number) => void;
  selectMode: (mode: GameModeId) => void;
  selectArena: (arenaId: string) => void;
  setBotDifficulty: (diff: BotDifficulty) => void;
  setControlScheme: (scheme: ControlScheme) => void;
  setTouchControlsMode: (mode: TouchControlsMode) => void;
  setGamepadStatus: (connected: boolean, name?: string) => void;
  setPlayerName: (name: string) => void;
  setLocalSelection: (patch: Partial<{ heroId: HeroId; skinIndex: number; team: TeamId }>) => void;
  setNetworkConnection: (
    status: NetworkStatus,
    roomCode: string,
    localPlayerId: string
  ) => void;
  setNetworkError: (err: string | null) => void;
  setBots: (bots: LobbyParticipant[]) => void;
  autoFillBots: (humanCountByTeam: { iron: number; crimson: number }) => void;
  addSingleBot: (team: TeamId) => void;
  removeBot: (id: string) => void;
  swapLocalTeamAndRebalance: () => void;
  triggerRematch: () => void;
  updateAudioMixer: (patch: Partial<AudioMixerConfig>) => void;
  toggleMute: () => void;
  setAudioModalOpen: (open: boolean) => void;
  setSnapshot: (snapshot: WorldSnapshot | null) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  language: 'pl',
  screen: 'PRELOAD',
  preloadProgress: 0,

  selectedMode: 'dominion',
  selectedArenaId: 'iron_sanctum',
  botDifficulty: 'veteran',
  controlScheme: 'mouse',
  playerName: 'Wojownik',

  localHeroId: 'kurogane',
  localSkinIndex: 0,
  localTeam: 'iron',

  networkStatus: 'idle',
  networkError: null,
  roomCode: '',
  localPlayerId: 'local-player-1',
  bots: [],
  matchRunId: 1,

  audioMixer: {
    muted: false,
    master: 0.7,
    music: 0.45,
    sfx: 0.85,
    ambient: 0.75,
  },
  audioModalOpen: false,
  touchControlsMode: 'auto',
  gamepadConnected: false,
  gamepadName: '',
  snapshot: null,

  setLanguage: (language) => set({ language }),
  setScreen: (screen) => set({ screen }),
  setPreloadProgress: (preloadProgress) => set({ preloadProgress }),

  selectMode: (mode) => {
    const meta = MODES.find((m) => m.id === mode);
    const available = getArenasForMode(mode);
    const preferred =
      meta && available.some((a) => a.id === meta.defaultArenaId)
        ? meta.defaultArenaId
        : available[0].id;
    set({
      selectedMode: mode,
      selectedArenaId: preferred,
    });
  },

  selectArena: (arenaId) => {
    const { selectedMode } = get();
    const available = getArenasForMode(selectedMode);
    if (available.some((a) => a.id === arenaId)) {
      set({ selectedArenaId: arenaId });
    }
  },
  setBotDifficulty: (botDifficulty) => set({ botDifficulty }),
  setControlScheme: (controlScheme) => set({ controlScheme }),
  setTouchControlsMode: (touchControlsMode) => set({ touchControlsMode }),
  setGamepadStatus: (gamepadConnected, gamepadName = '') =>
    set({ gamepadConnected, gamepadName }),
  setPlayerName: (playerName) => set({ playerName }),

  setLocalSelection: (patch) =>
    set((s) => ({
      localHeroId: patch.heroId ?? s.localHeroId,
      localSkinIndex: patch.skinIndex ?? s.localSkinIndex,
      localTeam: patch.team ?? s.localTeam,
    })),

  setNetworkConnection: (networkStatus, roomCode, localPlayerId) =>
    set({ networkStatus, roomCode, localPlayerId, networkError: null }),

  setNetworkError: (networkError) => set({ networkError }),

  setBots: (bots) => set({ bots }),

  autoFillBots: (humanCountByTeam) => {
    const { selectedMode } = get();
    const meta = MODES.find((m) => m.id === selectedMode) || MODES[0];
    const teamSize = meta.teamSize;
    const bots: LobbyParticipant[] = [];

    const ironNeeded = Math.max(0, teamSize - humanCountByTeam.iron);
    const crimsonNeeded = Math.max(0, teamSize - humanCountByTeam.crimson);

    for (let i = 0; i < ironNeeded; i++) {
      bots.push({
        id: `bot-iron-${i + 1}-${Date.now()}`,
        name: BOT_NAMES_IRON[i % BOT_NAMES_IRON.length],
        isBot: true,
        isLocal: false,
        team: 'iron',
        heroId: HERO_ROTATION[(i + 1) % HERO_ROTATION.length],
        skinIndex: i % 4,
        ready: true,
      });
    }

    for (let i = 0; i < crimsonNeeded; i++) {
      bots.push({
        id: `bot-crimson-${i + 1}-${Date.now()}`,
        name: BOT_NAMES_CRIMSON[i % BOT_NAMES_CRIMSON.length],
        isBot: true,
        isLocal: false,
        team: 'crimson',
        heroId: HERO_ROTATION[i % HERO_ROTATION.length],
        skinIndex: (i + 1) % 4,
        ready: true,
      });
    }

    set({ bots });
  },

  addSingleBot: (team) => {
    const { bots } = get();
    const sameTeamCount = bots.filter((b) => b.team === team).length;
    if (sameTeamCount >= 4) return;
    const pool = team === 'iron' ? BOT_NAMES_IRON : BOT_NAMES_CRIMSON;
    const nextBot: LobbyParticipant = {
      id: `bot-${team}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: pool[sameTeamCount % pool.length],
      isBot: true,
      isLocal: false,
      team,
      heroId: HERO_ROTATION[sameTeamCount % HERO_ROTATION.length],
      skinIndex: (sameTeamCount + (team === 'crimson' ? 1 : 0)) % 4,
      ready: true,
    };
    set({ bots: [...bots, nextBot] });
  },

  removeBot: (id) =>
    set((s) => ({ bots: s.bots.filter((b) => b.id !== id) })),

  swapLocalTeamAndRebalance: () =>
    set((s) => {
      const prevTeam: TeamId = s.localTeam;
      const nextTeam: TeamId = prevTeam === 'iron' ? 'crimson' : 'iron';
      const meta = MODES.find((m) => m.id === s.selectedMode) || MODES[0];
      const teamSize = meta.teamSize;

      let nextBots = [...s.bots];
      const prevBots = nextBots.filter((b) => b.team === prevTeam);
      const nextTeamBots = nextBots.filter((b) => b.team === nextTeam);

      // Remove 1 bot from the destination team if it exceeds teamSize (or to mirror moving 1 slot)
      if (1 + nextTeamBots.length > teamSize || (nextTeamBots.length > 0 && prevBots.length < teamSize)) {
        const dropBot = nextTeamBots[nextTeamBots.length - 1];
        if (dropBot) {
          nextBots = nextBots.filter((b) => b.id !== dropBot.id);
        }
      }

      // Add 1 bot to the vacated team if it is below teamSize
      if (prevBots.length < teamSize) {
        const pool = prevTeam === 'iron' ? BOT_NAMES_IRON : BOT_NAMES_CRIMSON;
        const used = new Set(nextBots.map((b) => b.name));
        const name = pool.find((n) => !used.has(n)) ?? pool[prevBots.length % pool.length];
        nextBots.push({
          id: `bot-${prevTeam}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name,
          isBot: true,
          isLocal: false,
          team: prevTeam,
          heroId: HERO_ROTATION[(prevBots.length + (prevTeam === 'iron' ? 1 : 0)) % HERO_ROTATION.length],
          skinIndex: (prevBots.length + (prevTeam === 'crimson' ? 1 : 0)) % 4,
          ready: true,
        });
      }

      return { localTeam: nextTeam, bots: nextBots };
    }),

  triggerRematch: () =>
    set((s) => ({ matchRunId: s.matchRunId + 1, snapshot: null })),

  updateAudioMixer: (patch) => {
    const next = { ...get().audioMixer, ...patch };
    soundEngine.applyMixer(next);
    set({ audioMixer: next });
  },

  toggleMute: () => {
    const next = { ...get().audioMixer, muted: !get().audioMixer.muted };
    soundEngine.applyMixer(next);
    set({ audioMixer: next });
  },

  setAudioModalOpen: (audioModalOpen) => set({ audioModalOpen }),

  setSnapshot: (snapshot) => set({ snapshot }),
}));
