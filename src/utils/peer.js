export class PeerManager {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.peerId = null;
        this.onDataCallback = null;
        this.onOpenCallback = null;
        this.onConnectionCallback = null;
        this.isHost = false;
    }

    initHost() {
        this.isHost = true;
        this.peer = new Peer({
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (id) => {
            this.peerId = id;
            if (this.onOpenCallback) this.onOpenCallback(id);
        });

        this.peer.on('connection', (conn) => {
            this.connection = conn;
            this._setupConnection();
        });

        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
        });
    }

    connectToHost(id) {
        this.isHost = false;
        this.peer = new Peer({
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', () => {
            this.connection = this.peer.connect(id);
            this._setupConnection();
        });

        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
        });
    }

    _setupConnection() {
        this.connection.on('open', () => {
            if (this.onConnectionCallback) this.onConnectionCallback(this.connection);
        });

        this.connection.on('data', (data) => {
            if (this.onDataCallback) this.onDataCallback(data);
        });

        this.connection.on('close', () => {
            console.log('Connection closed');
        });
    }

    disconnect() {
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.peerId = null;
        this.isHost = false;
        
        // wyczyszczenie callbacków aby nie dublować przycisków
        this.onDataCallback = null;
        this.onOpenCallback = null;
        this.onConnectionCallback = null;
    }

    send(data) {
        if (this.connection && this.connection.open) {
            this.connection.send(data);
        }
    }

    onData(cb) {
        this.onDataCallback = cb;
    }

    onOpen(cb) {
        this.onOpenCallback = cb;
    }

    onConnection(cb) {
        this.onConnectionCallback = cb;
    }
}

export const peerManager = new PeerManager();
