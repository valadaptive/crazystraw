import {Buffer} from 'buffer';

import {TypedEventTarget, TypedEvent} from '../util/typed-events';
import {generateID} from '../util/id';

import {GatewayConnection} from './gateway';
import {PersonalIdentity} from './identity';
import {OTRChannel, OTRChannelState} from './otr';
import {Profile} from './profile';

import {ChatData, AvroChatData} from '../schemas/chat-data';
import {Message} from '../schemas/message';
import {EditMessage} from '../schemas/edit-message';
import {RequestProfile} from '../schemas/request-profile';
import {Profile as ProfileMessage} from '../schemas/profile';

export const enum ChatChannelState {
    /** The connection is being initialized. */
    CONNECTING,
    /** We are authenticating with the peer. */
    AUTHENTICATING,
    /** The connection is authenticated and active. */
    CONNECTED,
    /** The connection is currently disconnected and attempting to reconnect. */
    DISCONNECTED,
    /** The connection has been closed, possibly due to an error. */
    CLOSED
}

const otrToChatChannelState = {
    [OTRChannelState.CONNECTING]: ChatChannelState.CONNECTING,
    [OTRChannelState.AUTHENTICATING]: ChatChannelState.AUTHENTICATING,
    [OTRChannelState.CONNECTED]: ChatChannelState.CONNECTED,
    [OTRChannelState.DISCONNECTED]: ChatChannelState.DISCONNECTED,
    [OTRChannelState.CLOSED]: ChatChannelState.CLOSED
};

class ChatChannelConnectEvent extends TypedEvent<'connect'> {
    constructor () {
        super('connect');
    }
}

class ChatChannelStateChangeEvent extends TypedEvent<'statechange'> {
    constructor () {
        super('statechange');
    }
}

class ChatChannelDataEvent<T extends string> extends TypedEvent<T> {
    id: string;
    constructor (type: T, uuid: string) {
        super(type);
        this.id = uuid;
    }
}

class ChatChannelMessageEvent extends ChatChannelDataEvent<'message'> {
    message: Message;
    constructor (message: Message, id: string) {
        super('message', id);
        this.message = message;
    }
}

class ChatChannelEditMessageEvent extends ChatChannelDataEvent<'editmessage'> {
    edit: EditMessage;
    constructor (edit: EditMessage, id: string) {
        super('editmessage', id);
        this.edit = edit;
    }
}

class ChatChannelAcknowledgeEvent extends ChatChannelDataEvent<'acknowledge'> {
    referencedID: string;
    constructor (referencedID: string, id: string) {
        super('acknowledge', id);
        this.referencedID = referencedID;
    }
}

class ChatChannelRequestProfileEvent extends ChatChannelDataEvent<'requestprofile'> {
    request: RequestProfile;
    constructor (request: RequestProfile, id: string) {
        super('requestprofile', id);
        this.request = request;
    }
}

class ChatChannelProfileEvent extends ChatChannelDataEvent<'profile'> {
    profile: ProfileMessage;
    constructor (profile: ProfileMessage, id: string) {
        super('profile', id);
        this.profile = profile;
    }
}

export class ChatChannel extends TypedEventTarget<
ChatChannelStateChangeEvent |
ChatChannelConnectEvent |
ChatChannelMessageEvent |
ChatChannelEditMessageEvent |
ChatChannelAcknowledgeEvent |
ChatChannelRequestProfileEvent |
ChatChannelProfileEvent
> {
    public state: ChatChannelState;
    public peerIdentity: string;
    public createdTimestamp: number;

    private otrChannel: OTRChannel;
    private abortController: AbortController;

    constructor (
        gateway: GatewayConnection,
        myIdentity: PersonalIdentity,
        peerIdentity: string,
        connectionID: string,
        initiating: boolean
    ) {
        super();

        this.state = ChatChannelState.CONNECTING;
        this.peerIdentity = peerIdentity;
        this.createdTimestamp = Date.now();

        this.otrChannel = new OTRChannel(gateway, myIdentity, peerIdentity, connectionID, initiating);
        this.abortController = new AbortController();
        const {signal} = this.abortController;

        let connectFired = false;
        this.otrChannel.addEventListener('statechange', () => {
            this.setState(otrToChatChannelState[this.otrChannel.state]);
            if (this.state === ChatChannelState.CONNECTED && !connectFired) {
                // Only fire on first connect, not reconnects
                connectFired = true;
                this.dispatchEvent(new ChatChannelConnectEvent());
            }
        }, {signal});

        this.otrChannel.addEventListener('message', event => {
            try {
                const data = AvroChatData.fromBuffer(Buffer.from(event.data)) as ChatData;
                if ('Message' in data.data) {
                    this.dispatchEvent(new ChatChannelMessageEvent(data.data.Message, data.id));
                } else if ('EditMessage' in data.data) {
                    this.dispatchEvent(new ChatChannelEditMessageEvent(data.data.EditMessage, data.id));
                } else if ('Acknowledgement' in data.data) {
                    this.dispatchEvent(
                        new ChatChannelAcknowledgeEvent(data.data.Acknowledgement.referencedID, data.id));
                } else if ('RequestProfile' in data.data) {
                    this.dispatchEvent(new ChatChannelRequestProfileEvent(data.data.RequestProfile, data.id));
                } else if ('Profile' in data.data) {
                    this.dispatchEvent(new ChatChannelProfileEvent(data.data.Profile, data.id));
                }
            } catch (err) {
                this.close();
            }

        }, {signal});
    }

    private setState (newState: ChatChannelState): void {
        this.state = newState;
        this.dispatchEvent(new ChatChannelStateChangeEvent());
    }

    public close (): void {
        this.otrChannel.close();
        this.abortController.abort();
        this.setState(ChatChannelState.CLOSED);
    }

    public sendMessage (data: Message): void {
        const m: ChatData = {
            id: generateID(),
            data: {Message: data}
        };
        const buf = AvroChatData.toBuffer(m).buffer;
        void this.otrChannel.sendMessage(buf);
    }

    public requestProfile (): void {
        const m: ChatData = {
            id: generateID(),
            data: {RequestProfile: {
                previousHash: null
            }}
        };
        const buf = AvroChatData.toBuffer(m).buffer;
        void this.otrChannel.sendMessage(buf);
    }

    public async sendProfile (profile: Profile): Promise<void> {
        const m: ChatData = {
            id: generateID(),
            data: {Profile: {
                handle: profile.handle,
                bio: profile.bio ? {string: profile.bio} : null,
                avatar: profile.avatar ? {bytes: await profile.avatar.arrayBuffer()} : null
            }}
        };
        const buf = AvroChatData.toBuffer(m).buffer;
        void this.otrChannel.sendMessage(buf);
    }
}
