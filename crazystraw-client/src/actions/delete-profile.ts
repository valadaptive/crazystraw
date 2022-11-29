import {batch} from '@preact/signals';

import {AppState, ProfileState} from '../util/state';

const deleteProfile = (store: AppState): void => {
    batch(() => {
        store.profileState.value = ProfileState.NONEXISTENT;
        store.savedProfile.value = null;
        store.profile.value = null;
    });
};

export default deleteProfile;
