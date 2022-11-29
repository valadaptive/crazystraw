import {WebSocketServer, WebSocket} from 'ws';
import dotenv from 'dotenv';
import {randomBytes, subtle} from 'crypto';
import {setTimeout, clearTimeout} from 'timers';
import EventEmitter from 'events';

import {
    GatewayMessage,
    GatewayMessageType,
    GatewayCloseCode,
    Unsequenced
} from 'crazystraw-common/ws-types';

dotenv.config();

function orError<T> (value: T | undefined, message: string): T {
    if (typeof value === 'undefined') throw new Error(message);
    return value;
}

function expectNumber (value: string | undefined): number | undefined {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue))  return parsedValue;
    return undefined;
}

const config = {
    port: orError(expectNumber(process.env.PORT), 'Expected port number')
};

const CHALLENGE_TIMEOUT = 5 * 1000;

/**
 * Wraps a WebSocket with gateway-specific message sending.
 */
class WrappedSocket extends EventEmitter {
    private seq: number;
    public socket: WebSocket;

    constructor (ws: WebSocket) {
        super();
        this.socket = ws;
        this.seq = 1;

        ws.addEventListener('message', evt => {
            // TODO: terminate connection if unparseable
            try {
                if (typeof evt.data !== 'string') return;
                const parsedData = JSON.parse(evt.data) as GatewayMessage;
                this.emit('message', parsedData);
            } catch (err) {
                // swallow errors
            }
        });
    }

    send (message: Unsequenced<GatewayMessage>): Promise<number> {
        const messageSeq = this.seq;
        (message as GatewayMessage).seq = messageSeq;
        this.seq += 2;
        return new Promise((resolve, reject) => {
            this.socket.send(JSON.stringify(message), err => {
                err ? reject(err) : resolve(messageSeq);
            });
        });
    }

    /**
     * Used to handle any errors (e.g. "this socket closed") that may arise in timeouts. If a promise is rejected from
     * inside a timeout handler, it brings down the entire process. Thanks, Node!
     */
    sendAndForget (message: Unsequenced<GatewayMessage>): void {
        void this.send(message).catch(() => Promise.resolve());
    }
}

type ChallengeState = {
    publicKey: CryptoKey,
    identity: string,
    challenge: Buffer,
    for: number,
    timeout: NodeJS.Timeout
};

type AuthenticatedConnectionData = {
    publicKey: CryptoKey,
    identity: string
};

class Gateway {
    /** Stores connections that are currently in the challenge/response state */
    private waitingChallenges: WeakMap<WrappedSocket, ChallengeState>;

    /** Stores connections that are authenticated, and their public keys */
    private authenticatedConnections: WeakMap<WrappedSocket, AuthenticatedConnectionData>;

    /** Stores connections by their public keys */
    private connectionsByIdentity: Map<string, WrappedSocket>;

    constructor (port: number) {
        this.waitingChallenges = new WeakMap();
        this.authenticatedConnections = new WeakMap();
        this.connectionsByIdentity = new Map();

        const server = new WebSocketServer({port});

        server.on('connection', ws => {
            const wrappedSocket = new WrappedSocket(ws);
            wrappedSocket.on('message', message => {
                try {
                    void this.respondToMessage(message as GatewayMessage, wrappedSocket);
                } catch (err) {
                    console.warn('Error in responding to message:', err);
                    ws.close(1002);
                }
            });
            console.log('Connection!');
        });
    }

