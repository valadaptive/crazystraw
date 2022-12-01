import style from './style.scss';
import type {JSX} from 'preact';
import {useMemo, useState} from 'preact/hooks';
import {Signal, useComputed} from '@preact/signals';

import setProfileAction from '../../actions/set-profile';

import {useAppState, useAction, ProfileState, ChatMessage as MessageData, Contact} from '../../util/state';

const ChatMessage = ({message, firstInChain}: {
    message: MessageData,
    firstInChain: boolean
}): JSX.Element => {
    const {contacts, profileData} = useAppState();

    const profile = useComputed(() => {
        const contact = (contacts.value[message.from] as Signal<Contact> | undefined);
        if (contact) return contact.value.profile;
        if (profileData.value.state !== ProfileState.LOADED) return null;
        const myIdentity = profileData.value.profile.identity.toBase64();
        return myIdentity === message.from ? profileData.value.profile : null;
    }).value;

    return (
        <div className={style.message}>
            {firstInChain ?
                <div className={style.messageHeader}>
                    <div className={style.username}>{profile?.handle ?? 'Unknown user'}</div>
                </div> :
                null}
            <div className={style.contents}>{message.contents}</div>
        </div>
    );
};

export default ChatMessage;
