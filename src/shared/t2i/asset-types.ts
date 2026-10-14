import type { Region } from "./types.js";

// y、左右像素边界、PNG chunk 偏移、解压后的扫描行偏移
type Segment = [number, number, number, number, number];
export interface RegionPNGInfo {
    segments: Segment[];
    segmentStarts: number[];
    allowedRows: [number, number][][];
}

export interface RowPNGInfo {
    width: number;
    height: number;
    channels: 3 | 4;
    stride: number;
    rowStart: number;
    rowChunkBytes: number;
    adlerChunk: number;
    adler: number;
    fixed?: RegionPNGInfo;
}

export interface EncodedPixels {
    width: number;
    height: number;
    data: string;
}
export interface SpriteSource extends EncodedPixels {
    variants?: Record<string, EncodedPixels>;
}
export interface BackgroundSource extends EncodedPixels {
    description: string;
    bytes: number;
    info: RowPNGInfo;
    regions?: Record<string, Region>;
}

export interface T2IAssets {
    backgrounds: Record<string, BackgroundSource>;
    fonts: Record<string, import("./fonts.js").Atlas>;
    emoji: Record<string, SpriteSource>;
    icons: Record<string, SpriteSource>;
}
