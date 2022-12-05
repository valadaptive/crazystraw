import style from './style.scss';

import type {JSX} from 'preact';
import classNames from 'classnames';

type IconType = 'connection' | 'chatBubble' | 'cancel' | 'x' | 'check' | 'upload' | 'fingerprint' | 'arrowDown';

const Icon = ({type, title, size, onClick, disabled, color}: {
    type: IconType,
    title: string,
    size?: string | number,
    onClick?: () => unknown,
    disabled?: boolean,
    color?: 'red' | 'yellow' | 'green'
}): JSX.Element => {
    const cssSize = typeof size === 'string' ? size : typeof size === 'number' ? `${size}px` : undefined;
    const inlineStyle = cssSize ? {
        width: cssSize,
        height: cssSize
    } : undefined;
    return (
        <div
            className={classNames(
                style.icon,
                style[type],
                color ? style[color] : null,
                {
                    [style.button]: onClick,
                    [style.disabled]: disabled
                }
            )}
            style={inlineStyle}
            onClick={disabled ? undefined : onClick}
            title={title}
        />
    );
};

export default Icon;
