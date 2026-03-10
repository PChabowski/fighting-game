import Peer from 'peerjs';

export function monitorWebRTCConnection(conn) {
    if (!conn.peerConnection) {
        setTimeout(() => monitorWebRTCConnection(conn), 100);
        return;
    }

    const pc = conn.peerConnection;

    pc.addEventListener('iceconnectionstatechange', () => {
        console.log(`[WebRTC] ICE Connection State: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'failed') {
            console.error("[WebRTC Error] ICE connection failed. The NAT is too strict and the TURN server failed to provide a valid relay.");
        }
    });

    pc.addEventListener('icegatheringstatechange', () => {
        console.log(`[WebRTC] ICE Gathering State: ${pc.iceGatheringState}`);
    });

    pc.addEventListener('signalingstatechange', () => {
        console.log(`[WebRTC] Signaling State: ${pc.signalingState}`);
    });

    pc.addEventListener('connectionstatechange', () => {
        console.log(`[WebRTC] Overall Connection State: ${pc.connectionState}`);
    });

    pc.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            console.log(`[WebRTC Candidate] Type: ${event.candidate.type} | Protocol: ${event.candidate.protocol} | Address: ${event.candidate.address}`);
            if (event.candidate.type === 'relay') {
                console.log("🟢 [TURN SUCCESS] Derived a 'relay' candidate! The TURN server is responding.");
            }
        }
    });
}

export class PeerManager {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.peerId = null;
        this.onDataCallback = null;
        this.onOpenCallback = null;
        this.onConnectionCallback = null;
        this.onCloseCallback = null;
        this.isHost = false;
    }

    initHost() {
        if (this.peer) return; // Prevent double initialization in React StrictMode
        this.isHost = true;
        this.peer = new Peer({
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { 
                        urls: [
                            "turn:openrelay.metered.ca:80",
                            "turn:openrelay.metered.ca:443",
                            "turn:openrelay.metered.ca:443?transport=tcp"
                        ],
                        username: "openrelayproject",
                        credential: "openrelayproject"
                    }
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
            monitorWebRTCConnection(conn);
            
            this.connection.on('open', () => {
                console.log('Host-side DataConnection strictly opened!');
                this._setupConnectionForData();
                if (this.onConnectionCallback) this.onConnectionCallback(this.connection);
            });
            
            this.connection.on('error', (err) => {
               console.error('Host connection error:', err);
            });
        });
    }

    connectToHost(id) {
        if (this.peer) return; // Prevent double initialization
        console.log('Client attempting to connect to host with ID:', id);
        this.isHost = false;
        this.peer = new Peer({
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { 
                        urls: [
                            "turn:openrelay.metered.ca:80",
                            "turn:openrelay.metered.ca:443",
                            "turn:openrelay.metered.ca:443?transport=tcp"
                        ],
                        username: "openrelayproject",
                        credential: "openrelayproject"
                    }
                ]
            }
        });

        this.peer.on('open', () => {
            console.log('Client Peer opened, initiating data connection to Host.');
            this.connection = this.peer.connect(id, { reliable: true });
            
            monitorWebRTCConnection(this.connection);

            this.connection.on('open', () => {
                console.log('Client-side DataConnection strictly opened!');
                this._setupConnectionForData();
                if (this.onConnectionCallback) this.onConnectionCallback(this.connection);
            });

            this.connection.on('error', (err) => {
               console.error('Client connection error:', err);
            });
        });
    }

    _setupConnectionForData() {
        this.connection.on('data', (data) => {
            if (this.onDataCallback) this.onDataCallback(data);
        });

        this.connection.on('close', () => {
            console.log('Connection closed');
            if (this.onCloseCallback) this.onCloseCallback();
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
        
        this.onDataCallback = null;
        this.onOpenCallback = null;
        this.onConnectionCallback = null;
        this.onCloseCallback = null;
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

    onClose(cb) {
        this.onCloseCallback = cb;
    }

    onConnection(cb) {
        this.onConnectionCallback = cb;
    }
}

export const peerManager = new PeerManager();
