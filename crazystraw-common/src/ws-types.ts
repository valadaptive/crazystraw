
export const enum GatewayMessageType {
    /** Sent from the client to the server to identify itself (via public key) upon connecting. */
    IDENTIFY,
    /** Sent from the server to the client; contains a random challenge string that the client must sign. */
    CHALLENGE,
    /** Sent in response to a CHALLENGE message; contains the digital signature for the challenge string. */
    CHALLENGE_RESPONSE,
    /** Sent in response to a successful CHALLENGE_RESPONSE. If failed, the connection is closed. */
    CHALLENGE_SUCCESS,
    /** Request a peer with a given identity. */
    REQUEST_PEER,
    /** Peer request was acknowledged. */
    REQUEST_ACK,
    /** A peer has responded to your request. */
    PEER_OFFER,
    /** Fetch all active peer requests. */
    GET_ALL_REQUESTS,
}

export const enum GatewayCloseCode {
    /** The client responded incorrectly to the challenge. */
    CHALLENGE_FAILED = 3000,
    /** This public key is already being used in another active session. */
    SESSION_EXISTS,
}

export type GatewayMessageBase = {
    /** Connection ID; used to disambiguate between different connections being established. */
    connectionID: string
};

export type GatewayMessage = GatewayMessageBase & ({
    type: GatewayMessageType.IDENTIFY,
    myIdentity: {username: string},
} | {
    type: GatewayMessageType.REQUEST_PEER,
    myIdentity: {username: string},
    peerIdentity: {username: string},
    offer: {
        type: 'offer',
        sdp: string
    }
} | {
    type: GatewayMessageType.REQUEST_ACK,
    timeout: number
} | {
    type: GatewayMessageType.PEER_OFFER,
    myIdentity: {username: string},
    peerIdentity: {username: string},
    offer: {
        type: 'offer',
        sdp: string
    }
});
