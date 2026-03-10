import React, { useEffect, useState } from 'react';
import useGameStore from '../store/useGameStore';
import { ROSTER } from '../engine/utils/roster';

export default function Preloader() {
  const setView = useGameStore((state) => state.setView);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const assetsToLoad = [
      'assets/images/background.png',
      'assets/images/shop.png',
      'assets/images/Mack/avatar.png',
      'assets/images/Kenji/avatar.png'
    ];

    // Collect all character sprites
    Object.values(ROSTER).forEach(char => {
      Object.values(char.sprites).forEach(sprite => {
        // Fix path from '../assets/' to 'assets/'
        assetsToLoad.push(sprite.imageSrc.replace('../assets/', 'assets/'));
      });
    });

    let loaded = 0;
    const total = assetsToLoad.length;

    assetsToLoad.forEach(src => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        loaded++;
        setProgress(Math.floor((loaded / total) * 100));
        if (loaded === total) {
          // Add a small delay for visual smoothness
          setTimeout(() => setView('MENU'), 500);
        }
      };
      img.onerror = () => {
        console.warn(`Failed to preload: ${src}`);
        loaded++;
        setProgress(Math.floor((loaded / total) * 100));
        if (loaded === total) {
          setTimeout(() => setView('MENU'), 500);
        }
      };
    });
  }, [setView]);

  return (
    <div className="who-win" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
      <h2 style={{ marginBottom: '20px', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>LOADING... {progress}%</h2>
      <div style={{ width: '300px', height: '10px', background: '#333', border: '2px solid white' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: '#1e90ff', transition: 'width 0.2s' }} />
      </div>
    </div>
  );
}
