import React, { useState, useEffect } from 'react';
import { isMobile, isAndroid } from '../engine/utils/mobile';

export default function MobileOrientationModal() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!isMobile()) return;

    const syncWithDeviceState = () => {
      const isFullscreenActive = Boolean(document.fullscreenElement);
      const isLandscape = window.innerWidth > window.innerHeight;
      
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                    window.matchMedia('(display-mode: fullscreen)').matches ||
                    window.navigator.standalone === true;
      
      // If we are installed as PWA and in landscape, everything is fine.
      if (isPWA && isLandscape) {
        setShouldShow(false);
        return;
      }
      
      // We show the modal if we are in portrait OR if we are on Android but NOT in fullscreen (and not a PWA in landscape)
      if (!isLandscape || (isAndroid() && !isFullscreenActive)) {
        setShouldShow(true);
      } else {
        setShouldShow(false);
      }
    };

    syncWithDeviceState();

    window.addEventListener('resize', syncWithDeviceState);
    window.addEventListener('orientationchange', syncWithDeviceState);
    document.addEventListener('fullscreenchange', syncWithDeviceState);

    return () => {
      window.removeEventListener('resize', syncWithDeviceState);
      window.removeEventListener('orientationchange', syncWithDeviceState);
      document.removeEventListener('fullscreenchange', syncWithDeviceState);
    };
  }, []);

  const activateFullscreenAndLandscape = async () => {
    try {
      const root = document.documentElement;
      if (root && !document.fullscreenElement && typeof root.requestFullscreen === 'function') {
        await root.requestFullscreen();
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

  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                window.matchMedia('(display-mode: fullscreen)').matches ||
                window.navigator.standalone === true;

  return (
    <div className="mobile-orientation-modal" style={{ display: 'flex' }}>
      <div className="mobile-orientation-modal-panel">
        <h2 style={{ marginBottom: '15px' }}>OPTIMAL EXPERIENCE</h2>
        <p className="mobile-orientation-modal-message">
          The Game Fight is designed to be played in landscape mode.
        </p>
        
        {isAndroid() && !isPWA && (
          <button 
            className="button menu-button mobile-orientation-modal-button" 
            onClick={activateFullscreenAndLandscape}
            style={{ marginTop: '20px' }}
          >
            ACTIVATE FULLSCREEN
          </button>
        )}
      </div>
    </div>
  );
}
