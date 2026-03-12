// src/components/CharacterSelect.jsx
import React, { useState } from 'react';
import useGameStore from '../store/useGameStore';
import { ROSTER } from '../engine/utils/roster';

export default function CharacterSelect() {
  const { setView } = useGameStore();
  const rosterList = Object.values(ROSTER);
  // Do odtworzenia starego zachowania: wybór następuje sekwencyjnie.
  // Gracz 1 wybiera najpierw, potem Gracz 2.
  const [p1Choice, setP1Choice] = useState(null);
  const [p2Choice, setP2Choice] = useState(null);
  const [activeSlot, setActiveSlot] = useState('player1'); // 'player1' lub 'player2'

  const handleSelect = (charId) => {
    if (activeSlot === 'player1') {
      setP1Choice(charId);
      setActiveSlot('player2');
    } else {
      setP2Choice(charId);
      // Zezwalaj na reedycję P1 jak P2 już ma.
      if (!p1Choice) setActiveSlot('player1');
    }
  };

  const handleStart = () => {
    if (!p1Choice || !p2Choice) return;
    
    // Zapisz wybór do stora i rozpocznij rundę (GameEngine to przechwyci)
    useGameStore.setState({ 
      p1Character: p1Choice, 
      p2Character: p2Choice 
    });
    setView('GAME');
  };

  return (
    <div className="who-win" style={{ display: 'flex' }}>
      <div>Character Select</div>
      
      <div className="character-select-single">
        <div className="char-preview">
          <div 
            className={`select-box ${activeSlot === 'player1' ? 'gp-focused' : ''}`}
            onClick={() => setActiveSlot('player1')}
            style={{ cursor: 'pointer' }}
          >
            Player 1: {p1Choice || '(none)'}
          </div>
          <div 
            className={`select-box ${activeSlot === 'player2' ? 'gp-focused' : ''}`}
            onClick={() => setActiveSlot('player2')}
            style={{ cursor: 'pointer' }}
          >
            Player 2: {p2Choice || '(none)'}
          </div>
        </div>

        <div className="roster-wrap">
          {rosterList.map((r) => {
            let selectionClass = '';
            if (p1Choice === r.id && p2Choice === r.id) selectionClass = 'avatar-selected-both';
            else if (p1Choice === r.id) selectionClass = 'avatar-selected-player1';
            else if (p2Choice === r.id) selectionClass = 'avatar-selected-player2';

            return (
              <button 
                key={r.id} 
                className={`avatar-btn ${selectionClass}`}
                onClick={() => handleSelect(r.id)}
                style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0 }}
              >
                <img src={`/assets/images/${r.id}/avatar.png`} alt={r.name} width="64" height="64" style={{ display: 'block' }} />
              </button>
            )
          })}
        </div>
      </div>
      
      <div className="char-actions">
        <button 
          className="button" 
          onClick={() => setView('MENU')}
        >
          Back to Menu
        </button>
        <button 
          className="button" 
          onClick={handleStart}
          disabled={!p1Choice || !p2Choice}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}