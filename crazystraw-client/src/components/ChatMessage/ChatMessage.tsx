import style from './style.scss';
import type {JSX} from 'preact';
import {useComputed} from '@preact/signals';

import Attachment from '../Attachment/Attachment';
import Avatar from '../Avatar/Avatar';

import setViewedProfileAction from '../../actions/set-viewed-profile';

import {useAppState, useAction, ProfileState, ChatMessage as MessageData} from '../../util/state';

const ChatMessage = ({message, firstInChain}: {
    message: MessageData,
    firstInChain: boolean
}): JSX.Element => {
    const {contacts, profileData} = useAppState();
    const setViewedProfile = useAction(setViewedProfileAction);

    const profile = useComputed(() => {
        const contact = contacts.value[message.from];
        if (contact) return contact.value.profile;
        if (profileData.value.state !== ProfileState.LOADED) return null;
        const myIdentity = profileData.value.identity.toBase64();
        return myIdentity === message.from ? profileData.value.profile.value : null;
    }).value;

    return (
        <div className={style.message}>
            {firstInChain ?
                <div className={style.messageHeader}>
                    <div className={style.avatar}><Avatar size={48} data={profile?.avatar ?? null} /></div>
                    <div className={style.username} onClick={(): void => setViewedProfile(message.from)}>
                        {profile?.handle ?? 'Unknown user'}
                    </div>
                </div> :
                null}
            <div className={style.contents}>{message.contents}</div>
            {message.attachments.length ?
                <div className={style.attachments}>
                    {message.attachments.map(attachment => <Attachment attachment={attachment} key={attachment.id} />)}
                </div> :
                null}
        </div>
    );
};

export default ChatMessage;
