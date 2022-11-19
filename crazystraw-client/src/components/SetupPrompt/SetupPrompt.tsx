import type {JSX} from 'preact';

import {useMemo, useState} from 'preact/hooks';

import createProfileAction from '../../actions/create-profile';

import {useAppState, useAction} from '../../util/state';
import resizeAvatar from '../../util/resize-avatar';
import createFileUploadDialog from '../../util/create-file-upload-dialog';
import useBlobURL from '../../util/use-blob-url';

const SetupPrompt = (): JSX.Element => {
    const createProfile = useAction(createProfileAction);

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
    const avatarURL = useBlobURL(avatar);

    const onClickUploadAvatar = useMemo(() => async () => {
        const file = await createFileUploadDialog({accept: 'image/*'});
        if (!file) return;

        const resized = await resizeAvatar(file);
        setAvatar(resized);
    }, [setAvatar]);

    const createIdentity = useMemo(() => () => {
        createProfile({
            handle,
            avatar,
            bio
        }, password);
    }, [handle, password]);

    return (
        <div>
            <div>It seems this is your first time using CrazyStraw. Enter some details:</div>
            <div>
                <label>Handle:</label>
                <input type="text" value={handle} onInput={onHandleInput} />
            </div>
            <div>
                <label>Avatar (optional):</label>
                <button onClick={onClickUploadAvatar}>Upload</button>
                {avatarURL ? <img src={avatarURL} /> : null}
            </div>
            <div>
                <label>Bio (optional):</label>
                <textarea value={bio} onInput={onBioInput} />
            </div>
            <hr />

            <div>
                <label>Password:</label>
                <input type="password" value={password} onInput={onPasswordInput} />
            </div>

            <button disabled={handle.length === 0 || password.length === 0} onClick={createIdentity}>Create</button>

            <hr />

            <div>
                <label>Or import an identity:</label>
                <input type="file" />
            </div>
        </div>
    );
};

export default SetupPrompt;
