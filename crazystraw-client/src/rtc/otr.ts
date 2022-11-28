import {RTCChannel, RTCChannelState} from './channel';
import {GatewayConnection} from './gateway';
import {Identity, PersonalIdentity} from './identity';
import {encode, decode, DataType} from './otr-encoding';

import {TypedEventTarget, TypedEvent} from '../util/typed-events';

const enum MessageType {
    DH_COMMIT,
    DH_KEY,
    REVEAL_SIGNATURE,
    SIGNATURE,
    DATA
}

type CommitData = {
    x: CryptoKeyPair,
    r: CryptoKey
};

type SharedStatePerSide = {
    c: CryptoKey,
    m1: CryptoKey,
    m2: CryptoKey
};

type SharedInitialState = {
    ssid: ArrayBuffer,
    initiator: SharedStatePerSide,
    receiver: SharedStatePerSide
};

const encryptWithCounterZero = (key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> =>
    crypto.subtle.encrypt({name: 'AES-CTR', counter: new Uint8Array(16), length: 64}, key, data);

const decryptWithCounterZero = (key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> =>
    crypto.subtle.decrypt({name: 'AES-CTR', counter: new Uint8Array(16), length: 64}, key, data);

const importHMAC = (bits: ArrayBuffer): Promise<CryptoKey> =>
    crypto.subtle.importKey('raw', bits, {name: 'HMAC', hash: 'SHA-256'}, true, ['sign', 'verify']);

const importAES = (bits: ArrayBuffer): Promise<CryptoKey> =>
    crypto.subtle.importKey('raw', bits, {name: 'AES-CTR'}, true, ['encrypt', 'decrypt']);

/**
 * Compare two buffers for equality. Does *not* operate in constant time.
 * @param a The first buffer to compare
 * @param b The second buffer to compare
 * @returns true if the buffers are equal, false if they are not
 */
const buffersEqual = (a: ArrayBuffer, b: ArrayBuffer): boolean => {
    if (a.byteLength !== b.byteLength) return false;
    const aArr = new Uint8Array(a);
    const bArr = new Uint8Array(b);
    for (let i = 0, len = a.byteLength; i < len; i++) {
        if (aArr[i] !== bArr[i]) return false;
    }
    return true;
};

const cmpBuf = (a: ArrayBuffer, b: ArrayBuffer): number => {
    if (a.byteLength !== b.byteLength) throw new Error('Buffers of different sizes should not be compared');
    const aArr = new Uint8Array(a);
    const bArr = new Uint8Array(b);
    for (let i = 0, len = a.byteLength; i < len; i++) {
        if (aArr[i] > bArr[i]) return 1;
        if (aArr[i] < bArr[i]) return -1;
    }
    return 0;
};

const ECDH_PARAMS = {name: 'ECDH', namedCurve: 'P-256'} as const;
const ECDH_PUBKEY_SIZE = 65;

const schemas = {
    DH_COMMIT: [
        {type: DataType.BYTE},
        // TODO: determine the actual fixed size
        {type: DataType.VAR},
        {type: DataType.FIXED, size: 32}
    ],
    DH_KEY: [
        {type: DataType.BYTE},
        {type: DataType.FIXED, size: ECDH_PUBKEY_SIZE}
    ],
    SIGNATURE_DATA: [
        {type: DataType.FIXED, size: ECDH_PUBKEY_SIZE},
        {type: DataType.FIXED, size: ECDH_PUBKEY_SIZE},
        {type: DataType.FIXED, size: ECDH_PUBKEY_SIZE},
        {type: DataType.INT}
    ],
    SIGNATURE_X: [
        {type: DataType.FIXED, size: ECDH_PUBKEY_SIZE},
        {type: DataType.INT},
        // TODO: determine actual size
        {type: DataType.VAR}
    ],
    REVEAL_SIGNATURE: [
        {type: DataType.BYTE},
        {type: DataType.FIXED, size: 16},
        // TODO: determine actual size
        {type: DataType.VAR},
        {type: DataType.FIXED, size: 32}
    ],
    SIGNATURE: [
        {type: DataType.BYTE},
        {type: DataType.VAR},
        {type: DataType.FIXED, size: 32}
    ],
    DATA_MESSAGE_INNER: [
        {type: DataType.INT}, // sender keyid
        {type: DataType.INT}, // recipient keyid
        {type: DataType.FIXED, size: ECDH_PUBKEY_SIZE}, // sender's next public key
        {type: DataType.INT}, // counter
        {type: DataType.VAR} // encrypted message contents
    ],
    DATA_MESSAGE: [
        {type: DataType.BYTE},
        {type: DataType.VAR}, // encrypted data
        {type: DataType.FIXED, size: 32}, // SHA256-HMAC for encrypted data
        {type: DataType.VAR} // old MAC keys
    ]
} as const;

class OTRChannelStateChangeEvent extends TypedEvent<'statechange'> {
    constructor () {
        super('statechange');
    }
}

export const enum OTRChannelState {
    /** The connection is being initialized. */
    CONNECTING,
    /** We are authenticating with the peer. */
    AUTHENTICATING,
    /** The connection is authenticated and active. */
    CONNECTED,
    /** The connection is currently disconnected and attempting to reconnect. */
    DISCONNECTED,
    /** The connection has been closed, possibly due to an error. */
    CLOSED
}

type KeyWithBytes = {
    publicKey: CryptoKey,
    publicKeyBytes: ArrayBuffer
};

type KeyPairWithBytes = KeyWithBytes & {privateKey: CryptoKey};

type KeyState = {
    myPreviousKey: KeyPairWithBytes | null;
    myCurrentKey: KeyPairWithBytes;
    myKeyid: number;
    currentKeyAcknowledged: boolean;
    myPreviousCounter: number;
    myCurrentCounter: number;

    peerPreviousKey: KeyWithBytes | null;
    peerPreviousKeyid: number | null;
    peerCurrentKey: KeyWithBytes;
    peerCurrentKeyid: number;
    peerPreviousCounter: number;
    peerCurrentCounter: number;
};

// https://otr.cypherpunks.ca/Protocol-v2-3.1.0.html
export class OTRChannel extends TypedEventTarget<OTRChannelStateChangeEvent> {
    private rtcChannel: RTCChannel;
    // TODO: use this when implementing close()
    private abortController: AbortController;

    private myIdentity: PersonalIdentity;
    private peerIdentity: Identity;
    private keyState: KeyState | null;

    public state: OTRChannelState;

    constructor (
        gateway: GatewayConnection,
        myIdentity: PersonalIdentity,
        peerIdentity: Identity,
        connectionID: string,
        initiating: boolean
    ) {
        super();

        // The "polite" peer is the one receiving the connection
        this.rtcChannel = new RTCChannel(gateway, peerIdentity, connectionID, !initiating);
        this.abortController = new AbortController();

        this.myIdentity = myIdentity;
        this.peerIdentity = peerIdentity;
        // initialized during the AKE
        this.keyState = null;

        this.state = OTRChannelState.CONNECTING;

        void this.connect(initiating);
    }

    private setState (newState: OTRChannelState): void {
        this.state = newState;
        console.log('firing state change', newState);
        this.dispatchEvent(new OTRChannelStateChangeEvent());
    }

    public close (): void {
        this.abortController.abort();
        this.setState(OTRChannelState.CLOSED);
    }

    private async connect (initiating: boolean): Promise<void> {
        try {
            this.setState(OTRChannelState.CONNECTING);
            await new Promise<void>((resolve, reject) => {
                if (this.rtcChannel.state === RTCChannelState.CONNECTED) {
                    resolve();
                    return;
                }
                const onStateChange = (): void => {
                    if (this.rtcChannel.state === RTCChannelState.CONNECTED) {
                        this.rtcChannel.removeEventListener('statechange', onStateChange);
                        resolve();
                        return;
                    }
                    if (this.rtcChannel.state === RTCChannelState.CLOSED) {
                        this.rtcChannel.removeEventListener('statechange', onStateChange);
                        reject(new Error('Channel closed'));
                        return;
                    }
                };
                this.rtcChannel.addEventListener('statechange', onStateChange, {signal: this.abortController.signal});
            });

            this.setState(OTRChannelState.AUTHENTICATING);
            if (initiating) {
                await this.initiateKeyExchange();
            } else {
                await this.waitForKeyExchange();
            }
            this.setState(OTRChannelState.CONNECTED);

            this.rtcChannel.addEventListener('message', ({message}) => {
                const dv = new DataView(message);
                if (dv.getUint8(0) === MessageType.DATA) {
                    // TODO: handle errors
                    void this.onMessage(message);
                }
            }, {signal: this.abortController.signal});
        } catch (err) {
            this.close();
        }
    }

    private async expectNextMessage (expectedMessageType: MessageType): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            this.rtcChannel.addEventListener('message', ({message}) => {
                this.rtcChannel.removeEventListener('statechange', onStateChange);
                const dv = new DataView(message);
                if (dv.getUint8(0) !== expectedMessageType) {
                    reject(new Error(`Expected message type to be ${expectedMessageType}, was ${dv.getUint8(0)}`));
                }

                resolve(message);
            }, {once: true, signal: this.abortController.signal});

            const onStateChange = (): void => {
                if (this.rtcChannel.state === RTCChannelState.CLOSED) {
                    this.rtcChannel.removeEventListener('statechange', onStateChange);
                    reject(new Error('Channel closed'));
                }
            };
            this.rtcChannel.addEventListener('statechange', onStateChange, {signal: this.abortController.signal});
        });
    }

    private async initiateKeyExchange (): Promise<void> {
        // Generate a random ECDH keypair and AES symmetric key
        const x = await crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveBits', 'deriveKey']);
        const r = await crypto.subtle.generateKey({name: 'AES-CTR', length: 128}, true, ['encrypt', 'decrypt']);
        // Send the generated ECDH public key, encrypted with the random AES key
        await this.sendCommitMessage({x, r});
        const gxBytes = await crypto.subtle.exportKey('raw', x.publicKey);

        const peerKeyMessage = await this.expectNextMessage(MessageType.DH_KEY);
        const [, gyBytes] = decode(schemas.DH_KEY, peerKeyMessage);
        const gy = await crypto.subtle.importKey(
            'raw', gyBytes, ECDH_PARAMS, true, []);
        const sharedSecret = await crypto.subtle.deriveBits(
            {name: 'ECDH', public: gy},
            x.privateKey,
            128
        );
        const sharedState = await this.deriveInitialState(sharedSecret);

        const myKeyid = 2;
        await this.sendRevealSignatureMessage(sharedState, gxBytes, gyBytes, myKeyid, r);

        const signatureMessage = await this.expectNextMessage(MessageType.SIGNATURE);
        const [, encryptedXa, signatureMAC] = decode(schemas.SIGNATURE, signatureMessage);

        const peerKeyid = await this.verifySignature(
            encryptedXa,
            signatureMAC,
            sharedState.receiver,
            gyBytes,
            gxBytes
        );

        this.keyState = {
            myPreviousKey: null,
            myCurrentKey: {publicKey: x.publicKey, publicKeyBytes: gxBytes, privateKey: x.privateKey},
            myKeyid,
            currentKeyAcknowledged: true,
            myPreviousCounter: 0,
            myCurrentCounter: 1,

            peerPreviousKey: null,
            peerPreviousKeyid: null,
            peerCurrentKey: {publicKey: gy, publicKeyBytes: gyBytes},
            peerCurrentKeyid: peerKeyid,
            peerPreviousCounter: 0,
            peerCurrentCounter: 0
        };
    }

    private async waitForKeyExchange (): Promise<void> {
        const commitMessage = await this.expectNextMessage(MessageType.DH_COMMIT);
        const y = await crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveBits', 'deriveKey']);
        const gy = y.publicKey;
        const gyBytes = await crypto.subtle.exportKey('raw', gy);
        this.sendDHKeyMessage(gyBytes);
        const [, encryptedGx, hashGx] = decode(schemas.DH_COMMIT, commitMessage);

        const revealSignatureMessage = await this.expectNextMessage(MessageType.REVEAL_SIGNATURE);
        const [, rBytes, encryptedXb, signatureMAC] =
            decode(schemas.REVEAL_SIGNATURE, revealSignatureMessage);

        const r = await crypto.subtle.importKey(
            'raw', rBytes, {name: 'AES-CTR', length: 128}, true, ['encrypt', 'decrypt']);
        const gxBytes = await decryptWithCounterZero(r, encryptedGx);
        const ourHashGx = await crypto.subtle.digest('SHA-256', gxBytes);
        if (!buffersEqual(hashGx, ourHashGx)) throw new Error('gx hashes differ');

        const gx = await crypto.subtle.importKey('raw', gxBytes, ECDH_PARAMS, true, []);
        const sharedSecret = await crypto.subtle.deriveBits(
            {name: 'ECDH', public: gx},
            y.privateKey,
            128
        );

        const sharedState = await this.deriveInitialState(sharedSecret);

        const peerKeyid = await this.verifySignature(
            encryptedXb,
            signatureMAC,
            sharedState.initiator,
            gxBytes,
            gyBytes
        );

        const myKeyid = 2;
        await this.sendSignatureMessage(sharedState, gyBytes, gxBytes, myKeyid);

        this.keyState = {
            myPreviousKey: null,
            myCurrentKey: {publicKey: y.publicKey, publicKeyBytes: gyBytes, privateKey: y.privateKey},
            myKeyid,
            currentKeyAcknowledged: true,
            myPreviousCounter: 0,
            myCurrentCounter: 1,

            peerPreviousKey: null,
            peerPreviousKeyid: null,
            peerCurrentKey: {publicKey: gx, publicKeyBytes: gxBytes},
            peerCurrentKeyid: peerKeyid,
            peerPreviousCounter: 0,
            peerCurrentCounter: 0
        };
    }

    private async verifySignature (
        encryptedSignature: ArrayBuffer,
        signatureMAC: ArrayBuffer,
        {c, m1, m2}: SharedStatePerSide,
        gxBytes: ArrayBuffer,
        gyBytes: ArrayBuffer
    ): Promise<number> {
        const decryptedX = await decryptWithCounterZero(c, encryptedSignature);
        const [peerPublicKeyBytes, peerKeyid, mbSignature] = decode(schemas.SIGNATURE_X, decryptedX);
        if (!buffersEqual(peerPublicKeyBytes, this.peerIdentity.rawPublicKey)) throw new Error('Wrong public key');

        // TODO: should we verify keyid somehow?
        const sigData = encode(schemas.SIGNATURE_DATA, [gxBytes, gyBytes, peerPublicKeyBytes, peerKeyid]);
        const mb = await crypto.subtle.sign({name: 'HMAC', hash: 'SHA-256'}, m1, sigData);

        const mbSignatureValid = await this.peerIdentity.verify(mb, mbSignature);
        if (!mbSignatureValid) throw new Error('mb signature invalid');

        const macSignatureValid = await crypto.subtle.verify('HMAC', m2, signatureMAC, encryptedSignature);
        if (!macSignatureValid) throw new Error('MAC\'d signature invalid');

        return peerKeyid;
    }

    /**
     * Step 1 in the authenticated key exchange. Bob generates a DH key and commits to it, without yet revealing
     * what that public key is.
     */
    private async sendCommitMessage ({x, r}: CommitData): Promise<void> {
        const gxBytes = await crypto.subtle.exportKey('raw', x.publicKey);

        const encryptedGx = await encryptWithCounterZero(r, gxBytes);
        const hashGx = await crypto.subtle.digest('SHA-256', gxBytes);

        this.rtcChannel.send(encode(schemas.DH_COMMIT, [
            MessageType.DH_COMMIT,
            encryptedGx,
            hashGx
        ]));
    }

    /**
     * Step 2 in the authenticated key exchange. Alice generates their own DH key and sends the public key.
     */
    private sendDHKeyMessage (gyBytes: ArrayBuffer): void {
        this.rtcChannel.send(encode(schemas.DH_KEY, [
            MessageType.DH_KEY,
            gyBytes
        ]));
    }

    private async generateSignatureData (
        {c, m1, m2}: SharedStatePerSide,
        gxBytes: ArrayBuffer,
        gyBytes: ArrayBuffer,
        keyid: number
    ): Promise<{signature: ArrayBuffer, signatureMAC: ArrayBuffer}> {
        const signatureData = encode(schemas.SIGNATURE_DATA, [
            gxBytes,
            gyBytes,
            this.myIdentity.rawPublicKey,
            keyid
        ]);

        const m = await crypto.subtle.sign({name: 'HMAC', hash: 'SHA-256'}, m1, signatureData);

        const mSignature = await this.myIdentity.sign(m);

        const x = encode(schemas.SIGNATURE_X, [
            this.myIdentity.rawPublicKey,
            keyid,
            mSignature
        ]);

        const encryptedX = await encryptWithCounterZero(c, x);
        const signatureMAC = await crypto.subtle.sign({name: 'HMAC', hash: 'SHA-256'}, m2, encryptedX);

        return {signature: encryptedX, signatureMAC};
    }

    /**
     * Step 3 in the authenticated key exchange. Bob reveals the DH key he committed to earlier, and authenticates.
     * @param commitData Generated DH public key and AES key
     * @param peerKey Alice's generated DH public key
     */
    private async sendRevealSignatureMessage (
        state: SharedInitialState,
        gxBytes: ArrayBuffer,
        gyBytes: ArrayBuffer,
        keyid: number,
        r: CryptoKey
    ): Promise<void> {
        const {signature, signatureMAC} = await this.generateSignatureData(state.initiator, gxBytes, gyBytes, keyid);
        const rBytes = await crypto.subtle.exportKey('raw', r);

        this.rtcChannel.send(encode(schemas.REVEAL_SIGNATURE, [
            MessageType.REVEAL_SIGNATURE,
            rBytes,
            signature,
            signatureMAC
        ]));
    }

    /**
     * Step 4 in the authenticated key exchange. Alice sends authentication information to Bob.
     */
    private async sendSignatureMessage (
        state: SharedInitialState,
        gxBytes: ArrayBuffer,
        gyBytes: ArrayBuffer,
        keyid: number
    ): Promise<void> {
        const {signature, signatureMAC} = await this.generateSignatureData(state.receiver, gxBytes, gyBytes, keyid);

        this.rtcChannel.send(encode(schemas.SIGNATURE, [
            MessageType.SIGNATURE,
            signature,
            signatureMAC
        ]));
    }

    private async deriveInitialState (sharedSecret: ArrayBuffer): Promise<SharedInitialState> {
        // Initialize buffer to use once for all operations: first byte (varies per operation) followed by fixed shared
        // secret.
        const hashBuffer = new ArrayBuffer(sharedSecret.byteLength + 1);
        const hashArr = new Uint8Array(hashBuffer);
        hashArr.set(new Uint8Array(sharedSecret), 1);

        // "For a given byte b, define h2(b) to be the 256-bit output of the SHA256 hash of the (5+len) bytes
        // consisting of the byte b followed by secbytes."
        const countedHash = async (firstByte: number): Promise<ArrayBuffer> => {
            hashArr[0] = firstByte;
            return crypto.subtle.digest('SHA-256', hashBuffer);
        };

        // "Let ssid be the first 64 bits of h2(0x00)."
        const ssid = (await countedHash(0)).slice(0, 8);
        // "Let c be the first 128 bits of h2(0x01), and let c' be the second 128 bits of h2(0x01)."
        const cFull = await countedHash(1);
        const c = await importAES(cFull.slice(0, 16));
        const cPrime = await importAES(cFull.slice(16));

        // Let m1 be h2(0x02).
        const m1 = await countedHash(2).then(importHMAC);
        // Let m2 be h2(0x03).
        const m2 = await countedHash(3).then(importHMAC);
        // Let m1' be h2(0x04).
        const m1Prime = await countedHash(4).then(importHMAC);
        // Let m2' be h2(0x05).
        const m2Prime = await countedHash(5).then(importHMAC);

        return {
            ssid,
            initiator: {c, m1, m2},
            receiver: {c: cPrime, m1: m1Prime, m2: m2Prime}
        };
    }

    private async advanceMyKey (): Promise<void> {
        if (!this.keyState) throw new Error('Not yet authenticated');

        const nextKeyPair = await crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveBits', 'deriveKey']);
        const nextKeyBytes = await crypto.subtle.exportKey('raw', nextKeyPair.publicKey);
        const nextKey = {
            publicKey: nextKeyPair.publicKey,
            publicKeyBytes: nextKeyBytes,
            privateKey: nextKeyPair.privateKey
        };
        // TODO: gather and publish old MAC keys
        this.keyState.myPreviousKey = this.keyState.myCurrentKey;
        this.keyState.myCurrentKey = nextKey;
        // reset counter now that a new key has been generated
        this.keyState.myPreviousCounter = this.keyState.myCurrentCounter;
        this.keyState.myCurrentCounter = 1;
    }

    private advancePeerKey (newKey: KeyWithBytes, newKeyid: number): void {
        if (!this.keyState) throw new Error('Not yet authenticated');
        this.keyState.peerPreviousKey = this.keyState.peerCurrentKey;
        this.keyState.peerPreviousKeyid = this.keyState.peerCurrentKeyid;
        this.keyState.peerCurrentKey = newKey;
        this.keyState.peerCurrentKeyid = newKeyid;
    }

    public async sendMessage (data: ArrayBuffer): Promise<void> {
        if (!this.keyState) throw new Error('Not yet authenticated');
        const key = this.keyState.currentKeyAcknowledged ? this.keyState.myCurrentKey : this.keyState.myPreviousKey!;
        const keyid = this.keyState.currentKeyAcknowledged ? this.keyState.myKeyid : this.keyState.myKeyid - 1;

        // If most recent key was acknowledged, generate new key
        // TODO: do something with these!
        let nextKey: KeyPairWithBytes;
        if (this.keyState.currentKeyAcknowledged) {
            await this.advanceMyKey();
            nextKey = this.keyState.myCurrentKey;
        } else {
            nextKey = key;
        }

        const mostRecentPeerKey = this.keyState.peerCurrentKey;
        const mostRecentPeerKeyid = this.keyState.peerCurrentKeyid;
        const {
            sendingAESKeyBytes,
            sendingMACKeyBytes
        } = await this.deriveSharedMessageData(key, mostRecentPeerKey);

        console.log(new Uint32Array(sendingAESKeyBytes), new Uint32Array(sendingMACKeyBytes));

        const counter = this.keyState.counter;
        this.keyState.counter++;

        const sendingAESKey = await importAES(sendingAESKeyBytes);
        const sendingMACKey = await importHMAC(sendingMACKeyBytes);

        const encryptedData = await crypto.subtle.encrypt(
            {name: 'AES-CTR', counter: new Uint32Array([0, counter]), length: 64}, sendingAESKey, data);

        const messageData = encode(schemas.DATA_MESSAGE_INNER, [
            keyid, // sender keyid
            mostRecentPeerKeyid, // recipient keyid
            nextKey.publicKeyBytes, // sender's next public key
            counter, // counter
            encryptedData // encrypted message contents,
        ]);

        const authenticator = await crypto.subtle.sign({name: 'HMAC', hash: 'SHA-256'}, sendingMACKey, messageData);

        const fullData = encode(schemas.DATA_MESSAGE, [
            MessageType.DATA,
            messageData,
            authenticator,
            new ArrayBuffer(0) // TODO: collect old MAC keys
        ]);

        this.rtcChannel.send(fullData);
    }

    private async onMessage (message: ArrayBuffer): Promise<void> {
        if (!this.keyState) throw new Error('Not yet authenticated');
        const [, inner, hmac, oldMACKeys] = decode(schemas.DATA_MESSAGE, message);
        const [senderKeyid, recipientKeyid, senderNextKeyBytes, counter, encryptedData] =
            decode(schemas.DATA_MESSAGE_INNER, inner);

        // TODO: not sure if this should be done before or after the counter check
        // for now, doing it before everything else
        // TODO: what about previous key?
        this.keyState.peerCounter = counter;

        if (senderKeyid !== this.keyState.peerCurrentKeyid && senderKeyid !== this.keyState.peerPreviousKeyid) {
            throw new Error('Sender key too old');
        }
        if (recipientKeyid !== this.keyState.myKeyid && recipientKeyid !== this.keyState.myKeyid - 1) {
            throw new Error('Recipient key too old');
        }

        const senderKey = senderKeyid === this.keyState.peerCurrentKeyid ?
            this.keyState.peerCurrentKey :
            this.keyState.peerPreviousKey!;
        const recipientKey = recipientKeyid === this.keyState.myKeyid ?
            this.keyState.myCurrentKey :
            this.keyState.myPreviousKey!;

        const {
            receivingAESKeyBytes,
            receivingMACKeyBytes
        } = await this.deriveSharedMessageData(recipientKey, senderKey);

        console.log(new Uint32Array(receivingAESKeyBytes), new Uint32Array(receivingMACKeyBytes));

        const receivingAESKey = await importAES(receivingAESKeyBytes);
        const receivingMACKey = await importHMAC(receivingMACKeyBytes);

        const verified = await crypto.subtle.verify('HMAC', receivingMACKey, hmac, inner);
        if (!verified) throw new Error('HMAC verification failed');

        if (counter <= this.keyState.peerCounter) throw new Error('Counter too low');

        const decryptedMessage = await crypto.subtle.decrypt(
            {name: 'AES-CTR', counter: new Uint32Array([0, counter]), length: 64}, receivingAESKey, encryptedData);

        console.log(decryptedMessage);
    }

    private async deriveSharedMessageData (privateKey: KeyPairWithBytes, publicKey: KeyWithBytes): Promise<{
        sendingAESKeyBytes: ArrayBuffer,
        receivingAESKeyBytes: ArrayBuffer,
        sendingMACKeyBytes: ArrayBuffer,
        receivingMACKeyBytes: ArrayBuffer
    }> {
        const sharedSecret = await crypto.subtle.deriveBits(
            {name: 'ECDH', public: publicKey.publicKey},
            privateKey.privateKey,
            128
        );

        const hashBuffer = new ArrayBuffer(sharedSecret.byteLength + 1);
        const hashArr = new Uint8Array(hashBuffer);
        hashArr.set(new Uint8Array(sharedSecret), 1);

        // We're using SHA-256 instead of SHA-1 because SHA-1 is broken
        const countedHash = async (firstByte: number): Promise<ArrayBuffer> => {
            hashArr[0] = firstByte;
            return crypto.subtle.digest('SHA-256', hashBuffer);
        };

        // "Alice (and similarly for Bob) determines if she is the "low" end or the "high" end of this Data Message. If
        // Alice's public key is numerically greater than Bob's public key, then she is the "high" end. Otherwise, she
        // is the "low" end. Note that who is the "low" end and who is the "high" end can change every time a new D-H
        // public key is exchanged in a Data Message."
        const isHighEnd = cmpBuf(privateKey.publicKeyBytes, publicKey.publicKeyBytes) > 0;

        const sendByte = isHighEnd ? 1 : 2;
        const recvByte = isHighEnd ? 2 : 1;

        const sendingAESKeyBytes = (await countedHash(sendByte)).slice(0, 16);
        const receivingAESKeyBytes = (await countedHash(recvByte)).slice(0, 16);

        const sendingMACKeyBytes = await crypto.subtle.digest('SHA-256', sendingAESKeyBytes);
        const receivingMACKeyBytes = await crypto.subtle.digest('SHA-256', receivingAESKeyBytes);

        return {
            sendingAESKeyBytes,
            receivingAESKeyBytes,
            sendingMACKeyBytes,
            receivingMACKeyBytes
        };
    }
}
