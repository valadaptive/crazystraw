import {EditMessage} from './edit-message';
import {Message} from './message';
import {Profile} from './profile';
import {RequestProfile} from './request-profile';
import {uuid} from './uuid';

export enum ChatDataType {
    MESSAGE,
    EDIT_MESSAGE,
    ACK,
    REQUEST_PROFILE,
    PROFILE,
}

export type ChatData = {
    id: uuid;
    type: ChatDataType;
    data: Message | EditMessage | RequestProfile | Profile;
};
