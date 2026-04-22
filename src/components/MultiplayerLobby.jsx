import React, { useEffect, useState, useRef } from 'react';
import useGameStore from '../store/useGameStore';
import { ROSTER } from '../engine/utils/roster';
import { onPlayerJoin, getMyPlayer, isGameHost } from '../engine/utils/playroom';
import { LEVELS, DEFAULT_LEVEL } from '../engine/scenes/index';

import { usePlayersList } from 'playroomkit';

export default function MultiplayerLobby() {
  const { setView } = useGameStore();
  const rosterList = Object.values(ROSTER);
  const mapList = Object.values(LEVELS);

  const [localSelection, setLocalSelection] = useState(null);
  const [remoteSelection, setRemoteSelection] = useState(null);
  const [activeMap, setActiveMap] = useState(DEFAULT_LEVEL);
  const [showMapSelect, setShowMapSelect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dots, setDots] = useState('');
  
  const isHost = useGameStore(state => state.isHost);
  
  // Natively use Playroom's hook to track active players
  const activePlayers = usePlayersList(true);
  
  const connectedCount = activePlayers.length;
  const status = connectedCount >= 2 ? `Connected! Players: ${connectedCount}` : `Waiting... Players: 1/${connectedCount}`;

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Poll for remote player states
    const pollInterval = setInterval(() => {
        const myId = getMyPlayer()?.id;
        if (!myId) return;

        let allReady = false;
        let activeMapFromHost = null;

        activePlayers.forEach(p => {
             if (p.id !== myId) {
                  // Fallback: also check p.getState returning empty and try to force update if possible.
                  const rSelection = p.getState('characterSelection');
                  if (rSelection !== undefined && rSelection !== null) {
                      setRemoteSelection(rSelection);
                  }
             }
             const readyData = p.getState('readyToLoadMap');
             if (readyData && readyData.start) {
                  allReady = true;
                  if (readyData.levelId) {
                       activeMapFromHost = readyData.levelId;
                  }
             }
        });

        if (allReady) {
            clearInterval(pollInterval);
            if (activeMapFromHost) {
                useGameStore.getState().setSelectedLevel(activeMapFromHost);
            }
            // Fetch latest local vs remote selection (they might be stored in state slightly out of sync)
            const myChar = getMyPlayer().getState('characterSelection');
            const p1 = isHost ? myChar : getRemoteChar(activePlayers, myId);
            const p2 = isHost ? getRemoteChar(activePlayers, myId) : myChar;
            useGameStore.setState({ 
                p1Character: p1 || localSelection, 
                p2Character: p2 || remoteSelection 
            });
            setView('GAME');
        }
    }, 100);

    return () => {
       clearInterval(pollInterval);
    };
  }, [activePlayers, isHost, localSelection, remoteSelection]);

  const getRemoteChar = (playersArr, myId) => {
      const p = playersArr.find(pl => pl.id !== myId);
      return p ? p.getState('characterSelection') : null;
  };

  const handleSelect = (charId) => {
    setLocalSelection(charId);
    getMyPlayer().setState('characterSelection', charId, true);
  };

  const handleStart = () => {
    if (!localSelection || !remoteSelection) return;
    
    // Zapiszmy informację globalnie u Playroom Hosta by wystartować
    getMyPlayer().setState('readyToLoadMap', { start: true, levelId: activeMap }, true);
    
    const p1 = isHost ? localSelection : remoteSelection;
    const p2 = isHost ? remoteSelection : localSelection;

    useGameStore.getState().setSelectedLevel(activeMap);
    useGameStore.setState({ p1Character: p1, p2Character: p2 });
    setView('GAME');
  };
// Nothing

  const handleLeave = () => {
    // Wyczyść parametr ?r= z URL, żeby nie zapętlić dołączania jako gość
    window.location.href = window.location.pathname;
  };

  const handleCopyId = () => {
    const url = window.location.href;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => console.error('Kopiowanie nie powiodło się:', err));
    }
  };

  const hostSelection = isHost ? localSelection : remoteSelection;
  const guestSelection = isHost ? remoteSelection : localSelection;
  const hostLabel = isHost ? 'Host (You)' : 'Host';
  const guestLabel = isHost ? 'Player 2' : 'Player 2 (You)';

  const isConnected = status.includes('Connected') || status.includes('Połączono');
  const displayDots = !isConnected;

  if (!isHost && !isConnected) {
    return (
      <div className="who-win" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: '40px'
      }}>
        <div style={{ fontSize: '24px', textAlign: 'center' }}>
          <span>Connecting to host</span>
          <span style={{ display: 'inline-block', width: '40px', textAlign: 'left' }}>{dots}</span>
        </div>
        <button 
          className="button menu-button" 
          onClick={handleLeave}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (showMapSelect && isHost) {
    return (
      <div className="who-win" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>Select Map</div>
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
          <button className="button menu-button" onClick={() => setShowMapSelect(false)}>
            Back to Select
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="who-win" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: '24px', marginBottom: '10px' }}>Multiplayer Lobby</div>
      <div style={{ marginBottom: '20px', color: isConnected ? '#0f0' : '#fff', textAlign: 'center' }}>
        <span>{status}</span>
        {displayDots && (
          <span style={{ display: 'inline-block', width: '40px', textAlign: 'left' }}>
            {dots}
          </span>
        )}
      </div>
      
      {isHost && (
        <div style={{ marginBottom: '20px' }}>
          <div 
            onClick={handleCopyId}
            title="Click to copy url"
            style={{
              fontSize: '14px',
              color: '#fff',
              backgroundColor: 'rgba(0,0,0,0.5)',
              padding: '10px',
              border: '2px solid white',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            {copied ? 'Link Copied!' : `Copy Invite Link`}
          </div>
        </div>
      )}

      <div className="character-select-single">
        <div className="char-preview" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <div className="select-box">
            {hostLabel}: {hostSelection || '(None)'}
          </div>
          <div className="select-box">
            {guestLabel}: {guestSelection || '(None)'}
          </div>
        </div>

        <div className="roster-wrap">
          {rosterList.map((r) => {
            let selectionClass = '';
            if (localSelection === r.id && remoteSelection === r.id) selectionClass = 'avatar-selected-both';
            else if (localSelection === r.id) selectionClass = 'avatar-selected-player1';
            else if (remoteSelection === r.id) selectionClass = 'avatar-selected-player2';
            
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
          onClick={handleLeave}
        >
          Leave Lobby
        </button>

        {isHost && (
          <button 
            className="button menu-button" 
            onClick={() => setShowMapSelect(true)}
          >
            Select Map
          </button>
        )}

        {isHost && (
          <button 
            className="button menu-button" 
            onClick={handleStart}
            disabled={!localSelection || !remoteSelection}
            style={{ opacity: (!localSelection || !remoteSelection) ? 0.5 : 1 }}
          >
            Start Game
          </button>
        )}
      </div>
    </div>
  );
}
