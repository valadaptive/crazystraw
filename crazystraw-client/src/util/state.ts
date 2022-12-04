import {createContext} from 'preact';
import {useContext, useMemo} from 'preact/hooks';
import {signal, effect, Signal} from '@preact/signals';

import ChatAttachment from '../rtc/attachment';
import {Profile, PersonalProfile} from '../rtc/profile';

import {SignalizedIncomingPeerRequest} from '../event-binding/incoming-peer-request';
import {SignalizedOutgoingPeerRequest} from '../event-binding/outgoing-peer-request';
import {SignalizedChatChannel} from '../event-binding/chat-channel';
import {SignalizedGatewayConnection} from '../event-binding/gateway-connection';

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

type ProfileData = {
    state: ProfileState.SAVED_BUT_NOT_LOADED,
    savedProfile: string
} | {state: ProfileState.NONEXISTENT | ProfileState.GENERATING} | {
    state: ProfileState.LOADED,
    profile: PersonalProfile,
    gatewayConnection: SignalizedGatewayConnection
};

export type ChatMessage = {
    id: string,
    timestamp: number,
    from: string,
    contents: string,
    attachments: ChatAttachment[],
    pending: Signal<boolean>
};

export type OutgoingMessageContents = {
    text: Signal<string>,
    attachments: Signal<ChatAttachment[]>
};

/**
 * Global application state
 */
export type AppState = {
    profileData: Signal<ProfileData>,
    incomingRequests: Signal<Dictionary<SignalizedIncomingPeerRequest>>,
    outgoingRequests: Signal<Dictionary<SignalizedOutgoingPeerRequest>>,
    openChannels: Signal<Dictionary<SignalizedChatChannel>>,
    contacts: Signal<Dictionary<Signal<Contact>>>,
    activeContact: Signal<string | null>,
    chatMessages: Signal<Partial<Dictionary<Signal<ChatMessage[]>>>>,
    outgoingMessageContents: Signal<Partial<Dictionary<OutgoingMessageContents>>>
};

export const createStore = (): AppState => {
    const savedProfile = localStorage.getItem('profile');

    const profileData = savedProfile === null ? {state: ProfileState.NONEXISTENT} as const : {
        state: ProfileState.SAVED_BUT_NOT_LOADED,
        savedProfile
    } as const;

    const store: AppState = {
        profileData: signal(profileData),
        incomingRequests: signal({}),
        outgoingRequests: signal({}),
        openChannels: signal({}),
        contacts: signal({}),
        activeContact: signal(null),
        chatMessages: signal({}),
        outgoingMessageContents: signal({})
    };

    // Persist profile to storage
    effect(() => {
        const profile = store.profileData.value;

        if (profile.state === ProfileState.NONEXISTENT) {
            localStorage.removeItem('profile');
            return;
        }

        if (profile.state !== ProfileState.LOADED) return;

        void (async (): Promise<void> => {
            const savedProfile = await profile.profile.export();
            localStorage.setItem('profile', savedProfile);
        })();
    });

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
    func: (store: AppState, ...args: T) => void | Promise<void>): ((...args: T) => void) => {
    const context = useAppState();
    return useMemo(() => func.bind(null, context), [context]);
};

export const useGatewayConnection = (): SignalizedGatewayConnection | null => {
    const {profileData} = useAppState();
    if (profileData.value.state !== ProfileState.LOADED) return null;
    return profileData.value.gatewayConnection;
};
