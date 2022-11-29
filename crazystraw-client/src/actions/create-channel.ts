import type {AppState} from '../util/state';

import connectOTRChannel from '../event-binding/otr-channel';

import {OTRChannel} from '../rtc/otr';

const createChannel = (store: AppState, channel: OTRChannel): void => {
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
        [channel.peerIdentity]: connectOTRChannel(store, channel)
    };
};

export default createChannel;
