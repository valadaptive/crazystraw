import {batch} from '@preact/signals';

import {PersonalProfile} from '../rtc/profile';
import {AppState, ProfileState} from '../util/state';

const importProfile = (store: AppState, profile: PersonalProfile, savedProfile: string): void => {
    batch(() => {
        store.profileState.value = ProfileState.LOADED;
        store.savedProfile.value = savedProfile;
        store.profile.value = profile;
    });
};

export default importProfile;
