import {AppState, ProfileState} from '../util/state';

const importSavedProfile = (store: AppState, savedProfile: string): void => {
    const previousProfileData = store.profileData.peek();

    // Clean up previous gateway connection
    if (previousProfileData.state === ProfileState.LOADED) {
        previousProfileData.gatewayConnection.cleanup();
    }

    store.profileData.value = {
        state: ProfileState.SAVED_BUT_NOT_LOADED,
        savedProfile
    };
};

export default importSavedProfile;
