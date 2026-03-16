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
        <div style={{ maxWidth: 900, color: '#fff', marginTop: 12 }}>
          <header style={{ marginBottom: 18 }}>
            <h1>Privacy Policy</h1>
            <p style={{ color: '#ddd' }}>Last updated: 15 March 2026</p>
          </header>

          <section>
            <h2>Introduction</h2>
            <p style={{ color: '#ddd' }}>
              This site respects your privacy. This page explains how we use cookies and similar technologies.
            </p>
          </section>

          <section>
            <h2>Cookies we use</h2>
            <ul style={{ color: '#ddd' }}>
              <li><strong>Necessary</strong> — required for basic website functionality.</li>
              <li><strong>Analytics</strong> — used to collect anonymous usage information (Google Analytics).</li>
              <li><strong>Marketing</strong> — optional marketing/tracking cookies.</li>
            </ul>
          </section>

          <section>
            <h2>Google Analytics</h2>
            <p style={{ color: '#ddd' }}>
              We use Google Analytics (gtag.js) to collect anonymous information about site usage. Analytics is only enabled if you consent via the cookie settings.
            </p>
          </section>

          <section>
            <h2>How to control cookies</h2>
            <p style={{ color: '#ddd' }}>
              Use the cookie settings banner on the site to accept or choose your preferences. You can also clear your stored preferences in your browser.
            </p>
          </section>

          <footer style={{ marginTop: 18, color: '#bbb' }}>
            <p>If you have questions about this policy, contact the site owner.</p>
          </footer>
        </div>
      </article>
    </div>
  );
}
