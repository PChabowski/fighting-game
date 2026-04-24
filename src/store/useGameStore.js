// src/store/useGameStore.js
import { create } from 'zustand';
import { AI_DIFFICULTY_ORDER, DEFAULT_AI_DIFFICULTY } from '../engine/utils/aiProfiles';

const AUDIO_SETTINGS_STORAGE_KEY = 'gamefight.audio.settings';
const AI_DIFFICULTY_STORAGE_KEY = 'gamefight.ai.difficulty';
const DEFAULT_AUDIO_SETTINGS = {
  masterVolume: 100,
  menuMusicVolume: 10,
  musicVolume: 10,
  sfxVolume: 30,
};

const AI_DIFFICULTY_SET = new Set(AI_DIFFICULTY_ORDER);

function clampVolume(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function loadAudioSettings() {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_SETTINGS;

  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_AUDIO_SETTINGS;

    const parsed = JSON.parse(raw);
    return {
      masterVolume: clampVolume(parsed.masterVolume, DEFAULT_AUDIO_SETTINGS.masterVolume),
      menuMusicVolume: clampVolume(parsed.menuMusicVolume, DEFAULT_AUDIO_SETTINGS.menuMusicVolume),
      musicVolume: clampVolume(parsed.musicVolume, DEFAULT_AUDIO_SETTINGS.musicVolume),
      sfxVolume: clampVolume(parsed.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
    };
  } catch (error) {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

function saveAudioSettings(settings) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    // Ignore storage write errors.
  }
}

function normalizeAiDifficulty(value) {
  const candidate = typeof value === 'string' ? value.toLowerCase() : '';
  return AI_DIFFICULTY_SET.has(candidate) ? candidate : DEFAULT_AI_DIFFICULTY;
}

function loadAiDifficulty() {
  if (typeof window === 'undefined') return DEFAULT_AI_DIFFICULTY;

  try {
    const raw = window.localStorage.getItem(AI_DIFFICULTY_STORAGE_KEY);
    return normalizeAiDifficulty(raw);
  } catch (error) {
    return DEFAULT_AI_DIFFICULTY;
  }
}

function saveAiDifficulty(value) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(AI_DIFFICULTY_STORAGE_KEY, normalizeAiDifficulty(value));
  } catch (error) {
    // Ignore storage write errors.
  }
}

