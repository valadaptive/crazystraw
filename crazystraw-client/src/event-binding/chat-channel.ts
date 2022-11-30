import type {AppState} from '../util/state';

import {signal, Signal} from '@preact/signals';

import {ChatChannel, ChatChannelState} from '../rtc/chat';

export type SignalizedChatChannel = {
    state: Signal<ChatChannelState>,
    channel: ChatChannel,
    cleanup: () => void
};

const signalize = (store: AppState, channel: ChatChannel): SignalizedChatChannel => {
    const stateSignal = signal(channel.state);
    const abortController = new AbortController();

    channel.addEventListener('statechange', () => {
        stateSignal.value = channel.state;
    }, {signal: abortController.signal});

    return {
        state: stateSignal,
        channel,
        cleanup: () => abortController.abort()
    };
};

export default signalize;
