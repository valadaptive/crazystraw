import style from './style.scss';

import type {JSX} from 'preact';
import {useState, useMemo} from 'preact/hooks';
import {useComputed} from '@preact/signals';

import ChatView from '../ChatView/ChatView';
import ContactsList from '../ContactsList/ContactsList';
import Modal from '../Modal/Modal';
import TopBar from '../TopBar/TopBar';
import PasswordPrompt from '../PasswordPrompt/PasswordPrompt';
import ProfileInfo from '../ProfileInfo/ProfileInfo';
import SetupPrompt from '../SetupPrompt/SetupPrompt';

import setViewedProfileAction from '../../actions/set-viewed-profile';
import createOutgoingPeerRequestAction from '../../actions/create-outgoing-peer-request';

import {useAppState, useAction, ProfileState} from '../../util/state';

const App = (): JSX.Element => {
    const {profileData, viewedProfile, contacts} = useAppState();
    const createPeerRequest = useAction(createOutgoingPeerRequestAction);
    const setViewedProfile = useAction(setViewedProfileAction);

    const prompt = useComputed(() => {
        const profileState = profileData.value.state;
        if (profileState === ProfileState.NONEXISTENT) {
            return (
                <SetupPrompt />
            );
        } else if (profileState === ProfileState.SAVED_BUT_NOT_LOADED || profileState === ProfileState.LOADING) {
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

    const modal = useMemo(() => {
        const profileToShow = viewedProfile.value;
        if (profileToShow !== null) {
            const myProfile = profileData.value.state === ProfileState.LOADED ? profileData.value : null;
            let profile = contacts.value[profileToShow]?.value.profile;
            if (!profile && profileToShow === myProfile?.identity.toBase64()) {
                profile = myProfile.profile.value;
            }
            if (!profile) return null;

            return (
                <Modal onClose={(): void => setViewedProfile(null)}>
                    <ProfileInfo profile={profile} fingerprint={profileToShow} />
                </Modal>
            );
        }
    }, [viewedProfile.value, profileData.value]);

    return (
        <div className={style.app}>
            {prompt ?? <>
                <TopBar />
                <div className={style.main}>
                    <div className={style.contactsAndPeerPrompt}>
                        <ContactsList />
                        {peerPrompt}
                    </div>
                    <ChatView />
                </div>
            </>}
            {modal}
        </div>
    );
};

export default App;
