import {GatewayMessageType} from 'crazystraw-common/ws-types';

import {GatewayConnection, GatewayConnectionMessageEvent} from './gateway';

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

export class RTCChannelMessageEvent extends TypedEvent<'message'> {
    public message: ArrayBuffer;
    constructor (message: ArrayBuffer) {
        super('message');
        this.message = message;
    }
}

export class RTCChannel extends TypedEventTarget<
RTCChannelStateChangeEvent |
RTCChannelMessageEvent
> {
    public state: RTCChannelState;

    private gateway: GatewayConnection;
    private peerIdentity: string;
    private connectionID: string;
    /** Used for cleanly removing all event listeners, preventing memory leaks */
    private abortController: AbortController;

    private polite: boolean;
    private connection: RTCPeerConnection;
    private makingOffer: boolean;
    private isSettingRemoteAnswerPending: boolean;
    private ignoreOffer: boolean;

    private channel: RTCDataChannel;

    private static HEADER_SIZE = 6;

    constructor (gateway: GatewayConnection, peerIdentity: string, connectionID: string, polite: boolean) {
        super();

        this.state = RTCChannelState.CONNECTING;

        this.gateway = gateway;
        this.peerIdentity = peerIdentity;
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
                // TODO: make sure this is robust when reconnecting to gateway
                this.gateway.sendAndForget({
                    type: GatewayMessageType.PEER_ICE_CANDIDATE,
                    peerIdentity: this.peerIdentity,
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


        this.channel = this.connection.createDataChannel('channel', {
            negotiated: true,
            id: 0,
            ordered: true
        });
        this.channel.binaryType = 'arraybuffer';

        this.channel.addEventListener('open', () => {
            this.setState(RTCChannelState.CONNECTED);
        }, {signal, once: true});

        // Messages are ordered and reliable, so we can reassemble them in order
        let currentMessageChunks: Uint8Array[] | null = null;
        let currentMessageNumChunks = 0;
        let currentMessageTotalSize = 0;
        let currentMessageChunkSize = 0;
        this.channel.addEventListener('message', event => {
            try {
                const message = event.data as unknown;
                if (!(message instanceof ArrayBuffer)) throw new Error('Message must be an ArrayBuffer');
                const dv = new DataView(message);
                const messageIndex = dv.getUint16(0, true);
                const totalMessageSize = dv.getUint32(2, true);

                if (messageIndex === 0) {
                    if (currentMessageChunks !== null) throw new Error('Previous message not cleared yet');
                    currentMessageTotalSize = totalMessageSize;
                    if (message.byteLength === totalMessageSize + RTCChannel.HEADER_SIZE) {
                        // This is the only message chunk
                        this.dispatchEvent(new RTCChannelMessageEvent(message.slice(RTCChannel.HEADER_SIZE)));
                    } else {
                        // There are more message chunks to follow. Store them.
                        const maxMessageSize = message.byteLength;
                        currentMessageChunkSize = maxMessageSize - RTCChannel.HEADER_SIZE;
                        currentMessageNumChunks = Math.ceil(totalMessageSize / currentMessageChunkSize);

                        currentMessageChunks = [new Uint8Array(message, RTCChannel.HEADER_SIZE)];
                    }
                } else {
                    if (currentMessageChunks === null || messageIndex !== currentMessageChunks.length) {
                        throw new Error('Previous message chunks not received in order');
                    }
                    if (messageIndex >= currentMessageNumChunks) throw new Error('Message index out of bounds');
                    if (currentMessageTotalSize !== totalMessageSize) {
                        throw new Error('Message size disagrees with previous given size');
                    }

                    currentMessageChunks.push(new Uint8Array(message, RTCChannel.HEADER_SIZE));

                    if (currentMessageChunks.length === currentMessageNumChunks) {
                        // TODO: allow negotiation of max message size at this layer to prevent denial of service by
                        // using up all memory
                        const assembledBuffer = new Uint8Array(totalMessageSize);
                        for (let i = 0; i < currentMessageNumChunks; i++) {
                            assembledBuffer.set(currentMessageChunks[i], i * currentMessageChunkSize);
                        }
                        this.dispatchEvent(new RTCChannelMessageEvent(assembledBuffer.buffer));
                        currentMessageChunks = null;
                    }
                }
            } catch (err) {
                // Close connection: protocol error
                this.close();
            }

        }, {signal});
    }

    public async send (data: ArrayBuffer): Promise<void> {
        if (!(data instanceof ArrayBuffer)) throw new Error('Data must be an ArrayBuffer instance');
        if (this.channel.readyState !== 'open') throw new Error('Channel is not open');

        // Split message up into multiple smaller messages which all fit over the SCTP channel
        const maxMessageSize = this.connection.sctp?.maxMessageSize;
        if (!maxMessageSize) throw new Error('SCTP max message size not present');

        const chunkDataSize = maxMessageSize - RTCChannel.HEADER_SIZE;
        // TODO: may lose floating point precision?
        const numChunks = Math.ceil(data.byteLength / chunkDataSize);

        const messageBuffer = new ArrayBuffer(Math.min(maxMessageSize, data.byteLength + RTCChannel.HEADER_SIZE));
        const dv = new DataView(messageBuffer);
        dv.setUint32(2, data.byteLength, true);
        const messageArr = new Uint8Array(messageBuffer, RTCChannel.HEADER_SIZE);

        for (let i = 0; i < numChunks; i++) {
            if (this.channel.bufferedAmount > this.channel.bufferedAmountLowThreshold) {
                await new Promise<void>((resolve, reject) => {
                    const onBufferedAmountLow = (): void => {
                        resolve();
                        this.channel.removeEventListener('bufferedamountlow', onBufferedAmountLow);
                        this.channel.removeEventListener('close', onClose);
                    };
                    const onClose = (): void => {
                        reject();
                        this.channel.removeEventListener('bufferedamountlow', onBufferedAmountLow);
                        this.channel.removeEventListener('close', onClose);
                    };
                    this.channel.addEventListener(
                        'bufferedamountlow',
                        onBufferedAmountLow,
                        {signal: this.abortController.signal}
                    );
                    this.channel.addEventListener(
                        'close',
                        onClose,
                        {signal: this.abortController.signal}
                    );
                });
            }
            dv.setUint16(0, i, true);
            const remainder = data.byteLength - (i * chunkDataSize);
            messageArr.set(new Uint8Array(data, i * chunkDataSize, Math.min(chunkDataSize, remainder)));
            if (i === numChunks - 1) {
                const last = new Uint8Array(messageBuffer, 0, remainder + RTCChannel.HEADER_SIZE);
                this.channel.send(last);
            } else {
                this.channel.send(messageBuffer);
            }
        }
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
        // TODO: make sure this is robust when reconnecting to gateway
        this.gateway.sendAndForget({
            type: GatewayMessageType.PEER_MESSAGE_DESCRIPTION,
            peerIdentity: this.peerIdentity,
            connectionID: this.connectionID,
            description: this.connection.localDescription!
        });
    }


    private setState (newState: RTCChannelState): void {
        this.state = newState;
        this.dispatchEvent(new RTCChannelStateChangeEvent());
    }
}
