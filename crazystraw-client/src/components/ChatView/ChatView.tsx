import style from './style.scss';
import type {JSX} from 'preact';
import {useMemo} from 'preact/hooks';

import ChatInputBox from '../ChatInputBox/ChatInputBox';
import ChatMessage from '../ChatMessage/ChatMessage';

import {useAppState} from '../../util/state';

const ChatView = (): JSX.Element => {
    const {chatMessages, activeContact} = useAppState();

    const activeContactMessages = activeContact.value ? chatMessages.value[activeContact.value]?.value : undefined;

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
        return messages;
    }, [activeContactMessages]);

    return (
        <div className={style.chatView}>
            <div className={style.messages}>
                {messages}
            </div>
            <div className={style.inputBox}>
                <ChatInputBox />
            </div>
        </div>
    );
};

export default ChatView;
