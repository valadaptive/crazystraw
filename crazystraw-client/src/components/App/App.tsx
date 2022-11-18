import style from './style.scss';

import type {JSX} from 'preact';
import {useState, useMemo, useEffect} from 'preact/hooks';
import {useComputed} from '@preact/signals';

import TopBar from '../TopBar/TopBar';
import PasswordPrompt from '../PasswordPrompt/PasswordPrompt';
import SetupPrompt from '../SetupPrompt/SetupPrompt';

import generateIdentityAction from '../../actions/generate-identity';

import {ConnectionManager} from '../../rtc/gateway';

import {useAppState, useAction, UserDataState} from '../../util/state';

const CONNECTION_SERVER = 'ws://localhost:9876';
const App = (): JSX.Element => {
    const {userData, savedUserData, userDataState} = useAppState();
    const generateIdentity = useAction(generateIdentityAction);

    const prompt = useMemo(() => {
        if (userDataState.value === UserDataState.NONEXISTENT) {
            return (
                <SetupPrompt/>
            );
        } else if (userDataState.value === UserDataState.SAVED_BUT_NOT_LOADED) {
            return (
                <PasswordPrompt
                    onEnter={() => {}}
                    message="It seems this is your first time using CrazyStraw. Enter a password:"
                />
            );
        }
    }, [userDataState.value]);

    return (
        <div className={style.app}>
            <TopBar />
            {prompt}
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
