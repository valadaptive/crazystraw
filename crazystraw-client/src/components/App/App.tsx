import style from './style.scss';

import type {JSX} from 'preact';
import {useState, useMemo, useEffect} from 'preact/hooks';
import {useComputed} from '@preact/signals';

import ContactsList from '../ContactsList/ContactsList';
import TopBar from '../TopBar/TopBar';
import PasswordPrompt from '../PasswordPrompt/PasswordPrompt';
import SetupPrompt from '../SetupPrompt/SetupPrompt';

import createProfileAction from '../../actions/create-profile';

import {useAppState, useAction, ProfileState} from '../../util/state';

import {OutgoingPeerRequest} from '../../rtc/peer-request';
import {Identity} from '../../rtc/identity';

const App = (): JSX.Element => {
    const {profile, savedProfile, profileState, gatewayConnection} = useAppState();
    const createProfile = useAction(createProfileAction);

    const prompt = useComputed(() => {
        if (profileState.value === ProfileState.NONEXISTENT) {
            return (
                <SetupPrompt />
            );
        } else if (profileState.value === ProfileState.SAVED_BUT_NOT_LOADED) {
            return (
                <PasswordPrompt />
            );
        }
    }).value;

    const [peerIdentityString, setPeerIdentityString] = useState('');

    const gateway = gatewayConnection.value?.connection;
    const connect = async (): Promise<void> => {
        if (!gateway) return;
        const peerIdentity = await Identity.fromPublicKeyString(peerIdentityString);
        console.log(peerIdentity);
        new OutgoingPeerRequest(gateway, peerIdentity);
    };

    console.log(profile.value?.identity.toBase64());

    const peerPrompt = useMemo(() => (
        <div>
            <label>Peer identity (base64):</label>
            <input type="text" value={peerIdentityString} onInput={(event): void => {
                setPeerIdentityString((event.target as HTMLInputElement).value);
            }} />
            <button onClick={connect}>Connect</button>
        </div>
    ), [peerIdentityString, setPeerIdentityString, connect]);

    return (
        <div className={style.app}>
            <TopBar />
            {prompt}
            {peerPrompt}
            <ContactsList />
        </div>
    );

    /* An identity already exists. Please enter the decryption password: */

/*
    const [myUsername, setMyUsername] = useState('me');
    const [yourUsername, setYourUsername] = useState('you');

    const [connectionManager, setConnectionManager] = useState<ConnectionManager | null>(null);

    useEffect(() => {
        void ConnectionManager.create(CONNECTION_SERVER).then(cm => setConnectionManager(cm));
    }, []);

    const myUsernameInput = useMemo(() => <div>
        <label>My username</label>
        <input type="text" value={myUsername} onInput={(event): void => {
            setMyUsername((event.target as HTMLInputElement).value);
        }} />
    </div>, [myUsername, setMyUsername]);

    const yourUsernameInput = useMemo(() => <div>
        <label>Your username</label>
        <input type="text" value={yourUsername} onInput={(event): void => {
            setYourUsername((event.target as HTMLInputElement).value);
        }} />
    </div>, [yourUsername, setYourUsername]);

    const connect = useMemo(() => (
        () => {
            console.log(connectionManager);
            if (!connectionManager) return;
            console.log(connectionManager.createConnection({username: myUsername}, {username: yourUsername}));
        }
    ), [myUsername, yourUsername, connectionManager]);

    return (
        <div>
            {myUsernameInput}
            {yourUsernameInput}
            <button onClick={connect} disabled={connectionManager === null}>Connect</button>
        </div>
    );*/
};

export default App;
