import style from './style.scss';

import type {JSX} from 'preact';

import Avatar from '../Avatar/Avatar';
import Icon from '../Icon/Icon';

import Profile from '../../rtc/profile';

const ProfileInfo = ({profile, fingerprint}: {profile: Profile, fingerprint: string}): JSX.Element => {
    return (
        <div className={style.profileInfo}>
            <div className={style.upper}>
                <div className={style.avatar}>
                    <Avatar data={profile.avatar} size={64} />
                </div>
                <div className={style.handleAndFingerprint}>
                    <div className={style.handle}>{profile.handle}</div>
                    <div className={style.fingerprint}>
                        <Icon type="fingerprint" title="Identity fingerprint" />
                        <div className={style.fingerprintText}>{fingerprint}</div>
                    </div>
                </div>
            </div>
            {profile.bio ?
                <div className={style.bio}>
                    {profile.bio}
                </div> :
                null}
        </div>
    );
};

export default ProfileInfo;
