import {createContext} from 'preact';
import {useContext, useMemo} from 'preact/hooks';
import {signal, effect, Signal, batch} from '@preact/signals';

import setupEventLogic from './event-logic';

import {PersonalProfile} from '../rtc/profile';
import {GatewayConnection, GatewayConnectionState, IncomingPeerRequest} from '../rtc/gateway';

export const enum ProfileState {
    SAVED_BUT_NOT_LOADED,
    NONEXISTENT,
    GENERATING,
    LOADED
}

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
    incomingRequests: Signal<Partial<Record<string, IncomingPeerRequest>>>
};

const CONNECTION_SERVER = 'ws://localhost:9876';

export const createStore = (): AppState => {
    const store: AppState = {
        savedProfile: signal(null),
        profile: signal(null),
        profileState: signal(ProfileState.NONEXISTENT),
        gatewayConnection: signal(null),
        incomingRequests: signal({})
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
