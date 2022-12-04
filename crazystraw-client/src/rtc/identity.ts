import {fromByteArray} from 'base64-js';
import {Buffer} from 'buffer';

import {PersonalIdentity as PersonalIdentityStructure, AvroPersonalIdentity} from '../schemas/personal-identity';

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
    /** ECDSA private key, for signing messages and verifying identity. */
    public privateKey: CryptoKey;
    /** Secret AES key, for encrypting and decrypting profile-associated data. */
    private importExportKey: CryptoKey;
    /** Random parameters used to derive import/export key. */
    private aesParams: {salt: Uint8Array, iv: Uint8Array};

    private constructor (
        publicKey: CryptoKey,
        privateKey: CryptoKey,
        importExportKey: CryptoKey,
        aesParams: PersonalIdentity['aesParams'],
        rawPublicKey: Uint8Array,
        publicKeyFingerprint: Uint8Array
    ) {
        super(publicKey, rawPublicKey, publicKeyFingerprint);
        this.privateKey = privateKey;
        this.importExportKey = importExportKey;
        this.aesParams = aesParams;
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

    async export (associatedData: Uint8Array | null): Promise<Uint8Array> {
        const {salt, iv} = this.aesParams;
        const wrappedPrivateKey = await crypto.subtle.wrapKey(
            'pkcs8',
            this.privateKey,
            this.importExportKey,
            {name: 'AES-GCM', iv}
        );

        const dataStruct: PersonalIdentityStructure = {
            privateKey: Buffer.from(wrappedPrivateKey),
            publicKey: Buffer.from(this.rawPublicKey),
            salt: Buffer.from(salt),
            iv: Buffer.from(iv),
            data: associatedData ? {bytes: Buffer.from(associatedData)} : null
        };

        const exportedData = AvroPersonalIdentity.toBuffer(dataStruct);

        return new Uint8Array(exportedData);
    }

    static async import (data: Uint8Array, password: string): Promise<{
        identity: PersonalIdentity,
        data: Uint8Array | null
    }> {
        const dataStruct = AvroPersonalIdentity.fromBuffer(Buffer.from(data)) as PersonalIdentityStructure;

        const decryptedPrivateKey = await PersonalIdentity.deriveKeyFromPassword(password, dataStruct.salt);

        const privateKey = await crypto.subtle.unwrapKey(
            'pkcs8',
            dataStruct.privateKey,
            decryptedPrivateKey,
            {name: 'AES-GCM', iv: dataStruct.iv},
            ECDSA_PARAMS,
            true,
            ['sign']);

        const publicKey = await crypto.subtle.importKey(
            'raw',
            dataStruct.publicKey,
            ECDSA_PARAMS,
            true,
            ['verify']
        );

        const fingerprint = await crypto.subtle.digest('SHA-256', dataStruct.publicKey);

        return {
            identity: new PersonalIdentity(
                publicKey,
                privateKey,
                decryptedPrivateKey,
                {salt: dataStruct.salt, iv: dataStruct.iv},
                dataStruct.publicKey,
                new Uint8Array(fingerprint.slice(0, 16))
            ),
            data: dataStruct.data?.bytes ?? null
        };
    }

    static async generate (password: string): Promise<PersonalIdentity> {
        const keyPair = await crypto.subtle.generateKey(ECDSA_PARAMS, true, ['sign', 'verify']);
        const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const fingerprint = await crypto.subtle.digest('SHA-256', rawPublicKey);
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const importExportKey = await PersonalIdentity.deriveKeyFromPassword(password, salt);
        return new PersonalIdentity(
            keyPair.publicKey,
            keyPair.privateKey,
            importExportKey,
            {salt, iv},
            new Uint8Array(rawPublicKey),
            new Uint8Array(fingerprint.slice(0, 16))
        );
    }
}
