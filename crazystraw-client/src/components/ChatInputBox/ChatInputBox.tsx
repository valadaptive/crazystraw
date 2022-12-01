import style from './style.scss';
import type {JSX} from 'preact';
import {useComputed} from '@preact/signals';

import updateOutgoingMessageContentsAction from '../../actions/update-outgoing-message-contents';
import addMessageAction from '../../actions/add-message';

import {useAppState, useAction, ProfileState} from '../../util/state';

const ChatInputBox = (): JSX.Element => {
    const {outgoingMessageContents, activeContact, openChannels, profileData} = useAppState();
    const updateOutgoingMessageContents = useAction(updateOutgoingMessageContentsAction);
    const addMessage = useAction(addMessageAction);

    const onInput = useComputed(() => {
        const contact = activeContact.value;
        return (event: Event): void => {
            if (!contact) return;
            updateOutgoingMessageContents(contact, (event.target as HTMLTextAreaElement).value);
        };
    });

    const onKeyPress = useComputed(() => {
        const contact = activeContact.value;
        const currentContents = contact ? outgoingMessageContents.value[contact]?.value : undefined;
        const profile = profileData.value;
        return (event: KeyboardEvent): void => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (!contact || !currentContents || profile.state !== ProfileState.LOADED) return;

                const channel = openChannels.value[contact].channel;
                const message = {
                    timestamp: Date.now(),
                    contents: currentContents,
                    attachments: []
                };
                const id = channel.sendMessage(message);
                addMessage(id, profile.profile.identity.toBase64(), contact, message, false);
                updateOutgoingMessageContents(contact, '');

            }
        };
    });

    const box = useComputed(() => {
        const contact = activeContact.value;
        const currentContents = contact ? outgoingMessageContents.value[contact]?.value : undefined;
        const channel = contact ? openChannels.value[contact].channel : null;
        return <textarea
            className={style.textbox}
            value={currentContents ?? ''}
            onInput={onInput.value}
            onKeyPress={onKeyPress.value}
            disabled={!channel}
        />;
    }).value;

    return box;
};

export default ChatInputBox;
