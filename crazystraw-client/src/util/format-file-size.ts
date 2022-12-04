const UNITS = ['B', 'KiB', 'MiB', 'GiB'];
const DIVISOR = 1024;

const formatFileSize = (bytes: number): string => {
    let unitIndex = 0;
    let sizeInUnits = bytes;
    while (sizeInUnits > DIVISOR && unitIndex < UNITS.length) {
        sizeInUnits /= DIVISOR;
        unitIndex++;
    }
    const fixedUnits = unitIndex === 0 ? sizeInUnits.toString() : sizeInUnits.toFixed(2);
    return `${fixedUnits} ${UNITS[unitIndex]}`;
};

export default formatFileSize;
