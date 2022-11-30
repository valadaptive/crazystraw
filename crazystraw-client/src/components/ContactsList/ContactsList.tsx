import style from './style.scss';

import type {JSX} from 'preact';
import {useMemo} from 'preact/hooks';
import {useComputed} from '@preact/signals';

import {useAppState, Contact} from '../../util/state';
import fingerprintIcon from '../../util/digesticon';

import Avatar from '../Avatar/Avatar';
import Indicator, {IndicatorState} from '../Indicator/Indicator';
import Icon from '../Icon/Icon';

import {
    IncomingPeerRequest,
    OutgoingPeerRequest,
    IncomingPeerRequestState,
    OutgoingPeerRequestState
} from '../../rtc/peer-request';
import {ChatChannel, ChatChannelState} from '../../rtc/chat';

import type {SignalizedIncomingPeerRequest} from '../../event-binding/incoming-peer-request';
import type {SignalizedOutgoingPeerRequest} from '../../event-binding/outgoing-peer-request';
import type {SignalizedChatChannel} from '../../event-binding/chat-channel';

const ContactItem = ({contact, connectionInfo}: {
    contact: Omit<Contact, 'lastMessageTimestamp'>,
    connectionInfo: SignalizedIncomingPeerRequest | SignalizedOutgoingPeerRequest | SignalizedChatChannel | null
}): JSX.Element => {
    let avatar: Blob | string | null = contact.profile ? contact.profile.avatar : null;
    try {
        avatar = fingerprintIcon(contact.identity);
    } catch (err) {
        // The digest may be incorrect
    }

    const connectionInfoLine = useMemo(() => {
        if (!connectionInfo) return null;

        if ('request' in connectionInfo && connectionInfo.request instanceof OutgoingPeerRequest) {
            switch (connectionInfo.state.value) {
                case OutgoingPeerRequestState.PENDING:
                    return ['Waiting for response...', IndicatorState.LOADING] as const;
                case OutgoingPeerRequestState.ACCEPTED:
                    return ['Connecting...', IndicatorState.LOADING] as const;
                case OutgoingPeerRequestState.CONNECTED:
                    return ['Connected', IndicatorState.SUCCESS] as const;
                case OutgoingPeerRequestState.TIMED_OUT:
                    return ['Timed out', IndicatorState.FAILED] as const;
                case OutgoingPeerRequestState.REJECTED:
                    return ['Request rejected', IndicatorState.FAILED] as const;
                case OutgoingPeerRequestState.PEER_OFFLINE:
                    return ['User not connected', IndicatorState.FAILED] as const;
                case OutgoingPeerRequestState.CANCELLED:
                    return ['Request cancelled', IndicatorState.FAILED] as const;
                case OutgoingPeerRequestState.CONNECTION_ERROR:
                    return ['An error occurred', IndicatorState.FAILED] as const;
                default:
                    throw new Error('Unreachable');
            }
        }

        if ('request' in connectionInfo && connectionInfo.request instanceof IncomingPeerRequest) {
            switch (connectionInfo.state.value) {
                case IncomingPeerRequestState.PENDING:
                    return ['Wants to chat', IndicatorState.LOADING] as const;
                case IncomingPeerRequestState.ACCEPTED:
                    return ['Connecting...', IndicatorState.LOADING] as const;
                case IncomingPeerRequestState.CONNECTED:
                    return ['Connected', IndicatorState.SUCCESS] as const;
                case IncomingPeerRequestState.REJECTED:
                    return ['Rejected request', IndicatorState.FAILED] as const;
                case IncomingPeerRequestState.CANCELLED:
                    return ['cancelled their request', IndicatorState.FAILED] as const;
                case IncomingPeerRequestState.CONNECTION_ERROR:
                    return ['An error occurred', IndicatorState.FAILED] as const;
                default:
                    throw new Error('Unreachable');
            }
        }

        if ('channel' in connectionInfo && connectionInfo.channel instanceof ChatChannel) {
            switch (connectionInfo.state.value) {
                case ChatChannelState.CONNECTING:
                    return ['Connecting...', IndicatorState.LOADING] as const;
                case ChatChannelState.AUTHENTICATING:
                    return ['Authenticating...', IndicatorState.LOADING] as const;
                case ChatChannelState.CONNECTED:
                    return ['Connected', IndicatorState.SUCCESS] as const;
                case ChatChannelState.DISCONNECTED:
                    return ['Reconnecting...', IndicatorState.LOADING] as const;
                case ChatChannelState.CLOSED:
                    return ['Closed', IndicatorState.FAILED] as const;
                default:
                    throw new Error('Unreachable');
            }
        }

        throw new Error('Unreachable');
    }, [connectionInfo, connectionInfo?.state.value]);

    const incomingRequest = connectionInfo &&
        'request' in connectionInfo &&
        (connectionInfo.request instanceof IncomingPeerRequest) ?
        connectionInfo.request :
        undefined;

    const outgoingRequest = connectionInfo &&
        'request' in connectionInfo &&
        (connectionInfo.request instanceof OutgoingPeerRequest) ?
        connectionInfo.request :
        undefined;

    const channel = connectionInfo &&
        'channel' in connectionInfo &&
        (connectionInfo.channel instanceof ChatChannel) ?
        connectionInfo.channel :
        undefined;

    const [acceptRequest, rejectRequest] = useMemo(() => {
        return [
            (): void => incomingRequest?.accept(),
            (): void => incomingRequest?.reject()
        ] as const;
    }, [incomingRequest]);
    const cancelRequest = useMemo(() => () => outgoingRequest?.cancel(), [outgoingRequest]);
    const closeChannel = useMemo(() => () => channel?.close(), [channel]);

    const includeIncomingRequestButtons = incomingRequest &&
        connectionInfo?.state.value === IncomingPeerRequestState.PENDING;
    const includeOutgoingRequestButtons = outgoingRequest &&
        connectionInfo?.state.value === OutgoingPeerRequestState.PENDING;
    const includeChannelButtons = channel &&
        connectionInfo?.state.value !== ChatChannelState.CLOSED;

    return (
        <div className={style.contact}>
            <div className={style.avatar}><Avatar data={avatar} size={64} /></div>
            <div className={style.contactDetails}>
                <div className={style.contactName}>{contact.profile?.handle ?? contact.identity}</div>
                {connectionInfoLine ?
                    <div className={style.contactIncomingOutgoing}>
                        <div className={style.indicatorPadding}>
                            <Indicator size={20} state={connectionInfoLine[1]} />
                        </div>
                        <span>{connectionInfoLine[0]}</span>
                    </div> :
                    null}
            </div>
            {includeIncomingRequestButtons || includeOutgoingRequestButtons || includeChannelButtons ?
                <div className={style.contactButtons}>
                    {includeIncomingRequestButtons ?
                        <>
                            <Icon type="check" onClick={acceptRequest} color="green" title="Accept" />
                            <Icon type="x" onClick={rejectRequest} color="red" title="Reject" />
                        </> :
                        null}
                    {includeOutgoingRequestButtons ?
                        <Icon type="cancel" onClick={cancelRequest} title="Cancel" /> :
                        null}
                    {includeChannelButtons ?
                        <Icon type="x" onClick={closeChannel} title="Close connection" /> :
                        null}
                </div> :
                null}
        </div>
    );
};

