import {signal} from '@preact/signals';

import {AppState} from '../util/state';

const updateOutgoingMessageContents = (store: AppState, identity: string, contents: string | null): void => {
    if (contents === null) {
        const {[identity]: __removed, ...rest} = store.outgoingMessageContents.value;
        store.outgoingMessageContents.value = rest;
        return;
    }

    const existingContents = store.outgoingMessageContents.value[identity];
    if (existingContents) {
        existingContents.text.value = contents;
        return;
    }

    store.outgoingMessageContents.value = {...store.outgoingMessageContents.value,
        [identity]: {
            text: signal(contents),
            attachments: signal([])
        }};
};

export default updateOutgoingMessageContents;
