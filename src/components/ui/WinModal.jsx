import React from 'react';
import useGameStore from '../../store/useGameStore';
import { playroomRPC } from '../../engine/utils/playroom';

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
            playroomRPC.call('rematch', {}, playroomRPC.Mode.ALL);
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
            playroomRPC.call('main_menu', {}, playroomRPC.Mode.ALL);
            useGameStore.getState().setMultiplayer(false);
            window.location.href = window.location.pathname; // Wyjście do czystego URLa bez r=
            return;
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
