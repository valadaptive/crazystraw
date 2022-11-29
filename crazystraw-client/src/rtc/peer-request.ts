import {GatewayMessageType} from 'crazystraw-common/ws-types';

import {
    GatewayConnection,
    GatewayConnectionMessageEvent,
    SOCKET_CLOSED,
    TIMED_OUT,
    PEER_REQUEST_REJECTED,
    PEER_OFFLINE
} from './gateway';
import {PersonalIdentity} from './identity';
import {OTRChannel, OTRChannelState} from './otr';

import {TypedEventTarget, TypedEvent} from '../util/typed-events';

export const enum OutgoingPeerRequestState {
    /** The peer request is currently waiting for the peer to accept or reject it. */
    PENDING,
    /** The peer has accepted the peer request and we are negotiating over WebRTC. */
    ACCEPTED,
    /** We have connected with this peer over WebRTC. */
    CONNECTED,
    /** The gateway timed out. */
    TIMED_OUT,
    /** The peer has rejected the peer request. */
    REJECTED,
    /** The peer is offline right now. */
    PEER_OFFLINE,
    /** We cancelled the request. */
    CANCELLED,
    /** There was some error in the connection. */
    CONNECTION_ERROR
}

class OutgoingPeerRequestStateChangeEvent extends TypedEvent<'statechange'> {
    constructor () {
        super('statechange');
    }
}

class OutgoingPeerRequestPeerOfflineEvent extends TypedEvent<'peeroffline'> {
    constructor () {
        super('peeroffline');
    }
}

class OutgoingPeerRequestAbortEvent extends TypedEvent<'abort'> {
    constructor () {
        super('abort');
    }
}

class OutgoingPeerRequestConnectEvent extends TypedEvent<'connect'> {
    public channel: OTRChannel;
    constructor (channel: OTRChannel) {
        super('connect');
        this.channel = channel;
    }
}

export class OutgoingPeerRequest extends TypedEventTarget<
OutgoingPeerRequestPeerOfflineEvent |
OutgoingPeerRequestAbortEvent |
OutgoingPeerRequestConnectEvent |
OutgoingPeerRequestStateChangeEvent
> {
    public state: OutgoingPeerRequestState;
    public peerIdentity: string;
    public createdTimestamp: number;

    private myIdentity: PersonalIdentity;
    private gateway: GatewayConnection;
    private connectionID: string;
    private abortController: AbortController;


    private setState (newState: OutgoingPeerRequestState): void {
        this.state = newState;
        this.dispatchEvent(new IncomingPeerRequestStateChangeEvent());
    }

    constructor (gateway: GatewayConnection, myIdentity: PersonalIdentity, peerIdentity: string) {
        super();

        this.state = OutgoingPeerRequestState.PENDING;
        this.createdTimestamp = Date.now();

        this.myIdentity = myIdentity;
        this.peerIdentity = peerIdentity;
        this.gateway = gateway;
        this.connectionID = crypto.randomUUID();
        this.abortController = new AbortController();

        void this.send();
    }

    private async send (): Promise<void> {
        try {
            await this.gateway.sendPeerRequest(this.peerIdentity, this.connectionID, this.abortController.signal);

            this.setState(OutgoingPeerRequestState.ACCEPTED);
            // peer request accepted-- set up RTC channel
            const channel = new OTRChannel(this.gateway, this.myIdentity, this.peerIdentity, this.connectionID, true);

            const onChannelStateChange = (): void => {
                switch (channel.state) {
                    case OTRChannelState.CONNECTED: {
                        this.setState(OutgoingPeerRequestState.CONNECTED);
                        this.dispatchEvent(new OutgoingPeerRequestConnectEvent(channel));
                        this.abortController.abort();
                        break;
                    }
                    case OTRChannelState.CLOSED: {
                        this.setState(OutgoingPeerRequestState.CONNECTION_ERROR);
                        this.abortController.abort();
                        break;
                    }
                }
            };
            channel.addEventListener('statechange', onChannelStateChange, {signal: this.abortController.signal});
        } catch (err) {
            if (err === TIMED_OUT) this.setState(OutgoingPeerRequestState.TIMED_OUT);
            if (err === SOCKET_CLOSED) this.setState(OutgoingPeerRequestState.CONNECTION_ERROR);
            if (err === PEER_REQUEST_REJECTED) this.setState(OutgoingPeerRequestState.REJECTED);
            if (err === PEER_OFFLINE) this.setState(OutgoingPeerRequestState.PEER_OFFLINE);
            this.abortController.abort();
        }
    }

    cancel (): void {
        // This message isn't that important--it just tells the peer that we cancelled the request
        this.gateway.sendAndForget({
            type: GatewayMessageType.PEER_REQUEST_CANCEL,
            peerIdentity: this.peerIdentity,
            connectionID: this.connectionID
        });
        this.setState(OutgoingPeerRequestState.CANCELLED);
        // Unregister all other event handlers *after* the final state change event is fired above
        this.abortController.abort();
    }
}

