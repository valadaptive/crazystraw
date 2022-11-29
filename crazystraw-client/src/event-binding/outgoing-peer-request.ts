import type {AppState} from '../util/state';

import {signal, Signal} from '@preact/signals';

import {OutgoingPeerRequest, OutgoingPeerRequestState} from '../rtc/peer-request';

import closePeerRequest from '../actions/close-outgoing-peer-request';
import createChannel from '../actions/create-channel';

export type SignalizedOutgoingPeerRequest = {
    state: Signal<OutgoingPeerRequestState>,
    request: OutgoingPeerRequest,
    cleanup: () => void
};

const signalize = (store: AppState, request: OutgoingPeerRequest): SignalizedOutgoingPeerRequest => {
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
