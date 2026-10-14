const table = new Uint32Array(256);
const table1 = new Uint32Array(256), table2 = new Uint32Array(256), table3 = new Uint32Array(256);
const table4 = new Uint32Array(256), table5 = new Uint32Array(256), table6 = new Uint32Array(256), table7 = new Uint32Array(256);

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
    const crc3 = table[crc2 & 255]! ^ (crc2 >>> 8);
    const crc4 = table[crc3 & 255]! ^ (crc3 >>> 8), crc5 = table[crc4 & 255]! ^ (crc4 >>> 8);
    const crc6 = table[crc5 & 255]! ^ (crc5 >>> 8);
    table1[n] = crc1; table2[n] = crc2; table3[n] = crc3;
    table4[n] = crc4; table5[n] = crc5; table6[n] = crc6; table7[n] = table[crc6 & 255]! ^ (crc6 >>> 8);
}

export function crc32(data: Uint8Array, start: number, end: number): number {
    let crc = -1, i = start;

    for (; i + 8 <= end; i += 8) {
        crc ^= data[i]! | (data[i + 1]! << 8) | (data[i + 2]! << 16) | (data[i + 3]! << 24);
        crc = table7[crc & 255]! ^ table6[(crc >>> 8) & 255]! ^ table5[(crc >>> 16) & 255]! ^ table4[crc >>> 24]!
            ^ table3[data[i + 4]!]! ^ table2[data[i + 5]!]! ^ table1[data[i + 6]!]! ^ table[data[i + 7]!]!;
    }

    for (; i < end; i++) {
        crc = table[(crc ^ data[i]!) & 255]! ^ (crc >>> 8);
    }

    return (crc ^ -1) >>> 0;
}
