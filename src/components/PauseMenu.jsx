import React, { useEffect, useState } from 'react';
import useGameStore from '../store/useGameStore';
import SettingsMenu from './SettingsMenu';

export default function PauseMenu() {
  const view = useGameStore((state) => state.view);
  const winner = useGameStore((state) => state.winner);
  const isPaused = useGameStore((state) => state.isPaused);
  const isMultiplayer = useGameStore((state) => state.isMultiplayer);
  const setIsPaused = useGameStore((state) => state.setIsPaused);
  const setView = useGameStore((state) => state.setView);
  const resetGame = useGameStore((state) => state.resetGame);
  const setMultiplayer = useGameStore((state) => state.setMultiplayer);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!isPaused) {
      setIsSettingsOpen(false);
    }
  }, [isPaused]);

  if (view !== 'GAME' || winner || !isPaused) return null;

  return (
    <div
      className="who-win"
      role="dialog"
      aria-modal="true"
      aria-label="Pause menu"
      style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      {isSettingsOpen ? (
        <SettingsMenu onBack={() => setIsSettingsOpen(false)} />
      ) : (
        <>
          <div>{isMultiplayer ? 'GAME MENU' : 'PAUSED'}</div>
          <button className="button menu-button" onClick={() => setIsPaused(false)}>
            {isMultiplayer ? 'CLOSE MENU' : 'RESUME GAME'}
          </button>
          <button className="button menu-button" onClick={() => setIsSettingsOpen(true)}>
            SETTINGS
          </button>
          <button
            className="button menu-button"
            onClick={() => {
              setIsPaused(false);
              resetGame();
              if (isMultiplayer) {
                setMultiplayer(false);
                window.location.href = window.location.pathname;
                return;
              }
              setView('MENU');
            }}
          >
            EXIT GAME
          </button>
        </>
      )}
    </div>
  );
}
