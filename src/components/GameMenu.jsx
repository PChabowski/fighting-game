// src/components/GameMenu.jsx
import React from 'react';
import useGameStore from '../store/useGameStore';
// To be added: AudioManager

export default function GameMenu() {
  const setView = useGameStore(state => state.setView);

  return (
    <>
      <div className="who-win" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>Menu</div>
        <button 
          className="button menu-button" 
          onClick={() => setView('CHAR_SELECT')} // temporarily mapping Arcade to CHAR_SELECT
        >
          Arcade Mode
        </button>
        <button 
          className="button menu-button" 
          onClick={() => setView('CHAR_SELECT')}
        >
          Player vs Player
        </button>
        <button 
          className="button menu-button" 
          onClick={() => {
             useGameStore.getState().setMultiplayer(true);
             setView('MULTI_MENU');
          }}
        >
          Multiplayer
        </button>
      </div>
    </>
  );
}