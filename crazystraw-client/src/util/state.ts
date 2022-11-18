import {createContext} from 'preact';
import {useContext, useMemo} from 'preact/hooks';
import {signal, effect, Signal, batch} from '@preact/signals';

import Identity from '../rtc/identity';
import Profile from '../rtc/profile';

const enum UserDataState {
    SAVED_BUT_NOT_LOADED,
    NONEXISTENT,
    GENERATING,
    LOADED
}

/**
 * Global application state
 */
type AppState = {
    savedUserData: Signal<string | null>,
    userData: Signal<{
        profile: Signal<Profile>,
        identity: Signal<Identity>
    } | null>,
    userDataState: Signal<UserDataState>
};

const createStore = (): AppState => {
    const defaultStore: AppState = {
        savedUserData: signal(null),
        userData: signal(null),
        userDataState: signal(UserDataState.NONEXISTENT)
    };

    /*const savedIdentity = localStorage.getItem('identity');
    if (savedIdentity !== null) {
        batch(() => {
            defaultStore.savedIdentity.value = savedIdentity;
            defaultStore.identityGenerationState.value = IdentityState.SAVED_BUT_NOT_LOADED;
        });
    }*/

    return defaultStore;
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

effect(() => {
    const savedIdentity = store.savedUserData.value;
    if (savedIdentity === null) {
        localStorage.removeItem('identity');
    } else {
        localStorage.setItem('identity', savedIdentity);
    }
});

export {useAppState, useAction, AppState, AppContext, store};

export {UserDataState};
