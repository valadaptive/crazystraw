import {Type} from 'avsc';

export type Sha256 = ArrayBuffer;

export type RequestProfile = {
    previousHash: {null: null} | {Sha256: Sha256};
};

export const AvroSha256 = Type.forSchema(
    {name: 'Sha256', type: 'fixed', size: 32},
    {wrapUnions: true}
);

export const AvroRequestProfile = Type.forSchema(
    {
        name: 'RequestProfile',
        type: 'record',
        fields: [
            {
                name: 'previousHash',
                type: [
                    'null',
                    {
                        name: 'Sha256',
                        type: 'fixed',
                        size: 32
                    }
                ]
            }
        ]
    },
    {wrapUnions: true}
);
