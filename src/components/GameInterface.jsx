import React from 'react';
import MobileControls from './MobileControls';
import Timer from './ui/Timer';
import HealthBar from './ui/HealthBar';
import WinModal from './ui/WinModal';
import PauseMenu from './PauseMenu';
import useGameStore from '../store/useGameStore';

export default function GameInterface() {
  const winner = useGameStore((state) => state.winner);
  const isPaused = useGameStore((state) => state.isPaused);

  return (
    <>
      <div className="interface">
        {/* Player 1 Health */}
        <HealthBar playerNum={1} />
        
        {/* Timer */}
        <Timer />
        
        {/* Player 2 Health */}
        <HealthBar playerNum={2} />
      </div>

      {/* Winner Message */}
      <WinModal />
      <PauseMenu />
      {/* MobileControls render only if WinModal is not visible (winner === null) */}
      {winner === null && !isPaused && <MobileControls />}
    </>
  );
}
