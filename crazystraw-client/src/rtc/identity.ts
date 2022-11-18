import {toByteArray, fromByteArray} from 'base64-js';

const ECDSA_PARAMS = {name: 'ECDSA', namedCurve: 'P-256'};

class Identity {
    public publicKey: CryptoKey;
    public privateKey: CryptoKey;

    public rawPublicKey: Uint8Array;
    public publicKeyFingerprint: Uint8Array;

    private constructor (
        publicKey: CryptoKey,
        privateKey: CryptoKey,
        rawPublicKey: Uint8Array,
        publicKeyFingerprint: Uint8Array
    ) {
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.rawPublicKey = rawPublicKey;
        this.publicKeyFingerprint = publicKeyFingerprint;
    }

    async sign (data: ArrayBuffer | ArrayBufferView | DataView): Promise<ArrayBuffer> {
        return crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, this.privateKey, data);
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
                iterations: 10000
            },
            keyMaterial,
            {name: 'AES-GCM', length: 256},
            true,
            ['wrapKey', 'unwrapKey']
        );

        return wrapUnwrapKey;
    }

    async export (password: string): Promise<{
        privateKey: string,
        publicKey: string,
        salt: string,
        iv: string
    }> {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const wrappingKey = await Identity.deriveKeyFromPassword(password, salt);

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

    async import (json: string, password: string): Promise<Identity> {
        const parsedJson = JSON.parse(json) as Partial<Record<string, unknown>>;
        const {privateKey: privateKeyStr, publicKey: publicKeyStr, salt: saltStr, iv: ivStr} = parsedJson;
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

        const unwrappingKey = await Identity.deriveKeyFromPassword(password, salt);

        const privateKey = await crypto.subtle.unwrapKey(
            'pkcs8',
            encryptedPrivateKey,
            unwrappingKey,
            {name: 'AES-GCM', iv},
            ECDSA_PARAMS,
            true,
            ['sign', 'verify']);

        const publicKey = await crypto.subtle.importKey(
            'raw',
            importedPublicKey,
            ECDSA_PARAMS,
            true,
            ['sign', 'verify']
        );

        const fingerprint = await crypto.subtle.digest('SHA-256', importedPublicKey);

        return new Identity(publicKey, privateKey, new Uint8Array(importedPublicKey), new Uint8Array(fingerprint));
    }

    static async generate (): Promise<Identity> {
        const keyPair = await crypto.subtle.generateKey(ECDSA_PARAMS, true, ['sign', 'verify']);
        const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const fingerprint = await crypto.subtle.digest('SHA-256', rawPublicKey);
        return new Identity(
            keyPair.publicKey,
            keyPair.privateKey,
            new Uint8Array(rawPublicKey),
            new Uint8Array(fingerprint)
        );
    }
}

export default Identity;
