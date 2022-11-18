import type {JSX} from 'preact';

import {useMemo, useState} from 'preact/hooks';

import generateIdentityAction from '../../actions/generate-identity';

import {useAppState, useAction} from '../../util/state';
import resizeAvatar from '../../util/resize-avatar';
import createFileUploadDialog from '../../util/create-file-upload-dialog';

const SetupPrompt = (): JSX.Element => {
    const generateIdentity = useAction(generateIdentityAction);

    const [handle, setHandle] = useState('');
    const [password, setPassword] = useState('');

    const onHandleInput = useMemo(() => (event: Event) => {
        setHandle((event.target as HTMLInputElement).value);
    }, [setHandle]);

    const onPasswordInput = useMemo(() => (event: Event) => {
        setPassword((event.target as HTMLInputElement).value);
    }, [setPassword]);

    const [avatar, setAvatar] = useState<string | null>(null);

    const onClickUploadAvatar = useMemo(() => async () => {
        const file = await createFileUploadDialog({accept: 'image/*'});
        if (!file) return;

        const resized = await resizeAvatar(file);

        setAvatar(prevAvatar => {
            if (prevAvatar !== null) URL.revokeObjectURL(prevAvatar);
            return URL.createObjectURL(resized);
        });
    }, [setAvatar]);

    const createIdentity = useMemo(() => () => {
        generateIdentity({
            handle,
            avatar: null,
            bio: null
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
                {avatar ? <img src={avatar} /> : null}
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
