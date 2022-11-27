import {RTCChannel} from './channel';
import {GatewayConnection} from './gateway';
import {Identity} from './identity';

const enum MessageType {
    DH_COMMIT,
    DH_KEY,
    REVEAL_SIGNATURE,
    SIGNATURE
}

type CommitData = {
    x: CryptoKeyPair,
    r: CryptoKey
};

// https://otr.cypherpunks.ca/Protocol-v2-3.1.0.html
export class OTRChannel {
    private rtcChannel: RTCChannel;
    // TODO: use this when implementing close()
    private abortController: AbortController;

    constructor (gateway: GatewayConnection, peerIdentity: Identity, connectionID: string, initiating: boolean) {
        // The "polite" peer is the one receiving the connection
        this.rtcChannel = new RTCChannel(gateway, peerIdentity, connectionID, !initiating);
        this.abortController = new AbortController();
    }

    private async expectNextMessage (expectedMessageType: MessageType): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            this.rtcChannel.addEventListener('message', ({message}) => {
                const dv = new DataView(message);
                if (dv.getUint8(0) !== expectedMessageType) {
                    reject(new Error(`Expected message type to be ${expectedMessageType}, was ${dv.getUint8(0)}`));
                }

                resolve(message);
            }, {once: true, signal: this.abortController.signal});
        });
    }

    /**
     * Step 1 in the authenticated key exchange. This party generates a DH key and commits to it, without yet revealing
     * what that public key is.
     */
    private async sendCommitMessage (): Promise<void> {
        const x = await crypto.subtle.generateKey(
            {name: 'ECDH', namedCurve: 'P-256'},
            true,
            ['deriveBits', 'deriveKey']
        );
        const gx = x.publicKey;
        const gxmpi = await crypto.subtle.exportKey('raw', gx);

        const r = await crypto.subtle.generateKey({name: 'AES-CTR', length: 128}, true, ['encrypt', 'decrypt']);

        // TODO: store
        const commitData = {x, r};

        const encryptedGx = await crypto.subtle.encrypt(
            {name: 'AES-CTR', counter: new Uint8Array(16), length: 64},
            r,
            gxmpi
        );

        const hashGx = await crypto.subtle.digest('SHA-256', gxmpi);
    }

    private async sendDHKeyMessage (): Promise<void> {
        const y = await crypto.subtle.generateKey(
            {name: 'ECDH', namedCurve: 'P-256'},
            true,
            ['deriveBits', 'deriveKey']
        );
        const gy = y.publicKey;
    }

    private async sendRevealSignatureMessage (commitData: CommitData, peerKey: CryptoKey): Promise<void> {
        const sharedSecret = await crypto.subtle.deriveBits(
            {name: 'ECDH', public: peerKey},
            commitData.x.privateKey,
            128
        );


    }

    private async deriveInitialState (sharedSecret: ArrayBuffer): Promise<unknown> {
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
        const c = cFull.slice(0, 16);
        const cPrime = cFull.slice(16);

        // Let m1 be h2(0x02).
        const m1 = await countedHash(2);
        // Let m2 be h2(0x03).
        const m2 = await countedHash(3);
        // Let m1' be h2(0x04).
        const m1Prime = await countedHash(4);
        // Let m2' be h2(0x05).
        const m2Prime = await countedHash(5);

        return {
            ssid,
            c,
            cPrime,
            m1,
            m2,
            m1Prime,
            m2Prime
        };
    }
}
