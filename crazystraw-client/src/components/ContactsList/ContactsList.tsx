import style from './style.scss';

import type {JSX} from 'preact';
import {useMemo} from 'preact/hooks';
import {useComputed} from '@preact/signals';

import {useAppState, useAction, Contact} from '../../util/state';
import useKey from '../../util/use-key';
import {IncomingPeerRequest, IncomingPeerRequestState} from '../../rtc/gateway';

const ContactItem = ({contact}: {contact: Contact}): JSX.Element => {
    return (
        <div className={style.contact}>
            <div className={style.contactName}>{contact.profile?.handle ?? 'Unknown user'}</div>
        </div>
    );
};

const IncomingContactRequest = ({request, state}: {
    request: IncomingPeerRequest,
    state: IncomingPeerRequestState
}): JSX.Element => {
    const buttons = state === IncomingPeerRequestState.ACTIVE ? <>
        <button onClick={(): unknown => request.accept()}>Accept</button>
        <button onClick={(): unknown => request.reject()}>Reject</button>
    </> :
        null;
    
    return (
        <div className={style.IncomingContactRequest}>
            Incoming contact request from {request.peerIdentityString}
            <br />
            State {state}
            <br />
            {buttons}
        </div>
    );
};

const ContactsList = (): JSX.Element => {
    const {contacts, incomingRequests} = useAppState();
    const keyFactory = useKey();

    const sortedContacts = useComputed(
        () => contacts.value.slice(0).sort((a, b) => a.lastMessageTimestamp - b.lastMessageTimestamp)
    ).value;

    const incomingRequestsOrdered = useComputed(() => {
        const requests = [];
        for (const requestKey in incomingRequests.value) {
            if (!Object.prototype.hasOwnProperty.call(incomingRequests.value, requestKey)) continue;
            const {request, state} = incomingRequests.value[requestKey]!;
            requests.push({request, state: state.value, key: requestKey});
        }
        requests.sort((a, b) => a.key > b.key ? 1 : a.key === b.key ? 0 : -1);
        return requests;
    }).value;

    return (
        <div className={style.contactsList}>
            {sortedContacts.map(contact => (
                <ContactItem contact={contact} key={keyFactory(contact)} />
            ))}
            {incomingRequestsOrdered.map(({request, state, key}) => (
                <IncomingContactRequest request={request} state={state} key={key} />
            ))}
        </div>
    );
};

export default ContactsList;
