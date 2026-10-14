import { fromBase64 } from "./encoding.js";
import { unsupported } from "./errors.js";
import type { FontInfo } from "./types.js";

export interface Glyph {
    width: number; height: number;
    left: number; top: number; advance: number; data: string;
}
export interface Atlas {
    size: number; weight: 400 | 700;
    glyphs: Record<string, Glyph>;
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
const masks = new WeakMap<Glyph, { width: number; height: number; data: Uint8Array }>();
export function getGlyph(font: Atlas, character: string) {
    if (!Object.hasOwn(font.glyphs, character)) {
        unsupported("文字包含尚未生成的字形");
    }

    const source = font.glyphs[character]!;
    let mask = masks.get(source);

    if (!mask) {
        const alpha = fromBase64(source.data);

        if (alpha.length !== source.width * source.height) {
            throw new Error("字形素材数据损坏");
        }

        mask = { width: source.width, height: source.height, data: alpha };
        masks.set(source, mask);
    }

    return mask;
}
