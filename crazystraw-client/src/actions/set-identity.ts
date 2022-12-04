import {signal} from '@preact/signals';

import Profile from '../rtc/profile';
import {PersonalIdentity} from '../rtc/identity';
import {GatewayConnection} from '../rtc/gateway';

import {AppState, ProfileState} from '../util/state';

import connectGatewayConnection from '../event-binding/gateway-connection';

const CONNECTION_SERVER = 'ws://localhost:9876';

const setIdentity = (
    store: AppState,
    profile: Profile,
    identity: PersonalIdentity
): void => {
    if (store.profileData.value.state === ProfileState.LOADED) {
        store.profileData.value.gatewayConnection.cleanup();
    }

    store.profileData.value = {
        state: ProfileState.LOADED,
        profile: signal(profile),
        identity,
        gatewayConnection: connectGatewayConnection(store, new GatewayConnection(CONNECTION_SERVER, identity))
    };
};

export default setIdentity;
