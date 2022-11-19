import {createContext} from 'preact';
import {useContext, useMemo} from 'preact/hooks';
import {signal, effect, Signal, batch, computed} from '@preact/signals';

import Profile from '../rtc/profile';
import {ConnectionManager} from '../rtc/gateway';

const enum ProfileState {
    SAVED_BUT_NOT_LOADED,
    NONEXISTENT,
    GENERATING,
    LOADED
}

/**
 * Global application state
 */
type AppState = {
    savedProfile: Signal<string | null>,
    profile: Signal<Profile | null>
    profileState: Signal<ProfileState>,
    connectionManager: Signal<ConnectionManager | null>
};

const CONNECTION_SERVER = 'ws://localhost:9876';

const createStore = (): AppState => {
    const store: AppState = {
        savedProfile: signal(null),
        profile: signal(null),
        profileState: signal(ProfileState.NONEXISTENT),
        connectionManager: signal(null)
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

    // Close the old connection manager when the profile changes or is deleted
    effect(() => {
        const prevConnectionManager = store.connectionManager.peek();
        if (store.profile.value) {
            if (prevConnectionManager) prevConnectionManager.close();
            void ConnectionManager.create(
                CONNECTION_SERVER,
                store.profile.value.identity
            ).then((cm): void => {
                store.connectionManager.value = cm;
            });
        } else {
            if (prevConnectionManager) prevConnectionManager.close();
        }
    });

    return store;
};

const store = createStore();

const AppContext = createContext(store);

/**
 * Hook for accessing global application state
 */
const useAppState = (): AppState => useContext(AppContext);
const useAction = <T extends unknown[]>(
    func: (store: AppState, ...args: T) => void | Promise<void>): ((...args: T) => unknown) => {
    const context = useContext(AppContext);
    return useMemo(() => func.bind(null, context), [context]);
};

export {useAppState, useAction, AppState, AppContext, store};

export {ProfileState};
