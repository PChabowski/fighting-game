export class WinModal {
  constructor() {
    // create modal element but do NOT append to DOM yet
    this.el = document.createElement('div');
    this.el.id = 'whoWin';
    this.el.className = 'who-win';

    this.messageEl = document.createElement('div');
    this.messageEl.id = 'win';
    this.el.appendChild(this.messageEl);

    this.restartBtn = document.createElement('button');
    this.restartBtn.className = 'button';
    this.restartBtn.id = 'restart';
    this.restartBtn.textContent = 'Restart';
    this.el.appendChild(this.restartBtn);
  }

  show(text, parent = document.body) {
    this.messageEl.innerHTML = text;
    if (!this.el.parentElement) parent.appendChild(this.el);
    this.el.style.display = 'flex';
  }

  hide() {
    if (this.el && this.el.style) this.el.style.display = 'none';
  }

  onRestart(cb) {
    if (typeof cb !== 'function') return;
    this.restartBtn.addEventListener('click', (e) => {
      try { cb(e); } catch (err) {}
      this.remove();
    });
  }

  remove() {
    if (this.el && this.el.parentElement) this.el.parentElement.removeChild(this.el);
  }
}
