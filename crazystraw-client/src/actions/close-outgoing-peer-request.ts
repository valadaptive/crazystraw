import type {AppState} from '../util/state';

const closePeerRequest = (store: AppState, peerIdentity: string): void => {
    const {[peerIdentity]: removedRequest, ...otherRequests} = store.outgoingRequests.value;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (removedRequest) {
        removedRequest.cleanup();
        store.outgoingRequests.value = otherRequests;
    }
};

export default closePeerRequest;
