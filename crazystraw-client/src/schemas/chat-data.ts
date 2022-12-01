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
import {uid, AvroUid} from './uid';

export type ChatData = {
    id: uid;
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
            {name: 'id', type: 'uid'},
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
            uid: AvroUid,
            Message: AvroMessage,
            EditMessage: AvroEditMessage,
            Acknowledgement: AvroAcknowledgement,
            RequestProfile: AvroRequestProfile,
            Profile: AvroProfile
        }
    }
);
