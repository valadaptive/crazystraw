import type {AppState} from '../util/state';

import connectChatChannel from '../event-binding/chat-channel';

import {ChatChannel} from '../rtc/chat';

const createChannel = (store: AppState, channel: ChatChannel): void => {
    const oldChannels = store.openChannels.value;

    const prevChannel = oldChannels[channel.peerIdentity];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (prevChannel) {
        prevChannel.channel.close();
        // TODO: should close be in cleanup?
        prevChannel.cleanup();
    }

    store.openChannels.value = {
        ...oldChannels,
        [channel.peerIdentity]: connectChatChannel(store, channel)
    };
};

export default createChannel;
