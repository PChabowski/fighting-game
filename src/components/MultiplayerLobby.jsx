import React, { useEffect, useState, useRef } from 'react';
import useGameStore from '../store/useGameStore';
import { ROSTER } from '../engine/utils/roster';
import { peerManager } from '../engine/utils/peer';
import { LEVELS, DEFAULT_LEVEL } from '../engine/scenes/index';

export default function MultiplayerLobby() {
  const { setView, isHost } = useGameStore();
  const rosterList = Object.values(ROSTER);
  const mapList = Object.values(LEVELS);

  const [peerId, setPeerId] = useState(null);
  const [status, setStatus] = useState(isHost ? 'Waiting for player' : 'Connecting to host');
  const [localSelection, setLocalSelection] = useState(null);
  const [remoteSelection, setRemoteSelection] = useState(null);
  const [activeMap, setActiveMap] = useState(DEFAULT_LEVEL);
  const [showMapSelect, setShowMapSelect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dots, setDots] = useState('');

  const localSelectionRef = useRef(localSelection);
  useEffect(() => {
    localSelectionRef.current = localSelection;
  }, [localSelection]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isHost) {
      peerManager.initHost();
      peerManager.onOpen((id) => {
        setPeerId(id);
      });
      peerManager.onConnection(() => {
        setStatus('Connected to player!');
        if (localSelectionRef.current) {
          setTimeout(() => {
            peerManager.send({ type: 'select', characterId: localSelectionRef.current });
          }, 500);
        }
      });
      peerManager.onClose(() => {
        setStatus('Waiting for player');
        setRemoteSelection(null);
      });
      peerManager.onData((data) => {
        if (data.type === 'select') {
           setRemoteSelection(data.characterId);
        }
      });
    } else {
      const targetId = useGameStore.getState().remotePeerId;
      peerManager.connectToHost(targetId);
      peerManager.onConnection(() => {
        setStatus('Connected to host!');
        if (localSelectionRef.current) {
          setTimeout(() => {
            peerManager.send({ type: 'select', characterId: localSelectionRef.current });
          }, 500);
        }
      });
      peerManager.onClose(() => {
        setStatus('Connection lost. Connecting to host');
        setRemoteSelection(null);
      });
      peerManager.onData((data) => {
        if (data.type === 'select') {
          setRemoteSelection(data.characterId);
        }
        if (data.type === 'start') {
          if (data.levelId) {
            useGameStore.getState().setSelectedLevel(data.levelId);
          }
          useGameStore.setState({ 
            p1Character: data.p1Character, 
            p2Character: data.p2Character 
          });
          setView('GAME');
        }
      });
    }

    return () => {
      // Disconnect handled by leave
    };
  }, [isHost]);

  const handleSelect = (charId) => {
    setLocalSelection(charId);
    peerManager.send({ type: 'select', characterId: charId });
  };

  const handleStart = () => {
    if (!localSelection || !remoteSelection) return;
    
    useGameStore.getState().setSelectedLevel(activeMap);
    
    peerManager.send({ 
      type: 'start', 
      p1Character: localSelection, 
      p2Character: remoteSelection,
      levelId: activeMap
    });
    
    useGameStore.setState({ 
      p1Character: localSelection, 
      p2Character: remoteSelection 
    });
    setView('GAME');
  };

  const handleLeave = () => {
    peerManager.disconnect();
    useGameStore.setState({ isMultiplayer: false });
    setView('MULTI_MENU');
  };

  const handleCopyId = () => {
    if (peerId) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(peerId)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(err => console.error('Kopiowanie nie powiodło się:', err));
      } else {
        // Fallback dla starszych przeglądarek lub połączeń przez HTTP (np. sieć lokalna LAN)
        const textArea = document.createElement("textarea");
        textArea.value = peerId;
        
        // Ukrywamy element
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error('Kopiowanie awaryjne nie powiodło się', err);
        }
        
        document.body.removeChild(textArea);
      }
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
      
      {isHost && peerId && (
        <div style={{ marginBottom: '20px' }}>
          <div 
            onClick={handleCopyId}
            title="Click to copy"
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
            {copied ? 'ID Copied!' : `Your ID: ${peerId}`}
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
