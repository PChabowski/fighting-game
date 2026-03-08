export class JoinMenu {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'who-win';
    this.el.style.display = 'flex';
    this.el.style.flexDirection = 'column';
    this.el.style.gap = '20px';

    const title = document.createElement('div');
    title.textContent = 'Enter Host ID';
    this.el.appendChild(title);

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Paste ID here...';
    // Styling the input to match the retro theme
    this.input.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.input.style.border = '4px solid white';
    this.input.style.color = 'white';
    this.input.style.padding = '10px';
    this.input.style.fontSize = '18px';
    this.input.style.fontFamily = '"Press Start 2P"';
    this.input.style.width = '300px';
    this.input.style.textAlign = 'center';
    this.el.appendChild(this.input);

    this.btnConnect = document.createElement('button');
    this.btnConnect.className = 'button menu-button';
    this.btnConnect.textContent = 'Connect';
    this.el.appendChild(this.btnConnect);

    this.btnBack = document.createElement('button');
    this.btnBack.className = 'button menu-button';
    this.btnBack.textContent = 'Back';
    this.el.appendChild(this.btnBack);

    this.focusIndex = 0;
    this.focusables = [this.input, this.btnConnect, this.btnBack];

    // Gamepad handlers
    this._onGpUp = () => this._moveGpFocus(-1);
    this._onGpDown = () => this._moveGpFocus(1);
    this._onGpLeft = () => this._moveGpFocus(-1);
    this._onGpRight = () => this._moveGpFocus(1);
    this._onGpConfirm = () => {
      const el = this.focusables[this.focusIndex];
      if (el === this.input) el.focus();
      else el?.click();
    };
    this._onGpBack = () => this.btnBack.click();
  }

  _moveGpFocus(delta) {
    const len = this.focusables.length;
    if (!len) return;
    this.focusIndex = (this.focusIndex + delta + len) % len;
    this._updateGpFocus();
  }

  _updateGpFocus() {
    this.focusables.forEach((el, i) => {
      if (i === this.focusIndex) el.classList.add('gp-focused');
      else el.classList.remove('gp-focused');
    });
  }

  show(parent = document.body) {
    this.el.style.display = 'flex';
    parent.appendChild(this.el);
    this.input.focus();

    document.addEventListener('gp-up', this._onGpUp);
    document.addEventListener('gp-down', this._onGpDown);
    document.addEventListener('gp-left', this._onGpLeft);
    document.addEventListener('gp-right', this._onGpRight);
    document.addEventListener('gp-confirm', this._onGpConfirm);
    document.addEventListener('gp-back', this._onGpBack);

    try {
      const hasPad = navigator.getGamepads ? Array.from(navigator.getGamepads()).some(g => !!g) : false;
      if (hasPad) this._updateGpFocus();
      else this.focusables.forEach(el => el.classList.remove('gp-focused'));
    } catch (e) {}
  }

  hide() {
    if (this.el.parentElement) this.el.parentElement.removeChild(this.el);

    document.removeEventListener('gp-up', this._onGpUp);
    document.removeEventListener('gp-down', this._onGpDown);
    document.removeEventListener('gp-left', this._onGpLeft);
    document.removeEventListener('gp-right', this._onGpRight);
    document.removeEventListener('gp-confirm', this._onGpConfirm);
    document.removeEventListener('gp-back', this._onGpBack);
  }

  onConnect(cb) {
    const handleConnect = () => {
      const id = this.input.value.trim();
      if (id) cb(id);
    };

    this.btnConnect.addEventListener('click', handleConnect);
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleConnect();
    });
  }

  onBack(cb) {
    this.btnBack.addEventListener('click', () => cb());
  }
}
