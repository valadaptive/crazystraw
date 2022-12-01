import {Type} from 'avsc';

import {uid, AvroUid} from './uid';

export type EditMessage = {
    messageID: uid;
    newContents: string;
    timestamp: number;
};

export const AvroEditMessage = Type.forSchema(
    {
        name: 'EditMessage',
        type: 'record',
        fields: [
            {name: 'messageID', type: 'uid'},
            {name: 'newContents', type: 'string'},
            {name: 'timestamp', type: 'long'}
        ]
    },
    {wrapUnions: true, registry: {uid: AvroUid}}
);
