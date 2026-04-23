// src/store/useGameStore.js
import { create } from 'zustand';

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
  timer: 60,
  winner: null, // np. 'Player 1', 'Player 2', 'Tie'
  gameMode: 'PVP', // 'PVP' lub 'ARCADE'
  
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
  setView: (newView) => set({ view: newView }),
  setMultiplayer: (val) => set({ isMultiplayer: val }),
  setIsMatchmaking: (val) => set({ isMatchmaking: val }),
  setGameMode: (mode) => set({ gameMode: mode }),
  setPlayroomData: (status, players) => set({ multiplayerStatus: status, playroomPlayers: players }),
  setSelectedLevel: (levelId) => set({ selectedLevel: levelId }),
  
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
  setStocks: (player, stocks) => set((state) => ({
    player1Stocks: player === 1 ? Math.max(0, stocks) : state.player1Stocks,
    player2Stocks: player === 2 ? Math.max(0, stocks) : state.player2Stocks,
  })),
  setTimer: (time) => set({ timer: time }),
  setWinner: (winnerName) => set({ winner: winnerName }),
  resetGame: () => set({ playerHealth: 100, enemyHealth: 100, player1Stocks: 3, player2Stocks: 3, player1Stamina: 100, player2Stamina: 100, timer: 60, winner: null }),
}));

export default useGameStore;