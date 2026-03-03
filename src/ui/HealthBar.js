export class HealthBar {
  constructor(elementId, options = {}) {
    if (!elementId) throw new Error('elementId required');
    this.el = document.getElementById(elementId) || document.querySelector(elementId);
    if (!this.el) throw new Error('HealthBar element not found: ' + elementId);
    // Keep color handling simple: health bar uses single color via inline style
    this.backgroundEl = this.el.parentElement;
  }

  set(percentage) {
    const p = Math.max(0, Math.min(100, Number(percentage) || 0));
    this.el.style.width = p + '%';
    this._updateColor(p);
  }

  update(percentage, animate = false) {
    if (animate && window.gsap) {
      window.gsap.to(this.el, { width: Math.max(0, Math.min(100, percentage)) + '%' });
      this._updateColor(percentage);
    } else {
      this.set(percentage);
    }
  }

  _updateColor(p) {
    // original behavior: single color (green) regardless of percentage
    this.el.style.backgroundColor = '#39b54a';
  }
}
