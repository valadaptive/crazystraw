import style from './style.scss';

import type {JSX} from 'preact';
import {useComputed} from '@preact/signals';
import {fromByteArray} from 'base64-js';

import Avatar from '../Avatar/Avatar';
import GatewayConnectionIndicator from '../GatewayConnectionIndicator/GatewayConnectionIndicator';

import deleteIdentityAction from '../../actions/delete-identity';

import {useAppState, useAction, ProfileState} from '../../util/state';

const TopBar = (): JSX.Element => {
    const {profileData} = useAppState();
    const deleteIdentity = useAction(deleteIdentityAction);

    const profileInfo = useComputed(() => {
        const profileState = profileData.value.state;
        const profileAndIdentity = profileState === ProfileState.LOADED ? profileData.value : null;
        const profile = profileAndIdentity?.profile;
        const identity = profileAndIdentity?.identity;

        return <div className={style.profileInfo}>
            <Avatar size={32} data={profile?.value.avatar ?? null} />
            <div className={style.handle}>{profile?.value.handle ?? 'No user data'}</div>
            {profile && identity ?
                <>
                    <div className={style.fingerprint}>{fromByteArray(identity.publicKeyFingerprint)}</div>
                    <button onClick={deleteIdentity}>Delete profile</button>
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
