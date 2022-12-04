import style from './style.scss';

import type {JSX} from 'preact';

import FileIcon from '../FileIcon/FileIcon';

import ChatAttachment from '../../rtc/attachment';

import useBlobURL from '../../util/use-blob-url';
import formatFileSize from '../../util/format-file-size';

const MAX_IMAGE_WIDTH = 600;
const MAX_IMAGE_HEIGHT = 400;

const Attachment = ({attachment}: {
    attachment: ChatAttachment
}): JSX.Element => {
    const url = useBlobURL(attachment.data);

    let inner;
    if (attachment.isViewableImage) {
        const inlineStyle: JSX.CSSProperties = {};
        if (attachment.width && attachment.height) {
            // Calculate the image's fixed size from its given dimensions
            const scaleFactor = Math.min(MAX_IMAGE_WIDTH / attachment.width, MAX_IMAGE_HEIGHT / attachment.height, 1);
            inlineStyle.width = `${attachment.width * scaleFactor}px`;
            inlineStyle.height = `${attachment.height * scaleFactor}px`;
        } else {
            // This works even without knowing the image's dimensions, but causes reflow after the image loads
            inlineStyle.maxWidth = `${MAX_IMAGE_WIDTH}px`;
            inlineStyle.maxHeight = `${MAX_IMAGE_HEIGHT}px`;
            inlineStyle.width = 'auto';
            inlineStyle.height = 'auto';
        }

        inner = <img
            src={url}
            className={style.attachmentImage}
            style={inlineStyle}
            width={attachment.width ?? undefined}
            height={attachment.height ?? undefined}
        />;
    } else {
        inner = <div className={style.attachmentFile}>
            <div className={style.fileIcon}>
                <FileIcon filetype={attachment.type} />
            </div>
            <div className={style.fileInfo}>
                <a
                    className={style.fileName}
                    href={url}
                    download={attachment.name}
                >{attachment.name}</a>
                <div className={style.fileSize}>{formatFileSize(attachment.size)}</div>
            </div>
        </div>;
    }
    return (
        <div className={style.attachment}>
            {inner}
        </div>
    );
};

export default Attachment;
