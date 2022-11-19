export const enum GatewayMessageType {
    /** Sent from the client to identify itself (via public key) upon connecting. */
    IDENTIFY,
    /** Sent from the server; contains a random challenge string that the client must sign. */
    CHALLENGE,
    /**
     * Sent from the client in response to a CHALLENGE message;
     * contains the digital signature for the challenge string.
     */
    CHALLENGE_RESPONSE,
    /** Sent from the server in response to a successful CHALLENGE_RESPONSE. If failed, the connection is closed. */
    CHALLENGE_SUCCESS,
    /** Sent from the client to request a peer with a given identity. */
    REQUEST_PEER,
    /** Sent from the server to acknowledge a REQUEST_PEER message. */
    REQUEST_PEER_ACK,
    /** Sent from the server to tell the client a peer has responded to its request. */
    PEER_ANSWER,
    /** Sent from the client to tell the server that a peer request was cancelled by the client. */
    REQUEST_PEER_CANCEL,
    /** Sent from the server to tell the client that a peer request timed out on the server. */
    REQUEST_PEER_TIMEOUT,
    /** Sent from the server to tell the client that a peer request was rejected by the peer. */
    REQUEST_PEER_REJECT,
    /** Sent from the client to fetch all pending peer requests. */
    GET_ALL_REQUESTS,
    /**
     * Sent from the server to a client that is on the receiving end of a peer request.
     * Pushed whenever another client makes a peer request to you, or in response to GET_ALL_REQUESTS.
     */
    GOT_PEER_REQUEST,
    /** Sent from the client to respond to a peer request. */
    PEER_RESPONSE,
    /** Sent from the client to reject a peer request. */
    PEER_REJECT
}

export const enum GatewayCloseCode {
    /** The client responded incorrectly to the challenge. */
    CHALLENGE_FAILED = 3000,
    /** The client did not respond to the challenge in time. */
    CHALLENGE_TIMEOUT,
    /** This public key is already being used in another active session. */
    SESSION_EXISTS,
    /** The client sent a message that is not valid at this point in time. */
    INVALID_STATE,
    /** Some data sent by the client or server is of an invalid format. */
    INVALID_FORMAT,
    /** The client attempted to perform an action which requires authentication, but did not authenticate. */
    NOT_AUTHENTICATED,
    /** Another client is already logged in using the same public key */
    EXISTING_SESSION
}

/** Connection ID; used to disambiguate between different connections being established. */

export type GatewayMessageBase = {
    /**
     * Sequence number; used to refer back to previous messages.
     * Generated monotonically; increments by 2. Clients use even numbers, servers use odd numbers.
     * This ensures there can be no accidental sequence number collisions.
     */
    seq: number
};

export type IdentifyMessage = GatewayMessageBase & {
    type: GatewayMessageType.IDENTIFY,
    /** ECDSA public key in raw format, encoded into base64. */
    publicKey: string
};

export type ChallengeMessage = GatewayMessageBase & {
    type: GatewayMessageType.CHALLENGE,
    /** Sequence number of the original identify message. */
    for: number,
    /** Random string that the client must sign to prove they have the key pair they identified themselves with. */
    challenge: string
};

export type ChallengeResponseMessage = GatewayMessageBase & {
    type: GatewayMessageType.CHALLENGE_RESPONSE,
    /** Sequence number of the challenge message. */
    for: number,
    /** Signature for the challenge string, encoded into base64. */
    response: string
};

export type ChallengeSuccessMessage = GatewayMessageBase & {
    type: GatewayMessageType.CHALLENGE_SUCCESS,
    /** Sequence number of the challenge message. */
    for: number
};

export type RequestPeerMessage = GatewayMessageBase & {
    type: GatewayMessageType.REQUEST_PEER,
    /** The peer's public key, encoded into base64. */
    peerIdentity: string,
    /** SDP offer, for WebRTC. */
    offer: {
        type: 'offer',
        sdp: string
    }
};

export type RequestPeerAckMessage = GatewayMessageBase & {
    type: GatewayMessageType.REQUEST_PEER_ACK,
    /** Approximate timestamp after which the request will time out. */
    timeout: number
};

export type PeerAnswerMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_ANSWER,
    /** Sequence number of the original REQUEST_PEER message. */
    for: number,
    /** SDP answer, for WebRTC. */
    answer: {
        type: 'answer',
        sdp: string
    }
};

export type RequestPeerCancelMessage = GatewayMessageBase & {
    type: GatewayMessageType.REQUEST_PEER_CANCEL,
    /** The peer's public key, encoded into base64. */
    peerIdentity: string
};

export type RequestPeerTimeoutMessage = GatewayMessageBase & {
    type: GatewayMessageType.REQUEST_PEER_TIMEOUT,
    /** Sequence number of the original REQUEST_PEER message. */
    for: number
};

export type RequestPeerRejectMessage = GatewayMessageBase & {
    type: GatewayMessageType.REQUEST_PEER_REJECT,
    /** Sequence number of the original REQUEST_PEER message. */
    for: number
};

export type GetAllRequestsMessage = GatewayMessageBase & {
    type: GatewayMessageType.GET_ALL_REQUESTS
};

export type GotPeerRequestMessage = GatewayMessageBase & {
    type: GatewayMessageType.GOT_PEER_REQUEST,
    /** The public key of the peer requesting us, encoded into base64. */
    peerIdentity: string,
    /** SDP offer of the peer. */
    offer: {
        type: 'offer',
        sdp: string
    }
};

export type PeerResponseMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_RESPONSE,
    /** The public key of the peer requesting us, encoded into base64. */
    peerIdentity: string,
    /** SDP answer, for WebRTC. */
    answer: {
        type: 'answer',
        sdp: string
    }
};

export type PeerRejectMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_REJECT,
    /** The sequence number of the original GOT_PEER_REQUEST message. */
    for: number
};

export type GatewayMessage =
IdentifyMessage |
ChallengeMessage |
ChallengeResponseMessage |
ChallengeSuccessMessage |
RequestPeerMessage |
RequestPeerAckMessage |
PeerAnswerMessage |
RequestPeerCancelMessage |
RequestPeerTimeoutMessage |
RequestPeerRejectMessage |
GetAllRequestsMessage |
GotPeerRequestMessage |
PeerResponseMessage |
PeerRejectMessage;
