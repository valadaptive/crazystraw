import style from './style.scss';

import type {JSX} from 'preact';
import {useMemo, useState} from 'preact/hooks';

import setProfileAction from '../../actions/set-profile';

import {useAppState, useAction, ProfileState} from '../../util/state';

import {PersonalProfile} from '../../rtc/profile';

const PasswordPrompt = (): JSX.Element | null => {
    const setProfile = useAction(setProfileAction);
    const [password, setPassword] = useState('');
    const [errored, setErrored] = useState(false);

    const onPasswordInput = useMemo(() => (event: Event): void => {
        setPassword((event.target as HTMLInputElement).value);
    }, [setPassword]);

    const {profileData} = useAppState();

    if (profileData.value.state !== ProfileState.SAVED_BUT_NOT_LOADED) return null;
    const {savedProfile} = profileData.value;

    const decryptProfileIdentity = useMemo(() => async () => {
        try {
            const profile = await PersonalProfile.import(savedProfile, password);
            setProfile(profile);
        } catch (err) {
            setErrored(true);
        }
    }, [savedProfile, password]);

    return (
        <div>
            <div>Found existing profile data. Enter the password:</div>
            <input type="password" value={password} onInput={onPasswordInput} />
            <button onClick={decryptProfileIdentity}>Load</button>
            {errored ? <div className={style.error}>Incorrect password.</div> : null}
        </div>
    );
};

export default PasswordPrompt;
