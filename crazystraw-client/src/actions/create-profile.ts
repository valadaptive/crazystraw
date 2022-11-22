import {batch} from '@preact/signals';

import {PersonalIdentity} from '../rtc/identity';
import {PersonalProfile} from '../rtc/profile';
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
        const identity = await PersonalIdentity.generate();
        const profile = new PersonalProfile(identity, profileData.handle, profileData.avatar, profileData.bio);
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
