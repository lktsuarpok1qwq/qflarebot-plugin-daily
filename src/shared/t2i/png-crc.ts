const table = new Uint32Array(256);
const table1 = new Uint32Array(256), table2 = new Uint32Array(256), table3 = new Uint32Array(256);

for (let n = 0; n < 256; n++) {
    let crc = n;

    for (let k = 0; k < 8; k++) {
        crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    table[n] = crc >>> 0;
}

for (let n = 0; n < 256; n++) {
    const crc1 = table[table[n]! & 255]! ^ (table[n]! >>> 8);
    const crc2 = table[crc1 & 255]! ^ (crc1 >>> 8);
    table1[n] = crc1; table2[n] = crc2; table3[n] = table[crc2 & 255]! ^ (crc2 >>> 8);
}

export function crc32(data: Uint8Array, start: number, end: number): number {
    let crc = -1, i = start;

    for (; i + 4 <= end; i += 4) {
        crc ^= data[i]! | (data[i + 1]! << 8) | (data[i + 2]! << 16) | (data[i + 3]! << 24);
        crc = table3[crc & 255]! ^ table2[(crc >>> 8) & 255]! ^ table1[(crc >>> 16) & 255]! ^ table[crc >>> 24]!;
    }

    for (; i < end; i++) {
        crc = table[(crc ^ data[i]!) & 255]! ^ (crc >>> 8);
    }

    return (crc ^ -1) >>> 0;
}
