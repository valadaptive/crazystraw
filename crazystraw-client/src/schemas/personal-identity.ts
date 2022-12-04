import {Type} from 'avsc';

export type PersonalIdentity = {
    privateKey: Buffer;
    publicKey: Buffer;
    salt: Buffer;
    iv: Buffer;
    data: null | {bytes: Buffer};
};

export const AvroPersonalIdentity = Type.forSchema(
    {
        name: 'PersonalIdentity',
        type: 'record',
        fields: [
            {name: 'privateKey', type: 'bytes'},
            {name: 'publicKey', type: 'bytes'},
            {name: 'salt', type: 'bytes'},
            {name: 'iv', type: 'bytes'},
            {name: 'data', type: ['null', 'bytes']}
        ]
    },
    {wrapUnions: true}
);
