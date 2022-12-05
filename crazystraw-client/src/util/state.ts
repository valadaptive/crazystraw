import {createContext} from 'preact';
import {useContext, useMemo} from 'preact/hooks';
import {signal, effect, Signal} from '@preact/signals';
import {fromByteArray} from 'base64-js';

import ChatAttachment from '../rtc/attachment';
import Profile from '../rtc/profile';
import {PersonalIdentity} from '../rtc/identity';

import {SignalizedIncomingPeerRequest} from '../event-binding/incoming-peer-request';
import {SignalizedOutgoingPeerRequest} from '../event-binding/outgoing-peer-request';
import {SignalizedChatChannel} from '../event-binding/chat-channel';
import {SignalizedGatewayConnection} from '../event-binding/gateway-connection';

export const enum ProfileState {
    SAVED_BUT_NOT_LOADED,
    NONEXISTENT,
    GENERATING,
    LOADING,
    LOADED
}

export type Contact = {
    identity: string,
    profile: Profile,
    lastMessageTimestamp: Signal<number>
};

// This is unsafe unless noUncheckedIndexedAccess is enabled, but that would forbid array indexing too.
// Thanks TypeScript!
type Dictionary<T> = {[x: string]: T};

type IdentityData = {
    state: ProfileState.SAVED_BUT_NOT_LOADED,
    savedProfile: string
} | {state: ProfileState.NONEXISTENT | ProfileState.GENERATING | ProfileState.LOADING} | {
    state: ProfileState.LOADED,
    identity: PersonalIdentity,
    profile: Signal<Profile>,
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
    profileData: Signal<IdentityData>,
    incomingRequests: Signal<Dictionary<SignalizedIncomingPeerRequest>>,
    outgoingRequests: Signal<Dictionary<SignalizedOutgoingPeerRequest>>,
    openChannels: Signal<Partial<Dictionary<SignalizedChatChannel>>>,
    contacts: Signal<Partial<Dictionary<Signal<Contact>>>>,
    activeContact: Signal<string | null>,
    chatMessages: Signal<Partial<Dictionary<Signal<ChatMessage[]>>>>,
    outgoingMessageContents: Signal<Partial<Dictionary<OutgoingMessageContents>>>,
    viewedProfile: Signal<string | null>,
    profileEditorOpen: Signal<boolean>
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
        outgoingMessageContents: signal({}),
        viewedProfile: signal(null),
        profileEditorOpen: signal(false)
    };

    // Persist profile to storage
    let profileGeneration = 0;
    effect(() => {
        const profile = store.profileData.value;

        if (profile.state === ProfileState.NONEXISTENT) {
            localStorage.removeItem('profile');
            return;
        }

        if (profile.state !== ProfileState.LOADED) return;

        void (async (): Promise<void> => {
            const savedGen = ++profileGeneration;
            const profileBytes = await profile.profile.value.toBytes();
            const savedIdentity = await profile.identity.export(profileBytes);
            // Don't save outdated profiles
            if (savedGen !== profileGeneration) return;
            localStorage.setItem('profile', fromByteArray(savedIdentity));
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

export const useAction = <T extends unknown[], V>(
    func: (store: AppState, ...args: T) => V): ((...args: T) => V) => {
    const context = useAppState();
    return useMemo(() => func.bind(null, context), [context]);
};

export const useGatewayConnection = (): SignalizedGatewayConnection | null => {
    const {profileData} = useAppState();
    if (profileData.value.state !== ProfileState.LOADED) return null;
    return profileData.value.gatewayConnection;
};
