import React, { useEffect, useRef } from 'react';
import useGameStore from '../../store/useGameStore';
import { gsap } from 'gsap';

export default function HealthBar({ playerNum }) {
  const health = useGameStore((state) => 
    playerNum === 1 ? state.playerHealth : state.enemyHealth
  );
  
  const className = playerNum === 1 ? 'player' : 'enemy';
  const barRef = useRef(null);

  useEffect(() => {
    if (barRef.current) {
      gsap.to(barRef.current, { width: `${health}%`, duration: 0.3 });
    }
  }, [health]);

  return (
    <div className="health-bar">
      <div 
        ref={barRef}
        className={className} 
        style={{ 
          width: '100%', 
          backgroundColor: '#39b54a'
        }} 
      ></div>
    </div>
  );
}
