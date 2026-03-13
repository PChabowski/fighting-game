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

  // Since the game engine now maps WASD/Space to the local fighter (regardless of host/guest),
  // mobile controls can simply always dispatch these global keys.
  const KEY_LEFT = 'a';
  const KEY_RIGHT = 'd';
  const KEY_JUMP = 'w';
  const KEY_ATTACK = ' ';

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