export const enum IncomingPeerRequestState {
    /** The peer request is currently waiting for us to accept or reject it. */
    PENDING,
    /** We have accepted the peer request and are negotiating over WebRTC. */
    ACCEPTED,
    /** We have connected with this peer over WebRTC. */
    CONNECTED,
    /** We have rejected the peer request. */
    REJECTED,
    /** The peer cancelled the request. */
    CANCELLED,
    /** WebRTC, signalling, or auth failure */
    CONNECTION_ERROR
}

class IncomingPeerRequestStateChangeEvent extends TypedEvent<'statechange'> {
    constructor () {
        super('statechange');
    }
}

class IncomingPeerRequestConnectEvent extends TypedEvent<'connect'> {
    public channel: OTRChannel;
    constructor (channel: OTRChannel) {
        super('connect');
        this.channel = channel;
    }
}

export class IncomingPeerRequest extends TypedEventTarget<
IncomingPeerRequestStateChangeEvent |
IncomingPeerRequestConnectEvent
> {
    public state: IncomingPeerRequestState;
    public peerIdentity: string;
    public receivedTimestamp: number;

    private gateway: GatewayConnection;
    private myIdentity: PersonalIdentity;
    private connectionID: string;
    private abortController: AbortController;

    constructor (
        gateway: GatewayConnection,
        myIdentity: PersonalIdentity,
        peerIdentity: string,
        connectionID: string
    ) {
        super();
        this.gateway = gateway;
        this.myIdentity = myIdentity;
        this.peerIdentity = peerIdentity;
        this.receivedTimestamp = Date.now();
        this.state = IncomingPeerRequestState.PENDING;
        this.connectionID = connectionID;
        this.abortController = new AbortController();
        const {signal} = this.abortController;


        const onMessage = ({message}: GatewayConnectionMessageEvent): void => {
            if (message.type === GatewayMessageType.GOT_PEER_REQUEST_CANCELLED &&
                message.connectionID === connectionID) {
                this.setState(IncomingPeerRequestState.CANCELLED);
                return;
            }
        };

        // When the state changes, the abort controller will fire the signal, causing this listener to unregister
        this.gateway.addEventListener('message', onMessage, {signal});
    }

    private setState (newState: IncomingPeerRequestState): void {
        this.state = newState;
        this.dispatchEvent(new IncomingPeerRequestStateChangeEvent());
    }

    accept (): void {
        if (this.state !== IncomingPeerRequestState.PENDING) {
            throw new Error('Cannot call accept() right now');
        }
        try {
            const {signal} = this.abortController;
            this.gateway.sendAndForget({
                type: GatewayMessageType.PEER_ACCEPT,
                peerIdentity: this.peerIdentity,
                connectionID: this.connectionID
            });
            const channel = new OTRChannel(this.gateway, this.myIdentity, this.peerIdentity, this.connectionID, false);
            this.setState(IncomingPeerRequestState.ACCEPTED);

            const onChannelStateChange = (): void => {
                switch (channel.state) {
                    case OTRChannelState.CONNECTED: {
                        this.setState(IncomingPeerRequestState.CONNECTED);
                        this.dispatchEvent(new IncomingPeerRequestConnectEvent(channel));
                        this.abortController.abort();
                        break;
                    }
                    case OTRChannelState.CLOSED: {
                        this.setState(IncomingPeerRequestState.CONNECTION_ERROR);
                        this.abortController.abort();
                        break;
                    }
                }
            };

            channel.addEventListener('statechange', onChannelStateChange, {signal});
        } catch (err) {
            this.setState(IncomingPeerRequestState.CONNECTION_ERROR);
        }
    }

    reject (): void {
        if (this.state !== IncomingPeerRequestState.PENDING) {
            throw new Error('Cannot call reject() right now');
        }

        this.gateway.sendAndForget({
            type: GatewayMessageType.PEER_REJECT,
            peerIdentity: this.peerIdentity,
            connectionID: this.connectionID
        });
        this.setState(IncomingPeerRequestState.REJECTED);
    }
}
