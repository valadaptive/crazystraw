import {Type} from 'avsc';

import {uid, AvroUid} from './uid';

export type RequestProfile = {
    previousID: null | {uid: uid};
};

export const AvroRequestProfile = Type.forSchema(
    {
        name: 'RequestProfile',
        type: 'record',
        fields: [
            {name: 'previousID', type: ['null', 'uid']}
        ]
    },
    {wrapUnions: true, registry: {uid: AvroUid}}
);
