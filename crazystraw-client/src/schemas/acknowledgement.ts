import {Type} from 'avsc';

import {uuid, AvroUuid} from './uuid';

export type Acknowledgement = {referencedID: uuid};

export const AvroAcknowledgement = Type.forSchema(
    {
        name: 'Acknowledgement',
        type: 'record',
        fields: [{name: 'referencedID', type: 'uuid'}]
    },
    {wrapUnions: true, registry: {uuid: AvroUuid}}
);
