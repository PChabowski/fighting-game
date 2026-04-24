import React, { useEffect, useRef } from 'react';
import useGameStore from '../store/useGameStore';
import { isMobile } from '../engine/utils/mobile';

// Listens for a left-edge swipe (from left edge toward center) and toggles pause.
export default function EdgeSwipeListener() {
  const view = useGameStore((s) => s.view);
  const winner = useGameStore((s) => s.winner);
  const isPaused = useGameStore((s) => s.isPaused);
  const setIsPaused = useGameStore((s) => s.setIsPaused);

  const tracking = useRef({ active: false, startX: 0 });

  useEffect(() => {
    if (!isMobile()) return; // only for mobile

    function onTouchStart(e) {
      if (view !== 'GAME' || winner || isPaused) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const edgeZone = Math.min(40, window.innerWidth * 0.05); // 40px or 5% width
      if (t.clientX <= edgeZone) {
        tracking.current.active = true;
        tracking.current.startX = t.clientX;
      }
    }

    function onTouchMove(e) {
      if (!tracking.current.active) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const threshold = window.innerWidth * 0.5; // swipe to center
      if (t.clientX >= threshold) {
        // open pause menu
        setIsPaused(true);
        tracking.current.active = false;
      }
    }

    function onTouchEnd() {
      tracking.current.active = false;
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [view, winner, isPaused, setIsPaused]);

  return null;
}
