import React, { useEffect, useState, useCallback } from 'react';
import useGameStore from '../store/useGameStore';
import { isMobile } from '../engine/utils/mobile';
import { simulateVirtualInput } from '../engine/GameEngine';

export default function MobileControls() {
  const [shouldRender, setShouldRender] = useState(false);
  const { isMultiplayer, isHost } = useGameStore();

  useEffect(() => {
    // Only mount mobile overlay if we are on a mobile device
    if (isMobile()) {
      setShouldRender(true);
    }
  }, []);

  if (!shouldRender) return null;

  // Determine correct keys based on player assignment.
  // In multiplayer, the guest ALWAYS controls Player 2 logic locally using Arrow keys in the Canvas Engine.
  const isP2 = isMultiplayer && !isHost;
  const KEY_LEFT = isP2 ? 'ArrowLeft' : 'a';
  const KEY_RIGHT = isP2 ? 'ArrowRight' : 'd';
  const KEY_JUMP = isP2 ? 'ArrowUp' : 'w';
  const KEY_ATTACK = isP2 ? 'ArrowDown' : ' ';

  const handleTouchStart = (key) => (e) => {
    e.preventDefault();
    simulateVirtualInput(key, true);
    e.currentTarget.classList.add('active');
  };

  const handleTouchEnd = (key) => (e) => {
    e.preventDefault();
    simulateVirtualInput(key, false);
    e.currentTarget.classList.remove('active');
  };

  return (
    <div className="mobile-controls-container" id="mobile-controls">
      <div className="dpad-container">
        <button 
          className="mobile-btn dpad-btn" 
          onTouchStart={handleTouchStart(KEY_LEFT)}
          onTouchEnd={handleTouchEnd(KEY_LEFT)}
        >
          &#8592;
        </button>
        <button 
          className="mobile-btn dpad-btn"
          onTouchStart={handleTouchStart(KEY_RIGHT)}
          onTouchEnd={handleTouchEnd(KEY_RIGHT)}
        >
          &#8594;
        </button>
      </div>

      <div className="action-buttons">
        <button 
          className="mobile-btn action-btn jump-btn"
          onTouchStart={handleTouchStart(KEY_JUMP)}
          onTouchEnd={handleTouchEnd(KEY_JUMP)}
        >
          J
        </button>
        <button 
          className="mobile-btn action-btn attack-btn"
          onTouchStart={handleTouchStart(KEY_ATTACK)}
          onTouchEnd={handleTouchEnd(KEY_ATTACK)}
        >
          A
        </button>
      </div>
    </div>
  );
}
