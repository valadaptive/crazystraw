import style from './style.scss';

import type {JSX} from 'preact';
import {useComputed} from '@preact/signals';

import Avatar from '../Avatar/Avatar';

import deleteProfileAction from '../../actions/delete-profile';

import bytesToHex from '../../util/bytes-to-hex';
import {useAppState, useAction} from '../../util/state';

const TopBar = (): JSX.Element => {
    const {profile} = useAppState();
    const deleteProfile = useAction(deleteProfileAction);

    const profileInfo = useComputed(() => {
        const profileData = profile.value;
        console.log(profile);

        return <div className={style.profileInfo}>
            <Avatar size={32} data={profileData?.avatar ?? null} />
            <div className={style.handle}>{profileData?.handle ?? 'No user data'}</div>
            {profileData ?
                <div className={style.fingerprint}>{bytesToHex(profileData.identity.publicKeyFingerprint)}</div> :
                null}
            {profileData ? <button onClick={deleteProfile}>Delete profile</button> : null}
        </div>;
    }).value;

    return (
        <div className={style.topBar}>
            {profileInfo}
        </div>
    );
};

export default TopBar;
