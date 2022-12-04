import {AppState} from '../util/state';

const clearOutgoingMessage = (store: AppState, identity: string): void => {
    const {[identity]: __removed, ...rest} = store.outgoingMessageContents.value;
    store.outgoingMessageContents.value = rest;
};

export default clearOutgoingMessage;
