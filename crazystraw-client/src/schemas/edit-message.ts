import {uuid} from './uuid';

export type EditMessage = {
    messageID: uuid;
    newContents: string;
    timestamp: number;
};
