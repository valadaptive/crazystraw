import {toByteArray, fromByteArray} from 'base64-js';

import {
    GatewayMessage,
    GatewayMessageType,
    ChallengeMessage
} from 'crazystraw-common/ws-types';

import Identity from './identity';
import generateID from '../util/id';

export class ConnectionManager extends EventTarget {
    private ws: WebSocket;

    private seq: number;

    public closed: boolean;

    private constructor (serverURL: string) {
        super();
        this.ws = new WebSocket(serverURL);
        this.seq = 0;
        this.closed = false;

        const onClose = (): void => {
            this.closed = true;
            this.ws.removeEventListener('close', onClose);
        };
        this.ws.addEventListener('close', onClose);
    }

    waitFor (filter: (message: GatewayMessage) => boolean, timeout: number): Promise<GatewayMessage> {
        return new Promise((resolve, reject) => {
            const onMessage = (event: MessageEvent): void => {
                try {
                    const parsedData = JSON.parse(event.data as string) as GatewayMessage;
                    if (filter(parsedData)) {
                        resolve(parsedData);
                        this.ws.removeEventListener('message', onMessage);
                    }
                } catch (err) {
                    // The message may not have been meant for us. Swallow the error.
                }
            };
            this.ws.addEventListener('message', onMessage);

            setTimeout(() => {
                this.ws.removeEventListener('message', onMessage);
                reject(new Error('Timed out'));
            }, timeout);
        });
    }

    send (message: Omit<GatewayMessage, 'seq'>): GatewayMessage {
        (message as GatewayMessage).seq = this.seq;
        this.seq += 2;
        console.log(JSON.stringify(message), this.ws);
        this.ws.send(JSON.stringify(message));
        return message as GatewayMessage;
    }

    static async create (serverURL: string, identity: Identity): Promise<ConnectionManager> {
        const cm = new ConnectionManager(serverURL);
        await new Promise((resolve, reject) => {
            const onOpen = (): void => {
                removeEventListeners();
                resolve(cm);
            };
            const onError = (): void => {
                removeEventListeners();
                reject(new Error('Connection could not be opened'));
            };
            const removeEventListeners = (): void => {
                cm.ws.removeEventListener('open', onOpen);
                cm.ws.removeEventListener('error', onError);
            };
            cm.ws.addEventListener('open', onOpen);
            cm.ws.addEventListener('error', onError);
        });

        const identifyMessage = {
            type: GatewayMessageType.IDENTIFY,
            publicKey: fromByteArray(identity.rawPublicKey)
        } as const;
        const identifySeq = cm.send(identifyMessage).seq;
        const challengeMessage = (await cm.waitFor(
            message => message.type === GatewayMessageType.CHALLENGE,
            5000
        )) as ChallengeMessage;
        const challenge = toByteArray(challengeMessage.challenge);
        const signature = await identity.sign(challenge);

        const responseMessage = {
            type: GatewayMessageType.CHALLENGE_RESPONSE,
            for: challengeMessage.seq,
            response: fromByteArray(new Uint8Array(signature))
        };
        cm.send(responseMessage);
        await cm.waitFor(
            message => message.type === GatewayMessageType.CHALLENGE_SUCCESS && message.for === challengeMessage.seq,
            5000
        );

        return cm;
    }

    close (): void {
        this.ws.close();
    }

    createConnection (myIdentity: Identity, peerIdentity: Identity): Connection {
        const id = generateID();
        return new Connection(id, this.ws, myIdentity, peerIdentity);
    }
}

class ConnectionCancelEvent extends Event {
    constructor () {
        super('cancel');
    }
}

class ConnectionErrorEvent extends Event {
    public error: Error;
    constructor (error: Error) {
        super('error');
        this.error = error;
    }
}


class ConnectionAcknowledgeEvent extends Event {
    /** Approximate timestamp at which this connection times out. */
    public timeout: number;
    constructor (timeout: number) {
        super('acknowledge');
        this.timeout = timeout;
    }
}

class Connection extends EventTarget {
    /** Used to abort the fetch request when the connection is cancelled */
    private establishConnectionController: AbortController;

    private connection: RTCPeerConnection;

    constructor (
        id: string,
        ws: WebSocket,
        myIdentity: Identity,
        peerIdentity: Identity
    ) {
        super();

        this.establishConnectionController = new AbortController();
        this.connection = new RTCPeerConnection();

        void this.connect(id, ws, myIdentity, peerIdentity);
    }

    private async connect (
        id: string,
        ws: WebSocket,
        myIdentity: Identity,
        peerIdentity: Identity
    ): Promise<void> {
        try {
            const channel = this.connection.createDataChannel('send_chan');
            const offer = await this.connection.createOffer();

            const requestBody = JSON.stringify({
                connectionID: id,
                type: GatewayMessageType.REQUEST_PEER,
                myIdentity,
                peerIdentity,
                offer
            });

            const onMessage = (evt: MessageEvent): void => {
                try {
                    const parsedData = JSON.parse(evt.data as string) as GatewayMessage;
                    //if (parsedData.connectionID !== id) return;
                    console.log(parsedData);
                } catch (err) {
                    // The message may not have been meant for us. Swallow the error.
                }
            };

            const onError = (): void => {
                this.dispatchEvent(new ConnectionErrorEvent(new Error('WebSocket error')));
                removeEventListeners();
            };

            const removeEventListeners = (): void => {
                ws.removeEventListener('message', onMessage);
                ws.removeEventListener('error', onError);
            };

            ws.addEventListener('message', onMessage);
            ws.addEventListener('error', onError);

            ws.send(requestBody);

        }
        catch (error) {
            this.dispatchEvent(new ConnectionErrorEvent(error as Error));
        }
    }

    cancel (): void {
        this.establishConnectionController.abort();
        this.dispatchEvent(new ConnectionCancelEvent());
    }
}
