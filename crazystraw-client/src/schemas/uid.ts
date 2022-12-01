import {Type} from 'avsc';

import {LogicalUid} from '../util/logical-types';

export type uid = string;

export const AvroUid = Type.forSchema(
    {
        name: 'uid',
        type: 'fixed',
        size: 16,
        logicalType: 'uid'
    },
    {wrapUnions: true, logicalTypes: {uid: LogicalUid}}
);
