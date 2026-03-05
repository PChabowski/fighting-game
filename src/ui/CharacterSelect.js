export class CharacterSelect {
  constructor(mode = 'pvp') {
    this.mode = mode; // 'pvp' or 'arcade'
    this.el = document.createElement('div');
    this.el.className = 'who-win';

    const title = document.createElement('div');
    title.textContent = 'Character Select';
    this.el.appendChild(title);

    // Minimal hardcoded roster: Mack and Kenji
    this.roster = [
      { id: 'Mack', name: 'Mack', avatar: '../assets/images/Mack/avatar.png' },
      { id: 'Kenji', name: 'Kenji', avatar: '../assets/images/Kenji/avatar.png' },
    ];

    // selection state (null until chosen)
    this.selection = { player: null, enemy: null };
    this.activeSlot = 'player'; // 'player' or 'enemy' — avatars assign to this slot

    const container = document.createElement('div');
    container.className = 'character-select-single';

    // Left: selection preview and controls
    const preview = document.createElement('div');
    preview.className = 'char-preview';

    const p1box = document.createElement('div');
    p1box.className = 'select-box';
    p1box.textContent = 'Player 1: (none)';
    p1box.dataset.slot = 'player';
    preview.appendChild(p1box);

    const p2box = document.createElement('div');
    p2box.className = 'select-box';
    p2box.textContent = this.mode === 'arcade' ? 'Player 2: (CPU)' : 'Player 2: (none)';
    p2box.dataset.slot = 'enemy';
    preview.appendChild(p2box);

    container.appendChild(preview);

    // Right: roster (single set)
    const rosterWrap = document.createElement('div');
    rosterWrap.className = 'roster-wrap';
    this.roster.forEach((r) => {
      const btn = document.createElement('button');
      btn.className = 'avatar-btn';
      btn.dataset.id = r.id;
      // remove default button fill/border
      btn.style.background = 'transparent';
      btn.style.border = 'none';
      btn.style.padding = '0';
      btn.style.cursor = 'pointer';

      const img = document.createElement('img');
      img.src = r.avatar;
      img.alt = r.name;
      img.width = 64;
      img.height = 64;
      img.style.display = 'block';
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        // Assign to active slot
        this.selection[this.activeSlot] = r.id;
        // If PvP and just chose player, move focus to enemy for convenience
        if (this.mode === 'pvp' && this.activeSlot === 'player') {
          this.activeSlot = 'enemy';
        }
        // If PvP and activeSlot was enemy and player not chosen, move back
        if (this.mode === 'pvp' && this.activeSlot === 'enemy' && !this.selection.player) {
          this.activeSlot = 'player';
        }
        this._renderSelections();
        this._updateActive();
        this._updateStartState();
      });
      rosterWrap.appendChild(btn);
    });

    // keep a live array of roster buttons for keyboard selection
    this.rosterBtns = rosterWrap.querySelectorAll('.avatar-btn');

    container.appendChild(rosterWrap);
    this.el.appendChild(container);

    // action buttons
    const actions = document.createElement('div');
    actions.className = 'char-actions';

    this.backBtn = document.createElement('button');
    this.backBtn.className = 'button';
    this.backBtn.textContent = 'Back to Menu';
    actions.appendChild(this.backBtn);

    this.startBtn = document.createElement('button');
    this.startBtn.className = 'button';
    this.startBtn.textContent = 'Start Game';
    this.startBtn.disabled = true;
    actions.appendChild(this.startBtn);

    this.el.appendChild(actions);

    // callbacks
    this._onConfirm = null;
    this._onBack = null;

    // wire actions
    this.startBtn.addEventListener('click', () => {
      if (this.startBtn.disabled) return;
      let enemyChoice = this.selection.enemy;
      if (this.mode === 'arcade' && !enemyChoice) {
        const rand = this.roster[Math.floor(Math.random() * this.roster.length)];
        enemyChoice = rand.id;
      }
      const result = { player: this.selection.player, enemy: enemyChoice };
      try { if (this._onConfirm) this._onConfirm(result); } catch (e) {}
      this.remove();
    });

    this.backBtn.addEventListener('click', () => {
      try { if (this._onBack) this._onBack(); } catch (e) {}
      this.remove();
    });

    // Gamepad focusable list (order: player box, enemy box, roster..., start, back)
    this._buildFocusables();
    this._updateGpFocus();

    // Gamepad handlers
    this._onGpUp = (e) => this._moveGpFocus(-1, e && e.detail && e.detail.index);
    this._onGpDown = (e) => this._moveGpFocus(1, e && e.detail && e.detail.index);
    this._onGpLeft = (e) => this._moveGpFocus(-1, e && e.detail && e.detail.index);
    this._onGpRight = (e) => this._moveGpFocus(1, e && e.detail && e.detail.index);
    this._onGpConfirm = (e) => this._activateFocused(e && e.detail && e.detail.index);
    this._onGpBack = (e) => { this.backBtn.click(); };
    document.addEventListener('gp-up', this._onGpUp);
    document.addEventListener('gp-down', this._onGpDown);
    document.addEventListener('gp-left', this._onGpLeft);
    document.addEventListener('gp-right', this._onGpRight);
    document.addEventListener('gp-confirm', this._onGpConfirm);
    document.addEventListener('gp-back', this._onGpBack);

    // keyboard selection indices per player (p1 uses A/D + Space, p2 uses ArrowLeft/ArrowRight + ArrowDown)
    this.p1Index = 0;
    this.p2Index = 0;
    this._updateAvatarPointers = () => {
      const btns = Array.from(this.el.querySelectorAll('.avatar-btn'));
      btns.forEach((b, i) => {
        b.classList.remove('avatar-pointer-p1', 'avatar-pointer-p2');
        if (i === this.p1Index) b.classList.add('avatar-pointer-p1');
        if (i === this.p2Index) b.classList.add('avatar-pointer-p2');
      });
    };

    this._onKeyDown = (e) => {
      // player 1 controls
      if (e.key === 'a') {
        this.p1Index = (this.p1Index - 1 + this.roster.length) % this.roster.length;
        this._updateAvatarPointers();
        e.preventDefault();
        return;
      }
      if (e.key === 'd') {
        this.p1Index = (this.p1Index + 1) % this.roster.length;
        this._updateAvatarPointers();
        e.preventDefault();
        return;
      }
      if (e.key === ' ') {
        // confirm player1 selection
        const id = (this.el.querySelectorAll('.avatar-btn')[this.p1Index] || {}).dataset;
        if (id && id.id) {
          this.selection.player = id.id;
          this._renderSelections();
          this._updateStartState();
        }
        e.preventDefault();
        return;
      }

      // player 2 controls
      if (e.key === 'ArrowLeft') {
        this.p2Index = (this.p2Index - 1 + this.roster.length) % this.roster.length;
        this._updateAvatarPointers();
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowRight') {
        this.p2Index = (this.p2Index + 1) % this.roster.length;
        this._updateAvatarPointers();
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowDown') {
        // confirm player2 selection (ignore in arcade)
        if (this.mode !== 'arcade') {
          const id = (this.el.querySelectorAll('.avatar-btn')[this.p2Index] || {}).dataset;
          if (id && id.id) {
            this.selection.enemy = id.id;
            this._renderSelections();
            this._updateStartState();
          }
        }
        e.preventDefault();
        return;
      }
    };

    document.addEventListener('keydown', this._onKeyDown);

    this._renderSelections();
    this._updateActive();
    this._updateStartState();
  }

  _buildFocusables() {
    const rosterBtns = Array.from(this.el.querySelectorAll('.avatar-btn'));
    // order: roster..., start, back (player labels are informational only)
    this.focusables = [...rosterBtns, this.startBtn, this.backBtn];
    this.focusIndex = 0;
  }

  _moveGpFocus(delta /*, padIndex - future use */) {
    if (!this.focusables || !this.focusables.length) return;
    const len = this.focusables.length;
    this.focusIndex = (this.focusIndex + delta + len) % len;
    this._updateGpFocus();
  }

  _updateGpFocus() {
    if (!this.focusables) return;
    this.focusables.forEach((el, i) => {
      if (!el) return;
      if (i === this.focusIndex) {
        el.classList.add('gp-focused');
        if (el.classList && el.classList.contains('avatar-btn')) el.classList.add('avatar-gp-focused');
      } else {
        el.classList.remove('gp-focused');
        if (el.classList && el.classList.contains('avatar-btn')) el.classList.remove('avatar-gp-focused');
      }
    });
    // Keep visual active slot in sync if focus is on player/enemy boxes
    const focused = this.focusables[this.focusIndex];
    if (focused && focused.dataset && focused.dataset.slot) {
      this.activeSlot = focused.dataset.slot;
      this._updateActive();
    }
  }

  _activateFocused(padIndex) {
    const el = this.focusables && this.focusables[this.focusIndex];
    if (!el) return;
    // If it's a select-box -> set active slot
    if (el.dataset && el.dataset.slot) {
      this.activeSlot = el.dataset.slot;
      this._updateActive();
      return;
    }
    // If avatar button -> assign to pad's player slot when padIndex provided
    if (el.classList && el.classList.contains('avatar-btn')) {
      const id = el.dataset && el.dataset.id;
      if (typeof padIndex === 'number') {
        // pad 0 -> player, pad 1 -> enemy
        const slot = padIndex === 0 ? 'player' : 'enemy';
        if (this.mode === 'arcade' && slot === 'enemy') return; // ignore enemy selection in arcade
        this.selection[slot] = id;
        // convenience: if PvP and player just chosen, move activeSlot to enemy
        if (this.mode === 'pvp' && slot === 'player') this.activeSlot = 'enemy';
        if (this.mode === 'pvp' && slot === 'enemy' && !this.selection.player) this.activeSlot = 'player';
        this._renderSelections();
        this._updateActive();
        this._updateStartState();
        return;
      }
      // fallback: click (uses current activeSlot)
      try { el.click(); } catch (e) {}
      return;
    }
    // If start/back -> click
    if (el === this.startBtn || el === this.backBtn) {
      try { el.click(); } catch (e) {}
    }
  }

  _renderSelections() {
    const btns = Array.from(this.el.querySelectorAll('.avatar-btn'));
    btns.forEach((btn) => {
      const id = btn.dataset.id;
      btn.classList.remove('avatar-selected-player1', 'avatar-selected-player2', 'avatar-selected-both');
      if (this.selection.player && this.selection.enemy && this.selection.player === this.selection.enemy && id === this.selection.player) {
        btn.classList.add('avatar-selected-both');
      } else {
        if (this.selection.player && id === this.selection.player) btn.classList.add('avatar-selected-player1');
        if (this.selection.enemy && id === this.selection.enemy) btn.classList.add('avatar-selected-player2');
      }
    });
    // update preview text
    const p1box = this.el.querySelector('.select-box[data-slot="player"]');
    const p2box = this.el.querySelector('.select-box[data-slot="enemy"]');
    if (p1box) p1box.textContent = `Player 1: ${this.selection.player || '(none)'}`;
    if (p2box) p2box.textContent = `Player 2: ${this.selection.enemy || (this.mode === 'arcade' ? '(CPU)' : '(none)')}`;
  }

  _updateActive() {
    const boxes = this.el.querySelectorAll('.select-box');
    boxes.forEach((b) => {
      // selection boxes are informational only — no outlines
      b.style.outline = 'none';
    });
  }

  _updateStartState() {
    // Start is enabled in PvP only when both selected; in Arcade when player selected
    if (this.mode === 'arcade') {
      this.startBtn.disabled = !this.selection.player;
    } else {
      this.startBtn.disabled = !(this.selection.player && this.selection.enemy);
    }
  }

  show(parent = document.body) {
    if (!this.el.parentElement) parent.appendChild(this.el);
    this.el.style.display = 'flex';
  }

  onConfirm(cb) {
    if (typeof cb !== 'function') return;
    this._onConfirm = cb;
  }

  onBack(cb) {
    if (typeof cb !== 'function') return;
    this._onBack = cb;
  }

  remove() {
    if (this.el && this.el.parentElement) this.el.parentElement.removeChild(this.el);
    // remove gp listeners
    try {
      document.removeEventListener('gp-up', this._onGpUp);
      document.removeEventListener('gp-down', this._onGpDown);
      document.removeEventListener('gp-left', this._onGpLeft);
      document.removeEventListener('gp-right', this._onGpRight);
      document.removeEventListener('gp-confirm', this._onGpConfirm);
      document.removeEventListener('gp-back', this._onGpBack);
    } catch (e) {}
    try { document.removeEventListener('keydown', this._onKeyDown); } catch (e) {}
  }
}
