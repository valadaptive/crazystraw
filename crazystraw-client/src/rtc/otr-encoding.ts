import type {TaggedUnion} from '../util/tagged-union';

export const enum DataType {
    BYTE,
    SHORT,
    INT,
    VAR,
    FIXED
}

type MessageSchemaPart = TaggedUnion<DataType, {
    [DataType.BYTE]: {}
    [DataType.SHORT]: {}
    [DataType.INT]: {}
    [DataType.VAR]: {}
    [DataType.FIXED]: {size: number}
}>;

export const encode = <Schema extends readonly MessageSchemaPart[]>(
    schema: Schema, data: Decoded<Schema>): ArrayBuffer => {
    const partLengths = [];
    for (let i = 0; i < schema.length; i++) {
        const part = schema[i];
        switch (part.type) {
            case DataType.BYTE:
                partLengths.push(1);
                break;
            case DataType.SHORT:
                partLengths.push(2);
                break;
            case DataType.INT:
                partLengths.push(4);
                break;
            case DataType.VAR:
                partLengths.push((data[i] as ArrayBuffer).byteLength + 4);
                break;
            case DataType.FIXED:
                partLengths.push(part.size);
                break;
        }
    }
    const totalLength = partLengths.reduce((prev, cur) => prev + cur, 0);
    const dstBuffer = new ArrayBuffer(totalLength);
    const dstArr = new Uint8Array(dstBuffer);
    const dstView = new DataView(dstBuffer);
    let offset = 0;
    for (let i = 0; i < schema.length; i++) {
        const part = schema[i];
        const {type} = part;
        const itemData = data[i];
        switch (type) {
            case DataType.BYTE: {
                dstView.setUint8(offset, itemData as number);
                break;
            }
            case DataType.SHORT: {
                dstView.setUint16(offset, itemData as number);
                break;
            }
            case DataType.INT: {
                dstView.setUint32(offset, itemData as number);
                break;
            }
            case DataType.VAR: {
                dstView.setUint32(offset, (itemData as ArrayBuffer).byteLength);
                dstArr.set(new Uint8Array(itemData as ArrayBuffer), offset + 4);
                break;
            }
            case DataType.FIXED: {
                if ((itemData as ArrayBuffer).byteLength !== part.size) {
                    throw new Error(`Incorrect fixed-length message size (wanted ${part.size}, got ${(itemData as ArrayBuffer).byteLength})`);
                }
                dstArr.set(new Uint8Array(itemData as ArrayBuffer), offset);
                break;
            }
        }
        offset += partLengths[i];
    }

    return dstBuffer;
};

type DecodedPart<T extends DataType> = T extends (DataType.BYTE | DataType.SHORT | DataType.INT) ? number : ArrayBuffer;

type Decoded<Schema extends readonly MessageSchemaPart[]> = {
    [K in keyof Schema]: DecodedPart<Schema[K]['type']>
};

/*
type Decoded<Schema extends readonly MessageSchemaPart[]> = {
    [K in keyof Schema & number as Schema[K]['field']]: DecodedPart<Schema[K]['type']>
};
*/

export const decode = <Schema extends readonly MessageSchemaPart[]>(
    partSchema: Schema, message: ArrayBuffer): Decoded<Schema> => {
    const decodedParts = [];
    const dv = new DataView(message);

    let offset = 0;
    for (const schemaPart of partSchema) {
        switch (schemaPart.type) {
            case DataType.BYTE: {
                decodedParts.push(dv.getUint8(offset));
                offset++;
                break;
            }
            case DataType.SHORT: {
                decodedParts.push(dv.getUint16(offset));
                offset += 2;
                break;
            }
            case DataType.INT: {
                decodedParts.push(dv.getUint32(offset));
                offset += 4;
                break;
            }
            case DataType.VAR: {
                const size = dv.getUint32(offset);
                decodedParts.push(message.slice(offset + 4, offset + 4 + size));
                offset += 4 + size;
                break;
            }
            case DataType.FIXED: {
                decodedParts.push(message.slice(offset, offset + schemaPart.size));
                offset += schemaPart.size;
            }
        }
    }

    return decodedParts as Decoded<Schema>;
};
