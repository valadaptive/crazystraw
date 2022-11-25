import {useMemo} from 'preact/hooks';

const EMPTY_ARRAY: never[] = [];

const useKey = (): (item: object) => string => {
    return useMemo(() => {
        let id = 0;
        const objectKeys = new WeakMap<object, string>();

        return (item: object): string => {
            const existingId = objectKeys.get(item);
            if (existingId) return existingId;

            const newId = (id++).toString();
            objectKeys.set(item, newId);
            return newId;
        };
    }, EMPTY_ARRAY);
};

export default useKey;
