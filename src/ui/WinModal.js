export class WinModal {
  constructor() {
    // create modal element but do NOT append to DOM yet
    this.el = document.createElement('div');
    this.el.id = 'whoWin';
    this.el.className = 'who-win';

    this.messageEl = document.createElement('div');
    this.messageEl.id = 'win';
    this.el.appendChild(this.messageEl);

    // Rematch button
    this.rematchBtn = document.createElement('button');
    this.rematchBtn.className = 'button menu-button';
    this.rematchBtn.id = 'rematch';
    this.rematchBtn.textContent = 'Rematch';
    this.el.appendChild(this.rematchBtn);

    // Return to menu button
    this.returnBtn = document.createElement('button');
    this.returnBtn.className = 'button menu-button';
    this.returnBtn.id = 'returnToMenu';
    this.returnBtn.textContent = 'Return to Menu';
    this.el.appendChild(this.returnBtn);
    // gamepad focus state
    this.focusIndex = 0;
    this.focusables = [this.rematchBtn, this.returnBtn];
    this._updateFocus = () => {
      this.focusables.forEach((el, i) => {
        if (i === this.focusIndex) el.classList.add('gp-focused');
        else el.classList.remove('gp-focused');
      });
    };

    this._moveFocus = (delta) => {
      const len = this.focusables.length;
      if (!len) return;
      this.focusIndex = (this.focusIndex + delta + len) % len;
      this._updateFocus();
    };

    // gp listeners will be attached when modal is shown so they are active only while visible
    this._onGpUp = (e) => this._moveFocus(-1, e && e.detail && e.detail.index);
    this._onGpDown = (e) => this._moveFocus(1, e && e.detail && e.detail.index);
    this._onGpLeft = (e) => this._moveFocus(-1, e && e.detail && e.detail.index);
    this._onGpRight = (e) => this._moveFocus(1, e && e.detail && e.detail.index);
    this._onGpConfirm = (e) => { const el = this.focusables[this.focusIndex]; if (el) el.click(); };
    this._onGpBack = (e) => { const el = this.returnBtn; if (el) el.click(); };
  }

  show(text, parent = document.body) {
    // Only set the winner text once to avoid repeated writes
    // (the game loop may call show() multiple times at end of round)
    if (text && !this.messageEl.innerHTML) {
      this.messageEl.innerHTML = text;
    }
    if (!this.el.parentElement) parent.appendChild(this.el);
    this.el.style.display = 'flex';
    this.el.style.flexDirection = 'column';
    this.el.style.gap = '12px';
    // bind gp listeners while modal visible
    try {
      document.addEventListener('gp-up', this._onGpUp);
      document.addEventListener('gp-down', this._onGpDown);
      document.addEventListener('gp-left', this._onGpLeft);
      document.addEventListener('gp-right', this._onGpRight);
      document.addEventListener('gp-confirm', this._onGpConfirm);
      document.addEventListener('gp-back', this._onGpBack);
      this._updateFocus();
    } catch (e) {}
  }

  hide() {
    if (this.el && this.el.style) this.el.style.display = 'none';
  }

  onRestart(cb) {
    if (typeof cb !== 'function') return;
    // Backwards-compatible: map to rematch
    this.onRematch(cb);
  }

  onRematch(cb) {
    if (typeof cb !== 'function') return;
    this.rematchBtn.addEventListener('click', (e) => {
      try { cb(e); } catch (err) {}
      this.remove();
    });
  }

  onReturnToMenu(cb) {
    if (typeof cb !== 'function') return;
    this.returnBtn.addEventListener('click', (e) => {
      try { cb(e); } catch (err) {}
      this.remove();
    });
  }

  remove() {
    // clear stored message so next match can set a new winner text
    try { this.messageEl.innerHTML = ''; } catch (e) {}
    if (this.el && this.el.parentElement) this.el.parentElement.removeChild(this.el);
    try {
      document.removeEventListener('gp-up', this._onGpUp);
      document.removeEventListener('gp-down', this._onGpDown);
      document.removeEventListener('gp-left', this._onGpLeft);
      document.removeEventListener('gp-right', this._onGpRight);
      document.removeEventListener('gp-confirm', this._onGpConfirm);
      document.removeEventListener('gp-back', this._onGpBack);
    } catch (e) {}
  }
}
