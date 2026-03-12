import React from 'react';
import MobileControls from './MobileControls';
import Timer from './ui/Timer';
import HealthBar from './ui/HealthBar';
import WinModal from './ui/WinModal';

export default function GameInterface() {
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
      <MobileControls />
    </>
  );
}
