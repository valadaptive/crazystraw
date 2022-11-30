import {Type} from 'avsc';

import {uuid, AvroUuid} from './uuid';

export type EditMessage = {
    messageID: uuid;
    newContents: string;
    timestamp: number;
};

export const AvroEditMessage = Type.forSchema(
    {
        name: 'EditMessage',
        type: 'record',
        fields: [
            {name: 'messageID', type: 'uuid'},
            {name: 'newContents', type: 'string'},
            {name: 'timestamp', type: 'long'}
        ]
    },
    {wrapUnions: true, registry: {uuid: AvroUuid}}
);
