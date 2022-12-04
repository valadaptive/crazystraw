import style from './style.scss';

import type {JSX} from 'preact';
import classNames from 'classnames';

type FileIconName =
 | 'audio'
 | 'font'
 | 'image'
 | 'json'
 | 'misc'
 | 'model'
 | 'text'
 | 'video'
 | 'xml';

const MIMETYPE_REGEX = /([a-z]+)\/((?:[a-z_-]+\.)*[a-z_-]+)(?:\+([a-z_-]+))?/;

const fileTypeToIcon = (filetype: string): FileIconName => {
    const mimeParts = MIMETYPE_REGEX.exec(filetype);
    if (!mimeParts) return 'misc';
    const [type,, suffix] = mimeParts;

    if (type === 'application') {
        if (suffix === 'xml' || suffix === 'json') return suffix;
        return 'misc';
    }

    if (
        type === 'audio' ||
        type === 'font' ||
        type === 'image' ||
        type === 'json' ||
        type === 'misc' ||
        type === 'model' ||
        type === 'text' ||
        type === 'video' ||
        type === 'xml'
    ) return type;

    return 'misc';
};

const FileIcon = ({filetype, size}: {
    filetype: string,
    size?: string | number
}): JSX.Element => {
    const cssSize = typeof size === 'string' ? size : typeof size === 'number' ? `${size}px` : undefined;
    const inlineStyle = cssSize ? {
        width: cssSize,
        height: cssSize
    } : undefined;

    const iconName = fileTypeToIcon(filetype);

    return (
        <div
            className={classNames(style.fileIcon, style[iconName])}
            style={inlineStyle}
            title={filetype}
        />
    );
};

export default FileIcon;
