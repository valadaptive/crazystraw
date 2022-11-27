import {GatewayMessageType} from 'crazystraw-common/ws-types';

import {GatewayConnection, GatewayConnectionMessageEvent} from './gateway';
import {Identity} from './identity';

import {TypedEventTarget, TypedEvent} from '../util/typed-events';

export const enum RTCChannelState {
    /** The connection is being initialized. */
    CONNECTING,
    /** The connection is currently active. */
    CONNECTED,
    /** The connection is currently disconnected and attempting to reconnect. */
    DISCONNECTED,
    /** The connection has been closed, possibly due to an error. */
    CLOSED
}

export class RTCChannelStateChangeEvent extends TypedEvent<'statechange'> {
    constructor () {
        super('statechange');
    }
}

export class RTCChannel extends TypedEventTarget<RTCChannelStateChangeEvent> {
    public state: RTCChannelState;

    private gateway: GatewayConnection;
    private peerIdentity: Identity;
    private peerIdentityString: string;
    private connectionID: string;
    /** Used for cleanly removing all event listeners, preventing memory leaks */
    private abortController: AbortController;

    private polite: boolean;
    private connection: RTCPeerConnection;
    private makingOffer: boolean;
    private isSettingRemoteAnswerPending: boolean;
    private ignoreOffer: boolean;

    private channel: RTCDataChannel;

    constructor (gateway: GatewayConnection, peerIdentity: Identity, connectionID: string, polite: boolean) {
        super();

        this.state = RTCChannelState.CONNECTING;

        this.gateway = gateway;
        this.peerIdentity = peerIdentity;
        this.peerIdentityString = peerIdentity.toBase64();
        this.connectionID = connectionID;
        this.abortController = new AbortController();

        this.polite = polite;
        // TODO allow specifying ICE servers
        this.connection = new RTCPeerConnection({iceServers: [
            {urls: 'stun:stun.stunprotocol.org'}
        ]});

        this.makingOffer = false;
        this.isSettingRemoteAnswerPending = false;
        this.ignoreOffer = false;

        /**
         * "Perfect negotiation" implementation adapted from the WebRTC specification:
         * https://w3c.github.io/webrtc-pc/#perfect-negotiation-example
         */

        const {signal} = this.abortController;

        this.connection.addEventListener(
            'negotiationneeded',
            async (): Promise<void> => {
                try {
                    this.makingOffer = true;
                    await this.makeOfferOrAnswer();
                } catch (err) {
                    // TODO: handle errors
                } finally {
                    this.makingOffer = false;
                }
            },
            // Remove event listener when abort signal is fired in this.destroy()
            {signal}
        );

        this.connection.addEventListener(
            'icecandidate',
            (event: RTCPeerConnectionIceEvent): void => {
                if (!event.candidate) return;
                this.gateway.send({
                    type: GatewayMessageType.PEER_ICE_CANDIDATE,
                    peerIdentity: this.peerIdentityString,
                    connectionID: this.connectionID,
                    candidate: event.candidate
                });
            },
            {signal}
        );

        // TODO: this doesn't handle DTLS changes (like when the peer closes the connection).
        // Firefox doesn't support the regular connectionState property so this is the best cross-browser method.
        this.connection.addEventListener('iceconnectionstatechange', () => {
            const {iceConnectionState} = this.connection;
            if (iceConnectionState === 'closed' || iceConnectionState === 'failed') {
                // note to self: make sure to avoid feedback loops or double-firing events
                this.close();
                return;
            }
            if (iceConnectionState === 'disconnected') {
                this.setState(RTCChannelState.DISCONNECTED);
                return;
            }
            // Only set state to CONNECTED after reconnecting.
            // Otherwise we would set state to CONNECTED before the data channel is open.
            if (
                (iceConnectionState === 'connected' || iceConnectionState === 'completed') &&
                this.state === RTCChannelState.DISCONNECTED
            ) {
                this.setState(RTCChannelState.CONNECTED);
                return;
            }
        }, {signal});

        const onMessage = async (event: GatewayConnectionMessageEvent): Promise<void> => {
            const {message} = event;

            if ('connectionID' in message && message.connectionID !== this.connectionID) return;

            if (message.type === GatewayMessageType.GOT_PEER_MESSAGE_DESCRIPTION) {
                const {description} = message;
                const readyForOffer = !this.makingOffer &&
                    (this.connection.signalingState === 'stable' || this.isSettingRemoteAnswerPending);

                const offerCollision = description.type === 'offer' && !readyForOffer;

                this.ignoreOffer = !this.polite && offerCollision;
                if (this.ignoreOffer) return;

                this.isSettingRemoteAnswerPending = description.type === 'answer';
                await this.connection.setRemoteDescription(description);
                this.isSettingRemoteAnswerPending = false;
                if (description.type === 'offer') {
                    await this.makeOfferOrAnswer();
                }
                return;
            }

            if (message.type === GatewayMessageType.GOT_PEER_ICE_CANDIDATE) {
                try {
                    await this.connection.addIceCandidate(message.candidate);
                } catch (err) {
                    // Suppress ignored offer's candidates
                    if (!this.ignoreOffer) throw err;
                }
                return;
            }

            if (message.type === GatewayMessageType.PEER_OFFLINE) {
                // TODO: attempt to automatically reconnect?
                this.setState(RTCChannelState.CLOSED);
                this.abortController.abort();
            }
        };
        this.gateway.addEventListener('message', onMessage, {signal});

        this.channel = this.connection.createDataChannel('channel', {negotiated: true, id: 0});
        this.channel.addEventListener('open', () => {
            this.setState(RTCChannelState.CONNECTED);
        }, {signal, once: true});
    }

    public close (): void {
        // TODO: send message to peer to indicate that the channel is closing
        this.channel.close();
        this.connection.close();
        this.abortController.abort('Channel closed');
        this.setState(RTCChannelState.CLOSED);
    }

    private async makeOfferOrAnswer (): Promise<void> {
        // Sets local description to either an offer or a response, depending on the remote description
        await this.connection.setLocalDescription();
        this.gateway.send({
            type: GatewayMessageType.PEER_MESSAGE_DESCRIPTION,
            peerIdentity: this.peerIdentityString,
            connectionID: this.connectionID,
            description: this.connection.localDescription!
        });
    }


    private setState (newState: RTCChannelState): void {
        this.state = newState;
        this.dispatchEvent(new RTCChannelStateChangeEvent());
    }
}
