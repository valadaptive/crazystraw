import style from './style.scss';

import type {JSX} from 'preact';
import {useMemo} from 'preact/hooks';
import {useComputed} from '@preact/signals';

import ChatView from '../ChatView/ChatView';
import ContactsList from '../ContactsList/ContactsList';
import Modal from '../Modal/Modal';
import TopBar from '../TopBar/TopBar';
import PasswordPrompt from '../PasswordPrompt/PasswordPrompt';
import PeerPrompt from '../PeerPrompt/PeerPrompt';
import ProfileEditor from '../ProfileEditor/ProfileEditor';
import ProfileInfo from '../ProfileInfo/ProfileInfo';
import SetupPrompt from '../SetupPrompt/SetupPrompt';

import setViewedProfileAction from '../../actions/set-viewed-profile';
import setProfileEditorOpenAction from '../../actions/set-profile-editor-open';

import {useAppState, useAction, ProfileState} from '../../util/state';

const App = (): JSX.Element => {
    const {profileData, viewedProfile, contacts, profileEditorOpen} = useAppState();
    const setViewedProfile = useAction(setViewedProfileAction);
    const setProfileEditorOpen = useAction(setProfileEditorOpenAction);

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

        if (profileEditorOpen.value) {
            return (
                <Modal onClose={(): void => setProfileEditorOpen(false)}>
                    <ProfileEditor />
                </Modal>
            );
        }
    }, [viewedProfile.value, profileData.value, profileEditorOpen.value]);

    return (
        <div className={style.app}>
            {prompt ?? <>
                <TopBar />
                <div className={style.main}>
                    <div className={style.contactsAndPeerPrompt}>
                        <ContactsList />
                        <PeerPrompt />
                    </div>
                    <ChatView />
                </div>
            </>}
            {modal}
        </div>
    );
};

export default App;
