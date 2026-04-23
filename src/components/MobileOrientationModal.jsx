import React, { useState, useEffect } from 'react';
import { isMobile } from '../engine/utils/mobile';

export default function MobileOrientationModal() {
  const [shouldShow, setShouldShow] = useState(false);

  const isFullscreenActive = () => {
    return Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );
  };

  const isPwaMode = () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true;
  };

  const canRequestFullscreen = () => {
    const root = document.documentElement;
    return Boolean(
      root && (
        typeof root.requestFullscreen === 'function' ||
        typeof root.webkitRequestFullscreen === 'function' ||
        typeof root.msRequestFullscreen === 'function'
      )
    );
  };

  useEffect(() => {
    if (!isMobile()) return;

    const syncWithDeviceState = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      const fullscreen = isFullscreenActive();
      const isPWA = isPwaMode();
      
      // If we are installed as PWA and in landscape, everything is fine.
      if (isPWA && isLandscape) {
        setShouldShow(false);
        return;
      }
      
      // Show guidance when not in landscape or when fullscreen is not active.
      if (!isLandscape || !fullscreen) {
        setShouldShow(true);
      } else {
        setShouldShow(false);
      }
    };

    syncWithDeviceState();

    window.addEventListener('resize', syncWithDeviceState);
    window.addEventListener('orientationchange', syncWithDeviceState);
    document.addEventListener('fullscreenchange', syncWithDeviceState);
    document.addEventListener('webkitfullscreenchange', syncWithDeviceState);
    document.addEventListener('msfullscreenchange', syncWithDeviceState);

    return () => {
      window.removeEventListener('resize', syncWithDeviceState);
      window.removeEventListener('orientationchange', syncWithDeviceState);
      document.removeEventListener('fullscreenchange', syncWithDeviceState);
      document.removeEventListener('webkitfullscreenchange', syncWithDeviceState);
      document.removeEventListener('msfullscreenchange', syncWithDeviceState);
    };
  }, []);

  const activateFullscreenAndLandscape = async () => {
    try {
      const root = document.documentElement;
      if (root && !isFullscreenActive()) {
        if (typeof root.requestFullscreen === 'function') {
          await root.requestFullscreen();
        } else if (typeof root.webkitRequestFullscreen === 'function') {
          await root.webkitRequestFullscreen();
        } else if (typeof root.msRequestFullscreen === 'function') {
          await root.msRequestFullscreen();
        }
      }
      
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        try {
          await screen.orientation.lock('landscape');
        } catch (err) {
          console.warn('Orientation lock failed or not supported', err);
        }
      }
    } catch (err) {
      console.error('Fullscreen request failed', err);
    }
  };

  if (!shouldShow) return null;

  const isPWA = isPwaMode();
  const fullscreen = isFullscreenActive();
  const canGoFullscreen = canRequestFullscreen();
  const shouldShowFullscreenButton = !isPWA && !fullscreen && canGoFullscreen;

  return (
    <div className="mobile-orientation-modal" style={{ display: 'flex' }}>
      <div className="mobile-orientation-modal-panel">
        <h2 style={{ marginBottom: '15px' }}>OPTIMAL EXPERIENCE</h2>
        <p className="mobile-orientation-modal-message">
          The Game Fight is designed to be played in landscape mode.
        </p>
        
        {shouldShowFullscreenButton && (
          <button 
            className="button menu-button mobile-orientation-modal-button" 
            onClick={activateFullscreenAndLandscape}
            style={{ marginTop: '20px' }}
          >
            ACTIVATE FULLSCREEN
          </button>
        )}

        {!shouldShowFullscreenButton && !fullscreen && (
          <p className="mobile-orientation-modal-message" style={{ marginTop: '12px', marginBottom: 0 }}>
            Open the browser menu and switch to fullscreen mode.
          </p>
        )}
      </div>
    </div>
  );
}
