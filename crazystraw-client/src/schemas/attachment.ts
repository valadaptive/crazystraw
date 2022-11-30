import {Type} from 'avsc';

import {uuid, AvroUuid} from './uuid';

export type Attachment = {
    id: uuid;
    name: string;
    width: {null: null} | {number: number};
    height: {null: null} | {number: number};
    data: ArrayBuffer;
};

export const AvroAttachment = Type.forSchema(
    {
        name: 'Attachment',
        type: 'record',
        fields: [
            {name: 'id', type: 'uuid'},
            {name: 'name', type: 'string'},
            {name: 'width', type: ['null', 'int']},
            {name: 'height', type: ['null', 'int']},
            {name: 'data', type: 'bytes'}
        ]
    },
    {wrapUnions: true, registry: {uuid: AvroUuid}}
);
