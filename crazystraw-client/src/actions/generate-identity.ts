import {signal, batch} from '@preact/signals';

import Identity from '../rtc/identity';
import Profile from '../rtc/profile';
import {AppState, UserDataState} from '../util/state';

const generateIdentity = async (
    state: AppState,
    profileData: {
        handle: string,
        avatar: Blob | null,
        bio: string | null
    },
    password: string
): Promise<void> => {
    state.userDataState.value = UserDataState.GENERATING;

    try {
        const identity = await Identity.generate();
        const profile = new Profile(identity, profileData.handle, profileData.avatar, profileData.bio);
        const exportedUserData = await profile.export(password);
        batch(() => {
            state.userDataState.value = UserDataState.LOADED;
            state.savedUserData.value = exportedUserData;
            state.userData.value = {profile: signal(profile), identity: signal(identity)};
        });
    } catch (err) {
        state.userDataState.value = UserDataState.NONEXISTENT;
    }
};

export default generateIdentity;
