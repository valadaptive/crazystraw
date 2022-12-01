import {AppState, ProfileState} from '../util/state';

import {signal, Signal} from '@preact/signals';

import {ChatChannel, ChatChannelState} from '../rtc/chat';
import addContact from '../actions/add-contact';
import addMessage from '../actions/add-message';

export type SignalizedChatChannel = {
    state: Signal<ChatChannelState>,
    channel: ChatChannel,
    cleanup: () => void
};

const signalize = (store: AppState, channel: ChatChannel): SignalizedChatChannel => {
    const stateSignal = signal(channel.state);
    const abortController = new AbortController();

    channel.addEventListener('statechange', () => {
        stateSignal.value = channel.state;
    }, {signal: abortController.signal});

    channel.addEventListener('requestprofile', () => {
        if (store.profileData.value.state !== ProfileState.LOADED) return;
        void channel.sendProfile(store.profileData.value.profile);
    }, {signal: abortController.signal});

    channel.addEventListener('profile', event => {
        const {profile} = event;
        addContact(store, channel.peerIdentity, {
            identity: channel.peerIdentity,
            profile: {
                handle: profile.handle,
                avatar: profile.avatar ? new Blob([profile.avatar.bytes]) : null,
                bio: profile.bio ? profile.bio.string : null
            },
            lastMessageTimestamp: Date.now()
        });
    }, {signal: abortController.signal});

    channel.addEventListener('connect', () => {
        channel.requestProfile();
    }, {signal: abortController.signal, once: true});

    channel.addEventListener('message', event => {
        const {message, id} = event;
        addMessage(store, id, channel.peerIdentity, message, false);
    }, {signal: abortController.signal});

    return {
        state: stateSignal,
        channel,
        cleanup: () => abortController.abort()
    };
};

export default signalize;
