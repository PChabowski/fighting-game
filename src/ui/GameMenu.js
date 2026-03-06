export class GameMenu {
  constructor() {
    this.el = document.createElement('div');
    // reuse who-win styles for centered overlay
    this.el.className = 'who-win';

    const title = document.createElement('div');
    title.textContent = 'Menu';
    this.el.appendChild(title);

    // Arcade first, then PvP; ensure equal widths via class
    this.btnArcade = document.createElement('button');
    this.btnArcade.className = 'button menu-button';
    this.btnArcade.textContent = 'Arcade Mode';
    this.el.appendChild(this.btnArcade);

    this.btnPvp = document.createElement('button');
    this.btnPvp.className = 'button menu-button';
    this.btnPvp.textContent = 'Player vs Player';
    this.el.appendChild(this.btnPvp);

    this.btnMultiplayer = document.createElement('button');
    this.btnMultiplayer.className = 'button menu-button';
    this.btnMultiplayer.textContent = 'Multiplayer';
    this.el.appendChild(this.btnMultiplayer);

    // gamepad focus state (do not apply focus until we know if a pad is connected)
    this.focusIndex = 0;
    this.focusables = [this.btnArcade, this.btnPvp, this.btnMultiplayer];

    // bind gamepad events
    this._onGpUp = () => this._moveFocus(-1);
    this._onGpDown = () => this._moveFocus(1);
    this._onGpLeft = () => this._moveFocus(-1);
    this._onGpRight = () => this._moveFocus(1);
    this._onGpConfirm = () => { const el = this.focusables[this.focusIndex]; if (el) el.click(); };
    this._onGpBack = () => { /* no-op for main menu */ };
    document.addEventListener('gp-up', this._onGpUp);
    document.addEventListener('gp-down', this._onGpDown);
    document.addEventListener('gp-left', this._onGpLeft);
    document.addEventListener('gp-right', this._onGpRight);
    document.addEventListener('gp-confirm', this._onGpConfirm);
    document.addEventListener('gp-back', this._onGpBack);
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
    if (!this.el.parentElement) parent.appendChild(this.el);
    this.el.style.display = 'flex';
    this.el.style.flexDirection = 'column';
    this.el.style.gap = '12px';
    // rebind gp listeners when showing (in case this instance was removed before)
    try {
      if (!this._gpBound) {
        document.addEventListener('gp-up', this._onGpUp);
        document.addEventListener('gp-down', this._onGpDown);
        document.addEventListener('gp-left', this._onGpLeft);
        document.addEventListener('gp-right', this._onGpRight);
        document.addEventListener('gp-confirm', this._onGpConfirm);
        document.addEventListener('gp-back', this._onGpBack);
        this._gpBound = true;
        // apply initial focus only if a gamepad is connected; otherwise clear any gp-focused classes
        const hasPad = navigator.getGamepads ? Array.from(navigator.getGamepads()).some(g => !!g) : false;
        if (hasPad) this._updateFocus();
        else this.focusables.forEach(el => el.classList.remove('gp-focused'));
      }
    } catch (e) {}
  }

  onModeSelect(cb) {
    if (typeof cb !== 'function') return;
    this.btnPvp.addEventListener('click', (e) => { try { this.remove(); } catch (err) {} try { cb('pvp'); } catch (err) {} });
    this.btnArcade.addEventListener('click', (e) => { try { this.remove(); } catch (err) {} try { cb('arcade'); } catch (err) {} });
    this.btnMultiplayer.addEventListener('click', (e) => { try { this.remove(); } catch (err) {} try { cb('multiplayer'); } catch (err) {} });
  }

  remove() {
    if (this.el && this.el.parentElement) this.el.parentElement.removeChild(this.el);
    // remove gamepad listeners
    try {
      document.removeEventListener('gp-up', this._onGpUp);
      document.removeEventListener('gp-down', this._onGpDown);
      document.removeEventListener('gp-left', this._onGpLeft);
      document.removeEventListener('gp-right', this._onGpRight);
      document.removeEventListener('gp-confirm', this._onGpConfirm);
      document.removeEventListener('gp-back', this._onGpBack);
      this._gpBound = false;
    } catch (e) {}
  }
}
