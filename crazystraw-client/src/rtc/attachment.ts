import {Buffer} from 'buffer';

import {Attachment} from '../schemas/attachment';

import {generateID} from '../util/id';

const VIEWABLE_IMAGES = new Set([
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp'
]);

class ChatAttachment {
    public id: string;
    public name: string;
    public type: string;
    public width: null | number;
    public height: null | number;
    public data: Blob;

    private constructor (
        id: string,
        name: string,
        type: string,
        width: number | null,
        height: number | null,
        data: Blob) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.width = width;
        this.height = height;
        this.data = data;
    }

    public static async fromFile (file: File): Promise<ChatAttachment> {
        const fileType = file.type;

        let width: number | null = null, height: number | null = null;
        if (VIEWABLE_IMAGES.has(fileType)) {
            let objectURL = '';
            try {
                await new Promise<void>((resolve, reject) => {
                    const img = document.createElement('img');
                    objectURL = URL.createObjectURL(file);

                    img.addEventListener('load', () => {
                        width = img.naturalWidth;
                        height = img.naturalHeight;
                        resolve();
                    }, {once: true});

                    img.addEventListener('error', () => {
                        reject();
                    }, {once: true});

                    img.src = objectURL;
                });
            } catch (err) {
                // Do nothing if image cannot be loaded
            } finally {
                URL.revokeObjectURL(objectURL);
            }
        }

        return new ChatAttachment(
            generateID(),
            file.name,
            fileType,
            width,
            height,
            file
        );
    }

    public static fromAvro (attachment: Attachment): ChatAttachment {
        return new ChatAttachment(
            attachment.id,
            attachment.name,
            attachment.type,
            attachment.width ? attachment.width.int : null,
            attachment.height ? attachment.height.int : null,
            new Blob([attachment.data], {type: attachment.type})
        );
    }

    public async toAvro (): Promise<Attachment> {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            width: this.width ? {int: this.width} : null,
            height: this.height ? {int: this.height} : null,
            data: Buffer.from(await this.data.arrayBuffer())
        };
    }

    public get isViewableImage (): boolean {
        return VIEWABLE_IMAGES.has(this.type);
    }

    public get size (): number {
        return this.data.size;
    }
}

export default ChatAttachment;
