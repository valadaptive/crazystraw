import type {AppState} from '../util/state';

import {signal, Signal} from '@preact/signals';

import {OTRChannel, OTRChannelState} from '../rtc/otr';

export type SignalizedOTRChannel = {
    state: Signal<OTRChannelState>,
    channel: OTRChannel,
    cleanup: () => void
};

const signalize = (store: AppState, channel: OTRChannel): SignalizedOTRChannel => {
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
