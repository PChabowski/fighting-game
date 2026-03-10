// src/store/useGameStore.js
import { create } from 'zustand';

// Ten sklep przechowuje globalny stan gry i udostępnia metody dla silnika
const useGameStore = create((set) => ({
  // Fazy gry: 'PRELOAD', 'MENU', 'CHAR_SELECT', 'LOBBY', 'GAME'
  view: 'PRELOAD', 
  
  // Dane walki
  playerHealth: 100,
  enemyHealth: 100,
  timer: 60,
  winner: null, // np. 'Player 1', 'Player 2', 'Tie'
  
  // Dane multiplayera
  isMultiplayer: false,
  peerId: null,
  connection: null,
  isHost: true,
  remotePeerId: null,

  // Wyzwalacz rewanżu
  rematchTrigger: 0,
  triggerRematch: () => set((state) => ({ rematchTrigger: state.rematchTrigger + 1 })),

  // Akcje do wywoływania z poziomu interfejsu React
  setView: (newView) => set({ view: newView }),
  setMultiplayer: (val) => set({ isMultiplayer: val }),
  setConnectionData: (peerId, conn) => set({ peerId, connection: conn }),
  
  // Akcje do wywoływania z poziomu silnika Canvas/JavaScript
  updateHealth: (player, hp) => set((state) => ({
    playerHealth: player === 1 ? Math.max(0, hp) : state.playerHealth,
    enemyHealth: player === 2 ? Math.max(0, hp) : state.enemyHealth,
  })),
  setTimer: (time) => set({ timer: time }),
  setWinner: (winnerName) => set({ winner: winnerName }),
  resetGame: () => set({ playerHealth: 100, enemyHealth: 100, timer: 60, winner: null }),
}));

export default useGameStore;