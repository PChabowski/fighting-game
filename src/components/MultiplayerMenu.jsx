// src/components/MultiplayerMenu.jsx
import React, { useState } from 'react';
import useGameStore from '../store/useGameStore';
// To be added: logic for peer.js connect

export default function MultiplayerMenu() {
  const { setView } = useGameStore();

  return (
    <div className="who-win" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>Select Option</div>
      
      <button 
        className="button menu-button" 
        onClick={() => {
          useGameStore.setState({ isHost: true, remotePeerId: null });
          setView('MULTI_LOBBY');
        }}
      >
        Host Game
      </button>
      <button 
        className="button menu-button" 
        onClick={() => setView('MULTI_JOIN')}
      >
        Join Game
      </button>
      
      <button 
        className="button menu-button" 
        onClick={() => {
          useGameStore.getState().setMultiplayer(false);
          setView('MENU');
        }}
      >
        Back
      </button>
    </div>
  );
}