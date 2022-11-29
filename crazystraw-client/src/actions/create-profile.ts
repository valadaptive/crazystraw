import {batch} from '@preact/signals';

import {PersonalIdentity} from '../rtc/identity';
import {PersonalProfile} from '../rtc/profile';
import {AppState, ProfileState} from '../util/state';

const createProfile = async (
    store: AppState,
    profileData: {
        handle: string,
        avatar: Blob | null,
        bio: string | null
    },
    password: string
): Promise<void> => {
    store.profileState.value = ProfileState.GENERATING;

    try {
        const identity = await PersonalIdentity.generate();
        const profile = new PersonalProfile(identity, profileData.handle, profileData.avatar, profileData.bio);
        const exportedProfile = await profile.export(password);
        batch(() => {
            store.profileState.value = ProfileState.LOADED;
            store.savedProfile.value = exportedProfile;
            store.profile.value = profile;
        });
    } catch (err) {
        store.profileState.value = ProfileState.NONEXISTENT;
    }
};

export default createProfile;
