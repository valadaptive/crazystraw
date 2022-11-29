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

    return <div className={style.indicatorWrapper} style={{width: cssSize, height: cssSize}}>
        <div className={classNames(
            style.indicator,
            {
                [style.disabled]: state === IndicatorState.DISABLED,
                [style.failed]: state === IndicatorState.FAILED,
                [style.loading]: state === IndicatorState.LOADING,
                [style.success]: state === IndicatorState.SUCCESS
            })
        } style={{width: cssSize, height: cssSize, borderWidth: `calc(${cssSize} / 4)`}} />
    </div>;
};

export default Indicator;
