import './global.scss';

import {render} from 'preact';

import App from './components/App/App';

import {AppContext, createStore} from './util/state';

const store = createStore();

render(
    <AppContext.Provider value={store}>
        <App />
    </AppContext.Provider>,
    document.body);
