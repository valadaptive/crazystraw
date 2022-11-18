import {WebSocketServer, WebSocket} from 'ws';
import dotenv from 'dotenv';

import {
    GatewayMessage,
    GatewayMessageType
} from 'crazystraw-common/ws-types';

console.log('hi');

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
const socketsByIdentity = new Map<string, WebSocket>();

const respondToMessage = (message: GatewayMessage, ws: WebSocket): GatewayMessage | undefined => {
    switch (message.type) {
        case GatewayMessageType.IDENTIFY: {
            socketsByIdentity.set(message.myIdentity.username, ws);
            ws.addEventListener('close', () => {
                socketsByIdentity.delete(message.myIdentity.username);
            });
            return;
        }
        case GatewayMessageType.REQUEST_PEER: {
            return {
                connectionID: message.connectionID,
                type: GatewayMessageType.REQUEST_ACK,
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
            const parsedData = JSON.parse(evt.data) as GatewayMessage;
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
