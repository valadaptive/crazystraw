import {batch} from '@preact/signals';

import type {AppState} from '../util/state';

const deleteContact = (store: AppState, identity: string): void => {
    batch(() => {
        const {[identity]: __removed, ...rest} = store.contacts.value;
        store.contacts.value = rest;

        if (store.activeContact.value === identity) {
            store.activeContact.value = null;
        }
    });
};

export default deleteContact;
