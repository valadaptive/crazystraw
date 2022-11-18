const bytesToHex = (bytes: ArrayBuffer | Uint8Array): string => {
    const dv = new DataView('buffer' in bytes ? bytes.buffer : bytes);
    let result = '';
    for (let i = 0; i < dv.byteLength; i++) {
        const byte = dv.getUint8(i);
        if (byte < 16) result += '0';
        result += byte.toString(16);
    }
    return result;
};

export default bytesToHex;
