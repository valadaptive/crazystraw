import {Type} from 'avsc';

import {uid, AvroUid} from './uid';

export type Acknowledgement = {referencedID: uid};

export const AvroAcknowledgement = Type.forSchema(
    {
        name: 'Acknowledgement',
        type: 'record',
        fields: [{name: 'referencedID', type: 'uid'}]
    },
    {wrapUnions: true, registry: {uid: AvroUid}}
);
