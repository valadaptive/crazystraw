import type {AppState} from '../util/state';

import {signal, Signal} from '@preact/signals';

import {IncomingPeerRequest, IncomingPeerRequestState} from '../rtc/peer-request';

import closePeerRequest from '../actions/close-incoming-peer-request';
import createChannel from '../actions/create-channel';

export type SignalizedIncomingPeerRequest = {
    state: Signal<IncomingPeerRequestState>,
    request: IncomingPeerRequest,
    cleanup: () => void
};

const signalize = (store: AppState, request: IncomingPeerRequest): SignalizedIncomingPeerRequest => {
    const stateSignal = signal(request.state);
    const abortController = new AbortController();

    request.addEventListener('statechange', () => {
        stateSignal.value = request.state;

    }, {signal: abortController.signal});

    request.addEventListener('connect', event => {
        closePeerRequest(store, request.peerIdentity);
        createChannel(store, event.channel);
    }, {signal: abortController.signal});

    return {
        state: stateSignal,
        request,
        cleanup: () => abortController.abort()
    };
};

export default signalize;
