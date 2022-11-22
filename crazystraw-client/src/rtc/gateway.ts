import {toByteArray, fromByteArray} from 'base64-js';

import {
    GatewayMessage,
    GatewayMessageType,
    GatewayCloseCode,
    ChallengeMessage,
    ChallengeSuccessMessage
} from 'crazystraw-common/ws-types';

import {Identity, PersonalIdentity} from './identity';
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

export class GatewayConnectionPeerRequestEvent extends TypedEvent<'peerrequest'> {
    request: IncomingPeerRequest;
    constructor (request: IncomingPeerRequest) {
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

const messageTypeIs = <T extends GatewayMessageType>(type: T, message: GatewayMessage):
message is Extract<GatewayMessage, {type: T}> => {
    return message.type === type;
};

export class GatewayConnection extends TypedEventTarget<
GatewayConnectionStateChangeEvent |
GatewayConnectionPeerRequestEvent |
GatewayConnectionMessageEvent
> {
    private ws: WebSocket;
    private seq: number;

    public state: GatewayConnectionState;

    constructor (serverURL: string, identity: PersonalIdentity) {
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

        const onMessage = async (event: MessageEvent): Promise<void> => {
            try {
                const message = JSON.parse(event.data as string) as GatewayMessage;

                this.dispatchEvent(new GatewayConnectionMessageEvent(message));

                if (messageTypeIs(GatewayMessageType.GOT_PEER_REQUEST, message)) {
                    const peerIdentity = await Identity.fromPublicKeyString(message.peerIdentity);
                    this.dispatchEvent(new GatewayConnectionPeerRequestEvent(new IncomingPeerRequest(
                        this,
                        peerIdentity,
                        message.peerIdentity,
                        message.offer,
                        message.timeout
                    )));
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
                    (message): message is ChallengeMessage =>
                        message.type === GatewayMessageType.CHALLENGE &&
                        message.for === identifySeq,
                    5000
                ));
                const challenge = toByteArray(challengeMessage.challenge);
                const signature = await identity.sign(challenge);

                const responseMessage = {
                    type: GatewayMessageType.CHALLENGE_RESPONSE,
                    for: challengeMessage.seq,
                    response: fromByteArray(new Uint8Array(signature))
                } as const;
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

    createConnection (peerIdentity: Identity): OutgoingPeerRequest {
        return new OutgoingPeerRequest(this, peerIdentity);
    }
}

class OutgoingPeerRequestCancelEvent extends TypedEvent<'cancel'> {
    constructor () {
        super('cancel');
    }
}

class OutgoingPeerRequestAbortEvent extends TypedEvent<'abort'> {
    constructor () {
        super('abort');
    }
}

class OutgoingPeerRequestAcknowledgeEvent extends TypedEvent<'acknowledge'> {
    /** Approximate timestamp at which this connection times out. */
    public timeout: number;
    constructor (timeout: number) {
        super('acknowledge');
        this.timeout = timeout;
    }
}

class OutgoingPeerRequestAnswerEvent extends TypedEvent<'answer'> {
    public answer: {
        type: 'answer',
        sdp: string
    };
    constructor (answer: OutgoingPeerRequestAnswerEvent['answer']) {
        super('answer');
        this.answer = answer;
    }
}

export class OutgoingPeerRequest extends TypedEventTarget<
OutgoingPeerRequestCancelEvent |
OutgoingPeerRequestAbortEvent |
OutgoingPeerRequestAnswerEvent |
OutgoingPeerRequestAcknowledgeEvent
> {
    private peerIdentity: Identity;
    private gateway: GatewayConnection;
    private connection: RTCPeerConnection;

    constructor (gateway: GatewayConnection, peerIdentity: Identity) {
        super();

        this.peerIdentity = peerIdentity;
        this.gateway = gateway;
        this.connection = new RTCPeerConnection();

        void this.connect();
    }

    private async connect (): Promise<void> {
        try {
            const channel = this.connection.createDataChannel('send_chan');
            const offer = await this.connection.createOffer();

            const requestBody = {
                type: GatewayMessageType.REQUEST_PEER,
                peerIdentity: this.peerIdentity,
                offer
            } as const;

            const requestSeq = this.gateway.send(requestBody);

            const onMessage = (event: GatewayConnectionMessageEvent): void => {
                const {message} = event;

                if (messageTypeIs(GatewayMessageType.PEER_ANSWER, message) && message.for === requestSeq) {
                    this.dispatchEvent(new OutgoingPeerRequestAnswerEvent(message.answer));
                    this.gateway.removeEventListener('message', onMessage);
                    return;
                }

                if (messageTypeIs(GatewayMessageType.PEER_REQUEST_ACK, message) && message.for === requestSeq) {
                    this.dispatchEvent(new OutgoingPeerRequestAcknowledgeEvent(message.timeout));
                    this.gateway.removeEventListener('message', onMessage);
                    return;
                }

                if (messageTypeIs(GatewayMessageType.PEER_REQUEST_TIMED_OUT, message) && message.for === requestSeq) {
                    this.dispatchEvent(new OutgoingPeerRequestAbortEvent());
                    this.gateway.removeEventListener('message', onMessage);
                    return;
                }

                if (messageTypeIs(GatewayMessageType.PEER_REQUEST_REJECTED, message) && message.for === requestSeq) {
                    this.dispatchEvent(new OutgoingPeerRequestAbortEvent());
                    this.gateway.removeEventListener('message', onMessage);
                    return;
                }
            };

            this.gateway.addEventListener('message', onMessage);

        }
        catch (error) {
            this.dispatchEvent(new OutgoingPeerRequestAbortEvent());
        }
    }

    cancel (): void {
        const cancelMessage = {
            type: GatewayMessageType.PEER_REQUEST_CANCEL,
            peerIdentity: this.peerIdentity
        };
        this.gateway.send(cancelMessage);
        this.dispatchEvent(new OutgoingPeerRequestCancelEvent());
    }
}

export class IncomingPeerRequest extends TypedEventTarget<never> {
    gateway: GatewayConnection;
    peerIdentity: Identity;
    peerIdentityString: string;
    offer: {
        type: 'offer',
        sdp: string
    };
    timeout: number;

    constructor (
        gateway: GatewayConnection,
        peerIdentity: Identity,
        peerIdentityString: string,
        offer: IncomingPeerRequest['offer'],
        timeout: number
    ) {
        super();
        this.gateway = gateway;
        this.peerIdentity = peerIdentity;
        this.peerIdentityString = peerIdentityString;
        this.offer = offer;
        this.timeout = timeout;
    }
}
