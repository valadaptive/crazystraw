import {signal} from '@preact/signals';

import ChatAttachment from '../rtc/attachment';

import {AppState} from '../util/state';

const addOutgoingMessageAttachment = (store: AppState, identity: string, attachment: ChatAttachment): void => {
    const existingContents = store.outgoingMessageContents.value[identity];
    if (existingContents) {
        existingContents.attachments.value = [...existingContents.attachments.value, attachment];
        return;
    }

    store.outgoingMessageContents.value = {...store.outgoingMessageContents.value,
        [identity]: {
            text: signal(''),
            attachments: signal([attachment])
        }};
};

export default addOutgoingMessageAttachment;
