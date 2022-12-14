import {toByteArray, fromByteArray} from 'base64-js';

import {
    ServerMessage,
    ClientMessage,
    Unsequenced,
    GatewayMessageType,
    GatewayCloseCode,
    ChallengeMessage,
    ChallengeSuccessMessage,
    PeerRequestAcceptedMessage,
    PeerRequestRejectedMessage,
    PeerOfflineMessage
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

export const SOCKET_CLOSED = Symbol('SOCKET_CLOSED');
export const TIMED_OUT = Symbol('TIMED_OUT');
export const OPERATION_CANCELLED = Symbol('OPERATION_CANCELLED');
export const PEER_REQUEST_REJECTED = Symbol('PEER_REQUEST_REJECTED');
export const PEER_OFFLINE = Symbol('PEER_OFFLINE');

export class GatewayConnection extends TypedEventTarget<
GatewayConnectionStateChangeEvent |
GatewayConnectionPeerRequestEvent |
GatewayConnectionMessageEvent
> {
    /** Currently active websocket. */
    private ws: WebSocket | null;
    /** Whether we have successfully authenticated. */
    private authenticated: boolean;
    /** Sequence number, restarted when socket reopened. */
    private seq: number;
    /** Identity used when connecting, for authentication purposes. */
    private identity: PersonalIdentity;
    /** Promises to be resolved after the socket authenticates. */
    private onAuthenticationPromises: {resolve: (ws: WebSocket) => unknown, reject: (reason: unknown) => unknown}[];

    public state: GatewayConnectionState;

    constructor (serverURL: string, identity: PersonalIdentity) {
        super();
        this.ws = null;
        this.authenticated = false;
        this.seq = 0;
        this.identity = identity;
        this.onAuthenticationPromises = [];

        this.state = {type: GatewayConnectionStateType.CONNECTING};

        this.initializeSocket(serverURL);
    }

    private async handleOpen (ws: WebSocket): Promise<void> {
        this.setState({type: GatewayConnectionStateType.AUTHENTICATING});
        const identifySeq = this.sendTo(ws, {
            type: GatewayMessageType.IDENTIFY,
            publicKey: fromByteArray(this.identity.rawPublicKey),
            identity: this.identity.toBase64()
        });
        try {
            const challengeMessage = (await this.waitFor(
                ws,
                (message): message is ChallengeMessage =>
                    message.type === GatewayMessageType.CHALLENGE &&
                    message.for === identifySeq,
                5000
            ));
            const challenge = toByteArray(challengeMessage.challenge);
            const signature = await this.identity.sign(challenge);

            const responseMessage = {
                type: GatewayMessageType.CHALLENGE_RESPONSE,
                for: challengeMessage.seq,
                response: fromByteArray(new Uint8Array(signature))
            } as const;
            this.sendTo(ws, responseMessage);
            await this.waitFor(
                ws,
                (message): message is ChallengeSuccessMessage =>
                    message.type === GatewayMessageType.CHALLENGE_SUCCESS &&
                    message.for === challengeMessage.seq,
                5000
            );
            this.setState({type: GatewayConnectionStateType.CONNECTED});

            this.authenticated = true;
            // Send all enqueued messages after authenticating
            for (const promise of this.onAuthenticationPromises) {
                promise.resolve(ws);
            }
            this.onAuthenticationPromises.length = 0;
        } catch (err) {
            // If we time out or there's some other error, close the socket
            // Does nothing if the error was thrown due to the socket being closed already
            ws.close(1002);
        }
    }

    private handleMessage (ws: WebSocket, event: MessageEvent): void {
        try {
            const message = JSON.parse(event.data as string) as ServerMessage;

            this.dispatchEvent(new GatewayConnectionMessageEvent(message));

            if (message.type === GatewayMessageType.GOT_PEER_REQUEST) {
                this.dispatchEvent(new GatewayConnectionPeerRequestEvent(new IncomingPeerRequest(
                    this,
                    this.identity,
                    message.peerIdentity,
                    message.connectionID
                )));
            }
        } catch (err) {
            ws.close(GatewayCloseCode.INVALID_FORMAT, 'Invalid JSON');
        }
    }

    private handleClose (abortController: AbortController, event: CloseEvent): void {
        this.setState({
            type: GatewayConnectionStateType.CLOSED,
            code: event.code,
            reason: event.reason
        });

        for (const promise of this.onAuthenticationPromises) {
            promise.reject(SOCKET_CLOSED);
        }

        // Remove all listeners for the websocket
        abortController.abort();
        this.ws = null;
        this.authenticated = false;
    }

    private initializeSocket (serverURL: string): void {
        this.authenticated = false;
        this.seq = 0;
        const abortController = new AbortController();
        const {signal} = abortController;

        const ws = new WebSocket(serverURL);
        ws.addEventListener('open', this.handleOpen.bind(this, ws, {once: true, signal}));
        ws.addEventListener('message', this.handleMessage.bind(this, ws), {signal});
        ws.addEventListener('close', this.handleClose.bind(this, abortController), {once: true, signal});
        this.ws = ws;
    }

    private waitFor<T extends ServerMessage> (
        ws: WebSocket,
        filter: (message: ServerMessage) => message is T,
        timeout: number,
        signal?: AbortSignal
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            let clearAbort: (() => void) | undefined;
            if (signal) {
                const onAbort = (): void => {
                    clearHandlers();
                    reject(signal.reason);
                };
                signal.addEventListener('abort', onAbort);
                clearAbort = (): void => signal.removeEventListener('abort', onAbort);
            }

            const onMessage = (event: GatewayConnectionMessageEvent): void => {
                if (filter(event.message)) {
                    clearHandlers();
                    resolve(event.message);
                }
            };
            this.addEventListener('message', onMessage);

            const onClose = (): void => {
                clearHandlers();
                reject(SOCKET_CLOSED);
            };
            ws.addEventListener('close', onClose, {once: true});

            const timeoutHandler = timeout > 0 ? setTimeout(() => {
                clearHandlers();
                reject(SOCKET_CLOSED);
            }, timeout) : undefined;

            const clearHandlers = (): void => {
                this.removeEventListener('message', onMessage);
                ws.removeEventListener('close', onClose);
                if (clearAbort) clearAbort();
                clearTimeout(timeoutHandler);
            };
        });
    }

    /**
     * Send a peer request and wait for it to be accepted, rejected, or errored.
     * @param peerIdentity The peer's identity string.
     * @param connectionID Connection UUID.
     * @param signal Signal which will be fired if the request is cancelled.
     * @returns when the peer request is accepted, or errors when it is rejected.
     */
    public async sendPeerRequest (peerIdentity: string, connectionID: string, signal: AbortSignal): Promise<void> {
        const message = {type: GatewayMessageType.PEER_REQUEST, peerIdentity, connectionID} as const;
        let {ws} = this;
        if (!ws || !this.authenticated) {
            ws = await new Promise<WebSocket>((resolve, reject) => {
                this.onAuthenticationPromises.push({resolve, reject});
            });
        }
        this.sendTo(ws, message);

        const response = await this.waitFor(
            ws,
            (message): message is (PeerRequestAcceptedMessage | PeerRequestRejectedMessage | PeerOfflineMessage) => (
                message.type === GatewayMessageType.PEER_REQUEST_ACCEPTED ||
                message.type === GatewayMessageType.PEER_REQUEST_REJECTED ||
                message.type === GatewayMessageType.PEER_OFFLINE
            ) && message.connectionID === connectionID,
            0,
            signal
        );

        switch (response.type) {
            case GatewayMessageType.PEER_REQUEST_ACCEPTED:
                return;
            case GatewayMessageType.PEER_REQUEST_REJECTED:
                throw PEER_REQUEST_REJECTED;
            case GatewayMessageType.PEER_OFFLINE:
                throw PEER_OFFLINE;
        }
    }

    /**
     * Send a message if we're connected and authenticated. Do nothing if not.
     * @param message The message to (maybe) send.
     */
    public sendAndForget (message: Unsequenced<ClientMessage>): void {
        if (this.ws) this.sendTo(this.ws, message);
    }

    private sendTo (ws: WebSocket, message: Unsequenced<ClientMessage>): number {
        const msgSeq = this.seq;
        (message as ClientMessage).seq = msgSeq;
        this.seq += 2;
        ws.send(JSON.stringify(message));
        return msgSeq;
    }

    public close (): void {
        if (this.ws) this.ws.close();
    }

    makePeerRequest (peerIdentity: string): OutgoingPeerRequest {
        return new OutgoingPeerRequest(this, this.identity, peerIdentity);
    }

    private setState (newState: GatewayConnectionState): void {
        this.state = newState;
        this.dispatchEvent(new GatewayConnectionStateChangeEvent(newState));
    }
}
