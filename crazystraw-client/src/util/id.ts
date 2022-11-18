const buf = new Uint32Array(4);

/** Generate a random ID. */
const id = (): string => {
    crypto.getRandomValues(buf);
    let result = '';
    for (let i = 0; i < buf.length; i++) {
        result += buf[i].toString(16).padStart(8, '0');
    }
    return result;
};

export default id;
