import {signal} from '@preact/signals';

import type {AppState, ChatMessage, ChatAttachment} from '../util/state';
import {idToTimestamp} from '../util/id';

import type {Message} from '../schemas/message';

const addMessage = (store: AppState, id: string, from: string, message: Message, pending: boolean): void => {
    const messages = store.chatMessages.value[from]?.slice(0) ?? [];

    const timestamp = idToTimestamp(id);
    const addedMessage: ChatMessage = {
        id,
        timestamp,
        from,
        contents: message.contents,
        attachments: message.attachments.map((attachment): ChatAttachment => {
            return {
                id: attachment.id,
                name: attachment.name,
                width: attachment.width ? attachment.width.int : null,
                height: attachment.height ? attachment.height.int : null,
                data: new Blob([attachment.data])
            };
        }),
        pending: signal(pending)
    };


    for (let i = messages.length; i > 0; i--) {
        if (idToTimestamp(messages[i].id) <= timestamp || i === 0) {
            messages.splice(i, 0, addedMessage);
            break;
        }
    }

    store.chatMessages.value[from] = messages;
};

export default addMessage;
