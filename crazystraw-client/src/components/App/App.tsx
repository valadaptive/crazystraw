import style from './style.scss';

import type {JSX} from 'preact';
import {useState, useMemo} from 'preact/hooks';
import {useComputed} from '@preact/signals';

import ContactsList from '../ContactsList/ContactsList';
import TopBar from '../TopBar/TopBar';
import PasswordPrompt from '../PasswordPrompt/PasswordPrompt';
import SetupPrompt from '../SetupPrompt/SetupPrompt';

import createOutgoingPeerRequestAction from '../../actions/create-outgoing-peer-request';

import {useAppState, useAction, ProfileState} from '../../util/state';

const App = (): JSX.Element => {
    const {profileData} = useAppState();
    const createPeerRequest = useAction(createOutgoingPeerRequestAction);

    const prompt = useComputed(() => {
        if (profileData.value.state === ProfileState.NONEXISTENT) {
            return (
                <SetupPrompt />
            );
        } else if (profileData.value.state === ProfileState.SAVED_BUT_NOT_LOADED) {
            return (
                <PasswordPrompt />
            );
        }
    }).value;

    const [peerIdentityString, setPeerIdentityString] = useState('');

    const connect = (): void => {
        createPeerRequest(peerIdentityString);
    };

    const peerPrompt = useMemo(() => (
        <div className={style.peerPrompt}>
            <div>Add a new contact:</div>
            <div className={style.peerPromptRow}>
                <input className={style.peerInput} type="text" value={peerIdentityString} onInput={(event): void => {
                    setPeerIdentityString((event.target as HTMLInputElement).value);
                }} />
                <button onClick={connect}>Connect</button>
            </div>
        </div>
    ), [peerIdentityString, setPeerIdentityString, connect]);

    return (
        <div className={style.app}>
            <TopBar />
            <div className={style.main}>
                {prompt ?? <>
                    <div className={style.contactsAndPeerPrompt}>
                        <ContactsList />
                        {peerPrompt}
                    </div>
                </>}
            </div>
        </div>
    );
};

export default App;
