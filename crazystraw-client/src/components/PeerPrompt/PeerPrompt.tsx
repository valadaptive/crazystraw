import style from './style.scss';

import type {JSX} from 'preact';
import {useState, useMemo} from 'preact/hooks';

import Icon from '../Icon/Icon';

import createOutgoingPeerRequestAction from '../../actions/create-outgoing-peer-request';

import {useAppState, useAction, ProfileState} from '../../util/state';

const PeerPrompt = (): JSX.Element => {
    const {profileData} = useAppState();
    const createPeerRequest = useAction(createOutgoingPeerRequestAction);

    const [peerIdentityString, setPeerIdentityString] = useState('');

    const connect = (): void => {
        createPeerRequest(peerIdentityString);
    };

    const myFingerprint = useMemo(() => {
        if (profileData.value.state !== ProfileState.LOADED) return '';
        return profileData.value.identity.toBase64();
    }, [profileData.value]);

    const copyFingerprint = useMemo(() => () => {
        void navigator.clipboard.writeText(myFingerprint);
    }, [myFingerprint]);

    return (
        <div className={style.peerPrompt}>
            <div className={style.myFingerprint}>
                <Icon type="fingerprint" title="Copy my identity fingerprint to clipboard" onClick={copyFingerprint} />
                <div className={style.myFingerprintText}>{myFingerprint}</div>
            </div>
            <div className={style.divider} />
            <div>Add a new contact:</div>
            <div className={style.peerPromptRow}>
                <input
                    placeholder="Contact's fingerprint"
                    className={style.peerInput}
                    type="text"
                    value={peerIdentityString}
                    onInput={(event): void => {
                        setPeerIdentityString((event.target as HTMLInputElement).value);
                    }} />
                <button onClick={connect}>Connect</button>
            </div>
        </div>
    );
};

export default PeerPrompt;
