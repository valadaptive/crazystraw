import {Type} from 'avsc';

export type Profile = {
    handle: string;
    bio: string;
    avatar: ArrayBuffer;
};

export const AvroProfile = Type.forSchema(
    {
        name: 'Profile',
        type: 'record',
        fields: [
            {name: 'handle', type: 'string'},
            {name: 'bio', type: 'string'},
            {name: 'avatar', type: 'bytes'}
        ]
    },
    {wrapUnions: true}
);
