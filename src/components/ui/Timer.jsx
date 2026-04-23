import React from 'react';
import useGameStore from '../../store/useGameStore';

export default function Timer() {
  const timer = useGameStore((state) => state.timer);
  const timeRemaining = useGameStore((state) => state.timeRemaining);
  const matchType = useGameStore((state) => state.matchType);
  const player1Score = useGameStore((state) => state.player1Score);
  const player2Score = useGameStore((state) => state.player2Score);

  const activeSeconds = matchType === 'CTF' ? timeRemaining : timer;
  const minutes = Math.floor(activeSeconds / 60);
  const seconds = activeSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className={`timer ${matchType === 'CTF' ? 'timer-ctf' : ''}`}>
      <span>{formattedTime}</span>
      {matchType === 'CTF' && (
        <span className="timer-score">{`${player1Score} : ${player2Score}`}</span>
      )}
    </div>
  );
}
