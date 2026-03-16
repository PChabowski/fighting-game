import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'cookieConsent';
const GA_ID = 'G-LFTF8YQ5R9';

function loadAnalytics() {
  if (typeof window === 'undefined') return;
  if (window.gtag) return; // already loaded

  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  script.async = true;
  document.head.appendChild(script);

  const inline = document.createElement('script');
  inline.innerHTML = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${GA_ID}');`;
  document.head.appendChild(inline);
}

export default function CookieBanner() {
  const [consent, setConsent] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  });

  const [showBanner, setShowBanner] = useState(consent === null);
  const [showModal, setShowModal] = useState(false);
  const [choices, setChoices] = useState(() => ({
    essential: true,
    analytics: false,
    marketing: false,
  }));

  useEffect(() => {
    if (consent) {
      // ensure analytics loaded when consent given
      if (consent.analytics) loadAnalytics();
      setShowBanner(false);
    }
  }, [consent]);

  function saveConsent(obj) {
    const toSave = { ...obj, essential: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    setConsent(toSave);
    setShowModal(false);
    setShowBanner(false);
    if (toSave.analytics) loadAnalytics();
  }

  function acceptAll() {
    saveConsent({ essential: true, analytics: true, marketing: true });
  }

  function openSettings() {
    // prefill modal with current choices or defaults
    const current = consent || choices;
    setChoices({
      essential: true,
      analytics: !!current.analytics,
      marketing: !!current.marketing,
    });
    setShowModal(true);
  }

  function toggleChoice(key) {
    setChoices(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (!showBanner && !showModal) return null;

  return (
    <>
      {showBanner && (
        <div className="cookie-banner" role="dialog" aria-live="polite">
          <div className="cookie-text">
            This site uses cookies to enhance your experience. By choosing "Accept all" you consent to the use of analytics and marketing cookies. Read our <Link to="/privacy">Privacy Policy</Link>.
          </div>
          <div className="cookie-actions">
            <button className="button" onClick={acceptAll}>Accept all</button>
            <button className="button" onClick={openSettings}>Settings</button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="cookie-modal-backdrop" role="dialog" aria-modal="true">
          <div className="cookie-modal-panel">
            <h2>Cookie settings</h2>
            <p>Choose which cookies you allow this site to use.</p>

            <div className="cookie-checkbox">
              <label>
                <input type="checkbox" checked disabled /> Essential cookies (required)
              </label>
            </div>

            <div className="cookie-checkbox">
              <label>
                <input type="checkbox" checked={choices.analytics} onChange={() => toggleChoice('analytics')} /> Analytics cookies
              </label>
            </div>

            <div className="cookie-checkbox">
              <label>
                <input type="checkbox" checked={choices.marketing} onChange={() => toggleChoice('marketing')} /> Marketing cookies
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <button className="button" onClick={() => saveConsent(choices)}>Save selection</button>
              <button className="button" onClick={() => { setShowModal(false); setShowBanner(true); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
