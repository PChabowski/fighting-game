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
        this.peer = new Peer();

        this.peer.on('open', (id) => {
            this.peerId = id;
            if (this.onOpenCallback) this.onOpenCallback(id);
        });

        this.peer.on('connection', (conn) => {
            this.connection = conn;
            this._setupConnection();
            if (this.onConnectionCallback) this.onConnectionCallback(conn);
        });

        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
        });
    }

    connectToHost(id) {
        this.isHost = false;
        this.peer = new Peer();

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
