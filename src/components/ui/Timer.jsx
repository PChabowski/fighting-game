import React from 'react';
import useGameStore from '../../store/useGameStore';

export default function Timer() {
  const timer = useGameStore((state) => state.timer);

  return (
    <div className="timer">
      {timer}
    </div>
  );
}
