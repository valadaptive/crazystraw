import type {AppState} from '../util/state';

import connectIncomingPeerRequest from '../event-binding/incoming-peer-request';

import {IncomingPeerRequest} from '../rtc/peer-request';

const createIncomingPeerRequest = (store: AppState, request: IncomingPeerRequest): void => {
    const oldIncomingRequests = store.incomingRequests.value;

    const prevRequest = oldIncomingRequests[request.peerIdentity];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (prevRequest) {
        prevRequest.cleanup();
    }

    store.incomingRequests.value = {
        ...oldIncomingRequests,
        [request.peerIdentity]: connectIncomingPeerRequest(store, request)
    };
};

export default createIncomingPeerRequest;
