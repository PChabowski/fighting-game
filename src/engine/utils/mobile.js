// Single, consolidated mobile controls module
export function isAndroid() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  // Account for iPhones, iPads, and iOS 13+ iPads pretending to be Macs but having touch points
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isMobile() {
  return isAndroid() || isIOS();
}

function createButton(id, text, className) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.innerText = text;
  btn.className = className;
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

  const left = createButton('btn-left', '←', 'dpad-btn');
  const right = createButton('btn-right', '→', 'dpad-btn');
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
