import {useEffect, useMemo} from 'preact/hooks';

const blobURLRegistry = new WeakMap<Blob, {url: string, refcount: number}>();

/**
 * React hook for taking care of tracking and revoking URLs for Blobs.
 * @param blob The blob to get a URL for.
 * @returns A corresponding blob URL that will be automatically revoked when all components using it unmount.
 */
const useBlobURL = <T extends Blob | null>(blob: T): T extends Blob ? string : string | null => {
    const blobUrl = useMemo(() => {
        if (!blob) return null;
        let entry = blobURLRegistry.get(blob);
        if (entry) {
            entry.refcount++;
        } else {
            entry = {
                refcount: 1,
                url: URL.createObjectURL(blob)
            };
            blobURLRegistry.set(blob, entry);
        }
        return entry.url;
    }, [blob]);

    useEffect(() => {
        if (!blob) return;
        return () => {
            const entry = blobURLRegistry.get(blob);
            if (!entry) return;
            entry.refcount--;
            if (entry.refcount === 0) {
                URL.revokeObjectURL(entry.url);
                blobURLRegistry.delete(blob);
            }
        };
    }, [blob]);
    return blobUrl!;
};

export default useBlobURL;
