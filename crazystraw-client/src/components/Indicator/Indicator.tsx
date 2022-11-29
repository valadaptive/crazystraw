import style from './style.scss';

import type {JSX} from 'preact';
import classNames from 'classnames';

export const enum IndicatorState {
    DISABLED,
    FAILED,
    LOADING,
    SUCCESS
}

const Indicator = ({state, size}: {state: IndicatorState, size: number | string}): JSX.Element => {
    const cssSize = typeof size === 'string' ? size : `${size}px`;

    const inlineStyle: JSX.DOMCSSProperties = {
        width: cssSize,
        height: cssSize,
        borderWidth: `calc(${cssSize} / 4)`
    };

    return <div className={classNames(
        style.indicator,
        {
            [style.disabled]: state === IndicatorState.DISABLED,
            [style.failed]: state === IndicatorState.FAILED,
            [style.loading]: state === IndicatorState.LOADING,
            [style.success]: state === IndicatorState.SUCCESS
        })
    } style={inlineStyle as JSX.CSSProperties} />;
};

export default Indicator;
