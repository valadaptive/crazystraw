import Profile from '../rtc/profile';

import {AppState, ProfileState} from '../util/state';

const setProfile = (store: AppState, profile: Profile): void => {
    if (store.profileData.value.state !== ProfileState.LOADED) {
        throw new Error('Profile data not loaded');
    }

    store.profileData.value.profile.value = profile;

    for (const signalizedChannel of Object.values(store.openChannels.value)) {
        const {channel} = signalizedChannel!;
        void channel.sendProfile(profile);
    }
};

export default setProfile;
