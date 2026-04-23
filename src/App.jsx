// src/App.jsx
import React, { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import useGameStore from './store/useGameStore';
import { globalAudioManager } from './engine/classes/AudioManager';
import useGamepadMenu from './hooks/useGamepadMenu';
import Preloader from './components/Preloader';
import GameCanvas from './components/GameCanvas';
import GameMenu from './components/GameMenu';
import CharacterSelect from './components/CharacterSelect';
import MultiplayerMenu from './components/MultiplayerMenu';
import MultiplayerLobby from './components/MultiplayerLobby';
import GameInterface from './components/GameInterface';
import MobileOrientationModal from './components/MobileOrientationModal';
import UpdateModal from './components/ui/UpdateModal';
import { Routes, Route } from 'react-router-dom';
import Authors from './pages/Authors';
import Privacy from './pages/Privacy';
import CookieBanner from './components/CookieBanner';

// Keep MainViews stable across App re-renders to avoid remounting GameCanvas
function MainViews({ needRefresh, setNeedRefresh, updateServiceWorker }) {
  const view = useGameStore(state => state.view);
  const isMultiplayer = useGameStore(state => state.isMultiplayer);
  const audioSettings = useGameStore(state => state.audioSettings);
  const setView = useGameStore(state => state.setView);
  const setPlayroomData = useGameStore(state => state.setPlayroomData);

  useGamepadMenu(view);

  // Auto-join Playroom if URL has room code (r=...)
  useEffect(() => {
    const urlStr = window.location.href;
    if (urlStr.match(/[#?&]r=/) && view === 'MENU') {
       useGameStore.getState().setMultiplayer(true);
       setView('MULTI_MENU');
    }
  }, [view, setView]);

  useEffect(() => {
    switch (view) {
      case 'MENU':
      case 'CHAR_SELECT':
      case 'MULTI_MENU':
      case 'MULTI_JOIN':
      case 'MULTI_LOBBY':
      case 'PRELOAD':
        globalAudioManager.playCategory('menu');
        break;
      case 'GAME':
        if (!isMultiplayer) {
          globalAudioManager.playCategory('battle');
        }
        break;
      default:
        globalAudioManager.stop();
    }
  }, [view, isMultiplayer]);

  useEffect(() => {
    globalAudioManager.setVolumes({
      masterVolume: audioSettings.masterVolume,
      musicVolume: audioSettings.musicVolume,
      sfxVolume: audioSettings.sfxVolume,
    });
  }, [audioSettings]);

  return (
    <div className="conteiner">
      {needRefresh && (
        <UpdateModal 
          onConfirm={() => updateServiceWorker(true)} 
          onCancel={() => setNeedRefresh(false)} 
        />
      )}
      {view === 'PRELOAD' && <Preloader />}
      {/* Elementy nakładane (Menu/WinModal itp.) powinny zajmować cały ekran lub korzystać z display: none, 
          w przypadku starej logiki modale/menu korzystały z klasy .who-win aby wyświetla się na środku ekranu. */}
      {view === 'MENU' && <GameMenu />}
      {view === 'CHAR_SELECT' && <CharacterSelect />}
      {view === 'MULTI_MENU' && <MultiplayerMenu />}
      {view === 'MULTI_LOBBY' && <MultiplayerLobby />}
      {view === 'GAME' && <GameInterface />}
      <MobileOrientationModal />
      
      {/* Game Engine rendering layer */}
      <GameCanvas />
    </div>
  );
}

function App() {
  const { view } = useGameStore();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r);
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  return (
    <>
      <CookieBanner />
      <Routes>
        <Route path="/authors" element={<Authors />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/*" element={<MainViews needRefresh={needRefresh} setNeedRefresh={setNeedRefresh} updateServiceWorker={updateServiceWorker} />} />
      </Routes>
    </>
  );
}

export default App;