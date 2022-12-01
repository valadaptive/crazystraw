import {PersonalProfile} from '../rtc/profile';
import {AppState, ProfileState} from '../util/state';

import setProfile from './set-profile';

const createProfile = async (
    store: AppState,
    profileData: {
        handle: string,
        avatar: Blob | null,
        bio: string | null
    },
    password: string
): Promise<void> => {
    store.profileData.value = {state: ProfileState.GENERATING};

    try {
        const profile = await PersonalProfile.create(profileData, password);
        setProfile(store, profile);
    } catch (err) {
        setProfile(store, null);
    }
};

export default createProfile;
