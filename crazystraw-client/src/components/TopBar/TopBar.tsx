import style from './style.scss';

import type {JSX} from 'preact';
import {useComputed} from '@preact/signals';
import {fromByteArray} from 'base64-js';

import Avatar from '../Avatar/Avatar';
import GatewayConnectionIndicator from '../GatewayConnectionIndicator/GatewayConnectionIndicator';

import deleteProfileAction from '../../actions/delete-profile';

import {useAppState, useAction} from '../../util/state';

const TopBar = (): JSX.Element => {
    const {profile} = useAppState();
    const deleteProfile = useAction(deleteProfileAction);

    const profileInfo = useComputed(() => {
        const profileData = profile.value;

        return <div className={style.profileInfo}>
            <Avatar size={32} data={profileData?.avatar ?? null} />
            <div className={style.handle}>{profileData?.handle ?? 'No user data'}</div>
            {profileData ?
                <div className={style.fingerprint}>{fromByteArray(profileData.identity.publicKeyFingerprint)}</div> :
                null}
            {profileData ? <button onClick={deleteProfile}>Delete profile</button> : null}
        </div>;
    }).value;

    return (
        <div className={style.topBar}>
            {profileInfo}
            <div className={style.connectionIndicator}>
                <GatewayConnectionIndicator />
            </div>
        </div>
    );
};

export default TopBar;
