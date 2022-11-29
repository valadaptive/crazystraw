import {Attachment} from './attachment';

export type Message = {
    timestamp: number;
    contents: string;
    attachments: Attachment[];
};
