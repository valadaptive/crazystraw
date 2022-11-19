import {batch} from '@preact/signals';

import Profile from '../rtc/profile';
import {AppState, ProfileState} from '../util/state';

const importProfile = (state: AppState, profile: Profile, savedProfile: string): void => {
    batch(() => {
        state.profileState.value = ProfileState.LOADED;
        state.savedProfile.value = savedProfile;
        state.profile.value = profile;
    });
};

export default importProfile;
