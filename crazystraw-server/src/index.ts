import {WebSocketServer, WebSocket} from 'ws';
import dotenv from 'dotenv';
import {randomBytes, subtle} from 'crypto';
import {setTimeout, clearTimeout} from 'timers';

import {
    GatewayMessage,
    GatewayMessageType,
    ChallengeMessage,
    GatewayCloseCode
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
const REQUEST_PEER_TIMEOUT = Date.now() + (60 * 1000);

/**
 * Wraps a WebSocket with gateway-specific message sending.
 */
class WrappedSocket {
    private seq: number;
    public socket: WebSocket;

    constructor (ws: WebSocket) {
        this.socket = ws;
        this.seq = 1;
    }

    send (message: Omit<GatewayMessage, 'seq'>): Promise<number> {
        const messageSeq = this.seq;
        (message as GatewayMessage).seq = messageSeq;
        this.seq += 2;
        return new Promise((resolve, reject) => {
            this.socket.send(JSON.stringify(message), err => {
                err ? reject() : resolve(messageSeq);
            });
        });
    }
}

type ChallengeState = {
    publicKey: CryptoKey,
    publicKeyString: string,
    challenge: Buffer,
    for: number,
    timeout: NodeJS.Timeout
};

// Stores connections that are currently in the challenge/response state
const waitingChallenges = new WeakMap<WrappedSocket, ChallengeState>();

type AuthenticatedConnectionData = {
    publicKey: CryptoKey,
    publicKeyString: string
};

// Stores connections that are authenticated, and their public keys
const authenticatedConnections = new WeakMap<WrappedSocket, AuthenticatedConnectionData>();

// Stores connections by their public keys
const connectionsByIdentity = new Map<string, WrappedSocket>();

type PeerRequest = {
    for: number,
    offer: {
        type: 'offer',
        sdp: string
    },
    timeout: NodeJS.Timeout
};

// Maps requested peers' public keys to maps of source peers' keys to SDP offers
// TODO: abstract into multi-key map
const openPeerRequests = new Map<string, Map<string, PeerRequest>>();

const respondToMessage = async (
    message: GatewayMessage,
    ws: WrappedSocket
): Promise<void> => {
    switch (message.type) {
        // The client just connected and is identifying itself.
        case GatewayMessageType.IDENTIFY: {
            if (waitingChallenges.has(ws) || authenticatedConnections.has(ws)) {
                ws.socket.close(GatewayCloseCode.INVALID_STATE, 'Already authenticated');
                return;
            }

            if (connectionsByIdentity.has(message.publicKey)) {
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
            };

            // Store challenge info for when the client sends a response
            const challengeSeq = await ws.send(ret);
            waitingChallenges.set(ws, {
                publicKey,
                publicKeyString: message.publicKey,
                challenge,
                for: challengeSeq,
                timeout: setTimeout(() => {
                    waitingChallenges.delete(ws);
                    ws.socket.close(GatewayCloseCode.CHALLENGE_TIMEOUT, 'Challenge timed out');
                }, CHALLENGE_TIMEOUT)
            });
            return;
        }
        // The client is responding to a challenge we sent them by signing it with their private key
        case GatewayMessageType.CHALLENGE_RESPONSE: {
            const waitingChallenge = waitingChallenges.get(ws);
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
                    authenticatedConnections.set(ws, {
                        publicKey: waitingChallenge.publicKey,
                        publicKeyString: waitingChallenge.publicKeyString
                    });
                    connectionsByIdentity.set(waitingChallenge.publicKeyString, ws);
                    ws.socket.once('close', () => {
                        authenticatedConnections.delete(ws);
                        connectionsByIdentity.delete(waitingChallenge.publicKeyString);
                    });

                    const resp = {
                        type: GatewayMessageType.CHALLENGE_SUCCESS,
                        for: waitingChallenge.for
                    };

                    await ws.send(resp);
                } else {
                    ws.socket.close(GatewayCloseCode.CHALLENGE_FAILED, 'Challenge failed');
                }
                return;
            } catch (err) {
                console.error(err);
                ws.socket.close(GatewayCloseCode.INVALID_FORMAT, 'Invalid signature format');
            }
            waitingChallenges.delete(ws);

            break;
        }
        // The client is requesting a peer
        case GatewayMessageType.REQUEST_PEER: {
            const auth = authenticatedConnections.get(ws);
            if (!auth) {
                ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                return;
            }
            const resp = {
                type: GatewayMessageType.REQUEST_PEER_ACK,
                timeout: Date.now() + REQUEST_PEER_TIMEOUT
            };

            const timeout = setTimeout(() => {
                const requestsForPeer = openPeerRequests.get(message.peerIdentity);
                if (requestsForPeer) requestsForPeer.delete(auth.publicKeyString);

                const timeoutMessage = {
                    type: GatewayMessageType.REQUEST_PEER_TIMEOUT,
                    for: message.seq
                };
                void ws.send(timeoutMessage);
            }, REQUEST_PEER_TIMEOUT);

            let requestsForPeer = openPeerRequests.get(message.peerIdentity);
            if (!requestsForPeer) {
                requestsForPeer = new Map();
                openPeerRequests.set(message.peerIdentity, requestsForPeer);
            }

            if (requestsForPeer.has(auth.publicKeyString)) {
                ws.socket.close(GatewayCloseCode.INVALID_STATE, 'Peer request already made to that peer');
                return;
            }

            requestsForPeer.set(auth.publicKeyString, {
                for: message.seq,
                offer: message.offer,
                timeout
            });

            await ws.send(resp);

            const peerConnection = connectionsByIdentity.get(message.peerIdentity);
            if (peerConnection) {
                //TODO: add a GOT_PEER_REQUEST_ACK so the user has more time to accept/reject request
                const request = {
                    type: GatewayMessageType.GOT_PEER_REQUEST,
                    peerIdentity: auth.publicKeyString,
                    offer: message.offer
                };
                await peerConnection.send(request);
            }

            break;
        }
        // The client is cancelling a peer request
        case GatewayMessageType.REQUEST_PEER_CANCEL: {
            const auth = authenticatedConnections.get(ws);
            if (!auth) {
                ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                return;
            }

            const requestsForPeer = openPeerRequests.get(message.peerIdentity);
            if (requestsForPeer) {
                const request = requestsForPeer.get(auth.publicKeyString);
                if (request) clearTimeout(request.timeout);
                requestsForPeer.delete(auth.publicKeyString);
            }
            break;
        }
        case GatewayMessageType.GET_ALL_REQUESTS: {
            const auth = authenticatedConnections.get(ws);
            if (!auth) {
                ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                return;
            }

            const requestsForMe = openPeerRequests.get(auth.publicKeyString);
            if (!requestsForMe) return;

            for (const [key, request] of requestsForMe) {
                const message = {
                    type: GatewayMessageType.GOT_PEER_REQUEST,
                    peerIdentity: key,
                    offer: request.offer
                };
                await ws.send(message);
            }
            break;
        }
        // The client is responding to a peer request
        case GatewayMessageType.PEER_RESPONSE: {
            // TODO: handle failure cases!!!
            const auth = authenticatedConnections.get(ws);
            if (!auth) {
                ws.socket.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated');
                return;
            }

            const requestsForMe = openPeerRequests.get(auth.publicKeyString);
            // Either timed out or was cancelled
            // TODO: signal that the response is no longer valid
            if (!requestsForMe) return;

            const requestFromPeer = requestsForMe.get(message.peerIdentity);
            // Either timed out or was cancelled
            if (!requestFromPeer) return;

            const connection = connectionsByIdentity.get(message.peerIdentity);
            // Client disconnected
            if (!connection) return;

            const answer = {
                type: GatewayMessageType.PEER_ANSWER,
                for: requestFromPeer.for,
                answer: message.answer
            };
            await connection.send(answer);

            break;
        }
        default: {
            throw new Error('Unknown message type');
        }
    }
};

const server = new WebSocketServer({port: config.port});

server.on('connection', ws => {
    const wrappedSocket = new WrappedSocket(ws);
    ws.addEventListener('message', evt => {
        try {
            if (typeof evt.data !== 'string') return;
            const parsedData = JSON.parse(evt.data) as GatewayMessage;
            void respondToMessage(parsedData, wrappedSocket);
        } catch (err) {
            // swallow errors
        }
        //console.log(evt, evt.data);
    });
    console.log('Connection!');
    //console.log(ws);
});

console.log(`Server running on port ${config.port}...`);
