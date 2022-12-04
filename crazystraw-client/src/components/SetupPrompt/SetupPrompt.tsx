import buttons from '../../css/buttons.scss';
import prompt from '../../css/prompt.scss';

import type {JSX} from 'preact';

import {useMemo, useState} from 'preact/hooks';

import createIdentityAction from '../../actions/create-identity';
import importSavedProfileAction from '../../actions/import-saved-profile';

import Avatar from '../Avatar/Avatar';

import {useAction} from '../../util/state';
import resizeAvatar from '../../util/resize-avatar';
import createFileUploadDialog from '../../util/create-file-upload-dialog';

const SetupPrompt = (): JSX.Element => {
    const createIdentity = useAction(createIdentityAction);
    const importSavedProfile = useAction(importSavedProfileAction);

    const [handle, setHandle] = useState('');
    const [bio, setBio] = useState('');
    const [password, setPassword] = useState('');

    const onHandleInput = useMemo(() => (event: Event) => {
        setHandle((event.target as HTMLInputElement).value);
    }, [setHandle]);

    const onBioInput = useMemo(() => (event: Event) => {
        setBio((event.target as HTMLTextAreaElement).value);
    }, [setBio]);

    const onPasswordInput = useMemo(() => (event: Event) => {
        setPassword((event.target as HTMLInputElement).value);
    }, [setPassword]);

    const [avatar, setAvatar] = useState<Blob | null>(null);

    const onClickUploadAvatar = useMemo(() => async () => {
        const file = await createFileUploadDialog({accept: 'image/*'});
        if (!file) return;

        const resized = await resizeAvatar(file);
        setAvatar(resized);
    }, [setAvatar]);

    const [importProfileError, setImportProfileError] = useState(false);
    const onClickImportProfile = useMemo(() => async () => {
        const profile = await createFileUploadDialog({accept: 'application/json'});
        if (!profile) return;
        try {
            const profileText = await profile.text();
            importSavedProfile(profileText);
        } catch (err) {
            setImportProfileError(true);
        }
    }, [importSavedProfile]);

    const handleCreateIdentity = useMemo(() => () => {
        createIdentity({
            handle,
            avatar,
            bio
        }, password);
    }, [handle, password]);

    return (
        <div className={prompt.prompt}>
            <div>This is your first time using CrazyStraw. Set up your profile:</div>
            <div className={prompt.row}>
                <label>Handle:</label>
                <input className={prompt.grow} type="text" value={handle} onInput={onHandleInput} />
            </div>
            <div className={prompt.row}>
                <label>Avatar (optional):</label>
                <button onClick={onClickUploadAvatar}>Upload</button>
                <Avatar size={64} data={avatar} />
            </div>
            <div className={prompt.stack}>
                <label>Bio (optional):</label>
                <textarea value={bio} onInput={onBioInput} />
            </div>
            <div className={prompt.divider} />

            <div className={prompt.row}>
                <label>Password:</label>
                <input className={prompt.grow} type="password" value={password} onInput={onPasswordInput} />
            </div>

            <button
                disabled={handle.length === 0 || password.length === 0}
                onClick={handleCreateIdentity}
                className={buttons.green}
            >Create</button>

            <div className={prompt.divider} />

            <div className={prompt.row}>
                <button onClick={onClickImportProfile}>Import existing profile</button>
                {importProfileError ? <div className={prompt.error}>Could not import profile.</div> : null}
            </div>
        </div>
    );
};

export default SetupPrompt;
