import { useEffect } from 'react';
import useGameStore from '../store/useGameStore';

// Edge swipe from left -> pause the game (singleplayer or multiplayer-aware)
export default function EdgeSwipePause() {
  useEffect(() => {
    let tracking = false;
    let startX = 0;
    let startY = 0;
    const EDGE_ZONE = 30; // px from left edge to start detecting
    const SWIPE_THRESHOLD = 100; // px required to trigger

    function onTouchStart(e) {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX <= EDGE_ZONE) {
        // begin tracking and prevent default navigation gesture
        tracking = true;
        startX = t.clientX;
        startY = t.clientY;
        e.preventDefault();
      }
    }

    function onTouchMove(e) {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      // ignore mostly-vertical moves
      if (dx > SWIPE_THRESHOLD && dy < 150) {
        // trigger pause only when in GAME view and not already paused
        const state = useGameStore.getState();
        if (state.view === 'GAME' && !state.isPaused) {
          state.setIsPaused(true);
        }
        tracking = false;
        e.preventDefault();
      }
    }

    function onTouchEnd() {
      tracking = false;
    }

    // Use non-passive listeners so we can call preventDefault() to block browser back-swipe.
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart, { passive: false });
      document.removeEventListener('touchmove', onTouchMove, { passive: false });
      document.removeEventListener('touchend', onTouchEnd, { passive: true });
      document.removeEventListener('touchcancel', onTouchEnd, { passive: true });
    };
  }, []);

  return null;
}
