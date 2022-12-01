import type {AppState} from '../util/state';

import {signal, Signal} from '@preact/signals';

import {GatewayConnection, GatewayConnectionState} from '../rtc/gateway';

import createIncomingPeerRequest from '../actions/create-incoming-peer-request';

export type SignalizedGatewayConnection = {
    connection: GatewayConnection,
    state: Signal<GatewayConnectionState>,
    cleanup: () => void
};

const signalize = (store: AppState, connection: GatewayConnection): SignalizedGatewayConnection => {
    const abortController = new AbortController();
    const stateSignal = signal(connection.state);

    connection.addEventListener('statechange', event => {
        stateSignal.value = event.state;
    }, {signal: abortController.signal});

    connection.addEventListener('peerrequest', event => {
        createIncomingPeerRequest(store, event.request);
    }, {signal: abortController.signal});

    const cleanup = (): void => {
        connection.close();
        abortController.abort();
    };

    return {
        connection,
        state: stateSignal,
        cleanup
    };
};

export default signalize;
