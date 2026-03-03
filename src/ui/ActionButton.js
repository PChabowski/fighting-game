export class ActionButton {
  constructor({ id, text = '', className = '' } = {}) {
    if (!id) throw new Error('id required');
    this.id = id;
    this.el = document.createElement('button');
    this.el.id = id;
    this.el.className = `mobile-btn ${className || ''}`.trim();
    this.el.textContent = text;
  }


  on(event, fn) {
    this.el.addEventListener(event, fn);
  }

  bindTouch(pressFn, releaseFn) {
    const press = (e) => { e && e.preventDefault(); this.el.classList.add('active'); if (typeof pressFn === 'function') pressFn(e); };
    const release = (e) => { e && e.preventDefault(); this.el.classList.remove('active'); if (typeof releaseFn === 'function') releaseFn(e); };
    this.el.addEventListener('touchstart', press, { passive: false });
    this.el.addEventListener('mousedown', press);
    this.el.addEventListener('touchend', release);
    this.el.addEventListener('mouseup', release);
    this.el.addEventListener('mouseleave', release);
  }
}
