import React from 'react';
import useGameStore from '../../store/useGameStore';
import { peerManager } from '../../engine/utils/peer';

export default function WinModal() {
  const winner = useGameStore((state) => state.winner);
  const isMultiplayer = useGameStore((state) => state.isMultiplayer);

  if (!winner) return null;

  return (
    <div className="who-win" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>{winner === 'Tie' ? 'Tie' : `${winner} Wins`}</div>
      <button 
        className="button menu-button"
        onClick={() => {
          if (isMultiplayer) {
            peerManager.send({ type: 'rematch' });
          }
          useGameStore.getState().triggerRematch();
        }}
      >
        REMATCH
      </button>
      <button 
        className="button menu-button"
        onClick={() => {
          if (isMultiplayer) {
            peerManager.send({ type: 'main_menu' });
            peerManager.disconnect();
            useGameStore.getState().setMultiplayer(false);
          }
          useGameStore.getState().resetGame();
          useGameStore.getState().setView('MENU');
        }}
      >
        MAIN MENU
      </button>
    </div>
  );
}
