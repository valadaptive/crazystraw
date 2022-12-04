import Profile from '../rtc/profile';
import {PersonalIdentity} from '../rtc/identity';

import {AppState, ProfileState} from '../util/state';

import setIdentity from './set-identity';

const loadIdentity = async (store: AppState, data: Uint8Array, password: string): Promise<void> => {
    store.profileData.value = {state: ProfileState.LOADING};

    const {identity, data: profileData} = await PersonalIdentity.import(data, password);
    if (!profileData) throw new Error('No profile data');
    const profile = Profile.fromBytes(profileData);
    setIdentity(store, profile, identity);
};

export default loadIdentity;
