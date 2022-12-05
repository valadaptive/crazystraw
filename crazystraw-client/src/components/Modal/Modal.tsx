import style from './style.scss';

import type {JSX, RenderableProps} from 'preact';

const Modal = ({children, onClose}: RenderableProps<{
    onClose: () => void
}>): JSX.Element => {
    return (
        <div className={style.modalPositioner}>
            <div className={style.modalBackground} onClick={onClose} />
            <div className={style.modal}>
                {children}
            </div>
        </div>
    );
};

export default Modal;
