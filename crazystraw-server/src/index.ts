import {WebSocketServer, WebSocket} from 'ws';
import dotenv from 'dotenv';
import {randomBytes, subtle} from 'crypto';
import {setTimeout, clearTimeout} from 'timers';

import {
    GatewayMessage,
    GatewayMessageType,
    ChallengeMessage,
    GatewayCloseCode
} from 'crazystraw-common/ws-types';

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

const CHALLENGE_TIMEOUT = 5 * 1000;

//const socketsByIdentity = new Map<string, WebSocket>();

type ChallengeState = {
    publicKey: CryptoKey,
    challenge: Buffer,
    for: number,
    timeout: NodeJS.Timeout
};

const waitingChallenges = new WeakMap<WebSocket, ChallengeState>();

const respondToMessage = async (
    message: GatewayMessage,
    send: (message: Omit<GatewayMessage, 'seq'>) => Promise<number>,
    ws: WebSocket
): Promise<void> => {
    switch (message.type) {
        case GatewayMessageType.IDENTIFY: {
            let publicKey;
            try {
                publicKey = await subtle.importKey(
                    'raw',
                    Buffer.from(message.publicKey, 'base64'),
                    {name: 'ECDSA', namedCurve: 'P-256'},
                    true,
                    ['verify']
                );
            } catch (err) {
                ws.close(GatewayCloseCode.INVALID_FORMAT, 'Invalid public key format.');
                return;
            }

            const challenge = randomBytes(16);
            const ret = {
                type: GatewayMessageType.CHALLENGE,
                for: message.seq,
                challenge: challenge.toString('base64')
            };

            const challengeSeq = await send(ret);
            waitingChallenges.set(ws, {
                publicKey,
                challenge,
                for: challengeSeq,
                timeout: setTimeout(() => {
                    waitingChallenges.delete(ws);
                    ws.close(GatewayCloseCode.CHALLENGE_TIMEOUT, 'Challenge timed out');
                }, CHALLENGE_TIMEOUT)
            });
            return;
        }
        case GatewayMessageType.CHALLENGE_RESPONSE: {
            const waitingChallenge = waitingChallenges.get(ws);
            if (!waitingChallenge) {
                // This will also be thrown if the client responds just after the challenge times out.
                // No big deal.
                ws.close(GatewayCloseCode.INVALID_STATE, 'Challenge does not exist');
                return;
            }

            clearTimeout(waitingChallenge.timeout);

            if (waitingChallenge.for !== message.for) {
                ws.close(GatewayCloseCode.INVALID_STATE, 'Incorrect challenge response sequence number');
                return;
            }

            const responseSignature = Buffer.from(message.response, 'base64');

            try {
                const isValid = await subtle.verify(
                    {name: 'ECDSA', hash: 'SHA-256'},
                    waitingChallenge.publicKey,
                    responseSignature,
                    waitingChallenge.challenge
                );

                if (isValid) {
                    const resp = {
                        type: GatewayMessageType.CHALLENGE_SUCCESS,
                        for: waitingChallenge.for
                    };
                    await send(resp);
                } else {
                    ws.close(GatewayCloseCode.CHALLENGE_FAILED, 'Challenge failed');
                }
                return;
            } catch (err) {
                console.error(err);
                ws.close(GatewayCloseCode.INVALID_FORMAT, 'Invalid signature format');
            }

            break;
        }
        case GatewayMessageType.REQUEST_PEER: {
            /*return {
                connectionID: message.connectionID,
                type: GatewayMessageType.REQUEST_ACK,
                timeout: Date.now() + (60 * 1000)
            };*/
            break;
        }
        default: {
            throw new Error('Unknown message type');
        }
    }
};

const server = new WebSocketServer({port: config.port});

server.on('connection', ws => {
    let seq = 1;
    const send = (message: Omit<GatewayMessage, 'seq'>): Promise<number> => {
        const messageSeq = seq;
        (message as GatewayMessage).seq = messageSeq;
        seq += 2;
        return new Promise((resolve, reject) => {
            ws.send(JSON.stringify(message), err => {
                err ? reject() : resolve(messageSeq);
            });
        });
    };
    ws.addEventListener('message', evt => {
        try {
            if (typeof evt.data !== 'string') return;
            const parsedData = JSON.parse(evt.data) as GatewayMessage;
            void respondToMessage(parsedData, send, ws);
        } catch (err) {
            // swallow errors
        }
        //console.log(evt, evt.data);
    });
    console.log('Connection!');
    //console.log(ws);
});

console.log(`Server running on port ${config.port}...`);
