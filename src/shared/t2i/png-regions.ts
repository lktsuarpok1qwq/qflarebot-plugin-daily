import { crc32 } from "./png-crc.js";
import { RenderError } from "./errors.js";
import type { RowPNGInfo } from "./asset-types.js";

export class RegionCanvas {
    readonly width: number;
    readonly height: number;
    readonly channels: 3 | 4;
    private readonly rows: (Uint8Array | undefined)[];
    private readonly lefts: Int32Array;
    private readonly rights: Int32Array;

    constructor(private readonly original: Uint8Array, private readonly info: RowPNGInfo, readonly data: Uint8Array) {
        this.width = info.width; this.height = info.height; this.channels = info.channels;
        this.rows = new Array(info.height);
        this.lefts = new Int32Array(info.height).fill(info.width);
        this.rights = new Int32Array(info.height);
    }

    row(y: number): Uint8Array {
        let row = this.rows[y];

        if (!row) {
            const begin = this.info.fixed!.segmentStarts[y]!, endIndex = this.info.fixed!.segmentStarts[y + 1]!;

            if (begin === endIndex) {
                throw new RenderError("INVALID_INPUT", "绘制内容超出固定区域");
            }

            const segment = this.info.fixed!.segments[begin]!, origin = segment[3]! + 13 - segment[1]! * this.channels;

            if (endIndex === begin + 1 && origin >= 0) {
                // 单区间行直接映射 PNG 字节。区间外不是像素，touch 必须先验证每次绘制范围
                row = this.data.subarray(origin, origin + this.width * this.channels);
            } else {
                row = new Uint8Array(this.width * this.channels);

                for (let i = begin; i < endIndex; i++) {
                    const [, left, right, chunk] = this.info.fixed!.segments[i]!;
                    row.set(this.data.subarray(chunk + 13, chunk + 13 + (right - left) * this.channels), left * this.channels);
                }
            }

            this.rows[y] = row;
        }

        return row;
    }

    touch(x: number, y: number, width: number, height: number): void {
        if (x < 0 || y < 0 || x + width > this.width || y + height > this.height) {
            throw new RenderError("INVALID_INPUT", "绘制内容超出固定区域");
        }

        const left = Math.floor(x), right = Math.ceil(x + width);
        const top = Math.max(0, Math.floor(y)), bottom = Math.min(this.height, Math.ceil(y + height));

        if (left >= right) {
            return;
        }

        for (let yy = top; yy < bottom; yy++) {
            let cursor = left;
            const spans = this.info.fixed!.allowedRows[yy]!;

            for (const [start, end] of spans) {
                if (start <= cursor) {
                    cursor = Math.max(cursor, end);
                }
            }

            if (cursor < right) {
                throw new RenderError("INVALID_INPUT", "绘制内容超出固定区域");
            }

            this.lefts[yy] = Math.min(left, this.lefts[yy]!);
            this.rights[yy] = Math.max(right, this.rights[yy]!);
        }
    }

    finish(): Uint8Array {
        const { adler, adlerChunk, stride, height } = this.info;
        let a = adler & 65535, b = adler >>> 16;
        const view = new DataView(this.data.buffer);

        for (let y = 0; y < height; y++) {
            const left = this.lefts[y]!, right = this.rights[y]!;

            if (left >= right) {
                continue;
            }

            const row = this.row(y);

            for (let index = this.info.fixed!.segmentStarts[y]!; index < this.info.fixed!.segmentStarts[y + 1]!; index++) {
                const [, start, end, chunk, rawOffset] = this.info.fixed!.segments[index]!;
                const from = Math.max(left, start), to = Math.min(right, end);

                if (from >= to) {
                    continue;
                }

                for (let x = from * this.channels; x < to * this.channels; x++) {
                    const local = x - start * this.channels, pos = chunk + 13 + local;
                    const value = row[x]!, delta = value - this.original[pos]!;
                    this.data[pos] = value;

                    if (delta !== 0) { a += delta; b += delta * (stride * height - rawOffset - local); }
                }

                a %= 65521; b %= 65521;
                const crcEnd = chunk + 13 + (end - start) * this.channels;
                view.setUint32(crcEnd, crc32(this.data, chunk + 4, crcEnd));
            }
        }

        a = (a + 65521) % 65521; b = (b + 65521) % 65521;
        view.setUint32(adlerChunk + 8, ((b << 16) | a) >>> 0);
        view.setUint32(adlerChunk + 12, crc32(this.data, adlerChunk + 4, adlerChunk + 12));
        return this.data;
    }
}
