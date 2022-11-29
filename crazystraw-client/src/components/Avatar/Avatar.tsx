import style from './style.scss';

import type {JSX} from 'preact';

import useBlobURL from '../../util/use-blob-url';

import defaultAvatar from '../../assets/default-avatar.svg';

const Avatar = ({size, data}: {
    /** Image dimensions. */
    size: number,
    /** Blob containing image data, data URI, or null for default avatar. */
    data: Blob | string | null
}): JSX.Element => {
    const avatarURL = useBlobURL(typeof data === 'string' ? null : data);
    const avatarURI = typeof data === 'string' ? data : avatarURL;

    return (
        <img
            className={style.avatar}
            src={avatarURI ?? defaultAvatar}
            width={size}
            height={size}
        />
    );
};

export default Avatar;
