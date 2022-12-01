import {signal} from '@preact/signals';

import type {AppState, ChatMessage, ChatAttachment} from '../util/state';
import {idToTimestamp} from '../util/id';

import type {Message} from '../schemas/message';

const addMessage = (
    store: AppState,
    id: string,
    from: string,
    channel: string,
    message: Message,
    pending: boolean
): void => {
    let dstMessagesSignal = store.chatMessages.value[channel];
    const messages = dstMessagesSignal?.value.slice(0) ?? [];
    if (!dstMessagesSignal) {
        dstMessagesSignal = signal([]);
        store.chatMessages.value = {...store.chatMessages.value, [channel]: dstMessagesSignal};
    }

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

    for (let i = Math.max(0, messages.length - 1); i >= 0; i--) {
        if (i === 0 || idToTimestamp(messages[i].id) <= timestamp) {
            messages.splice(i + 1, 0, addedMessage);
            break;
        }
    }

    dstMessagesSignal.value = messages;
};

export default addMessage;
