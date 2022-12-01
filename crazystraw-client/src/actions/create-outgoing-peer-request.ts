import {AppState, ProfileState} from '../util/state';

import connectOutgoingPeerRequest from '../event-binding/outgoing-peer-request';

const createOutgoingPeerRequest = (store: AppState, peerIdentity: string): void => {
    if (store.profileData.value.state !== ProfileState.LOADED) return;
    const gateway = store.profileData.value.gatewayConnection.connection;
    const request = gateway.makePeerRequest(peerIdentity);

    const oldOutgoingRequests = store.outgoingRequests.value;

    const prevRequest = oldOutgoingRequests[request.peerIdentity];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (prevRequest) {
        prevRequest.cleanup();
    }

    store.outgoingRequests.value = {
        ...oldOutgoingRequests,
        [request.peerIdentity]: connectOutgoingPeerRequest(store, request)
    };
};

export default createOutgoingPeerRequest;
