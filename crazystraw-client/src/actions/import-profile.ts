import {batch} from '@preact/signals';

import {PersonalProfile} from '../rtc/profile';
import {AppState, ProfileState} from '../util/state';

const importProfile = (state: AppState, profile: PersonalProfile, savedProfile: string): void => {
    batch(() => {
        state.profileState.value = ProfileState.LOADED;
        state.savedProfile.value = savedProfile;
        state.profile.value = profile;
    });
};

export default importProfile;
