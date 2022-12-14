import {Type} from 'avsc';

import {uid, AvroUid} from './uid';

export type Attachment = {
    id: uid;
    name: string;
    type: string;
    width: null | {int: number};
    height: null | {int: number};
    data: Buffer;
};

export const AvroAttachment = Type.forSchema(
    {
        name: 'Attachment',
        type: 'record',
        fields: [
            {name: 'id', type: 'uid'},
            {name: 'name', type: 'string'},
            {name: 'type', type: 'string'},
            {name: 'width', type: ['null', 'int']},
            {name: 'height', type: ['null', 'int']},
            {name: 'data', type: 'bytes'}
        ]
    },
    {wrapUnions: true, registry: {uid: AvroUid}}
);
