const MAX_DIMENSION = 256;

/** Crop an avatar to a square frame and resize it to, at most, 256x256. */
const resizeAvatar = async (image: Blob): Promise<Blob> => {
    const blobURL = URL.createObjectURL(image);
    const imgElem = document.createElement('img');

    await new Promise((resolve, reject) => {
        imgElem.onload = resolve;
        imgElem.onerror = reject;
        imgElem.src = blobURL;
    });

    if (
        imgElem.naturalWidth > MAX_DIMENSION ||
        imgElem.naturalHeight > MAX_DIMENSION ||
        imgElem.naturalWidth !== imgElem.naturalHeight ||
        // If the image > 100kb, try recompressing it
        (image instanceof Blob && image.size > 1024 * 100)
    ) {
        const minDimension = Math.min(imgElem.naturalWidth, imgElem.naturalHeight);
        const resultDimension = Math.min(minDimension, MAX_DIMENSION);
        const destWidth = Math.round(imgElem.naturalWidth * (resultDimension / minDimension));
        const destHeight = Math.round(imgElem.naturalHeight * (resultDimension / minDimension));
        // Offset to center images
        let xOffset = (destWidth - resultDimension) / -2;
        let yOffset = (destHeight - resultDimension) / -2;
        // Round offsets to prevent blurring if the image dimensions are close to the result dimensions
        if (imgElem.naturalWidth / destWidth < 2) xOffset = Math.round(xOffset);
        if (imgElem.naturalHeight / destHeight < 2) yOffset = Math.round(yOffset);

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = resultDimension;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create canvas context');
        ctx.drawImage(imgElem, xOffset, yOffset, destWidth, destHeight);

        URL.revokeObjectURL(blobURL);

        return new Promise((resolve, reject) => {
            try {
                canvas.toBlob(blob => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject('Could not create blob');
                    }
                // I know WebP sucks but it's significantly smaller than PNG
                }, 'image/webp', 1);
            } catch (err) {
                reject(err);
            }
        });
    }

    return image;
};

export default resizeAvatar;
