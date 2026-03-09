import React, { useEffect, useState } from 'react';
import useGameStore from '../store/useGameStore';
import { ROSTER } from '../engine/utils/roster';
import { peerManager } from '../engine/utils/peer';

export default function MultiplayerLobby() {
  const { setView, isHost } = useGameStore();
  const rosterList = Object.values(ROSTER);

  const [peerId, setPeerId] = useState(null);
  const [status, setStatus] = useState(isHost ? 'Waiting for opponent...' : 'Connecting to host...');
  
  const [localSelection, setLocalSelection] = useState(null);
  const [remoteSelection, setRemoteSelection] = useState(null);

  useEffect(() => {
    if (isHost) {
      peerManager.initHost();
      peerManager.onOpen((id) => {
        setPeerId(id);
      });
      peerManager.onConnection(() => {
        setStatus('Opponent connected!');
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
      });
      peerManager.onData((data) => {
        if (data.type === 'select') {
          setRemoteSelection(data.characterId);
        }
        if (data.type === 'start') {
          // Jako klient musimy po otrzymaniu "start" wejsc do gry uwzgledniajac kto jest kto
          // P1 to zawsze host
          useGameStore.setState({ 
            p1Character: data.p1Character, 
            p2Character: data.p2Character 
          });
          setView('GAME');
        }
      });
    }

    return () => {
      // Przy odmontowywaniu bez rozpoczęcia gry można rozłączyć piny, ale zostawmy to na 'Leave'
    };
  }, [isHost]);

  const handleSelect = (charId) => {
    setLocalSelection(charId);
    peerManager.send({ type: 'select', characterId: charId });
  };

  const handleStart = () => {
    if (!localSelection || !remoteSelection) return;
    peerManager.send({ 
      type: 'start', 
      p1Character: localSelection, 
      p2Character: remoteSelection 
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

  return (
    <div className="who-win" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: '24px', marginBottom: '10px' }}>Multiplayer Lobby</div>
      <div style={{ marginBottom: '20px' }}>{status}</div>
      
      {isHost && peerId && (
        <div style={{ marginBottom: '20px' }}>
          Your ID: <strong>{peerId}</strong>
        </div>
      )}

      <div className="character-select-single">
        <div className="char-preview">
          <div className="select-box">
            You: {localSelection || '(None)'}
          </div>
          <div className="select-box">
            Opponent: {remoteSelection || '(None)'}
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
