// src/components/GameCanvas.jsx
import React, { useEffect, useRef } from 'react';
import useGameStore from '../store/useGameStore';
// To be implemented - we will refactor game.js into GameEngine.js
import { initGameEngine, destroyGameEngine } from '../engine/GameEngine.js';

export default function GameCanvas() {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (canvasRef.current) {
        initGameEngine(canvasRef.current, useGameStore);
    }
    
    return () => {
        destroyGameEngine();
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}