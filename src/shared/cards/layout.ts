import { expand } from "../interpolation.js";
import metrics from "./metrics.json";
import type { CardDesign, CardRegion } from "./types.js";
export type CardHighlights = Record<string, { words: readonly string[]; color: string }>;
type CardLayer = { text?: string; emoji?: string; left: number; top: number; size: number; color: string; weight: number };
export type CardLayoutResult = { layers: CardLayer[]; overflow: string[] };
type TextRegion = Omit<CardRegion, "field" | "text" | "color">;
// Shared glyph layout keeps browser previews and Images positions identical.
export function createTextLayout(widths: Record<string, Record<string, number>>) {
    const layers: CardLayer[] = [], overflow: string[] = [];
    let segmenter: Intl.Segmenter | undefined;
    function add(region: TextRegion, text: string, color: string, emphasis?: CardHighlights[string]) {
        if (!text) { return; }

        if (text.length > 1000) { overflow.push(region.id); return; }

        const simple = /^[\x20-\x7e\n\u3000-\u3029\u3400-\u4dbf\u4e00-\u9fff\uff01-\uff60·°℃℉‘’“”…—]*$/.test(text);
        const advances = widths[region.weight];

        if (simple && !emphasis?.words.length && !text.includes("\n") && region.height >= region.size) {
            let width = 0;

            for (const ch of text) { width += (advances?.[ch] ?? 1) * region.size; }

            if (width <= region.width) {
                const x = region.x + (region.align === "center" ? (region.width - width) / 2 : region.align === "right" ? region.width - width : 0);
                layers.push({ text, left: Math.round(x), top: region.y, size: region.size, color, weight: region.weight });
                return;
            }
        }

        const ranges: { start: number; end: number }[] = [];

        for (const word of emphasis?.words ?? []) {
            if (!word) { continue; }

            let offset = 0;

            while ((offset = text.indexOf(word, offset)) !== -1) { ranges.push({ start: offset, end: offset + word.length }); offset += word.length; }
        }

        let offset = 0;
        type Token = { text: string; emoji?: string; width: number; color: string };
        const lines: { tokens: Token[]; width: number }[] = [{ tokens: [], width: 0 }];

        const segments = simple ? text : /^\p{Extended_Pictographic}\ufe0f?$/u.test(text) ? [text] : (segmenter ??= new Intl.Segmenter("zh", { granularity: "grapheme" })).segment(text);
        const maxLines = Math.floor((region.height - region.size) / region.lineHeight) + 1;

        for (const part of segments) {
            const segment = typeof part === "string" ? part : part.segment;
            const tokenColor = ranges.length && ranges.some(range => offset >= range.start && offset < range.end) ? emphasis!.color : color;
            offset += segment.length;

            if (segment === "\n") {
                lines.push({ tokens: [], width: 0 });

                if (lines.length > maxLines) { break; }

                continue;
            }

            const isEmoji = !simple && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(segment);
            const emoji = isEmoji ? Array.from(segment.includes("\u200d") ? segment : segment.replaceAll("\ufe0f", ""), ch => ch.codePointAt(0)!.toString(16)).join("-") : undefined;
            let advance = 1;

            if (!isEmoji) {
                advance = 0;

                for (const ch of segment) { advance += advances?.[ch] ?? 1; }
            }

            const width = advance * region.size;
            let line = lines[lines.length - 1]!;

            if (line.tokens.length && line.width + width > region.width) { line = { tokens: [], width: 0 }; lines.push(line); }

            if (lines.length > maxLines) { break; }

            line.tokens.push({ text: segment, emoji, width, color: tokenColor }); line.width += width;
        }

        if ((lines.length - 1) * region.lineHeight + region.size > region.height || lines.some(line => line.width > region.width)) { overflow.push(region.id); }

        for (const [index, line] of lines.entries()) {
            if (index * region.lineHeight + region.size > region.height) { break; }

            let x = region.x + (region.align === "center" ? (region.width - line.width) / 2 : region.align === "right" ? region.width - line.width : 0);
            let group: CardLayer | undefined;

            for (const token of line.tokens) {
                if (token.emoji) {
                    group = undefined;
                    layers.push({ emoji: token.emoji, left: Math.round(x), top: region.y + index * region.lineHeight, size: region.size, color: color, weight: region.weight });
                } else {
                    if (!group || group.color !== token.color) { group = { text: "", left: Math.round(x), top: region.y + index * region.lineHeight, size: region.size, color: token.color, weight: region.weight }; layers.push(group); }

                    group.text += token.text;
                }

                x += token.width;
            }
        }
    }
    function finish(): CardLayoutResult {
        if (layers.length > 100) { throw new Error("内容过于复杂，请减少区域或文字"); }

        return { layers, overflow };
    }
    return { add, finish };
}
export const textLayout = () => createTextLayout(metrics);
export function layoutCard(design: CardDesign, values: Record<string, string>, widths: Record<string, Record<string, number>>, interpolate: typeof expand, highlights: CardHighlights = {}): CardLayoutResult {
    const layout = createTextLayout(widths);

    for (const region of design.regions) {
        const text = region.text === undefined ? values[region.field] ?? "" : interpolate(region.text, {}, values);
        layout.add(region, text, region.color, region.text === undefined ? highlights[region.field] : undefined);
    }

    return layout.finish();
}
export const cardLayout = (design: CardDesign, values: Record<string, string>, highlights: CardHighlights = {}) => layoutCard(design, values, metrics, expand, highlights);
export const emojiURL = (id: string) => `https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.2/assets/72x72/${id}.png`;