const ContactsList = (): JSX.Element => {
    const {contacts, incomingRequests, outgoingRequests, openChannels} = useAppState();

    type ContactListing = {
        contact: Contact,
        connectionInfo: SignalizedIncomingPeerRequest | SignalizedOutgoingPeerRequest | SignalizedChatChannel | null
    };

    const sortedContacts: ContactListing[] = useComputed(() => {
        const contactsArr = [];
        for (const contact of Object.values(contacts.value)) {
            const {identity} = contact;
            let connectionInfo = null;
            if (Object.prototype.hasOwnProperty.call(incomingRequests.value, identity)) {
                connectionInfo = incomingRequests.value[identity];
            } else if (Object.prototype.hasOwnProperty.call(outgoingRequests.value, identity)) {
                connectionInfo = outgoingRequests.value[identity];
            } else if (Object.prototype.hasOwnProperty.call(openChannels.value, identity)) {
                connectionInfo = openChannels.value[identity];
            }
            contactsArr.push({contact, connectionInfo});
        }
        contactsArr.sort((a, b) => a.contact.lastMessageTimestamp - b.contact.lastMessageTimestamp);
        return contactsArr;
    }).value;

    const otherIncomingRequests = useComputed(() => {
        const requests = [];
        for (const identity in incomingRequests.value) {
            if (!Object.prototype.hasOwnProperty.call(incomingRequests.value, identity)) continue;
            // Ignore incoming requests already placed into contacts
            if (Object.prototype.hasOwnProperty.call(contacts.value, identity)) continue;
            const request = incomingRequests.value[identity];
            requests.push(request);
        }
        requests.sort((a, b) => a.request.receivedTimestamp - b.request.receivedTimestamp);
        return requests;
    }).value;

    const otherOutgoingRequests = useComputed(() => {
        const requests = [];
        for (const identity in outgoingRequests.value) {
            if (!Object.prototype.hasOwnProperty.call(outgoingRequests.value, identity)) continue;
            // Ignore incoming requests already placed into contacts
            if (Object.prototype.hasOwnProperty.call(contacts.value, identity)) continue;
            const request = outgoingRequests.value[identity];
            requests.push(request);
        }
        requests.sort((a, b) => a.request.createdTimestamp - b.request.createdTimestamp);
        return requests;
    }).value;


    const otherOpenChannels = useComputed(() => {
        const requests = [];
        for (const identity in openChannels.value) {
            if (!Object.prototype.hasOwnProperty.call(openChannels.value, identity)) continue;
            // Ignore incoming requests already placed into contacts
            if (Object.prototype.hasOwnProperty.call(contacts.value, identity)) continue;
            const request = openChannels.value[identity];
            requests.push(request);
        }
        requests.sort((a, b) => a.channel.createdTimestamp - b.channel.createdTimestamp);
        return requests;
    }).value;

    return (
        <div className={style.contactsList}>
            {otherIncomingRequests.map(request => (
                <ContactItem
                    contact={{identity: request.request.peerIdentity, profile: null}}
                    connectionInfo={request}
                    key={request.request.peerIdentity}
                />
            ))}
            {otherOutgoingRequests.map(request => (
                <ContactItem
                    contact={{identity: request.request.peerIdentity, profile: null}}
                    connectionInfo={request}
                    key={request.request.peerIdentity}
                />
            ))}
            {otherOpenChannels.map(channel => (
                <ContactItem
                    contact={{identity: channel.channel.peerIdentity, profile: null}}
                    connectionInfo={channel}
                    key={channel.channel.peerIdentity}
                />
            ))}
            {sortedContacts.map(contact => (
                <ContactItem
                    contact={contact.contact}
                    connectionInfo={contact.connectionInfo}
                    key={contact.contact.identity}
                />
            ))}
        </div>
    );
};

export default ContactsList;
