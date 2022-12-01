import {signal} from '@preact/signals';

import type {AppState, Contact} from '../util/state';

const addContact = (store: AppState, identity: string, contact: Contact): void => {
    if (Object.prototype.hasOwnProperty.call(store.contacts.value, identity)) {
        store.contacts.value[identity].value = contact;
        return;
    }

    store.contacts.value = {...store.contacts.value, [identity]: signal(contact)};
};

export default addContact;
