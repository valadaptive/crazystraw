import {Type} from 'avsc';

export type Profile = {
    handle: string;
    bio: null | {string: string};
    avatar: null | {bytes: ArrayBuffer};
};

export const AvroProfile = Type.forSchema(
    {
        name: 'Profile',
        type: 'record',
        fields: [
            {name: 'handle', type: 'string'},
            {name: 'bio', type: ['null', 'string']},
            {name: 'avatar', type: ['null', 'bytes']}
        ]
    },
    {wrapUnions: true}
);
