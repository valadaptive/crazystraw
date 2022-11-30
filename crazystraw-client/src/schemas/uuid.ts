import {Type} from 'avsc';

import {LogicalUuid} from '../util/logical-types';

export type uuid = string;

export const AvroUuid = Type.forSchema(
    {
        name: 'uuid',
        type: 'fixed',
        size: 16,
        logicalType: 'uuid'
    },
    {wrapUnions: true, logicalTypes: {uuid: LogicalUuid}}
);
