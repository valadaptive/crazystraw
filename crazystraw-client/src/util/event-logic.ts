import {signal, effect} from '@preact/signals';

import {AppState} from './state';

import {GatewayConnection, GatewayConnectionStateChangeEvent} from '../rtc/gateway';

const CONNECTION_SERVER = 'ws://localhost:9876';

const setupEventLogic = (store: AppState): () => void => {
    const cleanups: (() => void)[] = [];

    // Close the old connection when the profile changes or is deleted
    cleanups.push(effect(() => {
        const prevGatewayConnection = store.gatewayConnection.peek();
        if (store.profile.value) {
            if (prevGatewayConnection) prevGatewayConnection.cleanup();
            const newConnection = new GatewayConnection(CONNECTION_SERVER, store.profile.value.identity);
            const stateSignal = signal(newConnection.state);
            const onStateChange = (event: GatewayConnectionStateChangeEvent): void => {
                stateSignal.value = event.state;
            };
            newConnection.addEventListener('statechange', onStateChange as EventListener);
            const cleanup = (): void => {
                newConnection.close();
                newConnection.removeEventListener('statechange', onStateChange as EventListener);
            };
            store.gatewayConnection.value = {
                connection: newConnection,
                state: stateSignal,
                cleanup
            };
        } else if (prevGatewayConnection) {
            prevGatewayConnection.cleanup();
            store.gatewayConnection.value = null;
        }
    }));

    cleanups.push(effect(() => {
        const connection = store.gatewayConnection.value?.connection;
        if (!connection) return;
        connection.addEventListener('peerrequest', event => {
            console.log(event);
            const {request} = event;
            const oldIncomingRequests = store.incomingRequests.value;
            const requestStateSignal = signal(request.state);
            store.incomingRequests.value = {
                ...oldIncomingRequests,
                [request.peerIdentityString]: {
                    request,
                    state: requestStateSignal
                }};

            request.addEventListener('statechange', () => {
                requestStateSignal.value = request.state;
            });
        });
    }));

    return () => cleanups.forEach(cleanupFunction => cleanupFunction());
};

export default setupEventLogic;
