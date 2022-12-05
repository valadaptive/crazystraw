import type {AppState} from '../util/state';

const deleteContact = (store: AppState, identity: string): void => {
    const {[identity]: __removed, ...rest} = store.contacts.value;
    store.contacts.value = rest;
};

export default deleteContact;
