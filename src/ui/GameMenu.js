export class GameMenu {
  constructor() {
    this.el = document.createElement('div');
    // reuse who-win styles for centered overlay
    this.el.className = 'who-win';

    const title = document.createElement('div');
    title.textContent = 'Menu';
    this.el.appendChild(title);

    this.startBtn = document.createElement('button');
    this.startBtn.className = 'button';
    this.startBtn.textContent = 'Game Start';
    this.el.appendChild(this.startBtn);
  }

  show(parent = document.body) {
    if (!this.el.parentElement) parent.appendChild(this.el);
    this.el.style.display = 'flex';
  }

  onStart(cb) {
    if (typeof cb !== 'function') return;
    this.startBtn.addEventListener('click', (e) => {
      try { cb(e); } catch (err) {}
      this.remove();
    });
  }

  remove() {
    if (this.el && this.el.parentElement) this.el.parentElement.removeChild(this.el);
  }
}
