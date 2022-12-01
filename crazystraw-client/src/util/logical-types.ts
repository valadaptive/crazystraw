import {types} from 'avsc';
import {Buffer} from 'buffer';

import hexToBytes from './hex-to-bytes';
import bytesToHex from './bytes-to-hex';

export class LogicalUid extends types.LogicalType {
    _toValue (value: string): Buffer {
        return Buffer.from(hexToBytes(value));
    }

    _fromValue (value: Uint8Array): string {
        return bytesToHex(value);
    }
}
