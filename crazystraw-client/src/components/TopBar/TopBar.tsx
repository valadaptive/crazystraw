import style from './style.scss';

import type {JSX} from 'preact';
import {useComputed} from '@preact/signals';
import {fromByteArray} from 'base64-js';

import Avatar from '../Avatar/Avatar';
import GatewayConnectionIndicator from '../GatewayConnectionIndicator/GatewayConnectionIndicator';

import setProfileAction from '../../actions/set-profile';

import {useAppState, useAction, ProfileState} from '../../util/state';

const TopBar = (): JSX.Element => {
    const {profileData} = useAppState();
    const setProfile = useAction(setProfileAction);

    const profileInfo = useComputed(() => {
        const profileState = profileData.value.state;
        const profile = profileState === ProfileState.LOADED ? profileData.value.profile : null;

        return <div className={style.profileInfo}>
            <Avatar size={32} data={profile?.avatar ?? null} />
            <div className={style.handle}>{profile?.handle ?? 'No user data'}</div>
            {profile ?
                <>
                    <div className={style.fingerprint}>{fromByteArray(profile.identity.publicKeyFingerprint)}</div>
                    <button onClick={(): unknown => setProfile(null)}>Delete profile</button>
                </> :
                null}
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
