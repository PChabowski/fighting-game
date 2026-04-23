// src/components/GameMenu.jsx
import React, { useState } from 'react';
import useGameStore from '../store/useGameStore';
import { Link } from 'react-router-dom';
import SettingsMenu from './SettingsMenu';

export default function GameMenu() {
  const setView = useGameStore(state => state.setView);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (isSettingsOpen) {
    return (
      <div className="who-win" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SettingsMenu onBack={() => setIsSettingsOpen(false)} />
      </div>
    );
  }

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

        <button
          className="button menu-button"
          onClick={() => setIsSettingsOpen(true)}
        >
          Settings
        </button>

        {/* Authors link (styled identical to other menu buttons) */}
            <Link
              to="/authors"
              className="button menu-button"
              onClick={() => setView('MENU')}
              style={{ textDecoration: 'none', color: 'initial', fontSize: '13px'}}
            >
              Authors
            </Link>
      </div>
    </>
  );
}