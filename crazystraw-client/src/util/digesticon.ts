import {toByteArray} from 'base64-js';

/* eslint-disable @typescript-eslint/explicit-function-return-type */
const shapes: readonly ((color: string, transform: string) => string)[] = [
    /*(color: string, transform: string) => `<polygon points="0,0 16,0 0,8" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="8,0 16,0 16,16" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="0,16 16,16 16,8" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="0,0 0,16 8,16" fill="${color}" transform="${transform}"/>`,*/

    /*(color: string, transform: string) => `<polygon points="0,0 16,0 0,16" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="0,0 16,0 16,16" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="16,0 16,16 0,16" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="0,0 0,16 16,16" fill="${color}" transform="${transform}"/>`,

    (color: string, transform: string) => `<polygon points="0,8 16,16 8,0" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="8,0 0,16 16,8" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="16,8 0,0 8,16" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="8,16 16,0 0,8" fill="${color}" transform="${transform}"/>`,

    (color: string, transform: string) => `<polygon points="0,0 16,8 0,16" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="16,0 0,8 16,16" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="0,0 8,16 16,0" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="0,16 8,0 16,16" fill="${color}" transform="${transform}"/>`,*/

    (color: string, transform: string) => `<path d="M8 0v8h8v8H0V0z" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<path d="M16 8H8v8H0V0h16z" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<path d="M8 16V8H0V0h16v16z" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<path d="M0 8h8V0h8v16H0z" fill="${color}" transform="${transform}"/>`,

    (color: string, transform: string) => `<polygon points="0,0 0,4 12,16 16,16 16,12 4,0" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="16,0 16,4 4,16 0,16 0,12 12,0" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="0,0 0,16 16,0 16,16" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="0,0 16,0 0,16 16,16" fill="${color}" transform="${transform}"/>`,

    (color: string, transform: string) => `<circle cx="8" cy="8" r="8" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<rect width="16" height="16" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="8,0 16,8 8,16 0,8" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<path d="M0 0v16h16V0H0zm4 4h8v8H4V4z" fill="${color}" transform="${transform}"/>`,

    (color: string, transform: string) => `<polygon points="0,0 8,6 16,0 10,8 16,16 8,10 0,16 6,8" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<path d="M8 0L5.656 2.344H2.344v3.312L0 8l2.344 2.344v3.312h3.312L8 16l2.344-2.344h3.312v-3.312L16 8l-2.344-2.344V2.344h-3.312z" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<polygon points="6,0 10,0 10,6 16,6 16,10 10,10 10,16 6,16 6,10 0,10 0,6 6,6" fill="${color}" transform="${transform}"/>`,
    (color: string, transform: string) => `<path d="M2 2h5v5H2zM9 2h5v5H9zM9 9h5v5H9zM2 9h5v5H2z" fill="${color}" transform="${transform}"/>`
] as const;

const colorsFull = [
    '#f43550',
    '#fc7225',
    '#fcc325',
    '#99d51b',
    '#3cd4bc',
    '#4174e7',
    '#8046cf',
    '#e359bf'
];

const colorsLight = [
    '#f48a7a',
    '#fcc557',
    '#fce862',
    '#cbd562',
    '#69ecc4',
    '#55aaea',
    '#7d88da',
    '#e593e4'
];

const colorLightnessMap = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2]
];

const coordLookup = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],

    [0, 1],
    [1, 1],
    [3, 1],
    [4, 1],

    [0, 2],
    // center tile not drawn
    [4, 2],

    [0, 3],
    [1, 3],
    [3, 3],
    [4, 3],

    [0, 4],
    [1, 4],
    [2, 4],
    [3, 4],
    [4, 4],


    // draw center tiles last
    [2, 1],
    [1, 2],
    [3, 2],
    [2, 3]
];

/* eslint-enable @typescript-eslint/explicit-function-return-type */

const svgToURI = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const createDigestIcon = (digest: Uint8Array | string): string => {
    if (typeof digest === 'string') digest = toByteArray(digest);
    if (digest.length !== 16) throw new Error('Digest must be 128 bits');
    const colorIndex = digest[0] & 7;
    const shapesInSvg = [];
    for (let i = 0; i < 12; i++) {
        const tripletShift = 5 - ((i * 3) % 8);
        const tripletOffset = Math.floor((i * 3) / 8);

        let colorPair;
        if (i < 10) {
            const tripletHiSrc = digest[12 + tripletOffset];
            const tripletHi = (tripletShift < 0 ?
                (tripletHiSrc << -tripletShift) :
                (tripletHiSrc >>> tripletShift)) & 0b111;
            const tripletLo = tripletShift < 0 ? digest[13 + tripletOffset] >>> (8 + tripletShift) : 0;
            const triplet = tripletHi | tripletLo;
            colorPair = colorLightnessMap[triplet];
        } else {
            colorPair = [1, 1];
        }
        // console.log(triplet.toString(2), tripletHi.toString(2), tripletLo.toString(2), tripletShift);

        for (let j = 0; j < 2; j++) {
            const quartet = (digest[i] >>> (j ? 4 : 0)) & 0xf;
            const index = (i * 2) + j;

            const [x, y] = coordLookup[index];

            const lightness = colorPair[j];
            const color = lightness === 0 ? '#171a2d' :
                lightness === 1 ? colorsFull[colorIndex] : colorsLight[colorIndex];

            const shape = shapes[quartet](color, `translate(${x * 16}, ${y * 16})`);
            shapesInSvg.push(shape);
        }
    }

    const result = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" fill="#f5f5f4" />${shapesInSvg.join('')}</svg>`;
    return svgToURI(result);
};

export default createDigestIcon;
