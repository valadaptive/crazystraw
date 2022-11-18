const hexToBytes = (hex: string): ArrayBuffer => {
    if (hex.length % 2 !== 0) {
        throw new Error('Hex string must be properly zero-aligned');
    }

    if (/[^0-9a-fA-F]/.test(hex)) {
        throw new Error('Invalid hex string');
    }

    const data = new Uint8Array(hex.length >>> 1);
    for (let i = 0; i < data.length; i++) {
        const slice = hex.slice(i << 1, (i << 1) + 1);
        data[i] = parseInt(slice, 16);
    }

    return data.buffer;
};

export default hexToBytes;
