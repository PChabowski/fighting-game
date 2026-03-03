export class Timer {
  constructor(elementId) {
    if (!elementId) throw new Error('elementId required');
    this.el = document.getElementById(elementId) || document.querySelector(elementId);
    if (!this.el) throw new Error('Timer element not found: ' + elementId);
  }

  set(value) {
    this.el.textContent = String(value);
  }
}
