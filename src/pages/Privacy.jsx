// src/pages/Privacy.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../store/useGameStore';
import '../style.css';

export default function Privacy() {
  const navigate = useNavigate();
  const setView = useGameStore(state => state.setView);

  function goBack() {
    setView('MENU');
    navigate('/');
  }

  return (
    <div className="conteiner">
      <button
        className="button"
        onClick={goBack}
        style={{ position: 'absolute', top: 12, left: 12 }}
        aria-label="Go back"
      >
        ← Back
      </button>
      <article>
        <h1>Privacy Policy</h1>
        <p>This is a short privacy placeholder. Replace with your real policy later.</p>
        <section>
          <h4>Data Collection</h4>
          <p>No personal data is collected by default. Multiplayer uses PeerJS connections for gameplay.</p>
        </section>
      </article>
    </div>
  );
}
