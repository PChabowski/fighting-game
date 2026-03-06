export class WinModal {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'who-win';

    this.title = document.createElement('div');
    this.element.appendChild(this.title);

    this.btnRematch = document.createElement('button');
    this.btnRematch.className = 'button menu-button';
    this.btnRematch.textContent = 'REMATCH';
    this.element.appendChild(this.btnRematch);

    this.btnMenu = document.createElement('button');
    this.btnMenu.className = 'button menu-button';
    this.btnMenu.textContent = 'MAIN MENU';
    this.element.appendChild(this.btnMenu);

    this.focusIndex = 0;
    this.focusables = [this.btnRematch, this.btnMenu];

    // Gamepad event handlers
    this._onGpUp = () => this._moveFocus(-1);
    this._onGpDown = () => this._moveFocus(1);
    this._onGpConfirm = () => {
      const el = this.focusables[this.focusIndex];
      if (el) el.click();
    };

    this.rematchCallback = null;
    this.menuCallback = null;
  }

  _moveFocus(delta) {
    const len = this.focusables.length;
    this.focusIndex = (this.focusIndex + delta + len) % len;
    this._updateFocus();
  }

  _updateFocus() {
    this.focusables.forEach((el, i) => {
      if (i === this.focusIndex) el.classList.add('gp-focused');
      else el.classList.remove('gp-focused');
    });
  }

  show(message, container = document.body, isMultiplayer = false) {
    this.title.textContent = message;
    if (!this.element.parentElement) container.appendChild(this.element);
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = '12px'; // Same gap as main menu

    // Reset focus when showing
    this.focusIndex = 0;
    this._updateFocus();

    // Bind gamepad listeners (standard logic in this project)
    document.addEventListener('gp-up', this._onGpUp);
    document.addEventListener('gp-down', this._onGpDown);
    document.addEventListener('gp-confirm', this._onGpConfirm);
  }

  onRematch(cb) {
    this.rematchCallback = cb;
    this.btnRematch.onclick = () => {
      this.remove();
      if (this.rematchCallback) this.rematchCallback();
    };
  }

  onReturnToMenu(cb) {
    this.menuCallback = cb;
    this.btnMenu.onclick = () => {
      this.remove();
      if (this.menuCallback) this.menuCallback();
      else location.reload();
    };
  }

  remove() {
    if (this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
    document.removeEventListener('gp-up', this._onGpUp);
    document.removeEventListener('gp-down', this._onGpDown);
    document.removeEventListener('gp-confirm', this._onGpConfirm);
  }

  hide() {
    this.remove();
  }
}

