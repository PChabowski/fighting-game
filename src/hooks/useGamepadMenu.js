import { useEffect } from 'react';
import { initGamepadMenu } from '../engine/utils/input';

let initialized = false;

export default function useGamepadMenu(view) {
  useEffect(() => {
    if (!initialized) {
        initGamepadMenu();
        initialized = true;
    }

    const getAllInteractables = () => {
      // Find all buttons and inputs that are currently visible and not disabled
      return Array.from(document.querySelectorAll('button:not([disabled]), input:not([disabled])')).filter(
        el => {
            const style = window.getComputedStyle(el);
            // Must have dimensions and be not hidden
            return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
        }
      );
    };

    const handleNav = (direction) => {
        // Skip purely in-game view (wait, WinModal overlays on GAME view! 
        // We should allow nav if there are actually interactables overlaid, but let's be careful.
        // Actually, during gameplay, focus doesn't matter unless there is a WIN modale! Let's allow it.)

        const interactables = getAllInteractables();
        // Ignore navigation if nothing is on screen
        if (interactables.length === 0) return;

        // If in game and no modals have buttons, we skip
        // Wait, WinModal HAS buttons, so they will be found! That's perfect.

        // Also we don't want to navigate mobile onscreen buttons
        const filtered = interactables.filter(el => !el.classList.contains('mobile-btn') && !el.classList.contains('mobile-controls-container'));
        if (filtered.length === 0) return;

        const active = document.activeElement;
        const currentIndex = filtered.indexOf(active);

        let nextIndex = 0;
        
        switch (direction) {
            case 'up':
            case 'left':
                if (currentIndex > 0) nextIndex = currentIndex - 1;
                else nextIndex = filtered.length - 1; // Wrap around
                break;
            case 'down':
            case 'right':
                if (currentIndex < filtered.length - 1 && currentIndex !== -1) nextIndex = currentIndex + 1;
                else nextIndex = 0; // Wrap around
                break;
        }

        filtered[nextIndex].focus();
    };

    const onUp = () => handleNav('up');
    const onDown = () => handleNav('down');
    const onLeft = () => handleNav('left');
    const onRight = () => handleNav('right');
    
    // Auto-focus on new views so the controller arrow keys have something to start from
    setTimeout(() => {
        const interactables = getAllInteractables().filter(el => !el.classList.contains('mobile-btn'));
        if (interactables.length > 0 && !interactables.includes(document.activeElement)) {
            interactables[0].focus();
        }
    }, 100);

    const onConfirm = () => {
        const active = document.activeElement;
        if (active && typeof active.click === 'function') {
            active.click(); // Trigger click event on focused item
        } else {
            // First time press to grab focus
            const interactables = getAllInteractables().filter(el => !el.classList.contains('mobile-btn'));
            if (interactables.length > 0) interactables[0].focus();
        }
    };
    
    document.addEventListener('gp-up', onUp);
    document.addEventListener('gp-down', onDown);
    document.addEventListener('gp-left', onLeft);
    document.addEventListener('gp-right', onRight);
    document.addEventListener('gp-confirm', onConfirm);

    return () => {
      document.removeEventListener('gp-up', onUp);
      document.removeEventListener('gp-down', onDown);
      document.removeEventListener('gp-left', onLeft);
      document.removeEventListener('gp-right', onRight);
      document.removeEventListener('gp-confirm', onConfirm);
    };
  }, [view]); // Run again if view changes to refocus elements
}
