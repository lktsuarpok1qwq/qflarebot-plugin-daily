import { parse as parseEmoji } from "@twemoji/parser";
import type { TextRun } from "./types.js";
import { getGlyph, type Atlas } from "./fonts.js";
import { unsupported } from "./errors.js";

export type Token = { kind: "text" | "emoji"; value: string; width: number; color?: string };
export type Line = { tokens: Token[]; width: number };
// 此集合内每个码点都是独立字素，且不能单独构成 Emoji；组合符、变体和其他文字走通用路径
const simpleText = /^[\x20-\x7e\n\u3000-\u3029\u3400-\u4dbf\u4e00-\u9fff\uff01-\uff60·°℃℉‘’“”…—]*$/;
let segmenter: Intl.Segmenter | undefined;

export function emojiId(value: string): string {
    const entities = parseEmoji(value, { buildUrl: codepoints => codepoints });

    if (entities.length !== 1 || entities[0]!.indices[0] !== 0 || entities[0]!.indices[1] !== value.length) {
        unsupported("暂不支持这个 Emoji");
    }

    return entities[0]!.url;
}

export function layout(text: string, font: Atlas, size: number, maxWidth: number, colorAt?: (offset: number) => string): Line[] {
    const tokens: Token[] = [];

    function append(value: string, start: number) {
        let cursor = start;
        const segments = simpleText.test(value) ? value : (segmenter ??= new Intl.Segmenter("zh", { granularity: "grapheme" })).segment(value);

        for (const item of segments) {
            const segment = typeof item === "string" ? item : item.segment;

            const style = colorAt ? { color: colorAt(cursor) } : {};
            cursor += segment.length;

            if (segment === "\n") {
                tokens.push({ kind: "text", value: segment, width: 0 });
                continue;
            }

            let width = 0;

            for (const character of segment) {
                width += getGlyph(font, character).advance;
            }

            tokens.push({ ...style, kind: "text", value: segment, width });
        }
    }

    let offset = 0;

    for (const entity of simpleText.test(text) ? [] : parseEmoji(text, { buildUrl: codepoints => codepoints })) {
        append(text.slice(offset, entity.indices[0]), offset);

        tokens.push({ ...(colorAt ? { color: colorAt(entity.indices[0]) } : {}), kind: "emoji", value: entity.url, width: size });
        offset = entity.indices[1];
    }

    append(text.slice(offset), offset);
    const lines: Line[] = [{ tokens: [], width: 0 }];

    for (const token of tokens) {
        let line = lines[lines.length - 1]!;

        if (token.value === "\n" && token.kind === "text") {
            lines.push({ tokens: [], width: 0 });
            continue;
        }

        if (line.tokens.length && line.width + token.width > maxWidth) {
            line = { tokens: [], width: 0 };
            lines.push(line);
        }

        line.tokens.push(token);
        line.width += token.width;
    }

    return lines;
}

/** 整段统一分词和换行；组合字素跨 runs 时使用其首字符的颜色 */
export function layoutRuns(runs: TextRun[], font: Atlas, size: number, maxWidth: number, defaultColor: string): Line[] {
    const text = runs.map(run => run.text).join("");
    let index = 0, end = runs[0]?.text.length ?? 0;
    return layout(text, font, size, maxWidth, offset => {
        while (index < runs.length - 1 && offset >= end) {
            index++; end += runs[index]!.text.length;
        }

        return runs[index]?.color ?? defaultColor;
    });
}
