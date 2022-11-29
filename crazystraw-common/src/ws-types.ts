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
    PEER_REQUEST,
    /** Sent from the server to tell the client a peer has accepted its request. */
    PEER_REQUEST_ACCEPTED,
    /** Sent from the server to tell the client that a peer request was rejected by the peer. */
    PEER_REQUEST_REJECTED,
    /** Sent from the server in response to a REQUEST_PEER message when the peer is offline. */
    PEER_OFFLINE,
    /** Sent from the client to tell the server that a stored peer request was cancelled by the client. */
    PEER_REQUEST_CANCEL,

    /** Forward a WebRTC offer or answer between clients. */
    PEER_MESSAGE_DESCRIPTION,
    /** Forward an ICE candidate between clients. */
    PEER_ICE_CANDIDATE,

    /** Forward a WebRTC offer or answer between clients. */
    GOT_PEER_MESSAGE_DESCRIPTION,
    /** Forward an ICE candidate between clients. */
    GOT_PEER_ICE_CANDIDATE,

    /**
     * Sent from the server to a client that is on the receiving end of a peer request.
     * Pushed whenever another client makes a peer request to you, or in response to GET_ALL_REQUESTS.
     */
    GOT_PEER_REQUEST,
    /** Sent to inform the receiver of a GOT_PEER_REQUEST message that the request was cancelled. */
    GOT_PEER_REQUEST_CANCELLED,
    /** Sent from the client to accept a peer request. */
    PEER_ACCEPT,
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

type GatewayMessageBase = {
    /**
     * Sequence number; used to refer back to previous messages.
     * Generated monotonically; increments by 2. Clients use even numbers, servers use odd numbers.
     * This ensures there can be no accidental sequence number collisions.
     */
    seq: number
};

/** Peer negotiation message response */
type PeerMessageBase = GatewayMessageBase & {
    /**
     * Sequence number of the sent message.
     * Peer request messages will always be replied to by the gateway. Including this allows the client to send a peer
     * message then wait for a message whose "for" field is that message's sequence number.
     */
    for: number
};

export type IdentifyMessage = GatewayMessageBase & {
    type: GatewayMessageType.IDENTIFY,
    /** Peer's unique identity string, currently its public key fingerprint. */
    identity: string,
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

export type PeerRequestMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_REQUEST,
    /** Peer's unique identity string, currently its public key fingerprint. */
    peerIdentity: string,
    /** Unique ID for this WebRTC connection. */
    connectionID: string
};

export type PeerRequestAcceptedMessage = PeerMessageBase & {
    type: GatewayMessageType.PEER_REQUEST_ACCEPTED,
    /** Unique ID for this WebRTC connection. */
    connectionID: string
};

export type PeerRequestRejectedMessage = PeerMessageBase & {
    type: GatewayMessageType.PEER_REQUEST_REJECTED,
    /** Unique ID for this WebRTC connection. */
    connectionID: string
};

export type PeerOfflineMessage = PeerMessageBase & {
    type: GatewayMessageType.PEER_OFFLINE,
    /** Unique ID for this WebRTC connection. */
    connectionID: string
};

export type PeerRequestCancelMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_REQUEST_CANCEL,
    /** Peer's unique identity string, currently its public key fingerprint. */
    peerIdentity: string,
    /** Unique ID for this WebRTC connection. */
    connectionID: string
};

export type PeerMessageDescriptionMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_MESSAGE_DESCRIPTION,
    /** Peer's unique identity string, currently its public key fingerprint. */
    peerIdentity: string,
    /** Unique ID for this WebRTC connection. */
    connectionID: string,
    /** WebRTC session description. */
    description: RTCSessionDescriptionInit
};

export type PeerIceCandidateMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_ICE_CANDIDATE,
    /** Peer's unique identity string, currently its public key fingerprint. */
    peerIdentity: string,
    /** Unique ID for this WebRTC connection. */
    connectionID: string,
    /** ICE candidate, for WebRTC. */
    candidate: RTCIceCandidateInit
};

export type GotPeerMessageDescriptionMessage = GatewayMessageBase & {
    type: GatewayMessageType.GOT_PEER_MESSAGE_DESCRIPTION,
    /** Unique ID for this WebRTC connection. */
    connectionID: string,
    /** WebRTC session description. */
    description: RTCSessionDescriptionInit
};

export type GotPeerIceCandidateMessage = GatewayMessageBase & {
    type: GatewayMessageType.GOT_PEER_ICE_CANDIDATE,
    /** Unique ID for this WebRTC connection. */
    connectionID: string,
    /** ICE candidate, for WebRTC. */
    candidate: RTCIceCandidateInit
};

export type GotPeerRequestMessage = GatewayMessageBase & {
    type: GatewayMessageType.GOT_PEER_REQUEST,
    /** The identity of the peer requesting us. */
    peerIdentity: string,
    /** Unique ID for this WebRTC connection. */
    connectionID: string
};

export type GotPeerRequestCancelledMessage = GatewayMessageBase & {
    type: GatewayMessageType.GOT_PEER_REQUEST_CANCELLED,
    /** Unique ID for this WebRTC connection. */
    connectionID: string
};

export type PeerAcceptMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_ACCEPT,
    /** The identity of the peer requesting us. */
    peerIdentity: string,
    /** Unique ID for this WebRTC connection. */
    connectionID: string
};

export type PeerRejectMessage = GatewayMessageBase & {
    type: GatewayMessageType.PEER_REJECT,
    /** The identity of the peer requesting us. */
    peerIdentity: string,
    /** Unique ID for this WebRTC connection. */
    connectionID: string
};

export type ServerMessage =
    ChallengeMessage |
    ChallengeSuccessMessage |
    PeerRequestAcceptedMessage |
    PeerRequestRejectedMessage |
    PeerOfflineMessage |
    GotPeerMessageDescriptionMessage |
    GotPeerIceCandidateMessage |
    GotPeerRequestMessage |
    GotPeerRequestCancelledMessage;

export type ClientMessage =
    IdentifyMessage |
    ChallengeResponseMessage |
    PeerRequestMessage |
    PeerRequestCancelMessage |
    PeerMessageDescriptionMessage |
    PeerIceCandidateMessage |
    PeerAcceptMessage |
    PeerRejectMessage;

export type GatewayMessage = ServerMessage | ClientMessage;

export type Unsequenced<T> = T extends unknown
    ? Omit<T, 'seq'>
    : never;
