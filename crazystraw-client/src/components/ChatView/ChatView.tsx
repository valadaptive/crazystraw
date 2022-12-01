import style from './style.scss';
import type {JSX} from 'preact';
import {useMemo, useState} from 'preact/hooks';

import setProfileAction from '../../actions/set-profile';

import ChatMessage from '../ChatMessage/ChatMessage';

import {useAppState, useAction, ProfileState} from '../../util/state';

const ChatView = (): JSX.Element => {
    const {chatMessages, activeContact} = useAppState();

    const activeContactMessages = activeContact.value ? chatMessages.value[activeContact.value] : undefined;

    const messages = useMemo(() => {
        if (!activeContactMessages) return null;
        const messages = [];
        for (let i = 0; i < activeContactMessages.length; i++) {
            const cur = activeContactMessages[i];
            const prev = i > 0 ? activeContactMessages[i - 1] : null;

            const shouldSplit = prev === null ||
                cur.timestamp - prev.timestamp > (60 * 5 * 1000) ||
                prev.from !== cur.from;
            
            messages.push(<ChatMessage message={cur} firstInChain={shouldSplit} key={cur.id} />);
        }
    }, [activeContactMessages]);

    return (
        <div className={style.chatView}>
            {messages}
        </div>
    );
};

export default ChatView;