// Ten sklep przechowuje globalny stan gry i udostępnia metody dla silnika
const useGameStore = create((set) => ({
  // Fazy gry: 'PRELOAD', 'MENU', 'CHAR_SELECT', 'LOBBY', 'GAME'
  view: 'PRELOAD', 
  
  // Dane walki
  playerHealth: 100,
  enemyHealth: 100,
  player1Stocks: 3,
  player2Stocks: 3,
  player1Stamina: 100,
  player2Stamina: 100,
  player1Score: 0,
  player2Score: 0,
  player1KothControlFrames: 0,
  player2KothControlFrames: 0,
  player1CarriesFlag: false,
  player2CarriesFlag: false,
  timer: 60,
  timeRemaining: 300,
  matchType: 'STOCK', // 'STOCK' | 'CTF'
  winner: null, // np. 'Player 1', 'Player 2', 'Tie'
  gameMode: 'PVP', // 'PVP' lub 'ARCADE'
  aiDifficulty: loadAiDifficulty(),
  isPaused: false,
  audioSettings: loadAudioSettings(),
  
  // Dane multiplayera
  isMultiplayer: false,
  isHost: true,
  isMatchmaking: false,
  multiplayerStatus: 'idle', // 'idle' | 'loading' | 'ready'
  playroomPlayers: [], // lista pobranych graczy Playroom

  // Wyzwalacz rewanżu
  rematchTrigger: 0,
  triggerRematch: () => set((state) => ({ rematchTrigger: state.rematchTrigger + 1 })),

  // Akcje do wywoływania z poziomu interfejsu React
  setView: (newView) => set((state) => ({ view: newView, isPaused: newView === 'GAME' ? state.isPaused : false })),
  setMultiplayer: (val) => set({ isMultiplayer: val }),
  setIsMatchmaking: (val) => set({ isMatchmaking: val }),
  setGameMode: (mode) => set({ gameMode: mode }),
  setAiDifficulty: (difficulty) => {
    const normalized = normalizeAiDifficulty(difficulty);
    saveAiDifficulty(normalized);
    set({ aiDifficulty: normalized });
  },
  setPlayroomData: (status, players) => set({ multiplayerStatus: status, playroomPlayers: players }),
  setSelectedLevel: (levelId) => set({ selectedLevel: levelId }),
  setMatchType: (type) => set({ matchType: type }),
  setIsPaused: (paused) => set({ isPaused: !!paused }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  setAudioSettings: (partialSettings) => set((state) => {
    const current = state.audioSettings || DEFAULT_AUDIO_SETTINGS;
    const next = {
      masterVolume: clampVolume(partialSettings?.masterVolume ?? current.masterVolume, current.masterVolume),
      menuMusicVolume: clampVolume(partialSettings?.menuMusicVolume ?? current.menuMusicVolume, current.menuMusicVolume),
      musicVolume: clampVolume(partialSettings?.musicVolume ?? current.musicVolume, current.musicVolume),
      sfxVolume: clampVolume(partialSettings?.sfxVolume ?? current.sfxVolume, current.sfxVolume),
    };

    saveAudioSettings(next);
    return { audioSettings: next };
  }),
  
  // Akcje do wywoływania z poziomu silnika Canvas/JavaScript
  updateHealth: (player, hp) => set((state) => ({
    playerHealth: player === 1 ? Math.max(0, hp) : state.playerHealth,
    enemyHealth: player === 2 ? Math.max(0, hp) : state.enemyHealth,
  })),
  updateStamina: (player, stamina) => set((state) => ({
    player1Stamina: player === 1 ? Math.max(0, Math.min(100, stamina)) : state.player1Stamina,
    player2Stamina: player === 2 ? Math.max(0, Math.min(100, stamina)) : state.player2Stamina,
  })),
  loseStock: (player) => set((state) => ({
    player1Stocks: player === 1 ? Math.max(0, state.player1Stocks - 1) : state.player1Stocks,
    player2Stocks: player === 2 ? Math.max(0, state.player2Stocks - 1) : state.player2Stocks,
  })),
  addStock: (player) => set((state) => ({
    player1Stocks: player === 1 ? Math.min(3, state.player1Stocks + 1) : state.player1Stocks,
    player2Stocks: player === 2 ? Math.min(3, state.player2Stocks + 1) : state.player2Stocks,
  })),
  setStocks: (player, stocks) => set((state) => ({
    player1Stocks: player === 1 ? Math.max(0, stocks) : state.player1Stocks,
    player2Stocks: player === 2 ? Math.max(0, stocks) : state.player2Stocks,
  })),
  setTimer: (time) => set({ timer: time }),
  setTimeRemaining: (time) => set({ timeRemaining: Math.max(0, time) }),
  addScore: (player) => set((state) => ({
    player1Score: player === 1 ? state.player1Score + 1 : state.player1Score,
    player2Score: player === 2 ? state.player2Score + 1 : state.player2Score,
  })),
  setScore: (player, value) => set((state) => ({
    player1Score: player === 1 ? Math.max(0, value) : state.player1Score,
    player2Score: player === 2 ? Math.max(0, value) : state.player2Score,
  })),
  incrementKothControlFrames: (player, amount = 1) => set((state) => ({
    player1KothControlFrames: player === 1 ? state.player1KothControlFrames + amount : state.player1KothControlFrames,
    player2KothControlFrames: player === 2 ? state.player2KothControlFrames + amount : state.player2KothControlFrames,
  })),
  setFlagCarrier: (player, carriesFlag) => set((state) => ({
    player1CarriesFlag: player === 1 ? !!carriesFlag : state.player1CarriesFlag,
    player2CarriesFlag: player === 2 ? !!carriesFlag : state.player2CarriesFlag,
  })),
  setWinner: (winnerName) => set({ winner: winnerName }),
  resetGame: () => set({
    playerHealth: 100,
    enemyHealth: 100,
    player1Stocks: 3,
    player2Stocks: 3,
    player1Stamina: 100,
    player2Stamina: 100,
    player1Score: 0,
    player2Score: 0,
    player1KothControlFrames: 0,
    player2KothControlFrames: 0,
    player1CarriesFlag: false,
    player2CarriesFlag: false,
    timer: 60,
    timeRemaining: 300,
    matchType: 'STOCK',
    winner: null,
    isPaused: false,
  }),
}));

export default useGameStore;