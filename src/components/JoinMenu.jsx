import React, { useState } from 'react';
import useGameStore from '../store/useGameStore';

export default function JoinMenu() {
  const { setView } = useGameStore();
  const [hostId, setHostId] = useState('');

  return (
    <div className="who-win" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>Enter Host ID</div>
      
      <input 
        type="text" 
        placeholder="Paste ID here..."
        value={hostId}
        onChange={(e) => setHostId(e.target.value)}
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          border: '4px solid white',
          color: 'white',
          padding: '10px',
          fontSize: '18px',
          fontFamily: '"Press Start 2P"',
          width: '300px',
          textAlign: 'center'
        }}
      />

      <button 
        className="button menu-button"
        onClick={() => {
          if (!hostId) return;
          // Przekaż ID do stora
          useGameStore.setState({ remotePeerId: hostId, isHost: false });
          setView('MULTI_LOBBY');
        }}
      >
        Connect
      </button>

      <button 
        className="button menu-button" 
        onClick={() => setView('MULTI_MENU')}
      >
        Back
      </button>
    </div>
  );
}
