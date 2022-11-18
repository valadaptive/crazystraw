import style from './style.scss';

import type {JSX} from 'preact';
import {useComputed} from '@preact/signals';

import Avatar from '../Avatar/Avatar';

import {useAppState, useAction, UserDataState} from '../../util/state';

const TopBar = (): JSX.Element => {
    const {userData} = useAppState();

    const profileInfo = useComputed(() => {
        const profile = userData.value?.profile.value;
        console.log(profile);
        return <>
            <Avatar size={32} data={profile?.avatar ?? null} />
            <div className={style.handle}>{profile?.handle ?? 'No user data'}</div>
        </>;
    }).value;

    return (
        <div className={style.topBar}>
            {profileInfo}
        </div>
    );
};

export default TopBar;
