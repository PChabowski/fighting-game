import React, { useEffect } from 'react';
import { PreloaderOverlay } from './components/PreloaderOverlay';
import { ModeSelectScreen } from './components/ModeSelectScreen';
import { WarRoomLobby } from './components/WarRoomLobby';
import { GameArenaView } from './components/GameArenaView';
import { AudioSettingsModal } from './components/AudioSettingsModal';
import { useAppStore } from './store/useAppStore';
import { soundEngine } from './game/audio/soundEngine';
import { findActiveGamepad } from './game/input/gamepadDriver';
import { networkClient } from './game/net/networkClient';

export function App() {
  const screen = useAppStore((s) => s.screen);
  const setGamepadStatus = useAppStore((s) => s.setGamepadStatus);

  useEffect(() => {
    if (screen === 'MENU' || screen === 'LOBBY') {
      soundEngine.playMusic('menu');
    } else if (screen === 'PLAYING') {
      soundEngine.playMusic('battle');
    }
    if (typeof document !== 'undefined') {
      document.body.dataset.state =
        screen === 'PLAYING' ? 'playing' : screen === 'PRELOAD' ? 'loading' : 'title';
    }
  }, [screen]);

  // Optional ?autostart=1 shortcut once assets finish preloading
  useEffect(() => {
    if (screen !== 'MENU' || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const state = useAppStore.getState();
      const res = networkClient.createLocalRoomSession();
      state.setNetworkConnection('local', res.roomCode, res.localId);
      state.autoFillBots({
        iron: state.localTeam === 'iron' ? 1 : 0,
        crimson: state.localTeam === 'crimson' ? 1 : 0,
      });
      state.setScreen('PLAYING');
      params.delete('autostart');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [screen]);

  // Track Xbox / standard gamepad connection globally
  useEffect(() => {
    const syncPad = () => {
      const pad = findActiveGamepad();
      setGamepadStatus(Boolean(pad), pad?.id || '');
    };
    syncPad();
    window.addEventListener('gamepadconnected', syncPad);
    window.addEventListener('gamepaddisconnected', syncPad);
    const timer = setInterval(syncPad, 1000);
    return () => {
      window.removeEventListener('gamepadconnected', syncPad);
      window.removeEventListener('gamepaddisconnected', syncPad);
      clearInterval(timer);
    };
  }, [setGamepadStatus]);

  return (
    <>
      {screen === 'PRELOAD' && <PreloaderOverlay />}
      {screen === 'MENU' && <ModeSelectScreen />}
      {screen === 'LOBBY' && <WarRoomLobby />}
      {screen === 'PLAYING' && <GameArenaView />}
      <AudioSettingsModal />
    </>
  );
}

export default App;
