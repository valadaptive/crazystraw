import type {JSX} from 'preact';
import {useComputed} from '@preact/signals';

import {useAppState} from '../../util/state';

import {GatewayConnectionStateType} from '../../rtc/gateway';

const GatewayConnectionIndicator = (): JSX.Element => {
    const {gatewayConnection} = useAppState();

    const contents = useComputed(() => {
        if (!gatewayConnection.value) return 'No connection';

        const connectionState = gatewayConnection.value.state.value;
        switch (connectionState.type) {
            case GatewayConnectionStateType.CONNECTING:
                return 'Connecting...';
            case GatewayConnectionStateType.AUTHENTICATING:
                return 'Authenticating...';
            case GatewayConnectionStateType.CONNECTED:
                return 'Connected';
            case GatewayConnectionStateType.CLOSED:
                return `Connection closed (${connectionState.code} ${connectionState.reason})`;
        }
    }).value;

    return <div>{contents}</div>;
};

export default GatewayConnectionIndicator;
