import {WebSocketServer, WebSocket} from 'ws';
import dotenv from 'dotenv';

dotenv.config();

function orError<T> (value: T | undefined, message: string): T {
    if (typeof value === 'undefined') throw new Error(message);
    return value;
}

function expectNumber (value: string | undefined): number | undefined {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue))  return parsedValue;
    return undefined;
}

const config = {
    port: orError(expectNumber(process.env.PORT), 'Expected port number')
};

const enum WSMessageType {
    /** Identify yourself to the server. */
    IDENTIFY,
    /** Request a peer with a given identity. */
    REQUEST_PEER,
    /** Peer request was acknowledged. */
    REQUEST_ACK,
    /** A peer has responded to your request. */
    PEER_OFFER,
    /** Fetch all active peer requests. */
    GET_ALL_REQUESTS,
}

type WSMessageBase = {
    /** Connection ID; used to disambiguate between different connections being established. */
    connectionID: string
};

type WSMessage = WSMessageBase & ({
    type: WSMessageType.IDENTIFY,
    myIdentity: {username: string},
} | {
    type: WSMessageType.REQUEST_PEER,
    myIdentity: {username: string},
    peerIdentity: {username: string},
    offer: {
        type: 'offer',
        sdp: string
    }
} | {
    type: WSMessageType.REQUEST_ACK,
    timeout: number
} | {
    type: WSMessageType.PEER_OFFER,
    myIdentity: {username: string},
    peerIdentity: {username: string},
    offer: {
        type: 'offer',
        sdp: string
    }
});

const socketsByIdentity = new Map<string, WebSocket>();

const respondToMessage = (message: WSMessage, ws: WebSocket): WSMessage | undefined => {
    switch (message.type) {
        case WSMessageType.IDENTIFY: {
            socketsByIdentity.set(message.myIdentity.username, ws);
            ws.addEventListener('close', () => {
                socketsByIdentity.delete(message.myIdentity.username);
            });
            return;
        }
        case WSMessageType.REQUEST_PEER: {
            return {
                connectionID: message.connectionID,
                type: WSMessageType.REQUEST_ACK,
                timeout: Date.now() + (60 * 1000)
            };
        }
        default: {
            throw new Error('Unknown message type');
        }
    }
};

const server = new WebSocketServer({port: config.port});

server.on('connection', ws => {
    ws.addEventListener('message', evt => {
        try {
            if (typeof evt.data !== 'string') return;
            const parsedData = JSON.parse(evt.data) as WSMessage;
            const message = respondToMessage(parsedData, ws);
            if (message) ws.send(message);
        } catch (err) {
            // swallow errors
        }
        //console.log(evt, evt.data);
    });
    console.log('Connection!');
    console.log(ws);
});

console.log(`Server running on port ${config.port}...`);
