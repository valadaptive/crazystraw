import {Type} from 'avsc';

import {uid, AvroUid} from './uid';

export type Profile = {
    id: uid;
    handle: string;
    bio: null | {string: string};
    avatar: null | {bytes: Buffer};
};

export const AvroProfile = Type.forSchema(
    {
        name: 'Profile',
        type: 'record',
        fields: [
            {name: 'id', type: 'uid'},
            {name: 'handle', type: 'string'},
            {name: 'bio', type: ['null', 'string']},
            {name: 'avatar', type: ['null', 'bytes']}
        ]
    },
    {wrapUnions: true, registry: {uid: AvroUid}}
);