    async respondToMessage (
        message: GatewayMessage,
        ws: WrappedSocket
    ): Promise<void> {
        switch (message.type) {
            // The client just connected and is identifying itself.
            case GatewayMessageType.IDENTIFY: {
                if (this.waitingChallenges.has(ws) || this.authenticatedConnections.has(ws)) {
                    ws.socket.close(GatewayCloseCode.INVALID_STATE, 'Already authenticated');
                    return;
                }

                if (this.connectionsByIdentity.has(message.identity)) {
                    ws.socket.close(GatewayCloseCode.EXISTING_SESSION, 'Another session is already active');
                    return;
                }

                const publicKeyBuffer = Buffer.from(message.publicKey, 'base64');
                // Decode public key from message
                let publicKey;
                try {
                    publicKey = await subtle.importKey(
                        'raw',
                        publicKeyBuffer,
                        {name: 'ECDSA', namedCurve: 'P-256'},
                        true,
                        ['verify']
                    );
                } catch (err) {
                    ws.socket.close(GatewayCloseCode.INVALID_FORMAT, 'Invalid public key format');
                    return;
                }

                const fingerprint = Buffer.from(await subtle.digest('SHA-256', publicKeyBuffer), 0, 16);
                const givenFingerprint = Buffer.from(message.identity, 'base64');
                if (!fingerprint.equals(givenFingerprint)) {
                    ws.socket.close(GatewayCloseCode.CHALLENGE_FAILED, 'Public key does not match fingerprint');
                }


                // Issue a challenge to the client to make sure they actually own the corresponding private key
                const challenge = randomBytes(16);

                // Store challenge info for when the client sends a response
                const challengeSeq = await ws.send({
                    type: GatewayMessageType.CHALLENGE,
                    for: message.seq,
                    challenge: challenge.toString('base64')
                });

                this.waitingChallenges.set(ws, {
                    publicKey,
                    identity: message.identity,
                    challenge,
                    for: challengeSeq,
                    timeout: setTimeout(() => {
                        this.waitingChallenges.delete(ws);
                        ws.socket.close(GatewayCloseCode.CHALLENGE_TIMEOUT, 'Challenge timed out');
                    }, CHALLENGE_TIMEOUT)
                });
                return;
            }

            // The client is responding to a challenge we sent them by signing it with their private key
            case GatewayMessageType.CHALLENGE_RESPONSE: {
                const waitingChallenge = this.waitingChallenges.get(ws);
                if (!waitingChallenge) {
                    ws.socket.close(GatewayCloseCode.INVALID_STATE, 'Challenge does not exist');
                    return;
                }

                clearTimeout(waitingChallenge.timeout);

                if (waitingChallenge.for !== message.for) {
                    ws.socket.close(GatewayCloseCode.INVALID_STATE, 'Incorrect challenge response sequence number');
                    return;
                }

                const responseSignature = Buffer.from(message.response, 'base64');

                try {
                    // Verify the signature using the client's public key they gave us
                    const isValid = await subtle.verify(
                        {name: 'ECDSA', hash: 'SHA-256'},
                        waitingChallenge.publicKey,
                        responseSignature,
                        waitingChallenge.challenge
                    );

                    if (isValid) {
                        this.authenticatedConnections.set(ws, {
                            publicKey: waitingChallenge.publicKey,
                            identity: waitingChallenge.identity
                        });
                        this.connectionsByIdentity.set(waitingChallenge.identity, ws);
                        ws.socket.once('close', () => {
                            this.authenticatedConnections.delete(ws);
                            this.connectionsByIdentity.delete(waitingChallenge.identity);
                        });

                        await ws.send({
                            type: GatewayMessageType.CHALLENGE_SUCCESS,
                            for: waitingChallenge.for
                        });
                    } else {
                        ws.socket.close(GatewayCloseCode.CHALLENGE_FAILED, 'Challenge failed');
                    }
                    return;
                } catch (err) {
                    ws.socket.close(GatewayCloseCode.INVALID_FORMAT, 'Invalid signature format');
                }
                this.waitingChallenges.delete(ws);

                break;
            }

            // The client is requesting a peer
            case GatewayMessageType.PEER_REQUEST: {
                const auth = this.authenticatedConnections.get(ws);
                if (!auth) {
                    ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                    return;
                }

                const peerConnection = this.connectionsByIdentity.get(message.peerIdentity);
                if (!peerConnection) {
                    await ws.send({
                        type: GatewayMessageType.PEER_OFFLINE,
                        for: message.seq,
                        connectionID: message.connectionID
                    });
                    return;
                }

                await peerConnection.send({
                    type: GatewayMessageType.GOT_PEER_REQUEST,
                    peerIdentity: auth.identity,
                    connectionID: message.connectionID
                });

                break;
            }

            // The client is cancelling a peer request
            case GatewayMessageType.PEER_REQUEST_CANCEL: {
                const auth = this.authenticatedConnections.get(ws);
                if (!auth) {
                    ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                    return;
                }

                const peerConnection = this.connectionsByIdentity.get(message.peerIdentity);
                // Don't send "peer offline"; treat this as "fire and forget"
                if (!peerConnection) return;

                await peerConnection.send({
                    type: GatewayMessageType.GOT_PEER_REQUEST_CANCELLED,
                    connectionID: message.connectionID
                });

                break;
            }

            // The client is sending a peer a WebRTC message
            case GatewayMessageType.PEER_MESSAGE_DESCRIPTION: {
                const auth = this.authenticatedConnections.get(ws);
                if (!auth) {
                    ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                    return;
                }

                const peerConnection = this.connectionsByIdentity.get(message.peerIdentity);
                if (!peerConnection) {
                    await ws.send({
                        type: GatewayMessageType.PEER_OFFLINE,
                        for: message.seq,
                        connectionID: message.connectionID
                    });
                    return;
                }

                await peerConnection.send({
                    type: GatewayMessageType.GOT_PEER_MESSAGE_DESCRIPTION,
                    description: message.description,
                    connectionID: message.connectionID
                });

                break;
            }

            // The client is giving a peer an ICE candidate
            case GatewayMessageType.PEER_ICE_CANDIDATE: {
                const auth = this.authenticatedConnections.get(ws);
                if (!auth) {
                    ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                    return;
                }

                const peerConnection = this.connectionsByIdentity.get(message.peerIdentity);
                if (!peerConnection) {
                    await ws.send({
                        type: GatewayMessageType.PEER_OFFLINE,
                        for: message.seq,
                        connectionID: message.connectionID
                    });
                    return;
                }

                await peerConnection.send({
                    type: GatewayMessageType.GOT_PEER_ICE_CANDIDATE,
                    candidate: message.candidate,
                    connectionID: message.connectionID
                });

                break;
            }

            // The client is accepting a peer request
            case GatewayMessageType.PEER_ACCEPT: {
                const auth = this.authenticatedConnections.get(ws);
                if (!auth) {
                    ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                    return;
                }

                const connection = this.connectionsByIdentity.get(message.peerIdentity);
                // Client disconnected
                if (!connection) return;

                await connection.send({
                    type: GatewayMessageType.PEER_REQUEST_ACCEPTED,
                    for: message.seq,
                    connectionID: message.connectionID
                });

                break;
            }

            // The client is rejecting a peer request
            case GatewayMessageType.PEER_REJECT: {
                const auth = this.authenticatedConnections.get(ws);
                if (!auth) {
                    ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                    return;
                }

                const connection = this.connectionsByIdentity.get(message.peerIdentity);
                // Client disconnected
                if (!connection) return;

                await connection.send({
                    type: GatewayMessageType.PEER_REQUEST_REJECTED,
                    for: message.seq,
                    connectionID: message.connectionID
                });

                break;
            }
            default: {
                throw new Error('Unknown message type');
            }
        }
    }
}

new Gateway(config.port);

console.log(`Server running on port ${config.port}...`);
