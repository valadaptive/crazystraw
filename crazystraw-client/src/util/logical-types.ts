import {types} from 'avsc';
import {Buffer} from 'buffer';

import hexToBytes from './hex-to-bytes';
import bytesToHex from './bytes-to-hex';

export class LogicalUuid extends types.LogicalType {
    _toValue (value: string): Buffer {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][[0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
            throw new Error('Invalid UUID');
        }
        const dashless = value.replace(/-/g, '');
        return Buffer.from(hexToBytes(dashless));
    }

    _fromValue (value: Uint8Array): string {
        if ((value[6] >>> 4) !== 4 || (value[8] >>> 6) !== 2) {
            throw new Error('Not a v4 UUID');
        }
        const data = bytesToHex(value);
        return `${data.slice(0, 8)}-${data.slice(8, 12)}-${data.slice(12, 16)}-${data.slice(16, 20)}-${data.slice(20)}`;
    }
}
