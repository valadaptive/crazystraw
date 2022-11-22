import {AppState} from '../util/state';

const closePeerRequest = (state: AppState, peerIdentity: string): void => {
    const {[peerIdentity]: __, ...otherRequests} = state.incomingRequests.value;
    state.incomingRequests.value = otherRequests;
};

export default closePeerRequest;
