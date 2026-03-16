// src/components/GameMenu.jsx
import React from 'react';
import useGameStore from '../store/useGameStore';
import { useNavigate } from 'react-router-dom';
// To be added: AudioManager

export default function GameMenu() {
  const setView = useGameStore(state => state.setView);
  const navigate = useNavigate();

  return (
    <>
      <div className="who-win" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>Menu</div>
        <button 
          className="button menu-button" 
          onClick={() => {
            useGameStore.getState().setGameMode('ARCADE');
            setView('CHAR_SELECT');
          }}
        >
          Arcade Mode
        </button>
        <button 
          className="button menu-button" 
          onClick={() => {
            useGameStore.getState().setGameMode('PVP');
            setView('CHAR_SELECT');
          }}
        >
          Player vs Player
        </button>
        <button 
          className="button menu-button" 
          onClick={() => {
             useGameStore.getState().setGameMode('PVP'); // Multiplayer has it's own flag, but defaults to PVP
             useGameStore.getState().setMultiplayer(true);
             setView('MULTI_MENU');
          }}
        >
          Multiplayer
        </button>

        {/* Authors button (styled identical to other menu buttons) */}
        <button
          className="button menu-button"
          onClick={() => {
            // navigate to authors page
            setView('MENU');
            navigate('/authors');
          }}
        >
          Authors
        </button>
      </div>
    </>
  );
}