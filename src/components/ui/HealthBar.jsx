import React, { useEffect, useRef } from 'react';
import useGameStore from '../../store/useGameStore';
import { gsap } from 'gsap';

export default function HealthBar({ playerNum }) {
  const health = useGameStore((state) => 
    playerNum === 1 ? state.playerHealth : state.enemyHealth
  );
  const stocks = useGameStore((state) => 
    playerNum === 1 ? state.player1Stocks : state.player2Stocks
  );
  
  const className = playerNum === 1 ? 'player' : 'enemy';
  const barRef = useRef(null);

  useEffect(() => {
    if (barRef.current) {
      gsap.to(barRef.current, { width: `${health}%`, duration: 0.3 });
    }
  }, [health]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '400px', flex: '1', maxWidth: '400px' }}>
      <div className="health-bar" style={{ width: '100%', marginBottom: 0 }}>
        <div 
          ref={barRef}
          className={className} 
          style={{ 
            width: '100%', 
            backgroundColor: '#39b54a'
          }} 
        ></div>
      </div>
      <div style={{ display: 'flex', justifyContent: playerNum === 1 ? 'flex-end' : 'flex-start', gap: '4px', padding: '0 4px' }}>
        {[...Array(stocks)].map((_, i) => (
          <div 
            key={i} 
            style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: '#ffcc00', 
              border: '2px solid white' 
            }} 
          />
        ))}
      </div>
    </div>
  );
}
