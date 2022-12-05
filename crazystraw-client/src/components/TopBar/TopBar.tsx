import style from './style.scss';

import type {JSX} from 'preact';
import {useMemo} from 'preact/hooks';
import {useComputed} from '@preact/signals';

import Avatar from '../Avatar/Avatar';
import GatewayConnectionIndicator from '../GatewayConnectionIndicator/GatewayConnectionIndicator';

import setProfileEditorOpenAction from '../../actions/set-profile-editor-open';

import {useAppState, useAction, ProfileState} from '../../util/state';

const TopBar = (): JSX.Element => {
    const {profileData} = useAppState();
    const setProfileEditorOpen = useAction(setProfileEditorOpenAction);

    const openProfileEditor = useMemo(() => () => setProfileEditorOpen(true), [setProfileEditorOpen]);

    const profileInfo = useComputed(() => {
        const profileState = profileData.value.state;
        const profileAndIdentity = profileState === ProfileState.LOADED ? profileData.value : null;
        const profile = profileAndIdentity?.profile;

        return <div className={style.profileInfo} onClick={openProfileEditor}>
            <Avatar size={32} data={profile?.value.avatar ?? null} />
            <div className={style.handle}>{profile?.value.handle ?? 'No user data'}</div>
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
