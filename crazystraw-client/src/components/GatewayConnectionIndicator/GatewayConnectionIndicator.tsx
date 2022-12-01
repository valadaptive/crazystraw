import style from './style.scss';

import type {JSX} from 'preact';
import {useMemo} from 'preact/hooks';

import {useGatewayConnection} from '../../util/state';

import Indicator, {IndicatorState} from '../Indicator/Indicator';
import Icon from '../Icon/Icon';

import {GatewayConnectionStateType} from '../../rtc/gateway';

const GatewayConnectionIndicator = (): JSX.Element => {
    const gatewayConnection = useGatewayConnection();

    const [message, indicatorState] = useMemo(() => {
        if (!gatewayConnection) return ['No connection', IndicatorState.DISABLED] as const;

        const connectionState = gatewayConnection.state.value;
        switch (connectionState.type) {
            case GatewayConnectionStateType.CONNECTING:
                return ['Connecting...', IndicatorState.LOADING] as const;
            case GatewayConnectionStateType.AUTHENTICATING:
                return ['Authenticating...', IndicatorState.LOADING] as const;
            case GatewayConnectionStateType.CONNECTED:
                return ['Connected', IndicatorState.SUCCESS] as const;
            case GatewayConnectionStateType.CLOSED:
                return [`Connection closed (${connectionState.reason})`, IndicatorState.FAILED] as const;
        }
    }, [gatewayConnection?.state.value]);

    return (
        <div className={style.connectionIndicator}>
            <Icon type="connection" title="Gateway connection" />
            <div className={style.message}>{message}</div>
            <Indicator state={indicatorState} size="16px" />
        </div>
    );
};

export default GatewayConnectionIndicator;
