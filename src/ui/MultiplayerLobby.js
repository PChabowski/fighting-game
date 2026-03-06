export class MultiplayerLobby {
  constructor(isHost, peerId = null) {
    this.isHost = isHost;
    this.peerId = peerId;
    this.el = document.createElement('div');
    this.el.className = 'who-win';
    this.el.style.flexDirection = 'column';

    const title = document.createElement('div');
    title.textContent = 'Multiplayer Lobby';
    title.style.fontSize = '24px';
    title.style.marginBottom = '10px';
    this.el.appendChild(title);

    this.statusDisplay = document.createElement('div');
    this.statusDisplay.textContent = this.isHost ? 'Waiting for opponent...' : 'Connecting to host...';
    this.statusDisplay.style.marginBottom = '20px';
    this.el.appendChild(this.statusDisplay);

    this.idContainer = document.createElement('div');
    this.idContainer.style.marginBottom = '20px';
    this.el.appendChild(this.idContainer);
    this._renderPeerId();

    this.roster = [
      { id: 'Mack', name: 'Mack', avatar: '../assets/images/Mack/avatar.png' },
      { id: 'Kenji', name: 'Kenji', avatar: '../assets/images/Kenji/avatar.png' },
    ];

    this.selection = { local: null, remote: null };
    
    const container = document.createElement('div');
    container.className = 'character-select-single';

    const preview = document.createElement('div');
    preview.className = 'char-preview';

    this.localBox = document.createElement('div');
    this.localBox.className = 'select-box';
    this.localBox.textContent = 'You: (None)';
    preview.appendChild(this.localBox);

    this.remoteBox = document.createElement('div');
    this.remoteBox.className = 'select-box';
    this.remoteBox.textContent = 'Opponent: (None)';
    preview.appendChild(this.remoteBox);

    container.appendChild(preview);

    const rosterWrap = document.createElement('div');
    rosterWrap.className = 'roster-wrap';
    this.roster.forEach((r) => {
      const btn = document.createElement('button');
      btn.className = 'avatar-btn';
      btn.dataset.id = r.id;
      
      const img = document.createElement('img');
      img.src = r.avatar;
      img.width = 64;
      btn.appendChild(img);
      
      btn.addEventListener('click', () => {
        this.selection.local = r.id;
        this._renderSelections();
        if (this.onSelectCallback) this.onSelectCallback(r.id);
        this._checkStartReady();
      });
      rosterWrap.appendChild(btn);
    });

    container.appendChild(rosterWrap);
    this.el.appendChild(container);

    const actions = document.createElement('div');
    actions.className = 'char-actions';

    this.startBtn = document.createElement('button');
    this.startBtn.className = 'button';
    this.startBtn.textContent = 'Start Game';
    this.startBtn.disabled = true;
    if (!this.isHost) this.startBtn.style.display = 'none';
    actions.appendChild(this.startBtn);

    this.backBtn = document.createElement('button');
    this.backBtn.className = 'button';
    this.backBtn.textContent = 'Leave Lobby';
    actions.appendChild(this.backBtn);

    this.el.appendChild(actions);

    this.onStartCallback = null;
    this.onSelectCallback = null;
    this.onLeaveCallback = null;

    this.startBtn.addEventListener('click', () => {
        if (this.onStartCallback) this.onStartCallback();
    });

    this.backBtn.addEventListener('click', () => {
        if (this.onLeaveCallback) {
            this.onLeaveCallback();
        } else {
            location.reload();
        }
    });
  }

  _renderPeerId() {
    this.idContainer.innerHTML = '';
    if (this.isHost && this.peerId) {
      const idDisplay = document.createElement('div');
      idDisplay.textContent = `Your ID: ${this.peerId}`;
      idDisplay.style.fontSize = '14px';
      idDisplay.style.color = '#fff';
      idDisplay.style.backgroundColor = 'rgba(0,0,0,0.5)';
      idDisplay.style.padding = '10px';
      idDisplay.style.border = '2px solid white';
      idDisplay.style.cursor = 'pointer';
      idDisplay.title = 'Click to copy';
      idDisplay.onclick = () => {
          navigator.clipboard.writeText(this.peerId);
          const oldText = idDisplay.textContent;
          idDisplay.textContent = 'ID Copied!';
          setTimeout(() => idDisplay.textContent = oldText, 2000);
      };
      this.idContainer.appendChild(idDisplay);
    }
  }

  setPeerId(id) {
    this.peerId = id;
    this._renderPeerId();
  }

  setConnected(connected) {
      this.statusDisplay.textContent = connected ? 'Opponent connected!' : (this.isHost ? 'Waiting for opponent...' : 'Connection lost.');
      this.statusDisplay.style.color = connected ? '#0f0' : '#f00';
  }

  setRemoteSelection(characterId) {
      this.selection.remote = characterId;
      this._renderSelections();
      this._checkStartReady();
  }

  _renderSelections() {
      this.localBox.textContent = `You: ${this.selection.local || '(None)'}`;
      this.remoteBox.textContent = `Opponent: ${this.selection.remote || '(None)'}`;
  }

  _checkStartReady() {
      if (this.isHost) {
          this.startBtn.disabled = !(this.selection.local && this.selection.remote);
      }
  }

  show(parent = document.body) {
    this.el.style.display = 'flex';
    parent.appendChild(this.el);
  }

  hide() {
    if (this.el.parentElement) this.el.parentElement.removeChild(this.el);
  }

  onSelect(cb) { this.onSelectCallback = cb; }
  onStart(cb) { this.onStartCallback = cb; }
  onLeave(cb) { this.onLeaveCallback = cb; }
}
