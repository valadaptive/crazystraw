import {AppState} from '../util/state';

const setViewedProfile = (store: AppState, viewedProfile: string | null): void => {
    store.viewedProfile.value = viewedProfile;
};

export default setViewedProfile;
