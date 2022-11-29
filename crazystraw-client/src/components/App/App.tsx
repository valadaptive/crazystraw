import style from './style.scss';

import type {JSX} from 'preact';
import {useState, useMemo, useEffect} from 'preact/hooks';
import {useComputed} from '@preact/signals';

import ContactsList from '../ContactsList/ContactsList';
import TopBar from '../TopBar/TopBar';
import PasswordPrompt from '../PasswordPrompt/PasswordPrompt';
import SetupPrompt from '../SetupPrompt/SetupPrompt';

import createProfileAction from '../../actions/create-profile';
import createPeerRequestAction from '../../actions/create-peer-request';

import {useAppState, useAction, ProfileState} from '../../util/state';

import {OutgoingPeerRequest} from '../../rtc/peer-request';
import {OTRChannelState} from '../../rtc/otr';

const App = (): JSX.Element => {
    const {profile, savedProfile, profileState} = useAppState();
    const createProfile = useAction(createProfileAction);
    const createPeerRequest = useAction(createPeerRequestAction);

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

    const connect = (): void => {
        createPeerRequest(peerIdentityString);
    };

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
};

export default App;
