import {WebSocketServer, WebSocket} from 'ws';
import dotenv from 'dotenv';
import {randomBytes, subtle} from 'crypto';
import {setTimeout, clearTimeout} from 'timers';
import EventEmitter from 'events';

import {
    GatewayMessage,
    GatewayMessageType,
    GatewayCloseCode
} from 'crazystraw-common/ws-types';

import MultiKeyMap from './util/multi-key-map.js';

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
const REQUEST_PEER_TIMEOUT = 60 * 1000;

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

    send (message: Omit<GatewayMessage, 'seq'>): Promise<number> {
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
    sendAndForget (message: Omit<GatewayMessage, 'seq'>): void {
        void this.send(message).catch(() => Promise.resolve());
    }
}

type ChallengeState = {
    publicKey: CryptoKey,
    publicKeyString: string,
    challenge: Buffer,
    for: number,
    timeout: NodeJS.Timeout
};

type AuthenticatedConnectionData = {
    publicKey: CryptoKey,
    publicKeyString: string
};

class PeerRequest extends EventEmitter {
    for: number;
    offer: {
        type: 'offer',
        sdp: string
    };
    timeout: number;
    private timeoutTimer: NodeJS.Timeout;
    gotPeerRequestMessages: {
        socket: WrappedSocket
        origSeq: number
    }[];

    constructor (forSeq: number, offer: PeerRequest['offer'], timeout: number) {
        super();
        this.for = forSeq;
        this.offer = offer;
        this.timeout = timeout;
        console.log(timeout, Date.now());
        this.timeoutTimer = setTimeout(() => {
            this.emit('timeout');
            for (const {socket, origSeq} of this.gotPeerRequestMessages) {
                const timeoutMessage = {
                    type: GatewayMessageType.GOT_PEER_REQUEST_TIMED_OUT,
                    for: origSeq
                };
                socket.sendAndForget(timeoutMessage);
            }
        }, timeout - Date.now());
        this.gotPeerRequestMessages = [];
    }

    clearTimeout (): void {
        clearTimeout(this.timeoutTimer);
    }

    async cancel (): Promise<void> {
        this.clearTimeout();
        const promises = [];
        for (const {socket, origSeq} of this.gotPeerRequestMessages) {
            const timeoutMessage = {
                type: GatewayMessageType.GOT_PEER_REQUEST_CANCELLED,
                for: origSeq
            };
            promises.push(socket.send(timeoutMessage));
        }
        await Promise.all(promises);
    }
}

class Gateway {
    /** Stores connections that are currently in the challenge/response state */
    private waitingChallenges: WeakMap<WrappedSocket, ChallengeState>;

    /** Stores connections that are authenticated, and their public keys */
    private authenticatedConnections: WeakMap<WrappedSocket, AuthenticatedConnectionData>;

    /** Stores connections by their public keys */
    private connectionsByIdentity: Map<string, WrappedSocket>;

    /** Maps requested peers' public keys to maps of source peers' keys to SDP offers */
    private openPeerRequests: MultiKeyMap<[string, string], PeerRequest>;

