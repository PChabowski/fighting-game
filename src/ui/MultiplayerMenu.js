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
  }

  _createButton(text) {
    const btn = document.createElement('button');
    btn.className = 'button menu-button';
    btn.textContent = text;
    this.el.appendChild(btn);
    return btn;
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
  }

  hide() {
    if (this.el.parentElement) this.el.parentElement.removeChild(this.el);
  }

  onSelect(cb) {
    this.btnHost.addEventListener('click', () => cb('host'));
    this.btnJoin.addEventListener('click', () => cb('join'));
    this.btnBack.addEventListener('click', () => cb('back'));
  }
}
