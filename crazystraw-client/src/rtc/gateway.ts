import {toByteArray, fromByteArray} from 'base64-js';

import {
    GatewayMessage,
    GatewayMessageType,
    GatewayCloseCode,
    ChallengeMessage,
    ChallengeSuccessMessage
} from 'crazystraw-common/ws-types';

import Identity from './identity';
import generateID from '../util/id';
import {TypedEventTarget, TypedEvent} from '../util/typed-events';

export const enum GatewayConnectionStateType {
    CONNECTING,
    AUTHENTICATING,
    CONNECTED,
    CLOSED
}

export type GatewayConnectionState = {
    type: GatewayConnectionStateType.CONNECTING |
    GatewayConnectionStateType.AUTHENTICATING |
    GatewayConnectionStateType.CONNECTED
} | {
    type: GatewayConnectionStateType.CLOSED,
    code: number,
    reason: string
};

export class GatewayConnectionStateChangeEvent extends TypedEvent<'statechange'> {
    state: GatewayConnectionState;
    constructor (state: GatewayConnectionState) {
        super('statechange');
        this.state = state;
    }
}

export type PeerRequest = {
    /** The peer's public key, encoded into base64. */
    peerIdentity: string,
    /** SDP offer, for WebRTC. */
    offer: {
        type: 'offer',
        sdp: string
    }
};

export class GatewayConnectionPeerRequestEvent extends TypedEvent<'peerrequest'> {
    request: PeerRequest;
    constructor (request: PeerRequest) {
        super('peerrequest');
        this.request = request;
    }
}

export class GatewayConnectionMessageEvent extends TypedEvent<'message'> {
    message: GatewayMessage;
    constructor (message: GatewayMessage) {
        super('message');
        this.message = message;
    }
}

export class GatewayConnection extends TypedEventTarget<
GatewayConnectionStateChangeEvent |
GatewayConnectionPeerRequestEvent |
GatewayConnectionMessageEvent
> {
    private ws: WebSocket;
    private seq: number;

    public state: GatewayConnectionState;

    constructor (serverURL: string, identity: Identity) {
        super();
        this.ws = new WebSocket(serverURL);
        this.seq = 0;
        this.state = {type: GatewayConnectionStateType.CONNECTING};

        const onClose = (event: CloseEvent): void => {
            this.dispatchEvent(new GatewayConnectionStateChangeEvent({
                type: GatewayConnectionStateType.CLOSED,
                code: event.code,
                reason: event.reason
            }));
            this.ws.removeEventListener('close', onClose);
            this.ws.removeEventListener('message', onMessage);
        };
        this.ws.addEventListener('close', onClose);

        const onMessage = (event: MessageEvent): void => {
            try {
                const message = JSON.parse(event.data as string) as GatewayMessage;

                this.dispatchEvent(new GatewayConnectionMessageEvent(message));

                if (message.type === GatewayMessageType.GOT_PEER_REQUEST) {
                    this.dispatchEvent(new GatewayConnectionPeerRequestEvent({
                        peerIdentity: message.peerIdentity,
                        offer: message.offer
                    }));
                }
            } catch (err) {
                this.ws.close(GatewayCloseCode.INVALID_FORMAT, 'Invalid JSON');
            }
        };
        this.ws.addEventListener('message', onMessage);

        const onOpen = async (): Promise<void> => {
            this.dispatchEvent(new GatewayConnectionStateChangeEvent({
                type: GatewayConnectionStateType.AUTHENTICATING}));
            const identifyMessage = {
                type: GatewayMessageType.IDENTIFY,
                publicKey: fromByteArray(identity.rawPublicKey)
            } as const;
            const identifySeq = this.send(identifyMessage);
            try {
                const challengeMessage = (await this.waitFor(
                    (message): message is ChallengeMessage => message.type === GatewayMessageType.CHALLENGE,
                    5000
                ));
                const challenge = toByteArray(challengeMessage.challenge);
                const signature = await identity.sign(challenge);

                const responseMessage = {
                    type: GatewayMessageType.CHALLENGE_RESPONSE,
                    for: challengeMessage.seq,
                    response: fromByteArray(new Uint8Array(signature))
                };
                this.send(responseMessage);
                await this.waitFor(
                    (message): message is ChallengeSuccessMessage =>
                        message.type === GatewayMessageType.CHALLENGE_SUCCESS &&
                        message.for === challengeMessage.seq,
                    5000
                );
                this.dispatchEvent(new GatewayConnectionStateChangeEvent({type: GatewayConnectionStateType.CONNECTED}));
            } catch (err) {
                // If we time out or there's some other error, close the socket
                this.ws.close(1002);
            }
            this.ws.removeEventListener('open', onOpen);
        };
        this.ws.addEventListener('open', onOpen);
    }

    waitFor<T extends GatewayMessage> (filter: (message: GatewayMessage) => message is T, timeout: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const onMessage = (event: GatewayConnectionMessageEvent): void => {
                if (filter(event.message)) {
                    resolve(event.message);
                    this.removeEventListener('message', onMessage);
                }
            };
            this.addEventListener('message', onMessage);

            setTimeout(() => {
                this.removeEventListener('message', onMessage);
                reject(new Error('Timed out'));
            }, timeout);
        });
    }

    send (message: Omit<GatewayMessage, 'seq'>): number {
        const msgSeq = this.seq;
        (message as GatewayMessage).seq = msgSeq;
        this.seq += 2;
        this.ws.send(JSON.stringify(message));
        return msgSeq;
    }

    close (): void {
        this.ws.close();
    }

    createConnection (myIdentity: Identity, peerIdentity: Identity): PeerConnection {
        const id = generateID();
        return new PeerConnection(id, this, myIdentity, peerIdentity);
    }
}

class ConnectionCancelEvent extends TypedEvent<'cancel'> {
    constructor () {
        super('cancel');
    }
}

class ConnectionErrorEvent extends TypedEvent<'error'> {
    public error: Error;
    constructor (error: Error) {
        super('error');
        this.error = error;
    }
}


class ConnectionAcknowledgeEvent extends TypedEvent<'acknowledge'> {
    /** Approximate timestamp at which this connection times out. */
    public timeout: number;
    constructor (timeout: number) {
        super('acknowledge');
        this.timeout = timeout;
    }
}

class PeerConnection extends TypedEventTarget<
ConnectionCancelEvent |
ConnectionErrorEvent |
ConnectionAcknowledgeEvent
> {
    /** Used to abort the fetch request when the connection is cancelled */
    private establishConnectionController: AbortController;
    private connection: RTCPeerConnection;

    constructor (
        id: string,
        gateway: GatewayConnection,
        myIdentity: Identity,
        peerIdentity: Identity
    ) {
        super();

        this.establishConnectionController = new AbortController();
        this.connection = new RTCPeerConnection();

        void this.connect(id, gateway, myIdentity, peerIdentity);
    }

    private async connect (
        id: string,
        gateway: GatewayConnection,
        myIdentity: Identity,
        peerIdentity: Identity
    ): Promise<void> {
        try {
            const channel = this.connection.createDataChannel('send_chan');
            const offer = await this.connection.createOffer();

            const requestBody = {
                connectionID: id,
                type: GatewayMessageType.REQUEST_PEER,
                myIdentity,
                peerIdentity,
                offer
            };

            gateway.send(requestBody);

        }
        catch (error) {
            this.dispatchEvent(new ConnectionErrorEvent(error as Error));
        }
    }

    cancel (): void {
        this.establishConnectionController.abort();
        this.dispatchEvent(new ConnectionCancelEvent());
    }
}