    constructor (port: number) {
        this.waitingChallenges = new WeakMap();
        this.authenticatedConnections = new WeakMap();
        this.connectionsByIdentity = new Map();
        this.openPeerRequests = new MultiKeyMap();

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
            //console.log(ws);
        });
    }

    private async sendGotPeerRequest (
        peerRequest: PeerRequest,
        publicKey: string,
        peerConnection: WrappedSocket
    ): Promise<number> {
        const request = {
            type: GatewayMessageType.GOT_PEER_REQUEST,
            peerIdentity: publicKey,
            offer: peerRequest.offer
        } as const;

        const requestSeq = await peerConnection.send(request);

        // TODO: race condition - the peer request could've timed out while we were sending the request
        peerRequest.gotPeerRequestMessages.push({
            socket: peerConnection,
            origSeq: requestSeq
        });

        return requestSeq;
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

                if (this.connectionsByIdentity.has(message.publicKey)) {
                    ws.socket.close(GatewayCloseCode.EXISTING_SESSION, 'Another session is already active');
                    return;
                }

                // Decode public key from message
                let publicKey;
                try {
                    publicKey = await subtle.importKey(
                        'raw',
                        Buffer.from(message.publicKey, 'base64'),
                        {name: 'ECDSA', namedCurve: 'P-256'},
                        true,
                        ['verify']
                    );
                } catch (err) {
                    ws.socket.close(GatewayCloseCode.INVALID_FORMAT, 'Invalid public key format');
                    return;
                }

                // Issue a challenge to the client to make sure they actually own the corresponding private key
                const challenge = randomBytes(16);
                const ret = {
                    type: GatewayMessageType.CHALLENGE,
                    for: message.seq,
                    challenge: challenge.toString('base64')
                } as const;

                // Store challenge info for when the client sends a response
                const challengeSeq = await ws.send(ret);
                this.waitingChallenges.set(ws, {
                    publicKey,
                    publicKeyString: message.publicKey,
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
                            publicKeyString: waitingChallenge.publicKeyString
                        });
                        this.connectionsByIdentity.set(waitingChallenge.publicKeyString, ws);
                        ws.socket.once('close', () => {
                            this.authenticatedConnections.delete(ws);
                            this.connectionsByIdentity.delete(waitingChallenge.publicKeyString);
                        });

                        const resp = {
                            type: GatewayMessageType.CHALLENGE_SUCCESS,
                            for: waitingChallenge.for
                        } as const;

                        await ws.send(resp);
                    } else {
                        ws.socket.close(GatewayCloseCode.CHALLENGE_FAILED, 'Challenge failed');
                    }
                    return;
                } catch (err) {
                    console.error(err);
                    ws.socket.close(GatewayCloseCode.INVALID_FORMAT, 'Invalid signature format');
                }
                this.waitingChallenges.delete(ws);

                break;
            }

            // The client is requesting a peer
            case GatewayMessageType.REQUEST_PEER: {
                const auth = this.authenticatedConnections.get(ws);
                if (!auth) {
                    ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                    return;
                }

                if (this.openPeerRequests.has(message.peerIdentity, auth.publicKeyString)) {
                    // TODO: don't close socket for this
                    ws.socket.close(GatewayCloseCode.INVALID_STATE, 'Peer request already made to that peer');
                    return;
                }

                const peerRequest = new PeerRequest(message.seq, message.offer, Date.now() + REQUEST_PEER_TIMEOUT);
                peerRequest.once('timeout', () => {
                    this.openPeerRequests.delete(message.peerIdentity, auth.publicKeyString);
                });

                ws.socket.once('close', () => {
                    this.openPeerRequests.delete(message.peerIdentity, auth.publicKeyString);
                });

                const resp = {
                    type: GatewayMessageType.PEER_REQUEST_ACK,
                    for: message.seq,
                    timeout: peerRequest.timeout
                } as const;

                this.openPeerRequests.set(peerRequest, message.peerIdentity, auth.publicKeyString);

                const peerConnection = this.connectionsByIdentity.get(message.peerIdentity);
                // Peer is connected; forward the request immediately
                if (peerConnection) {
                    await this.sendGotPeerRequest(peerRequest, auth.publicKeyString, peerConnection);
                }

                await ws.send(resp);

                break;
            }

            // The client is cancelling a peer request
            case GatewayMessageType.PEER_REQUEST_CANCEL: {
                const auth = this.authenticatedConnections.get(ws);
                if (!auth) {
                    ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                    return;
                }

                const request = this.openPeerRequests.get(message.peerIdentity, auth.publicKeyString);
                if (request) void request.cancel();
                this.openPeerRequests.delete(message.peerIdentity, auth.publicKeyString);
                break;
            }

            case GatewayMessageType.GET_ALL_REQUESTS: {
                const auth = this.authenticatedConnections.get(ws);
                if (!auth) {
                    ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                    return;
                }

                const requestsForMe = this.openPeerRequests.submap(auth.publicKeyString);
                if (!requestsForMe) return;

                for (const [key, request] of requestsForMe) {
                    await this.sendGotPeerRequest(request, key, ws);
                }
                break;
            }

            // The client is responding to a peer request
            case GatewayMessageType.PEER_RESPONSE: {
                // TODO: handle failure cases!!!
                const auth = this.authenticatedConnections.get(ws);
                if (!auth) {
                    ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                    return;
                }

                const requestFromPeer = this.openPeerRequests.get(auth.publicKeyString, message.peerIdentity);
                // Either timed out or was cancelled
                if (!requestFromPeer) return;
                this.openPeerRequests.delete(auth.publicKeyString, message.peerIdentity);

                const connection = this.connectionsByIdentity.get(message.peerIdentity);
                // Client disconnected
                if (!connection) return;

                const answer = {
                    type: GatewayMessageType.PEER_ANSWER,
                    for: requestFromPeer.for,
                    answer: message.answer
                } as const;
                await connection.send(answer);

                break;
            }

            // The client is rejecting a peer request
            case GatewayMessageType.PEER_REJECT: {
                const auth = this.authenticatedConnections.get(ws);
                if (!auth) {
                    ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                    return;
                }

                const requestFromPeer = this.openPeerRequests.get(auth.publicKeyString, message.peerIdentity);
                // Either timed out or was cancelled
                if (!requestFromPeer) return;
                this.openPeerRequests.delete(auth.publicKeyString, message.peerIdentity);

                const connection = this.connectionsByIdentity.get(message.peerIdentity);
                // Client disconnected
                if (!connection) return;

                const rejection = {
                    type: GatewayMessageType.PEER_REQUEST_REJECTED,
                    for: requestFromPeer.for
                } as const;
                await connection.send(rejection);

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
