import './global.scss';

import {render} from 'preact';

import App from './components/App/App';

import {AppContext, store} from './util/state';

render(
    <AppContext.Provider value={store}>
        <App />
    </AppContext.Provider>,
    document.body);
