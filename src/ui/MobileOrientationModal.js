import { isMobile } from '../utils/mobile.js';

export class MobileOrientationModal {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'mobile-orientation-modal';

    this.panel = document.createElement('div');
    this.panel.className = 'mobile-orientation-modal-panel';

    this.message = document.createElement('p');
    this.message.className = 'mobile-orientation-modal-message';
    this.message.textContent = 'For the best experience, please play in Fullscreen and Landscape mode.';

    this.button = document.createElement('button');
    this.button.className = 'button menu-button mobile-orientation-modal-button';
    this.button.type = 'button';
    this.button.textContent = 'Switch to Fullscreen & Landscape';

    this.panel.appendChild(this.message);
    this.panel.appendChild(this.button);
    this.el.appendChild(this.panel);

    this._onClick = this.activate.bind(this);
    this.button.addEventListener('click', this._onClick);

    this._onStateChange = this.syncWithDeviceState.bind(this);

    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', this._onStateChange);
    }
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.addEventListener('change', this._onStateChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._onStateChange);
      window.addEventListener('orientationchange', this._onStateChange);
    }
  }

  isLandscape() {
    if (typeof window === 'undefined') return false;
    if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.type === 'string') {
      return screen.orientation.type.includes('landscape');
    }
    return window.innerWidth > window.innerHeight;
  }

  isFullscreenActive() {
    if (typeof document === 'undefined') return false;
    return Boolean(document.fullscreenElement);
  }

  syncWithDeviceState() {
    if (!isMobile()) return;

    const shouldShow = !this.isFullscreenActive() || !this.isLandscape();
    if (shouldShow) {
      this.show();
    } else {
      this.hide();
    }
  }

  async activate() {
    try {
      const root = document.documentElement;
      if (root && !document.fullscreenElement && typeof root.requestFullscreen === 'function') {
        await root.requestFullscreen();
      }

      // Orientation lock may be unavailable on some browsers/devices.
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        try {
          await screen.orientation.lock('landscape');
        } catch (err) {
          // Ignore: fullscreen still improves UX when orientation lock is blocked.
        }
      }

      this.syncWithDeviceState();
    } catch (err) {
      // Keep modal visible when fullscreen request is rejected.
    }
  }

  show(parent = document.body) {
    if (!isMobile()) return;
    if (!this.el.parentElement) parent.appendChild(this.el);
    this.el.style.display = 'flex';
  }

  hide() {
    this.el.style.display = 'none';
  }

  remove() {
    this.button.removeEventListener('click', this._onClick);
    if (typeof document !== 'undefined') {
      document.removeEventListener('fullscreenchange', this._onStateChange);
    }
    if (typeof screen !== 'undefined' && screen.orientation) {
      screen.orientation.removeEventListener('change', this._onStateChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this._onStateChange);
      window.removeEventListener('orientationchange', this._onStateChange);
    }
    if (this.el.parentElement) this.el.parentElement.removeChild(this.el);
  }
}
