import {GatewayConnection} from '../rtc/gateway';
import {PersonalProfile} from '../rtc/profile';

import {AppState, ProfileState} from '../util/state';

import connectGatewayConnection from '../event-binding/gateway-connection';

const CONNECTION_SERVER = 'ws://localhost:9876';

const setProfile = (store: AppState, profile: PersonalProfile | null): void => {
    const previousProfileData = store.profileData.peek();

    // Clean up previous gateway connection
    if (previousProfileData.state === ProfileState.LOADED) {
        previousProfileData.gatewayConnection.cleanup();
    }

    if (profile === null) {
        store.profileData.value = {state: ProfileState.NONEXISTENT};
        return;
    }

    store.profileData.value = {
        state: ProfileState.LOADED,
        profile,
        gatewayConnection: connectGatewayConnection(store, new GatewayConnection(CONNECTION_SERVER, profile.identity))
    };
};

export default setProfile;
