import {
    GatewayMessage,
    GatewayMessageType
} from 'crazystraw-common/ws-types';

import generateID from '../util/id';

type Identity = {username: string};

export class ConnectionManager extends EventTarget {
    private ws: WebSocket;

    private constructor (serverURL: string) {
        super();
        this.ws = new WebSocket(serverURL);
    }

    static async create (serverURL: string): Promise<ConnectionManager> {
        const cm = new ConnectionManager(serverURL);
        return new Promise((resolve, reject) => {
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
