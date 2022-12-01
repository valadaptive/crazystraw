import type {AppState} from '../util/state';

import connectChatChannel from '../event-binding/chat-channel';

import {ChatChannel} from '../rtc/chat';

import closeIncomingPeerRequest from './close-incoming-peer-request';
import closeOutgoingPeerRequest from './close-outgoing-peer-request';

const createChannel = (store: AppState, channel: ChatChannel): void => {
    const oldChannels = store.openChannels.value;

    const prevChannel = oldChannels[channel.peerIdentity];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (prevChannel) {
        prevChannel.channel.close();
        // TODO: should close be in cleanup?
        prevChannel.cleanup();
    }

    // Close any peer requests that may have existed for this channel
    closeIncomingPeerRequest(store, channel.peerIdentity);
    closeOutgoingPeerRequest(store, channel.peerIdentity);

    store.openChannels.value = {
        ...oldChannels,
        [channel.peerIdentity]: connectChatChannel(store, channel)
    };
};

export default createChannel;
