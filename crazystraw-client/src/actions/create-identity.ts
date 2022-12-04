import Profile from '../rtc/profile';
import {PersonalIdentity} from '../rtc/identity';

import {AppState, ProfileState} from '../util/state';
import {generateID} from '../util/id';

import setIdentity from './set-identity';

const createIdentity = async (
    store: AppState,
    {handle, avatar, bio}: {
        handle: string,
        avatar: Blob | null,
        bio: string | null
    },
    password: string
): Promise<void> => {
    store.profileData.value = {state: ProfileState.GENERATING};

    try {
        const profile = new Profile(generateID(), handle, avatar, bio);
        const identity = await PersonalIdentity.generate(password);
        setIdentity(store, profile, identity);
    } catch (err) {
        store.profileData.value = {state: ProfileState.NONEXISTENT};
    }
};

export default createIdentity;
