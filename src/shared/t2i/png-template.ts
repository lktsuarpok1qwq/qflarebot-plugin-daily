import { crc32 } from "./png-crc.js";
import { RegionCanvas } from "./png-regions.js";
import type { RowPNGInfo } from "./asset-types.js";
export { crc32 } from "./png-crc.js";
function adler32(data: Uint8Array, initial: number): number {
    let a = initial & 65535, b = initial >>> 16;

    for (let start = 0; start < data.length; start += 5552) {
        const end = Math.min(start + 5552, data.length);

        for (let i = start; i < end; i++) {
            a += data[i]!; b += a;
        }

        a %= 65521; b %= 65521;
    }

    return ((b << 16) | a) >>> 0;
}

/** 发布准备期调用；每行一个 Stored block 与 IDAT，允许保留背景 Alpha */
export function prepareRowPNG(width: number, height: number, pixels: Uint8Array): { data: Uint8Array; info: RowPNGInfo } {
    const channels = pixels.every((value, i) => i % 4 !== 3 || value === 255) ? 3 : 4;
    const stride = width * channels + 1;

    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || stride > 65535 || pixels.length !== width * height * 4) {
        throw new Error("PNG 模板尺寸不正确");
    }

    const data = new Uint8Array(8 + 25 + 14 + height * (stride + 17) + 16 + 12);
    const view = new DataView(data.buffer); let cursor = 8;
    data.set([137, 80, 78, 71, 13, 10, 26, 10]);
    function chunk(type: string, bytes: Uint8Array) {
        const start = cursor; view.setUint32(start, bytes.length);
        data.set([...type].map(c => c.charCodeAt(0)), start + 4); data.set(bytes, start + 8);
        view.setUint32(start + bytes.length + 8, crc32(data, start + 4, start + bytes.length + 8));
        cursor += bytes.length + 12; return start;
    }
    const header = new Uint8Array(13), hv = new DataView(header.buffer);
    hv.setUint32(0, width); hv.setUint32(4, height); header[8] = 8; header[9] = channels === 3 ? 2 : 6;
    chunk("IHDR", header); chunk("IDAT", new Uint8Array([0x78, 1]));
    const rowStart = cursor; let adler = 1;

    for (let y = 0; y < height; y++) {
        const block = new Uint8Array(stride + 5), bv = new DataView(block.buffer);
        block[0] = y === height - 1 ? 1 : 0; bv.setUint16(1, stride, true); bv.setUint16(3, stride ^ 65535, true);

        if (channels === 4) {
            block.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), 6);
        } else {
            for (let x = 0; x < width; x++) {
                const source = (y * width + x) * 4, target = 6 + x * 3;
                block[target] = pixels[source]!; block[target + 1] = pixels[source + 1]!; block[target + 2] = pixels[source + 2]!;
            }
        }

        adler = adler32(block.subarray(5), adler); chunk("IDAT", block);
    }

    const trailer = new Uint8Array(4); new DataView(trailer.buffer).setUint32(0, adler);
    const adlerChunk = chunk("IDAT", trailer); chunk("IEND", new Uint8Array());
    return { data, info: { width, height, channels, stride, rowStart, rowChunkBytes: stride + 17, adlerChunk, adler } };
}

export class PNGCanvas {
    readonly data: Uint8Array;
    readonly width: number;
    readonly height: number;
    readonly channels: 3 | 4;
    private readonly sparse?: RegionCanvas;
    private readonly lefts: Int32Array;
    private readonly rights: Int32Array;

    constructor(private readonly original: Uint8Array, private readonly info: RowPNGInfo) {
        this.width = info.width; this.height = info.height;
        this.channels = info.channels;
        this.data = original.slice();

        if (info.fixed) {
            this.sparse = new RegionCanvas(original, info, this.data);
        }

        this.lefts = new Int32Array(info.fixed ? 0 : info.height).fill(info.width);
        this.rights = new Int32Array(info.fixed ? 0 : info.height);
    }

    row(y: number): Uint8Array {
        if (this.sparse) { return this.sparse.row(y); }

        const start = this.info.rowStart + y * this.info.rowChunkBytes + 14;
        return this.data.subarray(start, start + this.width * this.channels);
    }

    touch(x: number, y: number, width: number, height: number): void {
        if (this.sparse) { this.sparse.touch(x, y, width, height); return; }

        const left = Math.max(0, Math.floor(x)), right = Math.min(this.width, Math.ceil(x + width));
        const top = Math.max(0, Math.floor(y)), bottom = Math.min(this.height, Math.ceil(y + height));

        if (left >= right) {
            return;
        }

        for (let row = top; row < bottom; row++) {
            this.lefts[row] = Math.min(this.lefts[row]!, left); this.rights[row] = Math.max(this.rights[row]!, right);
        }
    }

    finish(): Uint8Array {
        if (this.sparse) { return this.sparse.finish(); }

        const { stride, height, rowStart, rowChunkBytes, adlerChunk, adler } = this.info;
        const view = new DataView(this.data.buffer), total = stride * height;
        let a = adler & 65535, b = adler >>> 16;

        for (let y = 0; y < height; y++) {
            if (this.rights[y]! <= this.lefts[y]!) {
                continue;
            }

            const chunk = rowStart + y * rowChunkBytes, start = chunk + 14;

            for (let x = this.lefts[y]! * this.channels; x < this.rights[y]! * this.channels; x++) {
                const delta = this.data[start + x]! - this.original[start + x]!;

                if (delta !== 0) { a += delta; b += delta * (total - (y * stride + 1 + x)); }
            }

            a %= 65521; b %= 65521;
            view.setUint32(chunk + rowChunkBytes - 4, crc32(this.data, chunk + 4, chunk + rowChunkBytes - 4));
        }

        a = (a + 65521) % 65521; b = (b + 65521) % 65521;
        view.setUint32(adlerChunk + 8, ((b << 16) | a) >>> 0);
        view.setUint32(adlerChunk + 12, crc32(this.data, adlerChunk + 4, adlerChunk + 12));
        return this.data;
    }
}
