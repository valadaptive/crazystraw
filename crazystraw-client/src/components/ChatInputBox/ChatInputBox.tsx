import style from './style.scss';
import type {JSX} from 'preact';
import {useMemo} from 'preact/hooks';
import {useComputed} from '@preact/signals';

import updateOutgoingMessageTextAction from '../../actions/update-outgoing-message-text';
import addOutgoingMessageAttachmentAction from '../../actions/add-outgoing-message-attachment';
import clearOutgoingMessageAction from '../../actions/clear-outgoing-message';
import addMessageAction from '../../actions/add-message';

import Icon from '../Icon/Icon';

import ChatAttachment from '../../rtc/attachment';

import {useAppState, useAction, ProfileState, OutgoingMessageContents} from '../../util/state';
import createFileUploadDialog from '../../util/create-file-upload-dialog';
import formatFileSize from '../../util/format-file-size';

const AttachmentPreview = ({attachment, attachments}: {
    attachment: ChatAttachment,
    attachments: OutgoingMessageContents['attachments']
}): JSX.Element => {
    const onRemove = useMemo(() => (): void => {
        attachments.value = attachments.value.filter(existingAttachment => existingAttachment !== attachment);
    }, [attachment, attachments]);

    return (
        <div className={style.attachment}>
            <div className={style.fileInfo}>
                <div className={style.filename}>{attachment.name}</div>
                <div className={style.filesize}>{formatFileSize(attachment.size)}</div>
            </div>
            <div className={style.removeAttachment}>
                <Icon type="x" title="Remove" onClick={onRemove} />
            </div>
        </div>
    );
};

const MAX_ROWS = 5;

const ChatInputBox = (): JSX.Element => {
    const {outgoingMessageContents, activeContact, openChannels, profileData} = useAppState();
    const updateOutgoingMessageText = useAction(updateOutgoingMessageTextAction);
    const addOutgoingMessageAttachment = useAction(addOutgoingMessageAttachmentAction);
    const addMessage = useAction(addMessageAction);
    const clearOutgoingMessage = useAction(clearOutgoingMessageAction);


    const contact = activeContact.value;
    const currentContents = contact ? outgoingMessageContents.value[contact] : undefined;
    const profile = profileData.value;
    const currentText = currentContents?.text.value ?? '';
    const channel = contact ? openChannels.value[contact].channel : null;

    const attachments = useComputed(() => {
        const contact = activeContact.value;
        const currentContents = contact ? outgoingMessageContents.value[contact] : undefined;
        const attachments = currentContents?.attachments;
        if (!attachments?.value.length) return null;
        return (
            <div className={style.attachments}>
                {attachments.value.map(attachment => (
                    <AttachmentPreview attachment={attachment} attachments={attachments} key={attachment.id} />
                ))}
            </div>
        );
    }).value;

    const onInput = (event: Event): void => {
        if (!contact) return;
        updateOutgoingMessageText(contact, (event.target as HTMLTextAreaElement).value);
    };

    const onKeyPress = (event: KeyboardEvent): void => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!contact || !currentContents || profile.state !== ProfileState.LOADED) return;

            void (async (): Promise<void> => {
                const channel = openChannels.value[contact].channel;
                const message = {
                    timestamp: Date.now(),
                    contents: currentText,
                    attachments: await Promise.all(currentContents.attachments.value.map(
                        attachment => attachment.toAvro()))
                };
                const id = channel.sendMessage(message);
                addMessage(id, profile.profile.identity.toBase64(), contact, message, false);
                clearOutgoingMessage(contact);
            })();
        }
    };

    const onAddAttachment = async (): Promise<void> => {
        if (!contact) return;
        const files = await createFileUploadDialog({multiple: true});
        if (!files) return;
        const attachments = await Promise.all(Array.from(files).map(file => ChatAttachment.fromFile(file)));
        for (const attachment of attachments) {
            addOutgoingMessageAttachment(contact, attachment);
        }
    };

    const box = <textarea
        className={style.textbox}
        value={currentText}
        onInput={onInput}
        onKeyPress={onKeyPress}
        disabled={!channel}
        rows={Math.min((currentText.match(/\n/g)?.length ?? 0) + 1, MAX_ROWS)}
    />;

    return <div className={style.chatInputBox}>
        {attachments}
        <div className={style.boxAndButtons}>
            <div className={style.buttons}>
                <Icon type="upload" title="Upload attachment(s)" onClick={onAddAttachment} />
            </div>
            {box}
        </div>
    </div>;
};

export default ChatInputBox;
