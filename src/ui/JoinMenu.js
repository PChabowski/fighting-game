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
  }

  show(parent = document.body) {
    this.el.style.display = 'flex';
    parent.appendChild(this.el);
    this.input.focus();
  }

  hide() {
    if (this.el.parentElement) this.el.parentElement.removeChild(this.el);
  }

  onConnect(cb) {
    this.btnConnect.addEventListener('click', () => {
      const id = this.input.value.trim();
      if (id) cb(id);
    });
  }

  onBack(cb) {
    this.btnBack.addEventListener('click', () => cb());
  }
}
