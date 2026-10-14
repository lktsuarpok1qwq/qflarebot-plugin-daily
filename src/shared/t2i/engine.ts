import { PNGCanvas } from "./png-template.js";
import { parseColor, stampMask, stampEmoji } from "./stamp.js";
import type { T2IRequest, Region } from "./types.js";
import type { RenderResources, Pixels } from "./resources.js";
import { getGlyph } from "./fonts.js";
import { emojiId, layout, layoutRuns } from "./text.js";

import { RenderError } from "./errors.js";

export function renderPng(request: T2IRequest, resources: RenderResources): Uint8Array {
    const { backgroundInfo, getBackground, getEmoji, getIcon, getFont } = resources;
    const background = getBackground(request.background);
    const bitmap = new PNGCanvas(background.data, background.info);
    const emojis = new Map<string, Pixels>();

    function check(bounds: Region | undefined, x: number, y: number, width: number, height: number) {
        if (bounds && (Math.floor(x) < bounds.x || Math.floor(y) < bounds.y || Math.ceil(x + width) > bounds.x + bounds.width || Math.ceil(y + height) > bounds.y + bounds.height)) {
            throw new RenderError("INVALID_INPUT", "绘制内容超出固定区域");
        }
    }
    function emoji(id: string, x: number, y: number, size: number, bounds?: Region) {
        check(bounds, x, y, size, size);
        const key = `${id}:${size}`;
        let pixels = emojis.get(key);

        if (!pixels) {
            pixels = getEmoji(id, size);
            emojis.set(key, pixels);
        }

        stampEmoji(bitmap, pixels, x, y, size);
    }

    for (const element of request.elements) {
        const size = element.size ?? 24;
        const bounds = element.region === undefined ? undefined : backgroundInfo(request.background).regions![element.region];
        const originX = element.x + (bounds?.x ?? 0), originY = element.y + (bounds?.y ?? 0);

        if (element.type === "icon") {
            check(bounds, originX, originY, size, size);
            stampMask(bitmap, getIcon(element.name, size), originX, originY, parseColor(element.color ?? "#ffffff"), size, size);
            continue;
        }

        if (element.type === "emoji") {
            emoji(emojiId(element.value), originX, originY, size, bounds);
            continue;
        }

        const font = getFont(element.weight ?? 400, size);
        const defaultColor = element.color ?? "#ffffff";
        const width = element.maxWidth ?? bounds?.width ?? bitmap.width;
        const lines = element.runs ? layoutRuns(element.runs, font, size, width, defaultColor) : layout(element.text, font, size, width);
        const color = parseColor(defaultColor);
        const colors = new Map<string, ReturnType<typeof parseColor>>();

        for (let i = 0; i < lines.length; i++) {
            const y = originY + i * (element.lineHeight ?? size * 1.3);

            if (!bounds && y >= bitmap.height) {
                break;
            }

            const line = lines[i]!;
            let x = originX - (element.align === "center" ? line.width / 2 : element.align === "right" ? line.width : 0);

            if (bounds && line.tokens.length) {
                check(bounds, x, y, line.width, size);
            }

            for (const token of line.tokens) {
                let ink = color;

                if (token.color && token.color !== defaultColor) {
                    ink = colors.get(token.color) ?? parseColor(token.color);
                    colors.set(token.color, ink);
                }

                if (token.kind === "emoji") {
                    emoji(token.value, x, y + size * 0.1, size, bounds);
                } else {
                    for (const character of token.value) {
                        const glyph = font.glyphs[character]!;
                        check(bounds, x + glyph.left, y + size + glyph.top, glyph.width, glyph.height);
                        const mask = getGlyph(font, character);
                        stampMask(bitmap, mask, x + glyph.left, y + size + glyph.top, ink);
                        x += glyph.advance;
                    }

                    continue;
                }

                x += token.width;
            }
        }
    }

    return bitmap.finish();
}
