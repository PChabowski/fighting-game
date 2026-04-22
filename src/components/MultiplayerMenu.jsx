// src/components/MultiplayerMenu.jsx
import React, { useEffect } from 'react';
import useGameStore from '../store/useGameStore';
import { initPlayroom } from '../engine/utils/playroom';

export default function MultiplayerMenu() {
  const { setView, setPlayroomData, view } = useGameStore();

  const handleStartMultiplayer = async () => {
    try {
      let urlStr = window.location.href;
      let roomCode = null;

      // Extract room code if it exists (handles ?r=, &r=, #r=, #?r=)
      const match = urlStr.match(/[#?&]r=([^&]+)/);
      if (match && match[1]) {
        roomCode = match[1];
      }
      
      // Musimy wymusić na pasku przeglądarki wyłączenie Playroomowy format hashowy #r=KOD, 
      // inaczej biblioteka zignoruje kod i sama wstrzyknie drugi id (#r=NowyId)
      if (roomCode) {
         window.history.replaceState({}, '', window.location.pathname + `#r=${roomCode}`);
      }

      setPlayroomData('loading', []);
      
      // Jesteśmy hostem tylko wtedy, gdy gość nie przyniósł kodu pokoju
      useGameStore.setState({ isHost: !roomCode }); 
      
      // Inicjalizacja playroom, nie podajemy własnego identyfikatora do obiektu konfiguracyjnego 
      // bo Playroom wyczyta go z paska na podstawie hasha (czyli tego '#r=')
      await initPlayroom();
      
      // Po initPlayroom upewniamy się, że przechodzimy do LOBBY
      setView('MULTI_LOBBY');
    } catch (error) {
      console.error("Failed to initialize Playroom:", error);
      setPlayroomData('idle', []);
    }
  };

  useEffect(() => {
    // If the URL has room code (r=), automatically start loading Playroom for the guest joining
    const urlStr = window.location.href;
    if (urlStr.match(/[#?&]r=/)) {
        handleStartMultiplayer();
    }
  }, []);

  return (
    <div className="who-win" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>Playroom Multiplayer</div>
      
      <button 
        className="button menu-button" 
        onClick={handleStartMultiplayer}
      >
        Start Multiplayer
      </button>
      
      <button 
        className="button menu-button" 
        onClick={() => {
          useGameStore.getState().setMultiplayer(false);
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