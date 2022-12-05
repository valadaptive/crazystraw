import style from './style.scss';

import type {JSX} from 'preact';
import {useMemo, useState} from 'preact/hooks';
import {useComputed} from '@preact/signals';
import classNames from 'classnames';

import {useAppState, useAction, Contact} from '../../util/state';
import fingerprintIcon from '../../util/digesticon';

import Avatar from '../Avatar/Avatar';
import DropdownMenu, {DIVIDER} from '../DropdownMenu/DropdownMenu';
import Indicator, {IndicatorState} from '../Indicator/Indicator';
import Icon from '../Icon/Icon';

import createOutgoingPeerRequestAction from '../../actions/create-outgoing-peer-request';
import closeOutgoingPeerRequestAction from '../../actions/close-outgoing-peer-request';
import closeIncomingPeerRequestAction from '../../actions/close-incoming-peer-request';
import deleteContactAction from '../../actions/delete-contact';
import setActiveContactAction from '../../actions/set-active-contact';
import setViewedProfileAction from '../../actions/set-viewed-profile';

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

const ContactItem = ({identity, contact, connectionInfo}: {
    identity: string,
    contact?: Omit<Contact, 'lastMessageTimestamp'>,
    connectionInfo: SignalizedIncomingPeerRequest | SignalizedOutgoingPeerRequest | SignalizedChatChannel | null
}): JSX.Element => {
    const {activeContact} = useAppState();
    const createOutgoingPeerRequest = useAction(createOutgoingPeerRequestAction);
    const closeOutgoingPeerRequest = useAction(closeOutgoingPeerRequestAction);
    const closeIncomingPeerRequest = useAction(closeIncomingPeerRequestAction);
    const setActiveContact = useAction(setActiveContactAction);
    const setViewedProfile = useAction(setViewedProfileAction);
    const deleteContact = useAction(deleteContactAction);

    let avatar: Blob | string | null = null;
    if (contact?.profile) {
        avatar = contact.profile.avatar;
    } else {
        try {
            avatar = fingerprintIcon(identity);
        } catch (err) {
            // The digest may be incorrect
        }
    }

    const onClickContact = useMemo(() => () => {
        setActiveContact(identity);
    }, [contact]);

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
    const closeRequest = useMemo(() => () => {
        if (outgoingRequest) closeOutgoingPeerRequest(outgoingRequest.peerIdentity);
        if (incomingRequest) closeIncomingPeerRequest(incomingRequest.peerIdentity);
    }, [outgoingRequest, incomingRequest]);

    const connectionState = connectionInfo?.state.value;
    const button = useMemo(() => {
        // Incoming chat request from a contact. The user can reject the request from the dropdown.
        if (incomingRequest && connectionState === IncomingPeerRequestState.PENDING) {
            return <Icon type="check" onClick={acceptRequest} color="green" title="Accept" />;
        }

        // Let the user cancel the incoming request in case e.g. WebRTC fails
        if (incomingRequest && connectionState === IncomingPeerRequestState.ACCEPTED) {
            return <Icon type="cancel" onClick={rejectRequest} title="Cancel" />;
        }

        // Let the user cancel the outgoing request
        if (outgoingRequest && (
            connectionState === OutgoingPeerRequestState.PENDING ||
            connectionState === OutgoingPeerRequestState.ACCEPTED)) {
            return <Icon type="cancel" onClick={cancelRequest} title="Cancel" />;
        }

        // Request has reached terminal state. Let the user close it.
        if (incomingRequest || outgoingRequest) {
            return <Icon type="x" onClick={closeRequest} title="Close" />;
        }

        // There is a channel open. Let the user close it.
        if (channel && channel.state !== ChatChannelState.CLOSED) {
            return <Icon type="x" onClick={closeChannel} title="Close connection" />;
        }

        if (contact && !channel) {
            return <Icon
                type="chatBubble"
                title="Request chat"
                onClick={(): void => createOutgoingPeerRequest(identity)}
            />;
        }
    }, [
        incomingRequest,
        outgoingRequest,
        channel,
        connectionState,
        identity,
        acceptRequest,
        rejectRequest,
        cancelRequest,
        closeRequest,
        closeChannel,
        createOutgoingPeerRequest
    ]);

    const [contactMenuOpen, setContactMenuOpen] = useState(false);

    const contactRight = useMemo(() => {
        return <div className={style.contactButtons}>
            {button}
            <DropdownMenu<HTMLDivElement>
                options={[
                    {
                        key: 'details',
                        text: 'Profile details',
                        onClick: () => setViewedProfile(identity)
                    },
                    connectionState === IncomingPeerRequestState.PENDING ? {
                        key: 'reject',
                        text: 'Reject chat request',
                        onClick: rejectRequest
                    } : null,
                    contact ? DIVIDER : null,
                    contact ? {
                        key: 'delete',
                        text: 'Remove contact',
                        color: 'red',
                        onClick: () => deleteContact(identity)
                    } : null
                ]}
                visible={contactMenuOpen}
                hideMenu={(): void => setContactMenuOpen(false)}
                render={(ref): JSX.Element => (
                    <div
                        ref={ref}
                        className={style.contactDropdown}
                    >
                        <Icon
                            type="arrowDown"
                            title="Options"
                            onClick={(): void => setContactMenuOpen(!contactMenuOpen)}
                        />
                    </div>
                )}
            />
        </div>;
    }, [button, contactMenuOpen, setContactMenuOpen, setViewedProfile, contact]);

    return (
        <div className={classNames(style.contact, {[style.active]: activeContact.value === identity})}>
            <div className={style.contactSelectable} onClick={onClickContact}>
                <div className={style.avatar}><Avatar data={avatar} size={64} /></div>
                <div className={style.contactDetails}>
                    <div className={style.contactName}>{contact?.profile.handle ?? identity}</div>
                    {connectionInfoLine ?
                        <div className={style.contactIncomingOutgoing}>
                            <div className={style.indicatorPadding}>
                                <Indicator size={20} state={connectionInfoLine[1]} />
                            </div>
                            <span>{connectionInfoLine[0]}</span>
                        </div> :
                        null}
                </div>
            </div>
            {contactRight}
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
        for (const contactSignal of Object.values(contacts.value)) {
            const {identity} = contactSignal!.value;
            let connectionInfo = null;
            if (Object.prototype.hasOwnProperty.call(incomingRequests.value, identity)) {
                connectionInfo = incomingRequests.value[identity];
            } else if (Object.prototype.hasOwnProperty.call(outgoingRequests.value, identity)) {
                connectionInfo = outgoingRequests.value[identity];
            } else if (Object.prototype.hasOwnProperty.call(openChannels.value, identity)) {
                connectionInfo = openChannels.value[identity]!;
            }
            contactsArr.push({contact: contactSignal!.value, connectionInfo});
        }
        contactsArr.sort((a, b) => a.contact.lastMessageTimestamp.value - b.contact.lastMessageTimestamp.value);
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
            const request = openChannels.value[identity]!;
            requests.push(request);
        }
        requests.sort((a, b) => a.channel.createdTimestamp - b.channel.createdTimestamp);
        return requests;
    }).value;

    return (
        <div className={style.contactsList}>
            {otherIncomingRequests.map(request => (
                <ContactItem
                    identity={request.request.peerIdentity}
                    connectionInfo={request}
                    key={request.request.peerIdentity}
                />
            ))}
            {otherOutgoingRequests.map(request => (
                <ContactItem
                    identity={request.request.peerIdentity}
                    connectionInfo={request}
                    key={request.request.peerIdentity}
                />
            ))}
            {otherOpenChannels.map(channel => (
                <ContactItem
                    identity={channel.channel.peerIdentity}
                    connectionInfo={channel}
                    key={channel.channel.peerIdentity}
                />
            ))}
            {sortedContacts.map(contact => (
                <ContactItem
                    identity={contact.contact.identity}
                    contact={contact.contact}
                    connectionInfo={contact.connectionInfo}
                    key={contact.contact.identity}
                />
            ))}
        </div>
    );
};

export default ContactsList;
