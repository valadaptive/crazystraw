import style from './style.scss';

import type {JSX} from 'preact';
import {useRef, useLayoutEffect, useState, Ref} from 'preact/hooks';
import classNames from 'classnames';

export type MenuOption = {
    key: string,
    text: string,
    color?: 'red' | 'yellow' | 'green',
    onClick: () => unknown
};

export const DIVIDER: unique symbol = Symbol('DIVIDER');

const DropdownMenu = <T extends HTMLElement, >({options, render, visible, hideMenu}: {
    options: readonly (MenuOption | typeof DIVIDER | null)[],
    render: (ref: Ref<T | null>) => JSX.Element,
    visible: boolean,
    hideMenu: () => unknown
}): JSX.Element => {
    const parentRef = useRef<T>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<readonly [number, number]>([0, 0]);

    useLayoutEffect(() => {
        if (!parentRef.current || !menuRef.current) return;

        if (!visible) {
            setPosition([0, 0]);
            return;
        }

        const {height: menuHeight} = menuRef.current.getBoundingClientRect();
        const {x, y, height} = parentRef.current.getBoundingClientRect();
        let verticalOffset = y + height;
        if (menuHeight + verticalOffset > window.innerHeight) {
            verticalOffset = y - menuHeight;
        }
        setPosition([x, verticalOffset]);
        menuRef.current.focus();
    }, [visible]);

    const menu = visible ? (
        <div
            className={style.menu}
            style={{top: position[1], left: position[0]}}
            ref={menuRef}
            // eslint-disable-next-line react/no-unknown-property
            onfocusout={hideMenu}
            tabIndex={0}
        >
            {options.map(option => {
                if (option === DIVIDER) return <div className={style.divider} />;
                if (option === null) return null;
                return (
                    <div
                        key={option.key}
                        className={classNames(style.menuOption, {
                            [style.red]: option.color === 'red',
                            [style.yellow]: option.color === 'yellow',
                            [style.green]: option.color === 'green'
                        })}
                        onClick={(): void => {
                            option.onClick();
                            hideMenu();
                        }}
                    >{option.text}</div>
                );
            })}
        </div>
    ) : null;

    return <>
        {render(parentRef)}
        {menu}
    </>;
};

export default DropdownMenu;
