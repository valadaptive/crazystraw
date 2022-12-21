import style from './style.scss';
import buttons from '../../css/buttons.scss';

import type {JSX} from 'preact';
import {useState, useMemo} from 'preact/hooks';

import Avatar from '../Avatar/Avatar';
import Icon from '../Icon/Icon';

import {useAppState, useAction, ProfileState} from '../../util/state';
import createFileUploadDialog from '../../util/create-file-upload-dialog';
import resizeAvatar from '../../util/resize-avatar';
import {generateID} from '../../util/id';

import deleteIdentityAction from '../../actions/delete-identity';
import setProfileEditorOpenAction from '../../actions/set-profile-editor-open';
import setProfileAction from '../../actions/set-profile';

import Profile from '../../rtc/profile';

const ProfileEditor = (): JSX.Element | null => {
    const {profileData} = useAppState();
    const deleteIdentity = useAction(deleteIdentityAction);
    const setProfileEditorOpen = useAction(setProfileEditorOpenAction);
    const setProfile = useAction(setProfileAction);
    const profile = profileData.value.state === ProfileState.LOADED ? profileData.value.profile.value : null;

    const [handle, setHandle] = useState(profile?.handle ?? '');
    const [bio, setBio] = useState(profile?.bio ?? '');
    const [avatar, setAvatar] = useState(profile?.avatar ?? null);

    const handleHandleInput = useMemo(() => (event: Event): void => {
        setHandle((event.target as HTMLInputElement).value);
    }, [setHandle]);

    const handleBioInput = useMemo(() => (event: Event): void => {
        setBio((event.target as HTMLTextAreaElement).value);
    }, [setBio]);

    const onClickUploadAvatar = useMemo(() => async () => {
        const file = await createFileUploadDialog({accept: 'image/*'});
        if (!file) return;

        const resized = await resizeAvatar(file);
        setAvatar(resized);
    }, [setAvatar]);

    const clearAvatar = useMemo(() => () => setAvatar(null), [setAvatar]);

    const close = useMemo(() => () => {
        setProfileEditorOpen(false);
    }, [setProfileEditorOpen]);

    const saveProfile = useMemo(() => () => {
        setProfile(new Profile(generateID(), handle, avatar, bio === '' ? null : bio));
        close();
    }, [handle, avatar, bio]);

    if (profileData.value.state !== ProfileState.LOADED) return null;
    const identity = profileData.value.identity;
    const fingerprint = identity.toBase64();

    return (
        <div className={style.profileEditor}>
            <div className={style.upper}>
                <div className={style.avatar}>
                    <div className={style.avatarButtons}>
                        <Icon type="upload" title="Upload new avatar" onClick={onClickUploadAvatar} />
                        <Icon type="x" title="Remove avatar" disabled={avatar === null} onClick={clearAvatar} />
                    </div>
                    <Avatar data={avatar} size={64} />
                </div>
                <div className={style.handleAndFingerprint}>
                    <input type="text" className={style.handle} value={handle} onInput={handleHandleInput} />
                    <div className={style.fingerprint}>
                        <Icon type="fingerprint" title="Identity fingerprint" />
                        <div className={style.fingerprintText}>{fingerprint}</div>
                    </div>
                </div>
            </div>
            <textarea
                className={style.bio}
                placeholder="About me..."
                value={bio}
                onInput={handleBioInput}
                rows={4}
            />
            <div className={style.buttons}>
                <button onClick={deleteIdentity} className={buttons.red}>Delete profile</button>
                <div className={style.spacer} />
                <button onClick={close}>Cancel</button>
                <button onClick={saveProfile} className={buttons.green}>Save</button>
            </div>
        </div>
    );
};

export default ProfileEditor;
