import React from 'react';
import useGameStore from '../store/useGameStore';

export default function GameInterface() {
  const { playerHealth, enemyHealth, timer, winner } = useGameStore();

  return (
    <>
      <div className="interface">
        {/* Player 1 Health */}
        <div className="health-bar">
          <div 
            className="player" 
            style={{ width: `${playerHealth}%`, transition: 'width 0.2s', background: '#818CF8' }}
          />
        </div>
        
        {/* Timer */}
        <div className="timer">
          {timer}
        </div>
        
        {/* Player 2 Health */}
        <div className="health-bar">
          <div 
            className="enemy" 
            style={{ width: `${enemyHealth}%`, transition: 'width 0.2s', background: '#818CF8' }}
          />
        </div>
      </div>

      {/* Winner Message */}
      {winner && (
        <div className="who-win" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>{winner === 'Tie' ? 'Tie' : `${winner} Wins`}</div>
          <button 
            className="button menu-button"
            onClick={() => useGameStore.getState().triggerRematch()}
          >
            REMATCH
          </button>
          <button 
            className="button menu-button"
            onClick={() => {
              useGameStore.getState().resetGame();
              useGameStore.getState().setView('MENU');
            }}
          >
            MAIN MENU
          </button>
        </div>
      )}
    </>
  );
}
