import {toByteArray, fromByteArray} from 'base64-js';

import {
    ServerMessage,
    ClientMessage,
    Unsequenced,
    GatewayMessageType,
    GatewayCloseCode,
    ChallengeMessage,
    ChallengeSuccessMessage
} from 'crazystraw-common/ws-types';

import {PersonalIdentity} from './identity';
import {IncomingPeerRequest, OutgoingPeerRequest} from './peer-request';

import {TypedEventTarget, TypedEvent} from '../util/typed-events';
import type {TaggedUnion} from '../util/tagged-union';

export const enum GatewayConnectionStateType {
    CONNECTING,
    AUTHENTICATING,
    CONNECTED,
    CLOSED
}

export type GatewayConnectionState = TaggedUnion<GatewayConnectionStateType, {
    [GatewayConnectionStateType.CONNECTING]: {},
    [GatewayConnectionStateType.AUTHENTICATING]: {},
    [GatewayConnectionStateType.CONNECTED]: {},
    [GatewayConnectionStateType.CLOSED]: {
        code: number,
        reason: string
    },
}>;

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
    message: ServerMessage;
    constructor (message: ServerMessage) {
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
    private identity: PersonalIdentity;

    public state: GatewayConnectionState;

    constructor (serverURL: string, identity: PersonalIdentity) {
        super();
        this.ws = new WebSocket(serverURL);
        this.seq = 0;
        this.identity = identity;

        this.state = {type: GatewayConnectionStateType.CONNECTING};

        // TODO: allow gateway to reconnect?
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
                const message = JSON.parse(event.data as string) as ServerMessage;

                this.dispatchEvent(new GatewayConnectionMessageEvent(message));

                if (message.type === GatewayMessageType.GOT_PEER_REQUEST) {
                    this.dispatchEvent(new GatewayConnectionPeerRequestEvent(new IncomingPeerRequest(
                        this,
                        identity,
                        message.peerIdentity,
                        message.connectionID
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
            const identifySeq = this.send({
                type: GatewayMessageType.IDENTIFY,
                publicKey: fromByteArray(identity.rawPublicKey),
                identity: identity.toBase64()
            });
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

    waitFor<T extends ServerMessage> (filter: (message: ServerMessage) => message is T, timeout: number): Promise<T> {
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

    send (message: Unsequenced<ClientMessage>): number {
        const msgSeq = this.seq;
        (message as ClientMessage).seq = msgSeq;
        this.seq += 2;
        this.ws.send(JSON.stringify(message));
        return msgSeq;
    }

    close (): void {
        this.ws.close();
    }

    makePeerRequest (peerIdentity: string): OutgoingPeerRequest {
        return new OutgoingPeerRequest(this, this.identity, peerIdentity);
    }
}
