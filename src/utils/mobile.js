// Single, consolidated mobile controls module
export function isMobile() {
  if (typeof navigator === 'undefined') return false;
  return (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function createButton(id, text, className) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.className = `mobile-btn ${className || ''}`.trim();
  btn.innerHTML = text;
  return btn;
}

export function initMobileControls(keys = {}, callbacks = {}) {
  // callbacks: { jump, jumpRelease, attack, attackRelease, onLeft, onLeftRelease, onRight, onRightRelease }
  if (!isMobile()) return null;

  // Avoid creating duplicate controls
  if (document.querySelector('#mobile-controls')) return document.getElementById('mobile-controls');

  const container = document.createElement('div');
  container.id = 'mobile-controls';
  container.className = 'mobile-controls-container';

  const dpad = document.createElement('div');
  dpad.className = 'dpad-container';

  const left = createButton('btn-left', '&larr;', 'dpad-btn');
  const right = createButton('btn-right', '&rarr;', 'dpad-btn');
  dpad.appendChild(left);
  dpad.appendChild(right);

  const actions = document.createElement('div');
  actions.className = 'action-buttons';
  const jumpBtn = createButton('btn-jump', 'J', 'action-btn jump-btn');
  const attackBtn = createButton('btn-attack', 'A', 'action-btn attack-btn');
  actions.appendChild(jumpBtn);
  actions.appendChild(attackBtn);

  container.appendChild(dpad);
  container.appendChild(actions);
  document.body.appendChild(container);

  const wire = (el, keyName, onPress, onRelease) => {
    const press = (e) => {
      e && e.preventDefault();
      if (keys && keys[keyName]) keys[keyName].pressed = true;
      if (typeof onPress === 'function') onPress();
      el.classList.add('active');
    };
    const release = (e) => {
      e && e.preventDefault();
      if (keys && keys[keyName]) keys[keyName].pressed = false;
      if (typeof onRelease === 'function') onRelease();
      el.classList.remove('active');
    };

    el.addEventListener('touchstart', press);
    el.addEventListener('touchend', release);
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release);
  };

  wire(left, 'a', () => { if (callbacks.onLeft) callbacks.onLeft(); }, () => { if (callbacks.onLeftRelease) callbacks.onLeftRelease(); });
  wire(right, 'd', () => { if (callbacks.onRight) callbacks.onRight(); }, () => { if (callbacks.onRightRelease) callbacks.onRightRelease(); });
  wire(jumpBtn, 'w', () => { if (typeof callbacks.jump === 'function') callbacks.jump(); }, () => { if (callbacks.jumpRelease) callbacks.jumpRelease(); });
  wire(attackBtn, 'space', () => { if (typeof callbacks.attack === 'function') callbacks.attack(); }, () => { if (typeof callbacks.attackRelease === 'function') callbacks.attackRelease(); });

  return { container, left, right, jumpBtn, attackBtn };
}

export function hideMobileControls() {
  const el = document.getElementById('mobile-controls'); if (el) el.style.display = 'none';
}
export function showMobileControls() {
  const el = document.getElementById('mobile-controls'); if (el) el.style.display = 'flex';
}
export function removeMobileControls() {
  const el = document.getElementById('mobile-controls'); if (el) el.remove();
}
