import style from './style.scss';

import type {JSX} from 'preact';
import {useMemo, useState} from 'preact/hooks';

import importProfileAction from '../../actions/import-profile';

import {useAppState, useAction} from '../../util/state';

import Profile from '../../rtc/profile';

const PasswordPrompt = (): JSX.Element | null => {
    const importProfile = useAction(importProfileAction);
    const [password, setPassword] = useState('');
    const [errored, setErrored] = useState(false);

    const onPasswordInput = useMemo(() => (event: Event): void => {
        setPassword((event.target as HTMLInputElement).value);
    }, [setPassword]);

    const {savedProfile} = useAppState();

    const savedProfileValue = savedProfile.value;
    if (!savedProfileValue) return null;

    const decryptProfileIdentity = useMemo(() => async () => {
        try {
            const profile = await Profile.import(savedProfileValue, password);
            importProfile(profile, savedProfileValue);
        } catch (err) {
            setErrored(true);
        }
    }, [savedProfileValue, password]);

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
