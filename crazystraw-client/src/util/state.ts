import {createContext} from 'preact';
import {useContext, useMemo} from 'preact/hooks';
import {signal, effect, Signal, batch, computed} from '@preact/signals';

import Identity from '../rtc/identity';
import Profile from '../rtc/profile';
import {ConnectionManager} from '../rtc/gateway';

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
    userDataState: Signal<UserDataState>,
    connectionManager: Signal<ConnectionManager | null>
};

const CONNECTION_SERVER = 'ws://localhost:9876';

const createStore = (): AppState => {
    const store: AppState = {
        savedUserData: signal(null),
        userData: signal(null),
        userDataState: signal(UserDataState.NONEXISTENT),
        connectionManager: signal(null)
    };

    /*const savedIdentity = localStorage.getItem('identity');
    if (savedIdentity !== null) {
        batch(() => {
            defaultStore.savedIdentity.value = savedIdentity;
            defaultStore.identityGenerationState.value = IdentityState.SAVED_BUT_NOT_LOADED;
        });
    }*/

    effect(() => {
        const savedIdentity = store.savedUserData.value;
        if (savedIdentity === null) {
            localStorage.removeItem('userData');
        } else {
            localStorage.setItem('userData', savedIdentity);
        }
    });

    effect(() => {
        if (store.userData.value) {
            console.log('prev conn manager: ', store.connectionManager.peek());
            const prevConnectionManager = store.connectionManager.peek();
            if (prevConnectionManager) prevConnectionManager.close();
            void ConnectionManager.create(
                CONNECTION_SERVER,
                store.userData.value.identity.value
            ).then((cm): void => {
                store.connectionManager.value = cm;
                console.log(store.connectionManager.peek());
            });
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

export {UserDataState};
