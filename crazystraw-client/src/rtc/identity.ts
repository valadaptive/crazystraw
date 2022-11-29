import {toByteArray, fromByteArray} from 'base64-js';

const ECDSA_PARAMS = {name: 'ECDSA', namedCurve: 'P-256'};

export class Identity {
    /** The identity's public key. Can be used to verify messages signed by this person. */
    public publicKey: CryptoKey;

    /** The identity's public key in raw export form. Sent over the wire frequently. */
    public rawPublicKey: Uint8Array;
    /**
     * The identity's public key fingerprint--the leftmost 128 bits of the raw key's SHA-256 hash
     * (as hashed in binary form, not base64).
     * This *should* be secure--any attacker must find a second preimage, not merely a collision, as the public keys are
     * randomly generated in-browser and hence the fingerprints are random too.
     */
    public publicKeyFingerprint: Uint8Array;

    protected constructor (
        publicKey: CryptoKey,
        rawPublicKey: Uint8Array,
        publicKeyFingerprint: Uint8Array
    ) {
        if (publicKeyFingerprint.byteLength !== 16) throw new Error('Public key fingerprint must be 16 bytes');
        this.publicKey = publicKey;
        this.rawPublicKey = rawPublicKey;
        this.publicKeyFingerprint = publicKeyFingerprint;
    }

    async verify (data: BufferSource, signature: BufferSource): Promise<boolean> {
        return crypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, this.publicKey, signature, data);
    }

    static async fromPublicKey (rawKey: ArrayBuffer): Promise<Identity> {
        const publicKey = await crypto.subtle.importKey(
            'raw',
            rawKey,
            ECDSA_PARAMS,
            true,
            ['verify']
        );

        const fingerprint = await crypto.subtle.digest('SHA-256', rawKey);
        return new Identity(publicKey, new Uint8Array(rawKey), new Uint8Array(fingerprint.slice(0, 16)));
    }

    toBase64 (): string {
        return fromByteArray(this.publicKeyFingerprint);
    }

    toJSON (): never {
        throw new Error('Cannot convert Identity to JSON.');
    }
}

export class PersonalIdentity extends Identity {
    public privateKey: CryptoKey;

    private constructor (
        publicKey: CryptoKey,
        privateKey: CryptoKey,
        rawPublicKey: Uint8Array,
        publicKeyFingerprint: Uint8Array
    ) {
        super(publicKey, rawPublicKey, publicKeyFingerprint);
        this.privateKey = privateKey;
    }

    private static async deriveKeyFromPassword (password: string, salt: ArrayBuffer): Promise<CryptoKey> {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        const wrapUnwrapKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                hash: 'SHA-256',
                salt,
                iterations: 100000
            },
            keyMaterial,
            {name: 'AES-GCM', length: 256},
            true,
            ['wrapKey', 'unwrapKey']
        );

        return wrapUnwrapKey;
    }

    async sign (data: ArrayBuffer | ArrayBufferView | DataView): Promise<ArrayBuffer> {
        return crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, this.privateKey, data);
    }

    async export (password: string): Promise<{
        privateKey: string,
        publicKey: string,
        salt: string,
        iv: string
    }> {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const wrappingKey = await PersonalIdentity.deriveKeyFromPassword(password, salt);

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const wrappedPrivateKey = await crypto.subtle.wrapKey(
            'pkcs8',
            this.privateKey,
            wrappingKey,
            {name: 'AES-GCM', iv}
        );

        const exportedPublicKey = await crypto.subtle.exportKey('raw', this.publicKey);

        return {
            privateKey: fromByteArray(new Uint8Array(wrappedPrivateKey)),
            publicKey: fromByteArray(new Uint8Array(exportedPublicKey)),
            salt: fromByteArray(salt),
            iv: fromByteArray(iv)
        };
    }

    static async import (json: Partial<Record<string, unknown>>, password: string): Promise<PersonalIdentity> {
        const {privateKey: privateKeyStr, publicKey: publicKeyStr, salt: saltStr, iv: ivStr} = json;
        if (
            typeof privateKeyStr !== 'string' ||
            typeof publicKeyStr !== 'string' ||
            typeof saltStr !== 'string' ||
            typeof ivStr !== 'string'
        ) {
            throw new Error('Invalid JSON');
        }

        const encryptedPrivateKey = toByteArray(privateKeyStr);
        const importedPublicKey = toByteArray(publicKeyStr);
        const salt = toByteArray(saltStr);
        const iv = toByteArray(ivStr);

        const unwrappingKey = await PersonalIdentity.deriveKeyFromPassword(password, salt);

        const privateKey = await crypto.subtle.unwrapKey(
            'pkcs8',
            encryptedPrivateKey,
            unwrappingKey,
            {name: 'AES-GCM', iv},
            ECDSA_PARAMS,
            true,
            ['sign']);

        const publicKey = await crypto.subtle.importKey(
            'raw',
            importedPublicKey,
            ECDSA_PARAMS,
            true,
            ['verify']
        );

        const fingerprint = await crypto.subtle.digest('SHA-256', importedPublicKey);

        return new PersonalIdentity(
            publicKey,
            privateKey,
            importedPublicKey,
            new Uint8Array(fingerprint.slice(0, 16))
        );
    }

    static async generate (): Promise<PersonalIdentity> {
        const keyPair = await crypto.subtle.generateKey(ECDSA_PARAMS, true, ['sign', 'verify']);
        const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const fingerprint = await crypto.subtle.digest('SHA-256', rawPublicKey);
        return new PersonalIdentity(
            keyPair.publicKey,
            keyPair.privateKey,
            new Uint8Array(rawPublicKey),
            new Uint8Array(fingerprint.slice(0, 16))
        );
    }
}
