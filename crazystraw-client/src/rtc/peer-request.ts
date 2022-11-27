import {GatewayMessageType} from 'crazystraw-common/ws-types';

import {RTCChannel, RTCChannelState} from './channel';
import {GatewayConnection, GatewayConnectionMessageEvent} from './gateway';
import {Identity} from './identity';

import {TypedEventTarget, TypedEvent} from '../util/typed-events';

export const enum OutgoingPeerRequestState {
    /** The peer request is currently waiting for the peer to accept or reject it. */
    PENDING,
    /** The peer has accepted the peer request and we are negotiating over WebRTC. */
    ACCEPTED,
    /** We have connected with this peer over WebRTC. */
    CONNECTED,
    /** The peer has rejected the peer request. */
    REJECTED,
    /** The peer is offline right now. */
    PEER_OFFLINE,
    /** We cancelled the request. */
    CANCELLED,
    /** WebRTC could not connect. */
    WEBRTC_FAILED
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
    public channel: RTCChannel;
    constructor (channel: RTCChannel) {
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

    private peerIdentity: Identity;
    private gateway: GatewayConnection;
    private connectionID: string;
    private channel: RTCChannel | undefined;
    private abortController: AbortController;

    private setState (newState: OutgoingPeerRequestState): void {
        this.state = newState;
        this.dispatchEvent(new IncomingPeerRequestStateChangeEvent());
    }

    constructor (gateway: GatewayConnection, peerIdentity: Identity) {
        super();

        this.state = OutgoingPeerRequestState.PENDING;
        this.peerIdentity = peerIdentity;
        this.gateway = gateway;
        this.connectionID = crypto.randomUUID();
        this.abortController = new AbortController();
        const {signal} = this.abortController;

        const onMessage = (event: GatewayConnectionMessageEvent): void => {
            const {message} = event;

            if ('connectionID' in message && message.connectionID !== this.connectionID) return;

            if (message.type === GatewayMessageType.PEER_OFFLINE) {
                this.setState(OutgoingPeerRequestState.PEER_OFFLINE);
                this.abortController.abort();
                return;
            }

            if (message.type === GatewayMessageType.PEER_REQUEST_REJECTED) {
                this.setState(OutgoingPeerRequestState.REJECTED);
                this.abortController.abort();
                return;
            }


            if (message.type === GatewayMessageType.PEER_REQUEST_ACCEPTED) {
                this.setState(OutgoingPeerRequestState.ACCEPTED);
                this.gateway.removeEventListener('message', onMessage);
                // peer request accepted-- set up RTC channel
                const channel = new RTCChannel(this.gateway, this.peerIdentity, this.connectionID, false);
                this.channel = channel;

                const onChannelStateChange = (): void => {
                    switch (channel.state) {
                        case RTCChannelState.CONNECTED: {
                            this.setState(OutgoingPeerRequestState.CONNECTED);
                            this.dispatchEvent(new OutgoingPeerRequestConnectEvent(channel));
                            this.abortController.abort();
                            break;
                        }
                        case RTCChannelState.CLOSED: {
                            this.setState(OutgoingPeerRequestState.WEBRTC_FAILED);
                            this.abortController.abort();
                            break;
                        }
                    }
                };
                channel.addEventListener('statechange', onChannelStateChange, {signal});
                return;
            }
        };

        this.gateway.addEventListener('message', onMessage, {signal});

        this.gateway.send({
            type: GatewayMessageType.PEER_REQUEST,
            peerIdentity: this.peerIdentity.toBase64(),
            connectionID: this.connectionID
        });
    }

    cancel (): void {
        this.gateway.send({
            type: GatewayMessageType.PEER_REQUEST_CANCEL,
            peerIdentity: this.peerIdentity.toBase64(),
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
    /** WebRTC could not connect. */
    WEBRTC_FAILED
}

class IncomingPeerRequestStateChangeEvent extends TypedEvent<'statechange'> {
    constructor () {
        super('statechange');
    }
}

class IncomingPeerRequestConnectEvent extends TypedEvent<'connect'> {
    public channel: RTCChannel;
    constructor (channel: RTCChannel) {
        super('connect');
        this.channel = channel;
    }
}

export class IncomingPeerRequest extends TypedEventTarget<
IncomingPeerRequestStateChangeEvent |
IncomingPeerRequestConnectEvent
> {
    public state: IncomingPeerRequestState;
    public peerIdentityString: string;

    private gateway: GatewayConnection;
    private peerIdentity: Identity;
    private connectionID: string;
    private channel: RTCChannel | undefined;
    private abortController: AbortController;

    constructor (
        gateway: GatewayConnection,
        peerIdentity: Identity,
        peerIdentityString: string,
        connectionID: string
    ) {
        super();
        this.gateway = gateway;
        this.peerIdentity = peerIdentity;
        this.peerIdentityString = peerIdentityString;
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
            this.gateway.send({
                type: GatewayMessageType.PEER_ACCEPT,
                peerIdentity: this.peerIdentityString,
                connectionID: this.connectionID
            });
            const channel = new RTCChannel(this.gateway, this.peerIdentity, this.connectionID, true);
            this.channel = channel;
            this.setState(IncomingPeerRequestState.ACCEPTED);

            const onChannelStateChange = (): void => {
                switch (channel.state) {
                    case RTCChannelState.CONNECTED: {
                        this.setState(IncomingPeerRequestState.CONNECTED);
                        this.dispatchEvent(new IncomingPeerRequestConnectEvent(channel));
                        this.abortController.abort();
                        break;
                    }
                    case RTCChannelState.CLOSED: {
                        this.setState(IncomingPeerRequestState.WEBRTC_FAILED);
                        this.abortController.abort();
                        break;
                    }
                }
            };

            channel.addEventListener('statechange', onChannelStateChange, {signal});
        } catch (err) {
            this.setState(IncomingPeerRequestState.WEBRTC_FAILED);
        }
    }

    reject (): void {
        if (this.state !== IncomingPeerRequestState.PENDING) {
            throw new Error('Cannot call reject() right now');
        }

        this.gateway.send({
            type: GatewayMessageType.PEER_REJECT,
            peerIdentity: this.peerIdentityString,
            connectionID: this.connectionID
        });
        this.setState(IncomingPeerRequestState.REJECTED);
    }
}