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
<<<<<<< HEAD
                    { urls: 'stun:stun1.l.google.com:19302' }
=======
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
>>>>>>> fix/multiplayer
                ]
            }
        });

        this.peer.on('open', (id) => {
            console.log('Host Peer opened with ID:', id);
            this.peerId = id;
            if (this.onOpenCallback) this.onOpenCallback(id);
        });

        this.peer.on('connection', (conn) => {
            console.log('Host received connection incoming!');
            this.connection = conn;
            this._setupConnection();
<<<<<<< HEAD
=======
            // DO NOT call onConnectionCallback(conn) here. Must wait for connection.on('open')
>>>>>>> fix/multiplayer
        });

        this.peer.on('error', (err) => {
            console.error('Peer error on Host:', err);
        });
    }

    connectToHost(id) {
        console.log('Client attempting to connect to host with ID:', id);
        this.isHost = false;
        this.peer = new Peer({
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
<<<<<<< HEAD
                    { urls: 'stun:stun1.l.google.com:19302' }
=======
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
>>>>>>> fix/multiplayer
                ]
            }
        });

        this.peer.on('open', () => {
            console.log('Client Peer opened, initiating data connection to Host.');
            this.connection = this.peer.connect(id, { reliable: true });
            this._setupConnection();
        });

        this.peer.on('error', (err) => {
            console.error('Peer error on Client:', err);
        });
    }

    _setupConnection() {
        console.log('Setting up DataConnection events. Current open state:', this.connection.open);
        
        const openHandler = () => {
            console.log('DataConnection opened successfully!');
            if (this.onConnectionCallback) this.onConnectionCallback(this.connection);
        };

        if (this.connection.open) {
            openHandler();
        } else {
            this.connection.on('open', openHandler);
        }

        this.connection.on('data', (data) => {
            console.log('Received data:', data);
            if (this.onDataCallback) this.onDataCallback(data);
        });

        this.connection.on('close', () => {
            console.log('Connection closed');
        });
        
        this.connection.on('error', (err) => {
            console.error('Connection error:', err);
        });
    }

    disconnect() {
        console.log('Disconnecting Peer and DataConnection...');
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
        
        this.onDataCallback = null;
        this.onOpenCallback = null;
        this.onConnectionCallback = null;
    }

    send(data) {
        if (this.connection && this.connection.open) {
            this.connection.send(data);
        } else {
            console.error('Cannot send data; connection is not open.', data);
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
