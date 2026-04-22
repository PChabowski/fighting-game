// src/components/MultiplayerMenu.jsx
import React, { useEffect, useState } from 'react';
import useGameStore from '../store/useGameStore';
import { initPlayroom, isGameHost } from '../engine/utils/playroom';

export default function MultiplayerMenu() {
  const { setView, setPlayroomData, setIsMatchmaking } = useGameStore();
  const [loadingMode, setLoadingMode] = useState(null); // 'matchmaking' lub 'hosting'

  const handleStartMultiplayer = async (isMatchmaking = false) => {
    try {
      let urlStr = window.location.href;
      let roomCode = null;

      // Ensure global multiplayer flag is active
      useGameStore.getState().setMultiplayer(true);
      setIsMatchmaking(isMatchmaking);

      // Extract room code if it exists (handles ?r=, &r=, #r=, #?r=)
      const match = urlStr.match(/[#?&]r=([^&]+)/);
      if (match && match[1]) {
        roomCode = match[1];
      }
      
      if (roomCode) {
         window.history.replaceState({}, '', window.location.pathname + `#r=${roomCode}`);
      }

      setLoadingMode(isMatchmaking ? 'matchmaking' : 'hosting');
      setPlayroomData('loading', []);
      
      // Uruchamiamy wbudowany mechanizm Matchmakingu Playroom
      if (isMatchmaking && !roomCode) {
        await initPlayroom({ matchmaking: true, maxPlayersPerRoom: 2 });
      } else {
        await initPlayroom({ maxPlayersPerRoom: 2 });
      }
      
      // Dopiero po udanym załadowaniu Playroom dowiadujemy się, czy trafiliśmy do pokoju jako "gość" (ktoś już w nim był),
      // czy "host" (pokój został utworzony przez nas lub nikogo w nim wcześniej nie było)
      useGameStore.setState({ isHost: isGameHost() });
      
      // Po wczytaniu (znalezieniu serwera lub założeniu pokoju) przechodzimy do LOBBY
      setLoadingMode(null);
      setPlayroomData('idle', []);
      setView('MULTI_LOBBY');
      
    } catch (error) {
      console.error("Failed to initialize Playroom:", error);
      setLoadingMode(null);
      setPlayroomData('idle', []);
    }
  };

  useEffect(() => {
    const urlStr = window.location.href;
    if (urlStr.match(/[#?&]r=/)) {
        handleStartMultiplayer(false);
    }
  }, []);

  if (loadingMode) {
    return (
      <div className="who-win" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <div style={{ fontSize: '24px', textAlign: 'center' }}>
           {loadingMode === 'matchmaking' ? 'Searching for match...' : 'Creating Room...'}
        </div>
        <div style={{ fontSize: '16px', opacity: 0.8 }}>
          {loadingMode === 'matchmaking' ? 'Please wait, looking for opponents in Playroom network.' : 'Connecting to Relay Servers...'}
        </div>
      </div>
    );
  }

  return (
    <div className="who-win" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>Playroom Multiplayer</div>
      
      <button 
        className="button menu-button" 
        onClick={() => handleStartMultiplayer(true)}
      >
        Quick Match
      </button>

      <button 
        className="button menu-button" 
        onClick={() => handleStartMultiplayer(false)}
      >
        Host Room
      </button>
      
      <button 
        className="button menu-button" 
        onClick={() => {
          useGameStore.getState().setMultiplayer(false);
          useGameStore.getState().setIsMatchmaking(false);
          const urlStr = window.location.href;
          if (urlStr.match(/[#?&]r=/)) {
              window.location.href = window.location.pathname;
          } else {
              setView('MENU');
          }
        }}
      >
        Back
      </button>
    </div>
  );
}