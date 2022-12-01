import {AppState} from '../util/state';

const setActiveContact = (store: AppState, contactIdentity: string | null): void => {
    store.activeContact.value = contactIdentity;
};

export default setActiveContact;
