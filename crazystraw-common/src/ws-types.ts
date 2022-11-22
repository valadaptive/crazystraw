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
    /**
     * Sent from the server in response to a REQUEST_PEER message
     */
    PEER_REQUEST_ACK,
    /** Sent from the server to tell the client a peer has responded to its request. */
    PEER_ANSWER,
    /** Sent from the client to tell the server that a stored peer request was cancelled by the client. */
    PEER_REQUEST_CANCEL,
    /**
     * Sent from the server to tell the client that a stored peer request timed out on the server before the requested
     * peer connected.
     */
    PEER_REQUEST_TIMED_OUT,
    /** Sent from the server to tell the client that a peer request was rejected by the peer. */
    PEER_REQUEST_REJECTED,
    /** Sent from the client to fetch all pending peer requests. */
    GET_ALL_REQUESTS,
    /**
     * Sent from the server to a client that is on the receiving end of a peer request.
     * Pushed whenever another client makes a peer request to you, or in response to GET_ALL_REQUESTS.
     */
    GOT_PEER_REQUEST,
    /** Sent to cancel a previous GOT_PEER_REQUEST message. */
    GOT_PEER_REQUEST_CANCEL,
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
    EXISTING_SESSION,
    /** A certain resource has been exceeeded e.g. too many open peer requests. */
    RESOURCE_EXCEEDED
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

export type PeerRequestAckMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_REQUEST_ACK,
    /** Sequence number of the original REQUEST_PEER message. */
    for: number,
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

export type PeerRequestCancelMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_REQUEST_CANCEL,
    /** The peer's public key, encoded into base64. */
    peerIdentity: string
};

export type PeerRequestTimedOutMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_REQUEST_TIMED_OUT,
    /** Sequence number of the original REQUEST_PEER message. */
    for: number
};

export type PeerRequestRejectedMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_REQUEST_REJECTED,
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
    },
    /** Timestamp at which the server will time this peer request out. */
    timeout: number
};

export type GotPeerRequestCancelMessage = GatewayMessageBase & {
    type: GatewayMessageType.GOT_PEER_REQUEST_CANCEL,
    /** Sequence number of the original GOT_PEER_REQUEST message. */
    for: number
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
    /** The public key of the peer requesting us, encoded into base64. */
    peerIdentity: string
};

export type GatewayMessage =
IdentifyMessage |
ChallengeMessage |
ChallengeResponseMessage |
ChallengeSuccessMessage |
RequestPeerMessage |
PeerRequestAckMessage |
PeerAnswerMessage |
PeerRequestCancelMessage |
PeerRequestTimedOutMessage |
PeerRequestRejectedMessage |
GetAllRequestsMessage |
GotPeerRequestMessage |
GotPeerRequestCancelMessage |
PeerResponseMessage |
PeerRejectMessage;
