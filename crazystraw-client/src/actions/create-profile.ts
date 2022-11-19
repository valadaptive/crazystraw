import {batch} from '@preact/signals';

import Identity from '../rtc/identity';
import Profile from '../rtc/profile';
import {AppState, ProfileState} from '../util/state';

const createProfile = async (
    state: AppState,
    profileData: {
        handle: string,
        avatar: Blob | null,
        bio: string | null
    },
    password: string
): Promise<void> => {
    state.profileState.value = ProfileState.GENERATING;

    try {
        const identity = await Identity.generate();
        const profile = new Profile(identity, profileData.handle, profileData.avatar, profileData.bio);
        const exportedProfile = await profile.export(password);
        batch(() => {
            state.profileState.value = ProfileState.LOADED;
            state.savedProfile.value = exportedProfile;
            state.profile.value = profile;
        });
    } catch (err) {
        state.profileState.value = ProfileState.NONEXISTENT;
    }
};

export default createProfile;
