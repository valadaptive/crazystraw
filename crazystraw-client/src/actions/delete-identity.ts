import {AppState, ProfileState} from '../util/state';

const deleteIdentity = (store: AppState): void => {
    if (store.profileData.value.state === ProfileState.LOADED) {
        store.profileData.value.gatewayConnection.cleanup();
    }
    store.profileData.value = {state: ProfileState.NONEXISTENT};
};

export default deleteIdentity;
