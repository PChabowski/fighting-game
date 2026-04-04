// src/components/CharacterSelect.jsx
import React, { useState } from 'react';
import useGameStore from '../store/useGameStore';
import { ROSTER } from '../engine/utils/roster';
import { LEVELS, DEFAULT_LEVEL } from '../engine/scenes/index';

export default function CharacterSelect() {
  const { setView, setSelectedLevel } = useGameStore();
  const rosterList = Object.values(ROSTER);
  const mapList = Object.values(LEVELS);
  
  // Do odtworzenia starego zachowania: wybór następuje sekwencyjnie.
  // Gracz 1 wybiera najpierw, potem Gracz 2.
  const [p1Choice, setP1Choice] = useState(null);
  const [p2Choice, setP2Choice] = useState(null);
  const [activeMap, setActiveMap] = useState(DEFAULT_LEVEL);
  const [activeSlot, setActiveSlot] = useState('player1'); // 'player1' lub 'player2'
  const [showMapSelect, setShowMapSelect] = useState(false);

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
    // If not filled, return
    if (!p1Choice || !p2Choice) return;
    
    // Zapisz wybór do stora i rozpocznij rundę
    setSelectedLevel(activeMap);
    useGameStore.setState({ 
      p1Character: p1Choice, 
      p2Character: p2Choice
    });
    setView('GAME');
  };

  if (showMapSelect) {
    return (
      <div className="who-win" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Select Map</div>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '600px' }}>
          {mapList.map((map) => (
            <button
              key={map.id}
              onClick={() => setActiveMap(map.id)}
              style={{
                cursor: 'pointer',
                background: activeMap === map.id ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255,255,255,0.1)',
                border: activeMap === map.id ? '2px solid lime' : '1px solid #fff',
                padding: '15px',
                minWidth: '150px'
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{map.name}</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
          <button className="button" onClick={() => setShowMapSelect(false)}>
            Back to Select
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="who-win" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: '24px', marginBottom: '10px' }}>Character Select</div>
      
      <div className="character-select-single">
        <div className="char-preview" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
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
      
      <div className="char-actions" style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        <button 
          className="button menu-button" 
          onClick={() => setView('MENU')}
        >
          Back to Menu
        </button>
        <button 
          className="button menu-button" 
          onClick={() => setShowMapSelect(true)}
        >
          Select Map
        </button>
        <button 
          className="button menu-button" 
          onClick={handleStart}
          disabled={!p1Choice || !p2Choice}
          style={{ opacity: (!p1Choice || !p2Choice) ? 0.5 : 1 }}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}