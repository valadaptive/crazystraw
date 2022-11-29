import {createContext} from 'preact';
import {useContext, useMemo} from 'preact/hooks';
import {signal, effect, Signal, batch} from '@preact/signals';

import setupEventLogic from './event-logic';

import {Profile, PersonalProfile} from '../rtc/profile';
import {GatewayConnection, GatewayConnectionState} from '../rtc/gateway';

import {SignalizedIncomingPeerRequest} from '../event-binding/incoming-peer-request';
import {SignalizedOutgoingPeerRequest} from '../event-binding/outgoing-peer-request';
import {SignalizedOTRChannel} from '../event-binding/otr-channel';

export const enum ProfileState {
    SAVED_BUT_NOT_LOADED,
    NONEXISTENT,
    GENERATING,
    LOADED
}

export type Contact = {
    identity: string,
    profile: Profile | null,
    lastMessageTimestamp: number
};

// This is unsafe unless noUncheckedIndexedAccess is enabled, but that would forbid array indexing too.
// Thanks TypeScript!
type Dictionary<T> = {[x: string]: T};

/**
 * Global application state
 */
export type AppState = {
    savedProfile: Signal<string | null>,
    profile: Signal<PersonalProfile | null>
    profileState: Signal<ProfileState>,
    gatewayConnection: Signal<{
        connection: GatewayConnection,
        state: Signal<GatewayConnectionState>,
        cleanup: () => void
    } | null>,
    incomingRequests: Signal<Dictionary<SignalizedIncomingPeerRequest>>,
    outgoingRequests: Signal<Dictionary<SignalizedOutgoingPeerRequest>>,
    openChannels: Signal<Dictionary<SignalizedOTRChannel>>,
    contacts: Signal<Dictionary<Contact>>
};

export const createStore = (): AppState => {
    const store: AppState = {
        savedProfile: signal(null),
        profile: signal(null),
        profileState: signal(ProfileState.NONEXISTENT),
        gatewayConnection: signal(null),
        incomingRequests: signal({}),
        outgoingRequests: signal({}),
        openChannels: signal({}),
        contacts: signal({})
    };

    const savedProfile = localStorage.getItem('profile');
    if (savedProfile !== null) {
        batch(() => {
            store.savedProfile.value = savedProfile;
            store.profileState.value = ProfileState.SAVED_BUT_NOT_LOADED;
        });
    }

    // Persist profile to storage
    effect(() => {
        const savedIdentity = store.savedProfile.value;
        if (savedIdentity === null) {
            localStorage.removeItem('profile');
        } else {
            localStorage.setItem('profile', savedIdentity);
        }
    });

    setupEventLogic(store);

    return store;
};

export const AppContext = createContext<AppState | undefined>(undefined);

/**
 * Hook for accessing global application state
 */
export const useAppState = (): AppState => {
    const context = useContext(AppContext);
    if (!context) throw new Error('No AppState provided');
    return context;
};

export const useAction = <T extends unknown[]>(
    func: (store: AppState, ...args: T) => void | Promise<void>): ((...args: T) => unknown) => {
    const context = useAppState();
    return useMemo(() => func.bind(null, context), [context]);
};
