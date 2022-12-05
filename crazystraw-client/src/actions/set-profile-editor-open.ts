import {AppState} from '../util/state';

const setProfileEditorOpen = (store: AppState, open: boolean): void => {
    store.profileEditorOpen.value = open;
};

export default setProfileEditorOpen;
