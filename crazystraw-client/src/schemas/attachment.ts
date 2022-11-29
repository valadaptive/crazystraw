import {uuid} from './uuid';

export type Attachment = {
    id: uuid;
    name: string;
    width: null | number;
    height: null | number;
    data: ArrayBuffer;
};
