import { unzlibSync } from "fflate";
import { fromBase64 } from "./encoding.js";
import { unsupported } from "./errors.js";
import type { FontInfo } from "./types.js";

export interface Atlas {
    size: number; weight: 400 | 700;
    glyphs: Record<string, number>;
    data: string;
}
interface Glyph {
    width: number; height: number;
    left: number; top: number; advance: number;
    data: Uint8Array;
}
export function createFonts(fonts: Record<string, Atlas>) {
    let info: FontInfo[] | undefined;
    function listFonts(): FontInfo[] {
        info ??= Object.values(fonts).map(font => ({ size: font.size, weight: font.weight, characters: Object.keys(font.glyphs).join("") }));
        return info.map(font => ({ ...font }));
    }

    function getFont(weight: 400 | 700, size: number): Atlas {
        const key = `${weight}-${size}`;

        if (!Object.hasOwn(fonts, key)) {
            unsupported("该字重和字号尚未生成字形");
        }

        return fonts[key]!;
    }

    return { listFonts, getFont };
}
const glyphHeaderBytes = 10;
const glyphs = new WeakMap<Atlas, Map<string, Glyph>>();
/** 每字独立 zlib 压缩，解码后为 10 字节小端 Int16 度量头及 Alpha8，不解压整库 */
export function getGlyph(font: Atlas, character: string): Glyph {
    if (!Object.hasOwn(font.glyphs, character)) {
        unsupported("文字包含尚未生成的字形");
    }

    let decoded = glyphs.get(font);
    const cached = decoded?.get(character);

    if (cached) { return cached; }

    const start = font.glyphs[character]!;
    const end = font.data.indexOf(";", start);

    if (end < start) { throw new Error("字形素材数据损坏"); }

    const bytes = unzlibSync(fromBase64(font.data.slice(start, end)));

    if (bytes.length < glyphHeaderBytes) { throw new Error("字形素材数据损坏"); }

    const view = new DataView(bytes.buffer, bytes.byteOffset, glyphHeaderBytes);
    const width = view.getInt16(0, true), height = view.getInt16(2, true);
    const left = view.getInt16(4, true), top = view.getInt16(6, true), advance = view.getInt16(8, true);

    if (width < 0 || height < 0 || advance < 0 || bytes.length !== glyphHeaderBytes + width * height) {
        throw new Error("字形素材数据损坏");
    }

    const glyph = { width, height, left, top, advance, data: bytes.subarray(glyphHeaderBytes) };

    if (!decoded) { decoded = new Map(); glyphs.set(font, decoded); }

    decoded.set(character, glyph);
    return glyph;
}
