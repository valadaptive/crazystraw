import {batch} from '@preact/signals';

import {AppState, ProfileState} from '../util/state';

const deleteProfile = (state: AppState): void => {
    batch(() => {
        state.profileState.value = ProfileState.NONEXISTENT;
        state.savedProfile.value = null;
        state.profile.value = null;
    });
};

export default deleteProfile;
