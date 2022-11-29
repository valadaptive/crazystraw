import type {AppState} from '../util/state';

const closePeerRequest = (store: AppState, peerIdentity: string): void => {
    const {[peerIdentity]: removedRequest, ...otherRequests} = store.incomingRequests.value;
    removedRequest.cleanup();
    store.incomingRequests.value = otherRequests;
};

export default closePeerRequest;
