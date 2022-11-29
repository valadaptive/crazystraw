import type {AppState} from '../util/state';

import connectOutgoingPeerRequest from '../event-binding/outgoing-peer-request';

const createPeerRequest = (store: AppState, peerIdentity: string): void => {
    const gateway = store.gatewayConnection.value?.connection;
    if (!gateway) return;
    const request = gateway.makePeerRequest(peerIdentity);
    /*console.log(connection);
    connection.addEventListener('connect', event => {
        const {channel} = event;
        void channel.sendMessage(new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0xaa]).buffer).catch(console.error);
    }, {once: true});*/

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

export default createPeerRequest;
