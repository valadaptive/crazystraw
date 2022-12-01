import './fonts.css';
import './global.scss';
import './css/buttons.scss';

import 'webrtc-adapter';
import {render} from 'preact';

import App from './components/App/App';

import './util/id';

import {AppContext, createStore} from './util/state';

const store = createStore();

render(
    <AppContext.Provider value={store}>
        <App />
    </AppContext.Provider>,
    document.body);
