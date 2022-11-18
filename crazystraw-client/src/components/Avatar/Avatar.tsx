import style from './style.scss';

import type {JSX} from 'preact';

import useBlobURL from '../../util/use-blob-url';

import defaultAvatar from '../../assets/default-avatar.svg';

const Avatar = ({size, data}: {
    size: number,
    data: Blob | null
}): JSX.Element => {
    const avatarURL = useBlobURL(data);

    return (
        <img
            className={style.avatar}
            src={avatarURL ?? defaultAvatar}
            width={size}
            height={size}
        />
    );
};

export default Avatar;
