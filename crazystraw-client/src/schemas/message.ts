import {Type} from 'avsc';

import {Attachment, AvroAttachment} from './attachment';

export type Message = {
    timestamp: number;
    contents: string;
    attachments: Attachment[];
};

export const AvroMessage = Type.forSchema(
    {
        name: 'Message',
        type: 'record',
        fields: [
            {name: 'timestamp', type: 'long'},
            {name: 'contents', type: 'string'},
            {
                name: 'attachments',
                type: {type: 'array', items: 'Attachment'}
            }
        ]
    },
    {
        wrapUnions: true,
        registry: {Attachment: AvroAttachment}
    }
);
