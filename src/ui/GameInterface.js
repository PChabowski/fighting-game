import { HealthBar } from './HealthBar.js';
import { Timer } from './Timer.js';
import { WinModal } from './WinModal.js';

export class GameInterface {
  constructor(selector = '.interface') {
    this.container = document.querySelector(selector);
    if (!this.container) throw new Error('Interface container not found: ' + selector);
    this._build();
  }

  _build() {
    // Clear existing interface contents and create structured UI elements
    this.container.innerHTML = '';

    const leftHealthWrap = document.createElement('div');
    leftHealthWrap.className = 'health-bar';
    const playerFill = document.createElement('div');
    playerFill.id = 'playerHealth';
    playerFill.className = 'player';
    leftHealthWrap.appendChild(playerFill);

    const timerWrap = document.createElement('div');
    timerWrap.className = 'timer';
    const timerEl = document.createElement('div');
    timerEl.id = 'timer';
    timerEl.textContent = '60';
    timerWrap.appendChild(timerEl);

    const rightHealthWrap = document.createElement('div');
    rightHealthWrap.className = 'health-bar';
    const enemyFill = document.createElement('div');
    enemyFill.id = 'enemyHealth';
    enemyFill.className = 'enemy';
    rightHealthWrap.appendChild(enemyFill);

    // Append in order: player, timer, enemy
    this.container.appendChild(leftHealthWrap);
    this.container.appendChild(timerWrap);
    this.container.appendChild(rightHealthWrap);

    // Instantiate UI components that operate on these elements
    this.playerUI = new HealthBar('playerHealth');
    this.enemyUI = new HealthBar('enemyHealth');
    this.timer = new Timer('#timer');

    // Create win modal (it will append itself when shown)
    this.winModal = new WinModal();
  }

  reset() {
    try {
      this.playerUI.set(100);
      this.enemyUI.set(100);
      this.timer.set(60);
    } catch (e) {
      // ignore
    }
  }
}
