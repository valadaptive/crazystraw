import buttons from '../../css/buttons.scss';
import prompt from '../../css/prompt.scss';

import type {JSX} from 'preact';
import {useMemo, useState} from 'preact/hooks';

import setProfileAction from '../../actions/set-profile';

import {useAppState, useAction, ProfileState} from '../../util/state';
import saveToFile from '../../util/save-to-file';

import {PersonalProfile} from '../../rtc/profile';

const PasswordPrompt = (): JSX.Element | null => {
    const {profileData} = useAppState();
    const setProfile = useAction(setProfileAction);

    const [password, setPassword] = useState('');
    const [errored, setErrored] = useState(false);

    let savedProfile: string | null = null;
    if (profileData.value.state === ProfileState.SAVED_BUT_NOT_LOADED) savedProfile = profileData.value.savedProfile;

    const decryptProfileIdentity = useMemo(() => async () => {
        if (!savedProfile) return null;
        try {
            const profile = await PersonalProfile.import(savedProfile, password);
            setProfile(profile);
        } catch (err) {
            setErrored(true);
        }
    }, [savedProfile, password]);

    const saveProfile = useMemo(() => () => {
        if (savedProfile) saveToFile('profile.json', savedProfile);
    }, [savedProfile]);

    const onPasswordInput = useMemo(() => (event: Event): void => {
        setPassword((event.target as HTMLInputElement).value);
    }, [setPassword]);

    const onPasswordKeyDown = useMemo(() => (event: KeyboardEvent): void => {
        if (event.key === 'Enter') void decryptProfileIdentity();
    }, [decryptProfileIdentity]);

    if (profileData.value.state !== ProfileState.SAVED_BUT_NOT_LOADED) return null;

    return (
        <div className={prompt.prompt}>
            <div className={prompt.heading}>Found existing profile data. Enter the password:</div>
            <div className={prompt.row}>
                <input
                    className={prompt.grow}
                    type="password"
                    value={password}
                    onInput={onPasswordInput}
                    onKeyDown={onPasswordKeyDown}
                />
                <button onClick={decryptProfileIdentity}>Load</button>
            </div>

            {errored ? <div className={prompt.error}>Incorrect password.</div> : null}

            <div className={prompt.divider} />

            <div className={prompt.row}>
                <button onClick={saveProfile}>Save profile</button>
                <button onClick={(): void => setProfile(null)} className={buttons.red}>Delete profile</button>
            </div>
        </div>
    );
};

export default PasswordPrompt;
