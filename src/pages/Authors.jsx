// src/pages/Authors.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../store/useGameStore';
import '../style.css';

const contributors = [
  // Fill with real contributors/asset authors later
  { name: 'Free Asset Author 1', url: 'https://example.com' },
  { name: 'Free Asset Author 2', url: 'https://example.com' },
];

export default function Authors() {
  const navigate = useNavigate();
  const setView = useGameStore(state => state.setView);

  function goBack() {
    // return to game menu view and navigate home
    setView('MENU');
    navigate('/');
  }

  return (
    <div className="conteiner">
      <button className="button menu-button" onClick={goBack} style={{ position: 'absolute', top: 12, left: 12 }}>Back</button>
      <article>
        <h1>Game Authors</h1>
        <h3>Author</h3>
        <p>
          Your Name — <a href="https://your-site.example" target="_blank" rel="noreferrer">https://your-site.example</a>
        </p>

        <h3>Contributors & asset authors</h3>
        <ul>
          {contributors.map((c, idx) => (
            <li key={idx}>
              {c.name} — <a href={c.url} target="_blank" rel="noreferrer">link</a>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
