export class MultiplayerMenu {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'who-win';
    this.el.style.display = 'flex';
    this.el.style.flexDirection = 'column';
    this.el.style.gap = '12px';

    const title = document.createElement('div');
    title.textContent = 'Multiplayer';
    title.style.marginBottom = '20px';
    this.el.appendChild(title);

    this.btnHost = this._createButton('Host Online');
    this.btnJoin = this._createButton('Join Online');
    this.btnBack = this._createButton('Back');

    this.focusIndex = 0;
    this.focusables = [this.btnHost, this.btnJoin, this.btnBack];
    this._updateFocus();

    // Gamepad navigation
    this._onGpUp = () => this._moveFocus(-1);
    this._onGpDown = () => this._moveFocus(1);
    this._onGpLeft = () => this._moveFocus(-1);
    this._onGpRight = () => this._moveFocus(1);
    this._onGpConfirm = () => {
      const el = this.focusables[this.focusIndex];
      if (el) el.click();
    };
    this._onGpBack = () => this.btnBack.click();
  }

  _createButton(text) {
    const btn = document.createElement('button');
    btn.className = 'button menu-button';
    btn.textContent = text;
    this.el.appendChild(btn);
    return btn;
  }

  _moveFocus(delta) {
    const len = this.focusables.length;
    if (!len) return;
    this.focusIndex = (this.focusIndex + delta + len) % len;
    this._updateFocus();
  }

  _updateFocus() {
    this.focusables.forEach((el, i) => {
      if (i === this.focusIndex) el.classList.add('gp-focused');
      else el.classList.remove('gp-focused');
    });
  }

  show(parent = document.body) {
    this.el.style.display = 'flex';
    parent.appendChild(this.el);
    
    // Add gamepad listeners
    document.addEventListener('gp-up', this._onGpUp);
    document.addEventListener('gp-down', this._onGpDown);
    document.addEventListener('gp-left', this._onGpLeft);
    document.addEventListener('gp-right', this._onGpRight);
    document.addEventListener('gp-confirm', this._onGpConfirm);
    document.addEventListener('gp-back', this._onGpBack);
    
    try {
      const hasPad = navigator.getGamepads ? Array.from(navigator.getGamepads()).some(g => !!g) : false;
      if (hasPad) this._updateFocus();
      else this.focusables.forEach(el => el.classList.remove('gp-focused'));
    } catch (e) {}
  }

  hide() {
    if (this.el.parentElement) this.el.parentElement.removeChild(this.el);
    
    // Remove gamepad listeners
    document.removeEventListener('gp-up', this._onGpUp);
    document.removeEventListener('gp-down', this._onGpDown);
    document.removeEventListener('gp-left', this._onGpLeft);
    document.removeEventListener('gp-right', this._onGpRight);
    document.removeEventListener('gp-confirm', this._onGpConfirm);
    document.removeEventListener('gp-back', this._onGpBack);
  }

  onSelect(cb) {
    this.btnHost.addEventListener('click', () => cb('host'));
    this.btnJoin.addEventListener('click', () => cb('join'));
    this.btnBack.addEventListener('click', () => cb('back'));
  }
}
