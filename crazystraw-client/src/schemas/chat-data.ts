import {Type} from 'avsc';

import {
    Acknowledgement,
    AvroAcknowledgement
} from './acknowledgement';
import {EditMessage, AvroEditMessage} from './edit-message';
import {Message, AvroMessage} from './message';
import {Profile, AvroProfile} from './profile';
import {
    RequestProfile,
    AvroRequestProfile
} from './request-profile';
import {uuid, AvroUuid} from './uuid';

export type ChatData = {
    id: uuid;
    data:
    | {Message: Message}
    | {EditMessage: EditMessage}
    | {Acknowledgement: Acknowledgement}
    | {RequestProfile: RequestProfile}
    | {Profile: Profile};
};

export const AvroChatData = Type.forSchema(
    {
        name: 'ChatData',
        type: 'record',
        fields: [
            {name: 'id', type: 'uuid'},
            {
                name: 'data',
                type: [
                    'Message',
                    'EditMessage',
                    'Acknowledgement',
                    'RequestProfile',
                    'Profile'
                ]
            }
        ]
    },
    {
        wrapUnions: true,
        registry: {
            uuid: AvroUuid,
            Message: AvroMessage,
            EditMessage: AvroEditMessage,
            Acknowledgement: AvroAcknowledgement,
            RequestProfile: AvroRequestProfile,
            Profile: AvroProfile
        }
    }
);
